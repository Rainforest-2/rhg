# Phase 5 — Canonical publish / import 実行契約

## 0. Phaseの目的

CustomStage gameplayを決定的にcanonicalize/hashし、immutable R2 blob、公開metadata、course ID、lineage、thumbnail、local importを一貫した契約で実装する。

このPhaseの核心は次の4点。

1. client/serverで同一gameplayが必ず同じSHA-256になる。
2. metadata変更とgameplay変更を混同しない。
3. R2とD1の部分成功を回収可能にする。
4. online payloadを既存CustomStage normalize/validate/adapter以外へ直結しない。

## 1. 開始条件

- Phase 1 CustomStage schema v3 / envelope / provenanceがmainに存在する。
- Phase 3 D1/R2 facadeとmigrationsが存在する。
- Phase 4 auth/session/CSRF/idempotency middlewareが利用可能。
- `communityPublish` flagは既定OFF。
- current asset catalog revisionを取得する正規ownerを特定済み。
- CustomStage normalize、validate、atomic local saveのcurrent ownerを再監査済み。

## 2. 非目標

- browse list/search UI（Phase 6）
- like/comment（Phase 7）
- play stats（Phase 8）
- restriction runtime/editor（Phase 9。ただしschema fieldはhash対象）
- fallback generations/admin UI（Phase 10）
- gameplay updateを同じcourse IDで許可すること
- client申告のhash/root author/lineageを信用すること

## 3. データ境界

### Gameplay — immutable / hash対象

```text
battle
spawns
modifications
limits
challengeRestrictions
gameplaySchemaVersion
restrictionSchemaVersion
assetCatalogRevision
```

### Metadata — mutable / hash対象外

```text
title
description
difficulty
commentsEnabled
authorNote
thumbnail
author
publishedAt / updatedAt
stats
status
```

規則:

- gameplay hashが変わる変更は新course ID。
- 同一courseでPATCHできるのはmetadataだけ。
- serverはPATCH bodyにgameplay fieldがあれば拒否する。静かに無視しない。
- gameplay blobは投稿後immutable。
- 同じcontent hashを複数published stageが参照可能。

## 4. Canonicalization単一定義

推奨境界:

```text
server/canonical/
├─ canonical-gameplay.js
├─ canonical-json.js
├─ content-hash.js
└─ allowed-gameplay-fields.js

js/community/
└─ CommunityCanonicalGameplay.js

fixtures/community/canonical/
└─ *.json + expected hash
```

client/serverでcopy-paste実装を2つ作らない。browser/Worker両方で使える副作用なしESM moduleへ寄せるか、少なくとも同じgolden fixtureでbyte単位一致を強制する。

### 4.1 Canonical envelope

```js
{
  gameplaySchemaVersion: 3,
  restrictionSchemaVersion: 1,
  assetCatalogRevision,
  gameplay: {
    battle,
    spawns,
    modifications,
    limits,
    challengeRestrictions
  }
}
```

### 4.2 Normalization順

```text
1 JSON/body safety limits
2 CustomStage schema/version validation
3 migrate supported legacy envelope if route allows
4 CustomStage normalize
5 CustomStage validate
6 extract allowed gameplay fields only
7 normalize opaque IDs to strings
8 normalize strings to NFC
9 normalize numbers (-0 -> 0; reject non-finite)
10 canonical modification dedupe/reference rewrite
11 recursively sort object keys by Unicode code point
12 preserve every array order
13 deterministic JSON serialization
14 UTF-8 encode
15 SHA-256
```

### 4.3 必須規則

- object keyはUnicode code point順。
- array順は保持。spawn/hit/orderは意味を持つ。
- `id`, `createdAt`, `updatedAt`, metadataを除外。
- `undefined`, NaN, Infinity, -Infinityを拒否。
- `-0`は`0`。
- stringはNFC。
- prototype pollution keyをどの深さでも拒否。
- unknown gameplay fieldを拒否。
- numberをlocale/string conversionへ通さない。
- JSON.stringifyのengine依存だけにcanonical key orderを任せない。
- duplicate modificationは内容hashでdedupeし、参照を書換えた後のcanonical shapeを固定する。
- asset revision / restriction versionを必ず含める。

## 5. Golden fixture matrix

最低限、client/server双方へ同じfixtureを通す。

