# RHG「みんなのステージ」完全設計書 v3
## 最終監査反映・実装基準版

> 対象リポジトリ: `Rainforest-2/rhg`  
> 作成日: 2026-07-24  
> 基準資料: `RHG_BCU_CORE_ARCHITECTURE_AND_LOGIC_REFERENCE_2026-07-23.md`、現行 `main`、現行CustomStage・Formation・Battle runtime  
> 対象機能: ホーム、公開ステージ、投稿、インポート、アカウント、いいね、コメント、プレイ統計、クリア率、編成制限、管理画面、Cloudflare配信  
> 文書状態: 製品仕様・データ契約・実装順・受入条件を統合した最終設計

---

# 0. 最終結論

RHGへ追加する「みんなのステージ」は、既存ゲームを置き換えるものではない。

```text
既存RHG
├─ 通常プレイ
├─ 既存編成画面
├─ 公式ステージ
├─ ローカル自作ステージ
├─ JSON入出力
└─ 既存Battle runtime
        ↑
        │ 必ず既存CustomStage normalize/validate/adapter経由
        │
みんなのステージ
├─ 公開一覧・検索
├─ 投稿・更新・論理削除
├─ インポート・派生
├─ アカウント
├─ いいね
├─ コメント
├─ プレイ回数・クリア率
├─ 編成制限
└─ 管理画面
```

オンライン障害、ログアウト、Cloudflare無料枠到達、D1停止、Pages Functions停止が起きても、以下は利用可能でなければならない。

- 通常プレイ
- 既存編成
- ローカル自作ステージ
- ローカル編集
- ローカルJSON入出力
- 端末へ既にインポート済みのステージ

---

# 1. 絶対不変条件

## 1.1 RHG・BCU側

1. `semantic-strict`を維持する。
2. BCU CSV列、save schema、runtime owner、frame単位を推測で作らない。
3. prototype patchのimport順とwrapper chainを変更しない。
4. battleの既存phase順、damage順、proc順、render順を変えない。
5. online API失敗をbattle失敗へ波及させない。
6. silent fallbackで不整合を隠さない。
7. 制限判定用statsも既存stat resolverを再利用し、独自の近似計算式を作らない。
8. 現行mainで所有者が未確認の機能に、存在未確認のclass名を設計契約として書かない。
9. 実装開始時に現行main HEADを再監査し、2026-07-23参照書との差分を確認する。
10. 決定的テストが証明するのはassertした範囲だけであり、見た目は実機確認する。

## 1.2 製品側

1. 閲覧、検索、プレイ、インポートはログイン不要。
2. 投稿、いいね、コメントはログイン必須。
3. 公開ステージは完全公開。
4. クリアチェックは行わない。
5. 世界記録、最速記録、初クリア、フォロー、通報、低評価、返信、戦闘中位置コメントは実装しない。
6. 投稿数上限は設けない。
7. コメント削除とアカウント削除は管理者のみ。
8. 作者は自分のステージを論理削除できる。
9. 物理削除を通常UIへ置かない。
10. 管理者ID `rhg` は予約するが、管理者パスワードをGit、設計書、migration、client bundleへ書かない。
11. 全機能をCloudflareの無料・カード不要構成で開始できるようにする。
12. 無料枠超過時は書込みを停止し、閲覧・プレイ・インポートを維持する。

---

# 2. 採用しない機能

初期版だけでなく、本設計の対象外とする。

- 投稿前クリア証明
- deterministic replay検証
- 世界記録
- ベストタイム
- 一番乗り
- フォロー
- フレンド
- ブロック
- ミュート
- 通報
- 低評価
- コメント返信
- コメント編集
- 利用者本人によるコメント削除
- 利用者本人によるアカウント削除
- 戦闘座標に紐づくコメント
- 戦闘中コメント表示
- 手描きコメント
- 任意式を書ける制限DSL
- 外部有料認証
- メール認証
- 課金前提のサービス

---

# 3. 画面構成

## 3.1 新ホーム

アプリ起動後にホームを表示する。

```text
RHG

[ プレイ ]
今までの公式ステージ・自作ステージ・編成画面へ

[ みんなのステージをプレイ ]
公開ステージ一覧・検索・プレイ・インポートへ
```

右上補助操作:

- 未ログイン: `ログイン`
- ログイン中: 表示名
- 管理者: `管理`
- online書込み停止中: `閲覧専用`

`プレイ`は従来の起動経路を呼ぶだけとし、既存FormationEditorを作り直さない。

## 3.2 公開ステージ一覧

カードに常時表示する情報:

- サムネイル
- ステージ名
- 作者表示名
- 難易度
- プレイ回数
- いいね数

詳細画面だけに表示する情報:

- コースID
- 説明
- 作者紹介
- 挑戦数
- クリア数
- クリア率
- コメント
- 編成制限
- 派生情報
- 投稿日

### 並び順

- 新着順
- プレイ回数順
- いいね順
- クリア率が低い順

低クリア率順:

```text
attempt_count > 0
AND clear_count > 0
ORDER BY clear_rate_ppm ASC
```

0%は除外する。最低挑戦数条件は設けない。

### ページング

- 1ページ最大50件
- ページ番号
- 前へ／次へ
- 決定的tie-breakerを必ず付ける
- URL queryへ `page`、`sort`、`q` を保持
- 戻る操作でページ・検索条件・スクロール位置を復元

例:

```sql
ORDER BY like_count DESC, published_at DESC, stage_id DESC
LIMIT 50 OFFSET ?
```

## 3.3 検索

検索対象:

- ステージ名: 部分一致
- 作者ID: 部分一致
- 作者表示名: 部分一致
- コースID: 8文字完全一致を最優先

日本語部分一致を安定させるため、単純なFTS token分割や無制限LIKEへ依存しない。

```text
stage_search_grams
user_search_grams
```

へUnicode 2-gram・3-gramを登録する。

- 1文字検索: 制限付き`instr()` fallback
- 2文字以上: n-gram交差検索
- title更新時: 対象stageだけ再index
- display name更新時: 対象userだけ再index
- コースID: UNIQUE index完全一致

## 3.4 ステージ詳細

表示順:

1. サムネイル
2. ステージ名
3. 作者
4. 難易度
5. プレイ回数・挑戦数・クリア数・クリア率・いいね数
6. 説明文
7. 作者紹介コメント
8. 編成制限
9. 原作・編集者
10. `プレイ`
11. `インポート`
12. `いいね`
13. コメント欄

作者名を押すと作者ページへ移動する。

## 3.5 作者ページ

- 表示名
- ログインID
- 登録日
- 公開ステージ数
- 総プレイ回数
- 総いいね数
- 公開ステージ一覧

フォロー機能は付けない。

---

# 4. サムネイル

## 4.1 利用者画像

端末画像をアップロードできる。

許可:

- PNG
- JPEG
- WebP

禁止:

- SVG
- GIF
- 動画
- HTML
- 実行形式
- MIMEとmagic byteが一致しないファイル

処理:

