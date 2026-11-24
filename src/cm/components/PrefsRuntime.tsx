import { useEffect, useLayoutEffect, useSyncExternalStore } from 'react';
import { engineManager } from '../engines';
import { gameController, useGameView } from '../game/instance';
import { t, useLang } from '../lib/i18n';
import { bootPrefs, updateUi, useUi, usePrefs, type UiPrefs } from '../lib/prefs';
import { navigate } from '../lib/router';
import { updateSettings, useSettings } from '../lib/settings';
import { effectiveMap, eventCombo, isTypingTarget } from '../lib/shortcuts';
import { TutorialModal, openTutorial, useTutorial } from './Tutorial';
import { setTutorialDone } from '../lib/prefs';

// Aplica o perfil padrão antes da primeira renderização (evita "flash" de configurações).
if (typeof window !== 'undefined') bootPrefs();

/* ------------------------------- notificações ------------------------------- */

interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'bad';
}
let toasts: Toast[] = [];
let toastId = 0;
const tl = new Set<() => void>();
const sub = (l: () => void) => {
  tl.add(l);
  return () => tl.delete(l);
};
export function toast(text: string, tone: Toast['tone'] = 'info') {
  const id = ++toastId;
  toasts = [...toasts.slice(-3), { id, text, tone }];
  tl.forEach((l) => l());
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== id);
    tl.forEach((l) => l());
  }, 3200);
}
const useToasts = () => useSyncExternalStore(sub, () => toasts, () => toasts);

/* ------------------------------ cores / CSS vars ------------------------------ */

