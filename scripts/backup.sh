#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# aQuaStock Pro — backup.sh
# Membuat arsip tar.gz dari file aplikasi + database, simpan 14 terbaru.
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${ROOT_DIR}/backups"
STAMP="$(date +%Y%m%d-%H%M%S)"
ARCHIVE="${BACKUP_DIR}/aquastock-${STAMP}.tar.gz"

mkdir -p "$BACKUP_DIR"

tar -czf "$ARCHIVE" \
  -C "$ROOT_DIR" \
  public docs database scripts \
  README.md package.json .gitignore 2>/dev/null || true

echo "✅ Backup dibuat: ${ARCHIVE}"

# Retensi: pertahankan 14 backup terbaru
ls -1t "${BACKUP_DIR}"/aquastock-*.tar.gz 2>/dev/null | tail -n +15 | while read -r f; do
  rm -f "$f"
  echo "🗑️  Hapus backup lama: $(basename "$f")"
done
