import type { GameResult } from '../game/status';
import { createPersistedStore } from './persisted';

export interface SavedGame {
  id: string;
  createdAt: number;
  pgn: string;
  white: string;
  black: string;
  result: GameResult;
  reason?: string;
  plies: number;
  finalFen: string;
  opponentId?: string;
  opponentName?: string;
  opponentLevel?: string;
  /** Cor do jogador humano (para continuar a partida). */
  playerColor?: 'w' | 'b';
  timeControlId?: string;
  imported?: boolean;
}

export const HISTORY_KEY = 'chessmaster.history.v1';
const MAX_GAMES = 300;

const str = (v: unknown, fb = '') => (typeof v === 'string' ? v : fb);

export function sanitizeHistory(raw: unknown): SavedGame[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedGame[] = [];
  for (const g of raw) {
    if (!g || typeof g !== 'object') continue;
    const r = g as Record<string, unknown>;
    if (typeof r.id !== 'string' || typeof r.pgn !== 'string') continue;
    const result = r.result === '1-0' || r.result === '0-1' || r.result === '1/2-1/2' ? r.result : '*';
    out.push({
      id: r.id,
      createdAt: typeof r.createdAt === 'number' ? r.createdAt : Date.now(),
      pgn: r.pgn,
      white: str(r.white, 'Brancas'),
      black: str(r.black, 'Pretas'),
      result,
      reason: typeof r.reason === 'string' ? r.reason : undefined,
      plies: typeof r.plies === 'number' ? r.plies : 0,
      finalFen: str(r.finalFen),
      opponentId: typeof r.opponentId === 'string' ? r.opponentId : undefined,
      opponentName: typeof r.opponentName === 'string' ? r.opponentName : undefined,
      opponentLevel: typeof r.opponentLevel === 'string' ? r.opponentLevel : undefined,
      playerColor: r.playerColor === 'w' || r.playerColor === 'b' ? r.playerColor : undefined,
      timeControlId: typeof r.timeControlId === 'string' ? r.timeControlId : undefined,
      imported: r.imported === true,
    });
  }
  return out;
}

export const historyStore = createPersistedStore<SavedGame[]>(HISTORY_KEY, () => [], sanitizeHistory);
export const useHistory = () => historyStore.use();

export const newId = () => `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

/** Insere ou atualiza (por id) uma partida; mais recentes primeiro. */
export function upsertGame(game: SavedGame) {
  historyStore.set((list) => {
    const rest = list.filter((g) => g.id !== game.id);
    const existing = list.find((g) => g.id === game.id);
    return [{ ...game, createdAt: existing?.createdAt ?? game.createdAt }, ...rest]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, MAX_GAMES);
  });
}

export function removeGame(id: string) {
  historyStore.set((list) => list.filter((g) => g.id !== id));
}

export function clearHistory() {
  historyStore.set([]);
}

export const getGame = (id: string) => historyStore.get().find((g) => g.id === id);
