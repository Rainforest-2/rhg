# Claude Review Prompt

You are the reviewer for this repository.

Do not edit code, documentation, tests, workflows, or generated files directly. Read the previous Codex output, verification results, git status, git diff, `.ai/state.md`, and repository context, then identify the next smallest implementation task for Codex.

Focus on concrete, actionable defects. Prefer one narrow fix that can be implemented and verified in the next Codex pass. Do not ask for broad rewrites, speculative refactors, or unrelated cleanup.

Passing verification is not enough to stop the loop. Every round must include fresh audit work. Prioritize unaudited production code areas listed in `.ai/state.md` over re-reviewing the previous Codex patch, while still checking the previous patch for regressions.

When you choose the next task, include any required `.ai/state.md` bookkeeping in that task so Codex records:
- the production area audited this round,
- the remaining unaudited major areas,
- any unresolved uncertainty.

The `Critical` and `High` sections must contain only actionable blockers. If there are none, write exactly `None`.

The loop may stop only when all of these are true:
- at least 5 Claude -> Codex -> verification rounds have completed,
- `Critical` is exactly `None`,
- `High` is exactly `None`,
- `.ai/state.md` has no actionable entries under `## Unaudited Major Areas`,
- the latest verification passed.

Your output must use exactly this structure:

# Review
## Critical
## High
## Medium
## Low
## Next Codex Task
## Verification Commands
## Stop Condition


# Runtime Context
Round: 1 of 10
Repository: /workspaces/rhg

## Current AI State
# Current Status

## Discovered Issues
- No critical issues recorded yet.
- Fixed `js/input/BcuBattleInputAdapter.js` inherited-property action lookup: `in` treated `Object.prototype` names such as `toString` as known actions instead of falling through to slot index/null behavior.

## Current Task
- Fix `js/input/BcuBattleInputAdapter.js` inherited-property action lookup and record the `js/input` audit state.

## Audited Areas
- `.ai/orchestrator.sh` verification command ordering and per-round logging behavior.
- `.ai` loop README wording for round log persistence.
- `js/input` — `BcuBattleInputAdapter.js` action mapping own-property fix with focused test coverage, plus read-through of `BcuDomTouchPolicy.js` and `BcuMobileGestureRuntime.js`.

## Unaudited Major Areas
- `js/battle`
- `js/bcu`
- `js/bcu-render`
- `js/boot`
- `js/data`
- `js/preview`
- `js/ui`
- `js/audio`
- `scripts`
- `tests`

## Unresolved
- `js/input/BcuMobileGestureRuntime.js` slide angle/threshold and up/down direction (`TAN_50`, `height * 0.15`, `dy / dragFrame < 0`) have not been confirmed against BCU touch source; audit in a later round before claiming BCU parity.

## Completed
- Created AI management directory and core files.
- Added workflow scaffolding for the development loop.
- Documented usage in the repository README.

## Remaining
- Continue Claude -> Codex -> verification rounds until the minimum round count, priority blocker, unaudited major area, and verification stop conditions are all satisfied.


## Current Git Snapshot
# Round 1 Git Snapshot
Date: 2026-06-30T23:14:54Z

## git status --short --untracked-files=no
[Limited to 200 lines; untracked files omitted.]
 M .ai/orchestrator.sh

## git diff --name-status
[Limited to 20 files; .ai/logs and node_modules omitted.]
M	.ai/orchestrator.sh


## Current git diff
[Excerpt: current git diff for configured project paths, excluding .ai/logs and node_modules, limited to 20 files and 12000 bytes per file; total budget 60000 bytes.]

### .ai/orchestrator.sh
diff --git a/.ai/orchestrator.sh b/.ai/orchestrator.sh
index cc4048fd5..3319010c8 100755
--- a/.ai/orchestrator.sh
+++ b/.ai/orchestrator.sh
@@ -3,6 +3,34 @@ set -euo pipefail
 
 MIN_ROUNDS="${MIN_ROUNDS:-5}"
 MAX_ROUNDS="${MAX_ROUNDS:-10}"
