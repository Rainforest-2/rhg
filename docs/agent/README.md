# エージェント向けドキュメント

このディレクトリは `AGENTS.md` の詳細規則を補足します。現在の project status や優先順位はここで重複管理しません。

## 入口

1. `../../AGENTS.md`
2. `../README.md`
3. `../bcu-migration-status.md`
4. 変更対象に対応する focused document

## 補助コマンド

```bash
npm run agent:context -- --topic "<area>"
npm run agent:find -- --topic "<area>"
npm run agent:changed
npm run agent:checks -- --topic "<area>" --file js/path/File.js
npm run agent:checks -- --changed --run
npm run agent:probe -- --expr "..."
npm run agent:run -- "command"
```

これらは索引・実行補助です。BCU source fact、current owner、open Issue、focused check の代替ではありません。

## このディレクトリの責務

- `bcu-parity-rules.md`: evidence hierarchy、state vocabulary、asset/runtime guardrail
- `fact-first-update-procedure.md`: source fact から実装・検証へ進む手順
- `checks-and-verification.md`: check 選択、generated asset、visual verification
- `report-format.md`: 実装バッチの最終レポート形式
- `md-maintenance-rules.md`: Markdown の SSOT と更新規則

## 保守規則

- current status は `../bcu-migration-status.md` に置く。
- active order は `../ability-logic/bcu-parity-codex-workplan.md` に置く。
- この README に具体的な未解決機能一覧を複製しない。
- 個別 `*-current-status.md` を増やさない。
- 古い plan/report は historical reference とし、現行コードの defect list に使わない。
