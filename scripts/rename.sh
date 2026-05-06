#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-.}"
MODE="${2:---dry-run}" # --dry-run (default) or --apply

find "$ROOT_DIR" -depth -name '*~$*' -print0 |
while IFS= read -r -d '' path; do
  dir="$(dirname "$path")"
  base="$(basename "$path")"
  new_base="${base//~\$/}"
  new_path="$dir/$new_base"

  [[ "$path" == "$new_path" ]] && continue

  if [[ -e "$new_path" ]]; then
    echo "SKIP (target exists): $path -> $new_path"
    continue
  fi

  if [[ "$MODE" == "--apply" ]]; then
    mv "$path" "$new_path"
    echo "RENAMED: $path -> $new_path"
  else
    echo "DRY RUN: $path -> $new_path"
  fi
done