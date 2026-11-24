import { prefsStore, setShortcuts } from './prefs';

export interface ShortcutDef {
  id: string;
  /** Combinação padrão, ex.: "f", "ctrl+z", "ArrowLeft". */
  def: string;
}

/** Ações disponíveis (a lógica fica em PrefsRuntime). */
export const SHORTCUTS: ShortcutDef[] = [
  { id: 'flip', def: 'f' },
  { id: 'undo', def: 'u' },
  { id: 'newGame', def: 'n' },
  { id: 'prev', def: 'ArrowLeft' },
  { id: 'next', def: 'ArrowRight' },
  { id: 'first', def: 'Home' },
  { id: 'last', def: 'End' },
  { id: 'copyFen', def: 'ctrl+shift+c' },
  { id: 'toggleTheme', def: 't' },
  { id: 'toggleFocus', def: 'z' },
  { id: 'goHome', def: 'alt+1' },
  { id: 'goPlay', def: 'alt+2' },
  { id: 'goOpponents', def: 'alt+3' },
  { id: 'goHistory', def: 'alt+4' },
  { id: 'goEngines', def: 'alt+5' },
  { id: 'goSettings', def: 'alt+6' },
  { id: 'tutorial', def: '?' },
];

export const comboOf = (id: string): string => {
  const custom = prefsStore.get().shortcuts[id];
  if (custom !== undefined) return custom;
  return SHORTCUTS.find((s) => s.id === id)?.def ?? '';
};

export function effectiveMap(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of SHORTCUTS) out[s.id] = comboOf(s.id);
  return out;
}

const MODS = ['ctrl', 'alt', 'shift', 'meta'];

/** Normaliza um KeyboardEvent em "ctrl+shift+key". */
export function eventCombo(e: KeyboardEvent): string {
  const k = e.key;
  if (MODS.includes(k.toLowerCase()) || k === 'Control' || k === 'Meta') return '';
  const parts: string[] = [];
  if (e.ctrlKey) parts.push('ctrl');
  if (e.altKey) parts.push('alt');
  if (e.metaKey) parts.push('meta');
  // Para teclas imprimíveis, o shift já está embutido no caractere (ex.: "?").
  const printable = k.length === 1;
  if (e.shiftKey && !printable) parts.push('shift');
  if (e.shiftKey && printable && /[a-z0-9]/i.test(k) && (e.ctrlKey || e.altKey || e.metaKey)) parts.push('shift');
  parts.push(k.length === 1 ? k.toLowerCase() : k);
  return parts.join('+');
}

export const normalizeCombo = (c: string) => c.trim();

/** Retorna o id do atalho que já usa `combo` (exceto `exceptId`). */
export function findConflict(combo: string, exceptId: string): string | null {
  if (!combo) return null;
  const map = effectiveMap();
  for (const [id, c] of Object.entries(map)) if (id !== exceptId && c === combo) return id;
  return null;
}

export function setShortcut(id: string, combo: string): { ok: true } | { ok: false; conflict: string } {
  const conflict = findConflict(combo, id);
  if (conflict) return { ok: false, conflict };
  const next = { ...prefsStore.get().shortcuts };
  if (combo === SHORTCUTS.find((s) => s.id === id)?.def) delete next[id];
  else next[id] = combo;
  setShortcuts(next);
  return { ok: true };
}

export function resetShortcut(id: string) {
  const next = { ...prefsStore.get().shortcuts };
  delete next[id];
  setShortcuts(next);
}

export const resetAllShortcuts = () => setShortcuts({});

/** Evita interferir na digitação. */
export function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

export const prettyCombo = (c: string) =>
  c
    ? c
        .split('+')
        .map((p) => (p === 'ArrowLeft' ? '←' : p === 'ArrowRight' ? '→' : p === 'ArrowUp' ? '↑' : p === 'ArrowDown' ? '↓' : p.length === 1 ? p.toUpperCase() : p[0].toUpperCase() + p.slice(1)))
        .join(' + ')
    : '—';
