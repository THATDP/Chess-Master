import type {
  EngineAdapter,
  EngineDescriptor,
  EngineMove,
  EngineRuntimeInfo,
  EngineSettings,
  EngineStatus,
  MoveRequest,
} from './types';

/** Utilidades comuns (status + assinatura) para adaptadores. */
export abstract class BaseAdapter implements EngineAdapter {
  abstract readonly descriptor: EngineDescriptor;
  protected _status: EngineStatus = 'idle';
  protected _lastError: string | null = null;
  protected _runtime: EngineRuntimeInfo = {};
  private listeners = new Set<() => void>();

  get status() {
    return this._status;
  }
  get lastError() {
    return this._lastError;
  }
  get runtime() {
    return this._runtime;
  }

  protected setStatus(s: EngineStatus, error: string | null = null) {
    this._status = s;
    this._lastError = s === 'error' ? error : null;
    this.listeners.forEach((l) => l());
  }

  protected notify() {
    this.listeners.forEach((l) => l());
  }

  subscribe(l: () => void) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  abstract init(settings: EngineSettings): Promise<void>;
  abstract newGame(): Promise<void>;
  abstract requestMove(req: MoveRequest): Promise<EngineMove>;
  abstract stop(): void;
  abstract dispose(): void;
}
