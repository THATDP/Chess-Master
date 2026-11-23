import { Chess, type Color, type Move } from 'chess.js';
import { engineManager } from '../engines/manager';
import type { EngineInfo, EngineSettings, EngineStatus } from '../engines/types';
import { newId, type SavedGame } from '../lib/history';
import type { SoundKind } from '../lib/sound';
import { ChessClock, type ClockSnapshot } from './clock';
import { materialFromFen, type MaterialInfo } from './material';
import { exportPgn } from './pgn';
import { getGameStatus, timeoutResult, type ForcedResult, type GameStatus } from './status';
import { UNLIMITED, type TimeControl } from './timeControls';

export interface GameConfig {
  engineId: string;
  engineName: string;
  levelLabel: string;
  engineSettings: EngineSettings;
  playerColor: Color;
  timeControl: TimeControl;
  playerName?: string;
  /** Retomar uma partida salva. */
  startPgn?: string;
  /** Posição inicial personalizada (FEN). */
  startFen?: string;
  savedId?: string;
}

export interface GameCallbacks {
  sound?: (k: SoundKind) => void;
  onSave?: (rec: SavedGame) => void;
  minEngineDelayMs?: number;
}

export interface LastMoveView {
  move: Move;
  /** Animar a peça (falso para lances arrastados pelo usuário e desfazer). */
  animate: boolean;
  seq: number;
}

export interface GameView {
  active: boolean;
  config: GameConfig | null;
  fen: string;
  liveFen: string;
  turn: Color;
  history: Move[];
  viewPly: number;
  isLive: boolean;
  status: GameStatus;
  legalMoves: Move[];
  lastMove: LastMoveView | null;
  checkSquare: string | null;
  canUndo: boolean;
  thinking: boolean;
  engineInfo: EngineInfo | null;
  engineError: string | null;
  engineStatus: EngineStatus;
  engineColor: Color | null;
  material: MaterialInfo;
  pgn: string;
  clockEnabled: boolean;
  /** Incrementa a cada mudança de posição (para efeitos). */
  version: number;
}

type Source = 'drag' | 'click' | 'engine';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const opposite = (c: Color): Color => (c === 'w' ? 'b' : 'w');

/**
 * Controlador da partida: concentra regras (chess.js), relógio, desfazer,
 * navegação no histórico e orquestração do adversário via EngineManager.
 * Não depende de React nem de nenhuma engine específica.
 */
export class GameController {
  chess = new Chess();
  config: GameConfig | null = null;
  clock = new ChessClock(UNLIMITED);

  private forced: ForcedResult | null = null;
  private viewPly: number | null = null;
  private thinking = false;
  private engineInfo: EngineInfo | null = null;
  private engineError: string | null = null;
  private engineReady: Promise<boolean> = Promise.resolve(true);
  private snapshots: ClockSnapshot[] = [];
  private lastAnimate = true;
  private seq = 0;
  private token = 0;
  private abort: AbortController | null = null;
  private listeners = new Set<() => void>();
  private ticker: ReturnType<typeof setInterval> | null = null;
  private savedId: string = newId();
  private startedAt = Date.now();
  private posVersion = 0;
  private cache: { ver: number; derived: Derived } | null = null;
  private lastInfoEmit = 0;
  private view: GameView;
  private cb: GameCallbacks;
  private unsubManager: () => void;

  constructor(cb: GameCallbacks = {}) {
    this.cb = cb;
    this.view = this.buildView();
    this.unsubManager = engineManager.subscribe(() => this.emit());
  }

  /* ------------------------------ assinatura ------------------------------ */

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  getView = () => this.view;

  setCallbacks(cb: GameCallbacks) {
    this.cb = cb;
  }

  private emit() {
    this.view = this.buildView();
    this.listeners.forEach((l) => l());
  }

  private touch() {
    this.posVersion++;
  }

  /* ------------------------------ ciclo da partida ------------------------------ */

  start(config: GameConfig) {
    this.cancelEngine();
    this.persist();
    this.config = config;
    this.chess = new Chess();
    try {
      if (config.startPgn) this.chess.loadPgn(config.startPgn);
      else if (config.startFen) this.chess = new Chess(config.startFen);
    } catch {
      this.chess = new Chess();
    }
    const tc = config.startPgn ? UNLIMITED : config.timeControl;
    this.clock = new ChessClock(tc);
    const snap = this.clock.snapshot();
    this.snapshots = Array.from({ length: this.chess.history().length + 1 }, () => ({ ...snap }));
    this.forced = null;
    this.viewPly = null;
    this.engineInfo = null;
    this.engineError = null;
    this.thinking = false;
    this.savedId = config.savedId ?? newId();
    this.startedAt = Date.now();
    this.lastAnimate = false;
    this.seq++;
    this.touch();
    this.startTicker();
    this.cb.sound?.('start');
    this.prepareEngine();
    this.emit();
    this.maybeRequestEngineMove();
  }

