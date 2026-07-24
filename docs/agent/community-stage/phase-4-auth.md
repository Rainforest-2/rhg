# Phase 4 — Auth 実行契約

## 0. Phaseの目的

一般利用者と管理者の認証基盤を、Cloudflare Pages Functions + D1上に安全に実装する。

対象:

- register + Turnstile
- login / logout / me
- rolling session
- CSRF / Origin / Host / JSON制約
- registration/login rate limit
- display name / password変更
- account UI
- admin bootstrap
- suspend/deleted/last-adminのserver-side guard

## 1. 開始条件

- Phase 3のD1 `users` / `sessions` と共通middlewareが存在する。
- previewとproductionのDB・secretが分離されている。
- secret実値はGitに存在しない。
- `COMMUNITY_WRITE_MODE=read-only`をmiddlewareで取得できる。
- current Cloudflare Workers Web Crypto、Turnstile Siteverify、Cookie仕様を公式資料で再確認した。

## 2. 非目標

- email verification / password reset email
- OAuth / 外部identity provider
- follower/friend/block
- user自己削除
- auth responseのService Worker cache
- publish/like/comment API本体
- admin画面全体（Phase 10）
- admin secretや本番passwordの生成・共有

## 3. Security model

### 3.1 信用境界

信用しないもの:

- clientのuser ID / role / status
- cookie内のuser ID
- client生成CSRF値だけ
- `CF-Connecting-IP`の永続保存
- Turnstile client success表示
- duplicate requestが一度だけ届くという前提
- display name/login/passwordのbyte lengthだけの判定

serverが決定するもの:

- authenticated user
- role / status
- session validity
- normalized login ID
- CSRF一致
- rate-limit key
- admin bootstrap可否

### 3.2 Middleware順

書込みrouteは原則次の順序。

```text
1 request ID / safe error boundary
2 method + content-type + body-size
3 write-mode guard
4 Origin + Host validation
5 JSON parse + field allowlist + string normalization
6 session lookup（必要routeのみ）
7 CSRF validation（cookie session mutationのみ）
8 rate limit
9 route-specific authorization/validation
10 transaction
11 safe response + rolling session refresh
```

register/loginは未認証routeなのでsession/CSRF順を適切に省くが、Origin/Host、JSON、body-size、rate limitは省かない。

## 4. Input契約

### Login ID

- 3〜20文字
- ASCII英数字と`_`のみ
- NFC後に検証
- lower-case normalized列でunique
- display列は登録表記を保持
- `rhg`は一般登録拒否
- deleted userのIDも再利用不可

禁止例:

- whitespace
- full-width英数
- bidi/control/NUL
- case違いduplicate
- prototype pollution key

### Display name

- 1〜20 Unicode code points
- NFC
- 日本語/記号/emoji可
- duplicate可
- 改行、NUL、危険制御文字、HTML解釈は禁止
- DOM表示は`textContent`

JS `.length`だけでcode point上限を測らない。共通string validatorを使う。

### Password

- 3〜128 Unicode code points
- inputをlog、error detail、auditへ出さない
- plain textをDBへ保存しない
- normalization方針を一度固定し、register/login/changeで一致させる
- accidental trimで利用者passwordを変えない

## 5. Password hash契約

- PBKDF2-SHA-256
- userごとのcryptographic random salt
- iteration数をuser rowへ保存
- hash/saltは明示的なencoding（base64urlまたはhex）で統一
- compareはtiming-safe
- login成功時、古いparameterならre-hash可能
- fixed iteration値を推測で焼き付けない

実装手順:

1. preview環境で複数iteration候補を計測する。
2. Workers CPU budget内でDoS耐性とlogin latencyを比較する。
3. 採用値・計測環境・日付をコード定数コメントまたはfocused docへ記録する。
4. testでは低い専用iterationをdependency injectionできるようにし、本番値をtest都合で弱めない。

管理者bootstrap passwordは一般userより強いminimumを別validationし、Cloudflare Secretからのみ読む。

## 6. Session state machine