| ケース | 期待 |
|---|---|
| object key順だけ違う | 同byte / 同hash |
| metadataだけ違う | 同hash |
| local ID/timestampだけ違う | 同hash |
| Unicode composed/decomposed | 同hash |
| `-0` vs `0` | 同hash |
| spawn array順違い | 別hash |
| modification参照順の意味差なし | canonical dedupe後同hash |
| modification内容違い | 別hash |
| restriction違い | 別hash |
| asset revision違い | 別hash |
| unknown gameplay field | 拒否 |
| NaN/Infinity相当 | parse/validation拒否 |
| `__proto__` nested | 拒否 |
| unsupported schema/version | 拒否 |
| pretty/minified input | 同hash |

expected canonical UTF-8 textとexpected hashをfixtureへ固定する。hashだけ固定するとserialization差の原因追跡が遅くなる。

## 6. Course ID

Alphabet:

```text
ABCDEFGHJKLMNPQRSTUVWXYZ23456789
```

- 8文字
- I/O/0/1を除外
- `crypto.getRandomValues()`
- DB UNIQUE
- collision時のみbounded retry
- uppercase canonical display/search
- URLへauthor nameを含めない
- predictable timestamp/random Math.randomは禁止

course ID生成失敗、retry上限、DB collisionをtestする。

## 7. Publish request / transaction choreography

### 7.1 Client preview

送信前に表示:

- title/description/difficulty/thumbnail
- spawn count
- modifications有無
- restrictions
- comments enabled
- parent/original display
- gameplay immutable warning
- client computed hash（diagnosticとして可。ただしserver authoritative）

### 7.2 Server validation

```text
auth + CSRF + write mode + idempotency
-> body limits / field allowlist
-> metadata validation
-> gameplay normalize/validate
-> server canonical bytes + SHA-256
-> asset revision support
-> parentCourseId lookup（任意）
-> server derives parent/root/source author
-> thumbnail validation/staging（任意）
```

clientから受け取っても信用しない:

- contentHash
- rootCourseId
- sourceAuthorUserId
- author role/name
- publishedAt
- R2 key

### 7.3 R2 / D1 partial failure strategy

D1 transactionとR2 putは単一atomic transactionではない。必ず明示的な順序と回収策を持つ。

推奨:

```text
A. canonical blob HEAD/get metadata
B. blobが無ければ immutable keyへput
C. D1 transaction:
   - stage_blobs INSERT OR verify existing metadata
   - published_stages INSERT
   - stage_stats INSERT
   - search index initial rows（Phase 6 ownerなら後続可）
   - idempotency response save
   - reference_count update
D. transaction失敗:
   - newly uploaded unreferenced blobは削除しない
   - orphan candidateとしてaudit/maintenance対象
E. response
```

Gameplay blobは自動GCしない設計なので、D1失敗後のunreferenced blobが残っても破壊的cleanupを即時実行しない。reference_countは真実の所有者ではなく監査補助として扱う。

同じhashを別requestが同時publishしても、R2 putとstage_blobs insertが安全に収束すること。

### 7.4 Idempotency

`Idempotency-Key`必須。

Key scope:

```text
scope = stage-publish
actor = authenticated user ID
key = client-provided bounded random value
```

- 同key/同request再送は保存responseを返す。
- 同key/異なるpayloadはconflict拒否。
- responseにはsecret/internal keyを保存しない。
- timeout後retryで別courseを作らない。

## 8. Metadata update / hide

### PATCH metadata

- author active userのみ（admin serviceは別）。
- title/description/difficulty/commentsEnabled/authorNote/thumbnailだけallowlist。
- gameplay/contentHash/lineage/author/publishedAt/statusは拒否。
- metadata history本文は保存しない。
- updatedAtをserver生成。
- thumbnail replaceは専用choreographyを使う。

### DELETE stage

作者操作は物理削除でなく:

```text
active -> author-hidden
```

- list/search/author pageから除外。
- new play start拒否はPhase 8で接続。
- blob/social/stats保持。
- author本人のrestore APIを作らない。
- local imported copyへ影響しない。

## 9. Lineage

Clientが送るのは`parentCourseId`だけ。

Server:

1. parentをcourse IDで取得。
2. parent存在/visibility/compatibilityを確認。
3. `parent_stage_id`を設定。
4. parent.rootがあれば継承、なければparent自身をrootにする。
5. original authorはDB joinから導出。

- hidden parentからの新規derivative可否を設計書とUIで一致させる。
- parentが後でhiddenになってもchildはactive継続。
- UI原作表示は`非公開`へ変えるが、client申告名へfallbackしない。
- cycleはserver生成規則上発生させない。

## 10. Thumbnail pipeline

### Client