1. クライアントで16:9に切り抜く。
2. 最大1280×720へ縮小する。
3. canvas再エンコードでEXIF等を除去する。
4. 最大1 MiB。
5. serverでmagic byteと実寸を再検証する。
6. 利用者ファイル名をR2 keyへ使用しない。
7. cookieを送らない画像専用domainから配信する。
8. `X-Content-Type-Options: nosniff`を付ける。

## 4.2 未設定時

専用プレースホルダーを表示する。

- RHGに合う背景
- 城と敵の抽象シルエット
- 難易度バッジ
- ステージ名の先頭文字
- 「画像なし」だけの無機質な表示にしない
- CSSまたは安全な固定SVG

---

# 5. CustomStage Schema v3

## 5.1 必須変更

現行schema v2には新しい編成制限の保存先がない。公開ステージをインポートしても制限が失われないよう、schema v3へ更新する。

```js
{
  schemaVersion: 3,
  id,
  name,
  description,
  createdAt,
  updatedAt,
  battle,
  spawns,
  modifications,
  limits,

  challengeRestrictions: null | {
    version: 1,
    army,
    characterPolicy,
    allowedForms,
    allowedCatRarities,
    catLevel,
    dogMultipliers,
    stats,
    cost,
    maxConcurrentCapacity
  }
}
```

## 5.2 migration

```text
v1 → 既存migration → v2
v2 → v3: challengeRestrictions = null
v3 → normalize
```

- 既存ステージの挙動は変えない。
- v2ロードで例外にしない。
- v3をv2として静かに保存し直さない。
- migration失敗時は元データを変更しない。
- 部分importは禁止。

## 5.3 ローカル適用

`challengeRestrictions`があるローカル自作ステージをプレイする場合も制限を適用する。

- エディタで制限を編集・無効化可能
- 既存v2ステージは制限なし
- 制限変更はgameplay変更
- onlineで同一コースIDのmetadata更新としては扱えない

## 5.4 provenance

派生情報はgameplay schemaへ混ぜない。

```js
{
  sourceCourseId,
  parentCourseId,
  rootCourseId,
  sourceContentHash,
  sourceAuthorUserId,
  importedAt
}
```

ローカルでは別ストアへ保存するが、JSON export envelopeには含める。

```js
{
  exportVersion: 3,
  stage,
  provenance: null | {...}
}
```

serverへ投稿する時、clientが送るのは`parentCourseId`だけとする。

- serverが親レコードを確認
- `rootCourseId`をserver側で導出
- 原作者情報をserver側で導出
- clientの作者名申告を信用しない
- lineage偽装を防ぐ

---

# 6. 公開ステージのデータ境界

## 6.1 immutable gameplay payload

gameplayへ影響するもの:

- battle
- spawns
- modifications
- limits
- challengeRestrictions
- gameplay schema version
- restriction schema version
- asset catalog revision
- gameplayへ影響する将来field

metadata:

- ステージ名
- 説明
- 難易度
- コメント可否
- 作者紹介
- サムネイル
- 作者
- 投稿日
- 統計
- 公開状態

gameplay payloadは投稿後immutable。metadataのみ更新可能。

## 6.2 同一コースIDで変更可能

- ステージ名
- 説明文
- 難易度
- コメント許可／不許可
- サムネイル
- 作者紹介コメント

metadata履歴は保存せず最新値だけを保持する。

`admin_audit`には変更した事実と日時だけ記録し、旧本文全文は保存しない。

## 6.3 新コースIDが必要

- 敵変更
- 出現条件変更
- 背景変更
- 城変更
- BGM変更
- 倍率変更
- ステータス改竄変更
- 編成制限変更
- 所持金・生産制限変更
- 制限時間変更
- ステージ長変更
- gameplay hashが変わる全変更

---

# 7. Canonical JSONとcontent hash

## 7.1 algorithm

```text
content_hash =
hex(
  SHA-256(
    UTF-8(
      canonicalJson(canonicalGameplayEnvelope)
    )
  )
)
```

## 7.2 canonical envelope

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

## 7.3 canonicalization

- object keyをUnicode code point順にsort
- array順は保持
- `id`、`createdAt`、`updatedAt`を除外
- metadataを除外
- undefinedを禁止
- NaN、Infinity、-Infinityを禁止
- `-0`は`0`
- number表現を決定的にする
- stringをNFC正規化
- opaque IDを文字列へ正規化
- duplicate modificationをcanonical dedupe
- prototype pollution keyを拒否
- unknown gameplay fieldを拒否
- restriction versionを含める
- asset catalog revisionを含める

## 7.4 verification

- client投稿前にhash
- server受信後に再normalize・再hash
- server計算値だけを採用
- download時にclientが再hash
- 不一致ならプレイ・インポートを拒否
- silent fallbackしない

## 7.5 R2 dedupe

```text
community/blobs/sha256/{content_hash}.json
```

同一hashは1objectだけ保存し、投稿レコードは別々に保持する。

---

# 8. コースID

8文字。

```text
ABCDEFGHJKLMNPQRSTUVWXYZ23456789
```

除外:

- I
- O
- 0
- 1

例:

```text
7KQ3M8PX
```

- `crypto.getRandomValues()`で生成
- DBでUNIQUE
- 衝突時に再生成
- 大文字表示
- 検索は完全一致
- URLへ作者名を含めない

---

# 9. 投稿・派生・非公開

## 9.1 投稿前確認

- ステージ名
- 説明
- 難易度
- サムネイル
- 敵出現行数
- ステータス改竄有無
- 編成制限
- コメント可否
- 原作
- 編集者
- gameplayは投稿後変更不可
- 変更する場合は別コースになる

## 9.2 同一内容再投稿

許可する。

- 見た目上は別投稿
- コースIDは別
- R2 gameplay blobは共有
- 親を指定した場合は派生表示

## 9.3 派生表示

```text
原作：〇〇
編集：△△
```

- `parentCourseId`: 直接の親
- `rootCourseId`: 系譜の起点
- UIでは原作と現在の編集者を優先表示
- 管理画面では全系譜を確認可能

親が非公開になっても派生作品は公開継続し、原作欄は`非公開`と表示する。

## 9.4 作者による削除

作者の`削除`は論理削除。

```text
active → author-hidden
```

- 一覧から消える
- 検索から消える
- 作者ページから消える
- 新規プレイ開始不可
- 既に開始済みsessionの終了報告は受理
- 既にインポート済みのローカルコピーは残る
- いいね・コメント・統計・blobは保持
- 作者本人は復元不可
- 管理者のみ再公開可能

## 9.5 管理者非表示

```text
active / author-hidden → admin-hidden
```

- 管理者のみ再公開可能
- 物理削除しない
- 派生作品は自動非公開にしない

---

# 10. アカウント

## 10.1 必要範囲

ログイン必須:

- 投稿
- metadata更新
- 作者によるステージ論理削除
- いいね
- コメント
- 表示名変更
- パスワード変更

ログイン不要:

