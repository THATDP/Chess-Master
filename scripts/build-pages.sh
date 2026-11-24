#!/usr/bin/env bash
# Gera o site estático (GitHub Pages) em ./out. Uso: bash scripts/build-pages.sh [nome-do-repositório]
set -euo pipefail
REPO="${1:-Chess-Master}"
cd "$(dirname "$0")/.."
# O export estático não aceita route handlers dinâmicos: /api/health é só do preview Next e é removido temporariamente.
if [ -d src/app/api ]; then mv src/app/api .api-backup; trap 'mv .api-backup src/app/api' EXIT; fi
rm -rf out
GITHUB_PAGES=true NEXT_PUBLIC_BASE_PATH="/${REPO}" npx next build
touch out/.nojekyll
echo "OK: site estático em ./out (base /${REPO}/)"
