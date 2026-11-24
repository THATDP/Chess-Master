import { getEngineDefinition } from './registry';
import {
  EngineError,
  type EngineAdapter,
  type EngineMove,
  type EngineSettings,
  type MoveRequest,
} from './types';

type Listener = () => void;

/**
 * Gerencia instâncias de adaptadores (uma por engine), com carregamento sob
 * demanda, cancelamento e tratamento de erros. A interface conversa apenas
 * com o gerenciador.
 */
export class EngineManager {
  private adapters = new Map<string, EngineAdapter>();
  private listeners = new Set<Listener>();
  private activeId: string | null = null;
  private version = 0;

  subscribe(l: Listener) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  getVersion() {
    return this.version;
  }

  private emit() {
    this.version++;
    this.listeners.forEach((l) => l());
  }

  /** Retorna (criando se necessário) o adaptador da engine. */
  get(id: string): EngineAdapter {
    let a = this.adapters.get(id);
    if (!a) {
      const def = getEngineDefinition(id);
      if (!def) throw new EngineError('unsupported', `Engine desconhecida: ${id}`);
      a = def.create();
      a.subscribe(() => this.emit());
      this.adapters.set(id, a);
    }
    return a;
  }

  peek(id: string): EngineAdapter | undefined {
    return this.adapters.get(id);
  }

  /** Carrega a engine (idempotente). */
  async prepare(id: string, settings: EngineSettings): Promise<void> {
    await this.get(id).init(settings);
  }

  async newGame(id: string, settings: EngineSettings): Promise<void> {
    const a = this.get(id);
    await a.init(settings);
    await a.newGame();
  }

  /** Solicita um lance para a posição informada. */
  async requestMove(id: string, req: MoveRequest): Promise<EngineMove> {
    const a = this.get(id);
    this.activeId = id;
    await a.init(req.settings);
    if (req.signal?.aborted) throw new EngineError('aborted', 'Cálculo interrompido');
    return a.requestMove(req);
  }

  /** Interrompe o cálculo da engine ativa. */
  cancel() {
    // Interrompe todas as engines carregadas (idempotente): cada adaptador é independente.
    this.adapters.forEach((a) => {
      try {
        a.stop();
      } catch {
        /* uma engine com problema não pode afetar as demais */
      }
    });
  }

  /** Encerra uma engine (ou todas). */
  dispose(id?: string) {
    if (id) {
      this.adapters.get(id)?.dispose();
      this.adapters.delete(id);
    } else {
      this.adapters.forEach((a) => a.dispose());
      this.adapters.clear();
    }
    this.emit();
  }
}

export const engineManager = new EngineManager();