```text
absent
  -> active session
  -> revoked
  -> expired/browser-deleted

active user
  -> suspended: all sessions revoked, login拒否
  -> deleted: all sessions revoked, login拒否, ID再利用拒否
```

Session token:

- 256bit cryptographic random
- client cookieにはraw tokenのみ
- D1にはSHA-256等のtoken hashのみ
- session IDをcookie credentialとして代用しない
- HttpOnly / Secure / SameSite=Lax
- PathをAPI用途に必要な最小範囲とするか、client要件と整合させる
- productionでDomainを不用意に広げない
- max-age/expiresはbrowserが許す長期値 + rolling refresh

Rolling refresh:

- 毎requestでDB writeしない。安全な更新間隔を設ける。
- response成功時だけcookie更新するか、方針を固定する。
- revoked/suspended/deleted sessionをrefreshしない。
- concurrencyでlast_seenが後退しない。

Policy:

- 複数端末同時login可
- logoutはcurrent sessionのみrevoked
- password変更で既存sessions維持
- admin password resetでも既存sessions維持
- admin明示操作で全session revoke可（UIはPhase 10）
- suspend/deleteは全session revoke

## 7. CSRF / Origin / Host

Mutation API:

- JSON only
- `X-RHG-CSRF`必須
- session rowへ紐づくCSRF secret/hash
- constant-time相当の比較
- `Origin`をallowlistと比較
- `Host`/forwarded hostをCloudflare配信構成に合わせて検証
- missing/null Originの扱いをroute種別ごとに明示
- CORS wildcardとcredentialsの併用禁止

CSRF tokenはHttpOnly cookieからJSが読めないため、`GET /auth/me`等のprivate no-store responseで安全に返すか、別non-HttpOnly token cookie方式を選ぶ。どちらでもsession bindingとrotationをtestする。clientが任意に作った値を信用しない。

## 8. Turnstile register契約

- register時のみ必須
- server-side Siteverify
- timeout / unavailable / invalid / reused tokenを区別
- expected hostname/actionを可能な範囲で検証
- tokenをlogしない
- validation成功前にuser rowを作らない
- retryでduplicate userが作られない

Token reuse防止は、Turnstile側の一回性だけへ依存せず、必要ならtoken digestを短期idempotency/rate-limit storageへ保持する。保持期間とcleanup ownerを明示する。

## 9. Rate limit

raw IPを永続保存しない。

```text
ipKey = HMAC-SHA-256(
  RATE_LIMIT_SECRET,
  UTC-day + ':' + CF-Connecting-IP
)
```

最低限:

- register: IP key + Turnstile
- login: normalized account + IP key
- repeated failure: short lock
- successで失敗counterをどう扱うか固定

要件:

- secret rotationの影響を理解する。
- IPv4/IPv6文字列をそのまま公開・保存しない。
- proxy headerをclientから信用せずCloudflare提供headerだけを使う。
- rate limit DB失敗時に認証を無制限許可するsilent fallbackは禁止。
- read-only modeではregister/password/display mutationを拒否するが、login/logout/meをどこまで許可するか明示的に決め、UIと一致させる。

## 10. Endpoint契約

```text
POST  /api/v1/auth/register
POST  /api/v1/auth/login
POST  /api/v1/auth/logout
GET   /api/v1/auth/me
PATCH /api/v1/auth/display-name
PATCH /api/v1/auth/password
```

### register transaction

```text
validate request / Turnstile / rate limit
-> normalize ID + display
-> hash password
-> INSERT user（duplicateはstable error）
-> optional session creation
-> commit
-> cookie response
```

userだけ作成されsession失敗する場合の契約を固定する。可能なら同一D1 transactionで閉じる。

### login

```text
rate-limit precheck
-> lookup normalized ID
-> generic credential failure response
-> user status check
-> PBKDF2 compare
-> optional rehash transaction
-> create session
-> reset/update failure counters
-> cookie response
```

ID不存在とpassword不一致で外部message/timing差を最小化する。

### logout

- current raw token hashからsessionを特定
- current sessionのみrevoke
- idempotent
- cookie削除
- invalid cookieでも安全に成功扱い可能だが、server errorを隠さない

### me

