# Phase 10 — Fallback / Read-only / Admin 実行契約

## 0. Phaseの目的

Pages Functions/D1障害やquota到達時にも、R2 custom domainの静的generationからbrowse/detail/comments/play/importを継続できるようにする。同時に、server-side権限でadmin moderation、audit、stats rebuild、orphan cleanup、system write-modeを提供する。

このPhaseは障害時と管理操作を扱う。破壊的処理を「cleanup」の名で追加しない。

## 1. 開始条件

- Phase 3 R2/D1/Worker基盤が存在。
- Phase 4 admin role/session/last-admin guardがserverに存在。
- Phase 5 stage/blob/thumbnail/lineageが存在。
- Phase 6 public browse/detail/author response contractが存在。
- Phase 7 social rows/counters/admin hide serviceが存在。
- Phase 8 daily/raw/current stats/rebuild serviceが存在。
- Phase 9 restrictions summary/manifest compatibilityが存在。
- `communityFallback` / `communityAdmin` flagsは既定OFF。

## 2. 非目標

- physical delete button
- gameplay blob automatic GC
- hidden stageのblob/social/stats削除
- user self-delete
- old metadata本文の永久履歴
- fallbackをPages Functions経由でしか読めない構成
- quota errorを正常responseとして隠すこと
- admin roleのclient-side判定

## 3. Read-only mode

Config:

```text
COMMUNITY_WRITE_MODE = read-write | read-only
```

Unknown/missing値はread-onlyへfail closed。

Read-onlyで停止:

- register
- display/password mutation
- publish/metadata/hide/thumbnail
- like/unlike
- comment post
- new telemetry aggregation
- admin mutations（write-mode解除のbreak-glass経路を除き方針明示）

継続:

- public browse/search/detail/author/comments snapshot
- payload fetch
- play/import
- login/me/logoutの必要範囲
- local game/CustomStage/JSON

### Detection

- explicit admin/system setting
- D1/Functions quota/known capacity errors
- maintenance/fallback integrity failure時のsafe mode

Generic 5xxを全て恒久read-onlyへ切替えない。判定可能なerror class、TTL、operator overrideを固定する。

Clientはread-onlyを明示し、mutation buttonをdisableするが、server enforcementが正規owner。

## 4. Static fallback layout

```text
community-fallback/
├─ current.json
├─ generations/{generationId}/
│  ├─ manifest.json
│  ├─ catalog/new/{page}.json
│  ├─ catalog/plays/{page}.json
│  ├─ catalog/likes/{page}.json
│  ├─ catalog/clear-asc/{page}.json
│  ├─ stages/{courseId}.json
│  ├─ authors/{loginId}.json
│  └─ comments/{courseId}/{page}.json
└─ blobs/sha256/{contentHash}.json
```

Gameplay immutable blob keyはPhase 5 ownerと一致させる。fallback用に別canonical payloadを生成しない。

### current.json

必要最小限:

```js
{
  generationId,
  generatedAt,
  schemaVersion,
  minimumClientBuild,
  assetCatalogRevision,
  manifestPath,
  integrity
}
```

短TTL。pointerだけをatomicに差替える。

### generation file

- content-addressedまたはgeneration-scoped immutable。
- public dataのみ。
- auth/private/likedByMe/session/admin fieldを含めない。
- stable API-equivalent shapeか、client adapterを明示。
- CORSはproduction/preview allowed originへ限定。
- cookiesなし。

## 5. Atomic generation publish

```text
1 generationId = timestamp + crypto random suffix
2 D1 consistent read boundaryを固定
3 all catalog/detail/author/comment filesをtemporary generation prefixへ生成
4 file count/size/hash/reference integrityを検証
5 generation manifestを最後に作成
6 current.jsonを最後に差替え
7 successをaudit/maintenance stateへ記録
8 old generations cleanupは別step
```

途中失敗:

- current pointer不変。
- old generation継続。
- partial new prefixはorphan generationとして後日cleanup。
- current pointerを先に変更しない。

Integrity:

- referenced detail/comment/page/fileが全存在。
- content length/hash。
- course/content hash/asset revision整合。
- page counts/tie-break ordering。
- public status only。

## 6. Retention / rollback

