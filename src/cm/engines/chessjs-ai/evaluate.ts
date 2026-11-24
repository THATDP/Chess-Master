import type { Chess, Color, PieceSymbol } from 'chess.js';

/**
 * Avaliação estática própria da Chess.js AI (centipeões, perspectiva das brancas).
 * Componentes: material, tabelas de casas (centro/desenvolvimento), par de bispos,
 * mobilidade, segurança do rei e peões passados simples.
 * NÃO é uma rede neural nem uma engine: é uma função heurística simples.
 */

export const PIECE_VALUE: Record<PieceSymbol, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
};

// Tabelas "Simplified Evaluation Function" (linha 0 = 8ª fileira, visão das brancas).
// prettier-ignore
const PST: Record<PieceSymbol, number[]> = {
  p: [
    0, 0, 0, 0, 0, 0, 0, 0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
    5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0,
    5, -5, -10, 0, 0, -10, -5, 5,
    5, 10, 10, -20, -20, 10, 10, 5,
    0, 0, 0, 0, 0, 0, 0, 0,
  ],
  n: [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20, 0, 0, 0, 0, -20, -40,
    -30, 0, 10, 15, 15, 10, 0, -30,
    -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30,
    -30, 5, 10, 15, 15, 10, 5, -30,
    -40, -20, 0, 5, 5, 0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  b: [
    -20, -10, -10, -10, -10, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 10, 10, 5, 0, -10,
    -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10,
    -10, 10, 10, 10, 10, 10, 10, -10,
    -10, 5, 0, 0, 0, 0, 5, -10,
    -20, -10, -10, -10, -10, -10, -10, -20,
  ],
  r: [
    0, 0, 0, 0, 0, 0, 0, 0,
    5, 10, 10, 10, 10, 10, 10, 5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    0, 0, 0, 5, 5, 0, 0, 0,
  ],
  q: [
    -20, -10, -10, -5, -5, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 5, 5, 5, 0, -10,
    -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5,
    -10, 5, 5, 5, 5, 5, 0, -10,
    -10, 0, 5, 0, 0, 0, 0, -10,
    -20, -10, -10, -5, -5, -10, -10, -20,
  ],
  k: [
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20,
    -10, -20, -20, -20, -20, -20, -20, -10,
    20, 20, 0, 0, 0, 0, 20, 20,
    20, 30, 10, 0, 0, 10, 30, 20,
  ],
};

// prettier-ignore
const KING_END: number[] = [
  -50, -40, -30, -20, -20, -30, -40, -50,
  -30, -20, -10, 0, 0, -10, -20, -30,
  -30, -10, 20, 30, 30, 20, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 20, 30, 30, 20, -10, -30,
  -30, -30, 0, 0, 0, 0, -30, -30,
  -50, -30, -30, -30, -30, -30, -30, -50,
];

type Cell = { type: PieceSymbol; color: Color } | null;
type BoardArr = Cell[][];

const KNIGHT_STEPS = [
  [1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1],
];
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ORTHO = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Mobilidade pseudo-legal (casas alcançáveis) da peça em (r,f). */
function pieceMobility(board: BoardArr, r: number, f: number, type: PieceSymbol, color: Color): number {
  let n = 0;
  if (type === 'n') {
    for (const [dr, df] of KNIGHT_STEPS) {
      const rr = r + dr;
      const ff = f + df;
      if (rr < 0 || rr > 7 || ff < 0 || ff > 7) continue;
      const c = board[rr][ff];
      if (!c || c.color !== color) n++;
    }
    return n;
  }
  const dirs = type === 'b' ? DIAG : type === 'r' ? ORTHO : [...DIAG, ...ORTHO];
  for (const [dr, df] of dirs) {
    let rr = r + dr;
    let ff = f + df;
    while (rr >= 0 && rr < 8 && ff >= 0 && ff < 8) {
      const c = board[rr][ff];
      if (!c) n++;
      else {
        if (c.color !== color) n++;
        break;
      }
      rr += dr;
      ff += df;
    }
  }
  return n;
}

const MOBILITY_WEIGHT: Partial<Record<PieceSymbol, number>> = { n: 4, b: 4, r: 2, q: 1 };

function kingSafety(board: BoardArr, kr: number, kf: number, color: Color): number {
  const dir = color === 'w' ? -1 : 1;
  let s = 0;
  for (let df = -1; df <= 1; df++) {
    const f = kf + df;
    if (f < 0 || f > 7) continue;
    const r1 = kr + dir;
    const r2 = kr + 2 * dir;
    const p1 = r1 >= 0 && r1 < 8 ? board[r1][f] : null;
    const p2 = r2 >= 0 && r2 < 8 ? board[r2][f] : null;
    const has1 = p1 && p1.type === 'p' && p1.color === color;
    const has2 = p2 && p2.type === 'p' && p2.color === color;
    if (has1) s += 12;
    else if (has2) s += 5;
    else s -= 18; // coluna aberta perto do rei
  }
  // Rei roqueado (g/c na primeira fileira) vale mais que rei central.
  const home = color === 'w' ? 7 : 0;
  if (kr === home && (kf >= 6 || kf <= 2)) s += 20;
  else if (kr === home && kf >= 3 && kf <= 5) s -= 10;
  return s;
}

function passedPawnBonus(board: BoardArr, r: number, f: number, color: Color): number {
  const dir = color === 'w' ? -1 : 1;
  for (let rr = r + dir; rr >= 0 && rr < 8; rr += dir) {
    for (let ff = Math.max(0, f - 1); ff <= Math.min(7, f + 1); ff++) {
      const c = board[rr][ff];
      if (c && c.type === 'p' && c.color !== color) return 0;
    }
  }
  const advance = color === 'w' ? 7 - r : r; // 1..6
  return 8 + advance * advance * 2;
}

export interface EvalBreakdown {
  total: number;
  material: number;
  position: number;
  mobility: number;
  kingSafety: number;
  center: number;
}

/** Avaliação com detalhamento (útil para testes e depuração). */
export function evaluateDetailed(chess: Chess): EvalBreakdown {
  const board = chess.board() as BoardArr;
  let material = 0;
  let position = 0;
  let mobility = 0;
  let center = 0;
  let safety = 0;
  const nonPawn = { w: 0, b: 0 };
  const bishops = { w: 0, b: 0 };
  const kings: Record<Color, [number, number] | null> = { w: null, b: null };

  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const c = board[r][f];
      if (!c) continue;
      if (c.type !== 'p' && c.type !== 'k') nonPawn[c.color] += PIECE_VALUE[c.type];
      if (c.type === 'b') bishops[c.color]++;
      if (c.type === 'k') kings[c.color] = [r, f];
    }
  }
  const endgame = nonPawn.w + nonPawn.b < 2600 || (nonPawn.w < 1000 && nonPawn.b < 1000);

  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const c = board[r][f];
      if (!c) continue;
      const sign = c.color === 'w' ? 1 : -1;
      const idx = c.color === 'w' ? r * 8 + f : (7 - r) * 8 + f;
      material += sign * PIECE_VALUE[c.type];
      position += sign * (c.type === 'k' && endgame ? KING_END[idx] : PST[c.type][idx]);
      const mw = MOBILITY_WEIGHT[c.type];
      if (mw) mobility += sign * mw * pieceMobility(board, r, f, c.type, c.color);
      if (c.type === 'p') {
        if ((r === 3 || r === 4) && (f === 3 || f === 4)) center += sign * 12;
        position += sign * passedPawnBonus(board, r, f, c.color);
      }
    }
  }
  if (bishops.w >= 2) material += 30;
  if (bishops.b >= 2) material -= 30;

  if (!endgame) {
    const wk = kings.w;
    const bk = kings.b;
    if (wk) safety += kingSafety(board, wk[0], wk[1], 'w') * Math.min(1, nonPawn.b / 3000);
    if (bk) safety -= kingSafety(board, bk[0], bk[1], 'b') * Math.min(1, nonPawn.w / 3000);
  }
  const total = material + position + mobility + safety + center;
  return { total, material, position, mobility, kingSafety: safety, center };
}

/** Avaliação em centipeões do ponto de vista das brancas. */
export function evaluate(chess: Chess): number {
  return evaluateDetailed(chess).total;
}
