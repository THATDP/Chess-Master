import { useEffect, useState, type ReactNode } from 'react';
import { getEngineDescriptor } from '../engines';
import { levelLabelFor, useGameView } from '../game/instance';
import { hrefTo, useRoute, type RouteName } from '../lib/router';
import { sanitizeSettings } from '../engines';
import { updateSettings, useSettings } from '../lib/settings';
import { updateUi } from '../lib/prefs';
import { cn } from '../utils/cn';
import { IconBolt, IconCog, IconCpu, IconHistory, IconHome, IconMoon, IconSun, IconSwords, IconUsers } from './icons';
import { pieceUrl } from './pieces';
import { tr, t } from '../lib/i18n';
import { openTutorial } from './Tutorial';

const NAV: { name: RouteName; path: string; label: string; icon: ReactNode }[] = [
  { name: 'home', path: '/', label: 'Início', icon: <IconHome size={20} /> },
  { name: 'play', path: '/play', label: 'Jogar', icon: <IconSwords size={20} /> },
  { name: 'opponents', path: '/opponents', label: 'Adversário', icon: <IconUsers size={20} /> },
  { name: 'history', path: '/history', label: 'Histórico', icon: <IconHistory size={20} /> },
  { name: 'engines', path: '/engines', label: 'Engines', icon: <IconCpu size={20} /> },
  { name: 'settings', path: '/settings', label: 'Ajustes', icon: <IconCog size={20} /> },
];

export function Logo({ size = 40 }: { size?: number }) {
  const url = pieceUrl('cburnett', 'w', 'n');
  return (
    <div
      className="grid shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#f1cf7a] to-[#c8922c] shadow-[0_6px_20px_-6px_rgba(227,179,80,0.7)]"
      style={{ width: size, height: size }}
    >
      {url && <img src={url} alt="" style={{ width: size * 0.78, height: size * 0.78 }} draggable={false} />}
    </div>
  );
}

function ActiveRoute(name: RouteName): RouteName {
  return name === 'replay' ? 'history' : name;
}

