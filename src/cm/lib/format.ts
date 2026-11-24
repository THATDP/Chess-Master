import { Chess } from 'chess.js';
import type { EngineInfo } from '../engines/types';

/** "+0.35", "-1.20", "M3", "-M2". */
export function formatEval(info: EngineInfo | null | undefined): string | null {
  if (!info) return null;
  if (info.mate !== undefined) return `${info.mate < 0 ? '-' : ''}M${Math.abs(info.mate)}`;
  if (info.cp !== undefined) {
    const v = info.cp / 100;
    return `${v > 0 ? '+' : ''}${v.toFixed(2)}`;
  }
  return null;
}

/** Fração (0–1) do ponto de vista das brancas para a barra de avaliação. */
export function evalFraction(info: EngineInfo | null | undefined): number {
  if (!info) return 0.5;
  if (info.mate !== undefined) return info.mate > 0 ? 1 : info.mate < 0 ? 0 : 0.5;
  if (info.cp === undefined) return 0.5;
  return 1 / (1 + Math.exp(-info.cp / 400));
}

/** Converte variante em UCI para SAN, partindo do `fen` informado. */
export function pvToSan(fen: string, pv: string[] | undefined, max = 8): string[] {
  if (!pv?.length) return [];
  const c = new Chess(fen);
  const out: string[] = [];
  for (const uci of pv.slice(0, max)) {
    try {
      const m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      out.push(m.san);
    } catch {
      break;
    }
  }
  return out;
}

export const formatNumber = (n: number | undefined) =>
  n === undefined ? '—' : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}k` : String(n);

export const formatDate = (t: number) =>
  new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function download(filename: string, text: string, mime = 'application/x-chess-pgn') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
