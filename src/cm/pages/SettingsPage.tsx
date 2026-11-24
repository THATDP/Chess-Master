import { useEffect, useMemo, useRef, useState } from 'react';
import { Board } from '../components/Board';
import { PieceIcon } from '../components/pieces';
import { toast } from '../components/PrefsRuntime';
import { openTutorial } from '../components/Tutorial';
import { useBoardAppearance } from '../components/play/useBoardAppearance';
import { Button, Card, PageHeader, RangeField } from '../components/ui';
import { defaultSettingsFor, engineManager, getEngineDescriptor, listEngines, sanitizeSettings, type EngineDescriptor } from '../engines';
import { TIME_CONTROLS } from '../game/timeControls';
import { LANGS, t, useLang } from '../lib/i18n';
import {
  PREFS_SCHEMA,
  createProfile,
  defaultUi,
  deleteProfile,
  duplicateProfile,
  exportAll,
  exportProfile,
  importAll,
  importProfile,
  renameProfile,
  resetAllPrefs,
  resetUiKeys,
  restoreProfile,
  selectProfile,
  setDefaultProfile,
  setLang,
  updateUi,
  usePrefs,
  useUi,
  type LangPref,
  type UiPrefs,
} from '../lib/prefs';
import {
  BOARD_THEMES,
  PIECE_SETS,
  settingsStore,
  updateEngineSettings,
  updateSettings,
  useSettings,
} from '../lib/settings';
import { SHORTCUTS, comboOf, eventCombo, findConflict, prettyCombo, resetAllShortcuts, resetShortcut, setShortcut } from '../lib/shortcuts';
import { cn } from '../utils/cn';
import { LegacySettings } from './LegacySettings';

const PREVIEW_FEN = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R w KQkq - 0 5';

type Cat = 'layout' | 'appearance' | 'game' | 'engines' | 'a11y' | 'advanced' | 'profiles';
const CATS: Cat[] = ['layout', 'appearance', 'game', 'engines', 'a11y', 'advanced', 'profiles'];

type Ctl =
  | { key: keyof UiPrefs; cat: Cat; kind: 'select'; options: (string | number)[] }
  | { key: keyof UiPrefs; cat: Cat; kind: 'toggle' }
  | { key: keyof UiPrefs; cat: Cat; kind: 'range'; min: number; max: number; step: number; unit?: string }
  | { key: keyof UiPrefs; cat: Cat; kind: 'color' };

