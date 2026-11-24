import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import type { UciTransport } from '../engines/stockfish/transport';

/**
 * Transporte de teste: executa o MESMO build do Stockfish.js (lite single, WASM)
 * como processo Node e fala UCI por stdin/stdout.
 */
export function createNodeTransport(): UciTransport {
  const require = createRequire(import.meta.url);
  const enginePath: string = require('stockfish').findEngine('lite-single');
  const child = spawn(process.execPath, [enginePath], { stdio: 'pipe' });
  let lineCb: (l: string) => void = () => {};
  let errCb: (m: string) => void = () => {};
  let buf = '';
  child.stdout.on('data', (d: Buffer) => {
    buf += d.toString();
    let i: number;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).replace(/\r$/, '');
      buf = buf.slice(i + 1);
      if (line) lineCb(line);
    }
  });
  child.on('error', (e) => errCb(e.message));
  return {
    send: (c) => child.stdin.write(c + '\n'),
    onLine: (cb) => (lineCb = cb),
    onError: (cb) => (errCb = cb),
    terminate: () => child.kill(),
  };
}
