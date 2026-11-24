import type { EngineDefinition, EngineDescriptor } from '../types';
import { StockfishAdapter } from '../stockfish/StockfishAdapter';
import { createWorkerTransport } from '../stockfish/transport';

export const LOZZA_ID = 'lozza';

export const lozzaDescriptor: EngineDescriptor = {
  id: LOZZA_ID,
  name: 'Lozza',
  shortName: 'Lozza',
  tagline: 'Engine UCI em JavaScript puro (NNUE embutida)',
  description:
    'Lozza 11.0 (op12no2) é uma engine UCI escrita em JavaScript, com rede NNUE embutida no próprio arquivo. ' +
    'Roda em um Web Worker, sem WebAssembly e sem arquivos extras (≈ 650 KB). Carregada somente quando selecionada.',
  kind: 'uci-engine',
  kindLabel: 'Engine de xadrez (UCI · JavaScript)',
  version: '11.0 (release oficial lozza11.0.js)',
  author: 'op12no2',
  license: 'Uso livre (aviso do autor em LOZZA-LICENCE.txt)',
  homepage: 'https://github.com/op12no2/lozza',
  order: 3,
  capabilities: { evaluation: true, principalVariation: true, depthControl: true, timeControl: true, offMainThread: true },
  defaultLevelId: 'medium',
  levels: [
    { id: 'easy', label: 'Fácil', description: 'Profundidade 2 · 100 ms.', values: { depth: 2, movetime: 100 } },
    { id: 'medium', label: 'Médio', description: 'Profundidade 6 · 300 ms.', values: { depth: 6, movetime: 300 } },
    { id: 'strong', label: 'Forte', description: 'Profundidade 12 · 1 s.', values: { depth: 12, movetime: 1000 } },
    { id: 'max', label: 'Máximo', description: 'Sem limite de profundidade · 4 s por lance.', values: { depth: 0, movetime: 4000 } },
  ],
  fields: [
    { key: 'depth', label: 'Profundidade máxima', description: '0 = sem limite (apenas tempo).', type: 'range', min: 0, max: 30, step: 1, unit: 'plies' },
    { key: 'movetime', label: 'Tempo de cálculo por lance', type: 'range', min: 50, max: 15000, step: 50, unit: 'ms' },
  ],
  highlights: ['Um único arquivo JS (sem .wasm)', 'Avaliação NNUE e variante principal', 'Roda em Web Worker', 'Carregamento sob demanda'],
  limitations: ['Sem “Skill Level”: a força é limitada por profundidade e tempo', 'Mais fraca que o Stockfish'],
};

export const lozzaDefinition: EngineDefinition = {
  descriptor: lozzaDescriptor,
  create: () =>
    new StockfishAdapter(
      lozzaDescriptor,
      () => createWorkerTransport({ script: 'lozza/lozza-11.0.js', label: 'Lozza' }),
      { label: 'Lozza', initCommands: [], mapSettings: () => ({}) },
    ),
};
