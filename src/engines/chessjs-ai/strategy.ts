import { Chess, type Move, type Color, type PieceSymbol } from 'chess.js';
import type { EngineInfo } from '../types';
import { PIECE_VALUE, evaluate } from './evaluate';

/**
 * Módulo de decisão da Chess.js AI.
 * chess.js (biblioteca de regras) gera os lances legais; a escolha é feita
 * pelas estratégias abaixo — nenhuma delas é uma engine de xadrez completa.
 */

export type AiLevel = 'easy' | 'normal' | 'hard';

export interface AiOptions {
  level: AiLevel;
  /** Profundidade máxima da busca (nível difícil). */
  depth?: number;
  /** Tempo máximo de pensamento (nível difícil), em ms. */
  thinkTimeMs?: number;
  /** Fonte de aleatoriedade injetável (testes). */
  random?: () => number;
}

export interface AiChoice {
  move: Move;
  info: EngineInfo;
}

const MATE = 100_000;
const opposite = (c: Color): Color => (c === 'w' ? 'b' : 'w');

export function resolveLevel(raw: unknown): AiLevel {
  return raw === 'easy' || raw === 'normal' ? raw : 'hard';
}

/** Escolhe um lance para a posição `fen`. Lança erro se não houver lances legais. */
export function chooseMove(fen: string, opts: AiOptions): AiChoice {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) throw new Error('Sem lances legais na posição.');
  if (moves.length === 1) {
    return { move: moves[0], info: { note: 'Único lance legal.' } };
  }
  const rnd = opts.random ?? Math.random;
  switch (opts.level) {
    case 'easy':
      return chooseEasy(moves, rnd);
    case 'normal':
      return chooseNormal(chess, moves, rnd);
    default:
      return chooseHard(chess, moves, opts, rnd);
  }
}

/* -------------------------------------------------------------------------- */
/*  FÁCIL — lances legais com escolhas simples                                  */
/* -------------------------------------------------------------------------- */

function playAndTest<T>(chess: Chess, m: Move, fn: () => T): T {
  chess.move({ from: m.from, to: m.to, promotion: m.promotion });
  try {
    return fn();
  } finally {
    chess.undo();
  }
}

