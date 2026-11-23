export interface TimeControl {
  id: string;
  label: string;
  category: 'Sem limite' | 'Bullet' | 'Blitz' | 'Rápida';
  initialMs: number;
  incrementMs: number;
}

const tc = (min: number, inc: number): TimeControl => ({
  id: `${min}+${inc}`,
  label: `${min}+${inc}`,
  category: min < 3 ? 'Bullet' : min < 10 ? 'Blitz' : 'Rápida',
  initialMs: min * 60_000,
  incrementMs: inc * 1000,
});

export const UNLIMITED: TimeControl = {
  id: 'unlimited',
  label: 'Sem limite',
  category: 'Sem limite',
  initialMs: Infinity,
  incrementMs: 0,
};

export const TIME_CONTROLS: TimeControl[] = [
  UNLIMITED,
  tc(1, 0),
  tc(3, 0),
  tc(3, 2),
  tc(5, 0),
  tc(5, 3),
  tc(10, 0),
  tc(15, 10),
];

export const getTimeControl = (id: string): TimeControl => TIME_CONTROLS.find((t) => t.id === id) ?? UNLIMITED;

/** Formata milissegundos como m:ss (ou h:mm:ss; décimos abaixo de 10 s). */
export function formatClock(ms: number): string {
  if (!Number.isFinite(ms)) return '∞';
  const clamped = Math.max(0, ms);
  if (clamped < 10_000) {
    const s = Math.floor(clamped / 1000);
    const t = Math.floor((clamped % 1000) / 100);
    return `0:0${s}.${t}`;
  }
  const total = Math.ceil(clamped / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}