- 一覧
- 検索
- 詳細
- 作者ページ
- プレイ
- インポート
- プレイ統計送信

## 10.2 ID

- 3〜20文字
- ASCII英数字と`_`
- 大文字小文字を区別しない
- 表示時は登録表記を維持
- normalized列はlower-case
- `rhg`は予約
- 削除済みIDも再利用不可

## 10.3 表示名

- 1〜20 Unicode code points
- 日本語可
- 英数字可
- 記号可
- 絵文字可
- 改行不可
- HTML不可
- 重複可能
- いつでも変更可能
- 過去ステージ・コメントも現在名へ更新表示

投稿時表示名を複製せず、user IDから現在名を取得する。

## 10.4 パスワード

一般ユーザー:

- 3〜128 Unicode code points
- 平文保存禁止
- PBKDF2-SHA-256
- userごとのrandom salt
- iteration数をuser rowへ保存
- timing-safe比較
- login成功時に古いparameterを再hash可能
- 入力値をlogへ出さない

管理者bootstrap password:

- 一般ユーザーより強い最低条件
- Cloudflare Secretだけに保存
- 会話中に共有された旧値を本番で再利用しない

PBKDF2 iterationはpreview環境で計測し、無料枠のCPU budget内で安全側に調整する。固定値を推測で設計書へ焼き付けない。

## 10.5 登録

- Turnstileは登録時のみ
- server-side Siteverify必須
- tokenの再利用拒否
- ID重複確認
- display name validation
- password hash
- registration rate limit
- メール不要

## 10.6 セッション

- 256bit random token
- DBにはtoken hashだけ保存
- HttpOnly
- Secure
- SameSite=Lax
- browserが許す最大級の長期cookie
- rolling refresh
- 複数端末同時ログイン可能
- パスワード変更で既存sessionを失効させない
- 管理者resetでも既存sessionは自動失効させない
- logoutは現在sessionだけ失効
- 管理者は明示的に全session失効可能
- suspend/delete時は全session失効

ブラウザ仕様上、無限Cookieは保証できないため、「短期期限を設けず、利用中はrolling refreshし、browserが消すまで維持」に最も近い実装とする。

## 10.7 CSRF・XSS

書込みAPI:

- SameSite cookie
- `Origin`と`Host`確認
- JSONのみ
- `X-RHG-CSRF`必須
- CSRF tokenはsessionへ紐づける
- HTMLを受け付けない
- textは`textContent`で描画
- CSPを設定
- inline scriptを増やさない

## 10.8 rate limit

最低限:

- 登録: Turnstile＋IP hash制限
- login: account＋IP hash単位
- 連続失敗で短時間lock
- コメント: 5秒、1日100件
- いいね: 異常な連打のみ制限
- telemetry: batchと端末単位制限

raw IPを永続保存しない。

```text
ip_key = HMAC(rateLimitSecret, UTC日付 + CF-Connecting-IP)
```

短期rate-limit rowのみ保存する。

## 10.9 password再設定

- login中なら本人変更可能
- 管理者が仮passwordを設定可能
- 管理者が本人へ直接伝える
- メール復旧なし
- 既存sessionは自動失効しない
- 必要時は管理者が別操作で全session失効

## 10.10 停止・削除

利用者本人はアカウント削除不可。

status:

```text
active
suspended
deleted
```

suspended:

- login不可
- session全失効
- 投稿不可
- いいね不可
- コメント不可
- 既存ステージとコメントは残す

deleted:

- login不可
- session全失効
- ID再利用不可
- 表示名は`削除済みユーザー`
- 既存ステージとコメントは残す
- 管理者のみ復旧可能

最後のactive adminを停止・削除できない。

---

# 11. いいね

- login必須
- 1アカウント・1ステージ・1票
- 作者本人も可能
- プレイ前でも可能
- 解除可能
- `PRIMARY KEY(stage_id, user_id)`
- `PUT`で付与
- `DELETE`で解除
- idempotent
- stage statusがactiveの時だけ新規付与
- 単純いいね数で並べる

like row変更と`stage_stats.like_count`更新を同一D1 batch transactionで行う。

---

# 12. コメント

## 12.1 仕様

- 通常コメント欄のみ
- login必須
- 1〜200 Unicode code points
- 改行数制限なし
- 絵文字可
- URL文字列可
- URLは自動リンクしない
- HTML不可
- 編集不可
- 利用者削除不可
- 作者削除不可
- 管理者のみ非表示・再表示

## 12.2 並び

- 古い順
- 新しい順
- 利用者が切替
- 初期20件
- `さらに読み込む`

## 12.3 コメント無効化

作者がコメントを不許可にした場合:

- 既存コメントは表示
- 新規投稿だけ停止
- 管理者非表示コメントは表示しない

## 12.4 作者紹介

作者紹介コメントはコメント欄ではなく、ステージ詳細上部へ固定表示する。

## 12.5 連投防止

- 前回投稿から5秒
- 1アカウント1日100件
- 同一ステージへの同文連続投稿禁止
- 1〜200文字
- UTC日付で日次集計

comment INSERTと`comment_count`更新を同一transactionにする。

---

# 13. プレイ回数・クリア率

## 13.1 挑戦開始

battle logic frameが1以上へ進んだ時に1挑戦を開始する。

数えない:

- 詳細画面を開く
- 編成画面を開く
- 戦闘ロード中に戻る

## 13.2 新しい挑戦

別挑戦:

- 敗北後の再挑戦
- 手動リスタート
- browser reload後の再戦
- 編成変更後の再戦
- 戦闘を閉じて再開始

同じ挑戦:

- 一時停止
- 一時停止解除

## 13.3 中断

1frame以上進行後に終了した場合:

```text
attempt +1
clear +0
result = abandoned
```

finishが届かなくてもattemptはstart時に計上済み。

## 13.4 クリア

以下をclearとする。

- 通常の敵城破壊
- stage固有の成功結果
- ランキング型の成功
- 時間制等の成功結果

単なる終了、敗北、中断はclearにしない。

## 13.5 クリア率

```text
clear_rate_ppm =
floor(clear_count * 1_000_000 / attempt_count)
```

表示:

```text
clear_count / attempt_count × 100
```

- 小数第2位まで
- attempt 0は`—`
- 低クリア率順ではclear 0を除外
- 作者・guest・同一人の再挑戦も含む

整数除算の曖昧さを避けるため、並び順は`clear_rate_ppm`を使用する。

## 13.6 play session

client生成:

```text
playSessionId: UUID
guestDeviceId: random UUID
```

- guestDeviceIdは端末内random
- fingerprintを使わない
- 個人情報を含めない
- user login中でもsession IDは別途作る
- 同じplaySessionIdは一度だけ集計

## 13.7 start transaction

同一D1 batch transaction:

1. `play_attempts`へ`INSERT OR IGNORE`
2. INSERTされた場合だけ`stage_stats.attempt_count + 1`
3. `clear_rate_ppm`再計算

重複startでcounterを増やさない。

## 13.8 finish transaction

同一D1 batch transaction:

