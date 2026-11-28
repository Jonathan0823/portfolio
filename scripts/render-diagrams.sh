#!/usr/bin/env bash
# Renders every docs/diagrams/*.mmd to public/diagrams/<name>.svg with the real Mermaid CLI.
# Run it after editing a diagram: pnpm diagrams
# It downloads @mermaid-js/mermaid-cli on first use. It reuses Playwright's Chromium when one is installed;
# otherwise Puppeteer fetches its own.
set -euo pipefail
cd "$(dirname "$0")/.."
chrome=$(ls -d "$HOME"/.cache/ms-playwright/chromium-*/chrome-linux*/chrome 2>/dev/null | sort | tail -1 || true)
pconf=$(mktemp --suffix=.json)
trap 'rm -f "$pconf"' EXIT
if [ -n "$chrome" ]; then
  printf '{"executablePath":"%s","args":["--no-sandbox"]}' "$chrome" >"$pconf"
  export PUPPETEER_SKIP_DOWNLOAD=1
else
  printf '{"args":["--no-sandbox"]}' >"$pconf"
fi
for src in docs/diagrams/*.mmd; do
  name=$(basename "$src" .mmd)
  pnpm dlx @mermaid-js/mermaid-cli@11 -q -p "$pconf" -c docs/diagrams/mermaid.config.json -b transparent \
    -i "$src" -o "public/diagrams/$name.svg"
  echo "rendered $name"
done