- current + previous 2 successful generations保持。
- partial/failed generationsはgrace期間後cleanup。
- rollbackは`current.json`を既知good generationへ戻す。
- generation filesを上書きしない。
- rollback drillをPhase 11で実施可能なcommand/runbookを作る。
- cleanup中にcurrent/previous pointersの対象を削除しない。

## 7. Client fallback state machine

```text
API ready
  -> API public read
API failed/timeout/quota/read-only metadata
  -> fetch current.json from R2 custom domain
  -> validate generation/schema/build/revision
  -> fallback read
API recovered
  -> bounded revalidation, no abrupt local state loss
```

Rules:

- legacy/local playはfallback discoveryを待たない。
- fallback timeoutを短くし、UIへ状態を表示。
- fallback detail payloadもSHA-256再検証。
- mutation buttonはread-only/disabled。
- cached private/auth responseをfallbackへ混ぜない。
- fallback generation incompatibleならmetadata閲覧可能範囲とplay/import不可理由を示す。
- stale generationをsilent current扱いせずgeneratedAtを保持。

## 8. Service Worker / cache

- mutation API: never cache。
- auth/private: never cache、logout後残存なし。
- immutable hash payload: cache-first。
- generation file: long immutable cache。
- `current.json`: short TTL/network-first or bounded stale strategy。
- metadata API: network-first。
- fallback generation: stale-while-revalidate可だがpointer integrityを維持。
- cache keyにpreview/production originを混同しない。
- unsupported schema/revision responseを古いcacheで上書きしない。

## 9. Admin authorization

全admin routeで:

```text
authenticated session
AND user.status = active
AND user.role = admin
```

- client role表示を信用しない。
- last active admin guardをservice/transactionで強制。
- CSRF/Origin/Host/write-mode/idempotency。
- every mutation creates `admin_audit` in same transaction where possible。
- audit failureでmoderation mutationだけcommitしない。
- reason fieldをbounded plain textで要求する操作を明示。

## 10. Admin API / UI

### Users

```text
GET   /api/v1/admin/users
PATCH /api/v1/admin/users/:id/status
POST  /api/v1/admin/users/:id/reset-password
POST  /api/v1/admin/users/:id/revoke-sessions
```

- ID/display/status search/filter。
- suspend/resume/deleted recovery policy。
- suspend/deleteでall sessions revoke same transaction/choreography。
- deleted ID再利用不可。
- temporary passwordをresponse/log/auditへ平文保存しない。operatorへ一度だけ安全表示する方式を設計。
- last admin guard。

### Stages

```text
GET   /api/v1/admin/stages
PATCH /api/v1/admin/stages/:courseId/status
```

- active/author-hidden/admin-hidden transitions。
- physical deleteなし。
- re-publication owner/admin only。
- lineage/stats/hash/revision inspect。
- child derivativesをautomatic hideしない。

### Comments

```text
GET   /api/v1/admin/comments
PATCH /api/v1/admin/comments/:id/status
```

- visible/admin-hidden transition。
- counter same transaction。
- text searchはbounded/prepared。

### Stats/System

```text
POST /api/v1/admin/stats/:courseId/rebuild
POST /api/v1/admin/system/write-mode
```

- rebuild dry-run diff option。
- actual rebuild uses Phase 8 truth sources。
- repeated rebuild deterministic。
- system mode change audited。
- break-glass path/permissions/CSRFを明示。

UI:

- admin flag + server me roleの両方を確認するが、securityはserver。
- destructive-looking actions require explicit confirmation/target/reason。
- no physical delete button。
- API errorでnormal home/playをblockしない。
- secret/token/raw payloadをDOMへ出さない。

## 11. Audit contract

```js
{
  id,
  adminUserId,
  action,
  targetType,
  targetId,
  details: {
    reason,
    fromStatus,
    toStatus,
    requestId
  },
  createdAt
}
```

禁止:

- password/temporary password
- session token/CSRF
- raw IP
- full old/new description/comment bodies
- secret/env dump
- large gameplay JSON

Audit rowはappend-only。通常UIからdelete/editしない。

## 12. Stats rebuild

Truth sources:

```text
attempt/clear = stage_stats_daily + unaggregated play_attempts
like = likes rows
comment = visible comments rows
```

Process:

1. target stage lock/transaction strategy。
2. truth counts calculate。
3. invariant/check diff。
4. optional dry-run response。
5. stage_stats replace/update。
6. audit。
7. commit。