1. attempt rowを取得
2. result未確定の場合だけfinish
3. `clear`へ初回遷移した時だけ`clear_count + 1`
4. defeat/abandonedはclear counter変更なし
5. `clear_rate_ppm`再計算

重複finish、順序逆転、offline再送でも二重加算しない。

finishがstartより先に届いた場合は、同一transactionでstart相当rowをupsertしてからfinishする。

## 13.9 hidden stage

- hidden後の新規startは拒否
- hidden前にstart済みのsessionはfinish受理
- offline startは`started_at`がhidden前かを確認
- 30日を超える古いoutboxは送信しない

## 13.10 offline outbox

IndexedDB:

```text
CommunityTelemetryOutbox
```

- startとfinish
- 最大30日
- exponential backoff
- online復帰時送信
- 1batch最大20event
- 同じsessionはserverでdedupe
- battleを停止しない

API:

```text
POST /api/v1/plays/batch
```

## 13.11 raw attempt保持と再集計

`play_attempts`を永久保存しない。

```text
play_attempts       35日保持
stage_stats_daily   永続
stage_stats         全期間counter
```

理由:

- offline outbox最大30日をcover
- D1容量を制御
- 全期間再集計可能
- 生attemptを無限蓄積しない

maintenance:

1. 未終了attemptを一定時間後`abandoned`へ
2. 35日超の未集約attemptをUTC日ごとに`stage_stats_daily`へ加算
3. `aggregated_at`を記録
4. transaction成功後だけraw row削除
5. 再実行しても二重集約しない

`stage_stats`再構築:

```text
stage_stats_daily
+ 未集約play_attempts
+ likes
+ visible comments
```

---

# 14. 編成制限

## 14.1 基本論理

- すべてAND
- whitelistと禁止が重複した場合だけwhitelist優先
- whitelistで許可されても他制限は受ける
- コンボ補正は全制限判定から除外
- 選択前に判定
- 戦闘開始直前に再判定
- 違反理由は全件返す
- 制限適合キャラ0体なら投稿禁止
- game更新後に違反した場合は最新判定で使用不可

## 14.2 schema

```js
{
  version: 1,

  army: "any" | "cat-only" | "dog-only",

  characterPolicy: {
    whitelistEnabled: false,
    whitelistCharacterIds: [],
    bannedCharacterIds: []
  },

  allowedForms: [1, 2, 3, 4],

  allowedCatRarities: null | [],

  catLevel: {
    banAtOrAbove: null | number
  },

  dogMultipliers: {
    hpBanAtOrAbove: null | number,
    attackBanAtOrAbove: null | number
  },

  stats: {
    maxHpBanAtOrAbove: null | number,
    attackTotalBanAtOrAbove: null | number
  },

  cost: null | {
    mode: "ban-at-or-above" | "ban-at-or-below",
    value: number
  },

  maxConcurrentCapacity: null | number
}
```

## 14.3 軍

- `any`: 混成可能
- `cat-only`: にゃんこ軍のみ
- `dog-only`: わんこ軍のみ

軍判定はcanonical side/source情報を使い、名前・画像・ID範囲から推測しない。

## 14.4 character指定

- blacklist
- whitelist
- canonical character ID
- 同一IDが両方の場合はwhitelist優先
- unknown IDは投稿拒否
- whitelist有効かつ空は投稿拒否

## 14.5 形態

```text
☑ 第1形態
☑ 第2形態
☑ 第3形態
☑ 第4形態
```

- 全体指定
- 存在しない形態は無視
- 全OFFは投稿拒否
- canonical form indexで判定

## 14.6 レアリティ

- にゃんこ軍だけ
- わんこ軍は対象外
- unknown rarityは投稿拒否
- nullなら制限なし

## 14.7 にゃんこレベル

```text
effectiveLevel = baseLevel + plusLevel
```

**プラス値を必ずレベル判定へ含める。**

```text
レベルN以上を禁止
```

例:

```text
N = 50

Lv30 + 19 = 49 → 使用可能
Lv30 + 20 = 50 → 使用不可
Lv50 + 0  = 50 → 使用不可
```

- thresholdちょうども禁止
- 下限・固定は実装しない
- UIには`Lv30+20（合計50）`のように表示
- testで＋値境界を必ず確認

## 14.8 わんこ倍率

わんこ軍はレベルではなく、現在設定されている倍率を使う。

- HP倍率N%以上を禁止
- 攻撃倍率N%以上を禁止
- それぞれ別設定
- thresholdちょうども禁止

## 14.9 最大体力

```text
maxHp N以上を禁止
```

含む:

- base level
- **plus level**
- 本能
- 本能玉
- お宝
- character modification
- stage側の確定補正

含まない:

- にゃんコンボ
- バリア
- 悪魔シールド
- 復活後HP
- 打たれ強い等の実質耐久
- target属性依存効果

判定対象は戦闘開始時の純粋な最終`maxHp`。

## 14.10 攻撃力

```text
1攻撃動作の全hit nominal damage合計
```

含む:

- base level
- **plus level**
- 本能
- 本能玉
- お宝
- character modification
- attack hit構造

含まない:

- にゃんコンボ
- クリティカル
- 超ダメージ
- めっぽう強い
- target属性
- Metal処理
- 戦闘中proc
- 強化等の状態依存倍率

Nちょうども使用不可。

## 14.11 コスト

片方だけ設定できる。

```text
コストN以上を禁止
OR
コストN以下を禁止
```

範囲指定はしない。

判定順:

```text
BCU通常価格解決
→ combo discountを適用しない
→ character modificationのabsolute cost override
→ custom stage globalCostMultiplier
→ floor処理
```

したがって、制限判定用コストは**コンボ割引前**であり、ステージcost倍率反映後の実コスト。

Nちょうども禁止。

## 14.12 同時出撃容量

- BCUの`will + 1`重みを使う
- 単純な生存キャラ数ではない
- player側生産gateとして適用
- 既存の死亡待機・占有解除規則を維持
- catalogカードへ容量重みを表示可能

ただし、runtime owner名は設計段階で捏造しない。

Phase 0で現行mainを追跡し、以下の実所有者を確定する。

- player capacityを判定するmethod
- will weightを取得するmethod
- production拒否理由を返す境界
- custom stage runtimeから値を注入する最小接続点

確定後、そのownerへ`maxConcurrentCapacity`を渡す。新しい並行capacity runtimeを勝手に作らない。

## 14.13 stats解決順

```text
1. canonical character/form解決
2. base level
3. plus level
4. talents
5. orbs
6. treasures
7. combos = disabled
8. normal BCU stat計算
9. character modification absolute override
10. stage-specific final modifier
11. restriction snapshot
```

snapshot:

```js
{
  characterId,
  side,
  form,
  rarity,

  baseLevel,
  plusLevel,
  effectiveLevel,

  hpMultiplier,
  attackMultiplier,

  maxHp,
  nominalAttackTotal,
  productionCost,
  capacityWeight,

  sourceRevision,
  modificationHash
}
```

