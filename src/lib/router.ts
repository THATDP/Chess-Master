import { useSyncExternalStore } from 'react';

/**
 * Roteador por hash (#/rota): funciona em hospedagem estática (GitHub Pages)
 * sem configuração de servidor e em qualquer subcaminho.
 */
export type RouteName = 'home' | 'play' | 'opponents' | 'settings' | 'history' | 'replay' | 'engines';

export interface Route {
  name: RouteName;
  param?: string;
}

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '').split('?')[0];
  const [first, second] = path.split('/').filter(Boolean);
  switch (first) {
    case 'play':
    case 'opponents':
    case 'settings':
    case 'engines':
      return { name: first };
    case 'history':
      return second ? { name: 'replay', param: decodeURIComponent(second) } : { name: 'history' };
    default:
      return { name: 'home' };
  }
}

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};
const getHash = () => window.location.hash;

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getHash, () => '');
  return parseHash(hash);
}

export function navigate(to: string) {
  window.location.hash = to.startsWith('#') ? to : `#${to}`;
}

export const hrefTo = (path: string) => `#${path}`;