  /** Encerra tudo (ao desmontar o aplicativo). */
  dispose() {
    this.cancelEngine();
    this.persist();
    this.stopTicker();
    this.unsubManager();
    engineManager.dispose();
  }

  /** Abandona a partida atual (sem salvar nada de novo) e libera a engine. */
  closeGame() {
    this.cancelEngine();
    this.persist();
    this.stopTicker();
    this.config = null;
    this.chess = new Chess();
    this.forced = null;
    this.viewPly = null;
    this.engineInfo = null;
    this.engineError = null;
    this.touch();
    this.emit();
  }

  private prepareEngine() {
    const c = this.config;
    if (!c) return;
    this.engineReady = engineManager.newGame(c.engineId, c.engineSettings).then(
      () => true,
      (e: Error) => {
        this.thinking = false;
        this.engineError = e.message || 'Falha ao carregar o adversário.';
        this.emit();
        return false;
      },
    );
  }

  /** Tenta novamente após erro (reinicia a engine do zero). */
  retryEngine() {
    const c = this.config;
    if (!c) return;
    this.cancelEngine();
    engineManager.dispose(c.engineId);
    this.engineError = null;
    this.prepareEngine();
    this.emit();
    this.maybeRequestEngineMove();
  }

  /** Troca de adversário durante a partida (ex.: após falha do Stockfish). */
  switchEngine(next: Pick<GameConfig, 'engineId' | 'engineName' | 'levelLabel' | 'engineSettings'>) {
    if (!this.config) return;
    this.cancelEngine();
    this.config = { ...this.config, ...next };
    this.engineError = null;
    this.engineInfo = null;
    this.touch();
    this.prepareEngine();
    this.emit();
    this.maybeRequestEngineMove();
  }

  /* ------------------------------ lances ------------------------------ */

  private get engineColor(): Color | null {
    return this.config ? opposite(this.config.playerColor) : null;
  }

  private isOver() {
    return getGameStatus(this.chess, this.forced).over;
  }

  /** Lances legais da posição atual (somente leitura). */
  legalMoves(): Move[] {
    return this.chess.moves({ verbose: true });
  }

  /**
   * Joga um lance do usuário (ou da engine). Retorna `null` para lances ilegais —
   * nunca altera o estado nesse caso.
   */
  playMove(from: string, to: string, promotion?: string, source: Source = 'click'): Move | null {
    if (!this.config || this.viewPly !== null || this.isOver()) return null;
    if (source !== 'engine' && this.chess.turn() !== this.config.playerColor) return null;
    if (source !== 'engine' && this.thinking) return null;
    let move: Move;
    try {
      move = this.chess.move({ from, to, promotion });
    } catch {
      return null;
    }
    this.lastAnimate = source !== 'drag';
    this.seq++;
    const ply = this.chess.history().length;
    this.clock.onMove(move.color, ply);
    this.snapshots.length = ply;
    this.snapshots[ply] = this.clock.snapshot();
    this.touch();

    const status = getGameStatus(this.chess, this.forced);
    this.cb.sound?.(this.soundFor(move, status));
    if (status.over) this.finish();
    else this.emit();
    if (!status.over) this.maybeRequestEngineMove();
    return move;
  }

  private soundFor(move: Move, status: GameStatus): SoundKind {
    if (status.over) return 'end';
    if (status.check) return 'check';
    if (move.promotion) return 'promote';
    if (move.isKingsideCastle() || move.isQueensideCastle()) return 'castle';
    if (move.captured) return 'capture';
    return 'move';
  }

