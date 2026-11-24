import { Chess, type Move } from 'chess.js';
import type { EngineInfo } from '../types';
import { Position, moveToUci } from './board';
import { MATE_SCORE, MATE_THRESHOLD, Searcher, TranspositionTable, type EvalOptions, type SearchConfig, type SearchInfo } from './search';

/**
 * Módulo de decisão da Chess.js AI.
 *  - chess.js: regras, lances legais da raiz, validação do lance escolhido;
 *  - board.ts / search.ts: motor de busca próprio (alfa-beta, aprofundamento iterativo,
 *    quiescência, tabela de transposição, killers, history, LMR, avaliação posicional).
 * Os níveis diferem em profundidade, tempo, termos de avaliação e margem de erro controlado.
 */

export type AiLevel = 'easy' | 'normal' | 'hard';

export interface AiOptions {
  level: AiLevel;
  /** Profundidade máxima (nível difícil / personalizado). */
  depth?: number;
  /** Tempo máximo de pensamento (nível difícil), em ms. */
  thinkTimeMs?: number;
  /** Memória máxima da tabela de transposição, em MB (nível difícil). */
  hashMb?: number;
  /** Fonte de aleatoriedade injetável (testes). */
  random?: () => number;
  /** Progresso por profundidade concluída. */
  onInfo?: (info: EngineInfo) => void;
}

export interface AiChoice {
  move: Move;
  info: EngineInfo;
}

export function resolveLevel(raw: unknown): AiLevel {
  return raw === 'easy' || raw === 'normal' ? raw : 'hard';
}

const FULL_EVAL: EvalOptions = { mobility: true, pawnStructure: true, kingSafety: true, development: true };
const BASIC_EVAL: EvalOptions = { mobility: false, pawnStructure: false, kingSafety: false, development: false };

interface LevelPlan {
  cfg: SearchConfig;
  /** Margem (cp) dentro da qual lances são candidatos. 0 = sempre o melhor. */
  window: number;
  /** Temperatura (cp) da escolha entre candidatos. */
  temp: number;
  /** Probabilidade de escolher um candidato uniformemente (iniciantes). */
  wobble: number;
}

export function planFor(opts: AiOptions): LevelPlan {
  const level = opts.level;
  if (level === 'easy') {
    return {
      cfg: { maxDepth: 2, timeMs: 500, ttBits: 15, scoreAllRootMoves: true, quiescence: false, eval: BASIC_EVAL },
      window: 230,
      temp: 90,
      wobble: 0.14,
    };
  }
  if (level === 'normal') {
    return {
      cfg: { maxDepth: 4, timeMs: 1200, ttBits: 18, scoreAllRootMoves: true, quiescence: true, eval: FULL_EVAL },
      window: 45,
      temp: 14,
      wobble: 0,
    };
  }
  const depth = Math.max(1, Math.min(10, Math.round(opts.depth ?? 5)));
  const mb = Math.max(1, Math.min(64, opts.hashMb ?? 18));
  const bits = Math.max(14, Math.min(22, Math.floor(Math.log2((mb * 1024 * 1024) / 18))));
  return {
    cfg: {
      maxDepth: depth,
      timeMs: Math.max(100, opts.thinkTimeMs ?? 2000),
      ttBits: bits,
      scoreAllRootMoves: false,
      quiescence: true,
      eval: FULL_EVAL,
    },
    window: 0,
    temp: 1,
    wobble: 0,
  };
}

// Tabelas reaproveitadas entre lances (acelera a partida e limita a memória a uma por tamanho).
const ttCache = new Map<number, TranspositionTable>();
function getTT(bits: number): TranspositionTable {
  let t = ttCache.get(bits);
  if (!t) {
    // mantém no máximo uma tabela alocada por vez
    ttCache.clear();
    t = new TranspositionTable(bits);
    ttCache.set(bits, t);
  }
  return t;
}
export function resetAiState() {
  ttCache.forEach((t) => t.clear());
}

function toEngineInfo(i: SearchInfo, whiteToMove: boolean, extra: Partial<EngineInfo> = {}): EngineInfo {
  const sgn = whiteToMove ? 1 : -1;
  const info: EngineInfo = {
    depth: i.depth,
    nodes: i.nodes,
    timeMs: Math.round(i.timeMs),
    nps: i.timeMs > 0 ? Math.round((i.nodes / i.timeMs) * 1000) : undefined,
    pv: i.pv,
    ...extra,
  };
  if (Math.abs(i.score) > MATE_THRESHOLD) {
    const plies = MATE_SCORE - Math.abs(i.score);
    info.mate = sgn * (i.score > 0 ? 1 : -1) * Math.max(1, Math.ceil(plies / 2));
  } else info.cp = sgn * i.score;
  return info;
}

function pickWithNoise(
  roots: { move: number; score: number }[],
  plan: LevelPlan,
  rnd: () => number,
): { move: number; score: number } {
  const sorted = [...roots].sort((a, b) => b.score - a.score);
  const best = sorted[0];
  if (plan.window <= 0 || Math.abs(best.score) > MATE_THRESHOLD || best.score < -MATE_THRESHOLD) return best;
  const cands = sorted.filter((r) => r.score >= best.score - plan.window);
  if (cands.length === 1) return best;
  if (plan.wobble > 0 && rnd() < plan.wobble) return cands[Math.floor(rnd() * cands.length)];
  const weights = cands.map((r) => Math.exp((r.score - best.score) / plan.temp));
  const total = weights.reduce((a, b) => a + b, 0);
  let x = rnd() * total;
  for (let i = 0; i < cands.length; i++) {
    x -= weights[i];
    if (x <= 0) return cands[i];
  }
  return best;
}

/** Escolhe um lance para a posição `fen`. Síncrono, porém limitado por tempo/nós. */
export function chooseMove(fen: string, opts: AiOptions): AiChoice {
  const rnd = opts.random ?? Math.random;
  const chess = new Chess(fen);
  const legal = chess.moves({ verbose: true });
  if (legal.length === 0) throw new Error('Sem lances legais na posição.');
  const whiteToMove = chess.turn() === 'w';
  const plan = planFor(opts);

  const pos = new Position(fen);
  const searcher = new Searcher(pos, getTT(plan.cfg.ttBits), plan.cfg, (i) =>
    opts.onInfo?.(toEngineInfo(i, whiteToMove)),
  );
  const res = searcher.run();

  let chosen = { move: res.best, score: res.score };
  if (plan.window > 0 && res.roots.length > 1 && res.depth > 0 && !res.timedOut) {
    chosen = pickWithNoise(res.roots, plan, rnd);
  } else if (plan.window > 0 && res.roots.length > 1 && res.depth > 0) {
    chosen = pickWithNoise(res.roots, plan, rnd);
  }
  const uci = moveToUci(chosen.move);
  let move = legal.find((m) => m.from + m.to + (m.promotion ?? '') === uci);
  let note: string | undefined;
  if (!move) {
    // Salvaguarda: o chess.js é a autoridade das regras.
    move = legal.find((m) => m.captured) ?? legal[0];
    note = 'Lance do motor rejeitado pelo chess.js; usado lance legal de segurança.';
  }
  const info = toEngineInfo(
    { depth: res.depth, score: chosen.score, nodes: res.nodes, timeMs: res.timeMs, pv: res.pv },
    whiteToMove,
    { note: note ?? (res.timedOut ? 'Busca limitada por tempo' : undefined) },
  );
  return { move, info };
}
