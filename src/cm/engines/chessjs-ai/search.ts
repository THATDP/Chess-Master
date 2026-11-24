import { B, F_CAP, K, N, P, Position, Q, R, mCap, mFlags, mFrom, mPromo, mTo, moveToUci, sq64 } from './board';

/* ----------------------------- Avaliação ----------------------------- */

const VAL_MG = [0, 100, 320, 335, 500, 950, 0];
const VAL_EG = [0, 115, 300, 320, 520, 930, 0];
const MATE = 100_000;
const MATE_BOUND = MATE - 1000;
const INF = 1_000_000;

// Tabelas posicionais geradas por fórmula (índice 0 = a1, perspectiva das brancas).
const PST_MG: Int16Array[] = [];
const PST_EG: Int16Array[] = [];
(function buildTables() {
  for (let t = 0; t <= 6; t++) {
    PST_MG.push(new Int16Array(64));
    PST_EG.push(new Int16Array(64));
  }
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const i = r * 8 + f;
      const cf = Math.abs(f - 3.5);
      const cr = Math.abs(r - 3.5);
      const dist = cf + cr; // 1..7
      const center = 3.5 - Math.max(cf, cr); // 0..3
      // peão
      PST_MG[P][i] = r === 0 || r === 7 ? 0 : Math.round((r - 1) * 4 + (f === 3 || f === 4 ? (r >= 2 && r <= 4 ? 14 : 4) : f === 2 || f === 5 ? 4 : 0) - (f === 0 || f === 7 ? 6 : 0));
      PST_EG[P][i] = r === 0 || r === 7 ? 0 : Math.round((r - 1) * (r - 1) * 2.2);
      // cavalo
      PST_MG[N][i] = Math.round(-28 + (4.5 - dist) * 8 + center * 2);
      PST_EG[N][i] = Math.round(-22 + (4.5 - dist) * 6);
      // bispo
      PST_MG[B][i] = Math.round(-12 + (4.5 - dist) * 3.5 + (r === 0 ? -6 : 0));
      PST_EG[B][i] = Math.round(-8 + (4.5 - dist) * 3);
      // torre
      PST_MG[R][i] = (r === 6 ? 14 : 0) + (f === 3 || f === 4 ? 4 : 0) + (r === 0 && (f === 3 || f === 4) ? 4 : 0);
      PST_EG[R][i] = r === 6 ? 10 : 0;
      // dama
      PST_MG[Q][i] = Math.round(-8 + (4.5 - dist) * 2) - (r >= 2 && r <= 5 ? 0 : 0);
      PST_EG[Q][i] = Math.round(-10 + (4.5 - dist) * 4);
      // rei
      PST_MG[K][i] = Math.round(-14 * r + (r === 0 ? (f === 6 || f === 1 ? 26 : f === 2 ? 14 : f === 4 || f === 3 ? -20 : 0) : 0) - (r > 0 ? cf * 2 : 0));
      PST_EG[K][i] = Math.round((3.5 - dist / 2) * 14);
    }
  }
})();

const PASSED_BONUS = [0, 5, 10, 22, 42, 75, 120, 0];

export interface EvalOptions {
  mobility: boolean;
  pawnStructure: boolean;
  kingSafety: boolean;
  development: boolean;
}

