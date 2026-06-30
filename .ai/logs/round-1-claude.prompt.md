# Claude Review Prompt

You are the reviewer for this repository.

Do not edit code, documentation, tests, workflows, or generated files directly. Read the previous Codex output, verification results, git status, git diff, and repository context, then identify the next smallest implementation task for Codex.

Focus on concrete, actionable defects. Prefer one narrow fix that can be implemented and verified in the next Codex pass. Do not ask for broad rewrites, speculative refactors, or unrelated cleanup.

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
Round: 1 of 5
Repository: /workspaces/rhg

## Current AI State
# Current Status

## Discovered Issues
- No critical issues recorded yet.
- Add new findings here as they are discovered.

## Current Task
- Establish the AI development loop scaffolding for this repository.

## Completed
- Created AI management directory and core files.
- Added workflow scaffolding for the development loop.
- Documented usage in the repository README.

## Remaining
- Review the workflow and adjust if repository-specific checks are needed.


## Current Git Snapshot
# Round 1 Git Snapshot
Date: 2026-06-30T14:11:17Z

## git status --short
 M .gitignore
 M README.md
D  node_modules/.bin/playwright
D  node_modules/.bin/playwright-core
D  node_modules/.bin/rg
D  node_modules/.package-lock.json
D  node_modules/.vite/deps/_metadata.json
D  node_modules/.vite/deps/package.json
D  node_modules/@playwright/test/LICENSE
D  node_modules/@playwright/test/NOTICE
D  node_modules/@playwright/test/README.md
D  node_modules/@playwright/test/cli.js
D  node_modules/@playwright/test/index.d.ts
D  node_modules/@playwright/test/index.js
D  node_modules/@playwright/test/index.mjs
D  node_modules/@playwright/test/package.json
D  node_modules/@playwright/test/reporter.d.ts
D  node_modules/@playwright/test/reporter.js
D  node_modules/@playwright/test/reporter.mjs
D  node_modules/playwright-core/LICENSE
D  node_modules/playwright-core/NOTICE
D  node_modules/playwright-core/README.md
D  node_modules/playwright-core/ThirdPartyNotices.txt
D  node_modules/playwright-core/bin/install_media_pack.ps1
D  node_modules/playwright-core/bin/install_webkit_wsl.ps1
D  node_modules/playwright-core/bin/reinstall_chrome_beta_linux.sh
D  node_modules/playwright-core/bin/reinstall_chrome_beta_mac.sh
D  node_modules/playwright-core/bin/reinstall_chrome_beta_win.ps1
D  node_modules/playwright-core/bin/reinstall_chrome_stable_linux.sh
D  node_modules/playwright-core/bin/reinstall_chrome_stable_mac.sh
D  node_modules/playwright-core/bin/reinstall_chrome_stable_win.ps1
D  node_modules/playwright-core/bin/reinstall_msedge_beta_linux.sh
D  node_modules/playwright-core/bin/reinstall_msedge_beta_mac.sh
D  node_modules/playwright-core/bin/reinstall_msedge_beta_win.ps1
D  node_modules/playwright-core/bin/reinstall_msedge_dev_linux.sh
D  node_modules/playwright-core/bin/reinstall_msedge_dev_mac.sh
D  node_modules/playwright-core/bin/reinstall_msedge_dev_win.ps1
D  node_modules/playwright-core/bin/reinstall_msedge_stable_linux.sh
D  node_modules/playwright-core/bin/reinstall_msedge_stable_mac.sh
D  node_modules/playwright-core/bin/reinstall_msedge_stable_win.ps1
D  node_modules/playwright-core/browsers.json
D  node_modules/playwright-core/cli.js
D  node_modules/playwright-core/index.d.ts
D  node_modules/playwright-core/index.js
D  node_modules/playwright-core/index.mjs
D  node_modules/playwright-core/lib/bootstrap.js
D  node_modules/playwright-core/lib/coreBundle.js
D  node_modules/playwright-core/lib/entry/cliDaemon.js
D  node_modules/playwright-core/lib/entry/dashboardApp.js
D  node_modules/playwright-core/lib/entry/mcp.js
D  node_modules/playwright-core/lib/entry/oopBrowserDownload.js
D  node_modules/playwright-core/lib/package.js
D  node_modules/playwright-core/lib/server/chromium/appIcon.png
D  node_modules/playwright-core/lib/server/deviceDescriptorsSource.json
D  node_modules/playwright-core/lib/server/electron/loader.js
D  node_modules/playwright-core/lib/serverRegistry.js
D  node_modules/playwright-core/lib/serverRegistry.js.LICENSE
D  node_modules/playwright-core/lib/tools/cli-client/channelSessions.js
D  node_modules/playwright-core/lib/tools/cli-client/cli.js
D  node_modules/playwright-core/lib/tools/cli-client/help.json
D  node_modules/playwright-core/lib/tools/cli-client/minimist.js
D  node_modules/playwright-core/lib/tools/cli-client/output.js
D  node_modules/playwright-core/lib/tools/cli-client/program.js
D  node_modules/playwright-core/lib/tools/cli-client/registry.js
D  node_modules/playwright-core/lib/tools/cli-client/session.js
D  node_modules/playwright-core/lib/tools/cli-client/skill/SKILL.md
D  node_modules/playwright-core/lib/tools/cli-client/skill/references/element-attributes.md
D  node_modules/playwright-core/lib/tools/cli-client/skill/references/playwright-tests.md
D  node_modules/playwright-core/lib/tools/cli-client/skill/references/request-mocking.md
D  node_modules/playwright-core/lib/tools/cli-client/skill/references/running-code.md
D  node_modules/playwright-core/lib/tools/cli-client/skill/references/session-management.md
D  node_modules/playwright-core/lib/tools/cli-client/skill/references/spec-driven-testing.md
D  node_modules/playwright-core/lib/tools/cli-client/skill/references/storage-state.md
D  node_modules/playwright-core/lib/tools/cli-client/skill/references/test-generation.md
D  node_modules/playwright-core/lib/tools/cli-client/skill/references/tracing.md
D  node_modules/playwright-core/lib/tools/cli-client/skill/references/video-recording.md
D  node_modules/playwright-core/lib/tools/dashboard/appIcon.png
D  node_modules/playwright-core/lib/tools/trace/SKILL.md
D  node_modules/playwright-core/lib/tools/utils/extension.js
D  node_modules/playwright-core/lib/tools/utils/socketConnection.js
D  node_modules/playwright-core/lib/utilsBundle.js
D  node_modules/playwright-core/lib/utilsBundle.js.LICENSE
D  node_modules/playwright-core/lib/vite/dashboard/assets/codicon-DCmgc-ay.ttf
D  node_modules/playwright-core/lib/vite/dashboard/assets/firefox-1bWoP6pv.svg
D  node_modules/playwright-core/lib/vite/dashboard/assets/firefox-beta-k3eOH_eK.svg
D  node_modules/playwright-core/lib/vite/dashboard/assets/firefox-nightly-Cp5nfeDT.svg
D  node_modules/playwright-core/lib/vite/dashboard/assets/index-BY2S1tHT.css
D  node_modules/playwright-core/lib/vite/dashboard/assets/index-DpEq2p62.js
D  node_modules/playwright-core/lib/vite/dashboard/assets/safari-na3_-uQk.svg
D  node_modules/playwright-core/lib/vite/dashboard/index.html
D  node_modules/playwright-core/lib/vite/dashboard/playwright-logo.svg
D  node_modules/playwright-core/lib/vite/htmlReport/index.html
D  node_modules/playwright-core/lib/vite/htmlReport/report.css
D  node_modules/playwright-core/lib/vite/htmlReport/report.js
D  node_modules/playwright-core/lib/vite/recorder/assets/codeMirrorModule-BHYmBp6h.js
D  node_modules/playwright-core/lib/vite/recorder/assets/codeMirrorModule-DYBRYzYX.css
D  node_modules/playwright-core/lib/vite/recorder/assets/codicon-DCmgc-ay.ttf
D  node_modules/playwright-core/lib/vite/recorder/assets/index-4ZiSSCmn.css
D  node_modules/playwright-core/lib/vite/recorder/assets/index-DA10QRaq.js
D  node_modules/playwright-core/lib/vite/recorder/index.html
D  node_modules/playwright-core/lib/vite/recorder/playwright-logo.svg
D  node_modules/playwright-core/lib/vite/traceViewer/assets/codeMirrorModule-Ds_H_9Yq.js
D  node_modules/playwright-core/lib/vite/traceViewer/assets/defaultSettingsView-D31xz8zv.js
D  node_modules/playwright-core/lib/vite/traceViewer/assets/urlMatch-BYQrIQwR.js
D  node_modules/playwright-core/lib/vite/traceViewer/assets/xtermModule-CsJ4vdCR.js
D  node_modules/playwright-core/lib/vite/traceViewer/codeMirrorModule.DYBRYzYX.css
D  node_modules/playwright-core/lib/vite/traceViewer/codicon.DCmgc-ay.ttf
D  node_modules/playwright-core/lib/vite/traceViewer/defaultSettingsView.BDKsFU3c.css
D  node_modules/playwright-core/lib/vite/traceViewer/index.BCnMPevh.js
D  node_modules/playwright-core/lib/vite/traceViewer/index.CzXZzn5A.css
D  node_modules/playwright-core/lib/vite/traceViewer/index.html
D  node_modules/playwright-core/lib/vite/traceViewer/manifest.webmanifest
D  node_modules/playwright-core/lib/vite/traceViewer/playwright-logo.svg
D  node_modules/playwright-core/lib/vite/traceViewer/snapshot.html
D  node_modules/playwright-core/lib/vite/traceViewer/snapshot.v8KI4P3m.js
D  node_modules/playwright-core/lib/vite/traceViewer/sw.bundle.js
D  node_modules/playwright-core/lib/vite/traceViewer/uiMode.Btcz36p_.css
D  node_modules/playwright-core/lib/vite/traceViewer/uiMode.C2Efnu2P.js
D  node_modules/playwright-core/lib/vite/traceViewer/uiMode.html
D  node_modules/playwright-core/lib/vite/traceViewer/xtermModule.DYP7pi_n.css
D  node_modules/playwright-core/lib/xdg-open
D  node_modules/playwright-core/package.json
D  node_modules/playwright-core/types/protocol.d.ts
D  node_modules/playwright-core/types/structs.d.ts
D  node_modules/playwright-core/types/types.d.ts
D  node_modules/playwright/LICENSE
D  node_modules/playwright/NOTICE
D  node_modules/playwright/README.md
D  node_modules/playwright/ThirdPartyNotices.txt
D  node_modules/playwright/cli.js
D  node_modules/playwright/index.d.ts
D  node_modules/playwright/index.js
D  node_modules/playwright/index.mjs
D  node_modules/playwright/jsx-runtime.js
D  node_modules/playwright/jsx-runtime.mjs
D  node_modules/playwright/lib/agents/agentParser.js
D  node_modules/playwright/lib/agents/copilot-setup-steps.yml
D  node_modules/playwright/lib/agents/generateAgents.js
D  node_modules/playwright/lib/agents/playwright-test-coverage.prompt.md
D  node_modules/playwright/lib/agents/playwright-test-generate.prompt.md
D  node_modules/playwright/lib/agents/playwright-test-generator.agent.md
D  node_modules/playwright/lib/agents/playwright-test-heal.prompt.md
D  node_modules/playwright/lib/agents/playwright-test-healer.agent.md
D  node_modules/playwright/lib/agents/playwright-test-plan.prompt.md
D  node_modules/playwright/lib/agents/playwright-test-planner.agent.md
D  node_modules/playwright/lib/cli/reportActions.js
D  node_modules/playwright/lib/cli/testActions.js
D  node_modules/playwright/lib/common/index.js
D  node_modules/playwright/lib/common/index.js.txt
D  node_modules/playwright/lib/errorContext.js
D  node_modules/playwright/lib/globals.js
D  node_modules/playwright/lib/index.js
D  node_modules/playwright/lib/isomorphic.js
D  node_modules/playwright/lib/isomorphic.js.txt
D  node_modules/playwright/lib/loader/loaderProcessEntry.js
D  node_modules/playwright/lib/loader/loaderProcessEntry.js.txt
D  node_modules/playwright/lib/matchers/expect.js
D  node_modules/playwright/lib/matchers/expect.js.LICENSE
D  node_modules/playwright/lib/matchers/expect.js.txt
D  node_modules/playwright/lib/mcp/test/browserBackend.js
D  node_modules/playwright/lib/mcp/test/generatorTools.js
D  node_modules/playwright/lib/mcp/test/plannerTools.js
D  node_modules/playwright/lib/mcp/test/seed.js
D  node_modules/playwright/lib/mcp/test/streams.js
D  node_modules/playwright/lib/mcp/test/testBackend.js
D  node_modules/playwright/lib/mcp/test/testContext.js
D  node_modules/playwright/lib/mcp/test/testTool.js
D  node_modules/playwright/lib/mcp/test/testTools.js
D  node_modules/playwright/lib/package.js
D  node_modules/playwright/lib/program.js
D  node_modules/playwright/lib/runner/index.js
D  node_modules/playwright/lib/runner/index.js.txt
D  node_modules/playwright/lib/transform/babelBundle.js
D  node_modules/playwright/lib/transform/babelBundle.js.LICENSE
D  node_modules/playwright/lib/transform/babelBundle.js.txt
D  node_modules/playwright/lib/transform/esmLoader.js
D  node_modules/playwright/lib/transform/esmLoader.js.LICENSE
D  node_modules/playwright/lib/transform/esmLoader.js.txt
D  node_modules/playwright/lib/util.js
D  node_modules/playwright/lib/worker/workerProcessEntry.js
D  node_modules/playwright/lib/worker/workerProcessEntry.js.txt
D  node_modules/playwright/package.json
D  node_modules/playwright/test.d.ts
D  node_modules/playwright/test.js
D  node_modules/playwright/test.mjs
D  node_modules/playwright/types/test.d.ts
D  node_modules/playwright/types/testReporter.d.ts
D  node_modules/rg/README.md
D  node_modules/rg/index.js
D  node_modules/rg/package.json
D  node_modules/rg/r.md
 M package-lock.json
 M package.json
