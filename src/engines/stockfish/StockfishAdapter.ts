import { Chess } from 'chess.js';
import { BaseAdapter } from '../BaseAdapter';
import {
  EngineError,
  type EngineClocks,
  type EngineDescriptor,
  type EngineInfo,
  type EngineMove,
  type EngineSettings,
  type MoveRequest,
} from '../types';
import type { UciTransport } from './transport';
import { parseBestMove, parseInfoLine, parseUciMove, toWhitePerspective } from './uci';

interface Waiter {
  test: (line: string) => boolean;
  resolve: (line: string) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface ActiveSearch {
  fen: string;
  whiteToMove: boolean;
  aborted: boolean;
  settled: boolean;
  lastInfo?: EngineInfo;
  onInfo?: (i: EngineInfo) => void;
  resolve: (m: EngineMove) => void;
  reject: (e: Error) => void;
  watchdog: ReturnType<typeof setTimeout>;
}

const BOOT_TIMEOUT = 45_000;
const READY_TIMEOUT = 20_000;
const IDLE_TIMEOUT = 4_000;

/**
 * Adaptador UCI do Stockfish. Fala o protocolo UCI sobre um `UciTransport`
 * (Web Worker em produção). Garante que:
 *  - cada busca usa a posição recebida (`position fen`) e nunca uma antiga;
 *  - buscas interrompidas têm o `bestmove` descartado;
 *  - uma nova busca só começa depois que a anterior terminou na engine.
 */
export class StockfishAdapter extends BaseAdapter {
  readonly descriptor: EngineDescriptor;
  private factory: () => UciTransport;
  private transport: UciTransport | null = null;
  private initPromise: Promise<void> | null = null;
  private waiters: Waiter[] = [];
  private search: ActiveSearch | null = null;
  private engineBusy = false;
  private idleResolvers: (() => void)[] = [];
  private applied = new Map<string, string>();
  private pendingName: string | undefined;

  constructor(descriptor: EngineDescriptor, factory: () => UciTransport) {
    super();
    this.descriptor = descriptor;
    this.factory = factory;
  }

  /* ------------------------------ ciclo de vida ------------------------------ */

