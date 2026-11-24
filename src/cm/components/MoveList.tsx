import type { Move } from 'chess.js';
import { useEffect, useRef } from 'react';
import { cn } from '../utils/cn';
import { useUi } from '../lib/prefs';
import { IconChevronLeft, IconChevronRight, IconSkipBack, IconSkipForward } from './icons';

/** Histórico de lances em SAN, clicável (navega pelas posições). */
export function MoveList({
  history,
  viewPly,
  onSelect,
  className,
}: {
  history: Move[];
  viewPly: number;
  onSelect: (ply: number) => void;
  className?: string;
}) {
  const notation = useUi().notation;
  const activeRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = boxRef.current;
    const el = activeRef.current;
    if (!box || !el) return;
    const top = el.offsetTop - box.offsetTop;
    if (top < box.scrollTop || top + el.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTop = top - box.clientHeight / 2;
    }
  }, [viewPly, history.length]);

  const rows: { n: number; w?: Move; b?: Move; wPly: number }[] = [];
  history.forEach((m, i) => {
    const n = Math.floor(i / 2) + 1;
    if (i % 2 === 0) rows.push({ n, w: m, wPly: i + 1 });
    else rows[rows.length - 1].b = m;
  });

  const cell = (m: Move | undefined, ply: number) =>
    m ? (
      <button
        ref={viewPly === ply ? activeRef : undefined}
        onClick={() => onSelect(ply)}
        data-ply={ply}
        className={cn(
          'cursor-pointer rounded-md px-2 py-1 text-left font-mono text-[13px] transition-colors',
          viewPly === ply ? 'bg-accent text-accent-ink font-semibold' : 'hover:bg-surface2',
        )}
      >
        {notation === 'uci' ? m.lan : m.san}
      </button>
    ) : (
      <span />
    );

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div ref={boxRef} className="relative min-h-[110px] flex-1 overflow-y-auto pr-1" data-testid="move-list">
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">Os lances aparecerão aqui.</p>
        ) : (
          <div className="grid grid-cols-[2.2rem_1fr_1fr] items-center gap-y-0.5">
            {rows.map((r) => (
              <div key={r.n} className="contents">
                <span className="pl-1 font-mono text-xs text-muted">{r.n}.</span>
                {cell(r.w, r.wPly)}
                {cell(r.b, r.wPly + 1)}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center justify-center gap-1.5 border-t border-line pt-3">
        {[
          { icon: <IconSkipBack size={16} />, label: 'Início', go: 0, off: viewPly === 0 },
          { icon: <IconChevronLeft size={16} />, label: 'Lance anterior', go: viewPly - 1, off: viewPly === 0 },
          { icon: <IconChevronRight size={16} />, label: 'Próximo lance', go: viewPly + 1, off: viewPly >= history.length },
          { icon: <IconSkipForward size={16} />, label: 'Última posição', go: history.length, off: viewPly >= history.length },
        ].map((b) => (
          <button
            key={b.label}
            aria-label={b.label}
            title={b.label}
            disabled={b.off}
            onClick={() => onSelect(b.go)}
            className="grid h-9 w-11 cursor-pointer place-items-center rounded-lg border border-line bg-surface2 text-ink transition hover:border-accent/60 disabled:cursor-default disabled:opacity-35"
          >
            {b.icon}
          </button>
        ))}
      </div>
    </div>
  );
}