/** Avaliação estática (centipeões) do ponto de vista de quem joga. */
export function evaluatePosition(pos: Position, o: EvalOptions): number {
  const b = pos.b;
  const mg = [0, 0];
  const eg = [0, 0];
  let phase = 0;
  const pawnCnt = [new Int8Array(10), new Int8Array(10)]; // colunas 1..8
  const pMin = [new Int8Array(10).fill(8), new Int8Array(10).fill(8)]; // menor rank relativo
  const pAbsMin = [new Int8Array(10).fill(8), new Int8Array(10).fill(8)];
  const pAbsMax = [new Int8Array(10).fill(-1), new Int8Array(10).fill(-1)];
  const bishops = [0, 0];
  const rooks: number[][] = [[], []];
  const minorsHome = [0, 0];
  let mat = [0, 0];

  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) {
      sq += 7;
      continue;
    }
    const p = b[sq];
    if (!p) continue;
    const c = p > 0 ? 0 : 1;
    const t = p > 0 ? p : -p;
    const i64 = sq64(sq);
    const idx = c === 0 ? i64 : i64 ^ 56;
    const rank = sq >> 4;
    const file = sq & 7;
    mg[c] += VAL_MG[t] + PST_MG[t][idx];
    eg[c] += VAL_EG[t] + PST_EG[t][idx];
    if (t !== P && t !== K) {
      phase += t === Q ? 4 : t === R ? 2 : 1;
      mat[c] += VAL_MG[t];
    }
    const rel = c === 0 ? rank : 7 - rank;
    if (t === P) {
      pawnCnt[c][file + 1]++;
      if (rel < pMin[c][file + 1]) pMin[c][file + 1] = rel;
      if (rank < pAbsMin[c][file + 1]) pAbsMin[c][file + 1] = rank;
      if (rank > pAbsMax[c][file + 1]) pAbsMax[c][file + 1] = rank;
    } else if (t === B) bishops[c]++;
    else if (t === R) rooks[c].push(file + 1);
    if (o.development && rel === 0 && (t === N || t === B)) minorsHome[c]++;
    if (o.mobility && t >= N && t <= Q) {
      let cnt = 0;
      if (t === N) {
        const offs = [33, 31, 18, 14, -33, -31, -18, -14];
        for (let k = 0; k < 8; k++) {
          const to = sq + offs[k];
          if (!(to & 0x88) && (!b[to] || b[to] * p < 0)) cnt++;
        }
        cnt -= 4;
        mg[c] += cnt * 4;
        eg[c] += cnt * 3;
      } else {
        const dirs = t === B ? [15, 17, -15, -17] : t === R ? [1, -1, 16, -16] : [1, -1, 16, -16, 15, 17, -15, -17];
        for (let k = 0; k < dirs.length; k++) {
          let to = sq + dirs[k];
          while (!(to & 0x88)) {
            if (!b[to]) cnt++;
            else {
              if (b[to] * p < 0) cnt++;
              break;
            }
            to += dirs[k];
          }
        }
        if (t === B) {
          cnt -= 6;
          mg[c] += cnt * 3;
          eg[c] += cnt * 3;
        } else if (t === R) {
          cnt -= 6;
          mg[c] += cnt * 1;
          eg[c] += cnt * 3;
        } else {
          cnt -= 12;
          mg[c] += cnt * 1;
          eg[c] += cnt * 2;
        }
      }
    }
  }

  for (let c = 0; c < 2; c++) {
    const e = 1 - c;
    if (bishops[c] >= 2) {
      mg[c] += 28;
      eg[c] += 40;
    }
    if (o.development) {
      mg[c] -= minorsHome[c] * 9;
    }
    // torres em colunas abertas
    for (const f of rooks[c]) {
      if (pawnCnt[c][f] === 0) {
        const open = pawnCnt[e][f] === 0;
        mg[c] += open ? 20 : 9;
        eg[c] += open ? 12 : 5;
      }
    }
    if (o.pawnStructure) {
      for (let f = 1; f <= 8; f++) {
        const n = pawnCnt[c][f];
        if (!n) continue;
        if (n > 1) {
          mg[c] -= 10 * (n - 1);
          eg[c] -= 16 * (n - 1);
        }
        if (!pawnCnt[c][f - 1] && !pawnCnt[c][f + 1]) {
          mg[c] -= 12;
          eg[c] -= 14;
        }
        // peão passado (usa o peão mais avançado da coluna)
        let passed = true;
        const adv = c === 0 ? pAbsMax[0][f] : pAbsMin[1][f];
        for (let g = f - 1; g <= f + 1 && passed; g++) {
          if (g < 1 || g > 8) continue;
          if (c === 0 ? pAbsMax[1][g] > adv : pAbsMin[0][g] < adv && pAbsMin[0][g] !== 8) passed = false;
          if (c === 0 && pAbsMax[1][g] === -1) continue;
        }
        if (passed) {
          const rel = c === 0 ? adv : 7 - adv;
          mg[c] += PASSED_BONUS[rel] >> 1;
          eg[c] += PASSED_BONUS[rel];
        }
      }
    }
    if (o.kingSafety) {
      const ks = pos.kings[c];
      const kr = c === 0 ? ks >> 4 : 7 - (ks >> 4);
      const kf = ks & 7;
      if (kr <= 1) {
        let shield = 0;
        for (let f = Math.max(0, kf - 1); f <= Math.min(7, kf + 1); f++) {
          const m = pMin[c][f + 1];
          if (m === 8) shield -= 16;
          else if (m === kr + 1 || m === kr + 2) shield += 9;
          else shield -= 7;
          if (pawnCnt[c][f + 1] === 0 && pawnCnt[e][f + 1] === 0) shield -= 10;
        }
        mg[c] += shield;
      } else if (phase > 10) {
        mg[c] -= 24 + 10 * (kr - 2);
      }
    }
  }

  // rei na zona de ataque / final: empurrar o rei adversário para a borda quando em vantagem
  const total = Math.min(24, phase);
  let score = ((mg[0] - mg[1]) * total + (eg[0] - eg[1]) * (24 - total)) / 24;
  if (total <= 8) {
    const lead = mat[0] - mat[1];
    if (Math.abs(lead) > 250) {
      const win = lead > 0 ? 0 : 1;
      const lose = 1 - win;
      const lk = pos.kings[lose];
      const wk = pos.kings[win];
      const edge = 3.5 - Math.min(Math.abs((lk & 7) - 3.5), Math.abs((lk >> 4) - 3.5)) - 0;
      const near = 14 - (Math.abs((lk & 7) - (wk & 7)) + Math.abs((lk >> 4) - (wk >> 4)));
      const bonus = edge * 8 + near * 3;
      score += win === 0 ? bonus : -bonus;
    }
  }
  const tempo = 10;
  return Math.round(pos.side > 0 ? score + tempo : -score + tempo);
}