const CONTROLS: Ctl[] = [
  { key: 'navMode', cat: 'layout', kind: 'select', options: ['side', 'top', 'both'] },
  { key: 'sidebarState', cat: 'layout', kind: 'select', options: ['expanded', 'compact', 'collapsed'] },
  { key: 'header', cat: 'layout', kind: 'select', options: ['full', 'compact', 'minimal'] },
  { key: 'density', cat: 'layout', kind: 'select', options: ['compact', 'comfortable', 'spacious'] },
  { key: 'layoutMode', cat: 'layout', kind: 'select', options: ['adaptive', 'centered', 'side'] },
  { key: 'contentWidth', cat: 'layout', kind: 'select', options: ['narrow', 'default', 'wide'] },
  { key: 'infoPanel', cat: 'layout', kind: 'select', options: ['right', 'left', 'hidden'] },
  { key: 'historyPos', cat: 'layout', kind: 'select', options: ['side', 'bottom'] },
  { key: 'showEnginePanel', cat: 'layout', kind: 'toggle' },
  { key: 'showMoveList', cat: 'layout', kind: 'toggle' },
  { key: 'showActions', cat: 'layout', kind: 'toggle' },
  { key: 'focusMode', cat: 'layout', kind: 'toggle' },
  { key: 'palette', cat: 'appearance', kind: 'select', options: ['default', 'midnight', 'forest', 'paper', 'sunset', 'mono'] },
  { key: 'accent', cat: 'appearance', kind: 'color' },
  { key: 'bgColor', cat: 'appearance', kind: 'color' },
  { key: 'surfaceColor', cat: 'appearance', kind: 'color' },
  { key: 'inkColor', cat: 'appearance', kind: 'color' },
  { key: 'boardLight', cat: 'appearance', kind: 'color' },
  { key: 'boardDark', cat: 'appearance', kind: 'color' },
  { key: 'pieceScale', cat: 'appearance', kind: 'range', min: 70, max: 115, step: 1, unit: '%' },
  { key: 'boardMax', cat: 'appearance', kind: 'range', min: 0, max: 1000, step: 20, unit: 'px' },
  { key: 'font', cat: 'appearance', kind: 'select', options: ['default', 'serif', 'mono', 'system', 'rounded'] },
  { key: 'textScale', cat: 'appearance', kind: 'range', min: 85, max: 135, step: 5, unit: '%' },
  { key: 'radius', cat: 'appearance', kind: 'select', options: ['default', 'sharp', 'soft', 'round'] },
  { key: 'borderWidth', cat: 'appearance', kind: 'select', options: [1, 2, 3] },
  { key: 'spacing', cat: 'appearance', kind: 'range', min: 70, max: 140, step: 5, unit: '%' },
  { key: 'opacity', cat: 'appearance', kind: 'range', min: 60, max: 100, step: 5, unit: '%' },
  { key: 'animation', cat: 'appearance', kind: 'select', options: ['off', 'low', 'normal', 'high'] },
  { key: 'effects', cat: 'appearance', kind: 'toggle' },
  { key: 'moveInput', cat: 'game', kind: 'select', options: ['both', 'drag', 'click'] },
  { key: 'confirmMoves', cat: 'game', kind: 'toggle' },
  { key: 'autoOrient', cat: 'game', kind: 'toggle' },
  { key: 'highlightCheck', cat: 'game', kind: 'toggle' },
  { key: 'notation', cat: 'game', kind: 'select', options: ['san', 'uci'] },
  { key: 'showPv', cat: 'engines', kind: 'toggle' },
  { key: 'showSearchInfo', cat: 'engines', kind: 'toggle' },
  { key: 'lazyLoad', cat: 'engines', kind: 'toggle' },
  { key: 'uiScale', cat: 'a11y', kind: 'range', min: 85, max: 140, step: 5, unit: '%' },
  { key: 'contrast', cat: 'a11y', kind: 'select', options: ['normal', 'high'] },
  { key: 'motion', cat: 'a11y', kind: 'select', options: ['system', 'reduce', 'full'] },
  { key: 'altIndicators', cat: 'a11y', kind: 'toggle' },
  { key: 'keyboardNav', cat: 'a11y', kind: 'toggle' },
  { key: 'lowPerf', cat: 'a11y', kind: 'toggle' },
  { key: 'readability', cat: 'a11y', kind: 'toggle' },
];

/* ------------------------------- controles base ------------------------------- */

const fieldCls = 'rounded-lg border border-line bg-surface2 px-2.5 py-1.5 text-sm text-ink focus:border-accent';

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn('relative h-6 w-11 shrink-0 cursor-pointer rounded-full border border-line transition-colors', checked ? 'bg-accent' : 'bg-surface2')}
      style={{ minHeight: 0 }}
    >
      <span className={cn('absolute top-0.5 left-0.5 h-4.5 w-4.5 rounded-full bg-ink transition-transform', checked && 'translate-x-5 bg-accent-ink')} style={{ width: 18, height: 18 }} />
    </button>
  );
}

function parseColor(raw: string): string | null {
  const s = raw.trim();
  if (/^#[0-9a-f]{6}$/i.test(s)) return s.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(s)) return ('#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3]).toLowerCase();
  const m = s.match(/^(?:rgb\()?\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*\)?$/i);
  if (m) {
    const v = [m[1], m[2], m[3]].map(Number);
    if (v.every((n) => n >= 0 && n <= 255)) return '#' + v.map((n) => n.toString(16).padStart(2, '0')).join('');
  }
  return null;
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);
  const [bad, setBad] = useState(false);
  useEffect(() => {
    setText(value);
    setBad(false);
  }, [value]);
  const rgb = value ? `${parseInt(value.slice(1, 3), 16)}, ${parseInt(value.slice(3, 5), 16)}, ${parseInt(value.slice(5, 7), 16)}` : '';
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input type="color" value={value || '#888888'} onChange={(e) => onChange(e.target.value)} className="h-9 w-12 cursor-pointer rounded-lg border border-line bg-transparent p-0.5" aria-label="color" />
      <input
        value={text}
        placeholder="#rrggbb · r, g, b"
        onChange={(e) => {
          setText(e.target.value);
          const c = parseColor(e.target.value);
          setBad(!!e.target.value && !c);
          if (c) onChange(c);
        }}
        className={cn(fieldCls, 'w-36 font-mono', bad && 'border-bad')}
        aria-invalid={bad}
      />
      {value && <span className="font-mono text-[11px] text-muted">rgb({rgb})</span>}
      {value && (
        <button onClick={() => onChange('')} className="cursor-pointer text-xs text-muted underline hover:text-ink">
          {t('set.clear')}
        </button>
      )}
    </div>
  );
}