function chooseEasy(moves: Move[], rnd: () => number): AiChoice {
  // 1) Dá mate em 1 quando enxerga (SAN termina em '#').
  const mate = moves.find((m) => m.san.endsWith('#'));
  if (mate) return { move: mate, info: { note: 'Mate em 1 encontrado.' } };

  // 2) Escolha ponderada simples: capturas, xeques e promoções pesam mais.
  const weights = moves.map((m) => {
    let w = 1;
    if (m.captured) w += 3 + PIECE_VALUE[m.captured] / 300;
    if (m.san.includes('+')) w += 1.5;
    if (m.promotion === 'q') w += 4;
    if (m.piece === 'k' && !m.isKingsideCastle() && !m.isQueensideCastle()) w *= 0.4;
    return w;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rnd() * total;
  for (let i = 0; i < moves.length; i++) {
    r -= weights[i];
    if (r <= 0) return { move: moves[i], info: { note: 'Escolha simples entre lances legais.' } };
  }
  return { move: moves[moves.length - 1], info: { note: 'Escolha simples entre lances legais.' } };
}

/* -------------------------------------------------------------------------- */
/*  NORMAL — capturas vantajosas, desenvolvimento e segurança do rei            */
/* -------------------------------------------------------------------------- */

const isMinor = (p: PieceSymbol) => p === 'n' || p === 'b';

function chooseNormal(chess: Chess, moves: Move[], rnd: () => number): AiChoice {
  const us = chess.turn();
  const them = opposite(us);
  const plies = chess.history().length;
  const inOpening = plies < 24;
  const inCheckNow = chess.inCheck();

  const scored = moves.map((m) => {
    if (m.san.endsWith('#')) return { m, score: 1_000_000 };
    let score = 0;
    const attackerValue = PIECE_VALUE[m.piece] || 900; // rei conta como "valioso"
    const gain = m.captured ? PIECE_VALUE[m.captured] : 0;
    const fromAttacked = chess.isAttacked(m.from, them);

    score += gain;
    if (m.promotion) score += PIECE_VALUE[m.promotion] - 100;

    playAndTest(chess, m, () => {
      // (turno agora é do adversário)
      const toAttacked = chess.isAttacked(m.to, them);
      const defended = chess.isAttacked(m.to, us);
      if (toAttacked) {
        const loss = defended ? Math.max(0, attackerValue - gain) : attackerValue;
        score -= loss;
        if (m.piece === 'k') score -= 1000;
      }
      // Segurança: o que o adversário pode capturar de graça depois?
      const replies = chess.moves({ verbose: true });
      if (replies.length === 0 && chess.inCheck()) score += 1_000_000;
      let worst = 0;
      for (const r of replies) {
        if (!r.captured) continue;
        const defendedTarget = chess.isAttacked(r.to, us);
        const net = PIECE_VALUE[r.captured] - (defendedTarget ? PIECE_VALUE[r.piece] : 0);
        if (net > worst) worst = net;
        // Mate em 1 do adversário
        if (r.san.endsWith('#')) worst = Math.max(worst, 50_000);
      }
      for (const r of replies) if (r.san.endsWith('#')) worst = Math.max(worst, 50_000);
      score -= worst * 0.9;
      if (chess.inCheck()) score += 15; // xeque
    });

    // Escapar de ataque
    if (fromAttacked && !m.captured) score += PIECE_VALUE[m.piece] * 0.5;

    // Desenvolvimento
    const backRank = us === 'w' ? '1' : '8';
    if (inOpening) {
      if (isMinor(m.piece) && m.from[1] === backRank) score += 30;
      if (m.piece === 'p' && (m.from[0] === 'd' || m.from[0] === 'e') && Math.abs(Number(m.to[1]) - Number(m.from[1])) === 2)
        score += 25;
      if (m.piece === 'q' && plies < 14) score -= 25;
      if (m.piece === 'r' && !m.captured) score -= 10;
    }
    // Segurança do rei
    if (m.isKingsideCastle() || m.isQueensideCastle()) score += 60;
    else if (m.piece === 'k' && !inCheckNow) score -= 50;
    if (m.piece === 'p' && (m.from[0] === 'f' || m.from[0] === 'g' || m.from[0] === 'h') && inOpening) score -= 6;

    return { m, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  // Variedade: sorteia entre lances praticamente equivalentes.
  const pool = scored.filter((s) => s.score >= best.score - 12).slice(0, 4);
  const pick = pool[Math.floor(rnd() * pool.length)];
  return { move: pick.m, info: { note: 'Capturas seguras, desenvolvimento e rei seguro.' } };
}

/* -------------------------------------------------------------------------- */
/*  DIFÍCIL — busca alfa-beta com quiescência e avaliação posicional            */
/* -------------------------------------------------------------------------- */

interface SearchCtx {
  deadline: number;
  nodes: number;
  timedOut: boolean;
}

class Timeout extends Error {}

const moveScoreForOrdering = (m: Move) => {
  let s = 0;
  if (m.captured) s += 10 * PIECE_VALUE[m.captured] - PIECE_VALUE[m.piece] / 10 + 1000;
  if (m.promotion) s += PIECE_VALUE[m.promotion] + 900;
  if (m.san.includes('+')) s += 60;
  if (m.isKingsideCastle() || m.isQueensideCastle()) s += 30;
  return s;
};

const sorted = (moves: Move[]) =>
  moves
    .map((m) => ({ m, s: moveScoreForOrdering(m) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.m);

const make = (chess: Chess, m: Move) => chess.move({ from: m.from, to: m.to, promotion: m.promotion });

/** Avaliação do ponto de vista de quem joga. */
const staticEval = (chess: Chess) => (chess.turn() === 'w' ? 1 : -1) * evaluate(chess);

function quiesce(chess: Chess, alpha: number, beta: number, ctx: SearchCtx, qDepth: number): number {
  ctx.nodes++;
  if ((ctx.nodes & 255) === 0 && performance.now() > ctx.deadline) {
    ctx.timedOut = true;
    throw new Timeout();
  }
  const stand = staticEval(chess);
  if (qDepth <= 0) return stand;
  if (stand >= beta) return stand;
  if (stand > alpha) alpha = stand;
  const caps = sorted(chess.moves({ verbose: true }).filter((m) => m.captured || m.promotion));
  for (const m of caps) {
    // Poda por "delta": captura insignificante não recupera a diferença.
    if (m.captured && stand + PIECE_VALUE[m.captured] + 200 < alpha && !m.promotion) continue;
    make(chess, m);
    const score = -quiesce(chess, -beta, -alpha, ctx, qDepth - 1);
    chess.undo();
    if (score >= beta) return score;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

function negamax(chess: Chess, depth: number, alpha: number, beta: number, ply: number, ctx: SearchCtx): number {
  ctx.nodes++;
  if ((ctx.nodes & 255) === 0 && performance.now() > ctx.deadline) {
    ctx.timedOut = true;
    throw new Timeout();
  }
  if (ply > 0 && (chess.isThreefoldRepetition() || chess.isInsufficientMaterial() || chess.isDrawByFiftyMoves())) {
    return 0;
  }
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) return chess.inCheck() ? -MATE + ply : 0;
  if (depth <= 0) return quiesce(chess, alpha, beta, ctx, 4);
  let best = -Infinity;
  for (const m of sorted(moves)) {
    make(chess, m);
    const score = -negamax(chess, depth - 1, -beta, -alpha, ply + 1, ctx);
    chess.undo();
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

function chooseHard(chess: Chess, moves: Move[], opts: AiOptions, rnd: () => number): AiChoice {
  const maxDepth = Math.max(1, Math.min(5, Math.round(opts.depth ?? 3)));
  const think = Math.max(100, opts.thinkTimeMs ?? 1500);
  const start = performance.now();
  const ctx: SearchCtx = { deadline: start + think, nodes: 0, timedOut: false };
  const us = chess.turn();
  const root = sorted(moves);
  const baseline = chess.history().length;

  // Mate em 1 sempre é jogado.
  const mate = root.find((m) => m.san.endsWith('#'));
  if (mate) {
    return { move: mate, info: { depth: 1, mate: us === 'w' ? 1 : -1, nodes: 1, note: 'Mate em 1.' } };
  }

  let bestMove = root[0];
  let bestScore = -Infinity;
  let reached = 0;
  let order = root;

  for (let depth = 1; depth <= maxDepth; depth++) {
    let iterBest: Move | null = null;
    let iterScore = -Infinity;
    const scores = new Map<Move, number>();
    try {
      let alpha = -Infinity;
      for (const m of order) {
        make(chess, m);
        const s = -negamax(chess, depth - 1, -Infinity, -alpha, 1, ctx);
        chess.undo();
        // Pequeno ruído para variar entre lances equivalentes (apenas na raiz).
        const noisy = s + (rnd() * 4 - 2);
        scores.set(m, s);
        if (noisy > iterScore) {
          iterScore = noisy;
          iterBest = m;
        }
        if (s > alpha) alpha = s;
      }
    } catch (e) {
      if (!(e instanceof Timeout)) throw e;
      // Desfaz lances pendentes da busca interrompida
      while (chess.history().length > baseline) chess.undo();
      break;
    }
    if (iterBest) {
      bestMove = iterBest;
      bestScore = scores.get(iterBest) ?? iterScore;
      reached = depth;
      order = [iterBest, ...order.filter((m) => m !== iterBest)];
    }
    if (Math.abs(bestScore) > MATE - 100) break; // mate encontrado
    if (performance.now() > ctx.deadline) break;
  }

  const white = us === 'w' ? bestScore : -bestScore;
  const info: EngineInfo = {
    depth: reached || 1,
    nodes: ctx.nodes,
    timeMs: Math.round(performance.now() - start),
    note: 'Alfa-beta + quiescência · material, mobilidade, centro e rei',
  };
  if (Math.abs(white) > MATE - 100) {
    const matePly = MATE - Math.abs(white);
    const n = Math.ceil(matePly / 2);
    info.mate = white > 0 ? n : -n;
  } else if (Number.isFinite(white)) {
    info.cp = Math.round(white);
  }
  return { move: bestMove, info };
}
