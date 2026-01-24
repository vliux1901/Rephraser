#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_NAME="ai_rephrase.zip"
OUTPUT_PATH="${PROJECT_ROOT}/${OUTPUT_NAME}"

EXCLUDES=(
  "build/"
  "build/**"
  ".git/"
  ".git/**"
  ".eslintrc*"
  ".eslintcache"
  "__tests__/"
  "__tests__/**"
  "jest.config.js"
  "node_modules/"
  "node_modules/**"
  "package.json"
  "package-lock.json"
)

while IFS= read -r line; do
  [[ -z "${line}" ]] && continue
  [[ "${line}" =~ ^# ]] && continue

  pattern="${line}"
  EXCLUDES+=("${pattern}")
  if [[ "${pattern}" == */ ]]; then
    EXCLUDES+=("${pattern}**")
  else
    EXCLUDES+=("${pattern}/**")
  fi
done < "${PROJECT_ROOT}/.gitignore"

cd "${PROJECT_ROOT}"
rm -f "${OUTPUT_PATH}"

EXCLUDE_ARGS=()
for pattern in "${EXCLUDES[@]}"; do
  EXCLUDE_ARGS+=("-x" "${pattern}")
done

zip -r "${OUTPUT_PATH}" . "${EXCLUDE_ARGS[@]}"
echo "Created ${OUTPUT_PATH}"
