import type { Color, Move, PieceSymbol } from 'chess.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LastMoveView } from '../game/GameController';
import { BOARD_THEMES, type BoardThemeId, type PieceSetId } from '../lib/settings';
import { Piece } from './pieces';

const FILES = 'abcdefgh';

export interface BoardAppearance {
  pieceSet: PieceSetId;
  boardTheme: BoardThemeId;
  showLegalMoves: boolean;
  showCoordinates: boolean;
  highlightLastMove: boolean;
  animationMs: number;
  autoQueen: boolean;
}

export interface BoardProps {
  fen: string;
  orientation: Color;
  /** Lances legais do jogador (vazio = tabuleiro somente leitura). */
  legalMoves: Move[];
  lastMove: LastMoveView | null;
  checkSquare: string | null;
  appearance: BoardAppearance;
  onMove: (from: string, to: string, promotion: PieceSymbol | undefined, source: 'drag' | 'click') => void;
  label?: string;
}

interface PieceOnBoard {
  square: string;
  color: Color;
  type: PieceSymbol;
}

function parseFen(fen: string): PieceOnBoard[] {
  const out: PieceOnBoard[] = [];
  const rows = fen.split(' ')[0].split('/');
  rows.forEach((row, i) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) f += Number(ch);
      else {
        out.push({
          square: FILES[f] + (8 - i),
          color: ch === ch.toUpperCase() ? 'w' : 'b',
          type: ch.toLowerCase() as PieceSymbol,
        });
        f++;
      }
    }
  });
  return out;
}

const fileIdx = (sq: string) => sq.charCodeAt(0) - 97;
const rankIdx = (sq: string) => Number(sq[1]) - 1;

/** Posição em colunas/linhas da tela (0..7), considerando a orientação. */
function screenPos(sq: string, o: Color) {
  const f = fileIdx(sq);
  const r = rankIdx(sq);
  return o === 'w' ? { col: f, row: 7 - r } : { col: 7 - f, row: r };
}

function squareAt(col: number, row: number, o: Color): string {
  const f = o === 'w' ? col : 7 - col;
  const r = o === 'w' ? 7 - row : row;
  return FILES[f] + (r + 1);
}

interface PendingPromotion {
  from: string;
  to: string;
  color: Color;
  source: 'drag' | 'click';
}