D  test-results/.last-run.json
D  tools/__pycache__/extract_bcuzip.cpython-312.pyc
?? .ai/
?? .editorconfig
?? .github/workflows/ai-development.yml

## git diff --stat
 .gitignore        |  4 ++++
 README.md         | 34 ++++++++++++++++++++++++++++++++++
 package-lock.json | 12 ------------
 package.json      | 10 +++++++---
 4 files changed, 45 insertions(+), 15 deletions(-)


## Current git diff
diff --git a/.gitignore b/.gitignore
index 343e80e14..cf742cca2 100644
--- a/.gitignore
+++ b/.gitignore
@@ -21,3 +21,7 @@ public/assets/generated/bcu-lang-prune-report.json
 public/assets/generated/bcu-lang-prune-report.md
 node_modules/
 dist/
+
+# Python bytecode (tools/extract_bcuzip.py and other helper scripts).
+__pycache__/
+*.pyc
diff --git a/README.md b/README.md
index 117b0dad7..8333b1f00 100644
--- a/README.md
+++ b/README.md
@@ -96,3 +96,37 @@ node scripts/check-ability-partial-blockers.mjs
 ```
 
 見た目に関する主張は、スクリプトが通っても十分ではありません。[docs/ability-logic/bcu-visual-review-checklist.md](docs/ability-logic/bcu-visual-review-checklist.md) にブラウザ比較の結果を残してください。
+
+## AI 開発ループ
+
+このリポジトリでは、Claude と Codex が協調して開発を進めるためのループ環境を [.ai](.ai) 配下に用意しています。これは Claude と Codex を直接つなぐものではなく、[.ai/orchestrator.sh](.ai/orchestrator.sh) が両方の CLI を交互に呼び出す仕組みです。
+
+### 起動方法
+- Codespaces または Claude Code CLI と Codex CLI がインストール・認証済みの開発環境で、`bash .ai/orchestrator.sh` を実行します。
+- 最大 5 周で停止します。
+- 自動 commit / push は行いません。
+- 失敗時のラウンドログは [.ai/logs](.ai/logs) に保存されます。
+- 非対話モードが使えない場合の手動運用は [.ai/RUN_MANUALLY.md](.ai/RUN_MANUALLY.md) を参照してください。
+- GitHub Actions の「AI Development Loop」ワークフローは手動起動できますが、GitHub-hosted runner では `claude` / `codex` の導入と認証がない限り失敗します。主運用は Codespaces 上での実行です。
+
+### AI の役割
+- Claude: 全体解析、設計レビュー、バグ発見、レビュー記録の担当。
+- Codex: 実装、バグ修正、リファクタリング、テスト追加の担当。
+
+### 主要ファイル
+- [.ai/mission.md](.ai/mission.md): プロジェクトの目的、役割分担、開発ルール、完了条件。
+- [.ai/state.md](.ai/state.md): 現在の課題・作業内容・完了状況の共有。
+- [.ai/tasks.md](.ai/tasks.md): タスクの優先度と管理。
+- [.ai/review.md](.ai/review.md): Claude のレビュー記録。
+- [.ai/changelog.md](.ai/changelog.md): Codex の変更履歴。
+- [.ai/prompts/claude-review.md](.ai/prompts/claude-review.md): Claude レビュー用の固定プロンプト。
+- [.ai/prompts/codex-fix.md](.ai/prompts/codex-fix.md): Codex 修正用の固定プロンプト。
+- [.ai/orchestrator.sh](.ai/orchestrator.sh): Claude レビュー → Codex 実装 → 検証を最大 5 周実行するローカル向けオーケストレーター。
+- [.github/workflows/ai-development.yml](.github/workflows/ai-development.yml): 手動起動でオーケストレーターを試行するワークフロー。
+
+### 開発フロー
+1. `.ai/orchestrator.sh` が `git status --short` と `git diff --stat` を記録します。
+2. Claude が前回の Codex 出力、検証結果、現在の diff を読み、[.ai/review.md](.ai/review.md) に次の最小タスクを書きます。
+3. Codex が `.ai/review.md` の `Next Codex Task` だけを実装し、[.ai/changelog.md](.ai/changelog.md) に結果を追記します。
+4. `npm run check`、`npm test`、`npm run lint --if-present`、`npm run build --if-present` を実行します。
+5. すべて成功したら停止し、失敗した場合はログを次の Claude レビューに渡して次の周回に進みます。
diff --git a/package-lock.json b/package-lock.json
index 9733c4ea2..81a1efd9a 100644
--- a/package-lock.json
+++ b/package-lock.json
@@ -8,9 +8,6 @@
       "name": "rhg-bcu-battle",
       "version": "1.0.0",
       "license": "UNLICENSED",
-      "dependencies": {
-        "rg": "^0.0.2"
-      },
       "devDependencies": {
         "@playwright/test": "^1.60.0",
         "playwright": "^1.60.0",
@@ -775,15 +772,6 @@
         "node": "^10 || ^12 || >=14"
       }
     },
-    "node_modules/rg": {
-      "version": "0.0.2",
-      "resolved": "https://registry.npmjs.org/rg/-/rg-0.0.2.tgz",
-      "integrity": "sha512-mDR+iODuzY3LJj6dMxwhYmylHAnh050edYRsSRcCR+jZx7Pacz+VVAwqGTOFAV+058N53504CglWitWZ16/yQg==",
-      "license": "MIT",
-      "bin": {
-        "rg": "index.js"
-      }
-    },
     "node_modules/rolldown": {
       "version": "1.1.3",
       "resolved": "https://registry.npmjs.org/rolldown/-/rolldown-1.1.3.tgz",
diff --git a/package.json b/package.json
index 935b7a593..9d9d69245 100644
--- a/package.json
+++ b/package.json
@@ -4,7 +4,14 @@
   "private": true,
   "description": "BCU-parity battle/stage/render web app bundled with Vite.",
   "license": "UNLICENSED",
+  "repository": {
+    "type": "git",
+    "url": "git+https://github.com/Rainforest-2/rhg.git"
+  },
   "type": "module",
+  "engines": {
+    "node": ">=20"
+  },
   "devDependencies": {
     "@playwright/test": "^1.60.0",
     "playwright": "^1.60.0",
@@ -25,8 +32,5 @@
     "dev": "vite",
     "build": "vite build",
     "preview": "vite preview"
-  },
-  "dependencies": {
-    "rg": "^0.0.2"
   }
 }


## Previous Codex Output
No previous Codex output.


## Previous Verification Output
No previous verification output.