const hexToRgb = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rgbToHex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const mix = (a: string, b: string, p: number) => {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex(x[0] + (y[0] - x[0]) * p, x[1] + (y[1] - x[1]) * p, x[2] + (y[2] - x[2]) * p);
};
const lum = (h: string) => {
  const [r, g, b] = hexToRgb(h).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const readableOn = (bg: string) => (lum(bg) > 0.4 ? '#14110a' : '#ffffff');

const MANAGED_VARS = ['--c-accent', '--c-accent-ink', '--glow', '--c-bg', '--c-surface', '--c-surface2', '--c-line', '--c-ink', '--c-muted', '--cm-board-light', '--cm-board-dark', '--cm-piece-scale', '--cm-board-max', '--cm-opacity', '--spacing'];

/** Aplica as preferências ao documento (atualização imediata, sem recarregar). */
export function applyUi(ui: UiPrefs, theme: 'dark' | 'light', systemReduce: boolean) {
  const el = document.documentElement;
  const set = (name: string, value: string | null) => {
    if (value === null) el.removeAttribute(`data-${name}`);
    else el.setAttribute(`data-${name}`, value);
  };
  const nonDefault = <T,>(v: T, d: T, out: string) => (v === d ? null : out);

  set('nav', nonDefault(ui.navMode, 'side', ui.navMode));
  set('sidebar', nonDefault(ui.sidebarState, 'expanded', ui.sidebarState));
  set('header', nonDefault(ui.header, 'full', ui.header));
  set('info', nonDefault(ui.infoPanel, 'right', ui.infoPanel));
  set('history', nonDefault(ui.historyPos, 'side', ui.historyPos));
  set('width', nonDefault(ui.contentWidth, 'default', ui.contentWidth));
  set('layout', nonDefault(ui.layoutMode, 'adaptive', ui.layoutMode));
  set('focus', ui.focusMode ? 'on' : null);
  set('density', nonDefault(ui.density, 'comfortable', ui.density));
  set('palette', nonDefault(ui.palette, 'default', ui.palette));
  set('font', nonDefault(ui.font, 'default', ui.font));
  set('radius', nonDefault(ui.radius, 'default', ui.radius));
  set('border', ui.borderWidth === 1 ? null : String(ui.borderWidth));
  set('contrast', nonDefault(ui.contrast, 'normal', ui.contrast));
  set('altind', ui.altIndicators ? 'on' : null);
  set('kbd', ui.keyboardNav ? 'on' : null);
  set('read', ui.readability ? 'on' : null);
  set('checkhl', ui.highlightCheck ? null : 'off');
  set('showpv', ui.showPv ? null : 'off');
  set('searchinfo', ui.showSearchInfo ? null : 'off');
  set('panel-engine', ui.showEnginePanel ? null : 'off');
  set('panel-moves', ui.showMoveList ? null : 'off');
  set('panel-actions', ui.showActions ? null : 'off');

  const reduce = ui.motion === 'reduce' || (ui.motion === 'system' && systemReduce);
  set('anim', ui.lowPerf || reduce || ui.animation === 'off' ? 'off' : ui.animation === 'normal' ? null : ui.animation);
  set('fx', ui.lowPerf || !ui.effects ? 'off' : null);
  set('motion', reduce ? 'reduce' : null);

  MANAGED_VARS.forEach((v) => el.style.removeProperty(v));
  const dark = theme === 'dark';
  if (ui.accent) {
    el.style.setProperty('--c-accent', ui.accent);
    el.style.setProperty('--c-accent-ink', readableOn(ui.accent));
    const [r, g, b] = hexToRgb(ui.accent);
    el.style.setProperty('--glow', `rgba(${r},${g},${b},0.14)`);
  }
  if (ui.bgColor) el.style.setProperty('--c-bg', ui.bgColor);
  if (ui.surfaceColor) {
    el.style.setProperty('--c-surface', ui.surfaceColor);
    el.style.setProperty('--c-surface2', mix(ui.surfaceColor, dark ? '#ffffff' : '#000000', 0.06));
    el.style.setProperty('--c-line', mix(ui.surfaceColor, dark ? '#ffffff' : '#000000', 0.16));
  }
  if (ui.inkColor) {
    el.style.setProperty('--c-ink', ui.inkColor);
    el.style.setProperty('--c-muted', mix(ui.inkColor, ui.surfaceColor || ui.bgColor || (dark ? '#12151d' : '#fffdf8'), 0.42));
  }
  if (ui.boardLight) el.style.setProperty('--cm-board-light', ui.boardLight);
  if (ui.boardDark) el.style.setProperty('--cm-board-dark', ui.boardDark);
  if (ui.pieceScale !== 100) {
    el.style.setProperty('--cm-piece-scale', String(ui.pieceScale / 100));
    set('piecescale', 'on');
  } else set('piecescale', null);
  if (ui.boardMax > 0) {
    el.style.setProperty('--cm-board-max', `${ui.boardMax}px`);
    set('boardsize', 'on');
  } else set('boardsize', null);
  if (ui.opacity < 100) {
    el.style.setProperty('--cm-opacity', `${ui.opacity}%`);
    set('opacity', 'on');
  } else set('opacity', null);

  const dens = ui.density === 'compact' ? 0.88 : ui.density === 'spacious' ? 1.12 : 1;
  const sp = (ui.spacing / 100) * dens;
  if (sp !== 1) el.style.setProperty('--spacing', `${(0.25 * sp).toFixed(4)}rem`);
  el.style.fontSize = ui.textScale === 100 ? '' : `${ui.textScale}%`;
  (el.style as CSSStyleDeclaration & { zoom?: string }).zoom = ui.uiScale === 100 ? '' : String(ui.uiScale / 100);
}

/* --------------------------------- runtime --------------------------------- */

export function PrefsRuntime() {
  const ui = useUi();
  const prefs = usePrefs();
  const settings = useSettings();
  const lang = useLang();
  const view = useGameView();
  const tut = useTutorial();
  const list = useToasts();

  useLayoutEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const run = () => applyUi(ui, settings.theme, !!mq?.matches);
    run();
    mq?.addEventListener?.('change', run);
    return () => mq?.removeEventListener?.('change', run);
  }, [ui, settings.theme]);

  useEffect(() => {
    document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en';
  }, [lang]);

  // Carregamento antecipado (opcional): por padrão as engines só carregam quando usadas.
  useEffect(() => {
    if (ui.lazyLoad) return;
    engineManager.prepare(settings.opponentId, settings.engineSettings[settings.opponentId] ?? {}).catch(() => {});
  }, [ui.lazyLoad, settings.opponentId, settings.engineSettings]);

  // Atalhos de teclado (ignorados ao digitar em campos de texto).
  useEffect(() => {
    if (!ui.keyboardNav) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isTypingTarget(e.target) || document.documentElement.dataset.capturing) return;
      const combo = eventCombo(e);
      if (!combo) return;
      const map = effectiveMap();
      const id = Object.keys(map).find((k) => map[k] === combo);
      if (!id) return;
      const onPlay = window.location.hash.startsWith('#/play');
      const v = gameController.getView();
      const ply = v.viewPly;
      const total = v.history.length;
      let handled = true;
      switch (id) {
        case 'flip': if (onPlay) window.dispatchEvent(new Event('cm:flip')); else handled = false; break;
        case 'undo': if (onPlay) gameController.undo(); else handled = false; break;
        case 'newGame': if (onPlay) gameController.closeGame(); else handled = false; break;
        case 'prev': if (onPlay) gameController.goTo(Math.max(0, ply - 1)); else handled = false; break;
        case 'next': if (onPlay) gameController.goTo(Math.min(total, ply + 1)); else handled = false; break;
        case 'first': if (onPlay) gameController.goTo(0); else handled = false; break;
        case 'last': if (onPlay) gameController.goTo(total); else handled = false; break;
        case 'copyFen': navigator.clipboard?.writeText(v.fen).then(() => toast(t('toast.fenCopied'))).catch(() => {}); break;
        case 'toggleTheme': updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' }); break;
        case 'toggleFocus': updateUi({ focusMode: !ui.focusMode }); if (!ui.focusMode) toast(t('toast.focusOn')); break;
        case 'goHome': navigate('/'); break;
        case 'goPlay': navigate('/play'); break;
        case 'goOpponents': navigate('/opponents'); break;
        case 'goHistory': navigate('/history'); break;
        case 'goEngines': navigate('/engines'); break;
        case 'goSettings': navigate('/settings'); break;
        case 'tutorial': openTutorial(); break;
        default: handled = false;
      }
      if (handled) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ui.keyboardNav, ui.focusMode, settings.theme, prefs.shortcuts, lang, view.viewPly]);

  return (
    <>
      <a href="#main-content" className="pm-skip" onClick={(e) => { e.preventDefault(); document.getElementById('main-content')?.focus(); }}>
        {t('nav.skip')}
      </a>
      <TutorialModal />
      {!prefs.tutorialDone && !tut.open && (
        <div className="fixed right-3 bottom-20 z-50 flex max-w-xs items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-2xl lg:bottom-5" data-testid="tutorial-banner">
          <p className="text-xs text-muted">{t('tut.banner')}</p>
          <div className="flex shrink-0 flex-col gap-1">
            <button onClick={() => openTutorial()} className="cursor-pointer rounded-lg bg-accent px-2.5 py-1 text-xs font-semibold text-accent-ink">{t('tut.start')}</button>
            <button onClick={() => setTutorialDone(true)} className="cursor-pointer rounded-lg px-2.5 py-1 text-xs text-muted hover:text-ink">{t('tut.skip')}</button>
          </div>
        </div>
      )}
      <div className="pointer-events-none fixed top-3 left-1/2 z-[70] flex -translate-x-1/2 flex-col items-center gap-2" aria-live="polite">
        {list.map((x) => (
          <div key={x.id} className={`fade-in rounded-xl border px-4 py-2 text-sm shadow-xl ${x.tone === 'bad' ? 'border-bad/50 bg-surface text-bad' : 'border-line bg-surface text-ink'}`}>
            {x.text}
          </div>
        ))}
      </div>
    </>
  );
}