- raw/daily overlapを二重加算しない。
- aggregated markerを尊重。
- clear_rate_ppm integer recompute。
- hidden stageもrebuild可能。
- race with current mutationをtransaction/isolationで閉じる。

## 13. Thumbnail orphan cleanup

Orphan candidate lifecycle:

```text
new upload
-> DB reference commit failure / replaced old key
-> candidate timestamp
-> grace period
-> recheck current DB references
-> delete only if still unreferenced and not protected
```

- gameplay blobsは対象外。
- current/previous fallback generation mediaを保護。
- listing結果だけで即deleteしない。
- bounded batch/cursor。
- dry-run/metrics。
- delete failure retry。
- media key prefix allowlist。任意key delete禁止。

## 14. Maintenance scheduling

Worker jobs:

- Phase 8 stats compaction/stale attempt。
- fallback generation。
- old/partial generation cleanup。
- thumbnail orphan cleanup。
- stale/revoked session cleanup。
- idempotency/rate-limit expiry。

Requirements:

- jobごとにbounded batch/time budget。
- overlap lock/lease。
- idempotent/reentrant。
- one job failureで他job/old generationを破壊しない。
- last success/error summaryはsecretなし。
- production cronとmanual preview dry-runを分離。

## 15. Failure matrix

| Failure | Expected |
|---|---|
| Functions offline | R2 current generation browse/play/import |
| D1 quota/read-only | mutations disabled、public fallback維持 |
| generation midway failure | current unchanged |
| integrity failure | pointer unchanged |
| current pointer corrupt | previous known generation recovery/runbook |
| old generation cleanup race | protected generation not deleted |
| admin client role forged | server 403 |
| last admin suspend/delete | transaction拒否 |
| audit insert failure | admin mutation rollback |
| comment hide repeated | counter unchanged |
| stats rebuild repeated | same counts |
| rebuild during events | invariant preserved |
| thumbnail DB failure | old stays/new orphan |
| orphan false positive | DB recheck prevents delete |
| Service Worker stale auth | private response not served |
| fallback incompatible build | metadata/read可、play/import block reason |

## 16. Test matrix

### Fallback

- full generation file/hash/reference integrity。
- partial failure every step。
- current pointer last-write。
- current + previous2 retention。
- rollback pointer。
- Functions/D1 offline browser。
- read-only UI/server。
- cache policies/private noncache。

### Admin

- role/status/session/CSRF/Origin。
- last admin。
- user status + session revoke。
- stage/comment state transition/counter。
- audit rollback/no sensitive data。
- idempotency/concurrency。
- no physical delete endpoint/button。

### Maintenance

- overlapping invocation。
- bounded batches。
- stats compaction/rebuild。
- orphan recheck/grace/protected prefix。
- failed delete/retry。
- stale session/idempotency cleanup。

## 17. 完了条件

- R2 custom domainだけでbrowse/detail/comments/play/importが継続。
- generation publishがpointer-last atomicでpartial failure safe。
- current + previous2保持、rollback runbookがある。
- read-only server enforcementとUIが一致。
- Service Workerがmutation/authをcacheしない。
- admin全mutationがserver role/last-admin/CSRF/idempotency/auditで保護。
- physical deleteなし。
- stats rebuildがtruth sourcesからdeterministic。
- thumbnail orphan cleanupがgrace + DB recheck + protected keys。
- existing local/offline legacy pathに回帰なし。

## 18. Terra用プロンプト

```text
Phase 10 fallback/adminだけを実装してください。

本Phase文書、共通ガイド、Phase 3 R2/Worker、Phase 4 admin auth、Phase 5 stage/blob/media、Phase 6 public response、Phase 7 counters、Phase 8 aggregation/rebuildを再監査してください。

static generations、current pointer、read-only mode、client fallback、Service Worker cache rules、admin users/stages/comments/stats/system、audit、rebuild、orphan cleanup、maintenance schedulingを対象にします。physical delete/gameplay blob GC/user self-deleteは実装しないでください。

pointerは全generation integrity成功後に最後に更新し、current+previous2を保護してください。admin securityはserverで強制し、auditとmutation/counterを可能な限り同一transactionにしてください。

各failure point、rollback、overlap、cleanup false positiveをtestし、preview fallback drill、focused/full checks、build、secret scan、git diff自己レビューまで実行してください。問題があれば修正・再検証し、共通報告形式で返してください。
```
