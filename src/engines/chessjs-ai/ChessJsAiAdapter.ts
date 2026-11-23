import { BaseAdapter } from '../BaseAdapter';
import {
  EngineError,
  type EngineDescriptor,
  type EngineMove,
  type EngineSettings,
  type MoveRequest,
} from '../types';
import type { AiWorkerRequest, AiWorkerResponse } from './ai.worker';
import { chooseMove, resolveLevel, type AiOptions } from './strategy';

interface Pending {
  id: number;
  resolve: (m: EngineMove) => void;
  reject: (e: Error) => void;
}

/**
 * Adaptador da Chess.js AI. Usa um Web Worker (empacotado inline pelo Vite,
 * portanto sem arquivos extras) e, na ausência de Worker, cai para a thread
 * principal de forma assíncrona.
 */
export class ChessJsAiAdapter extends BaseAdapter {
  readonly descriptor: EngineDescriptor;
  private worker: Worker | null = null;
  private pending: Pending | null = null;
  private seq = 0;
  private usingWorker = false;

  constructor(descriptor: EngineDescriptor) {
    super();
    this.descriptor = descriptor;
  }

  async init(_settings?: EngineSettings): Promise<void> {
    void _settings;
    if (this._status === 'ready' || this._status === 'thinking') return;
    this.setStatus('loading');
    try {
      await this.ensureWorker();
      this._runtime = { reportedName: this.usingWorker ? 'Web Worker' : 'Thread principal (sem Worker)' };
      this.setStatus('ready');
    } catch (e) {
      this.setStatus('error', (e as Error).message);
      throw new EngineError('load-failed', (e as Error).message);
    }
  }

  private async ensureWorker() {
    if (this.worker) return;
    if (typeof Worker === 'undefined') {
      this.usingWorker = false;
      return;
    }
    try {
      const mod = await import('./ai.worker?worker&inline');
      const w: Worker = new mod.default();
      w.onmessage = (ev: MessageEvent<AiWorkerResponse>) => this.onWorkerMessage(ev.data);
      w.onerror = (ev) => {
        const p = this.pending;
        this.pending = null;
        p?.reject(new EngineError('crashed', ev.message || 'Erro no worker da Chess.js AI'));
        this.killWorker();
      };
      this.worker = w;
      this.usingWorker = true;
    } catch {
      this.usingWorker = false; // fallback: thread principal
    }
  }

  private killWorker() {
    this.worker?.terminate();
    this.worker = null;
  }

  private onWorkerMessage(res: AiWorkerResponse) {
    const p = this.pending;
    if (!p || p.id !== res.id) return; // resposta de uma solicitação cancelada
    this.pending = null;
    if (this._status === 'thinking') this.setStatus('ready');
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
  }

  private optionsFrom(settings: EngineSettings): AiOptions {
    return {
      level: resolveLevel(settings.level),
      depth: Number(settings.depth ?? 3),
      thinkTimeMs: Number(settings.thinkTime ?? 1500),
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

    let move: EngineMove;
    try {
      if (this.usingWorker && this.worker) {
        const id = ++this.seq;
        const worker = this.worker;
        move = await new Promise<EngineMove>((resolve, reject) => {
          this.pending = { id, resolve, reject };
          req.signal?.addEventListener('abort', () => this.stop(), { once: true });
          const msg: AiWorkerRequest = { id, fen: req.fen, opts };
          worker.postMessage(msg);
        });
      } else {
        await new Promise((r) => setTimeout(r, 0));
        const { move: m, info } = chooseMove(req.fen, opts);
        if (req.signal?.aborted) throw aborted();
        move = { from: m.from, to: m.to, promotion: m.promotion as EngineMove['promotion'], uci: m.lan, info };
      }
    } catch (e) {
      if (this._status === 'thinking') this.setStatus('ready');
      throw e;
    }
    if (this._status === 'thinking') this.setStatus('ready');
    if (move.info) req.onInfo?.(move.info);
    return move;
  }

  stop() {
    const p = this.pending;
    if (p) {
      this.pending = null;
      p.reject(new EngineError('aborted', 'Cálculo interrompido'));
      // Cálculo síncrono no worker não pode ser interrompido: encerramos o worker.
      this.killWorker();
    }
    if (this._status === 'thinking') this.setStatus('ready');
  }

  dispose() {
    this.stop();
    this.killWorker();
    this.setStatus('idle');
  }
}
