// Benchmark entre os níveis da Chess.js AI (partidas reais, cores alternadas, limite de lances + adjudicação por material).
import { Chess } from 'chess.js';
import { chooseMove, type AiOptions } from '../../src/cm/engines/chessjs-ai/strategy';

const VAL: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const mat = (c: Chess) => c.board().flat().reduce((s, p) => (p ? s + (p.color === 'w' ? 1 : -1) * VAL[p.type] : s), 0);

function game(w: AiOptions, b: AiOptions, maxPlies: number) {
  const c = new Chess();
  let plies = 0;
  while (!c.isGameOver() && plies < maxPlies) {
    const { move } = chooseMove(c.fen(), c.turn() === 'w' ? w : b);
    c.move({ from: move.from, to: move.to, promotion: move.promotion });
    plies++;
  }
  if (c.isCheckmate()) return { r: c.turn() === 'w' ? -1 : 1, how: 'mate', plies };
  if (c.isDraw()) return { r: 0, how: 'empate', plies };
  const m = mat(c);
  return { r: m >= 3 ? 1 : m <= -3 ? -1 : 0, how: `material ${m > 0 ? '+' : ''}${m}`, plies };
}

const L = {
  easy: { level: 'easy' } as AiOptions,
  normal: { level: 'normal' } as AiOptions,
  hard: { level: 'hard', depth: 5, thinkTimeMs: 300 } as AiOptions,
};
for (const [a, b] of [['hard', 'easy'], ['normal', 'easy'], ['hard', 'normal']] as const) {
  let score = 0;
  const det: string[] = [];
  for (let g = 0; g < 4; g++) {
    const aWhite = g % 2 === 0;
    const res = game(aWhite ? L[a] : L[b], aWhite ? L[b] : L[a], 90);
    const s = aWhite ? res.r : -res.r;
    score += s;
    det.push(`${s > 0 ? 'V' : s < 0 ? 'D' : 'E'}(${res.how})`);
  }
  console.log(`${a} vs ${b}: saldo ${score >= 0 ? '+' : ''}${score} em 4 partidas  [${det.join(' ')}]`);
}
const t0 = Date.now();
const r = chooseMove('r1bq1rk1/pp2bppp/2n1pn2/3p4/2PP4/2N1PN2/PP2BPPP/R1BQ1RK1 w - - 0 9', { level: 'hard', depth: 8, thinkTimeMs: 1000 });
console.log(`velocidade (posição de meio-jogo, 1 s): profundidade ${r.info.depth}, ${r.info.nodes} nós, ${r.info.nps} nós/s, ${Date.now() - t0} ms`);