+STATE_CONTEXT_MAX_BYTES="${STATE_CONTEXT_MAX_BYTES:-20000}"
+GIT_SNAPSHOT_MAX_BYTES="${GIT_SNAPSHOT_MAX_BYTES:-12000}"
+GIT_DIFF_MAX_BYTES="${GIT_DIFF_MAX_BYTES:-60000}"
+GIT_STATUS_MAX_LINES="${GIT_STATUS_MAX_LINES:-200}"
+GIT_DIFF_MAX_FILES="${GIT_DIFF_MAX_FILES:-20}"
+GIT_DIFF_PER_FILE_MAX_BYTES="${GIT_DIFF_PER_FILE_MAX_BYTES:-12000}"
+PREVIOUS_LOG_MAX_BYTES="${PREVIOUS_LOG_MAX_BYTES:-30000}"
+REVIEW_CONTEXT_MAX_BYTES="${REVIEW_CONTEXT_MAX_BYTES:-30000}"
+TEST_CONTEXT_MAX_BYTES="${TEST_CONTEXT_MAX_BYTES:-30000}"
+GIT_CONTEXT_PATHS=(
+  ".ai/changelog.md"
+  ".ai/mission.md"
+  ".ai/orchestrator.sh"
+  ".ai/prompts"
+  ".ai/review.md"
+  ".ai/RUN_MANUALLY.md"
+  ".ai/state.md"
+  ".ai/tasks.md"
+  ".github"
+  "README.md"
+  "docs"
+  "js"
+  "package.json"
+  "package-lock.json"
+  "scripts"
+  "tests"
+  "vite.config.js"
+)
 
 SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
 REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
@@ -13,6 +41,8 @@ CODEX_PROMPT="${PROMPT_DIR}/codex-fix.md"
 REVIEW_FILE="${SCRIPT_DIR}/review.md"
 CHANGELOG_FILE="${SCRIPT_DIR}/changelog.md"
 STATE_FILE="${SCRIPT_DIR}/state.md"
+CLAUDE_STDIN_INSTRUCTION="Read the complete review task from standard input. Follow it exactly."
+CODEX_STDIN_INSTRUCTION="Read the complete implementation task from standard input. Follow it exactly."
 
 mkdir -p "${LOG_DIR}"
 cd "${REPO_ROOT}"
@@ -64,15 +94,13 @@ detect_codex_mode() {
 run_claude() {
   local mode="$1"
   local prompt_file="$2"
-  local prompt
-  prompt="$(cat "${prompt_file}")"
 
   case "${mode}" in
     print)
-      claude -p "${prompt}"
+      claude -p --input-format text "${CLAUDE_STDIN_INSTRUCTION}" <"${prompt_file}"
       ;;
     prompt)
-      claude --prompt "${prompt}"
+      claude --prompt "${CLAUDE_STDIN_INSTRUCTION}" <"${prompt_file}"
       ;;
     *)
       die "could not determine a non-interactive Claude invocation"
@@ -83,15 +111,13 @@ run_claude() {
 run_codex() {
   local mode="$1"
   local prompt_file="$2"
-  local prompt
-  prompt="$(cat "${prompt_file}")"
 
   case "${mode}" in
     exec)
-      codex exec "${prompt}"
+      codex exec "${CODEX_STDIN_INSTRUCTION}" <"${prompt_file}"
       ;;
     prompt)
-      codex --prompt "${prompt}"
+      codex --prompt "${CODEX_STDIN_INSTRUCTION}" <"${prompt_file}"
       ;;
     *)
       die "could not determine a non-interactive Codex invocation"
@@ -152,6 +178,70 @@ run_verification() {
   return "${failed}"
 }
 
