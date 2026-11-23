import type { Color } from 'chess.js';
import type { TimeControl } from './timeControls';

export interface ClockSnapshot {
  w: number;
  b: number;
}

/**
 * Relógio de xadrez baseado em timestamps (não acumula erro de setInterval).
 * Regras: o relógio só começa a correr depois que cada lado fez seu primeiro
 * lance; o incremento é somado após cada lance a partir do terceiro.
 */
export class ChessClock {
  readonly enabled: boolean;
  readonly incrementMs: number;
  private rem: ClockSnapshot;
  private runningColor: Color | null = null;
  private last = 0;
  private now: () => number;

  constructor(tc: TimeControl, now: () => number = () => performance.now()) {
    this.enabled = Number.isFinite(tc.initialMs);
    this.incrementMs = tc.incrementMs;
    this.rem = { w: tc.initialMs, b: tc.initialMs };
    this.now = now;
  }

  get running(): Color | null {
    return this.runningColor;
  }

  /** Tempo restante atual (inclui o tempo corrente do lado ativo). */
  get(color: Color): number {
    if (!this.enabled) return Infinity;
    if (this.runningColor === color) return Math.max(0, this.rem[color] - (this.now() - this.last));
    return this.rem[color];
  }

  private sync() {
    if (this.runningColor) {
      const t = this.now();
      this.rem[this.runningColor] = Math.max(0, this.rem[this.runningColor] - (t - this.last));
      this.last = t;
    }
  }

  start(color: Color) {
    if (!this.enabled) return;
    this.sync();
    this.runningColor = color;
    this.last = this.now();
  }

  /** Chamado quando `mover` completa um lance. `plyCount` = total de lances após ele. */
  onMove(mover: Color, plyCount: number) {
    if (!this.enabled) return;
    const next: Color = mover === 'w' ? 'b' : 'w';
    if (plyCount <= 1) {
      this.runningColor = null; // primeiro lance das brancas: ainda sem tempo correndo
      return;
    }
    if (plyCount === 2) {
      this.start('w');
      return;
    }
    this.sync();
    this.rem[mover] += this.incrementMs;
    this.runningColor = next;
    this.last = this.now();
  }

  pause() {
    this.sync();
    this.runningColor = null;
  }

  /** Cor que estourou o tempo (se alguma). */
  flagged(): Color | null {
    if (!this.enabled) return null;
    if (this.runningColor && this.get(this.runningColor) <= 0) return this.runningColor;
    return null;
  }

  snapshot(): ClockSnapshot {
    this.sync();
    return { ...this.rem };
  }

  restore(s: ClockSnapshot, plyCount: number, turn: Color) {
    if (!this.enabled) return;
    this.rem = { ...s };
    if (plyCount >= 2) {
      this.runningColor = turn;
      this.last = this.now();
    } else {
      this.runningColor = null;
    }
  }
}