/* -------------------------------- Busca -------------------------------- */

export interface SearchConfig {
  maxDepth: number;
  timeMs: number;
  /** Memória máxima da tabela de transposição (entradas = 2^ttBits). */
  ttBits: number;
  /** Retorna a pontuação exata de todos os lances da raiz (para erros controlados). */
  scoreAllRootMoves: boolean;
  quiescence: boolean;
  eval: EvalOptions;
  maxNodes?: number;
}

export interface RootResult {
  move: number;
  score: number;
}

export interface SearchInfo {
  depth: number;
  score: number;
  nodes: number;
  timeMs: number;
  pv: string[];
}

export interface SearchResult {
  best: number;
  score: number;
  depth: number;
  nodes: number;
  timeMs: number;
  pv: string[];
  roots: RootResult[];
  /** true se a busca foi interrompida pelo limite de tempo antes de concluir a profundidade máxima. */
  timedOut: boolean;
}

const MAX_PLY = 64;
const TT_EXACT = 0;
const TT_LOWER = 1;
const TT_UPPER = 2;

/** Tabela de transposição com tamanho fixo (controle de memória). */
export class TranspositionTable {
  readonly size: number;
  private mask: number;
  keys: Float64Array;
  scores: Int32Array;
  depths: Int8Array;
  flags: Uint8Array;
  moves: Int32Array;
  constructor(bits: number) {
    this.size = 1 << bits;
    this.mask = this.size - 1;
    this.keys = new Float64Array(this.size);
    this.scores = new Int32Array(this.size);
    this.depths = new Int8Array(this.size);
    this.flags = new Uint8Array(this.size);
    this.moves = new Int32Array(this.size);
  }
  index(key: number) {
    return (key % 4194304) & this.mask;
  }
  clear() {
    this.keys.fill(0);
  }
  get bytes() {
    return this.size * (8 + 4 + 1 + 1 + 4);
  }
}

