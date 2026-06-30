#!/usr/bin/env bash
set -euo pipefail

MIN_ROUNDS="${MIN_ROUNDS:-5}"
MAX_ROUNDS="${MAX_ROUNDS:-10}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG_DIR="${SCRIPT_DIR}/logs"
PROMPT_DIR="${SCRIPT_DIR}/prompts"
CLAUDE_PROMPT="${PROMPT_DIR}/claude-review.md"
CODEX_PROMPT="${PROMPT_DIR}/codex-fix.md"
REVIEW_FILE="${SCRIPT_DIR}/review.md"
CHANGELOG_FILE="${SCRIPT_DIR}/changelog.md"
STATE_FILE="${SCRIPT_DIR}/state.md"

mkdir -p "${LOG_DIR}"
cd "${REPO_ROOT}"

die() {
  printf 'orchestrator: %s\n' "$*" >&2
  printf 'See .ai/RUN_MANUALLY.md for the manual fallback.\n' >&2
  exit 1
}

require_command() {
  local cmd="$1"
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    die "required command '${cmd}' was not found"
  fi
}

capture_help() {
  local cmd="$1"
  "${cmd}" --help 2>&1 || true
}

detect_claude_mode() {
  local help="$1"
  if [[ "${help}" == *"--print"* ]] || [[ "${help}" == *" -p"* ]]; then
    printf 'print\n'
    return 0
  fi
  if [[ "${help}" == *"--prompt"* ]]; then
    printf 'prompt\n'
    return 0
  fi
  return 1
}

detect_codex_mode() {
  local help="$1"
  if [[ "${help}" == *"exec"* ]]; then
    printf 'exec\n'
    return 0
  fi
  if [[ "${help}" == *"--prompt"* ]]; then
    printf 'prompt\n'
    return 0
  fi
  return 1
}

run_claude() {
  local mode="$1"
  local prompt_file="$2"
  local prompt
  prompt="$(cat "${prompt_file}")"

  case "${mode}" in
    print)
      claude -p "${prompt}"
      ;;
    prompt)
      claude --prompt "${prompt}"
      ;;
    *)
      die "could not determine a non-interactive Claude invocation"
      ;;
  esac
}

run_codex() {
  local mode="$1"
  local prompt_file="$2"
  local prompt
  prompt="$(cat "${prompt_file}")"

  case "${mode}" in
    exec)
      codex exec "${prompt}"
      ;;
    prompt)
      codex --prompt "${prompt}"
      ;;
    *)
      die "could not determine a non-interactive Codex invocation"
      ;;
  esac
}

has_npm_script() {
  local script_name="$1"
  node -e "const p=require('./package.json'); process.exit(p.scripts && p.scripts[process.argv[1]] ? 0 : 1)" "${script_name}" >/dev/null 2>&1
}

run_logged_command() {
  local log_file="$1"
  local label="$2"
  shift 2

  {
    printf '\n## %s\n' "${label}"
    printf '$'
    printf ' %q' "$@"
    printf '\n'
  } >>"${log_file}"

  set +e
  "$@" >>"${log_file}" 2>&1
  local status=$?
  set -e

  printf '\nExit code: %s\n' "${status}" >>"${log_file}"
  return "${status}"
}

