import { BaseAdapter } from '../BaseAdapter';
import {
  EngineError,
  type EngineDescriptor,
  type EngineMove,
  type EngineSettings,
  type MoveRequest,
} from '../types';
import type { AiWorkerRequest, AiWorkerResponse } from './ai.worker';
import { chooseMove, resetAiState, resolveLevel, type AiOptions } from './strategy';

interface Pending {
  id: number;
  resolve: (m: EngineMove) => void;
  reject: (e: Error) => void;
  onInfo?: MoveRequest['onInfo'];
  timer: ReturnType<typeof setTimeout>;
}

const MAX_WORKER_FAILURES = 2;

/**
 * Adaptador da Chess.js AI.
 *
 * CAUSA RAIZ do "para depois de alguns lances" (versão original): `stop()` encerrava
 * o Worker (a busca síncrona não podia ser interrompida) mas o estado continuava
 * "ready" e `ensureWorker()` só rodava dentro de `init()` — que retornava cedo em
 * "ready". Após o primeiro cancelamento (desfazer, nova partida, troca de engine,
 * mudança de perfil...) o Worker nunca era recriado e todos os lances seguintes
 * caíam, em silêncio, no cálculo síncrono da thread principal.
 *
 * Agora: o Worker é (re)criado sob demanda a CADA solicitação, buscas têm limite de
 * tempo + watchdog, respostas de requisições canceladas são descartadas por `id`,
 * ouvintes de `abort` só agem sobre a própria requisição e, se Workers falharem
 * repetidamente, a engine continua funcionando na thread principal (busca limitada por tempo).
 */
export class ChessJsAiAdapter extends BaseAdapter {
  readonly descriptor: EngineDescriptor;
  private worker: Worker | null = null;
  private pending: Pending | null = null;
  private seq = 0;
  private workerFailures = 0;
  private disposed = false;

  constructor(descriptor: EngineDescriptor) {
    super();
    this.descriptor = descriptor;
  }

  private get canUseWorker() {
    return typeof Worker !== 'undefined' && this.workerFailures < MAX_WORKER_FAILURES;
  }

  async init(_settings?: EngineSettings): Promise<void> {
    void _settings;
    this.disposed = false;
    if (this._status === 'idle' || this._status === 'error') this.setStatus('loading');
    try {
      this.ensureWorker();
      this._runtime = { reportedName: this.worker ? 'Web Worker' : 'Thread principal (busca limitada por tempo)' };
      if (this._status !== 'thinking') this.setStatus('ready');
    } catch (e) {
      this.setStatus('error', (e as Error).message);
      throw new EngineError('load-failed', (e as Error).message);
    }
  }

  /** Cria o Worker se não existir (idempotente, seguro após cancelamentos). */
  private ensureWorker() {
    if (this.worker || !this.canUseWorker) return;
    try {
      const w = new Worker(new URL('./ai.worker.ts', import.meta.url));
      w.onmessage = (ev: MessageEvent<AiWorkerResponse>) => this.onWorkerMessage(w, ev.data);
      w.onerror = (ev) => {
        ev.preventDefault?.();
        if (this.worker !== w) return;
        this.workerFailures++;
        const p = this.pending;
        this.pending = null;
        if (p) clearTimeout(p.timer);
        this.killWorker();
        if (this._status === 'thinking') this.setStatus('ready');
        p?.reject(new EngineError('crashed', ev.message || 'Erro no worker da Chess.js AI'));
      };
      this.worker = w;
    } catch {
      this.workerFailures++;
      this.worker = null;
    }
  }

  private killWorker() {
    try {
      this.worker?.terminate();
    } catch {
      /* ignora */
    }
    this.worker = null;
  }

  private onWorkerMessage(w: Worker, res: AiWorkerResponse) {
    if (this.worker !== w) return;
    const p = this.pending;
    if (!p || p.id !== res.id) return; // resposta de uma solicitação cancelada
    if ('progress' in res) {
      p.onInfo?.(res.info);
      return;
    }
    clearTimeout(p.timer);
    this.pending = null;
    if (this._status === 'thinking') this.setStatus('ready');
    this.workerFailures = 0;
    if (!res.ok) return p.reject(new EngineError('protocol', res.error));
    p.resolve({
      from: res.from,
      to: res.to,
      promotion: res.promotion,
      uci: res.from + res.to + (res.promotion ?? ''),
      info: res.info,
    });
  }

  async newGame() {
    this.stop();
    if (this.worker) {
      const msg: AiWorkerRequest = { id: 0, type: 'reset', fen: '', opts: { level: 'hard' } };
      this.worker.postMessage(msg);
    } else resetAiState();
  }

  private optionsFrom(settings: EngineSettings): AiOptions {
    return {
      level: resolveLevel(settings.level),
      depth: Number(settings.depth ?? 5),
      thinkTimeMs: Number(settings.thinkTime ?? 2000),
      hashMb: Number(settings.hashMb ?? 16),
    };
  }

  async requestMove(req: MoveRequest): Promise<EngineMove> {
    const aborted = () => new EngineError('aborted', 'Cálculo interrompido');
    if (req.signal?.aborted) throw aborted();
    await this.init(req.settings);
    if (req.signal?.aborted) throw aborted();
    if (this.pending) this.stop();
    const opts = this.optionsFrom(req.settings);
    this.setStatus('thinking');
    const id = ++this.seq;
    const budget = (opts.level === 'hard' ? opts.thinkTimeMs ?? 2000 : 2000) + 8000;
    const onAbort = () => {
      if (this.pending?.id === id) this.stop();
    };
    req.signal?.addEventListener('abort', onAbort, { once: true });

    try {
      this.ensureWorker();
      const worker = this.worker;
      if (worker) {
        return await new Promise<EngineMove>((resolve, reject) => {
          const timer = setTimeout(() => {
            // Watchdog: a busca não respondeu — descarta o Worker (será recriado) e informa o erro.
            if (this.pending?.id !== id) return;
            this.pending = null;
            this.killWorker();
            this.workerFailures++;
            reject(new EngineError('timeout', 'A Chess.js AI não respondeu a tempo.'));
          }, budget);
          this.pending = { id, resolve, reject, onInfo: req.onInfo, timer };
          const msg: AiWorkerRequest = { id, type: 'move', fen: req.fen, opts };
          worker.postMessage(msg);
        });
      }
      // Sem Worker: busca síncrona, porém limitada por tempo (nunca ilimitada).
      await new Promise((r) => setTimeout(r, 0));
      const { move: m, info } = chooseMove(req.fen, { ...opts, onInfo: req.onInfo });
      if (req.signal?.aborted) throw aborted();
      return { from: m.from, to: m.to, promotion: m.promotion as EngineMove['promotion'], uci: m.lan, info };
    } finally {
      req.signal?.removeEventListener('abort', onAbort);
      if (this._status === 'thinking' && !this.pending) this.setStatus(this.disposed ? 'idle' : 'ready');
    }
  }

  stop() {
    const p = this.pending;
    if (p) {
      this.pending = null;
      clearTimeout(p.timer);
      // A busca no Worker é síncrona: para cancelar, descartamos o Worker. Ele é
      // recriado automaticamente na próxima solicitação (ver ensureWorker).
      this.killWorker();
      p.reject(new EngineError('aborted', 'Cálculo interrompido'));
    }
    if (this._status === 'thinking') this.setStatus('ready');
  }

  dispose() {
    this.disposed = true;
    this.stop();
    this.killWorker();
    this.workerFailures = 0;
    this.setStatus('idle');
  }
}
