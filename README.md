# rhg

BCU の戦闘プレビューと実行時挙動をブラウザ上で再現するプロジェクトです。

このリポジトリでは、パーサのフィールド・古いノート・見た目だけの近似を、整合性の証明として扱いません。ローカルにある BCU 参照ソースをもとに、挙動の再現性を確認することを重視しています。

## 現在の状況 — 2026-06-23

現状の基準モードは `semantic-strict` です。

- 生成済みの semantic ZIP バンドルを実行時アセットの正規経路として扱う
- `public/assets/bcu/**` 配下のファイルは、暗黙の実行時フォールバックではなくソース素材として扱う
- BCU の挙動主張は、ソース証拠・JS の担当箇所・実行時接続・決定的なチェック、さらに見た目に関わる場合はブラウザでの手動確認を前提とする

従来の長大な ZIP 分析系 README は、現行コードと異なる箇所があるため、現時点の不具合一覧としては使いません。

## 現在の監査結果

2026-06-23 時点の `RHgrive/rhg` と BCU 参照ソースの比較では、確認済みの `Critical` 欠陥はありません。残る主なリスクは、既に修正済みの過去の Stage/Spawn パーサ問題ではなく、証拠の網羅性と受け入れ確認の範囲です。

### ローダで確認済み（見た目以外は完了）

| 領域 | 現在の結論 | 根拠 |
|---|---|---|
| SUMMON の読み込み | 実在する `CustomEntity.atks[].proc.SUMMON` をディスクから読み込み、末端まで駆動できる。通常の CSV 置き場を勝手に作っていない。 | `check-bcu-summon-procobject-loader-parity` |
| `Trait.targetForms` | 実在の `Trait` ファイルの `targetType/targetForms` が、proc 経路と Target-Only 経路の単一ゲート `bcuTraitCompatible` を通す。 | `check-bcu-trait-targetforms-loader-parity` |
| Combo / orb / treasure / talent / PCoin | 実データの 150300 combo と talent/PCoin、treasure/orb 定数が BCU の順序で組み合わさり、装備オーブも解決経路に乗る。PCoin のコスト・CD と combo 割引・研究報酬も反映される。戦闘中の見た目は別レビュー項目。 | `check-bcu-modifier-realdata-sweep-parity`、`check-battle-scene-stage-runtime-wiring`、`check-bcu-talent-info-loader` |
| 追加 / カスタム ゾンビ蘇生 | 実在の `REVIVE` proc-object が `ZombX.updateRevive` の source/range/zombie/warp フィルタを駆動する。 | `check-bcu-zombie-extra-revive-source-range-parity` |
| リポジトリ内永続化 | `FormationStore` / `StageRegistry` が自身の状態を往復し、読み書き失敗を黙って握りつぶさずに通知する。これは BCU セーブ互換ではなく、ローカル自己永続化の範囲。 | `check-formation-storage-failure-visibility` |

### 残っているもの（見た目 / 対象外）

| 領域 | 現在の結論 | 次に必要なこと |
|---|---|---|
| BCU セーブ / 陣形の import/export | ここにはその機能も BCU シリアライズ担当も存在しない。対象外であり欠陥ではない。 | 追加する場合のみ、BCU 側の担当箇所を特定し、まず round-trip フィクスチャを用意する。 |
| 非基本キャットキャノン | 実行時は BASE_WALL などを含めて存在する。キャノンごとの ATK/EXT ビットマップ別名と、extend/waved の正確な見た目タイミングは未確認。 | 別名を追加したうえで、フレーム単位のブラウザ比較を行う。 |
| 見えるエフェクトと UI | P_DELAY、シールド系、霊魂、城のガード、召喚、ゾンビ蘇生、キャノン効果など、ブラウザ確認がまだ残っている。 | 視覚チェックリストを使い、`accepted` / `mismatch` / `blocked` を固定フィクスチャ付きで記録する。 |

## 重要な非主張

- BCU の通常の城が汎用攻撃ランタイムを持つわけではありません。ボス側の砦は通常の敵オーナー経由で攻撃し、HP 閾値や撃破数による出現はステージの出現ロジックに属します。
- 実行時が存在しても、実際のカスタムパックがその経路をすべて満たすとは限りません。
- 決定的なチェックが通っても、手動の見た目受け入れに置き換わるものではありません。
- リポジトリ内の永続化が BCU セーブ互換を意味するわけではありません。

## ドキュメント地図

| 用途 | 現在の文書 |
|---|---|
| 高水準の移行状況と監査サマリ | [docs/bcu-migration-status.md](docs/bcu-migration-status.md) |
| 能力・proc・効果の状態 | [docs/ability-logic/current-ability-parity-status.md](docs/ability-logic/current-ability-parity-status.md) |
| 未解決の根拠・互換性ブロッカー | [docs/ability-logic/bcu-unresolved-evidence-blockers.md](docs/ability-logic/bcu-unresolved-evidence-blockers.md) |
| 手動ブラウザレビュー台帳 | [docs/ability-logic/bcu-visual-review-checklist.md](docs/ability-logic/bcu-visual-review-checklist.md) |
| 死亡・ワープのライフサイクル状態 | [docs/ability-logic/death-warp-current-status.md](docs/ability-logic/death-warp-current-status.md) |
| BCU ソース根拠の一覧 | [docs/ability-logic/bcu-ability-source-evidence.md](docs/ability-logic/bcu-ability-source-evidence.md) |
| 実装順序 | [docs/ability-logic/bcu-parity-codex-workplan.md](docs/ability-logic/bcu-parity-codex-workplan.md) |
| エージェント入口 | [AGENTS.md](AGENTS.md) |

