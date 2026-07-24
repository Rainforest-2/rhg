# Phase 8 — Play Stats / Outbox / Aggregation 実行契約

## 0. Phaseの目的

public stageの挑戦開始・終了を、offline/retry/order reversalに耐えるidempotent event systemとして実装し、attempt/clear/rateを正確に集計する。

このPhaseは分散状態を扱う。成功条件は「通常時にcountが増える」ではなく、**同じplay sessionがあらゆる再送順でも一度だけ反映されること**。

## 1. 開始条件

- Phase 3 `play_attempts`, `stage_stats`, `stage_stats_daily`, idempotency基盤が存在。
- Phase 5 content hash / stage status / manifestが存在。
- Phase 6 public play導線が存在。
- current battle result ownerとfirst logic frame ownerを再監査済み。
- post-load result/pause/transition patchのinstall順を確認済み。
- `communityStats` flagは既定OFF。

## 2. 非目標

- replay upload/verification
- speedrun/world record
- cheat detection/fingerprinting
- user別公開history
- clientから送られたclearを無条件信用すること
- raw attempt永久保存
- telemetry失敗でbattleを止めること
- battle tick/wrapper順の変更

## 3. Event model

Client event:

```js
{
  eventId,
  type: 'start' | 'finish',
  playSessionId,
  courseId,
  contentHash,
  guestDeviceId,
  userId: undefined,          // server sessionから導出
  clientBuildId,
  assetCatalogRevision,
  occurredAt,
  logicFrames,
  result: null | 'clear' | 'defeat' | 'abandoned',
  restrictionDigest: null | string
}
```

Rules:

- `playSessionId`: crypto random UUID。
- `eventId`: retry用stable ID。start/finishで別ID。
- `guestDeviceId`: local random UUID、fingerprint禁止。
- login user IDはclient fieldを信用せずsessionからserverが決定。
- content hash/revision/courseの整合をserverで確認。
- bodyは1batch最大20 event。
- event/session ID length/format/body sizeを制限。

## 4. Attempt state machine

```text
absent
  --start--> started
  --finish(clear/defeat/abandoned)--> finished

absent
  --finish--> started + finished（同一transaction）

started
  --duplicate start--> unchanged
  --finish--> finished

finished
  --duplicate/reordered event--> unchanged
```

許さない:

- clearからdefeatへの上書き
- defeatからclearへの後付け上書き
- same sessionで別stage/content hash
- client timestampだけでhidden前開始を証明
- duplicate finishでclear count再加算

First accepted terminal resultをimmutableにする。矛盾eventはstable conflictとして記録/拒否し、counterを変えない。

## 5. 挑戦開始owner

Start条件:

```text
battle logic frame >= 1
```

数えない:

- detailを開いた
- formationを開いた
- loading中に戻った
- scene constructedだけ

実装時にcurrent ownerを追跡する。

候補調査:

- `PreviewApp.applyFormationToBattle` / `resetBattle`
- `BattleSimulationClock.step`
- `BattleScene.logicFrame`更新owner
- result/pause/transition runtime patches

接続規則:

- 既存tick/wrapperを新しくwrapしない。
- first frameを観測できる既存controller/scene eventへ最小bridgeを置く。
- start queue失敗をawaitせず、outboxへ保存してbattle継続。
- same scene/sessionで一度だけenqueue。
- retry/restart/reload/formation changeではnew session。
- pause/resumeではsame session。

## 6. Finish owner

Clear:

- normal enemy base destruction
- stage-specific success result
- ranking/time/other explicit success outcome

Not clear:

- defeat
- manual exit after start
- reload/close after start
- generic ended state without success

current result overlay ownerだけを見て判定式を再発明しない。Battle result contractにsuccess/failure種別が不足する場合、result bridgeを追加するがbattle result semanticsは変更しない。

Abandoned:

- clientがexitを観測できればfinish abandonedをqueue。
- finish未到着でもstart時点でattemptは既に+1。
- server maintenanceがstale started rowをabandonedへ収束可能。

## 7. Client outbox

Owner:

```text
CommunityTelemetryOutbox (IndexedDB)
```

Requirements:

- localStorageへ大量eventを保存しない。
- start/finish eventをtransactional put。
- max age 30日。
- 1batch max20。
- exponential backoff + jitter。
- online eventだけに依存せず、app start/periodic safe triggerでもretry。
- single-flight flush。
- process crash/reload後も保持。
- accepted/duplicate responseだけ削除。
- transient failureは保持。
- permanent invalid/conflictはdead-letter/diagnosticへ移し無限retryしない。
- auth有無に関係なく送れる。
- user logoutでguest/device eventsを消さない。
- battle/render/local saveをawait/blockしない。

Clock:

- age判定はlocal clock操作の影響を受けるためserver responseも考慮するが、個人追跡を増やさない。
- 30日超eventは送信せず安全にdropし、countを後から捏造しない。

## 8. Batch API

```text
POST /api/v1/plays/batch
```

Public、login不要。ただし:

- body limits
- device/IP-derived short rate limit
- CORS/origin policy
- valid build/revision
- max20
- event-level response

Response例:

```js
{
  ok: true,
  data: {
    results: [
      { eventId, status: 'accepted' | 'duplicate' | 'rejected', code: null | string }
    ]
  }
}
```

batch全体のinvalid JSONは全拒否。event validation failureは、transaction policyを明示してper-event処理可能だが、部分成功をclientが正しくackできるresponseにする。

## 9. Start transaction

同一D1 transaction:

```text
1 course/content/revision/status確認
2 play_attempts INSERT OR IGNORE by playSessionId
3 INSERTされた場合だけ stage_stats.attempt_count += 1
4 clear_rate_ppm再計算
5 event/idempotency result記録
```

