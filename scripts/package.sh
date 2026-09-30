#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/dist/whatsapp-number-link.zip"
mkdir -p "$ROOT/dist"
rm -f "$OUT"
cd "$ROOT"
zip -r "$OUT" \
  manifest.json \
  background.js \
  content.js content.css \
  phone.js \
  popup.html popup.js popup.css \
  icons/ \
  -x "*.DS_Store"
echo "Packaged: $OUT"
