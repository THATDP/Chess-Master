/**
 * Tabuleiro 0x88 interno da Chess.js AI, usado SOMENTE dentro da busca.
 * As regras oficiais (validação de lances do usuário, fim de partida, FEN/PGN)
 * continuam sendo do chess.js; a conformidade deste gerador com o chess.js é
 * verificada por testes de perft (tests/engines/run-tests.ts).
 */
export const P = 1;
export const N = 2;
export const B = 3;
export const R = 4;
export const Q = 5;
export const K = 6;

export const F_CAP = 1;
export const F_EP = 2;
export const F_CASTLE = 4;
export const F_DBL = 8;

const KNIGHT = [33, 31, 18, 14, -33, -31, -18, -14];
const KING = [1, -1, 16, -16, 15, 17, -15, -17];
const DIAG = [15, 17, -15, -17];
const ORTH = [1, -1, 16, -16];

export const mFrom = (m: number) => m & 127;
export const mTo = (m: number) => (m >> 7) & 127;
export const mPromo = (m: number) => (m >> 14) & 7;
export const mFlags = (m: number) => (m >> 17) & 15;
export const mCap = (m: number) => (m >> 21) & 7;
const mk = (from: number, to: number, promo: number, flags: number, cap: number) =>
  from | (to << 7) | (promo << 14) | (flags << 17) | (cap << 21);

export const sqName = (s: number) => 'abcdefgh'[s & 7] + String((s >> 4) + 1);
export const parseSq = (str: string) => str.charCodeAt(0) - 97 + (str.charCodeAt(1) - 49) * 16;
export const sq64 = (s: number) => (s >> 4) * 8 + (s & 7);
const PROMO_CHAR = ['', '', 'n', 'b', 'r', 'q'];
export const moveToUci = (m: number) => sqName(mFrom(m)) + sqName(mTo(m)) + (mPromo(m) ? PROMO_CHAR[mPromo(m)] : '');

// --- Zobrist (xorshift determinístico) ---
let seed = 0x9e3779b9;
const rnd = () => {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return seed | 0;
};
const ZLO = new Int32Array(14 * 128);
const ZHI = new Int32Array(14 * 128);
for (let i = 0; i < ZLO.length; i++) {
  ZLO[i] = rnd();
  ZHI[i] = rnd() & 0x1fffff;
}
const ZSIDE_LO = rnd();
const ZSIDE_HI = rnd() & 0x1fffff;
const ZC_LO = new Int32Array(16).map(() => rnd());
const ZC_HI = new Int32Array(16).map(() => rnd() & 0x1fffff);
const ZE_LO = new Int32Array(8).map(() => rnd());
const ZE_HI = new Int32Array(8).map(() => rnd() & 0x1fffff);

// Direitos de roque removidos quando uma casa é origem/destino de um lance.
const CR = new Uint8Array(128).fill(15);
CR[0x04] = 12;
CR[0x00] = 13;
CR[0x07] = 14;
CR[0x74] = 3;
CR[0x70] = 7;
CR[0x77] = 11;

const MAXN = 2048;

export class Position {
  b = new Int8Array(128);
  side = 1; // 1 = brancas, -1 = pretas
  castle = 0; // 1 K, 2 Q, 4 k, 8 q
  ep = -1;
  half = 0;
  kings = [0, 0];
  hashLo = 0;
  hashHi = 0;
  n = 0;
  private stCap = new Int8Array(MAXN);
  private stCastle = new Uint8Array(MAXN);
  private stEp = new Int16Array(MAXN);
  private stHalf = new Int16Array(MAXN);
  private stLo = new Int32Array(MAXN);
  private stHi = new Int32Array(MAXN);

  constructor(fen: string) {
    this.setFen(fen);
  }

  get key(): number {
    return this.hashHi * 4294967296 + (this.hashLo >>> 0);
  }

  setFen(fen: string) {
    const [place, stm, cas, ep, half] = fen.trim().split(/\s+/);
    this.b.fill(0);
    let r = 7;
    let f = 0;
    const map: Record<string, number> = { p: P, n: N, b: B, r: R, q: Q, k: K };
    for (const ch of place) {
      if (ch === '/') {
        r--;
        f = 0;
      } else if (ch >= '1' && ch <= '8') f += Number(ch);
      else {
        const t = map[ch.toLowerCase()];
        if (!t) throw new Error(`FEN inválido: ${fen}`);
        const sq = r * 16 + f;
        this.b[sq] = ch === ch.toUpperCase() ? t : -t;
        if (t === K) this.kings[ch === ch.toUpperCase() ? 0 : 1] = sq;
        f++;
      }
    }
    this.side = stm === 'b' ? -1 : 1;
    this.castle = 0;
    if (cas && cas !== '-') {
      if (cas.includes('K')) this.castle |= 1;
      if (cas.includes('Q')) this.castle |= 2;
      if (cas.includes('k')) this.castle |= 4;
      if (cas.includes('q')) this.castle |= 8;
    }
    this.ep = ep && ep !== '-' ? parseSq(ep) : -1;
    this.half = half ? Number(half) || 0 : 0;
    this.n = 0;
    this.computeHash();
  }

