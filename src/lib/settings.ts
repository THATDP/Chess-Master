import {
  CHESSJS_AI_ID,
  STOCKFISH_ID,
  defaultSettingsFor,
  getEngineDescriptor,
  getDefaultEngineId,
  sanitizeSettings,
  type EngineSettings,
} from '../engines';
import { TIME_CONTROLS } from '../game/timeControls';
import { createPersistedStore } from './persisted';

export type ThemeMode = 'dark' | 'light';
export type PieceSetId = 'cburnett' | 'merida' | 'glyph';
export type BoardThemeId = 'emerald' | 'walnut' | 'ice' | 'slate' | 'rose';
export type AnimationSpeed = 'off' | 'fast' | 'normal' | 'slow';
export type ColorChoice = 'white' | 'black' | 'random';

export interface Settings {
  theme: ThemeMode;
  pieceSet: PieceSetId;
  boardTheme: BoardThemeId;
  animationSpeed: AnimationSpeed;
  sound: boolean;
  volume: number;
  showLegalMoves: boolean;
  showCoordinates: boolean;
  highlightLastMove: boolean;
  autoQueen: boolean;
  allowUndo: boolean;
  showEval: boolean;
  playerColor: ColorChoice;
  timeControlId: string;
  opponentId: string;
  /** Configurações por engine (nível, profundidade, tempo...). */
  engineSettings: Record<string, EngineSettings>;
}

export const PIECE_SETS: { id: PieceSetId; label: string; credit: string }[] = [
  { id: 'cburnett', label: 'Clássico', credit: 'Cburnett (GPLv2+/BSD)' },
  { id: 'merida', label: 'Merida', credit: 'Merida (GPLv2+)' },
  { id: 'glyph', label: 'Tipográfico', credit: 'Glifos Unicode' },
];

export const BOARD_THEMES: { id: BoardThemeId; label: string; light: string; dark: string }[] = [
  { id: 'emerald', label: 'Esmeralda', light: '#ebecd0', dark: '#739552' },
  { id: 'walnut', label: 'Nogueira', light: '#f0d9b5', dark: '#b58863' },
  { id: 'ice', label: 'Gelo', light: '#dee3e6', dark: '#8ca2ad' },
  { id: 'slate', label: 'Ardósia', light: '#c9ccd6', dark: '#5d6784' },
  { id: 'rose', label: 'Rosé', light: '#f3e0dc', dark: '#c0837e' },
];

export const ANIMATION_MS: Record<AnimationSpeed, number> = { off: 0, fast: 120, normal: 220, slow: 420 };

export function defaultSettings(): Settings {
  const engineSettings: Record<string, EngineSettings> = {};
  for (const id of [STOCKFISH_ID, CHESSJS_AI_ID]) {
    const d = getEngineDescriptor(id);
    if (d) engineSettings[id] = defaultSettingsFor(d);
  }
  return {
    theme: 'dark',
    pieceSet: 'cburnett',
    boardTheme: 'emerald',
    animationSpeed: 'normal',
    sound: true,
    volume: 0.6,
    showLegalMoves: true,
    showCoordinates: true,
    highlightLastMove: true,
    autoQueen: false,
    allowUndo: true,
    showEval: true,
    playerColor: 'white',
    timeControlId: 'unlimited',
    opponentId: STOCKFISH_ID,
    engineSettings,
  };
}

const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T =>
  typeof v === 'string' && (options as readonly string[]).includes(v) ? (v as T) : fallback;
const bool = (v: unknown, fb: boolean) => (typeof v === 'boolean' ? v : fb);

/** Normaliza qualquer valor lido do localStorage. */
export function sanitizeSettingsObject(raw: unknown): Settings {
  const d = defaultSettings();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, unknown>;
  const engineSettings: Record<string, EngineSettings> = { ...d.engineSettings };
  const rawEs = (r.engineSettings ?? {}) as Record<string, unknown>;
  for (const id of Object.keys(engineSettings)) {
    const desc = getEngineDescriptor(id);
    if (desc) engineSettings[id] = sanitizeSettings(desc, rawEs[id]);
  }
  const opponentId =
    typeof r.opponentId === 'string' && getEngineDescriptor(r.opponentId) ? r.opponentId : getDefaultEngineId();
  const vol = typeof r.volume === 'number' && Number.isFinite(r.volume) ? Math.min(1, Math.max(0, r.volume)) : d.volume;
  return {
    theme: oneOf(r.theme, ['dark', 'light'] as const, d.theme),
    pieceSet: oneOf(r.pieceSet, PIECE_SETS.map((p) => p.id), d.pieceSet),
    boardTheme: oneOf(r.boardTheme, BOARD_THEMES.map((b) => b.id), d.boardTheme),
    animationSpeed: oneOf(r.animationSpeed, ['off', 'fast', 'normal', 'slow'] as const, d.animationSpeed),
    sound: bool(r.sound, d.sound),
    volume: vol,
    showLegalMoves: bool(r.showLegalMoves, d.showLegalMoves),
    showCoordinates: bool(r.showCoordinates, d.showCoordinates),
    highlightLastMove: bool(r.highlightLastMove, d.highlightLastMove),
    autoQueen: bool(r.autoQueen, d.autoQueen),
    allowUndo: bool(r.allowUndo, d.allowUndo),
    showEval: bool(r.showEval, d.showEval),
    playerColor: oneOf(r.playerColor, ['white', 'black', 'random'] as const, d.playerColor),
    timeControlId: oneOf(r.timeControlId, TIME_CONTROLS.map((t) => t.id), d.timeControlId),
    opponentId,
    engineSettings,
  };
}

export const SETTINGS_KEY = 'chessmaster.settings.v1';
export const settingsStore = createPersistedStore<Settings>(SETTINGS_KEY, defaultSettings, sanitizeSettingsObject);
export const useSettings = () => settingsStore.use();
export const updateSettings = (patch: Partial<Settings>) => settingsStore.set((s) => ({ ...s, ...patch }));

export function updateEngineSettings(engineId: string, values: EngineSettings) {
  settingsStore.set((s) => ({ ...s, engineSettings: { ...s.engineSettings, [engineId]: values } }));
}
