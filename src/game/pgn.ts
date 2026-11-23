import { Chess } from 'chess.js';
import type { GameResult } from './status';

export interface PgnMeta {
  white: string;
  black: string;
  result: GameResult;
  termination?: string;
  timeControl?: string;
  date?: Date;
  opponentId?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const pgnDate = (d: Date) => `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;

/** Gera PGN completo (cabeçalhos + lances em SAN) usando o chess.js. */
export function exportPgn(chess: Chess, meta: PgnMeta): string {
  const c = new Chess();
  c.loadPgn(chess.pgn());
  c.setHeader('Event', 'Partida Chess Master');
  c.setHeader('Site', 'Chess Master');
  c.setHeader('Date', pgnDate(meta.date ?? new Date()));
  c.setHeader('Round', '-');
  c.setHeader('White', meta.white);
  c.setHeader('Black', meta.black);
  c.setHeader('Result', meta.result);
  if (meta.timeControl) c.setHeader('TimeControl', meta.timeControl);
  if (meta.termination) c.setHeader('Termination', meta.termination);
  return c.pgn();
}

export interface ParsedGame {
  chess: Chess;
  pgn: string;
  headers: Record<string, string>;
  plies: number;
}

/** Lê um único PGN. Lança `Error` com mensagem amigável se for inválido. */
export function parsePgn(text: string): ParsedGame {
  const src = text.trim();
  if (!src) throw new Error('O PGN está vazio.');
  const chess = new Chess();
  try {
    chess.loadPgn(src);
  } catch (e) {
    throw new Error(`PGN inválido: ${(e as Error).message.split('\n')[0]}`);
  }
  const headers = chess.getHeaders() as Record<string, string>;
  return { chess, pgn: chess.pgn(), headers, plies: chess.history().length };
}

/** Separa arquivos PGN com várias partidas. */
export function splitPgnGames(text: string): string[] {
  const norm = text.replace(/\r\n?/g, '\n').trim();
  if (!norm) return [];
  const parts = norm.split(/\n\s*\n(?=\[Event\s)/);
  return parts.map((p) => p.trim()).filter(Boolean);
}

export function resultFromHeaders(h: Record<string, string>, chess: Chess): GameResult {
  const r = h.Result;
  if (r === '1-0' || r === '0-1' || r === '1/2-1/2') return r;
  if (chess.isCheckmate()) return chess.turn() === 'w' ? '0-1' : '1-0';
  if (chess.isDraw()) return '1/2-1/2';
  return '*';
}

/** Nome de arquivo seguro para exportação. */
export function pgnFileName(white: string, black: string, date = new Date()) {
  const slug = (s: string) => s.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
  return `${slug(white)}_vs_${slug(black)}_${pgnDate(date).replace(/\./g, '-')}.pgn`;
}