/** Chip que identifica claramente o adversário selecionado. */
export function OpponentChip({ compact = false }: { compact?: boolean }) {
  const s = useSettings();
  const d = getEngineDescriptor(s.opponentId);
  if (!d) return null;
  const es = sanitizeSettings(d, s.engineSettings[d.id]);
  return (
    <a
      href={hrefTo('/opponents')}
      title="Alterar adversário"
      data-testid="opponent-chip"
      className="flex min-w-0 items-center gap-2.5 rounded-xl border border-line bg-surface2/70 px-3 py-2 transition hover:border-accent/60"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent/12 text-accent">
        {d.kind === 'uci-engine' ? <IconBolt size={16} /> : <IconCpu size={16} />}
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[13px] font-semibold">{d.name}</span>
        {!compact && (
          <span className="block truncate text-[11px] text-muted">
            {levelLabelFor(d.id, es.level)} · {d.kind === 'uci-engine' ? 'engine real' : 'adversário básico'}
          </span>
        )}
      </span>
    </a>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const route = useRoute();
  const s = useSettings();
  const view = useGameView();
  const active = ActiveRoute(route.name);
  const [drawer, setDrawer] = useState(false);
  useEffect(() => setDrawer(false), [route.name]);
  const toggleTheme = () => updateSettings({ theme: s.theme === 'dark' ? 'light' : 'dark' });
  const themeBtn = (
    <button
      onClick={toggleTheme}
      aria-label={s.theme === 'dark' ? tr('Ativar tema claro') : tr('Ativar tema escuro')}
      title={s.theme === 'dark' ? tr('Tema claro') : tr('Tema escuro')}
      className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg border border-line bg-surface2 text-muted transition hover:text-accent"
    >
      {s.theme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
    </button>
  );

  return (
    <div className="app-bg min-h-full">
      <button onClick={() => setDrawer((v) => !v)} className="pm-drawer-btn fixed top-3 left-3 z-40 h-10 w-10 cursor-pointer place-items-center rounded-lg border border-line bg-surface text-ink" aria-label={t('nav.menu')} aria-expanded={drawer}>
        ☰
      </button>
      <button onClick={() => updateUi({ focusMode: false })} className="pm-focus-exit fixed top-3 right-3 z-50 cursor-pointer items-center rounded-full border border-line bg-surface px-3 py-1.5 text-xs shadow-lg">
        ✕ {t('focus.exit')}
      </button>
      {/* Barra lateral (desktop) */}
      <aside data-open={drawer} className="pm-aside fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-surface/70 p-4 backdrop-blur-xl lg:flex">
        <a href={hrefTo('/')} className="mb-8 flex items-center gap-3 px-1.5 pt-1">
          <Logo />
          <div className="pm-label leading-none">
            <div className="font-display text-xl font-semibold">Chess Master</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted">Plataforma de xadrez</div>
          </div>
        </a>
        <nav className="flex flex-col gap-1" aria-label="Principal">
          {NAV.map((n) => (
            <a
              key={n.name}
              href={hrefTo(n.path)}
              aria-current={active === n.name ? 'page' : undefined}
              className={cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                active === n.name ? 'bg-accent/14 text-accent' : 'text-muted hover:bg-surface2 hover:text-ink',
              )}
            >
              <span className={cn('transition-transform', active !== n.name && 'group-hover:translate-x-0.5')}>{n.icon}</span>
              <span className="pm-label">{tr(n.label)}</span>
              {n.name === 'play' && view.active && !view.status.over && (
                <span className="ml-auto h-2 w-2 animate-pulse rounded-full bg-good" title={tr('Partida em andamento')} />
              )}
            </a>
          ))}
        </nav>
        <div className="mt-auto space-y-3">
          <p className="pm-label px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">{tr('Adversário')}</p>
          <div className="pm-label"><OpponentChip /></div>
          <div className="flex items-center justify-between px-1">
            <span className="pm-label text-xs text-muted">{tr('Tema')}</span>
            <span className="flex gap-1.5">
              <button onClick={() => openTutorial()} title={t('nav.tutorial')} aria-label={t('nav.tutorial')} className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg border border-line bg-surface2 text-muted transition hover:text-accent">?</button>
              {themeBtn}
            </span>
          </div>
        </div>
      </aside>

      {/* Cabeçalho (mobile) */}
      <header className="pm-header sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-surface/85 px-4 py-2.5 backdrop-blur-xl lg:hidden">
        <a href={hrefTo('/')} className="flex items-center gap-2.5" aria-label="Chess Master — início">
          <Logo size={32} />
          <span className="pm-brand-text font-display text-lg font-semibold">Chess Master</span>
        </a>
        <div className="ml-auto flex min-w-0 items-center gap-2">
          <div className="pm-opp hidden min-w-0 sm:block">
            <OpponentChip compact />
          </div>
          {themeBtn}
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="pm-main outline-none px-4 pt-5 pb-28 sm:px-6 lg:ml-60 lg:px-8 lg:pt-6 lg:pb-10">
        <TopNav active={active} />
        <div className="mx-auto max-w-[1280px]">{children}</div>
      </main>

      {/* Navegação inferior (mobile) */}
      <nav
        className="pm-bottom safe-bottom fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-line bg-surface/92 backdrop-blur-xl lg:hidden"
        aria-label="Principal"
      >
        {NAV.map((n) => (
          <a
            key={n.name}
            href={hrefTo(n.path)}
            aria-current={active === n.name ? 'page' : undefined}
            className={cn(
              'relative flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors',
              active === n.name ? 'text-accent' : 'text-muted',
            )}
          >
            {active === n.name && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-accent" />}
            {n.icon}
            {tr(n.label)}
          </a>
        ))}
      </nav>
    </div>
  );
}

/** Navegação superior (preferência: navegação superior ou combinada; só desktop). */
function TopNav({ active }: { active: RouteName }) {
  return (
    <nav className="pm-topnav sticky top-0 z-20 mb-4 items-center gap-1 rounded-2xl border border-line bg-surface/90 px-3 py-2 backdrop-blur-xl" aria-label={tr('Principal')}>
      <a href={hrefTo('/')} className="mr-2 flex items-center gap-2" aria-label="Chess Master">
        <Logo size={28} />
        <span className="pm-brand-text font-display text-base font-semibold">Chess Master</span>
      </a>
      {NAV.map((n) => (
        <a
          key={n.name}
          href={hrefTo(n.path)}
          aria-current={active === n.name ? 'page' : undefined}
          className={cn('flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition', active === n.name ? 'bg-accent/14 text-accent' : 'text-muted hover:bg-surface2 hover:text-ink')}
        >
          {n.icon}
          {tr(n.label)}
        </a>
      ))}
      <span className="pm-opp ml-auto min-w-0">
        <OpponentChip compact />
      </span>
    </nav>
  );
}
