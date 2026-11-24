# Chess Master (evolução)

Plataforma de xadrez que roda 100% no navegador (sem backend para jogar). Base: [THATDP/Chess-Master](https://github.com/THATDP/Chess-Master) (React + Vite),
portada para este projeto Next.js **sem alterar o design original** (cliente estático, roteamento por hash `#/play`).

## Engines
| Engine | Tipo | Arquivos | Observação |
|---|---|---|---|
| Stockfish 19 lite (single-thread) | UCI · WASM · Web Worker | `public/stockfish/*.js` + **`.wasm`** | GPL-3.0 |
| Chess.js AI v2 | motor próprio · Web Worker | empacotado | chess.js (regras) + `board.ts`/`search.ts` |
| Lozza 11.0 | UCI · JS puro · Web Worker | `public/lozza/lozza-11.0.js` (650 KB, NNUE embutida) | licença permissiva (ver `LOZZA-LICENCE.txt`) |

Carregamento sob demanda (cada engine só é baixada/criada quando usada). Para adicionar uma engine: adaptador (`EngineAdapter`) + descritor + `registerEngine` em `src/cm/engines/index.ts`.

**Não integradas (e por quê)** — Berserk: sem build oficial para navegador (upstream C/Rust, GPL-3.0, rede NNUE de dezenas de MB; só existem portes WASM não oficiais, sem proveniência verificada). Lc0: requer redes neurais (dezenas de MB) e backend WebGPU/WASM experimental de terceiros; não validado aqui. Nenhuma foi simulada.

## Executar
```bash
npm install
npm run dev            # desenvolvimento
npm run build && npm start
bash scripts/test-engines.sh   # perft + Stockfish + Lozza + Chess.js AI em partidas reais (Node)
npx tsx tests/engines/bench.ts # benchmark entre níveis da Chess.js AI
node tests/e2e/e2e.mjs http://localhost:3000/   # E2E em Chromium (requer libs de sistema do Chromium + playwright-core)
```

## Publicar no GitHub Pages
`.github/workflows/deploy.yml` já faz tudo (Settings → Pages → Source: GitHub Actions). Manualmente:
```bash
bash scripts/build-pages.sh NOME-DO-REPOSITORIO   # gera ./out com basePath /NOME-DO-REPOSITORIO
```
Publique a pasta `out/` inteira (inclui `stockfish/*.wasm`, `lozza/`, `pieces/`). `.wasm` é servido como `application/wasm` pelo Pages.

## Preferências, perfis, idiomas, atalhos, tutorial
- `Ajustes`: 7 abas (Layout, Aparência, Experiência, Engines, Acessibilidade, Avançado, Perfis), pesquisa, restauração por opção e total, salvamento automático e aplicação ao vivo. A página original ficou embutida em *Experiência de jogo → Opções clássicas*.
- Perfis (`Personalizado` = aparência original, `Análise`, `Minimalista`, `Competitivo` + ilimitados): criar/renomear/duplicar/excluir/padrão/exportar/importar/restaurar. Trocar de perfil não toca a partida em andamento.
- Armazenamento: `chessmaster.settings.v1` (original, intacto) e `chessmaster.prefs.v2` (esquema versionado, validado/saneado; falha de armazenamento → padrões).
- Idiomas: PT/EN + automático (`src/cm/lib/i18n.ts`; novos idiomas = novo dicionário).
- Atalhos configuráveis com detecção de conflito (`src/cm/lib/shortcuts.ts`); ignorados ao digitar em campos.
- Tutorial opcional (9 etapas independentes), reabrível com `?`.

## Licenças
Stockfish.js (GPL-3.0), chess.js (BSD-2), Lozza (aviso do autor), peças Cburnett/Merida (GPL). Fontes via Google Fonts (opcional; há *fallback*).
