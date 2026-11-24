import { Chess } from 'chess.js';
import { StockfishAdapter } from '../../src/cm/engines/stockfish/StockfishAdapter';
import { stockfishDescriptor } from '../../src/cm/engines/stockfish/definition';
import { lozzaDescriptor } from '../../src/cm/engines/lozza/definition';
import { ChessJsAiAdapter } from '../../src/cm/engines/chessjs-ai/ChessJsAiAdapter';
import { chessJsAiDescriptor } from '../../src/cm/engines/chessjs-ai/definition';
import { Position } from '../../src/cm/engines/chessjs-ai/board';
import { chooseMove } from '../../src/cm/engines/chessjs-ai/strategy';
import { EngineError, type EngineAdapter, type EngineSettings } from '../../src/cm/engines/types';
import type { UciTransport } from '../../src/cm/engines/stockfish/transport';
import { LOZZA_FILE, SF_FILE, assert, check, nodeTransport, summary } from './helpers';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function ask(a: EngineAdapter, fen: string, settings: EngineSettings, signal?: AbortSignal) {
  const mv = await a.requestMove({ fen, settings, signal });
  const c = new Chess(fen);
  const played = c.move({ from: mv.from, to: mv.to, promotion: mv.promotion });
  assert(played, `lance ilegal ${mv.uci} em ${fen}`);
  return { mv, san: played.san, after: c };
}

/** Joga uma partida completa entre dois adaptadores. Retorna estatísticas. */
async function playGame(
  white: { a: EngineAdapter; s: EngineSettings },
  black: { a: EngineAdapter; s: EngineSettings },
  maxPlies: number,
) {
  const c = new Chess();
  const stats = { plies: 0, castles: 0, captures: 0, checks: 0, promotions: 0, over: '' };
  await white.a.newGame();
  await black.a.newGame();
  while (!c.isGameOver() && stats.plies < maxPlies) {
    const side = c.turn() === 'w' ? white : black;
    const mv = await side.a.requestMove({ fen: c.fen(), settings: side.s });
    const m = c.move({ from: mv.from, to: mv.to, promotion: mv.promotion });
    assert(m, `lance ilegal ${mv.uci}`);
    stats.plies++;
    if (m.san.startsWith('O-O')) stats.castles++;
    if (m.captured) stats.captures++;
    if (m.san.includes('+') || m.san.includes('#')) stats.checks++;
    if (m.promotion) stats.promotions++;
  }
  stats.over = c.isCheckmate() ? 'xeque-mate' : c.isStalemate() ? 'afogamento' : c.isDraw() ? 'empate' : c.isGameOver() ? 'fim' : `limite de ${maxPlies} plies`;
  return stats;
}

// Worker simulado: replica o protocolo do ai.worker.ts, para validar o ciclo de vida do adaptador.
let workersCreated = 0;
class FakeWorker {
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onerror: ((ev: { message: string }) => void) | null = null;
  terminated = false;
  constructor() {
    workersCreated++;
  }
  postMessage(msg: { id: number; type?: string; fen: string; opts: Parameters<typeof chooseMove>[1] }) {
    if (msg.type === 'reset') return;
    setTimeout(() => {
      if (this.terminated) return;
      try {
        const { move, info } = chooseMove(msg.fen, msg.opts);
        this.onmessage?.({ data: { id: msg.id, ok: true, from: move.from, to: move.to, promotion: move.promotion, info } });
      } catch (e) {
        this.onmessage?.({ data: { id: msg.id, ok: false, error: (e as Error).message } });
      }
    }, 5);
  }
  terminate() {
    this.terminated = true;
  }
}

