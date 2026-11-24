/// <reference lib="webworker" />
import { chooseMove, resetAiState, type AiOptions } from './strategy';

export interface AiWorkerRequest {
  id: number;
  type?: 'move' | 'reset';
  fen: string;
  opts: AiOptions;
}

export type AiWorkerResponse =
  | {
      id: number;
      ok: true;
      from: string;
      to: string;
      promotion?: 'q' | 'r' | 'b' | 'n';
      info: import('../types').EngineInfo;
    }
  | { id: number; ok: false; error: string }
  | { id: number; progress: true; info: import('../types').EngineInfo };

const post = (m: AiWorkerResponse) => (self as unknown as Worker).postMessage(m);

self.onmessage = (ev: MessageEvent<AiWorkerRequest>) => {
  const { id, fen, opts, type } = ev.data;
  if (type === 'reset') {
    resetAiState();
    return;
  }
  try {
    const { move, info } = chooseMove(fen, { ...opts, onInfo: (i) => post({ id, progress: true, info: i }) });
    post({
      id,
      ok: true,
      from: move.from,
      to: move.to,
      promotion: move.promotion as 'q' | 'r' | 'b' | 'n' | undefined,
      info,
    });
  } catch (e) {
    post({ id, ok: false, error: (e as Error).message });
  }
};
