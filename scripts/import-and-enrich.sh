#!/bin/bash

# Google Sheetsから取得したタイトル・著者データを反映し、
# ISBN・ページ数・表紙画像を一括取得するスクリプト
#
# 使い方:
#   pbpaste | ./scripts/import-and-enrich.sh        # クリップボードから
#   ./scripts/import-and-enrich.sh data/result.tsv   # TSVファイルから
#   pbpaste | ./scripts/import-and-enrich.sh --dry-run  # 確認のみ

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DRY_RUN=""
INPUT_FILE=""

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN="--dry-run" ;;
    *) INPUT_FILE="$arg" ;;
  esac
done

# Determine input source
if [ -n "$INPUT_FILE" ]; then
  SOURCE="$INPUT_FILE"
else
  SOURCE="-"
fi

echo "=== 1/3 タイトル・著者を反映 ==="
if [ "$SOURCE" = "-" ]; then
  cat | node "$SCRIPT_DIR/import-titles-tsv.mjs" - $DRY_RUN
else
  node "$SCRIPT_DIR/import-titles-tsv.mjs" "$SOURCE" $DRY_RUN
fi

echo ""
echo "=== 2/3 ISBN・ページ数を取得 ==="
node "$SCRIPT_DIR/fetch-metadata.mjs" $DRY_RUN

echo ""
echo "=== 3/3 表紙画像URLを取得 ==="
node "$SCRIPT_DIR/fetch-covers.mjs" $DRY_RUN