  init(settings: EngineSettings): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.boot().catch((e) => {
        this.teardown();
        this.initPromise = null;
        const err = e instanceof EngineError ? e : new EngineError('load-failed', String(e?.message ?? e));
        this.setStatus('error', err.message);
        throw err;
      });
    }
    return this.initPromise.then(() => this.applySettings(settings));
  }

  private async boot() {
    this.setStatus('loading');
    const t0 = performance.now();
    const transport = this.factory();
    this.transport = transport;
    transport.onLine((l) => this.handleLine(l));
    transport.onError((m) => this.handleCrash(m));
    transport.send('uci');
    await this.waitFor((l) => l === 'uciok', BOOT_TIMEOUT, 'uciok');
    if (this.pendingName) this._runtime = { ...this._runtime, reportedName: this.pendingName };
    transport.send('setoption name Hash value 32');
    await this.sync();
    this._runtime = { ...this._runtime, loadTimeMs: Math.round(performance.now() - t0) };
    this.setStatus('ready');
  }

  async newGame() {
    if (!this.transport) return;
    await this.waitIdle();
    this.transport.send('ucinewgame');
    await this.sync();
  }

  stop() {
    const s = this.search;
    if (!s || s.aborted) return;
    s.aborted = true;
    this.settle(s, new EngineError('aborted', 'Cálculo interrompido'));
    // Mantemos engineBusy até chegar o `bestmove` correspondente.
    this.transport?.send('stop');
    if (this._status === 'thinking') this.setStatus('ready');
  }

  dispose() {
    this.stop();
    try {
      this.transport?.send('quit');
    } catch {
      /* ignora */
    }
    this.teardown();
    this.initPromise = null;
    this.setStatus('idle');
  }

  private teardown() {
    const s = this.search;
    if (s) {
      s.aborted = true;
      this.settle(s, new EngineError('aborted', 'Engine encerrada'));
    }
    this.search = null;
    this.engineBusy = false;
    this.idleResolvers.splice(0).forEach((r) => r());
    this.failWaiters(new EngineError('aborted', 'Engine encerrada'));
    try {
      this.transport?.terminate();
    } catch {
      /* ignora */
    }
    this.transport = null;
    this.applied.clear();
  }

  /* --------------------------------- buscas --------------------------------- */

  async requestMove(req: MoveRequest): Promise<EngineMove> {
    const abortErr = () => new EngineError('aborted', 'Cálculo interrompido');
    if (req.signal?.aborted) throw abortErr();
    await this.init(req.settings);
    if (req.signal?.aborted) throw abortErr();
    await this.waitIdle();
    if (req.signal?.aborted) throw abortErr();
    if (!this.transport) throw new EngineError('crashed', 'A engine não está em execução.');

    const transport = this.transport;
    const fen = req.fen;
    const whiteToMove = fen.split(' ')[1] !== 'b';
    const go = this.buildGo(req.settings, req.clocks, whiteToMove);

    return new Promise<EngineMove>((resolve, reject) => {
      const search: ActiveSearch = {
        fen,
        whiteToMove,
        aborted: false,
        settled: false,
        onInfo: req.onInfo,
        resolve,
        reject,
        watchdog: setTimeout(() => {
          // Engine travada: reinicia na próxima solicitação.
          this.settle(search, new EngineError('timeout', 'O Stockfish não respondeu a tempo.'));
          this.handleCrash('O Stockfish não respondeu a tempo.');
        }, go.limitMs + 20_000),
      };
      this.search = search;
      this.engineBusy = true;
      this.setStatus('thinking');
      req.signal?.addEventListener('abort', () => this.stop(), { once: true });
      transport.send(`position fen ${fen}`);
      transport.send(go.command);
    });
  }

  private buildGo(settings: EngineSettings, clocks: EngineClocks | undefined, whiteToMove: boolean) {
    const depth = Math.round(Number(settings.depth ?? 0));
    let movetime = Math.max(50, Math.round(Number(settings.movetime ?? 1000)));
    if (clocks) {
      const remaining = whiteToMove ? clocks.wtime : clocks.btime;
      const inc = whiteToMove ? clocks.winc : clocks.binc;
      if (Number.isFinite(remaining) && remaining > 0) {
        const cap = Math.max(50, Math.floor(remaining / 25 + inc * 0.7));
        movetime = Math.min(movetime, cap);
      }
    }
    let command = 'go';
    if (depth > 0) command += ` depth ${depth}`;
    command += ` movetime ${movetime}`;
    return { command, limitMs: movetime };
  }

  private handleLine(line: string) {
    // waiters (uciok, readyok, ...)
    for (const w of [...this.waiters]) {
      if (w.test(line)) {
        clearTimeout(w.timer);
        this.waiters = this.waiters.filter((x) => x !== w);
        w.resolve(line);
      }
    }
    if (line.startsWith('id name ')) {
      this.pendingName = line.slice(8).trim();
      return;
    }
    const best = parseBestMove(line);
    if (best) return this.handleBestMove(best.move);

    const s = this.search;
    if (!s || s.aborted) return;
    const parsed = parseInfoLine(line);
    if (!parsed || parsed.bound) return;
    if (parsed.multipv && parsed.multipv > 1) return;
    if (parsed.cp === undefined && parsed.mate === undefined) return;
    const info = toWhitePerspective(parsed, s.whiteToMove);
    s.lastInfo = info;
    s.onInfo?.(info);
  }

  private handleBestMove(uci: string | null) {
    this.engineBusy = false;
    const s = this.search;
    this.search = null;
    this.idleResolvers.splice(0).forEach((r) => r());
    if (!s || s.aborted || s.settled) return; // busca descartada: resultado possivelmente desatualizado
    if (this._status === 'thinking') this.setStatus('ready');
    if (!uci) {
      return this.settle(s, new EngineError('protocol', 'A engine não encontrou lance legal.'));
    }
    const parts = parseUciMove(uci);
    if (!parts) return this.settle(s, new EngineError('protocol', `Lance inválido recebido: ${uci}`));
    // Validação de segurança: o lance precisa ser legal na posição solicitada.
    try {
      const chess = new Chess(s.fen);
      chess.move({ from: parts.from, to: parts.to, promotion: parts.promotion });
    } catch {
      return this.settle(s, new EngineError('illegal-move', `Lance ilegal recebido da engine: ${uci}`));
    }
    this.settle(s, { ...parts, uci, info: s.lastInfo });
  }

  private settle(s: ActiveSearch, result: EngineMove | Error) {
    if (s.settled) return;
    s.settled = true;
    clearTimeout(s.watchdog);
    if (result instanceof Error) s.reject(result);
    else s.resolve(result);
  }

  private handleCrash(message: string) {
    const err = new EngineError('crashed', message);
    const s = this.search;
    if (s) {
      s.aborted = true;
      this.settle(s, err);
    }
    this.failWaiters(err);
    this.search = null;
    this.engineBusy = false;
    this.idleResolvers.splice(0).forEach((r) => r());
    try {
      this.transport?.terminate();
    } catch {
      /* ignora */
    }
    this.transport = null;
    this.initPromise = null;
    this.applied.clear();
    this.setStatus('error', message);
  }

  /* ------------------------------- utilitários ------------------------------- */

  private waitFor(test: (l: string) => boolean, timeoutMs: number, label: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const w: Waiter = {
        test,
        resolve,
        reject,
        timer: setTimeout(() => {
          this.waiters = this.waiters.filter((x) => x !== w);
          reject(new EngineError('timeout', `Tempo esgotado aguardando "${label}" do Stockfish.`));
        }, timeoutMs),
      };
      this.waiters.push(w);
    });
  }

  private failWaiters(err: Error) {
    this.waiters.splice(0).forEach((w) => {
      clearTimeout(w.timer);
      w.reject(err);
    });
  }

  /** `isready` → `readyok`. */
  private async sync() {
    const p = this.waitFor((l) => l === 'readyok', READY_TIMEOUT, 'readyok');
    this.transport?.send('isready');
    await p;
  }

  private async waitIdle() {
    if (!this.engineBusy) return;
    const idle = new Promise<void>((r) => this.idleResolvers.push(r));
    const timeout = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), IDLE_TIMEOUT));
    const res = await Promise.race([idle.then(() => 'ok' as const), timeout]);
    if (res === 'timeout') {
      // A engine não encerrou a busca: reinicia o worker.
      this.teardown();
      this.initPromise = null;
      await this.init({});
    }
  }

  private async applySettings(settings: EngineSettings) {
    if (!this.transport) return;
    const wanted: Record<string, string> = {};
    if (settings.skill !== undefined) {
      wanted['Skill Level'] = String(Math.min(20, Math.max(0, Math.round(Number(settings.skill)))));
    }
    let changed = false;
    for (const [k, v] of Object.entries(wanted)) {
      if (this.applied.get(k) !== v) {
        this.transport.send(`setoption name ${k} value ${v}`);
        this.applied.set(k, v);
        changed = true;
      }
    }
    if (changed) await this.sync();
  }
}