## 14.14 判定順

```text
1 army
2 whitelist / blacklist
3 form
4 rarity
5 effectiveLevel または dog倍率
6 maxHp
7 attackTotal
8 cost
```

容量は単体選択禁止ではなく、戦闘中の合計gate。

## 14.15 UI

違反キャラ:

- card全体を弱くグレーアウト
- 丸枠付き禁止アイコン
- `使用不可`
- 色だけに依存しない
- 押すと小型パネル
- 全違反理由
- 実値と閾値
- 編成追加は無効

例:

```text
使用不可
・合計Lv50以上
・最大体力500,000以上
・コスト1,500以上
```

## 14.16 挑戦編成

```text
CommunityChallengeFormationStore
```

- 通常編成とは別
- 初回だけ通常編成をcopy
- 全community stageで最後の挑戦編成を共有
- ステージ選択後、その場で変更可能
- 候補一覧の時点で使用不可を表示
- 選択後に初めてグレーアウトする設計は禁止
- 違反slotがある間は開始不可
- 戦闘開始直前に全10slotを再validate
- 通常編成は変更しない

## 14.17 適合キャラ0体

serverは利用者のローカルlevel・plus値・本能を保存しないため、二段階で判定する。

server structural validation:

- army
- whitelist
- blacklist
- form
- rarity
- canonical ID
- rule shape
- canonical restriction index上で理論上0体か

client publication validation:

- 投稿者の現在ローカルlevel
- **plus level**
- talents
- orbs
- treasures
- modifications
- cost multiplier

を使い、実際に選択可能なキャラが0体なら投稿を止める。

別利用者の育成状況では0体になる場合がある。その場合は詳細画面で`現在の育成状態では使用可能キャラがいません`と表示し、戦闘開始不可。

---

# 15. 難易度

固定順:

```text
0 初級
1 中級
2 上級
3 超上級
4 激ムズ
5 超激ムズ
6 極ムズ
7 超極ムズ
8 神ムズ
```

作者設定。自動判定しない。

---

# 16. 入力上限・validation

## 16.1 text

- stage title: 1〜50 Unicode code points
- description: 0〜1000
- author note: 0〜200
- display name: 1〜20
- comment: 1〜200
- login ID: 3〜20 ASCII
- password: 3〜128

全string:

- NFC normalize
- NUL拒否
- HTMLとして解釈しない
- bidi control等の危険制御文字を拒否
- 改行可否をfield別に固定

## 16.2 gameplay

- payload最大5 MiB
- JSON depth最大12
- spawn最大1000
- modification最大500
- whitelist最大2000
- blacklist最大2000
- object key数上限
- array長上限
- unknown field拒否
- unsupported version拒否
- prototype pollution key拒否
- NaN/Infinity拒否
- partial import禁止

## 16.3 構造的投稿拒否

- army enum不正
- whitelist有効で空
- 全形態禁止
- unknown character
- unknown rarity
- 不正threshold
- cost mode不正
- cost条件を2つ同時指定
- maxConcurrentCapacityが0以下
- canonical universeで適合0体
- client現在状態で適合0体
- content hash不一致
- unsupported asset revision
- gameplay payload過大

---

# 17. Cloudflare構成

## 17.1 全体

```text
Cloudflare Pages
├─ Vite frontend
└─ Pages Functions /api/v1/*

Cloudflare bindings
├─ D1: COMMUNITY_DB
├─ R2: COMMUNITY_BLOBS
├─ R2: COMMUNITY_MEDIA
├─ Secret: SESSION_SECRET
├─ Secret: RATE_LIMIT_SECRET
├─ Secret: TURNSTILE_SECRET
└─ Secret: ADMIN_BOOTSTRAP_*

R2 Custom Domain
└─ static community fallback / thumbnail / immutable payload

Maintenance Worker
└─ Cron Trigger
   ├─ stats compaction
   ├─ fallback snapshot生成
   ├─ orphan media cleanup
   └─ stale session cleanup
```

有料外部サービスを前提にしない。

## 17.2 D1

保存:

- users
- sessions
- stages metadata
- lineage
- stats
- recent attempts
- daily aggregates
- likes
- comments
- search grams
- rate limits
- admin audit
- idempotency keys

## 17.3 R2

保存:

- immutable gameplay payload
- thumbnail
- static catalog snapshot
- static stage detail snapshot
- static author snapshot
- static comment pages

## 17.4 fallback

Pages Functions自体が停止しても使えるよう、R2 Custom Domainから直接配信する。

```text
community-fallback/
├─ current.json
├─ generations/{generationId}/
│  ├─ catalog/new/{page}.json
│  ├─ catalog/plays/{page}.json
│  ├─ catalog/likes/{page}.json
│  ├─ catalog/clear-asc/{page}.json
│  ├─ stages/{courseId}.json
│  ├─ authors/{userId}.json
│  └─ comments/{courseId}/{page}.json
└─ blobs/sha256/{contentHash}.json
```

atomic publish:

1. 新generationを全作成
2. integrity確認
3. 最後に`current.json`を差し替える
4. 途中失敗時は旧generationを維持

cache:

- immutable blob: 長期immutable
- generation file: 長期cache
- `current.json`: 短TTL
- thumbnail: versioned key
- cookie送信なし
- production origin限定CORS
- bucket listing禁止

## 17.5 read-only mode

```text
COMMUNITY_WRITE_MODE =
read-write
read-only
```

read-onlyで停止:

- 登録
- password変更
- 投稿
- metadata更新
- thumbnail更新
- いいね
- コメント
- 新規telemetry集計

継続:

- 一覧
- 検索snapshot
- 詳細
- 作者ページ
- コメント閲覧snapshot
- プレイ
- インポート
- ローカル機能

API quota errorを検出した場合もread-only UIへ自動移行する。管理者が明示的に切替可能。

Cloudflareの無料枠・上限値は変更され得るため、実装開始時と公開直前に公式資料を再確認する。

---

# 18. D1 schema

