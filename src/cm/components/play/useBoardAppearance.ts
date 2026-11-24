import { useMemo } from 'react';
import { useUi } from '../../lib/prefs';
import { ANIMATION_MS, useSettings } from '../../lib/settings';
import type { BoardAppearance } from '../Board';

export function useBoardAppearance(): BoardAppearance {
  const s = useSettings();
  const ui = useUi();
  const noAnim = ui.lowPerf || ui.animation === 'off' || ui.motion === 'reduce';
  return useMemo(
    () => ({
      pieceSet: s.pieceSet,
      boardTheme: s.boardTheme,
      showLegalMoves: s.showLegalMoves,
      showCoordinates: s.showCoordinates,
      highlightLastMove: s.highlightLastMove,
      animationMs: noAnim ? 0 : ANIMATION_MS[s.animationSpeed],
      autoQueen: s.autoQueen,
    }),
    [s.pieceSet, s.boardTheme, s.showLegalMoves, s.showCoordinates, s.highlightLastMove, s.animationSpeed, s.autoQueen, noAnim],
  );
}