+append_file_excerpt() {
+  local file="$1"
+  local missing_message="$2"
+  local max_bytes="$3"
+  local direction="${4:-tail}"
+  local size
+
+  if [[ ! -f "${file}" ]]; then
+    printf '%s\n' "${missing_message}"
+    return 0
+  fi
+
+  size="$(wc -c <"${file}" | tr -d '[:space:]')"
+  if [[ -z "${size}" ]]; then
+    size=0
+  fi
+
+  if (( size > max_bytes )); then
+    printf '[Excerpt: %s %s bytes of %s total bytes.]\n' "${direction}" "${max_bytes}" "${size}"
+    case "${direction}" in
+      head)
+        head -c "${max_bytes}" "${file}"
+        ;;
+      tail)
+        tail -c "${max_bytes}" "${file}"
+        ;;
+      *)
+        die "unknown excerpt direction '${direction}'"
+        ;;
+    esac
+    printf '\n'
+  else
+    cat "${file}"
+  fi
+}
+
+append_git_diff_excerpt() {
+  local max_bytes="$1"
+  local per_file_max="$2"
+  local max_files="$3"
+  local emitted=0
+  local file
+  local files=()
+
+  mapfile -t files < <(git diff --name-only --diff-filter=ACMRTD -- "${GIT_CONTEXT_PATHS[@]}" ':(exclude).ai/logs' ':(exclude)node_modules' | head -n "${max_files}")
+  printf '[Excerpt: current git diff for configured project paths, excluding .ai/logs and node_modules, limited to %s files and %s bytes per file; total budget %s bytes.]\n' "${max_files}" "${per_file_max}" "${max_bytes}"
+  if [[ "${#files[@]}" -eq 0 ]]; then
+    printf 'No tracked git diff.\n'
+    return 0
+  fi
+
+  for file in "${files[@]}"; do
+    if (( emitted >= max_bytes )); then
+      printf '\n[Diff excerpt budget reached.]\n'
+      break
+    fi
+    printf '\n### %s\n' "${file}"
+    git diff --no-ext-diff -- "${file}" | head -c "${per_file_max}" || true
+    printf '\n'
+    emitted=$((emitted + per_file_max))
+  done
+  printf '\n'
+}
+
 section_body() {
   local file="$1"
   local section="$2"
@@ -203,10 +293,12 @@ write_git_snapshot() {
   {
     printf '# Round %s Git Snapshot\n' "${round}"
     printf 'Date: %s\n\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
-    printf '## git status --short\n'
-    git status --short || true
-    printf '\n## git diff --stat\n'
-    git diff --stat || true
+    printf '## git status --short --untracked-files=no\n'
+    printf '[Limited to %s lines; untracked files omitted.]\n' "${GIT_STATUS_MAX_LINES}"
+    git status --short --untracked-files=no -- "${GIT_CONTEXT_PATHS[@]}" ':(exclude).ai/logs' ':(exclude)node_modules' | head -n "${GIT_STATUS_MAX_LINES}" || true
+    printf '\n## git diff --name-status\n'
+    printf '[Limited to %s files; .ai/logs and node_modules omitted.]\n' "${GIT_DIFF_MAX_FILES}"
+    git diff --name-status -- "${GIT_CONTEXT_PATHS[@]}" ':(exclude).ai/logs' ':(exclude)node_modules' | head -n "${GIT_DIFF_MAX_FILES}" || true
   } >"${log_file}"
 }
 
@@ -223,15 +315,23 @@ build_claude_prompt() {
     printf 'Round: %s of %s\n' "${round}" "${MAX_ROUNDS}"
     printf 'Repository: %s\n' "${REPO_ROOT}"
     printf '\n## Current AI State\n'
-    if [[ -f "${STATE_FILE}" ]]; then cat "${STATE_FILE}"; else printf 'No .ai/state.md present.\n'; fi
+    append_file_excerpt "${STATE_FILE}" 'No .ai/state.md present.' "${STATE_CONTEXT_MAX_BYTES}" head
     printf '\n\n## Current Git Snapshot\n'
-    cat "${git_log}"
+    append_file_excerpt "${git_log}" 'No git snapshot present.' "${GIT_SNAPSHOT_MAX_BYTES}" tail
     printf '\n\n## Current git diff\n'
-    git diff || true
+    append_git_diff_excerpt "${GIT_DIFF_MAX_BYTES}" "${GIT_DIFF_PER_FILE_MAX_BYTES}" "${GIT_DIFF_MAX_FILES}"
     printf '\n\n## Previous Codex Output\n'
-    if [[ -n "${previous_codex_log}" && -f "${previous_codex_log}" ]]; then cat "${previous_codex_log}"; else printf 'No previous Codex output.\n'; fi
+    if [[ -n "${previous_codex_log}" ]]; then
+      append_file_excerpt "${previous_codex_log}" 'No previous Codex output.' "${PREVIOUS_LOG_MAX_BYTES}" tail
+    else
+      printf 'No previous Codex output.\n'
+    fi
     printf '\n\n## Previous Verification Output\n'
-    if [[ -n "${previous_test_log}" && -f "${previous_test_log}" ]]; then cat "${previous_test_log}"; else printf 'No previous verification output.\n'; fi
+    if [[ -n "${previous_test_log}" ]]; then
+      append_file_excerpt "${previous_test_log}" 'No previous verification output.' "${PREVIOUS_LOG_MAX_BYTES}" tail
+    else
+      printf 'No previous verification output.\n'
+    fi
   } >"${prompt_file}"
 }
 
@@ -246,9 +346,9 @@ build_codex_prompt() {
     printf 'Round: %s of %s\n' "${round}" "${MAX_ROUNDS}"
     printf 'Repository: %s\n' "${REPO_ROOT}"
     printf '\n## Claude Review\n'
-    cat "${REVIEW_FILE}"
+    append_file_excerpt "${REVIEW_FILE}" 'No Claude review present.' "${REVIEW_CONTEXT_MAX_BYTES}" tail
     printf '\n\n## Latest Verification Output\n'
-    if [[ -f "${test_log}" ]]; then cat "${test_log}"; else printf 'No verification output for this round yet.\n'; fi
+    append_file_excerpt "${test_log}" 'No verification output for this round yet.' "${TEST_CONTEXT_MAX_BYTES}" tail
   } >"${prompt_file}"
 }
 




## Previous Codex Output
No previous Codex output.


## Previous Verification Output
No previous verification output.
