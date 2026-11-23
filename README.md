# Chess Master

Plataforma de xadrez em React + TypeScript + Vite + Tailwind. Roda 100% no navegador (sem backend).

- **Stockfish 19** (stockfish.js, build *lite single-thread*, WebAssembly) em Web Worker, via protocolo UCI.
- **Chess.js AI**: adversário básico (chess.js gera os lances legais; a escolha é lógica própria: fácil / normal / difícil).
- Regras, FEN, PGN e SAN: **chess.js**.

## Arquitetura de adversários
`src/engines/` — `types.ts` (contratos), `registry.ts` (catálogo central), `manager.ts` (carregamento sob demanda, cancelamento, erros),
`stockfish/` (adaptador UCI) e `chessjs-ai/` (módulo de decisão + adaptador). Para adicionar uma engine: crie um adaptador
(`EngineAdapter`), um descritor e registre em `src/engines/index.ts`. Tabuleiro e partida (`src/game/GameController.ts`) não mudam.

## Hospedagem estática / GitHub Pages
- O build gera `dist/index.html` com JS/CSS/peças/worker da Chess.js AI embutidos.
- Os arquivos do Stockfish ficam em `dist/stockfish/` (copiados de `public/stockfish/`) e são resolvidos com `document.baseURI`,
  então funcionam em qualquer subcaminho (`https://usuario.github.io/repo/`). Roteamento por hash (`#/play`), sem configuração de servidor.
- Publique a pasta `dist/` inteira. `.wasm` deve ser servido como `application/wasm` (GitHub Pages já faz isso).

## Scripts
`npm run dev` · `npm run build` · `npx vitest run` (regras, promoção, roque, en passant, empates, relógios, PGN, Chess.js AI e Stockfish real).

Licenças: Stockfish.js (GPL-3.0, ver `public/stockfish/COPYING.txt`), chess.js (BSD-2), peças Cburnett e Merida (GPL).
