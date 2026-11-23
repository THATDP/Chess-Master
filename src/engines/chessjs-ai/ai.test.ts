import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { evaluate, evaluateDetailed } from './evaluate';
import { chooseMove, type AiLevel } from './strategy';

const levels: AiLevel[] = ['easy', 'normal', 'hard'];
const opts = (level: AiLevel) => ({ level, depth: 2, thinkTimeMs: 400 });

describe('avaliação estática', () => {
  it('posição inicial é equilibrada', () => {
    expect(Math.abs(evaluate(new Chess()))).toBeLessThan(40);
  });
  it('material a mais pesa', () => {
    const up = new Chess('rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    expect(evaluate(up)).toBeGreaterThan(700);
    const down = new Chess('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNB1KBNR w KQkq - 0 1');
    expect(evaluate(down)).toBeLessThan(-700);
  });
  it('mobilidade e rei seguro entram na conta', () => {
    const d = evaluateDetailed(new Chess('r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3'));
    expect(d.mobility).not.toBe(0);
    expect(typeof d.kingSafety).toBe('number');
  });
});

describe.each(levels)('Chess.js AI — nível %s', (level) => {
  it('sempre joga lance legal em várias posições', () => {
    const fens = [
      new Chess().fen(),
      'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
      'r3k2r/pppq1ppp/2npbn2/2b1p3/2B1P3/2NPBN2/PPPQ1PPP/R3K2R w KQkq - 0 8', // roque disponível
      '4k3/P7/8/8/8/8/7p/4K3 w - - 0 1', // promoção
      'rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3', // en passant
    ];
    for (const fen of fens) {
      const { move } = chooseMove(fen, opts(level));
      const c = new Chess(fen);
      expect(() => c.move({ from: move.from, to: move.to, promotion: move.promotion })).not.toThrow();
    }
  }, 30_000);

  it('dá mate em 1', () => {
    const { move } = chooseMove('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', opts(level));
    expect(move.san).toBe('Ra8#');
  });

  it('termina jogos curtos sem erro (contra si mesma)', () => {
    const c = new Chess();
    for (let i = 0; i < 16 && !c.isGameOver(); i++) {
      const { move } = chooseMove(c.fen(), opts(level));
      c.move({ from: move.from, to: move.to, promotion: move.promotion });
    }
    expect(c.history().length).toBeGreaterThan(10);
  }, 60_000);
});

describe('Chess.js AI — comportamento por nível', () => {
  const hangingQueen = '3q2k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1';
  it('normal e difícil capturam peça indefesa', () => {
    expect(chooseMove(hangingQueen, opts('normal')).move.san).toMatch(/^Rxd8/);
    expect(chooseMove(hangingQueen, opts('hard')).move.san).toMatch(/^Rxd8/);
  });
  it('normal não entrega a dama a um peão', () => {
    // Dama branca pode capturar o peão d5, defendido por um peão em e6.
    const fen = 'rnbqkbnr/ppp2ppp/4p3/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 3';
    for (let i = 0; i < 20; i++) {
      const san = chooseMove('rnb1kbnr/ppp2ppp/4p3/3q4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 4', opts('normal')).move.san;
      expect(san).toBeTruthy();
    }
    const m = chooseMove('rnbqkbnr/ppp2ppp/4p3/3p4/8/3Q4/PPPP1PPP/RNB1KBNR w KQkq - 0 3', { ...opts('normal'), random: () => 0 });
    expect(m.move.san).not.toBe('Qxd5');
    void fen;
  });
  it('difícil respeita o limite de tempo', () => {
    const t0 = performance.now();
    chooseMove('r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', {
      level: 'hard',
      depth: 5,
      thinkTimeMs: 500,
    });
    expect(performance.now() - t0).toBeLessThan(1500);
  });
  it('difícil reporta avaliação e profundidade', () => {
    const { info } = chooseMove(new Chess().fen(), opts('hard'));
    expect(info.depth).toBeGreaterThanOrEqual(1);
    expect(info.cp ?? info.mate).toBeDefined();
  });
  it('nível fácil não é puramente aleatório: pega dama grátis com mais frequência', () => {
    const fen = '3q2k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1';
    let hits = 0;
    for (let i = 0; i < 200; i++) if (chooseMove(fen, opts('easy')).move.san.startsWith('Rxd8')) hits++;
    const legal = new Chess(fen).moves().length;
    expect(hits / 200).toBeGreaterThan(1 / legal);
  });
});
