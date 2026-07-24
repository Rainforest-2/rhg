# Phase 11 — Final Acceptance 実行契約

## 0. Phaseの目的

Phase 0〜10を、機能・回帰・security・load・offline/fallback・rollback・実機UIの証拠で閉じる。

このPhaseは不足機能を大量追加するPhaseではない。失敗を隠さず、未検証領域を特定し、release可能かを判定する。

## 1. 開始条件

- Phase 3〜10が各focused checks付きでmainへmerge済み。
- feature flagsで各online機能を独立停止できる。
- preview環境がproductionと分離されたD1/R2/secretsで起動する。
- rollback対象の直前Pages deploymentとknown-good fallback generationが存在する。
- unresolved blockersとaccepted/non-accepted visual項目がdocumented。

## 2. 非目標

- testを通すためのassert削除/timeout延長だけの変更
- Phase外の大規模refactor
- load/security findingをsilent fallbackで隠すこと
- headless DOMだけでiOS visual acceptedとすること
- known failureを「環境依存」で無条件除外すること
- production secret/real user dataをfixtureへ使用

## 3. Release gates

全gateを独立に判定する。

```text
G1 repository hygiene
G2 static/unit/integration CI
G3 existing RHG regression
G4 community functional E2E
G5 Cloudflare preview
G6 offline/read-only/fallback
G7 security
G8 load/capacity
G9 viewport/device/accessibility
G10 rollback/recovery
G11 documentation/operations
```

一つでもcritical/high未解決ならrelease不可。mediumはscope/mitigation/ownerを明記して判断する。

## 4. G1 Repository hygiene

```bash
git status --short --branch
git diff --check
git ls-files | rg '(^|/)(\.env|\.dev\.vars|tmp|dist|playwright-report|test-results)/|\.log$|\.pid$'
```

確認:

- secret/token/password/raw IPなし。
- generated/tmp/log/PID不要追跡なし。
- package/lock整合。
- unknown binary/large screenshotの目的明確。
- migrations連番/重複なし。
- feature flags既定値安全。
- no TODO placeholderがsecurity bypassとして残っていない。
- branchはcurrent mainから意図せずbehindでない。

Secret scanは文字列名だけでなくhigh-entropy/known prefixも確認する。検出値をreportへ再掲しない。

## 5. G2 CI matrix

最低限:

```bash
npm ci
npm run agent:checks -- --changed --run
npm run check
npm test
npm run build
```

追加:

- community各Phase focused scripts。
- `node --check` all changed JS/MJS。
- migration fresh/incremental/local tests。
- canonical client/server golden fixtures。
- auth/social/stats/restriction transaction tests。
- Service Worker/cache tests。
- fallback generation integrity tests。

Rules:

- clean checkoutで実行。
- concurrent buildが同じ`dist`を触らない。
- flaky testはretryで隠さず原因分類。
- baseline failureとnew regressionをcommit/clean checkoutで比較。
- test output/artifactを保存し、pass数だけでなくcommand/commitを記録。

## 6. G3 Existing RHG regression

Community flags全OFFで、既存RHGがcommunity導入前と実質同じ動作をすること。

必須:

- boot/patch import order。
- home OFF direct formation entry。
- official stage selection/play。
- local CustomStage create/edit/save/load/delete。
- schema v2 load/migration safety。
- local JSON export/import。
- formation save/load。
- cat level + plus / dog magnification。
- character modifications。
- actor spawn/stats/production/cost/cooldown/capacity。
- attack/damage/proc/KB/death/result/render/audio。
- PWA/install gate。
- offline legacy/local play。

Existing BCU parity safe suite/open issue regressionsを省かない。Community changesでbattle owner/wrapperに差分があればrelease blocker扱い。

## 7. G4 Community functional E2E

### Anonymous

- home/browse/search/sorts/pagination。
- detail/author/comments read。
- play/import without login。
- unsupported schema/build/revision handling。

### Account

- register/Turnstile/login/logout/me。
- display/password change。
- rolling/multi-device/session rules。
- suspend/deleted/last admin。

### Publish/import

- canonical/hash/dedupe/course ID。
- identical repost。
- metadata-only update/gameplay update拒否。
- lineage parent/root/hidden parent。
- thumbnail upload/replace/failure。
- local atomic import/provenance/quota。