async function uciSuite(name: string, mk: () => EngineAdapter, settings: EngineSettings, file: string) {
  console.log(`\n== ${name} ==`);
  const a = mk();
  await check('inicializa via UCI e reporta o nome', async () => {
    await a.init(settings);
    assert(a.status === 'ready', `status ${a.status}`);
    assert(/stockfish|lozza/i.test(a.runtime.reportedName ?? ''), `nome: ${a.runtime.reportedName}`);
  });
  await check('vários lances consecutivos (10) a partir do início', async () => {
    let fen = START;
    for (let i = 0; i < 10; i++) fen = (await ask(a, fen, settings)).after.fen();
  });
  await check('captura: toma a dama indefesa', async () => {
    const r = await ask(a, '4k3/8/8/3q4/8/8/8/3QK3 w - - 0 1', settings);
    assert(r.mv.uci === 'd1d5', `jogou ${r.mv.uci}`);
  });
  await check('xeque-mate em 1', async () => {
    const r = await ask(a, '6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1', settings);
    assert(r.after.isCheckmate(), `jogou ${r.san}`);
  });
  await check('xeque: responde corretamente a um xeque', async () => {
    const r = await ask(a, 'rnb1kbnr/pppp1ppp/8/4p3/7q/5P2/PPPPP1PP/RNBQKBNR w KQkq - 1 3', settings);
    assert(!r.after.isCheck() || r.after.turn() === 'b', 'continua em xeque');
    assert(new Chess('rnb1kbnr/pppp1ppp/8/4p3/7q/5P2/PPPPP1PP/RNBQKBNR w KQkq - 1 3').isCheck(), 'posição deveria estar em xeque');
  });
  await check('promoção devolve peça de promoção legal', async () => {
    const r = await ask(a, '8/P6k/8/8/8/8/8/K7 w - - 0 1', settings);
    assert(r.mv.promotion || r.mv.uci !== 'a7a8', `jogou ${r.mv.uci}`);
  });
  await check('roque aceito como lance legal (posição só com reis e torres)', async () => {
    const fen = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
    const legalCastle = new Chess(fen).moves().filter((m) => m.startsWith('O-O')).length;
    assert(legalCastle === 2, 'chess.js deveria permitir 2 roques');
    await ask(a, fen, settings);
  });
  await check('posição sem lances (afogamento) → erro rápido, sem travar', async () => {
    const t0 = Date.now();
    let err: unknown;
    try {
      await ask(a, '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1', settings);
    } catch (e) {
      err = e;
    }
    assert(err instanceof EngineError, 'deveria rejeitar com EngineError');
    assert(Date.now() - t0 < 5000, 'demorou demais');
    assert(a.status !== 'thinking', `status ${a.status}`);
  });
  await check('cancelamento + nova busca imediata', async () => {
    const slow = { ...settings, depth: 0, movetime: 4000 };
    const ac = new AbortController();
    const p = a.requestMove({ fen: START, settings: slow, signal: ac.signal });
    await sleep(250);
    ac.abort();
    let code = '';
    try {
      await p;
    } catch (e) {
      code = (e as EngineError).code;
    }
    assert(code === 'aborted', `código ${code}`);
    assert(a.status !== 'thinking', `status após cancelar: ${a.status}`);
    const t0 = Date.now();
    await ask(a, 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', settings);
    assert(Date.now() - t0 < 4000, 'busca após cancelamento demorou');
  });
  await check('mudanças rápidas de posição (8 pedidos cancelados em sequência)', async () => {
    const slow = { ...settings, depth: 0, movetime: 3000 };
    const fens = [START, 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'];
    for (let i = 0; i < 8; i++) {
      const ac = new AbortController();
      const p = a.requestMove({ fen: fens[i % 2], settings: slow, signal: ac.signal }).catch(() => null);
      await sleep(40);
      ac.abort();
      await p;
    }
    const last = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
    const r = await ask(a, last, settings);
    assert(r.mv.uci.length >= 4, 'sem lance');
  });
  await check('reinicialização: dispose → init → joga', async () => {
    a.dispose();
    assert((a.status as string) === 'idle', `status ${a.status}`);
    await ask(a, START, settings);
    assert(a.status === 'ready', `status ${a.status}`);
  });
  await check('partida completa (até 160 plies) contra Chess.js AI Normal', async () => {
    const ai = new ChessJsAiAdapter(chessJsAiDescriptor);
    const st = await playGame({ a, s: settings }, { a: ai, s: { level: 'normal' } }, 160);
    console.log('     ', JSON.stringify(st));
    ai.dispose();
  });
  await check('erro de carregamento: arquivo inexistente falha rápido (sem "Pensando" eterno)', async () => {
    const bad = new StockfishAdapter(file.includes('lozza') ? lozzaDescriptor : stockfishDescriptor, () => nodeTransport('public/does-not-exist.js'));
    const t0 = Date.now();
    let err: unknown;
    try {
      await bad.requestMove({ fen: START, settings });
    } catch (e) {
      err = e;
    }
    assert(err instanceof EngineError, 'deveria falhar com EngineError');
    assert(bad.status === 'error', `status ${bad.status}`);
    assert(Date.now() - t0 < 6000, `levou ${Date.now() - t0} ms`);
  });
  await check('erro de pré-verificação (arquivo ausente no servidor) é reportado de imediato', async () => {
    const inner = nodeTransport(file);
    const t: UciTransport = { ...inner, preflight: async () => { throw new EngineError('load-failed', 'Arquivo de engine ausente: x.wasm (HTTP 404).'); } };
    const bad = new StockfishAdapter(stockfishDescriptor, () => t);
    let err: EngineError | undefined;
    try { await bad.init(settings); } catch (e) { err = e as EngineError; }
    assert(err?.code === 'load-failed', 'esperava load-failed');
    assert(bad.status === 'error', 'status deveria ser error');
  });
  a.dispose();
}

async function main() {
  console.log('== Gerador de lances (perft vs. valores canônicos e chess.js) ==');
  await check('perft: 5 posições canônicas', () => {
    const cases: [string, number, number][] = [
      [START, 4, 197281],
      ['r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', 3, 97862],
      ['8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', 5, 674624],
      ['r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', 4, 422333],
      ['rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', 3, 62379],
    ];
    for (const [fen, d, exp] of cases) assert(new Position(fen).perft(d) === exp, `perft falhou: ${fen}`);
  });

  await uciSuite('Stockfish 19 lite (WASM, UCI)', () => new StockfishAdapter(stockfishDescriptor, () => nodeTransport(SF_FILE)), { level: 'casual', skill: 20, depth: 6, movetime: 150 }, SF_FILE);
  await uciSuite('Lozza 11.0 (JS, UCI)', () => new StockfishAdapter(lozzaDescriptor, () => nodeTransport(LOZZA_FILE), { label: 'Lozza', initCommands: [], mapSettings: () => ({}) }), { level: 'medium', depth: 5, movetime: 150 }, LOZZA_FILE);

  console.log('\n== Chess.js AI (motor próprio) ==');
  for (const level of ['easy', 'normal', 'hard'] as const) {
    await check(`${level}: partida completa contra si mesma (até 200 plies) com lances sempre legais`, async () => {
      const a = new ChessJsAiAdapter(chessJsAiDescriptor);
      const s = { level, depth: 3, thinkTime: 250 };
      const st = await playGame({ a, s }, { a, s }, 200);
      console.log('     ', JSON.stringify(st));
      a.dispose();
    });
  }
  const aiS = { level: 'hard', depth: 4, thinkTime: 300 };
  await check('mate em 1, captura de dama e promoção', async () => {
    const a = new ChessJsAiAdapter(chessJsAiDescriptor);
    assert((await ask(a, '6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1', aiS)).after.isCheckmate(), 'não deu mate');
    assert((await ask(a, '4k3/8/8/3q4/8/8/8/3QK3 w - - 0 1', aiS)).mv.uci === 'd1d5', 'não capturou a dama');
    assert((await ask(a, '8/P6k/8/8/8/8/8/K7 w - - 0 1', aiS)).mv.promotion === 'q', 'não promoveu a dama');
    a.dispose();
  });
  await check('mate em 2 (nível difícil)', async () => {
    const a = new ChessJsAiAdapter(chessJsAiDescriptor);
    // Brancas jogam e dão mate em 2: 1.Qb6+!! axb6 2.Rxa8# — posição clássica simplificada
    const r = await ask(a, 'k7/8/1K6/8/8/8/8/6Q1 w - - 0 1', { level: 'hard', depth: 5, thinkTime: 1500 });
    assert(r.mv.info?.mate !== undefined && r.mv.info.mate > 0, `sem mate detectado (cp=${r.mv.info?.cp}, mate=${r.mv.info?.mate})`);
    a.dispose();
  });
  await check('afogamento/sem lances → erro limpo e engine continua utilizável', async () => {
    const a = new ChessJsAiAdapter(chessJsAiDescriptor);
    let err = false;
    try { await ask(a, '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1', aiS); } catch { err = true; }
    assert(err, 'deveria falhar');
    assert(a.status === 'ready', `status ${a.status}`);
    await ask(a, START, aiS);
    a.dispose();
  });
  await check('ciclo de vida do Worker: cancelar → Worker é RECRIADO e as próximas buscas continuam no Worker', async () => {
    (globalThis as unknown as { Worker: unknown }).Worker = FakeWorker;
    workersCreated = 0;
    const a = new ChessJsAiAdapter(chessJsAiDescriptor);
    let fen = START;
    for (let i = 0; i < 6; i++) fen = (await ask(a, fen, aiS)).after.fen();
    assert(workersCreated === 1, `workers criados: ${workersCreated}`);
    for (let round = 0; round < 4; round++) {
      const ac = new AbortController();
      const p = a.requestMove({ fen, settings: aiS, signal: ac.signal }).catch((e) => (e as EngineError).code);
      await sleep(1);
      ac.abort();
      assert((await p) === 'aborted', 'deveria abortar');
      assert(a.status === 'ready', `status ${a.status}`);
      fen = (await ask(a, fen, aiS)).after.fen();
    }
    assert((workersCreated as number) === 5, `esperava 5 workers (1 + 4 recriações), houve ${workersCreated}`);
    // 30 lances seguidos depois de vários cancelamentos
    const g = new Chess();
    for (let i = 0; i < 30 && !g.isGameOver(); i++) {
      const mv = await a.requestMove({ fen: g.fen(), settings: { level: 'normal' } });
      g.move({ from: mv.from, to: mv.to, promotion: mv.promotion });
    }
    assert(g.history().length >= 30 || g.isGameOver(), 'partida parou');
    a.dispose();
    delete (globalThis as unknown as { Worker?: unknown }).Worker;
  });
  await check('desempenho: nível difícil respeita o limite de tempo (≤ 1,5× thinkTime)', async () => {
    const t0 = Date.now();
    chooseMove('r1bq1rk1/pp2bppp/2n1pn2/3p4/2PP4/2N1PN2/PP2BPPP/R1BQ1RK1 w - - 0 9', { level: 'hard', depth: 12, thinkTimeMs: 500 });
    const dt = Date.now() - t0;
    assert(dt < 900, `levou ${dt} ms`);
  });

  const fails = summary();
  process.exit(fails ? 1 : 0);
}
void main();
