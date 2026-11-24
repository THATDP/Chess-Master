/**
 * Caminhos de recursos estáticos compatíveis com GitHub Pages (subcaminho).
 * `NEXT_PUBLIC_BASE_PATH` é definido no build estático (ex.: "/Chess-Master").
 */
export const BASE_PATH: string = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/$/, '');

/** URL absoluta de um arquivo em `public/` (ex.: "stockfish/x.wasm"). */
export function assetUrl(rel: string): string {
  const clean = rel.replace(/^\/+/, '');
  if (typeof window === 'undefined') return `${BASE_PATH}/${clean}`;
  if (BASE_PATH) return new URL(`${BASE_PATH}/${clean}`, window.location.origin).toString();
  return new URL(clean, document.baseURI).toString();
}

/** Caminho (não-absoluto) usado em <img src>. */
export function assetPath(rel: string): string {
  return `${BASE_PATH}/${rel.replace(/^\/+/, '')}`;
}