## 開発とビルド

- `npm run agent:context -- --topic "<area>"` で、現在の BCU parity ドキュメントからエージェント向けの短い案内ビューを生成します。
- `npm run agent:changed` で、`git status` までは行わずに変更ファイルの要約を取得できます。
- `npm run agent:find -- --topic "<area>"` で、候補のオーナー・チェック・ドキュメントを短いスニペット付きで並べます。
- `npm run agent:checks -- --topic "<area>" --file js/path/File.js` で、重点的な検証コマンドを提案します。`--run` を付けると実行して要約します。
- `npm run agent:checks -- --changed --run` で、現在の差分から焦点検証を自動で導きます。
- `npm run agent:probe -- --expr "..."` で、一時的なアサーションをテストファイルを作らずに実行できます。
- `npm run agent:run -- "node scripts/check-name.mjs"` で、任意のコマンドを短い成功/失敗サマリ付きで実行できます。
- `npm run dev` で Vite の開発サーバーを起動します。
- `npm run build` でアプリを `dist/` にバンドルします。
- Vite は選択された `public/assets/**` を `/assets/**` として配信・コピーします。`public/assets/bcu/**` と `public/assets/bcu-manifest.json` は意図的に `dist/` には含めず、開発サーバーでも配信しません。BCU の実行時アセットは、生成された semantic ZIP バンドル経由で読み込む前提です。

## ソースと検証のルール

挙動変更を行うたびに次の流れで進めます。

```text
BCU のソース事実 -> 現在の JS オーナー確認 -> 最小変更 -> 決定的なチェック -> 重点的なドキュメント更新
```

`references/bcu/` 配下の参照が主要な挙動ソースです。過去の README の主張を、現行ソースや実行時の証拠で置き換えてはいけません。

## チェック

影響範囲に関連するチェックだけを実行します。よく使うコマンドは次のとおりです。

```bash
node scripts/check-bcu-parser-indexes.mjs
node scripts/check-projectile-damage-parity.mjs
node scripts/check-proc-immunity-resistance-parity.mjs
node scripts/check-bcu-summon-runtime-parity.mjs
node scripts/check-bcu-spirit-bundle-manifest-parity.mjs
node scripts/check-bcu-castle-guard-parity.mjs
node scripts/check-bcu-wallet-runtime-parity.mjs
node scripts/check-bcu-non-basic-cat-cannon-runtime-parity.mjs
node scripts/check-ability-partial-blockers.mjs
```

見た目に関する主張は、スクリプトが通っても十分ではありません。[docs/ability-logic/bcu-visual-review-checklist.md](docs/ability-logic/bcu-visual-review-checklist.md) にブラウザ比較の結果を残してください。

## AI 開発ループ

このリポジトリでは、Claude と Codex が協調して開発を進めるためのループ環境を [.ai](.ai) 配下に用意しています。これは Claude と Codex を直接つなぐものではなく、[.ai/orchestrator.sh](.ai/orchestrator.sh) が両方の CLI を交互に呼び出す仕組みです。

### 起動方法
- Codespaces または Claude Code CLI と Codex CLI がインストール・認証済みの開発環境で、`bash .ai/orchestrator.sh` を実行します。
- 最大 5 周で停止します。
- 自動 commit / push は行いません。
- 各ラウンドのログは [.ai/logs](.ai/logs) に毎周保存され、失敗時の調査に利用できます。
- 非対話モードが使えない場合の手動運用は [.ai/RUN_MANUALLY.md](.ai/RUN_MANUALLY.md) を参照してください。
- GitHub Actions の「AI Development Loop」ワークフローは手動起動できますが、GitHub-hosted runner では `claude` / `codex` の導入と認証がない限り失敗します。主運用は Codespaces 上での実行です。

### AI の役割
- Claude: 全体解析、設計レビュー、バグ発見、レビュー記録の担当。
- Codex: 実装、バグ修正、リファクタリング、テスト追加の担当。

### 主要ファイル
- [.ai/mission.md](.ai/mission.md): プロジェクトの目的、役割分担、開発ルール、完了条件。
- [.ai/state.md](.ai/state.md): 現在の課題・作業内容・完了状況の共有。
- [.ai/tasks.md](.ai/tasks.md): タスクの優先度と管理。
- [.ai/review.md](.ai/review.md): Claude のレビュー記録。
- [.ai/changelog.md](.ai/changelog.md): Codex の変更履歴。
- [.ai/prompts/claude-review.md](.ai/prompts/claude-review.md): Claude レビュー用の固定プロンプト。
- [.ai/prompts/codex-fix.md](.ai/prompts/codex-fix.md): Codex 修正用の固定プロンプト。
- [.ai/orchestrator.sh](.ai/orchestrator.sh): Claude レビュー → Codex 実装 → 検証を最大 5 周実行するローカル向けオーケストレーター。
- [.github/workflows/ai-development.yml](.github/workflows/ai-development.yml): 手動起動でオーケストレーターを試行するワークフロー。

### 開発フロー
1. `.ai/orchestrator.sh` が `git status --short` と `git diff --stat` を記録します。
2. Claude が前回の Codex 出力、検証結果、現在の diff を読み、[.ai/review.md](.ai/review.md) に次の最小タスクを書きます。
3. Codex が `.ai/review.md` の `Next Codex Task` だけを実装し、[.ai/changelog.md](.ai/changelog.md) に結果を追記します。
4. `npm run check`、`npm test`、`npm run lint --if-present`、`npm run build --if-present` を実行します。
5. すべて成功したら停止し、失敗した場合はログを次の Claude レビューに渡して次の周回に進みます。
