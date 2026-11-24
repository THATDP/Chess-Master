import type { Chess, Color } from 'chess.js';

export type GameResult = '1-0' | '0-1' | '1/2-1/2' | '*';

export type GameReason =
  | 'checkmate'
  | 'stalemate'
  | 'threefold'
  | 'fifty-move'
  | 'insufficient'
  | 'timeout'
  | 'timeout-insufficient'
  | 'resignation';

export interface ForcedResult {
  result: GameResult;
  reason: GameReason;
}

export interface GameStatus {
  over: boolean;
  result: GameResult;
  reason?: GameReason;
  winner: Color | null;
  check: boolean;
  /** Título curto (ex.: "Xeque-mate"). */
  title: string;
  /** Detalhe (ex.: "Brancas vencem"). */
  detail: string;
}

export const REASON_LABEL: Record<GameReason, string> = {
  checkmate: 'Xeque-mate',
  stalemate: 'Afogamento',
  threefold: 'Tripla repetição',
  'fifty-move': 'Regra dos 50 lances',
  insufficient: 'Material insuficiente',
  timeout: 'Tempo esgotado',
  'timeout-insufficient': 'Tempo esgotado (material insuficiente)',
  resignation: 'Abandono',
};

const colorName = (c: Color) => (c === 'w' ? 'Brancas' : 'Pretas');

/** Determina o estado da partida usando exclusivamente o chess.js (+ resultado forçado). */
export function getGameStatus(chess: Chess, forced?: ForcedResult | null): GameStatus {
  const check = chess.inCheck();
  let result: GameResult = '*';
  let reason: GameReason | undefined;

  if (forced) {
    result = forced.result;
    reason = forced.reason;
  } else if (chess.isCheckmate()) {
    result = chess.turn() === 'w' ? '0-1' : '1-0';
    reason = 'checkmate';
  } else if (chess.isStalemate()) {
    result = '1/2-1/2';
    reason = 'stalemate';
  } else if (chess.isInsufficientMaterial()) {
    result = '1/2-1/2';
    reason = 'insufficient';
  } else if (chess.isThreefoldRepetition()) {
    result = '1/2-1/2';
    reason = 'threefold';
  } else if (chess.isDrawByFiftyMoves()) {
    result = '1/2-1/2';
    reason = 'fifty-move';
  } else if (chess.isDraw()) {
    result = '1/2-1/2';
    reason = 'insufficient';
  }

  const over = result !== '*';
  const winner: Color | null = result === '1-0' ? 'w' : result === '0-1' ? 'b' : null;
  let title = '';
  let detail = '';
  if (over) {
    title = reason ? REASON_LABEL[reason] : 'Fim de partida';
    detail = winner ? `${colorName(winner)} vencem` : 'Empate';
  } else if (check) {
    title = 'Xeque!';
    detail = `${colorName(chess.turn())} em xeque`;
  } else {
    title = 'Em andamento';
    detail = `Vez das ${colorName(chess.turn())}`;
  }
  return { over, result, reason, winner, check, title, detail };
}

/**
 * Resultado quando o tempo de `loser` acaba: derrota, exceto se o adversário
 * não tem material para dar mate (então é empate).
 */
export function timeoutResult(chess: Chess, loser: Color): ForcedResult {
  const opp: Color = loser === 'w' ? 'b' : 'w';
  if (!hasMatingMaterial(chess, opp)) return { result: '1/2-1/2', reason: 'timeout-insufficient' };
  return { result: loser === 'w' ? '0-1' : '1-0', reason: 'timeout' };
}

function hasMatingMaterial(chess: Chess, color: Color): boolean {
  let minors = 0;
  for (const row of chess.board()) {
    for (const p of row) {
      if (!p || p.color !== color) continue;
      if (p.type === 'p' || p.type === 'r' || p.type === 'q') return true;
      if (p.type === 'n' || p.type === 'b') minors++;
    }
  }
  return minors >= 2;
}

export const resultLabel = (r: GameResult) => (r === '*' ? 'Em andamento' : r === '1/2-1/2' ? '½–½' : r.replace('-', '–'));
