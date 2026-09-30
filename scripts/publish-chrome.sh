#!/usr/bin/env bash
# Upload + publish to Chrome Web Store (https://chrome.google.com/webstore/devconsole)
# Requires env: CHROME_EXTENSION_ID, CHROME_CLIENT_ID, CHROME_CLIENT_SECRET, CHROME_REFRESH_TOKEN
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ZIP="$ROOT/dist/whatsapp-number-link.zip"

"$ROOT/scripts/package.sh"

: "${CHROME_EXTENSION_ID:?Set CHROME_EXTENSION_ID}"
: "${CHROME_CLIENT_ID:?Set CHROME_CLIENT_ID}"
: "${CHROME_CLIENT_SECRET:?Set CHROME_CLIENT_SECRET}"
: "${CHROME_REFRESH_TOKEN:?Set CHROME_REFRESH_TOKEN}"

npx --yes chrome-webstore-upload-cli@3 upload \
  --source "$ZIP" \
  --extension-id "$CHROME_EXTENSION_ID" \
  --client-id "$CHROME_CLIENT_ID" \
  --client-secret "$CHROME_CLIENT_SECRET" \
  --refresh-token "$CHROME_REFRESH_TOKEN"

npx --yes chrome-webstore-upload-cli@3 publish \
  --extension-id "$CHROME_EXTENSION_ID" \
  --client-id "$CHROME_CLIENT_ID" \
  --client-secret "$CHROME_CLIENT_SECRET" \
  --refresh-token "$CHROME_REFRESH_TOKEN"

echo "Published extension $CHROME_EXTENSION_ID"
