# エージェント向けドキュメント

このディレクトリには、リポジトリ直下の `AGENTS.md` から参照される、長めのエージェントルールを置いています。

## 現在の一次情報源

古いノートを使う前に、次の順で読みます。

1. `../../README.md`
2. `../bcu-migration-status.md`
3. `../ability-logic/current-ability-parity-status.md`
4. `../ability-logic/bcu-unresolved-evidence-blockers.md`
5. `../ability-logic/bcu-visual-review-checklist.md`
6. `../ability-logic/bcu-ability-source-evidence.md`
7. `../ability-logic/bcu-parity-codex-workplan.md`
8. `../ability-logic/bcu-fact-first-update-procedure.md`

2026-06-23 の監査で、重要なドキュメントルールが確立されました。過去の分析はソース事実を残せますが、現在の rhg 実装についての主張は、コードと決定的なチェックで確認されるまで「現行のもの」とみなしてはいけません。

フル文書を開く前の起動コンテキストを減らすため、次のショートカットを使います。

```bash
npm run agent:context -- --topic "<area>"
```

この出力は、上記の文書から現在の状態を取り出し、未解決の状態行・ブロッカー・見た目レビュー項目・ソース根拠・候補チェックをハイライトします。あくまで索引であり、一次情報源ではありません。

低トークンで反復するための実行補助です。

- `npm run agent:find -- --topic "<area>"` で、JS オーナー・チェック・テスト・ドキュメントを短いスニペット付きで並べます。
- `npm run agent:changed` で、`git status` を呼ばずに、コード / テスト / ドキュメント / ツール変更のファイルをまとめて表示します。
- `npm run agent:checks -- --topic "<area>" --file js/path/File.js` で、焦点を絞ったコマンドを提案します。`--changed --run` を付けると差分から導いたコマンドを実行して短い OK/NG サマリを返します。
- `npm run agent:probe -- --expr "..."` で、`assert` と `importProject()` を注入した一時実行を行い、テストファイルの追加・削除サイクルを避けます。
- `npm run agent:run -- "command"` で、長い出力やノイズの多いチェックを短いサマリ付きで実行できます。

## エージェントルールのファイル

- `bcu-parity-rules.md`: 根拠の階層、状態語彙、アセット / 実行時ルール、既知制約。
- `fact-first-update-procedure.md`: 事実優先のワークフローへのリンク。
- `checks-and-verification.md`: 決定的なチェック、ZIP の確認、検証要件。
- `report-format.md`: 実装バッチの最終レポート形式。
- `md-maintenance-rules.md`: Markdown とエージェント指示の保守ルール。

## ドキュメントの分類

`docs/` には、次の 3 種類の情報があります。

1. **現在の状態と作業計画** — 現行コードとチェックに同期して保守する。
2. **BCU ソース根拠** — BCU の所有権、フィールド、タイミング、negative evidence などの耐久的な事実。
3. **履歴レポート** — 参考情報としては有効だが、単独では現行の欠陥一覧にはしない。

既存の一次情報源ファイルがあるなら、並行して別ファイルを作らないでください。整合性変更では、現行状態・ブロッカー・見た目レビュー台帳・移行サマリ・ルートの README / AGENTS まとめまで、スコープ変更に合わせて更新してください。

## 現在の監査重点事項

- 実カスタムパック SUMMON のソース読み込み
- 永続化のスコープと失敗可視化
- 実データの `targetForms` / modifier フィクスチャ網羅
- ブラウザ上の見た目受け入れ
- 非基本キャノンの見た目アセット別名と sweep タイミング

リポジトリ内の `localStorage` 永続化を BCU セーブ互換性とみなさないでください。また、汎用の castle-owned attack オーナーを作らないでください。BCU の根拠が両方を否定しています。