- PNG/JPEG/WebP inputのみ
- 16:9 crop
- max 1280x720
- canvas再encodeでmetadata/EXIF除去
- max 1 MiB
- preview/retry/cancel

### Server

- auth/CSRF/write mode/idempotency
- body byte上限をparse前に適用
- Content-Typeだけを信用しない
- magic byte + decoded dimensions検証
- SVG/GIF/video/HTML/executable拒否
- user filenameをkeyへ使わない
- versioned random/content-derived key
- media originはcookie無し、`nosniff`

Replace順:

```text
new object upload
-> server validation complete
-> D1 metadata transaction
-> fallback/snapshot dirty mark（Phase 10）
-> old keyをorphan queueへ
```

D1失敗時new objectはorphan。旧objectを先に消さない。

## 11. Import pipeline

```text
public manifest/detail
-> immutable payload fetch
-> expected byte-size/body limits
-> SHA-256 recompute
-> server manifest hashと比較
-> schema/restriction/asset revision/min client確認
-> CustomStageSchema v3 normalize
-> CustomStageValidator
-> provenance作成
-> new local custom stage ID
-> atomic local store save
```

規則:

- published stage ID/course IDをlocal IDとして流用しない。
- imported stageは既存local CustomStage一覧へ入る。
- import後は完全編集/JSON export可能。
- online metadata updateでlocal copyを書換えない。
- online hidden後もlocal copyを残す。
- import失敗/quota errorで既存storeを変更しない。
- provenanceは別store ownerを尊重し、gameplay hashへ混ぜない。
- downloaded hash不一致はplay/importとも拒否。silent re-normalizeして続行しない。

## 12. API対象

```text
POST   /api/v1/stages
GET    /api/v1/stages/:courseId/payload
GET    /api/v1/stages/:courseId/import
PATCH  /api/v1/stages/:courseId/metadata
DELETE /api/v1/stages/:courseId
PUT    /api/v1/stages/:courseId/thumbnail
```

Phase 6 detail/list routeが未実装でも、payload/import response contractはテストできる。公開metadata GETを最低限作る場合もbrowse UIを先行しない。

## 13. Failure matrix

| Failure | 必須結果 |
|---|---|
| canonical validation failure | R2/D1変更なし |
| client/server hash mismatch | server値採用、request拒否または明示診断 |
| R2 put failure | D1 stage作成なし |
| R2 success / D1 failure | orphan安全保持、retry可能 |
| duplicate hash concurrent | blob1個、stageは各request/idempotencyどおり |
| course collision | bounded regenerate |
| idempotent retry | 同response、stage増加なし |
| same idem key/different payload | conflict |
| parent nonexistent/forged root |拒否、server derive |
| thumbnail invalid | metadata/old thumbnail不変 |
| thumbnail put success/DB fail | old維持、新object orphan |
| import hash mismatch | local store不変 |
| import quota error | local store不変、明示error |
| unsupported asset revision/build | metadata閲覧可、play/import不可 |
| read-only mode | publish/update/hide/upload拒否、public read/import維持 |

## 14. 完了条件

- canonical UTF-8 bytes/hashがclient/server golden fixturesで完全一致。
- metadata差は同hash、spawn/restriction/asset差は別hash。
- unknown/non-finite/prototype keyを拒否。
- server authoritative hash/course/lineage/author。
- R2 dedupeとD1 partial failureが回収可能。
- publish idempotencyがretryで重複stageを作らない。
- metadata-only updateとnew-course境界がserverで強制される。
- thumbnail validation/replace順が安全。
- importがhash再検証後に既存atomic local pipelineを通る。
- existing local/offline/flag-off pathに回帰なし。

## 15. Terra用プロンプト

```text
Phase 5 canonical publish/importだけを実装してください。

本Phase文書、共通ガイド、最終設計、current CustomStage schema/validator/store/adapter、Phase 3 R2/D1 facade、Phase 4 auth/idempotencyを再監査してください。

canonical bytes + SHA-256、immutable R2 dedupe、course ID、publish、metadata-only update、author hide、thumbnail、server-derived lineage、atomic local importを対象にします。browse/social/stats/restriction runtime/fallback/admin UIは先行実装しないでください。

client hash/role/author/root/R2 keyを信用せず、online payloadを直接BattleSceneへ渡さず、R2/D1部分成功を明示的に回収可能にしてください。

まずgolden fixtureとfailure matrixを固定し、その後実装してください。focused unit/integration tests、concurrency/idempotency tests、browser import/publish preview、full available checks、build、git diff自己レビューまで行い、問題があれば修正・再検証してください。共通報告形式で返してください。
```