function Row({ ctl, ui }: { ctl: Ctl; ui: UiPrefs }) {
  const def = defaultUi();
  const key = ctl.key;
  const value = ui[key];
  const changed = value !== def[key];
  const label = t(`ui.${key}`);
  const set = (v: unknown) => updateUi({ [key]: v } as Partial<UiPrefs>);
  let control: React.ReactNode;
  if (ctl.kind === 'toggle') control = <Switch checked={value as boolean} onChange={set} label={label} />;
  else if (ctl.kind === 'select')
    control = (
      <select value={String(value)} onChange={(e) => set(typeof ctl.options[0] === 'number' ? Number(e.target.value) : e.target.value)} className={fieldCls} aria-label={label}>
        {ctl.options.map((o) => (
          <option key={String(o)} value={String(o)}>
            {t(`opt.${key}.${o}`)}
          </option>
        ))}
      </select>
    );
  else if (ctl.kind === 'color') control = <ColorInput value={value as string} onChange={set} />;
  else
    control = (
      <div className="w-full max-w-xs">
        <RangeField label={label} value={value as number} min={ctl.min} max={ctl.max} step={ctl.step} unit={ctl.unit} onChange={set} />
      </div>
    );
  const hideLabel = ctl.kind === 'range';
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line/60 py-3 last:border-0" data-setting={key}>
      {!hideLabel && <span className="min-w-0 flex-1 basis-56 text-sm">{label}</span>}
      <div className={cn('flex items-center gap-2', hideLabel && 'flex-1')}>
        {control}
        <button
          onClick={() => resetUiKeys([key])}
          disabled={!changed}
          title={t('set.reset')}
          aria-label={`${t('set.reset')}: ${label}`}
          className="cursor-pointer rounded-md px-1.5 py-1 text-xs text-muted hover:text-accent disabled:cursor-default disabled:opacity-25"
          style={{ minHeight: 0 }}
        >
          ↺
        </button>
      </div>
    </div>
  );
}

function Panel({ title, hint, children, className }: { title?: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={cn('p-5', className)}>
      {title && <h2 className="text-base font-semibold">{title}</h2>}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      <div className={title ? 'mt-3' : ''}>{children}</div>
    </Card>
  );
}

/* --------------------------------- seções --------------------------------- */

function Preview() {
  const appearance = useBoardAppearance();
  return (
    <div className="space-y-3 xl:sticky xl:top-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{t('set.preview')}</p>
      <div className="mx-auto max-w-[320px]">
        <Board fen={PREVIEW_FEN} orientation="w" legalMoves={[]} lastMove={null} checkSquare={null} appearance={appearance} onMove={() => {}} label={t('set.preview')} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" size="sm">Aa</Button>
        <Button variant="outline" size="sm">Aa</Button>
        <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs text-accent">accent</span>
        <span className="text-xs text-muted">muted</span>
      </div>
    </div>
  );
}

function ControlList({ cat, ui }: { cat: Cat; ui: UiPrefs }) {
  return (
    <div>
      {CONTROLS.filter((c) => c.cat === cat).map((c) => (
        <Row key={c.key} ctl={c} ui={ui} />
      ))}
    </div>
  );
}