## 18.1 users

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  login_id_normalized TEXT NOT NULL UNIQUE,
  login_id_display TEXT NOT NULL,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user','admin')),
  status TEXT NOT NULL CHECK(status IN ('active','suspended','deleted')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

## 18.2 sessions

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  csrf_token_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  revoked_at INTEGER,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
```

## 18.3 stage_blobs

```sql
CREATE TABLE stage_blobs (
  content_hash TEXT PRIMARY KEY,
  gameplay_schema_version INTEGER NOT NULL,
  restriction_schema_version INTEGER NOT NULL,
  asset_catalog_revision TEXT NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  byte_size INTEGER NOT NULL,
  reference_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
```

## 18.4 published_stages

```sql
CREATE TABLE published_stages (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL UNIQUE,
  author_user_id TEXT NOT NULL,
  content_hash TEXT NOT NULL,

  parent_stage_id TEXT,
  root_stage_id TEXT,

  title TEXT NOT NULL,
  description TEXT NOT NULL,
  author_note TEXT NOT NULL,
  difficulty INTEGER NOT NULL,
  comments_enabled INTEGER NOT NULL,
  thumbnail_key TEXT,

  status TEXT NOT NULL
    CHECK(status IN ('active','author-hidden','admin-hidden')),

  published_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,

  FOREIGN KEY(author_user_id) REFERENCES users(id),
  FOREIGN KEY(content_hash) REFERENCES stage_blobs(content_hash),
  FOREIGN KEY(parent_stage_id) REFERENCES published_stages(id),
  FOREIGN KEY(root_stage_id) REFERENCES published_stages(id)
);
```

## 18.5 stage_stats

```sql
CREATE TABLE stage_stats (
  stage_id TEXT PRIMARY KEY,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  clear_count INTEGER NOT NULL DEFAULT 0,
  clear_rate_ppm INTEGER NOT NULL DEFAULT 0,
  like_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(stage_id) REFERENCES published_stages(id)
);
```

## 18.6 play_attempts

```sql
CREATE TABLE play_attempts (
  play_session_id TEXT PRIMARY KEY,
  stage_id TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  user_id TEXT,
  guest_device_id TEXT,
  client_build_id TEXT NOT NULL,
  asset_catalog_revision TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  result TEXT CHECK(result IN ('clear','defeat','abandoned')),
  logic_frames INTEGER,
  restriction_digest TEXT,
  aggregated_at INTEGER,
  FOREIGN KEY(stage_id) REFERENCES published_stages(id)
);
```

## 18.7 daily stats

```sql
CREATE TABLE stage_stats_daily (
  stage_id TEXT NOT NULL,
  utc_day TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  clear_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(stage_id, utc_day)
);
```

## 18.8 likes

```sql
CREATE TABLE likes (
  stage_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(stage_id, user_id)
);
```

## 18.9 comments

```sql
CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  stage_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('visible','admin-hidden')),
  created_at INTEGER NOT NULL
);
```

## 18.10 search grams

```sql
CREATE TABLE stage_search_grams (
  stage_id TEXT NOT NULL,
  gram TEXT NOT NULL,
  field TEXT NOT NULL CHECK(field IN ('title')),
  PRIMARY KEY(stage_id, gram, field)
);

CREATE INDEX idx_stage_search_gram
ON stage_search_grams(gram, stage_id);

CREATE TABLE user_search_grams (
  user_id TEXT NOT NULL,
  gram TEXT NOT NULL,
  field TEXT NOT NULL CHECK(field IN ('login','display')),
  PRIMARY KEY(user_id, gram, field)
);

