import { Chess } from 'chess.js';
import { afterAll, describe, expect, it } from 'vitest';
import { createNodeTransport } from '../../test/nodeTransport';
import { EngineError } from '../types';
import { StockfishAdapter } from './StockfishAdapter';
import { stockfishDescriptor } from './definition';
import { parseBestMove, parseInfoLine, toWhitePerspective } from './uci';

describe('UCI parsers', () => {
  it('interpreta linhas info', () => {
    const i = parseInfoLine('info depth 12 seldepth 18 multipv 1 score cp 34 nodes 12345 nps 99000 time 124 pv e2e4 e7e5 g1f3');
    expect(i).toMatchObject({ depth: 12, selDepth: 18, cp: 34, nodes: 12345, nps: 99000, timeMs: 124 });
    expect(i?.pv).toEqual(['e2e4', 'e7e5', 'g1f3']);
  });
  it('interpreta mate e bounds', () => {
    expect(parseInfoLine('info depth 5 score mate -2 pv a1a2')?.mate).toBe(-2);
    expect(parseInfoLine('info depth 5 score cp 10 lowerbound pv a1a2')?.bound).toBe('lower');
    expect(parseInfoLine('info string NNUE evaluation')).toBeNull();
  });
  it('interpreta bestmove', () => {
    expect(parseBestMove('bestmove e2e4 ponder e7e5')).toEqual({ move: 'e2e4', ponder: 'e7e5' });
    expect(parseBestMove('bestmove (none)')).toEqual({ move: null });
  });
  it('converte avaliação para a perspectiva das brancas', () => {
    expect(toWhitePerspective({ cp: 50, depth: 1 }, false).cp).toBe(-50);
    expect(toWhitePerspective({ mate: 3, depth: 1 }, false).mate).toBe(-3);
    expect(toWhitePerspective({ cp: 50, depth: 1 }, true).cp).toBe(50);
  });
});

describe('StockfishAdapter (engine real, build lite single)', () => {
  const adapter = new StockfishAdapter(stockfishDescriptor, createNodeTransport);
  const settings = { level: 'casual', skill: 20, depth: 8, movetime: 400 };
  afterAll(() => adapter.dispose());

  it('inicializa via UCI e reporta o nome da engine', async () => {
    await adapter.init(settings);
    expect(adapter.status).toBe('ready');
    expect(adapter.runtime.reportedName).toMatch(/Stockfish/i);
  }, 60_000);

  it('joga um lance legal da posição inicial, com avaliação', async () => {
    const infos: number[] = [];
    const m = await adapter.requestMove({
      fen: new Chess().fen(),
      settings,
      onInfo: (i) => i.depth && infos.push(i.depth),
    });
    const c = new Chess();
    expect(() => c.move({ from: m.from, to: m.to, promotion: m.promotion })).not.toThrow();
    expect(infos.length).toBeGreaterThan(0);
    expect(m.info?.cp).toBeDefined();
  }, 30_000);

  it('encontra mate em 1', async () => {
    const fen = '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1';
    const m = await adapter.requestMove({ fen, settings });
    expect(m.uci).toBe('a1a8');
    expect(m.info?.mate).toBe(1);
  }, 30_000);

  it('avaliação vem sempre na perspectiva das brancas (pretas jogando e ganhando)', async () => {
    const fen = '6k1/8/8/8/8/8/q7/6K1 b - - 0 1'; // pretas com dama a mais
    const m = await adapter.requestMove({ fen, settings });
    expect((m.info?.cp ?? 0) < 0 || (m.info?.mate ?? 0) < 0).toBe(true);
  }, 30_000);

  it('interrompe cálculo e depois joga na posição ATUAL (nunca em posição antiga)', async () => {
    const ac = new AbortController();
    const slow = { ...settings, depth: 0, movetime: 8000 };
    const p = adapter.requestMove({ fen: new Chess().fen(), settings: slow, signal: ac.signal });
    const assertion = expect(p).rejects.toBeInstanceOf(EngineError);
    setTimeout(() => ac.abort(), 150);
    await assertion;

    const fen2 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    const t0 = Date.now();
    const m = await adapter.requestMove({ fen: fen2, settings });
    expect(Date.now() - t0).toBeLessThan(6000);
    const c = new Chess(fen2);
    expect(() => c.move({ from: m.from, to: m.to, promotion: m.promotion })).not.toThrow();
  }, 40_000);

  it('respeita limite de profundidade', async () => {
    const m = await adapter.requestMove({
      fen: new Chess().fen(),
      settings: { ...settings, depth: 3, movetime: 5000 },
    });
    expect(m.info?.depth).toBeLessThanOrEqual(3 + 1);
  }, 30_000);
});
