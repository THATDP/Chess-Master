import { useEffect, useSyncExternalStore } from 'react';
import { t } from '../lib/i18n';
import { navigate } from '../lib/router';
import { setTutorialDone } from '../lib/prefs';

/** Tutorial opcional, em etapas independentes. Nunca bloqueia a plataforma (backdrop não captura cliques). */
const STEPS = 9;
const ROUTES = ['/', '/play', '/opponents', '/engines', '/opponents', '/settings', '/settings', '/settings', '/history'];

interface TState {
  open: boolean;
  step: number;
}
let state: TState = { open: false, step: 0 };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const get = () => state;

export function openTutorial(step = 0) {
  state = { open: true, step: Math.max(0, Math.min(STEPS - 1, step)) };
  emit();
}
export function closeTutorial() {
  state = { ...state, open: false };
  setTutorialDone(true);
  emit();
}
export const useTutorial = () => useSyncExternalStore(subscribe, get, get);

export function TutorialModal() {
  const s = useTutorial();
  useEffect(() => {
    if (!s.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeTutorial();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [s.open]);
  if (!s.open) return null;
  const n = s.step;
  const set = (i: number) => {
    state = { ...state, step: i };
    emit();
  };
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex items-end justify-center p-3 sm:items-center sm:justify-end sm:p-6" role="dialog" aria-label={t('tut.title')} data-testid="tutorial">
      <div className="rise pointer-events-auto mb-16 w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-2xl sm:mb-0">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">{t('tut.step', { n: n + 1, total: STEPS })}</p>
          <button onClick={closeTutorial} className="cursor-pointer rounded-lg px-2 py-1 text-xs text-muted hover:text-ink" aria-label={t('tut.close')}>
            ✕ {t('tut.close')}
          </button>
        </div>
        <h2 className="font-display mt-2 text-xl font-semibold">{t(`tut.${n}.t`)}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{t(`tut.${n}.b`)}</p>
        <div className="mt-3 flex flex-wrap gap-1.5" role="tablist">
          {Array.from({ length: STEPS }, (_, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === n}
              onClick={() => set(i)}
              className={`h-2.5 w-2.5 cursor-pointer rounded-full ${i === n ? 'bg-accent' : 'bg-line hover:bg-muted'}`}
              aria-label={`${i + 1}`}
              style={{ minHeight: 0 }}
            />
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button onClick={() => navigate(ROUTES[n])} className="cursor-pointer rounded-lg border border-line bg-surface2 px-3 py-1.5 text-xs font-medium hover:border-accent/60">
            {t('tut.go')}
          </button>
          <span className="flex-1" />
          <button disabled={n === 0} onClick={() => set(n - 1)} className="cursor-pointer rounded-lg px-3 py-1.5 text-xs text-muted hover:text-ink disabled:opacity-30">
            {t('tut.prev')}
          </button>
          {n < STEPS - 1 ? (
            <button onClick={() => set(n + 1)} className="cursor-pointer rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink">
              {t('tut.next')}
            </button>
          ) : (
            <button onClick={closeTutorial} className="cursor-pointer rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink">
              {t('tut.done')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
