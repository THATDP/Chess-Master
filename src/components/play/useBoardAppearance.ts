import { useMemo } from 'react';
import { ANIMATION_MS, useSettings } from '../../lib/settings';
import type { BoardAppearance } from '../Board';

export function useBoardAppearance(): BoardAppearance {
  const s = useSettings();
  return useMemo(
    () => ({
      pieceSet: s.pieceSet,
      boardTheme: s.boardTheme,
      showLegalMoves: s.showLegalMoves,
      showCoordinates: s.showCoordinates,
      highlightLastMove: s.highlightLastMove,
      animationMs: ANIMATION_MS[s.animationSpeed],
      autoQueen: s.autoQueen,
    }),
    [s.pieceSet, s.boardTheme, s.showLegalMoves, s.showCoordinates, s.highlightLastMove, s.animationSpeed, s.autoQueen],
  );
}