run_verification() {
  local log_file="$1"
  local failed=0

  {
    printf '# Verification\n'
    printf 'Date: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  } >"${log_file}"

  if has_npm_script check; then
    run_logged_command "${log_file}" "npm run check" npm run check || failed=1
  else
    printf '\n## npm run check\nSkipped: package.json has no check script.\n' >>"${log_file}"
  fi

  if has_npm_script test; then
    run_logged_command "${log_file}" "npm test" npm test || failed=1
  else
    printf '\n## npm test\nSkipped: package.json has no test script.\n' >>"${log_file}"
  fi

  run_logged_command "${log_file}" "npm run lint --if-present" npm run lint --if-present || failed=1
  run_logged_command "${log_file}" "npm run build --if-present" npm run build --if-present || failed=1

  return "${failed}"
}

section_body() {
  local file="$1"
  local section="$2"

  awk -v section="${section}" '
    $0 == "## " section { in_section = 1; next }
    /^## / && in_section { exit }
    in_section { print }
  ' "${file}"
}

section_has_actionable_items() {
  local file="$1"
  local section="$2"
  local body

  body="$(section_body "${file}" "${section}" | sed '/^[[:space:]]*$/d')"
  [[ -n "${body}" ]] || return 1
  if printf '%s\n' "${body}" | grep -Eiq '^(none|no |no$|n/a|なし|該当なし|なし。|無し|無し。)$'; then
    return 1
  fi
  return 0
}

review_has_priority_blockers() {
  section_has_actionable_items "${REVIEW_FILE}" "Critical" || section_has_actionable_items "${REVIEW_FILE}" "High"
}

state_has_unaudited_major_areas() {
  [[ -f "${STATE_FILE}" ]] || return 0
  section_has_actionable_items "${STATE_FILE}" "Unaudited Major Areas"
}

can_stop_after_round() {
  local round="$1"
  local verification_status="$2"

  [[ "${round}" -ge "${MIN_ROUNDS}" ]] || return 1
  [[ "${verification_status}" -eq 0 ]] || return 1
  ! review_has_priority_blockers || return 1
  ! state_has_unaudited_major_areas || return 1
  return 0
}

write_git_snapshot() {
  local round="$1"
  local log_file="$2"

  {
    printf '# Round %s Git Snapshot\n' "${round}"
    printf 'Date: %s\n\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    printf '## git status --short\n'
    git status --short || true
    printf '\n## git diff --stat\n'
    git diff --stat || true
  } >"${log_file}"
}

build_claude_prompt() {
  local round="$1"
  local prompt_file="$2"
  local git_log="$3"
  local previous_codex_log="$4"
  local previous_test_log="$5"

  {
    cat "${CLAUDE_PROMPT}"
    printf '\n\n# Runtime Context\n'
    printf 'Round: %s of %s\n' "${round}" "${MAX_ROUNDS}"
    printf 'Repository: %s\n' "${REPO_ROOT}"
    printf '\n## Current AI State\n'
    if [[ -f "${STATE_FILE}" ]]; then cat "${STATE_FILE}"; else printf 'No .ai/state.md present.\n'; fi
    printf '\n\n## Current Git Snapshot\n'
    cat "${git_log}"
    printf '\n\n## Current git diff\n'
    git diff || true
    printf '\n\n## Previous Codex Output\n'
    if [[ -n "${previous_codex_log}" && -f "${previous_codex_log}" ]]; then cat "${previous_codex_log}"; else printf 'No previous Codex output.\n'; fi
    printf '\n\n## Previous Verification Output\n'
    if [[ -n "${previous_test_log}" && -f "${previous_test_log}" ]]; then cat "${previous_test_log}"; else printf 'No previous verification output.\n'; fi
  } >"${prompt_file}"
}

build_codex_prompt() {
  local round="$1"
  local prompt_file="$2"
  local test_log="$3"

  {
    cat "${CODEX_PROMPT}"
    printf '\n\n# Runtime Context\n'
    printf 'Round: %s of %s\n' "${round}" "${MAX_ROUNDS}"
    printf 'Repository: %s\n' "${REPO_ROOT}"
    printf '\n## Claude Review\n'
    cat "${REVIEW_FILE}"
    printf '\n\n## Latest Verification Output\n'
    if [[ -f "${test_log}" ]]; then cat "${test_log}"; else printf 'No verification output for this round yet.\n'; fi
  } >"${prompt_file}"
}

require_command claude
require_command codex
require_command node
require_command npm
[[ -f "${CLAUDE_PROMPT}" ]] || die "missing ${CLAUDE_PROMPT}"
[[ -f "${CODEX_PROMPT}" ]] || die "missing ${CODEX_PROMPT}"
if [[ "${MIN_ROUNDS}" -lt 1 || "${MAX_ROUNDS}" -lt "${MIN_ROUNDS}" ]]; then
  die "invalid round bounds: MIN_ROUNDS=${MIN_ROUNDS}, MAX_ROUNDS=${MAX_ROUNDS}"
fi

CLAUDE_HELP="$(capture_help claude)"
CODEX_HELP="$(capture_help codex)"
CLAUDE_MODE="$(detect_claude_mode "${CLAUDE_HELP}")" || die "Claude CLI does not expose a recognized non-interactive mode"
CODEX_MODE="$(detect_codex_mode "${CODEX_HELP}")" || die "Codex CLI does not expose a recognized non-interactive mode"

printf 'Using Claude mode: %s\n' "${CLAUDE_MODE}"
printf 'Using Codex mode: %s\n' "${CODEX_MODE}"
printf 'Round bounds: minimum %s, maximum %s\n' "${MIN_ROUNDS}" "${MAX_ROUNDS}"

previous_codex_log=""
previous_test_log=""

for round in $(seq 1 "${MAX_ROUNDS}"); do
  printf '\n== AI orchestration round %s/%s ==\n' "${round}" "${MAX_ROUNDS}"

  git_log="${LOG_DIR}/round-${round}-git.log"
  claude_log="${LOG_DIR}/round-${round}-claude.log"
  codex_log="${LOG_DIR}/round-${round}-codex.log"
  test_log="${LOG_DIR}/round-${round}-test.log"
  claude_prompt_file="${LOG_DIR}/round-${round}-claude.prompt.md"
  codex_prompt_file="${LOG_DIR}/round-${round}-codex.prompt.md"

  write_git_snapshot "${round}" "${git_log}"

  build_claude_prompt "${round}" "${claude_prompt_file}" "${git_log}" "${previous_codex_log}" "${previous_test_log}"
  if ! run_claude "${CLAUDE_MODE}" "${claude_prompt_file}" >"${claude_log}" 2>&1; then
    die "Claude review failed in round ${round}; see ${claude_log}"
  fi
  cp "${claude_log}" "${REVIEW_FILE}"

  build_codex_prompt "${round}" "${codex_prompt_file}" "${test_log}"
  if ! run_codex "${CODEX_MODE}" "${codex_prompt_file}" >"${codex_log}" 2>&1; then
    {
      printf '\n## Round %s Codex Failure\n' "${round}"
      printf -- '- Date: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
      printf -- '- Log: %s\n' "${codex_log}"
    } >>"${CHANGELOG_FILE}"
    die "Codex implementation failed in round ${round}; see ${codex_log}"
  fi

  {
    printf '\n## Round %s Codex Output\n' "${round}"
    printf -- '- Date: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    printf -- '- Log: %s\n\n' "${codex_log}"
    cat "${codex_log}"
    printf '\n'
  } >>"${CHANGELOG_FILE}"

  verification_status=0
  if run_verification "${test_log}"; then
    printf 'Verification passed after round %s.\n' "${round}"
  else
    verification_status=1
    printf 'Verification failed after round %s. Continuing.\n' "${round}"
  fi

  previous_codex_log="${codex_log}"
  previous_test_log="${test_log}"

  if can_stop_after_round "${round}" "${verification_status}"; then
    printf 'Stop conditions satisfied after round %s: minimum rounds met, no Critical/High review items, no unaudited major areas in state.md, and verification passed.\n' "${round}"
    exit 0
  fi

  if [[ "${round}" -lt "${MIN_ROUNDS}" ]]; then
    printf 'Continuing: minimum round count is %s.\n' "${MIN_ROUNDS}"
  elif [[ "${verification_status}" -ne 0 ]]; then
    printf 'Continuing: verification is still failing.\n'
  elif review_has_priority_blockers; then
    printf 'Continuing: Critical or High review items remain.\n'
  elif state_has_unaudited_major_areas; then
    printf 'Continuing: .ai/state.md still lists unaudited major areas.\n'
  else
    printf 'Continuing: stop conditions are not fully satisfied.\n'
  fi
done

die "stop conditions were not satisfied after ${MAX_ROUNDS} rounds"
