#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# aQuaStock Pro — deploy.sh (placeholder)
# Deploy folder `public/` ke hosting statis.
#
#   scripts/deploy.sh netlify
#   scripts/deploy.sh vercel
#   scripts/deploy.sh user@host:/var/www/aquastock   (via rsync)
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PUBLIC_DIR="${ROOT_DIR}/public"
TARGET="${1:-}"

if [[ -z "$TARGET" ]]; then
  echo "Usage: scripts/deploy.sh <target>"
  echo "  netlify | vercel | <user@host:/path> (rsync)"
  exit 1
fi

echo "🚀 Deploy aQuaStock Pro dari ${PUBLIC_DIR} → ${TARGET}"

case "$TARGET" in
  netlify)
    npx --yes netlify-cli deploy --dir "$PUBLIC_DIR" --prod
    ;;
  vercel)
    npx --yes vercel deploy --prod "$PUBLIC_DIR"
    ;;
  *)
    rsync -avz --delete "$PUBLIC_DIR/" "$TARGET"
    ;;
esac

echo "✅ Deploy selesai: ${TARGET}"
