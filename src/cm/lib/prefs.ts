import { createPersistedStore } from './persisted';
import { defaultSettings, sanitizeSettingsObject, settingsStore, type Settings } from './settings';

/**
 * Preferências ampliadas (layout, aparência, experiência, engines, acessibilidade) + perfis.
 *
 * - Os ajustes originais continuam em `settingsStore` (chave `chessmaster.settings.v1`, intacta).
 * - Cada perfil guarda uma cópia independente de { ui, settings }.
 * - Idioma, atalhos e tutorial são GLOBAIS (valem para todos os perfis).
 * - Tudo é validado ao carregar/importar; dados inválidos nunca quebram o app.
 */
export const PREFS_SCHEMA = 2;
export const PREFS_KEY = 'chessmaster.prefs.v2';

export type LangPref = 'auto' | 'pt' | 'en';

export interface UiPrefs {
  // Layout e navegação
  navMode: 'side' | 'top' | 'both';
  density: 'compact' | 'comfortable' | 'spacious';
  layoutMode: 'adaptive' | 'centered' | 'side';
  focusMode: boolean;
  contentWidth: 'narrow' | 'default' | 'wide';
  sidebarState: 'expanded' | 'compact' | 'collapsed';
  infoPanel: 'right' | 'left' | 'hidden';
  historyPos: 'side' | 'bottom';
  header: 'full' | 'compact' | 'minimal';
  showEnginePanel: boolean;
  showMoveList: boolean;
  showActions: boolean;
  // Aparência
  palette: 'default' | 'midnight' | 'forest' | 'paper' | 'sunset' | 'mono';
  accent: string;
  bgColor: string;
  surfaceColor: string;
  inkColor: string;
  boardLight: string;
  boardDark: string;
  pieceScale: number;
  boardMax: number;
  font: 'default' | 'serif' | 'mono' | 'system' | 'rounded';
  textScale: number;
  radius: 'default' | 'sharp' | 'soft' | 'round';
  borderWidth: 1 | 2 | 3;
  spacing: number;
  opacity: number;
  animation: 'off' | 'low' | 'normal' | 'high';
  effects: boolean;
  // Experiência de jogo
  moveInput: 'both' | 'drag' | 'click';
  confirmMoves: boolean;
  autoOrient: boolean;
  highlightCheck: boolean;
  notation: 'san' | 'uci';
  // Engines
  showPv: boolean;
  showSearchInfo: boolean;
  lazyLoad: boolean;
  // Acessibilidade e desempenho
  uiScale: number;
  contrast: 'normal' | 'high';
  motion: 'system' | 'reduce' | 'full';
  altIndicators: boolean;
  keyboardNav: boolean;
  lowPerf: boolean;
  readability: boolean;
}

export function defaultUi(): UiPrefs {
  return {
    navMode: 'side',
    density: 'comfortable',
    layoutMode: 'adaptive',
    focusMode: false,
    contentWidth: 'default',
    sidebarState: 'expanded',
    infoPanel: 'right',
    historyPos: 'side',
    header: 'full',
    showEnginePanel: true,
    showMoveList: true,
    showActions: true,
    palette: 'default',
    accent: '',
    bgColor: '',
    surfaceColor: '',
    inkColor: '',
    boardLight: '',
    boardDark: '',
    pieceScale: 100,
    boardMax: 0,
    font: 'default',
    textScale: 100,
    radius: 'default',
    borderWidth: 1,
    spacing: 100,
    opacity: 100,
    animation: 'normal',
    effects: true,
    moveInput: 'both',
    confirmMoves: false,
    autoOrient: true,
    highlightCheck: true,
    notation: 'san',
    showPv: true,
    showSearchInfo: true,
    lazyLoad: true,
    uiScale: 100,
    contrast: 'normal',
    motion: 'system',
    altIndicators: false,
    keyboardNav: true,
    lowPerf: false,
    readability: false,
  };
}

const oneOf = <T extends string | number>(v: unknown, options: readonly T[], fb: T): T =>
  (options as readonly unknown[]).includes(v) ? (v as T) : fb;