### Social

- like/unlike/duplicate/concurrent。
- comment validation/rate limit/idempotency。
- comments disabled/old remain。
- admin hide/unhide/counters。

### Stats

- first logic frame。
- clear/defeat/abandon/retry/reload/pause。
- duplicate/order reversal/offline outbox。
- hidden start/finish。
- compaction/rebuild/rate sort。

### Restrictions

- all rule types/boundaries。
- plus level。
- combo exclusion。
- multi-hit total/cost order。
- pre-selection/all reasons/start validation。
- will+1 capacity。
- zero eligible publication/current user。

## 8. G5 Cloudflare preview

Preview must use preview-only resources.

Verify:

- Pages deployment/Functions routes。
- all D1 migrations applied。
- R2 blob/media/fallback bindings correct。
- secrets present without disclosure。
- Turnstile preview hostname/action。
- custom/media/fallback CORS and headers。
- Cron manual/dry-run and scheduled config。
- `COMMUNITY_ENV=preview` unmistakable。
- production resource IDs absent from preview config/logs。
- response headers: CSP, no-store auth, nosniff media, cache contracts。

Run smoke from real preview URL, not only localhost.

## 9. G6 Offline / read-only / fallback

Failure injection:

1. browser offline before home。
2. Functions unreachable。
3. D1 error/quota classified as read-only。
4. R2 fallback available。
5. fallback current pointer unavailable/corrupt。
6. partial new generation failure。
7. old generation rollback。
8. telemetry offline then recovery。

Expected:

- legacy/local always usable。
- public fallback browse/detail/comments/play/import where generation valid。
- mutation disabled/read-only shown。
- old generation preserved on failure。
- hash/schema/revision still verified。
- no private cached response。
- recovery does not duplicate counters/events。

## 10. G7 Security review

### Auth/session

- no plain password/token/secret/raw IP。
- PBKDF2 parameter measured/documented。
- timing-safe compare。
- cookie flags/path/domain。
- CSRF/Origin/Host/JSON/body-size。
- Turnstile server verify/reuse。
- rate limits/lockout。
- session fixation/revocation/rolling/multi-device。
- role/status server authoritative。
- last admin。

### Input/content

- code point/NFC/control validation。
- textContent/no HTML。
- SQL prepared statements。
- prototype pollution/unknown fields/depth/size。
- image magic byte/dimensions/type/size。
- separate cookie-less media origin/nosniff。
- R2 key/listing hidden。

### State/integrity

- canonical server hash。
- idempotency conflict。
- transaction row+counter/audit。
- R2/D1 partial failures。
- telemetry duplicate/order reversal。
- admin audit no sensitive body。
- Service Worker no auth/mutation cache。

Use manual code review + automated negative tests. Security scanだけで完了扱いしない。

## 11. G8 Load / capacity

Representative dataを生成し、無料枠/CPU/DB/R2に合わせて現行公式制限を再確認する。

Scenarios:

- 50-card list x four sorts。
- Japanese n-gram search large catalog。
- 1-char bounded search。
- popular detail/comments pagination。
- concurrent likes/comments。
- play batch duplicate/mixed 20 events。
- outbox recovery burst。
- publish same/different hash concurrency。
- fallback full generation。
- stats compaction/rebuild。
- orphan cleanup bounded batch。
- session/rate-limit hot keys。

Measure:

- p50/p95/p99 latency where practical。
- D1 rows read/written/query plan。
- Worker CPU/wall duration。
- R2 operations/bytes。
- frontend JS/network/interaction。
- memory/GC for 50 cards and restriction candidate list。

Set safe page/batch limits from design; do not silently increase functionality to pass load.

## 12. G9 Viewport / device / accessibility

Viewports:

```text
320x568
390x844
667x320 landscape
768x1024
iPad mini landscape 1024x768
desktop
```

Real device priority:

- iPad/iPadOS installed/PWA mode。
- iPhone Safari/standalone if available。
- Android Chrome/standalone。

Flows:

- home/play/browse。
- search keyboard/open-close。
- account dialog。
- publish/thumbnail crop。
- comments。
- restriction editor/candidate reasons/challenge formation。
- battle start/result/back。
- offline/read-only banner。
- admin critical dialog。

