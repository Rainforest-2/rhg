# Phase 7 — Social（Like / Comment）実行契約

## 0. Phaseの目的

公開stageへ、login必須のlike/unlikeとcomment投稿、public comment閲覧、counter整合、rate limit、admin hide serviceを追加する。

最優先事項は、**row mutationとcounterを同一transactionで一度だけ更新すること**。

## 1. 開始条件

- Phase 3 `likes` / `comments` / `stage_stats` / idempotency schemaが存在。
- Phase 4 auth/session/CSRF/rate-limit helperが存在。
- Phase 5 published stage status semanticsが存在。
- Phase 6 stage detail/comment host UIが存在するか、独立componentとして接続可能。
- `communitySocial` flagは既定OFF。

## 2. 非目標

- downvote / report / reply / edit
- user/authorによるcomment削除
- follow/friend/block/mute
- comment内URLの自動link
- battle座標comment
- admin dashboard全体（Phase 10）
- stats counterの独立eventual update

## 3. Like契約

```text
PRIMARY KEY(stage_id, user_id)
PUT    /api/v1/stages/:courseId/like
DELETE /api/v1/stages/:courseId/like
```

Policy:

- login必須。
- active userのみ。
- author本人も可。
- play前でも可。
- active stageへの新規likeのみ許可。
- unlikeはidempotent。
- repeated PUTは1票のまま。
- clientの`likeCount`や`liked`を信用しない。

### PUT transaction

```text
lookup active stage
-> INSERT OR IGNORE likes(stage_id, user_id)
-> INSERTされた場合だけ stage_stats.like_count += 1
-> authoritative liked=true/countを返す
```

### DELETE transaction

```text
DELETE matching row
-> DELETEされた場合だけ like_count -= 1
-> countを0未満にしないguard
-> authoritative liked=false/countを返す
```

単純read→writeでは競合に弱い。D1のreturning/change countまたは同等のatomic判定を使う。

## 4. Comment契約

```text
GET  /api/v1/stages/:courseId/comments
POST /api/v1/stages/:courseId/comments
```

### Content

- 1〜200 Unicode code points
- NFC
- multiline可
- emoji可
- URL文字列可、link化しない
- HTML不可。serverはplain textとして保存し、clientは`textContent`。
- NUL / 危険制御文字拒否
- edit不可
- user/author delete不可

### Visibility

```text
visible
admin-hidden
```

- public GETはvisibleのみ。
- admin hide/unhide serviceはserver role guard必須。
- hideでrow物理削除しない。
- hidden commentはpublic counterから除く。

### commentsEnabled

- falseなら新規POST拒否。
- 既存visible commentsは表示継続。
- client表示だけでなくserverで強制。

## 5. Comment ordering / pagination

- defaultは設計/UI方針に合わせてold/newを明示。
- initial 20件。
- `さらに読み込む`。
- stable tie-break: `created_at`, `id`。
- old/new切替でduplicate/skipなし。
- user current display nameをusers joinから取得し、投稿時nameを複製しない。
- deleted userは`削除済みユーザー`表示。

Public responseへ内部user ID、IP key、moderation detailを不要に出さない。

## 6. Rate limit / duplicate防止

最低条件:

```text
same account: previous commentから5秒
same account: UTC 1日100件
same account + same stage: 同文連続投稿拒否
```

- transaction内で競合を考慮。
- client clockを信用しない。
- UTC dayはserver生成。
- whitespace/NFC normalization後の本文でsame-text判定。
- raw IP永続保存禁止。
- rate-limit failureでcomment insert/counter変更なし。
- DB rate-limit lookup失敗を無制限許可しない。

Comment POSTは`Idempotency-Key`必須。

- timeout retryでduplicate commentを作らない。
- same key/different normalized bodyはconflict。
- duplicate-text errorとidempotent replayを区別する。

## 7. Comment transaction

```text
auth + CSRF + Origin + write mode
-> active stage + commentsEnabled
-> normalize/validate body
-> rate limit + duplicate-text check
-> idempotency check
-> INSERT comment
-> stage_stats.comment_count += 1
-> idempotency response save
-> commit
```

いずれかが失敗したら全rollback。

Admin hide transaction:

```text
server-side admin guard
-> visible -> admin-hidden transition only
-> transitionした場合だけ comment_count -= 1
-> audit row
-> commit
```

Unhideは逆方向。duplicate hide/unhideでcounterを変えない。

## 8. Counter integrity

`stage_stats.like_count` / `comment_count`はdenormalized read optimization。

Truth:

- likes rows
- visible comments rows

Phase 7でrebuild helper/testを用意してよいが、admin UIとmaintenance schedulingはPhase 10。

必須invariant:

```text
like_count = COUNT(likes)
comment_count = COUNT(comments WHERE status='visible')
```

- negative counter禁止。
- row mutation成功/counter失敗の部分commit禁止。
- hidden stageでも既存social row保持。
- author-hidden/admin-hiddenへの新規like/comment方針をserverで拒否。

## 9. Client UI

### Like

States:

```text
anonymous -> login prompt
idle liked/unliked
pending
success
rate-limited/error
session-expired
read-only
```

- optimistic updateする場合、server authoritative countで必ず収束。
- rapid toggleはserialize/abortし、out-of-order responseで逆転させない。
- buttonはpressed state/accessible nameを持つ。
- loginなしでもcount閲覧可能。

### Comment

- public listはlogin不要。
-投稿formはlogin active + commentsEnabled + read-write時のみ。
- textarea label、remaining code points、error summary。
- submit連打をidempotencyで防止。
- server textをHTMLとして描画しない。
- 5秒/100日制限をclient countdownだけに依存しない。
- hidden commentをDOMへ残してCSSだけで隠さない。
- API failureでstage play/import/legacy playをblockしない。

## 10. API response / errors

Stable error categories例:

```text
login-required
account-not-active
stage-not-active
comments-disabled
comment-invalid
comment-too-fast
comment-daily-limit
comment-duplicate
idempotency-conflict
read-only
```

内部SQL、rate-limit key、raw body、stackをdetailsへ返さない。

## 11. Test matrix

### Like

- first PUT -> row1/count+1
- duplicate PUT -> row1/count unchanged
- DELETE -> row0/count-1
- duplicate DELETE -> unchanged
- concurrent PUT
- PUT/DELETE raceの最終整合
- author self-like
- anonymous/suspended/read-only/hidden stage拒否
- transaction rollbackでrow/counter両方不変
- rebuild matches truth

### Comment

- 1 / 200 / 201 code points
- multiline / emoji / URL plain / HTML escaped
- NFC same-text duplicate
- 5秒 boundary
- UTC 100/day boundary
- comments disabled: old visible、新規拒否
- idempotent retry
- same key/different body conflict
- old/new pagination tie-break
- admin hide/unhide duplicate操作
- deleted user display
- transaction rollback
- rebuild counter

### Browser

- anonymous read
- login prompt for mutation
- rapid like toggle
- comment submit/retry/session expiry
- long/emoji/multiline layout
- read-only state
- social flag OFF no mutation requests
- network errorでplay/import可能

## 12. 完了条件

- like/unlikeがidempotentで1user1vote。
- like rowとcounterが同一transaction。
- comment validation/rate limit/idempotencyがserver強制。
- comment rowとcounterが同一transaction。
- comments disabledでも既存comment表示。
- admin hide/unhideがrole guard + audit + counter整合。
- public閲覧はlogin不要、mutationだけlogin必須。
- countersをtruth rowsから再構築可能。
- XSS、race、retry、rollback testsがある。
-既存play/import/local/offlineへ回帰なし。

## 13. Terra用プロンプト

```text
Phase 7 socialだけを実装してください。

本Phase文書、共通ガイド、Phase 4 auth/CSRF/idempotency、Phase 5 stage status、Phase 6 detail UI、current D1 schemaを再監査してください。

like/unlike、public comment read、comment post、rate limits、counter transactions、admin hide/unhide serviceを対象にします。reply/edit/user delete/report/downvote/admin dashboard/stats telemetryは実装しないでください。

row mutationとcounterを必ず同一D1 transactionにし、duplicate/concurrent/retryで二重増減させず、plain textをtextContentで描画してください。

race/idempotency/rollback/negative testsを先に固定し、focused integration/browser tests、full available checks、build、git diff自己レビューまで実行してください。問題があれば修正・再検証し、共通報告形式で返してください。
```
