import type { EngineDefinition, EngineDescriptor } from '../types';
import { ChessJsAiAdapter } from './ChessJsAiAdapter';

export const CHESSJS_AI_ID = 'chessjs-ai';

export const chessJsAiDescriptor: EngineDescriptor = {
  id: CHESSJS_AI_ID,
  name: 'Chess.js AI',
  shortName: 'Chess.js AI',
  tagline: 'Motor próprio (alfa-beta) sobre a biblioteca chess.js',
  description:
    'O chess.js é uma biblioteca de regras, não uma engine. Aqui ele valida as regras e os lances; a decisão vem de um ' +
    'motor de busca próprio, independente do Stockfish (alfa-beta, quiescência, tabela de transposição e avaliação posicional). ' +
    'Mais simples que uma engine UCI como o Stockfish.',
  kind: 'rules-ai',
  kindLabel: 'Adversário heurístico (chess.js + lógica própria)',
  version: 'chess.js 1.4 + motor próprio v2',
  author: 'Projeto Chess Master',
  license: 'BSD-2-Clause (chess.js) · código próprio',
  homepage: 'https://github.com/jhlywa/chess.js',
  order: 2,
  capabilities: {
    evaluation: true,
    principalVariation: false,
    depthControl: true,
    timeControl: true,
    offMainThread: true,
  },
  defaultLevelId: 'normal',
  levels: [
    {
      id: 'easy',
      label: 'Fácil',
      description:
        'Busca de 2 plies sem quiescência e avaliação básica (material + posição). Erros estratégicos controlados: ' +
        'só escolhe entre lances a até 2,3 peões do melhor, com sorteio ponderado. Sempre vê mate em 1.',
      values: {},
      strengthHint: 'Iniciante',
    },
    {
      id: 'normal',
      label: 'Normal',
      description:
        'Aprofundamento iterativo até 4 plies (≤ 1,2 s), quiescência, tabela de transposição e avaliação posicional completa: ' +
        'centro, desenvolvimento, estrutura de peões, segurança do rei e mobilidade. Pequena variação entre lances equivalentes.',
      values: {},
      strengthHint: 'Jogador casual',
    },
    {
      id: 'hard',
      label: 'Difícil',
      description:
        'Alfa-beta (PVS) com aprofundamento iterativo, quiescência, tabela de transposição, killers, history heuristic, ' +
        'LMR e extensão de xeque. Joga sempre o melhor lance encontrado, até a profundidade/tempo configurados.',
      values: { depth: 5, thinkTime: 2000, hashMb: 16 },
      strengthHint: 'Clube (não calibrado)',
    },
  ],
  fields: [
    {
      key: 'depth',
      label: 'Profundidade máxima',
      description: 'Plies analisados pela busca (aprofundamento iterativo).',
      type: 'range',
      min: 1,
      max: 8,
      step: 1,
      unit: 'plies',
      visibleForLevels: ['hard', 'custom'],
    },
    {
      key: 'thinkTime',
      label: 'Tempo máximo de pensamento',
      description: 'A busca é interrompida ao atingir este limite (usa o melhor lance já encontrado).',
      type: 'range',
      min: 200,
      max: 10000,
      step: 100,
      unit: 'ms',
      visibleForLevels: ['hard', 'custom'],
    },
    {
      key: 'hashMb',
      label: 'Memória da tabela de transposição',
      description: 'Limite de memória usado pela tabela (alocada dentro do Worker).',
      type: 'range',
      min: 1,
      max: 64,
      step: 1,
      unit: 'MB',
      visibleForLevels: ['hard', 'custom'],
    },
  ],
  highlights: [
    'Motor próprio: tabuleiro 0x88 validado por perft contra o chess.js',
    'Fácil / Normal / Difícil com comportamentos realmente distintos',
    'Executa em Web Worker (recriado sob demanda) — não trava a interface',
    'Funciona sem baixar nada além do aplicativo',
  ],
  limitations: [
    'Sem livro de aberturas e sem tabelas de finais (Syzygy)',
    'Força não calibrada oficialmente: não é comparável a Stockfish/Lozza',
  ],
};

export const chessJsAiDefinition: EngineDefinition = {
  descriptor: chessJsAiDescriptor,
  create: () => new ChessJsAiAdapter(chessJsAiDescriptor),
};