const bool = (v: unknown, fb: boolean) => (typeof v === 'boolean' ? v : fb);
const num = (v: unknown, min: number, max: number, fb: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fb;
const hex = (v: unknown, fb: string) => (typeof v === 'string' && (v === '' || /^#[0-9a-fA-F]{6}$/.test(v)) ? v.toLowerCase() : fb);

export function sanitizeUi(raw: unknown): UiPrefs {
  const d = defaultUi();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, unknown>;
  return {
    navMode: oneOf(r.navMode, ['side', 'top', 'both'] as const, d.navMode),
    density: oneOf(r.density, ['compact', 'comfortable', 'spacious'] as const, d.density),
    layoutMode: oneOf(r.layoutMode, ['adaptive', 'centered', 'side'] as const, d.layoutMode),
    focusMode: bool(r.focusMode, d.focusMode),
    contentWidth: oneOf(r.contentWidth, ['narrow', 'default', 'wide'] as const, d.contentWidth),
    sidebarState: oneOf(r.sidebarState, ['expanded', 'compact', 'collapsed'] as const, d.sidebarState),
    infoPanel: oneOf(r.infoPanel, ['right', 'left', 'hidden'] as const, d.infoPanel),
    historyPos: oneOf(r.historyPos, ['side', 'bottom'] as const, d.historyPos),
    header: oneOf(r.header, ['full', 'compact', 'minimal'] as const, d.header),
    showEnginePanel: bool(r.showEnginePanel, d.showEnginePanel),
    showMoveList: bool(r.showMoveList, d.showMoveList),
    showActions: bool(r.showActions, d.showActions),
    palette: oneOf(r.palette, ['default', 'midnight', 'forest', 'paper', 'sunset', 'mono'] as const, d.palette),
    accent: hex(r.accent, d.accent),
    bgColor: hex(r.bgColor, d.bgColor),
    surfaceColor: hex(r.surfaceColor, d.surfaceColor),
    inkColor: hex(r.inkColor, d.inkColor),
    boardLight: hex(r.boardLight, d.boardLight),
    boardDark: hex(r.boardDark, d.boardDark),
    pieceScale: num(r.pieceScale, 70, 115, d.pieceScale),
    boardMax: r.boardMax === 0 ? 0 : num(r.boardMax, 320, 1000, d.boardMax),
    font: oneOf(r.font, ['default', 'serif', 'mono', 'system', 'rounded'] as const, d.font),
    textScale: num(r.textScale, 85, 135, d.textScale),
    radius: oneOf(r.radius, ['default', 'sharp', 'soft', 'round'] as const, d.radius),
    borderWidth: oneOf(r.borderWidth, [1, 2, 3] as const, d.borderWidth),
    spacing: num(r.spacing, 70, 140, d.spacing),
    opacity: num(r.opacity, 60, 100, d.opacity),
    animation: oneOf(r.animation, ['off', 'low', 'normal', 'high'] as const, d.animation),
    effects: bool(r.effects, d.effects),
    moveInput: oneOf(r.moveInput, ['both', 'drag', 'click'] as const, d.moveInput),
    confirmMoves: bool(r.confirmMoves, d.confirmMoves),
    autoOrient: bool(r.autoOrient, d.autoOrient),
    highlightCheck: bool(r.highlightCheck, d.highlightCheck),
    notation: oneOf(r.notation, ['san', 'uci'] as const, d.notation),
    showPv: bool(r.showPv, d.showPv),
    showSearchInfo: bool(r.showSearchInfo, d.showSearchInfo),
    lazyLoad: bool(r.lazyLoad, d.lazyLoad),
    uiScale: num(r.uiScale, 85, 140, d.uiScale),
    contrast: oneOf(r.contrast, ['normal', 'high'] as const, d.contrast),
    motion: oneOf(r.motion, ['system', 'reduce', 'full'] as const, d.motion),
    altIndicators: bool(r.altIndicators, d.altIndicators),
    keyboardNav: bool(r.keyboardNav, d.keyboardNav),
    lowPerf: bool(r.lowPerf, d.lowPerf),
    readability: bool(r.readability, d.readability),
  };
}

export interface ProfileData {
  ui: UiPrefs;
  settings: Settings;
}

export interface Profile {
  id: string;
  name: string;
  builtin?: 'analysis' | 'minimal' | 'competitive' | 'custom';
  data: ProfileData;
}

export interface PrefsState {
  schema: number;
  activeId: string;
  defaultId: string;
  profiles: Profile[];
  lang: LangPref;
  shortcuts: Record<string, string>;
  tutorialDone: boolean;
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Dados de fábrica dos perfis iniciais. */
export function builtinData(kind: NonNullable<Profile['builtin']>, base: Settings = defaultSettings()): ProfileData {
  const ui = defaultUi();
  const settings = clone(base);
  if (kind === 'analysis') {
    Object.assign(ui, { density: 'compact', contentWidth: 'wide', header: 'compact', showPv: true, showSearchInfo: true });
    Object.assign(settings, { showEval: true, allowUndo: true, animationSpeed: 'fast' });
  } else if (kind === 'minimal') {
    Object.assign(ui, { header: 'minimal', sidebarState: 'compact', effects: false, animation: 'low', showSearchInfo: false, showPv: false, density: 'compact' });
    Object.assign(settings, { animationSpeed: 'fast', sound: false, showEval: false });
  } else if (kind === 'competitive') {
    Object.assign(ui, { header: 'compact', animation: 'low', showPv: false, showSearchInfo: false, historyPos: 'side', highlightCheck: true });
    Object.assign(settings, { showEval: false, allowUndo: false, showLegalMoves: false, animationSpeed: 'fast' });
  }
  return { ui, settings };
}

const BUILTIN_NAMES: Record<NonNullable<Profile['builtin']>, string> = {
  custom: 'Personalizado',
  analysis: 'Análise',
  minimal: 'Minimalista',
  competitive: 'Competitivo',
};

const uid = () => `p_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function initialState(legacy: Settings): PrefsState {
  const custom: Profile = { id: 'custom', name: BUILTIN_NAMES.custom, builtin: 'custom', data: { ui: defaultUi(), settings: clone(legacy) } };
  const mk = (k: 'analysis' | 'minimal' | 'competitive'): Profile => ({ id: k, name: BUILTIN_NAMES[k], builtin: k, data: builtinData(k, legacy) });
  return {
    schema: PREFS_SCHEMA,
    activeId: 'custom',
    defaultId: 'custom',
    profiles: [custom, mk('analysis'), mk('minimal'), mk('competitive')],
    lang: 'pt',
    shortcuts: {},
    tutorialDone: false,
  };
}

function sanitizeProfile(raw: unknown, fallbackId?: string): Profile | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const data = (r.data ?? {}) as Record<string, unknown>;
  const name = typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, 40) : 'Perfil';
  const id = typeof r.id === 'string' && /^[\w-]{1,40}$/.test(r.id) ? r.id : (fallbackId ?? uid());
  const builtin = ['analysis', 'minimal', 'competitive', 'custom'].includes(r.builtin as string) ? (r.builtin as Profile['builtin']) : undefined;
  return { id, name, builtin, data: { ui: sanitizeUi(data.ui), settings: sanitizeSettingsObject(data.settings) } };
}

export function sanitizePrefs(raw: unknown): PrefsState {
  const legacy = settingsStore.get();
  const init = initialState(legacy);
  if (!raw || typeof raw !== 'object') return init;
  const r = raw as Record<string, unknown>;
  if (typeof r.schema === 'number' && r.schema > PREFS_SCHEMA) return init; // versão futura desconhecida
  const profiles: Profile[] = [];
  const seen = new Set<string>();
  if (Array.isArray(r.profiles)) {
    for (const p of r.profiles.slice(0, 50)) {
      const sp = sanitizeProfile(p);
      if (sp && !seen.has(sp.id)) {
        seen.add(sp.id);
        profiles.push(sp);
      }
    }
  }
  if (profiles.length === 0) return init;
  const shortcuts: Record<string, string> = {};
  if (r.shortcuts && typeof r.shortcuts === 'object') {
    for (const [k, v] of Object.entries(r.shortcuts as Record<string, unknown>)) {
      if (typeof v === 'string' && v.length <= 40 && /^[\w+\-?/., ]*$/.test(k)) shortcuts[k] = v;
    }
  }
  const defaultId = profiles.some((p) => p.id === r.defaultId) ? (r.defaultId as string) : profiles[0].id;
  return {
    schema: PREFS_SCHEMA,
    activeId: defaultId, // o perfil padrão é carregado na abertura
    defaultId,
    profiles,
    lang: oneOf(r.lang, ['auto', 'pt', 'en'] as const, 'pt'),
    shortcuts,
    tutorialDone: bool(r.tutorialDone, false),
  };
}

export const prefsStore = createPersistedStore<PrefsState>(PREFS_KEY, () => initialState(settingsStore.get()), sanitizePrefs);

/* ------------------------------ acesso/hook ------------------------------ */

export const activeProfile = (s: PrefsState = prefsStore.get()): Profile => s.profiles.find((p) => p.id === s.activeId) ?? s.profiles[0];
export const getUi = (): UiPrefs => activeProfile().data.ui;
export const usePrefs = () => prefsStore.use();
export function useUi(): UiPrefs {
  return activeProfile(prefsStore.use()).data.ui;
}

function mutateActive(fn: (p: Profile) => Profile) {
  prefsStore.set((s) => ({ ...s, profiles: s.profiles.map((p) => (p.id === s.activeId ? fn(p) : p)) }));
}

export function updateUi(patch: Partial<UiPrefs>) {
  mutateActive((p) => ({ ...p, data: { ...p.data, ui: sanitizeUi({ ...p.data.ui, ...patch }) } }));
}

export function resetUiKeys(keys: (keyof UiPrefs)[]) {
  const d = defaultUi();
  const patch: Record<string, unknown> = {};
  for (const k of keys) patch[k] = d[k];
  updateUi(patch as Partial<UiPrefs>);
}

/** Restauração completa: interface + ajustes clássicos. NÃO apaga histórico de partidas nem a partida em andamento. */
export function resetAllPrefs() {
  mutateActive((p) => ({ ...p, data: { ui: defaultUi(), settings: defaultSettings() } }));
  settingsStore.set(defaultSettings());
}

/* --------------------------------- perfis --------------------------------- */

export function selectProfile(id: string) {
  const s = prefsStore.get();
  const p = s.profiles.find((x) => x.id === id);
  if (!p || p.id === s.activeId) return;
  prefsStore.set({ ...s, activeId: id });
  // Apenas atualiza as preferências: a partida em andamento (GameController) não é tocada.
  settingsStore.set(clone(p.data.settings));
}

export function createProfile(name: string, from: 'current' | 'default' = 'current'): string {
  const s = prefsStore.get();
  const base = activeProfile(s).data;
  const id = uid();
  const data = from === 'current' ? clone(base) : { ui: defaultUi(), settings: defaultSettings() };
  prefsStore.set({ ...s, profiles: [...s.profiles, { id, name: name.trim().slice(0, 40) || 'Novo perfil', data }] });
  return id;
}

export function renameProfile(id: string, name: string) {
  const n = name.trim().slice(0, 40);
  if (!n) return;
  prefsStore.set((s) => ({ ...s, profiles: s.profiles.map((p) => (p.id === id ? { ...p, name: n } : p)) }));
}

export function duplicateProfile(id: string): string | null {
  const s = prefsStore.get();
  const p = s.profiles.find((x) => x.id === id);
  if (!p) return null;
  const nid = uid();
  prefsStore.set({ ...s, profiles: [...s.profiles, { id: nid, name: `${p.name} (cópia)`.slice(0, 40), data: clone(p.data) }] });
  return nid;
}

export function deleteProfile(id: string): boolean {
  const s = prefsStore.get();
  if (s.profiles.length <= 1) return false;
  const profiles = s.profiles.filter((p) => p.id !== id);
  const defaultId = s.defaultId === id ? profiles[0].id : s.defaultId;
  const activeWasDeleted = s.activeId === id;
  prefsStore.set({ ...s, profiles, defaultId, activeId: activeWasDeleted ? defaultId : s.activeId });
  if (activeWasDeleted) settingsStore.set(clone(profiles.find((p) => p.id === defaultId)!.data.settings));
  return true;
}

export function setDefaultProfile(id: string) {
  prefsStore.set((s) => (s.profiles.some((p) => p.id === id) ? { ...s, defaultId: id } : s));
}

/** Restaura um perfil para os valores de fábrica (perfis iniciais) ou padrão geral. */
export function restoreProfile(id: string) {
  const s = prefsStore.get();
  const p = s.profiles.find((x) => x.id === id);
  if (!p) return;
  const data = p.builtin ? builtinData(p.builtin) : { ui: defaultUi(), settings: defaultSettings() };
  prefsStore.set({ ...s, profiles: s.profiles.map((x) => (x.id === id ? { ...x, data } : x)) });
  if (s.activeId === id) settingsStore.set(clone(data.settings));
}

export function exportProfile(id: string): string {
  const p = prefsStore.get().profiles.find((x) => x.id === id);
  return JSON.stringify({ app: 'chess-master', kind: 'profile', schema: PREFS_SCHEMA, profile: p ? { name: p.name, data: p.data } : null }, null, 2);
}

export type ImportResult = { ok: true; count: number } | { ok: false; error: string };

export function importProfile(text: string): ImportResult {
  try {
    if (text.length > 2_000_000) return { ok: false, error: 'file-too-large' };
    const j = JSON.parse(text) as Record<string, unknown>;
    if (!j || typeof j !== 'object' || j.app !== 'chess-master') return { ok: false, error: 'invalid-file' };
    if (typeof j.schema === 'number' && j.schema > PREFS_SCHEMA) return { ok: false, error: 'newer-schema' };
    const list: unknown[] = j.kind === 'profile' ? [j.profile] : Array.isArray(j.profiles) ? j.profiles : [];
    const added: Profile[] = [];
    for (const raw of list.slice(0, 30)) {
      const sp = sanitizeProfile({ ...(raw as object), id: undefined });
      if (sp) added.push({ ...sp, id: uid(), builtin: undefined });
    }
    if (added.length === 0) return { ok: false, error: 'invalid-file' };
    prefsStore.set((s) => ({ ...s, profiles: [...s.profiles, ...added] }));
    if (j.kind === 'all') {
      if (j.lang === 'auto' || j.lang === 'pt' || j.lang === 'en') prefsStore.set((s) => ({ ...s, lang: j.lang as LangPref }));
    }
    return { ok: true, count: added.length };
  } catch {
    return { ok: false, error: 'invalid-json' };
  }
}

export function exportAll(): string {
  const s = prefsStore.get();
  return JSON.stringify({ app: 'chess-master', kind: 'all', schema: PREFS_SCHEMA, lang: s.lang, shortcuts: s.shortcuts, profiles: s.profiles.map((p) => ({ name: p.name, data: p.data })) }, null, 2);
}

export function importAll(text: string): ImportResult {
  try {
    const j = JSON.parse(text) as Record<string, unknown>;
    if (!j || j.app !== 'chess-master') return { ok: false, error: 'invalid-file' };
    if (j.kind === 'profile') return importProfile(text);
    const res = importProfile(text.replace(/"kind":\s*"all"/, '"kind":"all"'));
    if (res.ok && j.shortcuts && typeof j.shortcuts === 'object') {
      const sc: Record<string, string> = {};
      for (const [k, v] of Object.entries(j.shortcuts as Record<string, unknown>)) if (typeof v === 'string' && v.length <= 40) sc[k] = v;
      prefsStore.set((s) => ({ ...s, shortcuts: sc }));
    }
    return res;
  } catch {
    return { ok: false, error: 'invalid-json' };
  }
}

export const setLang = (lang: LangPref) => prefsStore.set((s) => ({ ...s, lang }));
export const setTutorialDone = (v: boolean) => prefsStore.set((s) => ({ ...s, tutorialDone: v }));
export const setShortcuts = (shortcuts: Record<string, string>) => prefsStore.set((s) => ({ ...s, shortcuts }));

/* ------------------- sincronização: ajustes clássicos ⇄ perfil ------------------- */

let booted = false;
/** Aplica o perfil padrão aos ajustes clássicos e passa a gravar mudanças dos ajustes no perfil ativo. */
export function bootPrefs() {
  if (booted) return;
  booted = true;
  const s = prefsStore.get();
  const p = activeProfile(s);
  settingsStore.set(clone(p.data.settings));
  settingsStore.subscribe(() => {
    const cur = settingsStore.get();
    const st = prefsStore.get();
    const ap = activeProfile(st);
    if (JSON.stringify(ap.data.settings) === JSON.stringify(cur)) return;
    mutateActive((x) => ({ ...x, data: { ...x.data, settings: clone(cur) } }));
  });
}