export function Board({ fen, orientation, legalMoves, lastMove, checkSquare, appearance, onMove, label }: BoardProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<string | null>(null);
  const [hoverSq, setHoverSq] = useState<string | null>(null);
  const [promo, setPromo] = useState<PendingPromotion | null>(null);
  const press = useRef<{ from: string; x: number; y: number; id: number; active: boolean; wasSelected: boolean } | null>(
    null,
  );

  const theme = BOARD_THEMES.find((t) => t.id === appearance.boardTheme) ?? BOARD_THEMES[0];
  const pieces = useMemo(() => parseFen(fen), [fen]);
  const pieceAt = useMemo(() => new Map(pieces.map((p) => [p.square, p])), [pieces]);

  const dests = useMemo(() => {
    const m = new Map<string, Move[]>();
    for (const mv of legalMoves) {
      const arr = m.get(mv.from);
      if (arr) arr.push(mv);
      else m.set(mv.from, [mv]);
    }
    return m;
  }, [legalMoves]);

  // Qualquer mudança de posição/vez limpa seleção e promoção pendente.
  useEffect(() => {
    setSelected(null);
    setPromo(null);
    setDragFrom(null);
    press.current = null;
  }, [fen, legalMoves.length === 0]);

  const squareFromPoint = useCallback(
    (clientX: number, clientY: number): string | null => {
      const el = rootRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const x = (clientX - rect.left) / rect.width;
      const y = (clientY - rect.top) / rect.height;
      if (x < 0 || x >= 1 || y < 0 || y >= 1) return null;
      return squareAt(Math.floor(x * 8), Math.floor(y * 8), orientation);
    },
    [orientation],
  );

  const attempt = useCallback(
    (from: string, to: string, source: 'drag' | 'click') => {
      const options = (dests.get(from) ?? []).filter((m) => m.to === to);
      if (options.length === 0) return false;
      const needsPromo = options.some((m) => m.promotion);
      setSelected(null);
      if (needsPromo) {
        if (appearance.autoQueen) {
          onMove(from, to, 'q', source);
        } else {
          setPromo({ from, to, color: options[0].color, source });
        }
        return true;
      }
      onMove(from, to, undefined, source);
      return true;
    },
    [dests, onMove, appearance.autoQueen],
  );

  const moveGhost = (x: number, y: number) => {
    const g = ghostRef.current;
    const el = rootRef.current;
    if (!g || !el) return;
    const size = el.getBoundingClientRect().width / 8;
    g.style.width = `${size}px`;
    g.style.height = `${size}px`;
    g.style.transform = `translate(${x - size / 2}px, ${y - size / 2}px)`;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (promo || e.button > 0) return;
    const sq = squareFromPoint(e.clientX, e.clientY);
    if (!sq) return;
    if (selected && selected !== sq && (dests.get(selected) ?? []).some((m) => m.to === sq)) {
      attempt(selected, sq, 'click');
      return;
    }
    if (dests.has(sq)) {
      press.current = { from: sq, x: e.clientX, y: e.clientY, id: e.pointerId, active: false, wasSelected: selected === sq };
      setSelected(sq);
      try {
        rootRef.current?.setPointerCapture(e.pointerId);
      } catch {
        /* ignora */
      }
    } else {
      setSelected(null);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const p = press.current;
    if (!p) return;
    if (!p.active && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 5) {
      p.active = true;
      setDragFrom(p.from);
    }
    if (p.active) {
      moveGhost(e.clientX, e.clientY);
      const sq = squareFromPoint(e.clientX, e.clientY);
      const ok = sq && (dests.get(p.from) ?? []).some((m) => m.to === sq);
      setHoverSq(ok ? sq : null);
    }
  };

  const endPress = (e: React.PointerEvent, cancelled: boolean) => {
    const p = press.current;
    if (!p) return;
    press.current = null;
    try {
      rootRef.current?.releasePointerCapture(p.id);
    } catch {
      /* ignora */
    }
    setHoverSq(null);
    if (p.active) {
      setDragFrom(null);
      if (!cancelled) {
        const sq = squareFromPoint(e.clientX, e.clientY);
        if (sq && sq !== p.from) attempt(p.from, sq, 'drag');
      }
    } else if (p.wasSelected && !cancelled) {
      setSelected(null);
    }
  };

  // Animação do último lance (peça movida + torre no roque)
  const anims = useMemo(() => {
    const map = new Map<string, { dx: number; dy: number }>();
    if (!lastMove || !lastMove.animate || appearance.animationMs <= 0) return map;
    const add = (from: string, to: string) => {
      const a = screenPos(from, orientation);
      const b = screenPos(to, orientation);
      map.set(to, { dx: (a.col - b.col) * 100, dy: (a.row - b.row) * 100 });
    };
    add(lastMove.move.from, lastMove.move.to);
    if (lastMove.move.isKingsideCastle() || lastMove.move.isQueensideCastle()) {
      const rank = lastMove.move.color === 'w' ? '1' : '8';
      if (lastMove.move.isKingsideCastle()) add(`h${rank}`, `f${rank}`);
      else add(`a${rank}`, `d${rank}`);
    }
    return map;
  }, [lastMove, orientation, appearance.animationMs]);

  const selectedDests = selected ? (dests.get(selected) ?? []) : [];
  const destSet = new Map<string, Move>(selectedDests.map((m) => [m.to as string, m]));
  const dragPiece = dragFrom ? pieceAt.get(dragFrom) : undefined;

  const squares = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const sq = squareAt(col, row, orientation);
      const isLight = (fileIdx(sq) + rankIdx(sq)) % 2 === 1;
      const bg = isLight ? `var(--cm-board-light, ${theme.light})` : `var(--cm-board-dark, ${theme.dark})`;
      const fg = isLight ? theme.dark : theme.light;
      const classes = ['sq'];
      if (appearance.highlightLastMove && lastMove && (sq === lastMove.move.from || sq === lastMove.move.to))
        classes.push('sq-hl-last');
      if (selected === sq) classes.push('sq-hl-sel');
      if (checkSquare === sq) classes.push('sq-check');
      if (appearance.showLegalMoves && destSet.has(sq)) classes.push(pieceAt.has(sq) || destSet.get(sq)?.isEnPassant() ? 'sq-cap' : 'sq-dot');
      if (hoverSq === sq) classes.push('sq-hover-target');
      squares.push(
        <div key={sq} className={classes.join(' ')} style={{ background: bg, color: fg }} data-square={sq}>
          {appearance.showCoordinates && col === 0 && <span className="coord coord-rank">{sq[1]}</span>}
          {appearance.showCoordinates && row === 7 && <span className="coord coord-file">{sq[0]}</span>}
        </div>,
      );
    }
  }

  const promoPos = promo ? screenPos(promo.to, orientation) : null;
  const promoTop = promoPos ? promoPos.row < 4 : true;
  const promoOrder: PieceSymbol[] = promoTop ? ['q', 'n', 'r', 'b'] : ['b', 'r', 'n', 'q'];

  return (
    <div
      ref={rootRef}
      className="board"
      role="application"
      aria-label={label ?? 'Tabuleiro de xadrez'}
      data-testid="board"
      data-orientation={orientation}
      style={{ cursor: dests.size ? 'pointer' : 'default', ['--anim' as string]: `${appearance.animationMs}ms` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => endPress(e, false)}
      onPointerCancel={(e) => endPress(e, true)}
    >
      <div className="board-grid">{squares}</div>

      {pieces.map((p) => {
        const pos = screenPos(p.square, orientation);
        const anim = anims.get(p.square);
        const style: React.CSSProperties = {
          left: `${pos.col * 12.5}%`,
          top: `${pos.row * 12.5}%`,
        };
        if (anim) {
          (style as Record<string, string>)['--dx'] = `${anim.dx}%`;
          (style as Record<string, string>)['--dy'] = `${anim.dy}%`;
        }
        return (
          <Piece
            key={`${p.square}${p.color}${p.type}`}
            set={appearance.pieceSet}
            color={p.color}
            type={p.type}
            className={`${anim ? 'piece-anim' : ''} ${dragFrom === p.square ? 'piece-dragging' : ''}`}
            style={style}
          />
        );
      })}

      {promo && promoPos && (
        <>
          <div className="promo-backdrop" onPointerDown={(e) => { e.stopPropagation(); setPromo(null); }} />
          <div
            className="promo-panel"
            style={{ left: `${promoPos.col * 12.5}%`, [promoTop ? 'top' : 'bottom']: 0 }}
            onPointerDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Escolha a peça de promoção"
          >
            {promoOrder.map((t) => (
              <button
                key={t}
                aria-label={`Promover para ${t}`}
                data-promo={t}
                onClick={() => {
                  onMove(promo.from, promo.to, t, promo.source);
                  setPromo(null);
                }}
              >
                <Piece set={appearance.pieceSet} color={promo.color} type={t} />
              </button>
            ))}
          </div>
        </>
      )}

      {dragPiece && (
        <div ref={ghostRef} className="drag-ghost" aria-hidden="true">
          <Piece set={appearance.pieceSet} color={dragPiece.color} type={dragPiece.type} />
        </div>
      )}
    </div>
  );
}
