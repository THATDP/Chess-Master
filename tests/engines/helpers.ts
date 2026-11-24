import { spawn } from 'node:child_process';
import path from 'node:path';
import type { UciTransport } from '../../src/cm/engines/stockfish/transport';

/** Transporte de teste: roda o MESMO arquivo de engine servido em produção, como processo Node (UCI via stdin/stdout). */
export function nodeTransport(file: string): UciTransport {
  const enginePath = path.resolve(process.cwd(), file);
  const child = spawn(process.execPath, [enginePath], { stdio: 'pipe' });
  let lineCb: (l: string) => void = () => {};
  let errCb: (m: string) => void = () => {};
  let buf = '';
  child.stdout.on('data', (d: Buffer) => {
    buf += d.toString();
    let i: number;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line) lineCb(line);
    }
  });
  child.stderr.on('data', () => {});
  child.on('error', (e) => errCb(e.message));
  child.on('exit', (code) => {
    if (code && code !== 0) errCb(`Processo da engine terminou com código ${code}`);
  });
  return {
    send: (c) => {
      if (!child.killed && child.stdin.writable) child.stdin.write(c + '\n');
    },
    onLine: (cb) => (lineCb = cb),
    onError: (cb) => (errCb = cb),
    terminate: () => child.kill(),
  };
}

export const SF_FILE = 'public/stockfish/stockfish-19-lite-single.js';
export const LOZZA_FILE = 'public/lozza/lozza-11.0.js';

let passed = 0;
let failed = 0;
const failures: string[] = [];
export async function check(name: string, fn: () => Promise<void> | void) {
  const t0 = Date.now();
  try {
    await fn();
    passed++;
    console.log(`  ✔ ${name} (${Date.now() - t0} ms)`);
  } catch (e) {
    failed++;
    failures.push(name);
    console.log(`  ✘ ${name}: ${(e as Error).message}`);
  }
}
export function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}
export function summary() {
  console.log(`\nResultado: ${passed} aprovados, ${failed} falhas.`);
  if (failed) console.log('Falhas:', failures.join(' | '));
  return failed;
}