class TimeUp extends Error {}

const MVV = [0, 100, 320, 335, 500, 950, 20000];

export class Searcher {
  private pos: Position;
  private tt: TranspositionTable;
  private cfg: SearchConfig;
  nodes = 0;
  private deadline = 0;
  private start = 0;
  private killers = new Int32Array(MAX_PLY * 2);
  private history = new Int32Array(2 * 64 * 64);
  private bufs: Int32Array[] = Array.from({ length: MAX_PLY + 12 }, () => new Int32Array(256));
  private scoresBuf: Int32Array[] = Array.from({ length: MAX_PLY + 12 }, () => new Int32Array(256));
  private pathKeys = new Float64Array(MAX_PLY + 12);
  private gameKeys: number[] = [];
  private onInfo?: (i: SearchInfo) => void;

  constructor(pos: Position, tt: TranspositionTable, cfg: SearchConfig, onInfo?: (i: SearchInfo) => void) {
    this.pos = pos;
    this.tt = tt;
    this.cfg = cfg;
    this.onInfo = onInfo;
  }

  /** Posições já ocorridas na partida (para detectar repetição). */
  setGameKeys(keys: number[]) {
    this.gameKeys = keys;
  }

  private checkTime() {
    if ((this.nodes & 511) === 0 && performance.now() > this.deadline) throw new TimeUp();
    if (this.cfg.maxNodes && this.nodes > this.cfg.maxNodes) throw new TimeUp();
  }

  private evalPos() {
    return evaluatePosition(this.pos, this.cfg.eval);
  }

  private scoreMoves(buf: Int32Array, sc: Int32Array, n: number, ttMove: number, ply: number) {
    const side = this.pos.side > 0 ? 0 : 1;
    const b = this.pos.b;
    for (let i = 0; i < n; i++) {
      const m = buf[i];
      let s = 0;
      if (m === ttMove) s = 10_000_000;
      else if (mCap(m)) {
        const att = Math.abs(b[mFrom(m)]);
        s = 1_000_000 + MVV[mCap(m)] * 16 - att;
      } else if (mPromo(m)) s = 900_000 + mPromo(m);
      else if (m === this.killers[ply * 2]) s = 800_000;
      else if (m === this.killers[ply * 2 + 1]) s = 790_000;
      else s = this.history[side * 4096 + sq64(mFrom(m)) * 64 + sq64(mTo(m))];
      sc[i] = s;
    }
  }

  private pick(buf: Int32Array, sc: Int32Array, n: number, from: number) {
    let best = from;
    for (let i = from + 1; i < n; i++) if (sc[i] > sc[best]) best = i;
    if (best !== from) {
      const m = buf[from];
      buf[from] = buf[best];
      buf[best] = m;
      const s = sc[from];
      sc[from] = sc[best];
      sc[best] = s;
    }
    return buf[from];
  }

