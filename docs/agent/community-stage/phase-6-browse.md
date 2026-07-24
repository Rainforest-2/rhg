# Phase 6 — Browse / Search 実行契約

## 0. Phaseの目的

ログイン不要で、公開stageの一覧・検索・sort・detail・author page・play/import導線を提供する。

Phase 6はread pathが中心。mutation、auth requirement、social、stats mutation、restriction runtimeを追加しない。

## 1. 開始条件

- Phase 3 D1/API基盤が存在する。
- Phase 5 published stage metadata / payload / manifest契約が存在する。
- active/author-hidden/admin-hiddenのstatus semanticsがserverで固定済み。
- public read responseにprivate/auth dataが混ざらない。
- `communityBrowse` flagは既定OFFのまま段階開放可能。

## 2. 非目標

- publish editor
- like/comment mutation
- telemetry mutation
- admin moderation UI
- fallback snapshot切替（Phase 10）
- FTS tokenizerだけに依存する日本語検索
- infinite scrollだけのnavigation

## 3. Public API契約

```text
GET /api/v1/stages
GET /api/v1/stages/:courseId
GET /api/v1/users/:loginId
GET /api/v1/users/:loginId/stages
```

### List query

```text
page: positive integer, default 1
sort: new | plays | likes | clear-asc
q: bounded NFC string
```

- 1page最大50件。
- invalid page/sortはstable validation errorまたは明示default。routeごとに混在させない。
- responseへnormalized query、page、pageSize、hasPrevious、hasNext、必要ならtotalPagesを含める。
- OFFSET方式を採用するなら大pageの負荷を計測する。設計契約のpage番号をcursorだけへ変更しない。
- all queryはprepared statement。

### Card fields

常時表示:

- thumbnail URL / placeholder metadata
- title
- author display name + login ID
- difficulty
- play/attempt count（UI用名称を統一）
- like count
- course ID/detail URL用ID

常時表示しない:

- clear rate
- comments
- full description
- restriction details
- lineage detail

### Detail fields

- course/content/schema/revision/minimum build manifest
- metadata
- author current display
- attempt/clear/rate/like/comment counts
- restrictions summary
- parent/root/original/editor display
- comments enabled
- status-compatible play/import availability

R2 key、internal stage ID、password/session/auth metadataを返さない。

## 4. Sortと決定的tie-break

```text
new:
  published_at DESC, stage_id DESC
plays:
  attempt_count DESC, published_at DESC, stage_id DESC
likes:
  like_count DESC, published_at DESC, stage_id DESC
clear-asc:
  clear_count > 0 AND attempt_count > 0
  clear_rate_ppm ASC, attempt_count DESC, published_at DESC, stage_id DESC
```

`stage_id`は内部安定tie-breakerとしてSQLで使ってよいが、public responseへ不要に露出しない。

- 0%（clear_count=0）はclear-ascから除外。
- floating divisionでsortしない。`clear_rate_ppm` integerを使う。
- same counter/timestampでもpage間duplicate/skipが起きないことをfixtureで確認する。

## 5. 日本語検索

### 5.1 Normalize

- NFC
- fieldごとのcase fold（ASCII login/course）
- leading/trailing whitespace方針を固定
- NUL/bidi危険制御文字拒否
- max code point length

### 5.2 Course ID

8文字canonical alphabetへ一致するqueryは、完全一致を最優先する。

- uppercase normalize
- exact lookup
- hitした場合は通常n-gram結果より優先
- partial course IDをcourse exactとして扱わない

### 5.3 N-gram

Tables:

```text
stage_search_grams(stage_id, gram, field='title')
user_search_grams(user_id, gram, field='login'|'display')
```

- Unicode code pointsから2-gram/3-gram生成。
- UTF-16 code unitを途中分割しない。
- duplicate gramsをdedupe。
- title/display更新transactionとindex再生成を一致させる。
- multi-field resultをstage IDへ収束しduplicate cardを出さない。
- gram intersection後、元fieldへ`instr`/exact post-filterをかけfalse positiveを除く。

### 5.4 1文字query

bounded `instr()` fallback。

- active rowsだけ
- hard result limit
- pagination/sortと整合
- full unbounded scanを常態化させない
- `EXPLAIN QUERY PLAN`と代表データ量で負荷を記録

## 6. UI state model

推奨state:

```js
{
  route: 'home' | 'browse' | 'stage' | 'author',
  page,
  sort,
  q,
  scrollY,
  status: 'idle' | 'loading' | 'ready' | 'empty' | 'error' | 'offline',
  requestToken
}
```

規則:

- URL queryへ`page`, `sort`, `q`を反映。
- browser back/forwardでqueryとscroll位置を復元。
- stale requestが最新stateを上書きしない。
- loading中の連打/検索競合をAbortControllerまたはrequest tokenで無効化。
- API失敗でhomeのlegacy Playをblockしない。
- feature flag OFFでbrowse DOM/API requestを作らない。
- loginなしで全read/play/import導線を表示。

## 7. Layout / accessibility

対象viewports:

- 320x568
- 390x844
- 667x320 landscape
- 768x1024
- 1024x768 iPad mini相当
- desktop

要件:

- 50 cardsで横overflowなし。
- long Japanese title / emoji display nameでcardを破壊しない。
- page controlsへkeyboard/touchで到達。
- current pageをaria-currentで示す。
- sort/searchはlabelを持つ。
- loading/error/emptyをaria-liveで通知。
- image missing時にlayout shiftを抑える。
- user thumbnailが無い場合は安全な固定placeholder。
- URL文字列をHTML/linkへ勝手に変換しない。

## 8. Placeholder

サムネイル未設定時:

- CSSまたは固定safe SVG
- 城/敵の抽象silhouette
- difficulty badge
- title先頭文字
- user textをSVG/HTMLへ未escape挿入しない
- object URLやdata URLをserver fieldから直接信用しない

## 9. Play / import導線

### Play

- detail manifest compatibilityを先に確認。
- payload hash/schema/asset revision/minimum buildがunsupportedならplay不可＋理由表示。
- payloadを取得・hash再検証し、既存CustomStage normalize/validate/adapterへ渡す。
- local importを強制しない一時play方式を採る場合も、BattleSceneへ直結しない。
- API/detail失敗で既存公式/local playを壊さない。

### Import

Phase 5のatomic import ownerを呼ぶだけ。UI側で独自保存を作らない。

- confirmation/preview
- success後local custom stage一覧へ導線
- quota/validation/hash error
- duplicate local import方針を明示

## 10. Cache / privacy

- public list/detail/author responseはpublic cache可能だが、Phase 10 fallbackと競合しないTTL/header契約を固定。
- auth cookieが付いていてもpublic responseへprivate `likedByMe`等を混ぜない。必要なら別private endpoint。
- Service Workerでauth/private responseをcacheしない。
- mutation routeをcacheしない。
- stale metadataでunsupported payloadをplayさせない。

## 11. Test matrix

### Query

- page 1/2/last/out-of-range
- exactly 50 / 51 rows
- tie counter/timestampでduplicate/skipなし
- four sorts
- clear 0除外
- attempt 0表示`—`
- course exact priority
- Japanese 1/2/3+ character search
- composed/decomposed Unicode
- login ID case fold
- title/display update index反映
- hidden rows全read pathから除外
- derivative hidden parent display

### UI/browser

- URL query roundtrip
- back/forward state + scroll restore
- rapid query stale response抑制
- no login read/play/import
- API error/offlineでもlegacy Play
- 50 cards responsive
- long title/emoji
- keyboard/page controls
- missing image placeholder
- feature flag OFF no request/DOM

### SQL/performance

- prepared statements
- `EXPLAIN QUERY PLAN`
- representative 1/50/large page
- n-gram intersection index利用
- 1-char bounded fallback

## 12. 完了条件

- public list/detail/author APIsが50-page・4sort・search契約どおり。
- deterministic tie-breakでpagination重複/欠落なし。
- Japanese 2/3-gram + 1-char bounded fallbackが動く。
- course ID exactが最優先。
- UI URL/back/scroll/stale requestが正しい。
- play/importが既存safe pipelineを再利用。
- no-login、offline failure isolation、flag-off回帰が通る。
- responsive/keyboard/placeholderのbrowser evidenceがある。

## 13. Terra用プロンプト

```text
Phase 6 browseだけを実装してください。

本Phase文書、共通ガイド、最終設計、Phase 5のpublished manifest/payload/import契約、current home controllerを再監査してください。

public list、50件page、4sort、course exact、日本語2/3-gram検索、1文字bounded fallback、detail、author page、placeholder、play/import導線、URL/back/scroll stateを対象にします。publish/social/stats mutation/restriction runtime/admin/fallback生成は先行実装しないでください。

閲覧・検索・play・importへloginを要求せず、API失敗でlegacy/local playをblockせず、online payloadを直接BattleSceneへ渡さないでください。

SQL tie-breakとquery plan、search fixtures、50-card responsive browser testsを含めて実装し、focused/full checks、build、git diff自己レビューまで実行してください。問題があれば修正・再検証し、共通報告形式で返してください。
```