CREATE INDEX idx_user_search_gram
ON user_search_grams(gram, user_id);
```

## 18.11 idempotency

```sql
CREATE TABLE idempotency_keys (
  scope TEXT NOT NULL,
  actor_key TEXT NOT NULL,
  idem_key TEXT NOT NULL,
  response_code INTEGER NOT NULL,
  response_body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(scope, actor_key, idem_key)
);
```

投稿・コメント等、retryで重複すると困るmutationに使用する。

## 18.12 admin audit

```sql
CREATE TABLE admin_audit (
  id TEXT PRIMARY KEY,
  admin_user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  details_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
```

旧本文全文は保存せず、action・target・reason・日時だけを記録する。

---

# 19. 必須index

```sql
CREATE INDEX idx_stage_active_new
ON published_stages(status, published_at DESC, id DESC);

CREATE INDEX idx_stage_author
ON published_stages(author_user_id, status, published_at DESC);

CREATE INDEX idx_stats_plays
ON stage_stats(attempt_count DESC, stage_id DESC);

CREATE INDEX idx_stats_likes
ON stage_stats(like_count DESC, stage_id DESC);

CREATE INDEX idx_stats_clear
ON stage_stats(clear_rate_ppm ASC, stage_id DESC);

CREATE INDEX idx_comments_stage_old
ON comments(stage_id, status, created_at ASC, id ASC);

CREATE INDEX idx_comments_stage_new
ON comments(stage_id, status, created_at DESC, id DESC);

CREATE INDEX idx_attempt_stage_started
ON play_attempts(stage_id, started_at);

CREATE INDEX idx_attempt_compaction
ON play_attempts(aggregated_at, started_at);
```

全queryは`EXPLAIN QUERY PLAN`でfull scan有無を確認する。

---

# 20. API

Base:

```text
/api/v1
```

## 20.1 auth

```text
POST  /auth/register
POST  /auth/login
POST  /auth/logout
GET   /auth/me
PATCH /auth/display-name
PATCH /auth/password
```

## 20.2 stages

```text
GET    /stages
POST   /stages
GET    /stages/:courseId
PATCH  /stages/:courseId/metadata
DELETE /stages/:courseId
GET    /stages/:courseId/payload
GET    /stages/:courseId/import
PUT    /stages/:courseId/thumbnail
```

`DELETE`は作者論理削除。

## 20.3 likes

```text
PUT    /stages/:courseId/like
DELETE /stages/:courseId/like
```

## 20.4 comments

```text
GET  /stages/:courseId/comments
POST /stages/:courseId/comments
```

## 20.5 plays

```text
POST /plays/batch
```

1batch最大20event。

## 20.6 users

```text
GET /users/:loginId
GET /users/:loginId/stages
```

## 20.7 admin

```text
GET   /admin/users
PATCH /admin/users/:id/status
POST  /admin/users/:id/reset-password
POST  /admin/users/:id/revoke-sessions

GET   /admin/stages
PATCH /admin/stages/:courseId/status

GET   /admin/comments
PATCH /admin/comments/:id/status

POST  /admin/stats/:courseId/rebuild
POST  /admin/system/write-mode
```

## 20.8 mutation共通

以下へ`Idempotency-Key`を要求する。

- stage publish
- comment post
- thumbnail replace
- admin mutation

同じactor・scope・keyの再送は保存済みresponseを返す。

---

# 21. API共通response

成功:

```js
{
  ok: true,
  data: {}
}
```

失敗:

```js
{
  ok: false,
  error: {
    code: "comment-rate-limited",
    message: "5秒待ってから投稿してください。",
    details: {}
  }
}
```

- 内部SQLを返さない
- R2 keyを返さない
- stack traceを返さない
- field errorは安全なfield名だけ
- unsupported buildでは更新案内
- unsupported asset revisionでsilent fallbackしない

---

# 22. manifest・互換性

公開stage detailに以下を含める。

```js
{
  courseId,
  contentHash,
  gameplaySchemaVersion,
  restrictionSchemaVersion,
  assetCatalogRevision,
  minimumClientBuild,
  createdByClientBuild
}
```

client:

- unsupported schema → プレイ不可
- asset revision不足 → プレイ不可
- minimum build不足 → 更新案内
- metadataは閲覧可能
- payloadを勝手に旧schemaへ落とさない

Service Worker:

- mutation APIをcacheしない
- auth APIをcacheしない
- immutable hash payloadだけcache-first
- stage metadataはnetwork-first
- fallback generationはstale-while-revalidate
- logout後もprivate responseをcacheへ残さない

---

# 23. インポート

## 23.1 処理

```text
公開manifest
→ payload取得
→ SHA-256再検証
→ version確認
→ CustomStageSchema v3 normalize
→ CustomStageValidator
→ provenance作成
→ 新local ID
→ transaction的にlocal storeへ保存
```

- 公開stage IDをlocal IDへ流用しない
- imported stageは既存自作ステージ一覧へ表示
- 完全編集可能
- JSON export可能
- local copyはonline更新で変わらない
- online非公開後もlocal copyは残る
- import失敗時に既存storeを変更しない
- storage quota errorを明示

## 23.2 再投稿

- parentCourseIdをserverへ送る
- serverがrootを導出
- gameplay変更なしでも投稿可能
- metadataだけ変えた複製も可能
- `原作 / 編集`を表示

---

# 24. 管理画面

## 24.1 users

- ID検索
- 表示名検索
- status filter
- 利用停止
- 再開
- 論理削除
- 仮password
- session全失効
- 投稿数表示
- 最後のadmin保護

## 24.2 stages

- course ID検索
- title検索
- author検索
- status filter
- 非表示
- 再公開
- metadata確認
- gameplay JSON確認
- content hash確認
- lineage確認
- stats確認
- asset revision確認

## 24.3 comments

- 本文検索
- 作者検索
- course検索
- 非表示
- 再表示

## 24.4 stats

- attempt再構築
- clear再構築
- like再構築
- comment再構築
- raw/daily/current差分表示
- anomaly修正

## 24.5 system

- read-write / read-only切替
- fallback generation状態
- last maintenance
- orphan thumbnail数
- D1/R2 error概要

物理削除buttonは置かない。

---

# 25. R2 lifecycle

## 25.1 gameplay blob

- immutable
- 同一hash共有
- hidden stageでも削除しない
- reference countは監査用
- 自動GCしない

## 25.2 thumbnail

更新順:

1. 新thumbnail upload
2. validation
3. DB metadata transaction
4. snapshot更新
5. 旧thumbnailをorphan queueへ
6. maintenanceで一定期間後削除

DB更新失敗時、新objectをorphanとして回収する。

## 25.3 fallback generations

- current＋直前2generationを保持
- 古いgenerationをmaintenance削除
- current pointer更新前に全file integrity確認
- generation IDへtimestamp＋random suffix

---

# 26. フォルダ構成

```text
functions/
├─ api/v1/
│  ├─ auth/
│  ├─ stages/
│  ├─ comments/
│  ├─ likes/
│  ├─ plays/
│  ├─ users/
│  └─ admin/
└─ _middleware.js

server/
├─ auth/
├─ canonical/
├─ stages/
├─ comments/
├─ likes/
├─ plays/
├─ admin/
├─ search/
├─ storage/
├─ restrictions/
└─ validation/

js/community/
├─ CommunityApiClient.js
├─ CommunityHomeController.js
├─ CommunityStageBrowser.js
├─ CommunityStageDetail.js
├─ CommunityStagePublisher.js
├─ CommunityStageImporter.js
├─ CommunityStageProvenanceStore.js
├─ CommunityChallengeFormationStore.js
├─ CommunityTelemetryOutbox.js
├─ CommunityAuthStore.js
├─ CommunityOfflineFallback.js
├─ CommunityFeatureFlags.js
├─ restrictions/
└─ ui/

js/community/restrictions/
├─ CommunityRestrictionSchema.js
├─ CommunityRestrictionValidator.js
├─ CommunityRestrictionNormalizer.js
├─ CommunityRestrictionStatsResolver.js
├─ CommunityRestrictionEligibility.js
├─ CommunityRestrictionDiagnostics.js
└─ CommunityRestrictionFormationAdapter.js

migrations/
├─ 0001_users_sessions.sql
├─ 0002_stage_blobs.sql
├─ 0003_stages_stats.sql
├─ 0004_social.sql
├─ 0005_search.sql
└─ 0006_idempotency_audit.sql

workers/community-maintenance/
└─ src/index.js
```

---

# 27. Feature flags

```js
{
  communityHome: false,
  communityBrowse: false,
  communityAuth: false,
  communityPublish: false,
  communitySocial: false,
  communityStats: false,
  communityRestrictions: false,
  communityAdmin: false,
  communityFallback: false
}
```

online全体を無効化しても既存プレイを維持する。

---

# 28. 実装順

## Phase 0: 現行コード再監査

- main HEAD固定
- 7/23中核参照確認
- CustomStageSchema現状
- Formation owner
- player capacity owner
- unit level＋plus level owner
- cost解決順
- character modification適用順
- service worker
- full CI baseline
- iPad baseline screenshot

未確認ownerを確定するまでcapacity実装へ進まない。

## Phase 1: schema v3

- challengeRestrictions追加
- v2→v3 migration
- JSON envelope
- provenance
- local import/export
- regression

## Phase 2: home shell

- ホーム
- 従来プレイ導線
- feature flag
- no-network回帰

## Phase 3: Cloudflare基盤

- Pages Functions
- D1 migrations
- R2
- Custom Domain
- Secrets
- preview/production分離
- maintenance Worker

## Phase 4: auth

- register
- Turnstile
- login
- rolling session
- CSRF
- rate limit
- account UI
- admin bootstrap

## Phase 5: canonical publish/import

- canonical JSON
- SHA-256
- R2 dedupe
- course ID
- metadata
- thumbnail
- lineage
- import

## Phase 6: browse

- list
- 50件page
- n-gram search
- sort
- detail
- author page
- placeholder

## Phase 7: social

- like
- unlike
- comments
- rate limit
- counters
- admin hide

## Phase 8: stats

- play batch
- idempotent transaction
- guest ID
- outbox
- clear result bridge
- daily aggregate
- maintenance

## Phase 9: restrictions

- schema
- editor UI
- stats resolver
- **effectiveLevel = base + plus**
- selection前disable
- challenge formation
- capacity owner接続
- publication validation

## Phase 10: fallback/admin

- static generations
- read-only
- admin UI
- audit
- rebuild
- orphan cleanup

## Phase 11: acceptance

- full CI
- browser
- iOS/iPadOS
- Cloudflare preview
- load
- security
- rollback drill
- docs

---

# 29. テスト

## 29.1 既存回帰

- ホーム→プレイ→従来編成
- 公式stage
- local custom stage
- v2 stage load
- local save
- JSON import/export
- actor stats
- spawn runtime
- damage
- proc
- render
- boot order
- PWA
- offline

## 29.2 schema

- v2→v3
- null restrictions
- v3 round trip
- restrictions preservation
- provenance export
- partial import拒否
- quota error
- unknown field
- max depth
- max sizes

## 29.3 canonical hash

- key順違いで同hash
- metadata違いで同hash
- spawn順違いで別hash
- restriction違いで別hash
- asset revision違いで別hash
- -0 normalize
- Unicode NFC
- unknown field拒否
- client/server golden fixture一致

## 29.4 auth

- ID case folding
- duplicate ID
- reserved `rhg`
- display emoji
- Turnstile failure
- token reuse
- login rate limit
- session複数端末
- password変更後session維持
- suspendで全失効
- deleted ID再利用拒否
- last admin保護
- CSRF
- XSS

## 29.5 stage

- publish
- idempotency
- R2 dedupe
- metadata update
- gameplay update拒否
- new course
- identical repost
- parent/root
- author hidden
- admin hidden
- hidden parent derivative
- 50件pagination
- tie-break
- Japanese partial search
- course exact

## 29.6 play stats

- first logic frame
- pause duplicateなし
- retry新session
- reload新session
- abandon
- clear
- stage success
- duplicate start
- duplicate finish
- finish-before-start
- offline batch
- hidden before/after start
- 30日outbox
- 35日compaction
- daily aggregate
- rebuild
- 0%除外
- integer rate排序

## 29.7 likes/comments

- one vote
- unlike
- duplicate PUT
- transaction rollback
- comment 200
- multiline
- emoji
- URL plain
- HTML escape
- 5秒
- 100/day
- duplicate text
- comments disabled
- old comments remain
- admin hide
- counter rebuild

## 29.8 restrictions

- cat-only
- dog-only
- mixed
- whitelist priority
- blacklist
- forms
- cat rarity
- effective level boundary
- **Lv30+19**
- **Lv30+20**
- **Lv50+0**
- dog HP multiplier
- dog attack multiplier
- maxHp boundary
- plus value reflected in HP
- multi-hit attack sum
- plus value reflected in attack
- combo excluded
- cost combo discount excluded
- character cost override
- global cost multiplier
- cost above
- cost below
- will+1 capacity
- all reasons
- zero eligible
- pre-selection disable
- start revalidation
- game update invalidation

## 29.9 fallback

- Pages Functions offline
- D1 quota error
- current generation
- partial generation failure
- old generation維持
- browse
- detail
- comments snapshot
- play
- import
- mutation disabled
- immutable hash cache
- private response非cache

## 29.10 viewport

- 320×568
- 390×844
- phone landscape
- iPad mini landscape
- iPad portrait
- desktop
- software keyboard
- safe area
- slow network
- offline
- 50 cards
- long Japanese title
- emoji display name

---

# 30. Security checklist

- password平文なし
- admin secretをGitへ入れない
- token hash保存
- CSRF
- CSP
- textContent
- prepared statement
- body size
- magic byte
- separate media domain
- no raw IP persistence
- rate limit
- Turnstile server validation
- role server判定
- last admin保護
- unknown JSON key拒否
- prototype pollution防止
- R2 key非公開
- bucket listing禁止
- CORS限定
- auth response非cache
- mutation非cache
- audit
- idempotency

---

# 31. Rollback

- frontendは直前Pages deploymentへ戻す
- D1 migrationはforward-only
- destructive DROP禁止
- column追加はnullableから
- gameplay blob immutable
- API version維持
- clientは未知metadataを無視
- 未知gameplay fieldは拒否
- feature flagでonline層だけ停止
- schema v3を保存した後にv2 codeへ戻す場合、v3を上書きしないread-only guard
- fallback current pointerを旧generationへ戻せる

---

# 32. 完成条件

1. ホームから従来プレイへ入れる。
2. 既存機能がofflineでも動く。
3. ログインなしで検索・プレイ・インポートできる。
4. 投稿・いいね・コメントだけloginを要求する。
5. imported stageが既存自作stage一覧へ出る。
6. imported restrictionが失われない。
7. schema v2が無変更で動く。
8. gameplay変更を同一course updateとして拒否する。
9. metadataだけ更新できる。
10. content hashがclient/serverで一致する。
11. 同一contentをR2でdedupeする。
12. parent/root lineageをserverが決定する。
13. 50件pageと4sortが正しい。
14. Japanese partial searchが動く。
15. attempt/clearがtransactionで一度だけ増える。
16. offline再送で二重加算されない。
17. 35日compaction後も全期間再集計できる。
18. いいね1票・解除が動く。
19. コメント制限が動く。
20. 作者削除・管理者非表示が論理削除になる。
21. 候補選択前にrestrictionを判定する。
22. 全違反理由を表示する。
23. **plus levelをレベル判定へ加算する。**
24. **effectiveLevel = baseLevel + plusLevelである。**
25. plus levelをHP・攻撃力にも反映する。
26. コンボをrestriction判定へ含めない。
27. cost判定でcombo discountを除外する。
28. attackは全hit合計。
29. HPは純粋なmaxHp。
30. will+1 capacityを既存ownerへ接続する。
31. 適合0体の投稿を拒否する。
32. D1/Functions停止時もR2から閲覧・プレイ・インポートできる。
33. 管理者秘密がGit・bundle・文書へ存在しない。
34. mutationがService Worker cacheへ入らない。
35. 全CI・browser test成功。
36. iPhone・iPad・desktopで操作不能箇所がない。
37. feature flag OFFで既存RHGへ完全復帰できる。

---

# 33. 実装者への禁止事項

1. 既存CustomStageをonline都合で全面置換しない。
2. schema v3追加fieldをnormalizeで捨てない。
3. online payloadを直接BattleSceneへ渡さない。
4. raw passwordを保存しない。
5. 管理者passwordをcommitしない。
6. client roleを信用しない。
7. counter更新をrow mutationと別transactionにしない。
8. playSessionId重複を集計しない。
9. raw attemptsを無期限保存しない。
10. daily集約前にraw rowを消さない。
11. R2 fallbackをPages Functions経由だけにしない。
12. searchを日本語非対応tokenizerだけに依存しない。
13. content hashへmetadataを混ぜない。
14. gameplay fieldをhashから漏らさない。
15. hidden stageを物理削除しない。
16. API失敗でbattleを止めない。
17. 無効キャラを選択後にだけ警告しない。
18. **plus levelをレベル判定から除外しない。**
19. effectiveLevelをbaseLevelだけで計算しない。
20. コンボをHP・攻撃・コスト制限へ混ぜない。
21. target依存damageを攻撃制限へ使わない。
22. barrier等をmaxHpへ加えない。
23. cost上限・下限を同時指定させない。
24. capacity ownerを名前から捏造しない。
25. patch順を無断変更しない。
26. broad try/catchで不整合を隠さない。
27. unsupported schemaをsilent downgradeしない。
28. full testをskipして完成扱いにしない。

---

# 34. 最終仕様の一文要約

`Rainforest-2/rhg`の既存BCU再現・CustomStage・Formation・Battle契約を維持したまま、Cloudflare Pages Functions＋D1＋R2へ任意アカウント型の公開ステージ層を追加し、immutable gameplay、content-addressed storage、論理削除、idempotent統計、offline fallback、選択前編成制限を実現する。

にゃんこレベル制限は必ず次で判定する。

```text
effectiveLevel = baseLevel + plusLevel
```

プラス値は、レベル判定・最大体力・攻撃力のすべてに反映する。
