import type { Color, PieceSymbol } from 'chess.js';
import type { PieceSetId } from '../lib/settings';

// As imagens são importadas como URL (inline no build) — nada depende de caminhos externos.
const files = import.meta.glob('../assets/pieces/*/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const GLYPHS: Record<PieceSymbol, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const NAMES: Record<PieceSymbol, string> = {
  k: 'rei',
  q: 'dama',
  r: 'torre',
  b: 'bispo',
  n: 'cavalo',
  p: 'peão',
};

export function pieceUrl(set: PieceSetId, color: Color, type: PieceSymbol): string | undefined {
  return files[`../assets/pieces/${set}/${color}${type.toUpperCase()}.svg`];
}

export const pieceName = (type: PieceSymbol) => NAMES[type];

export function Piece({
  set,
  color,
  type,
  className = '',
  style,
}: {
  set: PieceSetId;
  color: Color;
  type: PieceSymbol;
  className?: string;
  style?: React.CSSProperties;
}) {
  const url = set === 'glyph' ? undefined : pieceUrl(set, color, type);
  return (
    <div className={`piece ${className}`} style={style} data-piece={`${color}${type}`}>
      {url ? (
        <img src={url} alt="" draggable={false} />
      ) : (
        <span className={`piece-glyph ${color}`}>{GLYPHS[type]}</span>
      )}
    </div>
  );
}

/** Miniatura usada nas peças capturadas. */
export function PieceIcon({ set, color, type, size = 18 }: { set: PieceSetId; color: Color; type: PieceSymbol; size?: number }) {
  const url = set === 'glyph' ? undefined : pieceUrl(set, color, type);
  return url ? (
    <img src={url} alt="" width={size} height={size} draggable={false} style={{ width: size, height: size, marginRight: -size * 0.45 }} />
  ) : (
    <span style={{ fontSize: size, lineHeight: 1, marginRight: -size * 0.2, color: color === 'w' ? '#fdfaf2' : '#1c1914', WebkitTextStroke: color === 'w' ? '0.5px #2a2118' : '0.3px #7d7566' }}>
      {GLYPHS[type]}
    </span>
  );
}
