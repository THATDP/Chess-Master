import { useSyncExternalStore } from 'react';

export interface PersistedStore<T> {
  get(): T;
  set(next: T | ((prev: T) => T)): void;
  reset(): void;
  subscribe(l: () => void): () => void;
  use(): T;
}

/**
 * Pequeno store reativo com persistência em localStorage.
 * Valores lidos são sempre normalizados por `sanitize` (resiliente a dados antigos/corrompidos).
 */
export function createPersistedStore<T>(
  key: string,
  defaults: () => T,
  sanitize: (raw: unknown) => T,
): PersistedStore<T> {
  const storage = (): Storage | null => {
    try {
      return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
      return null;
    }
  };

  const load = (): T => {
    try {
      const raw = storage()?.getItem(key);
      if (raw) return sanitize(JSON.parse(raw));
    } catch {
      /* dados corrompidos: usa padrão */
    }
    return defaults();
  };

  let state = load();
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());

  const persist = () => {
    try {
      storage()?.setItem(key, JSON.stringify(state));
    } catch {
      /* cota excedida ou modo privado */
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === key) {
        state = load();
        emit();
      }
    });
  }

  const store: PersistedStore<T> = {
    get: () => state,
    set(next) {
      state = typeof next === 'function' ? (next as (p: T) => T)(state) : next;
      persist();
      emit();
    },
    reset() {
      state = defaults();
      persist();
      emit();
    },
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    use: () => useSyncExternalStore(store.subscribe, store.get, store.get),
  };
  return store;
}
