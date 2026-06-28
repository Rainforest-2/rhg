# AGENTS.md

`RHgrive/rhg` の作業を行うエージェント向けの、リポジトリ全体の入口です。

## 使命

ローカルの BCU 参照ソースをもとに、既存のランタイム挙動・semantic ZIP アセット規則・決定的チェック・記録された不確実性を壊さずに、バトル挙動の整合性を改善します。

## まず読むもの

古いノートより先に、現行の以下の文書を参照してください。

1. `README.md`
2. `docs/bcu-migration-status.md`
3. `docs/ability-logic/current-ability-parity-status.md`
4. `docs/ability-logic/bcu-unresolved-evidence-blockers.md`
5. `docs/ability-logic/bcu-visual-review-checklist.md`
6. `docs/ability-logic/bcu-ability-source-evidence.md`
7. `docs/ability-logic/bcu-parity-codex-workplan.md`
8. `docs/ability-logic/bcu-fact-first-update-procedure.md`
9. `docs/agent/README.md`

現行コードとこれらの文書が同じ主張を確認していない限り、古いレポートは歴史的情報として扱います。

短い導線ビューが必要なら、次を実行してください。

```bash
npm run agent:context -- --topic "<area>"
```

このショートカットは、上記の文書から未解決項目・ブロッカー・見た目レビュー項目・候補チェックを要約するためのものです。挙動変更のための事実優先ワークフローの代替ではありません。

一時ファイルを作る前に、低トークンな補助コマンドを使ってください。

```bash
npm run agent:find -- --topic "<area>"
npm run agent:changed
npm run agent:checks -- --topic "<area>" --file js/path/File.js
npm run agent:checks -- --changed --run
npm run agent:probe -- --expr "const m = await importProject('js/path/File.js'); assert.ok(m)"
npm run agent:run -- "node scripts/check-name.mjs"
```

`agent:probe` は、一時的なアサーションをテストファイルを作らずに走らせるためのものです。永続的なチェックが必要な場合だけ、正式なチェックを追加してください。

## 変更前に守るフロー

```text
BCU の事実 -> 現在の JS オーナー監査 -> 最小変更 -> 決定的なチェック -> 集中したドキュメント更新
```

ランタイム挙動を変える前に、次を確認してください。

- BCU の対象ファイル / クラス / メソッド / フィールド / 状態遷移
- 現在の rhg でその挙動を持つファイル / 関数
- 回帰を検出できるテストやフィクスチャ
- 残っている問題がランタイム・ソース読み込み・見た目受け入れ・スキーマ互換のどれか

## 現在の監査優先度

loader / data の優先度 1–3 は、実データの BCU フィクスチャを既存ランタイムに接続して閉じています（SUMMON proc-object、`Trait.targetForms`、combo/orb/treasure/talent/PCoin、追加 / カスタム revive、読み書き失敗の可視化）。残りの優先度は見た目です。

1. 見えるエフェクト・UI の手動ブラウザ受け入れ（P_DELAY、シールド、spirit、guard、ゾンビ corpse/revive、summon entry、cannon）
2. 非基本キャノンの ATK/EXT 別名と extend/waved タイミング（見た目）
3. 守るべきガードレール: 通常の CSV SUMMON holder を作らないこと。リポジトリ内の `localStorage` 状態は、自己永続化の範囲であり、**BCU セーブ / 陣形互換性の主張ではない**こと。

## してはいけないこと

- コメント・古いドキュメント・1 つのフィクスチャだけで行を完了扱いしない
- BCU の CSV インデックス・proc holder・セーブスキーマ・エフェクト別名を勝手に作らない
- semantic ZIP アセットを `public/assets/bcu/**` への暗黙フォールバックに置き換えない
- wrapper chain を、import 順序・元の呼び出し・呼び出し元を確認せずに置き換えない
- 不確実性を大きな `try/catch` や静かなフォールバックで隠さない
- ソース根拠なくランダム挙動・ターゲット選択・side 所有権を変えない
- 汎用の castle-owned attack runtime を作らない。BCU の根拠は通常の城にその所有権を与えていない
- `localStorage` 永続化を「BCU 互換」と呼ばない。BCU のシリアライズオーナーと round-trip フィクスチャが必要
- 決定的トレースだけで、見た目の整合性を受け入れたと扱わない
- Markdown の変更だけでコード・アセット・ZIP・マニフェストを変えない

## チェック

`scripts/check-*.mjs` 配下の焦点チェックを使います。よく使うものは次のとおりです。

```bash
node scripts/check-bcu-parser-indexes.mjs
node scripts/check-projectile-damage-parity.mjs
node scripts/check-proc-immunity-resistance-parity.mjs
node scripts/check-bcu-delay-runtime.mjs
node scripts/check-bcu-summon-runtime-parity.mjs
node scripts/check-bcu-summon-procobject-loader-parity.mjs
node scripts/check-bcu-trait-targetforms-loader-parity.mjs
node scripts/check-bcu-modifier-realdata-sweep-parity.mjs
node scripts/check-bcu-zombie-extra-revive-source-range-parity.mjs
node scripts/check-formation-storage-failure-visibility.mjs
node scripts/check-bcu-battle-sound-effects-parity.mjs
node scripts/check-bcu-spirit-bundle-manifest-parity.mjs
node scripts/check-bcu-spirit-cooldown-emphasize-parity.mjs
node scripts/check-bcu-castle-guard-parity.mjs
node scripts/check-bcu-wallet-runtime-parity.mjs
node scripts/check-bcu-non-basic-cat-cannon-runtime-parity.mjs
node scripts/check-ability-partial-blockers.mjs
```

関係するチェックだけを実行し、必要なものを見逃さないでください。変更した JS / MJS には `node --check` も必ず実行してください。

## ドキュメント保守

整合性主張が変わったら、並列の status ファイルを増やすのではなく、既存の文書を更新してください。

1. `current-ability-parity-status.md`
2. `bcu-unresolved-evidence-blockers.md`
3. `bcu-visual-review-checklist.md`（実際のブラウザレビュー後のみ）
4. `bcu-migration-status.md`
5. `README.md` / このファイル（公開サマリやエージェント向け要約が変わる場合）

## 最終実装レポート

実装バッチの最後では、次の形式でまとめます。

```md
## Summary
- Rows moved to code-complete-candidate:
- Rows moved to human-visual-review-needed:
- Rows still partial / unconfirmed:

## BCU references inspected
- files/classes/methods:

## Changed files
- code:
- tests:
- docs:
- generated assets:

## Verification
- command: result

## Remaining risks
- risk:
- reason:
- next action:
```

コマンド出力や確認できた内容がない限り、整合性完了を報告しないでください。
