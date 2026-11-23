import type { EngineInfo } from '../types';

/** Resultado do parser de linhas `info` (perspectiva de quem joga). */
export interface ParsedInfo {
  depth?: number;
  selDepth?: number;
  multipv?: number;
  cp?: number;
  mate?: number;
  bound?: 'lower' | 'upper';
  nodes?: number;
  nps?: number;
  timeMs?: number;
  pv?: string[];
}

const num = (s: string | undefined) => {
  if (s === undefined) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};

/** Interpreta uma linha `info ...` do protocolo UCI. */
export function parseInfoLine(line: string): ParsedInfo | null {
  if (!line.startsWith('info ')) return null;
  if (line.startsWith('info string')) return null;
  const t = line.trim().split(/\s+/);
  const out: ParsedInfo = {};
  for (let i = 1; i < t.length; i++) {
    switch (t[i]) {
      case 'depth':
        out.depth = num(t[++i]);
        break;
      case 'seldepth':
        out.selDepth = num(t[++i]);
        break;
      case 'multipv':
        out.multipv = num(t[++i]);
        break;
      case 'nodes':
        out.nodes = num(t[++i]);
        break;
      case 'nps':
        out.nps = num(t[++i]);
        break;
      case 'time':
        out.timeMs = num(t[++i]);
        break;
      case 'score': {
        const kind = t[++i];
        const v = num(t[++i]);
        if (kind === 'cp') out.cp = v;
        else if (kind === 'mate') out.mate = v;
        if (t[i + 1] === 'lowerbound') {
          out.bound = 'lower';
          i++;
        } else if (t[i + 1] === 'upperbound') {
          out.bound = 'upper';
          i++;
        }
        break;
      }
      case 'pv':
        out.pv = t.slice(i + 1);
        i = t.length;
        break;
      default:
        break;
    }
  }
  if (out.depth === undefined && out.cp === undefined && out.mate === undefined) return null;
  return out;
}

export interface ParsedBestMove {
  move: string | null;
  ponder?: string;
}

export function parseBestMove(line: string): ParsedBestMove | null {
  if (!line.startsWith('bestmove')) return null;
  const t = line.trim().split(/\s+/);
  const m = t[1];
  if (!m || m === '(none)' || m === '0000') return { move: null };
  const pi = t.indexOf('ponder');
  return { move: m, ponder: pi > 0 ? t[pi + 1] : undefined };
}

/** Converte "e7e8q" em partes. */
export function parseUciMove(uci: string) {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) return null;
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: (uci[4] as 'q' | 'r' | 'b' | 'n' | undefined) ?? undefined,
  };
}

/** UCI reporta a pontuação para quem joga; convertemos para as brancas. */
export function toWhitePerspective(info: ParsedInfo, whiteToMove: boolean): EngineInfo {
  const sign = whiteToMove ? 1 : -1;
  return {
    depth: info.depth,
    selDepth: info.selDepth,
    cp: info.cp !== undefined ? info.cp * sign : undefined,
    mate: info.mate !== undefined ? info.mate * sign : undefined,
    pv: info.pv,
    nodes: info.nodes,
    nps: info.nps,
    timeMs: info.timeMs,
  };
}
