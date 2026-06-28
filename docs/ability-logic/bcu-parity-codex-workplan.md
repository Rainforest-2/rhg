# BCU パリティ作業計画

更新日: 2026-06-24

これは `RHgrive/rhg` の現行実装順です。最新の監査では、中心的なランタイム実装は既に空っぽの問題ではなく、ソースの網羅性・互換性境界・見た目受け入れが優先事項です。2026-06-24 の再監査では、1 つの非見た目差分（W7: 同フレーム攻撃解決順）を確認し、modifier-registry の fail-open 可視化ギャップは解消しました。

## 状態ルール

- `code-complete-candidate`: ソース根拠・現在の JS オーナー・決定的テストが存在する。
- `human-visual-review-needed`: 実行時根拠はあるが、ブラウザ上の見た目は未受け入れ。
- `partial`: ソース読み込み、実データフィクスチャ、実行時カバレッジ、テストのどれかが不足。
- `unconfirmed`: ソースオーナーやスキーマが未確定。
- `negative-evidence`: BCU がそのオーナーを否定している。

歴史的な README の指摘を、現行コード比較なしにそのまま欠陥として扱わないでください。

## すべての変更で守る順序

```text
BCU の事実 -> 現在の JS オーナー監査 -> 最小変更 -> 決定的なチェック -> 集中したドキュメント更新
```

`public/assets/bcu/**` への実行時フォールバックは行わず、wrapper chain とランダム挙動は保持してください。CSV フィールドや汎用の見た目別名も作らないでください。

## 優先度

- W1: 実カスタムパック SUMMON のローダー網羅
- W2: 永続化のスコープと失敗可視化
- W3: 実データの modifier / trait フィクスチャ
- W4: 見た目受け入れの台帳
- W5: 非基本キャノンのアセット整合性
- W6: パフォーマンス関連のクリーンアップ
- W7: 同フレーム攻撃解決順（部分的 / ブラウザ確認待ち）

### W0 — 証明ハーネスと docs の真実性を保つ

変更前に次を行います。

- `current-ability-parity-status.md`、`bcu-unresolved-evidence-blockers.md`、ソース根拠一覧を読む
- 挙動に関わるオーナー変更前に、決定的なチェックを追加・強化する
- 同バッチで focused status / blocker docs を更新する
- 実際のブラウザレビュー後だけ、視覚チェックリストを更新する

### W1 — 実カスタムパック SUMMON の読み込み

目的: SUMMON 実行時はあるが、実データが届いていない可能性があるためです。

必要作業:

1. 実カスタムパックの proc-object `CustomEntity.atks[].proc.SUMMON` を読み込む
2. 既存の `attachBcuProcObjectSummonsToAttackHits()` の境界は維持する
3. immediate / on-hit / on-kill、side、inheritance、layer、allow/group、same_health、bond_hp、ignore_limit を実データで検証する
4. ソース根拠がない限り、通常のユニット / 敵 CSV SUMMON パーサを追加しない

### W2 — 永続化の範囲と失敗可視化

目的: ブラウザ側の状態が BCU 互換と誤解されやすいためです。

必要作業:

1. 現在のリポジトリ内マイグレーションを維持する
2. `FormationStore` / `StageRegistry` の読み書き失敗を可視化する
3. 自己永続化と BCU import/export 互換を明確に分ける
4. BCU セーブ / 陣形互換機能を作る前に、BCU のシリアライズオーナーと round-trip フィクスチャを確定する

### W3 — 実データの modifier と trait フィクスチャ

目的: 主要な modifier hook はあるが、広い互換性主張に実データが不足しているためです。

必要作業:

- 実カスタムの `Trait.targetForms` / `targetType` ローダーフィクスチャを追加する
- capture / proc / targetOnly / damage-family 経路をまとめて確認する
- 実 combo / orb / treasure / talent / PCoin の組み合わせを sweep する
- ソース確認済みの耐性保持者だけを使い、敵側の toxic immunity を追加しない

### W4 — 見た目受け入れ台帳

目的: トレースだけで見た目を完了扱いしないためです。

レビュー順:

1. P_DELAY と barrier / demon shield / shield breaker
2. spirit と castle guard
3. zombie revive と mini-death-surge
4. basic cannon の発射 / wave
5. non-basic cannon の sweep と BASE_WALL
6. W1 の実フィクスチャが出たら SUMMON entry

各レビューには、フィクスチャ・BCU 参照・ブラウザ / 端末・結果・差分を残します。

### W5 — 非基本キャノンのアセット整合性

キャノンごとの ATK/EXT ビットマップ別名を追加し、extend / waved の挙動をフレーム単位で比較します。欠けたアセットを汎用トレースで置き換えないでください。

### W6 — パフォーマンスクリーンアップ

挙動に関わる経路がテストで保護された後にのみ行います。

- ロジックに影響しない診断用割り当てを消す / gate する
- wrapper call、effect creation、座標メタデータ、renderer ordering を保持する
- クリーンアップごとに関連する安全な suite を回す

### W7 — 同フレーム攻撃解決順（状態: partial / ブラウザ確認待ち）

BCU の事実として、player-side の strike が先に決着し、enemy-side の strike はそのフレームでは発火しないような順序が存在します。

必要な作業:

1. 同フレーム相互キルの決定的フィクスチャとチェックを追加する
2. player excuse + death が先に解決するよう、既存フェーズモデルを最小変更で並び替える
3. パリティ完了を宣言する前に、固定 BCU キャプチャでブラウザ確認する

## 明示的にやらないこと

- 汎用の castle-owned attack runtime を作らない
- パーサのフィールドだけを見て、実行時の有無を決めない
- `localStorage` 永続化から BCU セーブ互換を主張しない
- headless trace を見た目受け入れに昇格させない

## 共通チェック

```bash
node scripts/check-bcu-parser-indexes.mjs
node scripts/check-projectile-damage-parity.mjs
node scripts/check-proc-immunity-resistance-parity.mjs
node scripts/check-bcu-delay-runtime.mjs
node scripts/check-bcu-summon-runtime-parity.mjs
node scripts/check-bcu-spirit-bundle-manifest-parity.mjs
node scripts/check-bcu-castle-guard-parity.mjs
node scripts/check-bcu-wallet-runtime-parity.mjs
node scripts/check-bcu-non-basic-cat-cannon-runtime-parity.mjs
node scripts/check-ability-partial-blockers.mjs
```

変更したファイルに関係するチェックだけを実行し、必要なチェックを見逃さないでください。変更した JS / MJS には `node --check` も必ず実行してください。