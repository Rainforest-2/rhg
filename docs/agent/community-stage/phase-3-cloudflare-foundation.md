# Phase 3 — Cloudflare基盤 実行契約

## 0. Phaseの目的

Cloudflare Pages / Pages Functions / D1 / R2 / maintenance Workerを、previewとproductionで分離された最小基盤として構築する。

このPhaseでは**基盤とschemaを作るだけ**であり、auth、publish、browse、social、stats、restrictions、admin UIの製品ロジックは実装しない。

## 1. 開始条件

- Phase 1 schema v3がmainへmerge済み。
- Phase 2 home shellがmainへmerge済み。
- `communityHome`以外のcommunity feature flagは既定OFF。
- local/offlineの従来プレイがPhase 2 focused checkで通る。
- current Cloudflare公式資料で、Pages Functions、D1、R2、Cron、custom domain、無料プランの現行制約を再確認した。

Cloudflareの上限値は変更されるため、数値をコードやこの文書から推測しない。公式資料の確認日と参照項目だけを実装レポートへ残す。

## 2. 非目標

- register/login/session実装
- stage publish/import API
- browse/search query
- likes/comments/telemetry
- restriction runtime
- fallback generation本実装
- admin UI
- production secretの実値commit
- custom domainのDNSをコードだけで「設定済み」と宣言

## 3. 推奨ファイル境界

現行treeを再確認し、未作成の場合は次を基準にする。

```text
functions/
├─ _middleware.js
└─ api/v1/
   └─ _foundation.js        # binding/response/request-size等の共通基盤のみ

server/
├─ env/
│  ├─ bindings.js
│  └─ write-mode.js
├─ db/
│  ├─ transaction.js
│  └─ migrations.js
├─ http/
│  ├─ response.js
│  └─ request.js
└─ storage/
   ├─ blob-store.js
   └─ media-store.js

migrations/
├─ 0001_users_sessions.sql
├─ 0002_stage_blobs.sql
├─ 0003_stages_stats.sql
├─ 0004_social.sql
├─ 0005_search.sql
└─ 0006_idempotency_audit.sql

workers/community-maintenance/
├─ src/index.js
└─ wrangler.jsonc           # またはrepo既存形式

wrangler.jsonc              # Pages local/preview契約。repo方針がtomlなら合わせる
.env.example / .dev.vars.example
```

ファイル名は既存構成がある場合そちらへ合わせる。frontendの`js/community/*`からCloudflare bindingを直接読む設計は禁止する。

## 4. Binding契約

必須binding名:

```text
D1  COMMUNITY_DB
R2  COMMUNITY_BLOBS
R2  COMMUNITY_MEDIA
```

必須secret名:

```text
SESSION_SECRET
RATE_LIMIT_SECRET
TURNSTILE_SECRET
ADMIN_BOOTSTRAP_ID
ADMIN_BOOTSTRAP_PASSWORD
```

補助設定:

```text
COMMUNITY_ENV = local | preview | production
COMMUNITY_WRITE_MODE = read-write | read-only
COMMUNITY_MEDIA_ORIGIN
COMMUNITY_FALLBACK_ORIGIN
```

規則:

- productionとpreviewでD1/R2を共有しない。
- secretの実値を`.env.example`、migration、fixture、screenshot、logへ入れない。
- missing bindingはcommunity APIだけを明示的に失敗させる。通常ゲームbootを失敗させない。
- browserへbinding名以外の内部R2 keyやsecret metadataを返さない。
- `COMMUNITY_WRITE_MODE`の未知値はread-onlyへfail closedする。

## 5. Migration設計

### 5.1 一般規則

- forward-only。
- `DROP TABLE`、既存columnの破壊的rename、data lossを伴う変換は禁止。
- 後続追加columnは原則nullableまたは安全なdefaultから導入する。
- migrationごとにtransaction境界を明確にする。
- D1 localへ空DB適用、全migration再適用、既存schemaからのincremental適用を確認する。
- foreign key、CHECK、UNIQUE、query用indexをschemaと同時に定義する。
- timeはUTC epochの単位を一つに固定し、API/DB/helper間で混在させない。

### 5.2 Migration責務

`0001_users_sessions.sql`

- users
- sessions
- login ID uniqueness
- token hash uniqueness
- user status / role constraints
- session lookup/revocation index

`0002_stage_blobs.sql`

- stage_blobs
- published_stages
- content hash / course ID uniqueness
- lineage foreign keys
- author/status/new order index

`0003_stages_stats.sql`

- stage_stats
- play_attempts
- stage_stats_daily
- attempt/compaction/sort indexes

`0004_social.sql`

- likes
- comments
- stage/user/status/time indexes

`0005_search.sql`

- stage_search_grams
- user_search_grams
- gram lookup indexes

`0006_idempotency_audit.sql`

- idempotency_keys
- rate-limit storage if別tableで必要
- admin_audit
- expiry/lookup indexes

最終設計書のDDLを正規契約とし、型やCHECKを都合で緩めない。Cloudflare/D1の現行SQL制約で変更が必要なら、意味を維持する代替とテストを記録する。

