/**
 * Contratos da camada de adversários.
 *
 * A interface (React) só conhece estes tipos. Nenhum componente importa
 * Stockfish ou a Chess.js AI diretamente: tudo passa pelo registro
 * (`registry.ts`) e pelo gerenciador (`manager.ts`).
 */

export type EngineKind =
  /** Engine de xadrez de verdade, falando UCI (ex.: Stockfish). */
  | 'uci-engine'
  /** Adversário heurístico escrito sobre uma biblioteca de regras (chess.js). */
  | 'rules-ai';

export type EngineStatus = 'idle' | 'loading' | 'ready' | 'thinking' | 'error';

export type EngineSettingValue = number | string | boolean;
export type EngineSettings = Record<string, EngineSettingValue>;

export interface EngineSettingField {
  key: string;
  label: string;
  description?: string;
  type: 'range';
  min: number;
  max: number;
  step: number;
  unit?: string;
  /** Mostrar apenas quando o nível escolhido for um destes (ou 'custom'). */
  visibleForLevels?: string[];
}

export interface EngineLevel {
  id: string;
  label: string;
  description: string;
  /** Valores aplicados em `settings` ao escolher este nível. */
  values: EngineSettings;
  /** Estimativa honesta de força (opcional, apenas informativa). */
  strengthHint?: string;
}

export interface EngineCapabilities {
  /** Retorna avaliação numérica da posição durante a busca. */
  evaluation: boolean;
  /** Retorna a variante principal (PV). */
  principalVariation: boolean;
  depthControl: boolean;
  timeControl: boolean;
  /** Roda fora da thread principal. */
  offMainThread: boolean;
}

export interface EngineDescriptor {
  /** Identificador estável (usado em preferências e histórico). */
  id: string;
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  kind: EngineKind;
  /** Texto exibido na UI para deixar claro o que o adversário é. */
  kindLabel: string;
  version: string;
  author: string;
  license: string;
  homepage?: string;
  /** Ordem de exibição. */
  order: number;
  capabilities: EngineCapabilities;
  levels: EngineLevel[];
  defaultLevelId: string;
  fields: EngineSettingField[];
  /** Pontos fortes/limitações mostrados na tela de engines. */
  highlights: string[];
  limitations: string[];
}

export interface EngineClocks {
  wtime: number;
  btime: number;
  winc: number;
  binc: number;
}

/** Avaliação sempre do ponto de vista das brancas. */
export interface EngineInfo {
  depth?: number;
  selDepth?: number;
  /** Centipeões (perspectiva das brancas). */
  cp?: number;
  /** Mate em N lances (positivo = brancas dão mate). */
  mate?: number;
  /** Variante principal em UCI (e2e4 e7e5 ...). */
  pv?: string[];
  nodes?: number;
  nps?: number;
  timeMs?: number;
  /** Texto livre (ex.: "Abertura de dama: capturas seguras"). */
  note?: string;
  /** Posição (FEN) sobre a qual a busca foi feita — preenchido pelo controlador. */
  fen?: string;
}

export interface MoveRequest {
  /** Posição ATUAL. O adaptador nunca deve jogar sobre outra posição. */
  fen: string;
  settings: EngineSettings;
  clocks?: EngineClocks;
  signal?: AbortSignal;
  onInfo?: (info: EngineInfo) => void;
}

export interface EngineMove {
  from: string;
  to: string;
  promotion?: 'q' | 'r' | 'b' | 'n';
  uci: string;
  info?: EngineInfo;
}

export type EngineErrorCode =
  | 'unsupported'
  | 'load-failed'
  | 'timeout'
  | 'protocol'
  | 'illegal-move'
  | 'crashed'
  | 'aborted';

export class EngineError extends Error {
  code: EngineErrorCode;
  constructor(code: EngineErrorCode, message: string) {
    super(message);
    this.name = code === 'aborted' ? 'AbortError' : 'EngineError';
    this.code = code;
  }
}

export interface EngineRuntimeInfo {
  /** Nome reportado pela própria engine (ex.: "Stockfish 19 Lite"). */
  reportedName?: string;
  loadTimeMs?: number;
}

/**
 * Adaptador de adversário. Cada engine implementa esta interface de forma
 * independente; o tabuleiro e o sistema de partidas não conhecem os detalhes.
 */
export interface EngineAdapter {
  readonly descriptor: EngineDescriptor;
  readonly status: EngineStatus;
  readonly lastError: string | null;
  readonly runtime: EngineRuntimeInfo;
  /** Carrega recursos (worker, wasm...). Idempotente. */
  init(settings: EngineSettings): Promise<void>;
  /** Informa início de uma nova partida. */
  newGame(): Promise<void>;
  /** Escolhe um lance para a posição `req.fen`. */
  requestMove(req: MoveRequest): Promise<EngineMove>;
  /** Interrompe qualquer cálculo em andamento. */
  stop(): void;
  /** Encerra e libera todos os recursos. */
  dispose(): void;
  subscribe(listener: () => void): () => void;
}

export interface EngineDefinition {
  descriptor: EngineDescriptor;
  create(): EngineAdapter;
}
