/// <reference lib="webworker" />
import { chooseMove, type AiOptions } from './strategy';

export interface AiWorkerRequest {
  id: number;
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
  | { id: number; ok: false; error: string };

self.onmessage = (ev: MessageEvent<AiWorkerRequest>) => {
  const { id, fen, opts } = ev.data;
  try {
    const { move, info } = chooseMove(fen, opts);
    const res: AiWorkerResponse = {
      id,
      ok: true,
      from: move.from,
      to: move.to,
      promotion: move.promotion as 'q' | 'r' | 'b' | 'n' | undefined,
      info,
    };
    (self as unknown as Worker).postMessage(res);
  } catch (e) {
    const res: AiWorkerResponse = { id, ok: false, error: (e as Error).message };
    (self as unknown as Worker).postMessage(res);
  }
};