  private quiesce(alpha: number, beta: number, ply: number, qd: number): number {
    this.nodes++;
    this.checkTime();
    const pos = this.pos;
    const stand = this.evalPos();
    if (ply >= MAX_PLY - 1 || qd <= 0) return stand;
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    const buf = this.bufs[ply];
    const sc = this.scoresBuf[ply];
    const n = pos.gen(buf, true);
    this.scoreMoves(buf, sc, n, 0, ply);
    for (let i = 0; i < n; i++) {
      const m = this.pick(buf, sc, n, i);
      // poda delta
      const gain = (mCap(m) ? MVV[mCap(m)] : 0) + (mPromo(m) ? 800 : 0);
      if (stand + gain + 200 < alpha && !mPromo(m)) continue;
      if (!pos.make(m)) continue;
      const score = -this.quiesce(-beta, -alpha, ply + 1, qd - 1);
      pos.unmake(m);
      if (score >= beta) return score;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  private negamax(depth: number, alpha: number, beta: number, ply: number, isPv: boolean): number {
    const pos = this.pos;
    this.nodes++;
    this.checkTime();
    const key = pos.key;
    this.pathKeys[ply] = key;
    if (ply > 0) {
      if (pos.half >= 100) return 0;
      for (let i = ply - 2; i >= 0; i -= 2) if (this.pathKeys[i] === key) return 0;
      if (this.gameKeys.length && ply <= 4 && this.gameKeys.includes(key)) return 0;
    }
    const inCheck = pos.inCheck();
    if (inCheck && ply < MAX_PLY - 2) depth++;
    if (depth <= 0 || ply >= MAX_PLY - 1) {
      return this.cfg.quiescence ? this.quiesce(alpha, beta, ply, 8) : this.evalPos();
    }

    const tt = this.tt;
    const ti = tt.index(key);
    let ttMove = 0;
    if (tt.keys[ti] === key) {
      ttMove = tt.moves[ti];
      if (tt.depths[ti] >= depth && !isPv) {
        let s = tt.scores[ti];
        if (s > MATE_BOUND) s -= ply;
        else if (s < -MATE_BOUND) s += ply;
        const f = tt.flags[ti];
        if (f === TT_EXACT) return s;
        if (f === TT_LOWER && s >= beta) return s;
        if (f === TT_UPPER && s <= alpha) return s;
      }
    }

    const buf = this.bufs[ply];
    const sc = this.scoresBuf[ply];
    const n = pos.gen(buf);
    this.scoreMoves(buf, sc, n, ttMove, ply);
    const origAlpha = alpha;
    let bestScore = -INF;
    let bestMove = 0;
    let legal = 0;
    const side = pos.side > 0 ? 0 : 1;
    for (let i = 0; i < n; i++) {
      const m = this.pick(buf, sc, n, i);
      if (!pos.make(m)) continue;
      legal++;
      const quiet = !mCap(m) && !mPromo(m);
      let score: number;
      if (legal === 1) {
        score = -this.negamax(depth - 1, -beta, -alpha, ply + 1, isPv);
      } else {
        let red = 0;
        if (depth >= 3 && legal > 4 && quiet && !inCheck) red = legal > 10 ? 2 : 1;
        score = -this.negamax(depth - 1 - red, -alpha - 1, -alpha, ply + 1, false);
        if (score > alpha && red > 0) score = -this.negamax(depth - 1, -alpha - 1, -alpha, ply + 1, false);
        if (score > alpha && score < beta) score = -this.negamax(depth - 1, -beta, -alpha, ply + 1, true);
      }
      pos.unmake(m);
      if (score > bestScore) {
        bestScore = score;
        bestMove = m;
        if (score > alpha) {
          alpha = score;
          if (alpha >= beta) {
            if (quiet) {
              if (this.killers[ply * 2] !== m) {
                this.killers[ply * 2 + 1] = this.killers[ply * 2];
                this.killers[ply * 2] = m;
              }
              const h = side * 4096 + sq64(mFrom(m)) * 64 + sq64(mTo(m));
              this.history[h] = Math.min(500_000, this.history[h] + depth * depth);
            }
            break;
          }
        }
      }
    }
    if (legal === 0) return inCheck ? -MATE + ply : 0;
    const flag = bestScore >= beta ? TT_LOWER : bestScore > origAlpha ? TT_EXACT : TT_UPPER;
    let store = bestScore;
    if (store > MATE_BOUND) store += ply;
    else if (store < -MATE_BOUND) store -= ply;
    if (tt.keys[ti] !== key || tt.depths[ti] <= depth) {
      tt.keys[ti] = key;
      tt.scores[ti] = store;
      tt.depths[ti] = depth;
      tt.flags[ti] = flag;
      tt.moves[ti] = bestMove;
    }
    return bestScore;
  }

  private extractPv(first: number, maxLen: number): string[] {
    const pos = this.pos;
    const pv: string[] = [moveToUci(first)];
    const made: number[] = [];
    if (!pos.make(first)) return pv;
    made.push(first);
    for (let i = 1; i < maxLen; i++) {
      const ti = this.tt.index(pos.key);
      if (this.tt.keys[ti] !== pos.key || !this.tt.moves[ti]) break;
      const m = this.tt.moves[ti];
      const buf = new Int32Array(256);
      const n = pos.gen(buf);
      let found = false;
      for (let k = 0; k < n; k++) if (buf[k] === m) found = true;
      if (!found || !pos.make(m)) break;
      made.push(m);
      pv.push(moveToUci(m));
    }
    for (let i = made.length - 1; i >= 0; i--) pos.unmake(made[i]);
    return pv;
  }

  /** Aprofundamento iterativo na raiz. */
  run(): SearchResult {
    const pos = this.pos;
    this.start = performance.now();
    this.deadline = this.start + this.cfg.timeMs;
    const rootMoves = pos.legalMoves();
    if (rootMoves.length === 0) throw new Error('Sem lances legais.');
    let result: SearchResult = {
      best: rootMoves[0],
      score: 0,
      depth: 0,
      nodes: 0,
      timeMs: 0,
      pv: [moveToUci(rootMoves[0])],
      roots: rootMoves.map((m) => ({ move: m, score: 0 })),
      timedOut: false,
    };
    // ordenação inicial: capturas primeiro
    let order = [...rootMoves].sort((a, b) => (mCap(b) ? MVV[mCap(b)] : 0) - (mCap(a) ? MVV[mCap(a)] : 0));
    this.pathKeys[0] = pos.key;
    if (rootMoves.length === 1) {
      return { ...result, depth: 0, timeMs: 0 };
    }
    for (let depth = 1; depth <= this.cfg.maxDepth; depth++) {
      const roots: RootResult[] = [];
      let alpha = -INF;
      const beta = INF;
      try {
        for (let idx = 0; idx < order.length; idx++) {
          const m = order[idx];
          pos.make(m);
          let score: number;
          if (this.cfg.scoreAllRootMoves || idx === 0) {
            score = -this.negamax(depth - 1, -INF, INF, 1, true);
          } else {
            score = -this.negamax(depth - 1, -alpha - 1, -alpha, 1, false);
            if (score > alpha) score = -this.negamax(depth - 1, -INF, -alpha, 1, true);
          }
          pos.unmake(m);
          roots.push({ move: m, score });
          if (score > alpha) alpha = score;
        }
      } catch (e) {
        if (!(e instanceof TimeUp)) throw e;
        result.timedOut = true;
        // Resultado parcial seguro: lances já pontuados exatamente (re-busca completa) nesta iteração.
        if (!this.cfg.scoreAllRootMoves && roots.length > 0 && depth > 1) {
          const bestPartial = roots.reduce((a, c) => (c.score > a.score ? c : a), roots[0]);
          if (bestPartial.move !== result.best && bestPartial.score >= result.score) {
            result = { ...result, best: bestPartial.move, score: bestPartial.score, pv: [moveToUci(bestPartial.move)] };
          }
        }
        return this.finish(result, rootMoves.length);
      }
      roots.sort((a, b) => b.score - a.score);
      order = roots.map((r) => r.move);
      const pv = this.extractPv(roots[0].move, depth + 4);
      const timeMs = performance.now() - this.start;
      result = {
        best: roots[0].move,
        score: roots[0].score,
        depth,
        nodes: this.nodes,
        timeMs,
        pv,
        roots,
        timedOut: false,
      };
      this.onInfo?.({ depth, score: roots[0].score, nodes: this.nodes, timeMs, pv });
      if (Math.abs(roots[0].score) > MATE_BOUND && !this.cfg.scoreAllRootMoves) break;
      if (timeMs > this.cfg.timeMs * 0.6 && !this.cfg.scoreAllRootMoves) break;
    }
    return this.finish(result, rootMoves.length);
  }

  private finish(r: SearchResult, _n: number): SearchResult {
    void _n;
    return { ...r, nodes: this.nodes, timeMs: performance.now() - this.start };
  }
}

export { F_CAP, mFlags };
export const MATE_SCORE = MATE;
export const MATE_THRESHOLD = MATE_BOUND;