  undo(): boolean {
    if (!this.config) return false;
    const minPlies = this.config.playerColor === 'w' ? 0 : 1;
    if (this.chess.history().length <= minPlies) return false;
    this.cancelEngine();
    this.chess.undo();
    if (this.chess.turn() !== this.config.playerColor && this.chess.history().length > minPlies) {
      this.chess.undo();
    }
    const n = this.chess.history().length;
    this.forced = null;
    this.viewPly = null;
    this.engineInfo = null;
    this.snapshots.length = n + 1;
    this.clock.restore(this.snapshots[n] ?? this.clock.snapshot(), n, this.chess.turn());
    this.lastAnimate = false;
    this.seq++;
    this.touch();
    this.startTicker();
    this.emit();
    this.maybeRequestEngineMove();
    return true;
  }

  resign() {
    if (!this.config || this.isOver()) return;
    this.cancelEngine();
    this.forced = {
      result: this.config.playerColor === 'w' ? '0-1' : '1-0',
      reason: 'resignation',
    };
    this.cb.sound?.('end');
    this.touch();
    this.finish();
  }

  goTo(ply: number | null) {
    const n = this.chess.history().length;
    this.viewPly = ply === null || ply >= n ? null : Math.max(0, ply);
    this.touch();
    this.emit();
  }

  private finish() {
    this.clock.pause();
    this.cancelEngine();
    this.persist();
    this.emit();
  }

  /* ------------------------------ relógio ------------------------------ */

  private startTicker() {
    this.stopTicker();
    this.ticker = setInterval(() => this.checkClock(), 200);
  }

  private stopTicker() {
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
  }

  /** Verifica estouro de tempo (exposto para testes). */
  checkClock() {
    if (!this.config || !this.clock.enabled || this.isOver()) return;
    const flagged = this.clock.flagged();
    if (!flagged) return;
    this.forced = timeoutResult(this.chess, flagged);
    this.cb.sound?.('end');
    this.touch();
    this.finish();
  }

  /* ------------------------------ adversário ------------------------------ */

  private cancelEngine() {
    this.token++;
    this.abort?.abort();
    this.abort = null;
    if (this.config) engineManager.cancel();
    this.thinking = false;
  }

  private maybeRequestEngineMove() {
    const cfg = this.config;
    if (!cfg || this.thinking || this.engineError) return;
    if (this.isOver() || this.chess.turn() !== this.engineColor) return;

    const token = ++this.token;
    const fen = this.chess.fen(); // posição ATUAL no momento do pedido
    const ac = new AbortController();
    this.abort = ac;
    this.thinking = true;
    this.emit();
    void this.runEngine(token, fen, cfg, ac);
  }

  private async runEngine(token: number, fen: string, cfg: GameConfig, ac: AbortController) {
    const t0 = performance.now();
    try {
      const ok = await this.engineReady;
      if (token !== this.token) return;
      if (!ok) {
        this.thinking = false;
        this.emit();
        return;
      }
      const clocks = this.clock.enabled
        ? {
            wtime: this.clock.get('w'),
            btime: this.clock.get('b'),
            winc: this.clock.incrementMs,
            binc: this.clock.incrementMs,
          }
        : undefined;
      const mv = await engineManager.requestMove(cfg.engineId, {
        fen,
        settings: cfg.engineSettings,
        clocks,
        signal: ac.signal,
        onInfo: (info) => {
          if (token !== this.token) return;
          this.engineInfo = { ...this.engineInfo, ...info, fen };
          const now = performance.now();
          if (now - this.lastInfoEmit > 120) {
            this.lastInfoEmit = now;
            this.emit();
          }
        },
      });
      const wait = (this.cb.minEngineDelayMs ?? 350) - (performance.now() - t0);
      if (wait > 0) await sleep(wait);
      // Descarta resultados desatualizados (undo, nova partida, abandono...).
      if (token !== this.token || this.chess.fen() !== fen || this.forced) return;
      this.thinking = false;
      this.abort = null;
      if (mv.info) this.engineInfo = { ...this.engineInfo, ...mv.info, fen };
      const played = this.playMove(mv.from, mv.to, mv.promotion, 'engine');
      if (!played) {
        this.engineError = `O adversário retornou um lance inválido (${mv.uci}).`;
        this.emit();
      }
    } catch (e) {
      if (token !== this.token) return; // cancelado
      this.thinking = false;
      const err = e as Error & { code?: string };
      if (err.code === 'aborted') {
        this.emit();
        return;
      }
      this.engineError = err.message || 'Erro desconhecido no adversário.';
      this.emit();
    }
  }

  /* ------------------------------ salvamento ------------------------------ */