function QuickAppearance() {
  const s = useSettings();
  return (
    <Panel title={t('set.quickAppearance')}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm">{t('set.themeMode')}</span>
          <div className="flex gap-1.5">
            {(['dark', 'light'] as const).map((m) => (
              <button key={m} onClick={() => updateSettings({ theme: m })} aria-pressed={s.theme === m} className={cn('cursor-pointer rounded-lg border px-3 py-1.5 text-sm', s.theme === m ? 'border-accent bg-accent/10 text-accent' : 'border-line bg-surface2')}>
                {m === 'dark' ? t('set.dark') : t('set.light')}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm">{t('set.pieceSet')}</span>
          <div className="flex gap-1.5">
            {PIECE_SETS.map((p) => (
              <button key={p.id} onClick={() => updateSettings({ pieceSet: p.id })} aria-pressed={s.pieceSet === p.id} title={p.label} className={cn('cursor-pointer rounded-lg border px-2 py-1', s.pieceSet === p.id ? 'border-accent bg-accent/10' : 'border-line bg-surface2')}>
                <PieceIcon set={p.id} color="w" type="n" size={30} />
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm">{t('set.boardTheme')}</span>
          <div className="flex gap-1.5">
            {BOARD_THEMES.map((b) => (
              <button key={b.id} onClick={() => updateSettings({ boardTheme: b.id })} aria-pressed={s.boardTheme === b.id} title={b.label} className={cn('grid h-9 w-9 cursor-pointer grid-cols-2 overflow-hidden rounded-lg border-2', s.boardTheme === b.id ? 'border-accent' : 'border-line')}>
                <span style={{ background: b.light }} />
                <span style={{ background: b.dark }} />
                <span style={{ background: b.dark }} />
                <span style={{ background: b.light }} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function EngineSettingsPanel({ d }: { d: EngineDescriptor }) {
  const s = useSettings();
  const es = sanitizeSettings(d, s.engineSettings[d.id]);
  const level = String(es.level);
  return (
    <Card className="p-5" data-engine-settings={d.id}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{d.name}</h3>
        <select
          aria-label={`${d.name} — ${t('set.level')}`}
          value={level}
          onChange={(e) => updateEngineSettings(d.id, e.target.value === 'custom' ? { ...es, level: 'custom' } : defaultSettingsFor(d, e.target.value))}
          className={fieldCls}
        >
          {d.levels.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
          <option value="custom">{t('set.custom')}</option>
        </select>
      </div>
      <p className="mt-1 text-xs text-muted">{d.levels.find((l) => l.id === level)?.description ?? ''}</p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {d.fields
          .filter((f) => !f.visibleForLevels || f.visibleForLevels.includes(level))
          .map((f) => (
            <RangeField
              key={f.key}
              label={f.label}
              description={f.description}
              value={Number(es[f.key] ?? (f.key === 'hash' ? 32 : f.min))}
              min={f.min}
              max={f.max}
              step={f.step}
              unit={f.unit}
              onChange={(v) => updateEngineSettings(d.id, sanitizeSettings(d, { ...es, level: 'custom', [f.key]: v }))}
            />
          ))}
      </div>
    </Card>
  );
}

function EnginesTab({ ui }: { ui: UiPrefs }) {
  const s = useSettings();
  return (
    <div className="space-y-5">
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-3">
          <span className="text-sm">{t('set.defaultEngine')}</span>
          <select value={s.opponentId} onChange={(e) => updateSettings({ opponentId: e.target.value })} className={fieldCls} aria-label={t('set.defaultEngine')}>
            {listEngines().map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <ControlList cat="engines" ui={ui} />
      </Panel>
      <div>
        <h2 className="text-base font-semibold">{t('set.engineSettings')}</h2>
        <p className="mb-3 text-xs text-muted">{t('set.engineSettingsHint')}</p>
        <div className="space-y-4">
          {listEngines().map((d) => (
            <EngineSettingsPanel key={d.id} d={d} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ShortcutsEditor() {
  const prefs = usePrefs();
  const [capturing, setCapturing] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!capturing) return;
    document.documentElement.dataset.capturing = '1';
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') return setCapturing(null);
      const combo = eventCombo(e);
      if (!combo) return;
      const res = setShortcut(capturing, combo);
      if (res.ok) {
        setMsg(null);
        setCapturing(null);
      } else setMsg(t('set.conflict', { name: t(`sc.${res.conflict}`) }));
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      delete document.documentElement.dataset.capturing;
    };
  }, [capturing]);
  void prefs.shortcuts;
  return (
    <Panel title={t('set.shortcuts')} hint={t('set.shortcutsHint')}>
      {msg && <p className="mb-2 rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad" role="alert">{msg}</p>}
      <div>
        {SHORTCUTS.map((sc) => {
          const combo = comboOf(sc.id);
          const custom = combo !== sc.def;
          return (
            <div key={sc.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 py-2 last:border-0">
              <span className="text-sm">{t(`sc.${sc.id}`)}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setMsg(null); setCapturing(capturing === sc.id ? null : sc.id); }}
                  className={cn('min-w-28 cursor-pointer rounded-lg border px-3 py-1 font-mono text-xs', capturing === sc.id ? 'border-accent bg-accent/10 text-accent' : 'border-line bg-surface2')}
                  aria-label={`${t(`sc.${sc.id}`)}: ${prettyCombo(combo)}`}
                >
                  {capturing === sc.id ? t('set.press') : prettyCombo(combo)}
                </button>
                <button onClick={() => resetShortcut(sc.id)} disabled={!custom} className="cursor-pointer text-xs text-muted hover:text-accent disabled:opacity-25" aria-label={t('set.reset')} style={{ minHeight: 0 }}>↺</button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3">
        <Button variant="outline" size="sm" onClick={() => { resetAllShortcuts(); setMsg(null); }}>{t('set.shortcutsReset')}</Button>
      </div>
    </Panel>
  );
}

function GameTab({ ui }: { ui: UiPrefs }) {
  const s = useSettings();
  return (
    <div className="space-y-5">
      <Panel>
        <ControlList cat="game" ui={ui} />
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-3">
          <span className="text-sm">{t('set.defaultClock')}</span>
          <select value={s.timeControlId} onChange={(e) => updateSettings({ timeControlId: e.target.value })} className={fieldCls} aria-label={t('set.defaultClock')}>
            {TIME_CONTROLS.map((tc) => (
              <option key={tc.id} value={tc.id}>
                {tc.label}
              </option>
            ))}
          </select>
        </div>
      </Panel>
      <ShortcutsEditor />
      <div>
        <h2 className="mb-3 text-base font-semibold">{t('set.classic')}</h2>
        <LegacySettings embedded />
      </div>
    </div>
  );
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function reportImport(res: ReturnType<typeof importProfile>) {
  if (res.ok) toast(t('toast.imported', { n: res.count }));
  else toast(t('toast.importError', { err: t(`toast.err.${res.error}`) }), 'bad');
}

function ImportBox({ onText, label }: { onText: (text: string) => void; label: string }) {
  const [text, setText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="block w-full text-xs text-muted file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-line file:bg-surface2 file:px-3 file:py-1.5 file:text-ink"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          if (f.size > 2_000_000) return toast(t('toast.importError', { err: t('toast.err.file-too-large') }), 'bad');
          onText(await f.text());
          if (fileRef.current) fileRef.current.value = '';
        }}
      />
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={t('prof.importText')} rows={3} className={cn(fieldCls, 'w-full font-mono text-xs')} />
      <Button size="sm" variant="outline" onClick={() => { onText(text); setText(''); }} disabled={!text.trim()}>
        {t('prof.importBtn')}
      </Button>
    </div>
  );
}

function ProfilesTab() {
  const prefs = usePrefs();
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  return (
    <div className="space-y-5">
      <Panel title={t('prof.title')} hint={t('prof.hint')}>
        <ul className="space-y-2">
          {prefs.profiles.map((p) => {
            const active = p.id === prefs.activeId;
            const name = p.builtin && p.name === { custom: 'Personalizado', analysis: 'Análise', minimal: 'Minimalista', competitive: 'Competitivo' }[p.builtin] ? t(`prof.builtin.${p.builtin}`) : p.name;
            return (
              <li key={p.id} data-profile={p.id} className={cn('rounded-xl border p-3', active ? 'border-accent bg-accent/8' : 'border-line bg-surface2/40')}>
                <div className="flex flex-wrap items-center gap-2">
                  {editing === p.id ? (
                    <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { renameProfile(p.id, editName); setEditing(null); } if (e.key === 'Escape') setEditing(null); }} onBlur={() => { renameProfile(p.id, editName); setEditing(null); }} className={cn(fieldCls, 'w-48')} maxLength={40} />
                  ) : (
                    <span className="font-medium">{name}</span>
                  )}
                  {active && <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-ink">{t('prof.active')}</span>}
                  {p.id === prefs.defaultId && <span className="rounded-full border border-line px-2 py-0.5 text-[10px] text-muted">{t('prof.default')}</span>}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                  {!active && <Button size="sm" variant="primary" onClick={() => { selectProfile(p.id); toast(t('toast.profileSwitched', { name })); }}>{t('prof.use')}</Button>}
                  {p.id !== prefs.defaultId && <Button size="sm" variant="outline" onClick={() => setDefaultProfile(p.id)}>{t('prof.setDefault')}</Button>}
                  <Button size="sm" variant="outline" onClick={() => { setEditing(p.id); setEditName(p.name); }}>{t('prof.rename')}</Button>
                  <Button size="sm" variant="outline" onClick={() => duplicateProfile(p.id)}>{t('prof.duplicate')}</Button>
                  <Button size="sm" variant="outline" onClick={() => download(`chess-master-profile-${p.name.replace(/\W+/g, '-').toLowerCase()}.json`, exportProfile(p.id))}>{t('prof.export')}</Button>
                  <Button size="sm" variant="outline" onClick={() => { restoreProfile(p.id); toast(t('toast.reset')); }}>{t('prof.restore')}</Button>
                  <Button size="sm" variant="outline" onClick={() => { if (prefs.profiles.length <= 1) return toast(t('prof.lastOne'), 'bad'); if (window.confirm(t('prof.deleteConfirm', { name }))) deleteProfile(p.id); }}>{t('prof.delete')}</Button>
                </div>
              </li>
            );
          })}
        </ul>
        <form className="mt-4 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); const id = createProfile(newName || t('prof.create')); setNewName(''); selectProfile(id); }}>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('prof.newName')} maxLength={40} className={cn(fieldCls, 'min-w-48 flex-1')} aria-label={t('prof.newName')} />
          <Button type="submit" variant="primary" size="sm">{t('prof.create')}</Button>
        </form>
      </Panel>
      <Panel>
        <ImportBox label={t('prof.import')} onText={(txt) => reportImport(importProfile(txt))} />
      </Panel>
    </div>
  );
}

function AdvancedTab() {
  const prefs = usePrefs();
  const lang = usePrefs().lang;
  const [loaded, setLoaded] = useState(0);
  const storageOk = useMemo(() => {
    try {
      localStorage.setItem('cm.__t', '1');
      localStorage.removeItem('cm.__t');
      return true;
    } catch {
      return false;
    }
  }, []);
  useEffect(() => {
    const upd = () => setLoaded(listEngines().filter((d) => (engineManager.peek(d.id)?.status ?? 'idle') !== 'idle').length);
    upd();
    const off = engineManager.subscribe(upd);
    return () => {
      off();
    };
  }, []);
  return (
    <div className="space-y-5">
      <Panel title={t('set.language')}>
        <LanguageSelect value={lang} />
      </Panel>
      <Panel>
        <div className="space-y-4 text-sm">
          <p className="text-xs text-muted">{t('adv.note')}</p>
          <p>{t('adv.schema', { n: PREFS_SCHEMA })}</p>
          <p>
            {t('adv.storage')}: <span className={storageOk ? 'text-good' : 'text-bad'}>{storageOk ? t('adv.storageOk') : t('adv.storageFail')}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => download('chess-master-preferences.json', exportAll())}>{t('adv.export')}</Button>
            <Button variant="outline" size="sm" onClick={() => { if (window.confirm(t('set.resetAllConfirm'))) { resetAllPrefs(); toast(t('toast.reset')); } }}>{t('set.resetAll')}</Button>
            <Button variant="outline" size="sm" onClick={() => openTutorial()}>{t('adv.startTutorial')}</Button>
          </div>
          <ImportBox label={t('adv.import')} onText={(txt) => reportImport(importAll(txt))} />
          <div className="border-t border-line/60 pt-3">
            <p>{t('adv.engines')}: {loaded}</p>
            <Button className="mt-2" variant="outline" size="sm" onClick={() => { engineManager.dispose(); toast(t('toast.engineDisposed')); }}>{t('adv.disposeEngines')}</Button>
          </div>
          <p className="text-xs text-muted">{prefs.profiles.length} {t('cat.profiles').toLowerCase()}</p>
        </div>
      </Panel>
    </div>
  );
}

export function LanguageSelect({ value }: { value: LangPref }) {
  return (
    <select value={value} onChange={(e) => setLang(e.target.value as LangPref)} className={fieldCls} aria-label={t('set.language')} data-testid="lang-select">
      <option value="auto">{t('set.langAuto')}</option>
      {LANGS.map((l) => (
        <option key={l.id} value={l.id}>
          {l.label}
        </option>
      ))}
    </select>
  );
}

/* ---------------------------------- página ---------------------------------- */

export function SettingsPage() {
  const ui = useUi();
  const prefs = usePrefs();
  useLang();
  const [cat, setCat] = useState<Cat>('layout');
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const matches = useMemo(() => (q ? CONTROLS.filter((c) => t(`ui.${c.key}`).toLowerCase().includes(q) || c.key.toLowerCase().includes(q)) : []), [q]);
  const activeP = prefs.profiles.find((p) => p.id === prefs.activeId);
  void settingsStore;
  void getEngineDescriptor;

  return (
    <div>
      <PageHeader
        eyebrow={t('set.eyebrow')}
        title={t('set.title')}
        subtitle={t('set.subtitle')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select value={prefs.activeId} onChange={(e) => { selectProfile(e.target.value); toast(t('toast.profileSwitched', { name: prefs.profiles.find((p) => p.id === e.target.value)?.name ?? '' })); }} className={fieldCls} aria-label={t('cat.profiles')} data-testid="profile-select">
              {prefs.profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <LanguageSelect value={prefs.lang} />
          </div>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('set.search')} aria-label={t('set.search')} className={cn(fieldCls, 'min-w-60 flex-1 sm:max-w-sm')} data-testid="settings-search" />
        <span className="text-xs text-muted">✓ {t('set.autosave')}{activeP ? ` · ${activeP.name}` : ''}</span>
      </div>

      {!q && (
        <div className="mb-5 flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="categories">
          {CATS.map((c) => (
            <button key={c} role="tab" aria-selected={cat === c} onClick={() => setCat(c)} data-cat={c} className={cn('shrink-0 cursor-pointer rounded-xl border px-3.5 py-2 text-sm font-medium transition', cat === c ? 'border-accent bg-accent/12 text-accent' : 'border-line bg-surface2/60 text-muted hover:text-ink')}>
              {t(`cat.${c}`)}
            </button>
          ))}
        </div>
      )}

      {q ? (
        <Panel>
          {matches.length === 0 ? <p className="text-sm text-muted">{t('set.noResults')}</p> : matches.map((c) => <Row key={c.key} ctl={c} ui={ui} />)}
        </Panel>
      ) : (
        <div className={cn('grid items-start gap-6', cat === 'appearance' && 'xl:grid-cols-[minmax(0,1fr)_340px]')}>
          <div className="min-w-0 space-y-5">
            {cat === 'layout' && <Panel><ControlList cat="layout" ui={ui} /></Panel>}
            {cat === 'appearance' && (
              <>
                <QuickAppearance />
                <Panel title={t('cat.appearance')} hint={t('set.customColorsHint')}><ControlList cat="appearance" ui={ui} /></Panel>
              </>
            )}
            {cat === 'game' && <GameTab ui={ui} />}
            {cat === 'engines' && <EnginesTab ui={ui} />}
            {cat === 'a11y' && <Panel><ControlList cat="a11y" ui={ui} /></Panel>}
            {cat === 'advanced' && <AdvancedTab />}
            {cat === 'profiles' && <ProfilesTab />}
          </div>
          {cat === 'appearance' && <Preview />}
        </div>
      )}
    </div>
  );
}
