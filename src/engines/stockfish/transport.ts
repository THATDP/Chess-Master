import { EngineError } from '../types';

/**
 * Transporte UCI: abstrai "como falar com a engine". Em produção é um
 * Web Worker; nos testes pode ser qualquer outro canal (ex.: Node).
 */
export interface UciTransport {
  send(command: string): void;
  onLine(cb: (line: string) => void): void;
  onError(cb: (message: string) => void): void;
  terminate(): void;
}

export const STOCKFISH_FILE = 'stockfish/stockfish-19-lite-single.js';

/**
 * Resolve a URL do worker relativa ao documento (`document.baseURI`), o que
 * funciona em qualquer subcaminho (ex.: https://usuario.github.io/repo/).
 */
export function resolveStockfishUrl(): string {
  const base = typeof document !== 'undefined' ? document.baseURI : self.location.href;
  return new URL(STOCKFISH_FILE, base).toString();
}

export function createWorkerTransport(url: string = resolveStockfishUrl()): UciTransport {
  if (typeof Worker === 'undefined') {
    throw new EngineError('unsupported', 'Este navegador não suporta Web Workers.');
  }
  if (typeof WebAssembly === 'undefined') {
    throw new EngineError('unsupported', 'Este navegador não suporta WebAssembly.');
  }
  let worker: Worker;
  try {
    worker = new Worker(url);
  } catch (e) {
    throw new EngineError('load-failed', `Falha ao criar o Web Worker (${(e as Error).message}).`);
  }
  let lineCb: (line: string) => void = () => {};
  let errCb: (m: string) => void = () => {};
  worker.onmessage = (ev: MessageEvent) => {
    // O worker também envia objetos de progresso de download; só nos interessam strings.
    if (typeof ev.data === 'string') {
      for (const l of ev.data.split('\n')) if (l) lineCb(l);
    }
  };
  worker.onerror = (ev: ErrorEvent) => {
    errCb(
      ev.message
        ? `Erro no worker do Stockfish: ${ev.message}`
        : `Não foi possível carregar os arquivos do Stockfish (${url}).`,
    );
  };
  worker.onmessageerror = () => errCb('Mensagem inválida recebida do Stockfish.');
  return {
    send: (c) => worker.postMessage(c),
    onLine: (cb) => (lineCb = cb),
    onError: (cb) => (errCb = cb),
    terminate: () => worker.terminate(),
  };
}
