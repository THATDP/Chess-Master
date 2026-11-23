import type { EngineDefinition, EngineDescriptor } from '../types';
import { ChessJsAiAdapter } from './ChessJsAiAdapter';

export const CHESSJS_AI_ID = 'chessjs-ai';

export const chessJsAiDescriptor: EngineDescriptor = {
  id: CHESSJS_AI_ID,
  name: 'Chess.js AI',
  shortName: 'Chess.js AI',
  tagline: 'Adversário básico sobre a biblioteca chess.js',
  description:
    'O chess.js é uma biblioteca de regras, não uma engine. Este adversário usa o chess.js apenas para gerar ' +
    'lances legais e aplica uma lógica de decisão própria, escrita neste projeto. É simples, rápido e sempre joga lances legais — ' +
    'mas não se compara a uma engine como o Stockfish.',
  kind: 'rules-ai',
  kindLabel: 'Adversário heurístico (chess.js + lógica própria)',
  version: 'chess.js 1.4 + estratégia própria',
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
      description: 'Escolhe entre lances legais com preferência simples por capturas e xeques. Vê mate em 1. Não calcula riscos.',
      values: {},
      strengthHint: 'Iniciante',
    },
    {
      id: 'normal',
      label: 'Normal',
      description:
        'Pontua cada lance: capturas vantajosas, peças em risco, desenvolvimento, roque e segurança do rei. Olha 1 resposta do adversário.',
      values: {},
      strengthHint: 'Jogador casual',
    },
    {
      id: 'hard',
      label: 'Difícil',
      description:
        'Busca alfa-beta com quiescência (capturas) e avaliação de material, mobilidade, centro, segurança do rei e ameaças táticas simples.',
      values: { depth: 3, thinkTime: 1500 },
      strengthHint: 'Clube iniciante',
    },
  ],
  fields: [
    {
      key: 'depth',
      label: 'Profundidade máxima',
      description: 'Plies analisados pela busca (aprofundamento iterativo).',
      type: 'range',
      min: 1,
      max: 4,
      step: 1,
      unit: 'plies',
      visibleForLevels: ['hard', 'custom'],
    },
    {
      key: 'thinkTime',
      label: 'Tempo máximo de pensamento',
      description: 'A busca é interrompida ao atingir este limite.',
      type: 'range',
      min: 200,
      max: 5000,
      step: 100,
      unit: 'ms',
      visibleForLevels: ['hard', 'custom'],
    },
  ],
  highlights: [
    'Resposta rápida e sempre com lances legais',
    'Três comportamentos distintos (fácil, normal, difícil)',
    'Executa em Web Worker — não trava a interface',
    'Funciona sem baixar nada além do aplicativo',
  ],
  limitations: [
    'Não é uma engine de xadrez: profundidade e conhecimento muito limitados',
    'Sem livro de aberturas, finais ou tabelas de transposição',
  ],
};

export const chessJsAiDefinition: EngineDefinition = {
  descriptor: chessJsAiDescriptor,
  create: () => new ChessJsAiAdapter(chessJsAiDescriptor),
};