Check:

- no horizontal overflow/cut-off action。
- safe areas / 100dvh / software keyboard。
- focus order/trap/return。
- labels/aria-live/aria-current/pressed/disabled reasons。
- touch target >=44px where applicable。
- color-independent status。
- reduced motion。
- text zoom/long Japanese/emoji。
- orientation change/state preservation。

Headless screenshotは補助。実機操作結果をdevice/OS/browser/dateとともに記録する。

## 13. G10 Rollback / recovery drill

### Frontend

- current Pages deployment -> previous deployment rollback。
- flags全OFFでlegacy復帰。

### D1

- forward-only migrations。
- destructive rollback禁止。
- older codeがschema v3を上書きしないread-only guard。
- new nullable columnsでold code read pathを確認。

### R2 / fallback

- immutable gameplay blob保持。
- `current.json`をprevious good generationへ戻す。
- partial generation cleanup。
- thumbnail orphan recovery。

### Auth/security

- secret rotation runbook。
- admin session revoke。
- compromised account suspend。
- read-only emergency switch。

Drillはproduction dataを破壊せずpreview/controlled resourcesで実施し、commands、expected、actual、recoveryを記録する。

## 14. G11 Documentation / operations

Update/check:

- `docs/README.md` navigation。
- final community designとのimplemented divergence。
- migration/apply procedure。
- Cloudflare bindings/secrets names only。
- preview/production deploy。
- read-only switch。
- fallback generation/rollback。
- stats compaction/rebuild。
- admin bootstrap/last-admin recovery。
- incident/security response。
- known limitations/unverified devices。

新しいparallel current status docを作らず、既存SSOT/focused docsへ反映する。

## 15. Finding severity

```text
Critical: secret/data exposure, auth bypass, destructive loss, arbitrary code/content execution
High: counter/hash/lineage integrity loss, existing battle/local path break, fallback/rollback unusable
Medium: bounded incorrect behavior, accessibility/device blocker with workaround, performance risk
Low: cosmetic/documentation/non-blocking maintainability
```

Critical/Highはrelease blocker。Findingごとに:

- reproduction
- affected contract
- root cause
- minimal fix
- regression test
- verified commands/environment

を残す。

## 16. Final acceptance report

```text
# Community Stage Release Acceptance

Commit / deployment / DB migration / fallback generation IDs

## Gate summary
G1 ... PASS/FAIL
...
G11 ... PASS/FAIL

## Commands and artifacts

## Device/preview matrix

## Security findings

## Load findings

## Rollback drill

## Remaining risks / unverified scope

## Decision
ACCEPT / REJECT / CONDITIONAL
```

`ACCEPT`は全critical/high無し、全必須gate PASS、未検証範囲が明示されている場合のみ。

## 17. 完了条件

- clean checkout full CI/buildがpass。
- flags OFFでexisting RHG regression pass。
- community E2E全主要flow pass。
- preview実環境 pass。
- offline/read-only/fallback failure drills pass。
- security critical/highなし。
- representative loadがsafe bound内。
- iPad含むdevice/viewport/accessibility evidence。
- rollback/recovery drill成功。
- docs/runbooks/current SSOT更新。
- remaining riskを隠さずrelease decisionを記録。

## 18. Terra用プロンプト

```text
Phase 11 final acceptanceを実行してください。

本Phase文書、共通ガイド、最終設計、各Phase実装レポート、current main、CI/preview/Cloudflare resourcesを再監査してください。このPhaseでは不足を隠すためのtest弱体化や大規模refactorをせず、gateごとに客観的証拠を集めてください。

clean CI、existing RHG regression、community E2E、preview、offline/read-only/fallback、security、load、iPad/phone/desktop accessibility、rollback/recovery、docsを対象にします。

Critical/High findingはrelease blockerとして修正し、regression testを追加して全関連gateを再実行してください。未実行の実機・権限・環境は明示し、headlessだけでvisual acceptedとしないでください。

最終的にGate summary、commands/artifacts、device matrix、security/load findings、rollback drill、remaining risks、ACCEPT/REJECTを含むacceptance reportを作成し、git diff自己レビュー後に共通報告形式で返してください。
```
