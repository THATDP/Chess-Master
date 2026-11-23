import { useSyncExternalStore } from 'react';
import { getEngineDescriptor, sanitizeSettings } from '../engines';
import { upsertGame, type SavedGame } from '../lib/history';
import { settingsStore, type ColorChoice } from '../lib/settings';
import { playSound } from '../lib/sound';
import { GameController, type GameConfig, type GameView } from './GameController';
import { parsePgn } from './pgn';
import { UNLIMITED, getTimeControl } from './timeControls';

/** Controlador único da aplicação (a partida sobrevive à navegação entre telas). */
export const gameController = new GameController({
  sound: (k) => {
    const s = settingsStore.get();
    if (s.sound) playSound(k, s.volume);
  },
  onSave: upsertGame,
  minEngineDelayMs: 350,
});

if (typeof window !== 'undefined') {
  // Garante que partidas em andamento fiquem salvas ao fechar/atualizar a página.
  window.addEventListener('pagehide', () => gameController.persist());
}

export function useGameView(): GameView {
  return useSyncExternalStore(gameController.subscribe, gameController.getView, gameController.getView);
}

export function levelLabelFor(engineId: string, levelId: unknown): string {
  const d = getEngineDescriptor(engineId);
  if (levelId === 'custom') return 'Personalizado';
  return d?.levels.find((l) => l.id === levelId)?.label ?? String(levelId ?? '');
}

const pickColor = (c: ColorChoice): 'w' | 'b' => (c === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : c === 'white' ? 'w' : 'b');

/** Inicia uma partida com as preferências atuais (adversário, cor, relógio). */
export function startConfiguredGame(overrides: Partial<GameConfig> = {}) {
  const s = settingsStore.get();
  const d = getEngineDescriptor(s.opponentId);
  if (!d) throw new Error('Adversário indisponível.');
  const settings = sanitizeSettings(d, s.engineSettings[d.id]);
  gameController.start({
    engineId: d.id,
    engineName: d.name,
    levelLabel: levelLabelFor(d.id, settings.level),
    engineSettings: settings,
    playerColor: pickColor(s.playerColor),
    timeControl: getTimeControl(s.timeControlId),
    ...overrides,
  });
}

/** Retoma uma partida salva (continua contra o mesmo adversário, sem relógio). */
export function resumeSavedGame(g: SavedGame) {
  const parsed = parsePgn(g.pgn);
  const s = settingsStore.get();
  const id = g.opponentId && getEngineDescriptor(g.opponentId) ? g.opponentId : s.opponentId;
  const d = getEngineDescriptor(id)!;
  const settings = sanitizeSettings(d, s.engineSettings[id]);
  gameController.start({
    engineId: id,
    engineName: d.name,
    levelLabel: g.opponentLevel ?? levelLabelFor(id, settings.level),
    engineSettings: settings,
    playerColor: g.playerColor ?? (parsed.chess.turn() === 'w' ? 'w' : 'b'),
    timeControl: UNLIMITED,
    startPgn: g.pgn,
    savedId: g.id,
  });
}

if (typeof window !== 'undefined') {
  // Útil para depuração e testes ponta a ponta no navegador.
  (window as unknown as { __chessMaster: unknown }).__chessMaster = { gameController };
}
