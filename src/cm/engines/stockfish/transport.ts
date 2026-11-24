import { assetUrl } from '../../lib/base';
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
  /** Verifica (rápido) se todos os arquivos da engine existem, antes de esperar `uciok`. */
  preflight?(): Promise<void>;
}

export const STOCKFISH_FILE = 'stockfish/stockfish-19-lite-single.js';
export const STOCKFISH_WASM = 'stockfish/stockfish-19-lite-single.wasm';

export interface WorkerTransportOptions {
  /** Caminho relativo a `public/` do script do worker. */
  script: string;
  /** Arquivos auxiliares obrigatórios (ex.: .wasm). */
  required?: string[];
  /** Se informado, o stockfish.js recebe a URL do wasm pelo hash (independe do pathname). */
  wasm?: string;
  label: string;
}

/**
 * CAUSA RAIZ do "Pensando" eterno: o repositório original publicava apenas o `.js`
 * do Stockfish; o `.wasm` (≈1,8 MB) não existia, o worker nunca respondia `uciok`
 * e a interface ficava esperando. Agora (1) o wasm é versionado em `public/stockfish`,
 * (2) a URL do wasm é passada explicitamente ao worker e (3) um preflight falha
 * rápido, com mensagem clara, se algum arquivo estiver ausente.
 */
export function createWorkerTransport(opts: WorkerTransportOptions): UciTransport {
  if (typeof Worker === 'undefined') {
    throw new EngineError('unsupported', 'Este navegador não suporta Web Workers.');
  }
  if (typeof WebAssembly === 'undefined' && opts.wasm) {
    throw new EngineError('unsupported', 'Este navegador não suporta WebAssembly.');
  }
  const url = assetUrl(opts.script);
  const wasmUrl = opts.wasm ? assetUrl(opts.wasm) : null;
  let worker: Worker;
  try {
    worker = new Worker(wasmUrl ? `${url}#${encodeURIComponent(wasmUrl)}` : url);
  } catch (e) {
    throw new EngineError('load-failed', `Falha ao criar o Web Worker (${(e as Error).message}).`);
  }
  let lineCb: (line: string) => void = () => {};
  let errCb: (m: string) => void = () => {};
  worker.onmessage = (ev: MessageEvent) => {
    // O worker também envia objetos de progresso de download; só interessam strings.
    if (typeof ev.data === 'string') {
      for (const raw of ev.data.split('\n')) {
        const l = raw.trim();
        if (l) lineCb(l);
      }
    }
  };
  worker.onerror = (ev: ErrorEvent) => {
    errCb(
      ev.message
        ? `Erro no worker (${opts.label}): ${ev.message}`
        : `Não foi possível carregar os arquivos de ${opts.label} (${url}).`,
    );
  };
  worker.onmessageerror = () => errCb(`Mensagem inválida recebida de ${opts.label}.`);
  return {
    send: (c) => worker.postMessage(c),
    onLine: (cb) => (lineCb = cb),
    onError: (cb) => (errCb = cb),
    terminate: () => worker.terminate(),
    async preflight() {
      const files = [opts.script, ...(opts.required ?? [])];
      for (const f of files) {
        let ok = false;
        let status = 0;
        try {
          const r = await fetch(assetUrl(f), { method: 'HEAD', cache: 'force-cache' });
          ok = r.ok;
          status = r.status;
        } catch {
          throw new EngineError('load-failed', `Sem acesso a ${f} (rede indisponível?).`);
        }
        if (!ok) throw new EngineError('load-failed', `Arquivo de engine ausente: ${f} (HTTP ${status}).`);
      }
    },
  };
}

export function createStockfishTransport(): UciTransport {
  return createWorkerTransport({
    script: STOCKFISH_FILE,
    required: [STOCKFISH_WASM],
    wasm: STOCKFISH_WASM,
    label: 'Stockfish',
  });
}

/** URL do worker do Stockfish (diagnóstico na página de engines). */
export const resolveStockfishUrl = (): string => assetUrl(STOCKFISH_FILE);