  private computeHash() {
    let lo = 0;
    let hi = 0;
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) continue;
      const p = this.b[s];
      if (p) {
        lo ^= ZLO[(p + 7) * 128 + s];
        hi ^= ZHI[(p + 7) * 128 + s];
      }
    }
    if (this.side < 0) {
      lo ^= ZSIDE_LO;
      hi ^= ZSIDE_HI;
    }
    lo ^= ZC_LO[this.castle];
    hi ^= ZC_HI[this.castle];
    if (this.ep >= 0) {
      lo ^= ZE_LO[this.ep & 7];
      hi ^= ZE_HI[this.ep & 7];
    }
    this.hashLo = lo;
    this.hashHi = hi;
  }

  attacked(sq: number, by: number): boolean {
    const b = this.b;
    // peões
    const pd = by > 0 ? -16 : 16;
    let s = sq + pd - 1;
    if (!(s & 0x88) && b[s] === by * P) return true;
    s = sq + pd + 1;
    if (!(s & 0x88) && b[s] === by * P) return true;
    for (let i = 0; i < 8; i++) {
      s = sq + KNIGHT[i];
      if (!(s & 0x88) && b[s] === by * N) return true;
      s = sq + KING[i];
      if (!(s & 0x88) && b[s] === by * K) return true;
    }
    for (let i = 0; i < 4; i++) {
      let d = DIAG[i];
      s = sq + d;
      while (!(s & 0x88)) {
        const p = b[s];
        if (p) {
          if (p === by * B || p === by * Q) return true;
          break;
        }
        s += d;
      }
      d = ORTH[i];
      s = sq + d;
      while (!(s & 0x88)) {
        const p = b[s];
        if (p) {
          if (p === by * R || p === by * Q) return true;
          break;
        }
        s += d;
      }
    }
    return false;
  }

  inCheck(): boolean {
    return this.attacked(this.kings[this.side > 0 ? 0 : 1], -this.side);
  }

  /** Gera lances pseudo-legais em `out`; retorna a quantidade. */
  gen(out: Int32Array, capturesOnly = false): number {
    const b = this.b;
    const side = this.side;
    let n = 0;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) {
        sq += 7;
        continue;
      }
      const p = b[sq];
      if (!p || p * side < 0) continue;
      const t = p * side;
      if (t === P) {
        const dir = side * 16;
        const rank = sq >> 4;
        const promoting = side > 0 ? rank === 6 : rank === 1;
        const start = side > 0 ? rank === 1 : rank === 6;
        let to = sq + dir;
        if (!b[to]) {
          if (promoting) {
            for (let pr = Q; pr >= N; pr--) out[n++] = mk(sq, to, pr, 0, 0);
          } else if (!capturesOnly) {
            out[n++] = mk(sq, to, 0, 0, 0);
            const to2 = to + dir;
            if (start && !b[to2]) out[n++] = mk(sq, to2, 0, F_DBL, 0);
          }
        }
        for (let k = -1; k <= 1; k += 2) {
          to = sq + dir + k;
          if (to & 0x88) continue;
          const c = b[to];
          if (c && c * side < 0) {
            const ct = Math.abs(c);
            if (promoting) for (let pr = Q; pr >= N; pr--) out[n++] = mk(sq, to, pr, F_CAP, ct);
            else out[n++] = mk(sq, to, 0, F_CAP, ct);
          } else if (!c && to === this.ep) {
            out[n++] = mk(sq, to, 0, F_CAP | F_EP, P);
          }
        }
      } else if (t === N || t === K) {
        const offs = t === N ? KNIGHT : KING;
        for (let i = 0; i < 8; i++) {
          const to = sq + offs[i];
          if (to & 0x88) continue;
          const c = b[to];
          if (!c) {
            if (!capturesOnly) out[n++] = mk(sq, to, 0, 0, 0);
          } else if (c * side < 0) out[n++] = mk(sq, to, 0, F_CAP, Math.abs(c));
        }
        if (t === K && !capturesOnly) n = this.genCastle(out, n, sq);
      } else {
        const dirs = t === B ? DIAG : t === R ? ORTH : null;
        for (let pass = 0; pass < 2; pass++) {
          const ds = dirs ?? (pass === 0 ? DIAG : ORTH);
          if (dirs && pass === 1) break;
          for (let i = 0; i < 4; i++) {
            const d = ds[i];
            let to = sq + d;
            while (!(to & 0x88)) {
              const c = b[to];
              if (!c) {
                if (!capturesOnly) out[n++] = mk(sq, to, 0, 0, 0);
              } else {
                if (c * side < 0) out[n++] = mk(sq, to, 0, F_CAP, Math.abs(c));
                break;
              }
              to += d;
            }
          }
        }
      }
    }
    return n;
  }

  private genCastle(out: Int32Array, n: number, sq: number): number {
    const side = this.side;
    const b = this.b;
    const base = side > 0 ? 0 : 0x70;
    if (sq !== base + 4) return n;
    const kBit = side > 0 ? 1 : 4;
    const qBit = side > 0 ? 2 : 8;
    if (!(this.castle & (kBit | qBit))) return n;
    if (this.attacked(sq, -side)) return n;
    if (this.castle & kBit && !b[base + 5] && !b[base + 6] && b[base + 7] === side * R && !this.attacked(base + 5, -side)) {
      out[n++] = mk(sq, base + 6, 0, F_CASTLE, 0);
    }
    if (
      this.castle & qBit &&
      !b[base + 3] &&
      !b[base + 2] &&
      !b[base + 1] &&
      b[base] === side * R &&
      !this.attacked(base + 3, -side)
    ) {
      out[n++] = mk(sq, base + 2, 0, F_CASTLE, 0);
    }
    return n;
  }

  private xp(p: number, s: number) {
    this.hashLo ^= ZLO[(p + 7) * 128 + s];
    this.hashHi ^= ZHI[(p + 7) * 128 + s];
  }

  /** Executa o lance. Retorna false (e desfaz) se deixar o próprio rei em xeque. */
  make(m: number): boolean {
    const b = this.b;
    const from = m & 127;
    const to = (m >> 7) & 127;
    const promo = (m >> 14) & 7;
    const fl = (m >> 17) & 15;
    const side = this.side;
    const piece = b[from];
    const i = this.n++;
    this.stCastle[i] = this.castle;
    this.stEp[i] = this.ep;
    this.stHalf[i] = this.half;
    this.stLo[i] = this.hashLo;
    this.stHi[i] = this.hashHi;

    if (this.ep >= 0) {
      this.hashLo ^= ZE_LO[this.ep & 7];
      this.hashHi ^= ZE_HI[this.ep & 7];
    }
    this.hashLo ^= ZC_LO[this.castle];
    this.hashHi ^= ZC_HI[this.castle];

    let captured = 0;
    if (fl & F_EP) {
      const cs = to - side * 16;
      captured = b[cs];
      b[cs] = 0;
      this.xp(captured, cs);
    } else if (fl & F_CAP) {
      captured = b[to];
      this.xp(captured, to);
    }
    this.stCap[i] = captured;
    b[from] = 0;
    this.xp(piece, from);
    const placed = promo ? side * promo : piece;
    b[to] = placed;
    this.xp(placed, to);
    if (fl & F_CASTLE) {
      const rf = to > from ? to + 1 : to - 2;
      const rt = to > from ? to - 1 : to + 1;
      const rook = b[rf];
      b[rf] = 0;
      b[rt] = rook;
      this.xp(rook, rf);
      this.xp(rook, rt);
    }
    const t = piece * side;
    if (t === K) this.kings[side > 0 ? 0 : 1] = to;
    this.castle &= CR[from] & CR[to];
    this.ep = fl & F_DBL ? from + side * 16 : -1;
    this.half = t === P || captured ? 0 : this.half + 1;
    this.hashLo ^= ZC_LO[this.castle] ^ ZSIDE_LO;
    this.hashHi ^= ZC_HI[this.castle] ^ ZSIDE_HI;
    if (this.ep >= 0) {
      this.hashLo ^= ZE_LO[this.ep & 7];
      this.hashHi ^= ZE_HI[this.ep & 7];
    }
    this.side = -side;
    if (this.attacked(this.kings[side > 0 ? 0 : 1], -side)) {
      this.unmake(m);
      return false;
    }
    return true;
  }

  unmake(m: number) {
    const b = this.b;
    const from = m & 127;
    const to = (m >> 7) & 127;
    const promo = (m >> 14) & 7;
    const fl = (m >> 17) & 15;
    const i = --this.n;
    this.side = -this.side;
    const side = this.side;
    const captured = this.stCap[i];
    const moved = promo ? side * P : b[to];
    b[from] = moved;
    if (fl & F_EP) {
      b[to] = 0;
      b[to - side * 16] = captured;
    } else {
      b[to] = captured;
    }
    if (fl & F_CASTLE) {
      const rf = to > from ? to + 1 : to - 2;
      const rt = to > from ? to - 1 : to + 1;
      b[rf] = b[rt];
      b[rt] = 0;
    }
    if (Math.abs(moved) === K) this.kings[side > 0 ? 0 : 1] = from;
    this.castle = this.stCastle[i];
    this.ep = this.stEp[i];
    this.half = this.stHalf[i];
    this.hashLo = this.stLo[i];
    this.hashHi = this.stHi[i];
  }

  /** Lances legais (ordem de geração). */
  legalMoves(): number[] {
    const buf = new Int32Array(256);
    const n = this.gen(buf);
    const res: number[] = [];
    for (let i = 0; i < n; i++) {
      if (this.make(buf[i])) {
        this.unmake(buf[i]);
        res.push(buf[i]);
      }
    }
    return res;
  }

  perft(depth: number): number {
    if (depth === 0) return 1;
    const buf = new Int32Array(256);
    const n = this.gen(buf);
    let total = 0;
    for (let i = 0; i < n; i++) {
      if (!this.make(buf[i])) continue;
      total += depth === 1 ? 1 : this.perft(depth - 1);
      this.unmake(buf[i]);
    }
    return total;
  }
}