  /** Monta o registro da partida atual (ou null se não houver lances). */
  private buildRecord(): SavedGame | null {
    const cfg = this.config;
    const n = this.chess.history().length;
    if (!cfg || n === 0) return null;
    const status = getGameStatus(this.chess, this.forced);
    const engineLabel = `${cfg.engineName} · ${cfg.levelLabel}`;
    const player = cfg.playerName ?? 'Você';
    const white = cfg.playerColor === 'w' ? player : engineLabel;
    const black = cfg.playerColor === 'b' ? player : engineLabel;
    const pgn = exportPgn(this.chess, {
      white,
      black,
      result: status.result,
      termination: status.over ? status.title : undefined,
      timeControl: cfg.timeControl.id === 'unlimited' ? '-' : this.timeControlPgn(cfg.timeControl),
      date: new Date(this.startedAt),
    });
    return {
      id: this.savedId,
      createdAt: this.startedAt,
      pgn,
      white,
      black,
      result: status.result,
      reason: status.over ? status.title : undefined,
      plies: n,
      finalFen: this.chess.fen(),
      opponentId: cfg.engineId,
      opponentName: cfg.engineName,
      opponentLevel: cfg.levelLabel,
      playerColor: cfg.playerColor,
      timeControlId: cfg.timeControl.id,
    };
  }

  /** Salva (upsert) a partida no histórico, se houver lances. */
  persist() {
    if (!this.cb.onSave) return;
    const rec = this.buildRecord();
    if (rec) this.cb.onSave(rec);
  }

  /** PGN completo (cabeçalhos + SAN) da partida atual. */
  exportCurrentPgn(): string {
    return this.buildRecord()?.pgn ?? this.chess.pgn();
  }

  private timeControlPgn(tc: TimeControl) {
    return `${Math.round(tc.initialMs / 1000)}+${Math.round(tc.incrementMs / 1000)}`;
  }

  /* ------------------------------ view ------------------------------ */

  private buildView(): GameView {
    if (!this.cache || this.cache.ver !== this.posVersion) {
      this.cache = { ver: this.posVersion, derived: this.derive() };
    }
    const d = this.cache.derived;
    const cfg = this.config;
    const status = d.status;
    const live = this.viewPly === null;
    const mine = !!cfg && live && !status.over && !this.thinking && this.chess.turn() === cfg.playerColor;
    const minPlies = cfg?.playerColor === 'w' ? 0 : 1;
    return {
      active: !!cfg,
      config: cfg,
      fen: d.fen,
      liveFen: d.liveFen,
      turn: this.chess.turn(),
      history: d.history,
      viewPly: d.viewPly,
      isLive: live,
      status,
      legalMoves: mine ? d.legalMoves : [],
      lastMove: d.lastMove ? { move: d.lastMove, animate: this.lastAnimate && live, seq: this.seq } : null,
      checkSquare: d.checkSquare,
      canUndo: !!cfg && d.history.length > minPlies,
      thinking: this.thinking,
      engineInfo: this.engineInfo,
      engineError: this.engineError,
      engineStatus: cfg ? (engineManager.peek(cfg.engineId)?.status ?? 'idle') : 'idle',
      engineColor: this.engineColor,
      material: d.material,
      pgn: d.pgn,
      clockEnabled: this.clock.enabled,
      version: this.posVersion,
    };
  }

  private derive(): Derived {
    const history = this.chess.history({ verbose: true });
    const live = this.viewPly === null;
    const ply = live ? history.length : (this.viewPly as number);
    const liveFen = this.chess.fen();
    const fen = live ? liveFen : ply === 0 ? (history[0]?.before ?? liveFen) : history[ply - 1].after;
    const shown = live ? this.chess : new Chess(fen);
    let checkSquare: string | null = null;
    if (shown.inCheck()) {
      for (const row of shown.board())
        for (const p of row) if (p && p.type === 'k' && p.color === shown.turn()) checkSquare = p.square;
    }
    const status = getGameStatus(this.chess, this.forced);
    return {
      history,
      viewPly: ply,
      fen,
      liveFen,
      legalMoves: live ? this.chess.moves({ verbose: true }) : [],
      lastMove: ply > 0 ? history[ply - 1] : null,
      checkSquare,
      status,
      material: materialFromFen(fen),
      pgn: this.chess.pgn(),
    };
  }
}

interface Derived {
  history: Move[];
  viewPly: number;
  fen: string;
  liveFen: string;
  legalMoves: Move[];
  lastMove: Move | null;
  checkSquare: string | null;
  status: GameStatus;
  material: MaterialInfo;
  pgn: string;
}
