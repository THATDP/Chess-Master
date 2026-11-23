import type { PieceSymbol } from 'chess.js';

const VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const INITIAL: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };
const ORDER: PieceSymbol[] = ['q', 'r', 'b', 'n', 'p'];

export interface MaterialInfo {
  /** Peças capturadas POR cada lado (isto é, peças do adversário que ele tem fora do tabuleiro). */
  capturedByWhite: PieceSymbol[];
  capturedByBlack: PieceSymbol[];
  /** Diferença de material (positivo = vantagem das brancas). */
  diff: number;
}

/** Calcula peças capturadas e vantagem material a partir do FEN (considera promoções). */
export function materialFromFen(fen: string): MaterialInfo {
  const placement = fen.split(' ')[0];
  const count = { w: {} as Record<string, number>, b: {} as Record<string, number> };
  for (const ch of placement) {
    if (/[pnbrqPNBRQ]/.test(ch)) {
      const color = ch === ch.toUpperCase() ? 'w' : 'b';
      const t = ch.toLowerCase();
      count[color][t] = (count[color][t] ?? 0) + 1;
    }
  }
  const missing = (color: 'w' | 'b') => {
    const out: PieceSymbol[] = [];
    for (const t of ORDER) {
      const n = Math.max(0, INITIAL[t] - (count[color][t] ?? 0));
      for (let i = 0; i < n; i++) out.push(t);
    }
    return out;
  };
  const score = (color: 'w' | 'b') =>
    Object.entries(count[color]).reduce((s, [t, n]) => s + (VALUES[t] ?? 0) * n, 0);
  return {
    capturedByWhite: missing('b'),
    capturedByBlack: missing('w'),
    diff: score('w') - score('b'),
  };
}
