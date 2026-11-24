import type { Color, PieceSymbol } from 'chess.js';
import { useEffect, useState } from 'react';
import type { ChessClock } from '../game/clock';
import { formatClock } from '../game/timeControls';
import type { PieceSetId } from '../lib/settings';
import { cn } from '../utils/cn';
import { IconCpu, IconUsers } from './icons';
import { PieceIcon } from './pieces';

/** Atualiza ~10x/s apenas quando o relógio está ativo. */
export function useClockValue(clock: ChessClock, color: Color, enabled: boolean) {
  const [ms, setMs] = useState(() => clock.get(color));
  useEffect(() => {
    setMs(clock.get(color));
    if (!enabled) return;
    const id = setInterval(() => setMs(clock.get(color)), 100);
    return () => clearInterval(id);
  }, [clock, color, enabled]);
  return ms;
}

export function PlayerCard({
  name,
  subtitle,
  color,
  isEngine,
  active,
  clock,
  clockEnabled,
  captured,
  advantage,
  pieceSet,
  thinking,
  clockKey,
}: {
  name: string;
  subtitle?: string;
  color: Color;
  isEngine: boolean;
  active: boolean;
  clock: ChessClock;
  clockEnabled: boolean;
  /** Peças do adversário capturadas por este jogador. */
  captured: PieceSymbol[];
  advantage: number;
  pieceSet: PieceSetId;
  thinking?: boolean;
  /** Muda quando o objeto de relógio é substituído. */
  clockKey: number;
}) {
  const ms = useClockValue(clock, color, clockEnabled);
  const low = clockEnabled && ms < 20_000;
  const capturedColor: Color = color === 'w' ? 'b' : 'w';
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border bg-surface/80 px-3 py-2 transition-colors',
        active ? 'border-accent/50' : 'border-line',
      )}
      data-testid={`player-${color}`}
      data-clock-key={clockKey}
    >
      <div
        className={cn(
          'grid h-10 w-10 shrink-0 place-items-center rounded-lg',
          color === 'w' ? 'bg-[#efe9da] text-[#1b1b1b]' : 'bg-[#23262f] text-[#efe9da]',
          'border border-line',
        )}
      >
        {isEngine ? <IconCpu size={20} /> : <IconUsers size={20} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">{name}</span>
          {thinking && (
            <span className="inline-flex items-center gap-1 text-[11px] text-accent">
              <span className="think-dot" />
              <span className="think-dot" />
              <span className="think-dot" />
            </span>
          )}
        </div>
        <div className="flex h-5 items-center gap-2 text-xs text-muted">
          {subtitle && <span className="truncate">{subtitle}</span>}
          <span className="flex items-center pl-1">
            {captured.map((t, i) => (
              <PieceIcon key={i} set={pieceSet} color={capturedColor} type={t} size={16} />
            ))}
          </span>
          {advantage > 0 && <span className="ml-3 font-mono text-[11px] font-semibold text-ink/80">+{advantage}</span>}
        </div>
      </div>
      {clockEnabled && (
        <div
          className={cn(
            'min-w-[84px] rounded-lg px-3 py-1.5 text-center font-mono text-xl font-semibold tabular-nums transition-colors',
            active ? 'bg-accent text-accent-ink' : 'bg-surface2 text-ink',
            low && active && 'bg-bad text-white',
            low && !active && 'text-bad',
          )}
          aria-label={`Relógio ${color === 'w' ? 'das brancas' : 'das pretas'}`}
          data-testid={`clock-${color}`}
        >
          {formatClock(ms)}
        </div>
      )}
    </div>
  );
}
