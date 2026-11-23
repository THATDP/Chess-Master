import type { EngineDefinition, EngineDescriptor } from '../types';
import { StockfishAdapter } from './StockfishAdapter';
import { createWorkerTransport } from './transport';

export const STOCKFISH_ID = 'stockfish';

export const stockfishDescriptor: EngineDescriptor = {
  id: STOCKFISH_ID,
  name: 'Stockfish',
  shortName: 'Stockfish',
  tagline: 'Engine UCI real, compilada para WebAssembly',
  description:
    'Stockfish 19 (build "lite", thread única) executando em um Web Worker via WebAssembly. ' +
    'Calcula de verdade com busca alfa-beta e rede neural NNUE, e devolve avaliação, profundidade e variante principal.',
  kind: 'uci-engine',
  kindLabel: 'Engine de xadrez (UCI · WebAssembly)',
  version: '19 · stockfish.js 19.0.1 (lite, single-thread)',
  author: 'Equipe Stockfish · port WASM por Nathan Rugg',
  license: 'GPL-3.0',
  homepage: 'https://stockfishchess.org',
  order: 1,
  capabilities: {
    evaluation: true,
    principalVariation: true,
    depthControl: true,
    timeControl: true,
    offMainThread: true,
  },
  defaultLevelId: 'intermediate',
  levels: [
    {
      id: 'beginner',
      label: 'Iniciante',
      description: 'Skill 1 · profundidade 2 · 150 ms. Comete erros frequentes.',
      values: { skill: 1, depth: 2, movetime: 150 },
      strengthHint: '≈ 800–1000',
    },
    {
      id: 'casual',
      label: 'Casual',
      description: 'Skill 5 · profundidade 5 · 300 ms.',
      values: { skill: 5, depth: 5, movetime: 300 },
      strengthHint: '≈ 1200–1400',
    },
    {
      id: 'intermediate',
      label: 'Intermediário',
      description: 'Skill 10 · profundidade 9 · 600 ms.',
      values: { skill: 10, depth: 9, movetime: 600 },
      strengthHint: '≈ 1700–1900',
    },
    {
      id: 'advanced',
      label: 'Avançado',
      description: 'Skill 15 · profundidade 13 · 1,2 s.',
      values: { skill: 15, depth: 13, movetime: 1200 },
      strengthHint: '≈ 2200–2400',
    },
    {
      id: 'master',
      label: 'Mestre',
      description: 'Força total · profundidade 18 · 2,5 s.',
      values: { skill: 20, depth: 18, movetime: 2500 },
      strengthHint: '≈ 2800+',
    },
    {
      id: 'max',
      label: 'Máximo',
      description: 'Força total · sem limite de profundidade · 6 s por lance.',
      values: { skill: 20, depth: 0, movetime: 6000 },
      strengthHint: 'Muito acima de qualquer humano',
    },
  ],
  fields: [
    {
      key: 'skill',
      label: 'Skill Level (UCI)',
      description: '0 = comete muitos erros · 20 = força máxima.',
      type: 'range',
      min: 0,
      max: 20,
      step: 1,
    },
    {
      key: 'depth',
      label: 'Profundidade máxima',
      description: 'Limite de plies da busca. 0 = sem limite (apenas tempo).',
      type: 'range',
      min: 0,
      max: 30,
      step: 1,
      unit: 'plies',
    },
    {
      key: 'movetime',
      label: 'Tempo de cálculo por lance',
      description: 'Teto de tempo para cada jogada.',
      type: 'range',
      min: 100,
      max: 15000,
      step: 100,
      unit: 'ms',
    },
  ],
  highlights: [
    'Busca profunda com avaliação NNUE',
    'Avaliação em centipeões / mate e variante principal',
    'Roda em Web Worker: a interface nunca congela',
    'Protocolo UCI (setoption, position, go, stop)',
  ],
  limitations: [
    'Build "lite": rede menor e thread única (sem exigir cabeçalhos COOP/COEP)',
    'Primeiro carregamento baixa ≈ 1,8 MB de WebAssembly',
  ],
};

export const stockfishDefinition: EngineDefinition = {
  descriptor: stockfishDescriptor,
  create: () => new StockfishAdapter(stockfishDescriptor, () => createWorkerTransport()),
};