Hidden semantics:

- hidden後のnew start拒否。
- offline eventの`occurredAt`だけを信用しない。
- serverが受理可能なgrace/署名なしclient timestamp方針を明示する。
- 設計契約の「started_atがhidden前」を実現するには、serverに既存start rowがあるfinishは受理し、hidden後初着のoffline startを無条件遡及受理しない。必要な許容方針をsecurity/abuse観点で固定する。

## 10. Finish transaction

```text
1 attempt lookup
2 absentならstart相当rowをupsertしattemptを一度だけ加算
3 stage/content consistency確認
4 result未確定ならterminal resultをset
5 first transition to clearのみ clear_count += 1
6 defeat/abandonedはclear counter不変
7 clear_rate_ppm再計算
8 event/idempotency result記録
```

- finish-before-start安全。
- duplicate/reordered safe。
- hidden前にserver start済みsessionのfinishはhidden後も受理。
- logicFrames/result formatをvalidate。
- `clear_rate_ppm = floor(clear_count * 1_000_000 / attempt_count)`。
- attempt 0でdivisionしない。

## 11. Counter invariants

```text
attempt_count >= clear_count >= 0
clear_rate_ppm = attempt_count === 0
  ? 0
  : floor(clear_count * 1_000_000 / attempt_count)
```

- integer overflow/unsafe JS numberを避ける。
- client counter deltaを受け取らない。
- row transition resultからdeltaを決定。
- transaction retryで二重加算しない。

## 12. Daily aggregation / retention

Retention:

```text
play_attempts: 35日
stage_stats_daily: 永続
stage_stats: 全期間current counter
```

Compaction flow:

```text
1 35日超・未集約rowをbounded batchでselect
2 UTC day + stageでaggregate
3 stage_stats_dailyへidempotent upsert
4 対象raw rowsへaggregated marker
5 transaction commit
6 commit後だけsafe delete
```

より安全にはaggregate batch ID/markerを使い、crash位置ごとに再実行しても二重集約しない。

Stale unfinished:

- 明示timeout後abandonedへtransition。
- attempt counterはstart時に既に反映済み。
- clear counter変更なし。

Rebuild source:

```text
stage_stats_daily
+ unaggregated play_attempts
+ likes truth rows
+ visible comments truth rows
```

Phase 8ではstats portionのrebuild service/testを作り、admin UIはPhase 10。

## 13. Failure / ordering matrix

| Sequence | Expected |
|---|---|
| start | attempt +1 |
| start,start | +1 only |
| finish(clear) only | attempt +1, clear +1 |
| finish(clear),start | unchanged after start |
| start,finish(clear),finish(clear) | +1/+1 |
| start,finish(defeat),finish(clear) | terminal conflict, clear +0 |
| network response lost after commit | retry duplicate, no delta |
| batch mixed new/duplicate/invalid | per-event deterministic ack |
| offline 29d | send/accept policy |
| offline >30d | local drop, no send |
| hidden after server start | finish accepted |
| hidden before new start | rejected |
| R2/API/auth unavailable | outbox retains, battle continues |
| IndexedDB failure | diagnostic, battle continues; data loss明示 |
| compaction crash before/after marker/delete | no double aggregate/loss |
| rebuild repeated | same result |

## 14. Privacy / abuse

- fingerprint禁止。
- guest IDはrandom local UUID。
- raw IP永続保存禁止。
- login/guest repeated attemptsを仕様どおり全て数える。
- client clear proofは採用しない設計だが、serverはschema/build/content/result shapeを検証する。
- telemetry endpointを巨大batch/unknown keysでDoSされないよう制限。
- logsへfull guest ID/event bodyを恒常出力しない。

## 15. Browser / integration tests

- first logic frame前後
- pause/resume duplicateなし
- restart/retry/new formation/new reloadはnew session
- clear/defeat/abandon
- forced offline -> outbox -> online flush
- response loss simulation
- finish-before-start
- page close/reload persistence
- 20-event batch boundary
- 30-day expiry
- hidden semantics
- communityStats flag OFFでevent/outbox/APIなし
- telemetry failureでbattle FPS/tick/transitionをblockしない

## 16. 完了条件

- first logic frameでattempt開始し、loading/formationでは数えない。
- start/finishが全ordering/retryで一度だけ反映。
- finish-before-start、duplicate、response loss、hidden transitionが安全。
- outboxがIndexedDB、30日、20/batch、backoff、single-flight。
- battle/local pathをblockしない。
- 35日compactionがcrash/retry safe。
- daily+rawからstats再構築可能。
- counter invariantsとinteger rate sortがtest済み。
- privacy/secret/raw IP/fingerprint問題なし。

## 17. Terra用プロンプト

```text
Phase 8 play statsだけを実装してください。

本Phase文書、共通ガイド、current battle first-frame/result owners、Phase 5 stage status/content hash、Phase 3 D1 schemaを再監査してください。boot/import/wrapper順を変更せず、既存result semanticsを再発明しないでください。

play batch、idempotent start/finish transactions、guest/play session IDs、IndexedDB outbox、first logic frame bridge、clear result bridge、daily aggregate、35日compaction、rebuild serviceを対象にします。replay/record/cheat detection/admin UIは実装しないでください。

ordering/retry/response-loss/finish-before-start/hidden/compaction crash matrixを先にtestとして固定してください。telemetry failureはbattleを絶対にblockしないこと。

focused unit/D1/browser/offline tests、full available checks、build、performance observation、git diff自己レビューまで実行し、問題があれば修正・再検証してください。共通報告形式で返してください。
```
