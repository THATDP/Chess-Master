import { chessJsAiDefinition } from './chessjs-ai/definition';
import { lozzaDefinition } from './lozza/definition';
import { registerEngine } from './registry';
import { stockfishDefinition } from './stockfish/definition';

/**
 * Registro dos adversários disponíveis.
 * Para adicionar uma nova engine, crie seu adaptador e registre-a aqui.
 */
let done = false;
export function registerBuiltInEngines() {
  if (done) return;
  done = true;
  registerEngine(stockfishDefinition);
  registerEngine(chessJsAiDefinition);
  registerEngine(lozzaDefinition);
}

registerBuiltInEngines();

export * from './registry';
export { engineManager } from './manager';
export * from './types';
export { STOCKFISH_ID } from './stockfish/definition';
export { CHESSJS_AI_ID } from './chessjs-ai/definition';
export { LOZZA_ID } from './lozza/definition';
