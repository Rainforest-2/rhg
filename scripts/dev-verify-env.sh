#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-4173}"
BASE_URL="${UI_POLISH_URL:-http://${HOST}:${PORT}/}"
LOG_FILE="${LOG_FILE:-/tmp/game-preview-${PORT}.log}"
PID_FILE="${PID_FILE:-/tmp/game-preview-${PORT}.pid}"

log() {
  printf '\n\033[1;36m===== %s =====\033[0m\n' "$1"
}

has_npm_script() {
  local name="$1"
  node -e "const p=require('./package.json'); process.exit(p.scripts && p.scripts['$name'] ? 0 : 1)" >/dev/null 2>&1
}

run_node_file() {
  local file="$1"
  if [ -f "$file" ]; then
    echo "--- $file"
    node "$file"
  else
    echo "--- skip $file"
  fi
}

log "repo"
pwd
git status -sb
git log --oneline -5

log "dependency check only"
if [ ! -d node_modules ]; then
  echo "node_modules がない。先に手動でこれを実行:"
  echo "  npm install"
  exit 1
fi

if ! node -e "require('playwright')" >/dev/null 2>&1; then
  echo "playwright が入ってない。先に手動でこれを実行:"
  echo "  npm install -D playwright @playwright/test"
  echo "  npx playwright install chromium"
  echo "  sudo npx playwright install-deps chromium"
  exit 1
fi

log "gitignore local outputs"
touch .gitignore
for pat in \
  "tmp/ui-polish-screens/" \
  "tmp/playwright-*/" \
  "/playwright-report/" \
  "/test-results/"
do
  grep -qxF "$pat" .gitignore || echo "$pat" >> .gitignore
done

log "stop old preview"
scripts/stop-preview.sh || true

log "clean generated screenshots"
rm -rf tmp/ui-polish-screens
mkdir -p tmp

log "build"
if has_npm_script build; then
  npm run build
else
  echo "no build script, skipped"
fi

log "start preview"
rm -f "$LOG_FILE" "$PID_FILE"

if has_npm_script preview; then
  nohup npm run preview -- --host "$HOST" --port "$PORT" > "$LOG_FILE" 2>&1 &
elif has_npm_script dev; then
  nohup npm run dev -- --host "$HOST" --port "$PORT" > "$LOG_FILE" 2>&1 &
else
  nohup npx vite --host "$HOST" --port "$PORT" > "$LOG_FILE" 2>&1 &
fi

echo $! > "$PID_FILE"

ready=0
for i in $(seq 1 60); do
  if curl -fsS "$BASE_URL" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done

if [ "$ready" != "1" ]; then
  echo "preview failed"
  echo "---- log ----"
  cat "$LOG_FILE" || true
  exit 1
fi

echo "preview ready: $BASE_URL"

log "syntax check changed js/mjs"
TMP="$(mktemp)"
{
  git diff --name-only -- '*.js' '*.mjs' || true
  git diff --cached --name-only -- '*.js' '*.mjs' || true
  git diff --name-only HEAD~1..HEAD -- '*.js' '*.mjs' 2>/dev/null || true
} | sort -u > "$TMP"

if [ -s "$TMP" ]; then
  while IFS= read -r file; do
    [ -f "$file" ] || continue
    echo "node --check $file"
    node --check "$file"
  done < "$TMP"
else
  echo "no changed js/mjs detected"
fi

rm -f "$TMP"

log "non-battle UI playwright check"
if [ -f scripts/check-nonbattle-ui-polish.mjs ]; then
  UI_POLISH_URL="$BASE_URL" node scripts/check-nonbattle-ui-polish.mjs
else
  echo "missing scripts/check-nonbattle-ui-polish.mjs"
fi

log "battle parity"
if [ -f tests/bcu-combat-parity.test.mjs ]; then
  node --test tests/bcu-combat-parity.test.mjs
else
  echo "missing tests/bcu-combat-parity.test.mjs"
fi

log "selected BCU checks"
for f in \
  scripts/check-bcu-effect-classification-parity.mjs \
  scripts/check-effect-coordinate-traces.mjs \
  scripts/check-bcu-zombie-corpse-soul-strike-parity.mjs \
  scripts/check-bcu-stage-spawn-runtime.mjs \
  scripts/check-bcu-attack-interval-timing.mjs \
  scripts/check-battle-attack-wait-runtime.mjs \
  scripts/check-stage-runtime.mjs
do
  run_node_file "$f"
done

log "done"
echo "OK"
echo "Preview URL: $BASE_URL"
echo "Preview log: $LOG_FILE"
echo "Stop command: ./scripts/stop-preview.sh"
echo
echo "UI screenshots:"
find tmp/ui-polish-screens -maxdepth 1 -type f 2>/dev/null | sort || true
