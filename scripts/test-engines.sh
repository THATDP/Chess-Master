#!/usr/bin/env bash
# Testes reais das engines (Node): perft, Stockfish, Lozza e Chess.js AI. Uso: bash scripts/test-engines.sh
set -euo pipefail
cd "$(dirname "$0")/.."
npx tsx tests/engines/run-tests.ts