- `Cache-Control: no-store`
- user ID、login display、display name、role、status、CSRF token等の必要最小限
- password/salt/hash/session token/内部DB IDを返さない

### display name / password

- authenticated active userのみ
- Origin/CSRF/write-mode
- display更新は過去stage/comment表示へjoinで反映されるため、denormalized duplicateを増やさない
- password変更はcurrent password確認方針を明示
-既存sessionは維持

## 11. Admin bootstrap

目的は最初のadminを安全に作ることだけ。

- reserved login ID `rhg`
- ID/passwordをSecretから読む
- migrationへpassword/hashを書かない
- client bundleへbootstrap endpointやsecretを露出しない
- productionでadminが存在する場合はno-op
- raceで複数admin/duplicate insertにならない
- bootstrap後にpassword secretを削除/rotationできる運用を記録
-一般registerからadmin roleを指定できない

最後のactive adminをsuspend/delete/demoteできないguardはserver serviceに実装し、Phase 10 UIだけに依存しない。

## 12. Client account UI

Phase 2 home右上の補助領域へ段階接続する。

States:

```text
loading
anonymous
active user
read-only
session expired
network unavailable
error
```

- auth API失敗でlegacy Playを隠さない。
- initial auth fetchでapp boot全体をblockしない。
- login/register dialogはfocus trap、label、error summary、software keyboard、safe areaを考慮。
- server messageをHTML挿入しない。
- passwordをlocalStorage/sessionStorageへ保存しない。
- session expired時、local game stateを破棄しない。
- feature flag OFFではauth UI/requestsを生成しない。

## 13. Negative test matrix

| ケース | 期待 |
|---|---|
| `User`登録後`user`登録 | duplicate拒否 |
| reserved `rhg`一般登録 | 拒否 |
| deleted ID再登録 | 拒否 |
| display emoji/code point境界 | 正常/超過拒否 |
| invalid Turnstile / timeout / reuse | user未作成 |
| wrong password / missing user | generic failure |
| repeated login failure | account+IP lock |
| raw IP inspection | DB/logに存在しない |
| session token DB inspection | hashのみ |
| cookie flags | HttpOnly/Secure/SameSite |
| CSRF missing/mismatch | mutation拒否 |
| foreign Origin/Host | mutation拒否 |
| password change |既存sessions維持 |
| logout | currentのみrevoke |
| suspend/delete | 全session revoke |
| last active admin action | 拒否 |
| client role=`admin` | 無視/拒否 |
| read-only register/change | 拒否 |
| auth API response cache | no-store |
| XSS payload display name | textとして表示 |
| DB/crypto failure | generic 5xx、credential漏洩なし |

## 14. 完了条件

- endpoint 6種が契約どおり動く。
- raw password/session token/IPがDB・log・fixture・responseにない。
- Turnstile server validationとtoken reuse testがある。
- session/CSRF/Origin/Host/rate limitがserverで強制される。
- multi-device、password変更後維持、logout current-only、suspend all-revokeがtest済み。
- reserved/deleted ID、last admin、client role偽装を拒否する。
- account UI失敗がlegacy/local機能をblockしない。
- full available checks/build/browser test結果が報告される。

## 15. Terra用プロンプト

```text
Phase 4 authだけを実装してください。

本Phase文書、共通ガイド、最終community設計書、Phase 3のcurrent middleware/migrationsを読み、current ownerとCloudflare Web Crypto/Turnstile/Cookie仕様を再確認してください。

register、login、logout、me、display-name、password、rolling session、CSRF/Origin/Host、rate limit、account UI、admin bootstrapを対象にします。publish/social/stats/admin UIは先行実装しないでください。

password/session token/raw IP/secretを一切log・fixture・response・Gitへ残さず、client roleを信用せず、last admin guardをserverで強制してください。auth/network障害は通常Play/local機能へ波及させないでください。

コード変更前にthreat model、middleware順、予定ファイルを列挙してください。negative testsを先に明確化し、focused tests、D1 transaction tests、browser account UI、full available checks、build、secret scan、git diff自己レビューまで実行してください。問題があれば修正・再検証し、共通報告形式で返してください。
```