## 6. Foundation middleware

Phase 3 middlewareは次だけを持つ。

1. request ID生成
2. `/api/v1/*`のJSON response envelope
3. request body sizeの早期制限
4. method/content-typeの基礎検証
5. bindingの型・存在確認
6. `COMMUNITY_WRITE_MODE` snapshot
7. security headerの基礎
8. internal errorの安全な変換

まだauth/CSRF/rate limitを「実装済み風」のstubで通さない。未実装mutation routeは404/明示的unsupportedにする。

成功response:

```js
{ ok: true, data: {} }
```

失敗response:

```js
{
  ok: false,
  error: {
    code: 'stable-machine-code',
    message: '利用者向け安全な文言',
    details: {}
  }
}
```

禁止:

- stack trace
- raw SQL
- R2 key
- binding dump
- secret名と値
- raw exception object

## 7. R2契約

Phase 3ではstorage facadeと接続テストだけを作る。

```text
COMMUNITY_BLOBS: immutable gameplay payload / fallback payload
COMMUNITY_MEDIA: versioned thumbnail/media
```

- 利用者ファイル名をkeyへ使わない。
- browserへbucket listingを公開しない。
- gameplay blobは将来SHA-256 keyでimmutable保存するため、overwrite前提APIを作らない。
- mediaはupload成功とDB成功が分かれることを前提に、orphan回収可能な戻り値を持たせる。
- Phase 3で実データを公開保存しない。固定probe objectを使う場合は専用prefixとcleanupを用意する。

## 8. Maintenance Worker骨格

Phase 3のWorkerは、Cronが起動しbindingへ接続できることを検証する安全な骨格に留める。

禁止:

- raw attempt削除
- stats再集計
- fallback current pointer更新
- orphan media削除
- stale sessionの本削除

後続Phaseがownerを追加するまで、dry-run/diagnosticだけを返す。productionで大量scanする空実装を作らない。

## 9. Preview / production分離

最低限確認する項目:

| 項目 | local | preview | production |
|---|---|---|---|
| D1 | local DB | preview DB | production DB |
| blob R2 | local/emulated | preview bucket | production bucket |
| media R2 | local/emulated | preview bucket | production bucket |
| secrets | `.dev.vars` | preview secrets | production secrets |
| write mode | read-write可 | read-write可 | explicit設定 |
| origins | localhost | preview URL | production custom domain |

`wrangler`設定にproduction secret値を書かない。環境名の取り違えをテスト可能なdiagnostic metadataで検出するが、そのmetadataを公開responseへ過剰に出さない。

## 10. テストマトリクス

### Static / unit

- binding validator: 正常、missing、wrong shape
- write mode: read-write、read-only、unknown→read-only
- JSON response: stack/raw SQLを含まない
- body size超過をroute処理前に拒否
- unsupported content type/method
- environment configにsecret値がない

### D1 local

- empty DBへ0001〜0006順適用
- migration再実行手順が明確
- required tables/indexes/constraintsが存在
- duplicate login/course/hash/session tokenを拒否
- foreign key violationを拒否
- representative `EXPLAIN QUERY PLAN`で想定index利用

### R2 / Worker

- blob/media bindingを取り違えない
- deterministic probe put/get/delete
- listing APIを公開しない
- Worker dry-runが破壊的変更をしない

### Existing regression

- feature flags OFFで既存起動
- home→legacy play
- local CustomStage save/import/play
- community API未接続でも通常ゲームboot成功
- offlineでlegacy entry可能

## 11. 完了条件

- localでPages FunctionsとD1/R2 facadeが起動する。
- 6 migrationがfresh DBへ順に適用できる。
- preview/production bindingが明確に分離されている。
- secret実値がtracked tree、build output、logにない。
- maintenance Workerは安全なnon-destructive skeleton。
- community API基盤障害が既存ゲームへ波及しない。
- Phase 4以降のbusiness logicを先行実装していない。
- focused tests、available full checks、buildが結果付きで報告される。

## 12. Terra用プロンプト

```text
Phase 3 Cloudflare基盤だけを実装してください。

最初に docs/agent/community-stage/README.md と本Phase文書を読み、current main/branch、既存Cloudflare設定、package依存、Functions/migration/Workerの有無を再監査してください。Cloudflareの現行公式仕様と無料プラン制約も確認し、設計前提との差があれば先に報告してください。

実装対象は Pages Functions基盤、D1 migrations、R2 facade、preview/production分離、secret名契約、maintenance Workerの非破壊骨格です。auth、publish、browse、social、stats、restrictions、fallback生成、admin UIは実装しないでください。

通常ゲームboot、local CustomStage、feature flag OFF、offline legacy playへ影響を与えないこと。secret実値を一切commitしないこと。migrationはforward-onlyで破壊的DDL禁止です。

変更前に予定ファイルと理由を列挙し、D1 local migration、binding tests、focused checks、full available checks、build、git diff自己レビューまで実行してください。自己レビューで問題を見つけたら修正・再検証し、共通報告形式で返してください。
```
