import type { Color } from 'chess.js';
import type { EngineInfo } from '../engines/types';
import { evalFraction, formatEval } from '../lib/format';

/** Barra vertical de avaliação (perspectiva das brancas; vira com o tabuleiro). */
export function EvalBar({ info, orientation }: { info: EngineInfo | null; orientation: Color }) {
  const frac = evalFraction(info);
  const full = formatEval(info);
  const label = full && info?.mate === undefined ? (Math.abs(info?.cp ?? 0) >= 1000 ? full.replace(/\.\d+$/, '') : (info!.cp! / 100 > 0 ? '+' : '') + (info!.cp! / 100).toFixed(1)) : full;
  const whiteOnBottom = orientation === 'w';
  const whitePct = `${(frac * 100).toFixed(1)}%`;
  const whiteWinning = frac >= 0.5;
  return (
    <div
      className="relative h-full w-6 shrink-0 overflow-hidden rounded-md border border-line bg-[#2b2b2b] sm:w-7"
      role="meter"
      aria-label="Avaliação da posição"
      aria-valuetext={full ?? 'sem avaliação'}
      title={full ? `Avaliação: ${full}` : 'Sem avaliação ainda'}
      data-testid="eval-bar"
    >
      <div
        className="eval-fill absolute inset-x-0 bg-[#f1ede4]"
        style={{ height: whitePct, [whiteOnBottom ? 'bottom' : 'top']: 0 }}
      />
      <span
        className="absolute inset-x-0 text-center font-mono text-[9px] font-bold leading-none"
        style={{
          [whiteWinning === whiteOnBottom ? 'bottom' : 'top']: 4,
          color: whiteWinning ? '#222' : '#eee',
        }}
      >
        {label ?? ''}
      </span>
    </div>
  );
}
