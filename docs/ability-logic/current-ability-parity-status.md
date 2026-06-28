# BCU 能力整合性の現状

更新日: 2026-06-25

この文書は、`RHgrive/rhg` における BCU の能力・proc・効果の、見た目以外の現状をまとめたものです。古いノートや単一フィクスチャだけで広い整合性を主張しないよう、保守的な記述にしています。

## 状態の用語

- `code-complete-candidate`: ソース根拠・JS の担当箇所・決定的なチェックが存在する。
- `human-visual-review-needed`: ロジックは実装済みだが、ブラウザ上の見た目は未受け入れ。
- `partial`: ソース読み込み、実データフィクスチャ、実行時カバレッジ、チェックのどれかが不足。
- `negative-evidence`: BCU のソースがその担当オーナーでないことを示す。
- `logic-only-unless-future-visual-proof`: 実装はあるが、見た目オーナーや別名が未確認。
- `unconfirmed`: ソースオーナーや互換フォーマットが未確定。

ブラウザ上の手動レビューは [bcu-visual-review-checklist.md](./bcu-visual-review-checklist.md) で管理し、実装順序は [bcu-parity-codex-workplan.md](./bcu-parity-codex-workplan.md) に従います。

## 現在の実行時カバレッジ

| 領域 | 状態 | 現状 |
|---|---|---|
| 凍結 / 減速 / 弱体化 / ノックバック | `code-complete-candidate` | proc カタログと実行時パッチがあり、決定的なチェックもある。 |
| 呪い / 封印 / 毒 | `code-complete-candidate` | 実行時と耐性経路があり、実装は進んでいる。 |
| ワープライフサイクル | `code-complete-candidate` | 進入・隠蔽・退出・完了までの流れが実装済み。見た目は別途レビュー。 |
| P_DELAY | `human-visual-review-needed` | 反映ロジックはあり、見た目の受け入れだけが残る。 |
| 波動 / 小波動 / 烈波 / 爆波 | `code-complete-candidate` | 射出物系の実行時とチェックが揃っている。 |
| バリア / 悪魔シールド / シールドブレイカー | `human-visual-review-needed` | 役割分担とフェーズ制御は実装済み。 |
| 死魂 / デス烈波 / AB_GLASS | `code-complete-candidate` | 死亡・蘇生・デス烈波の系統は実装済み。 |
| ゾンビ corpse / soulstrike / revive | `human-visual-review-needed` | 実行時はあるが、corpse や revive の見た目は未受け入れ。 |
| 地中移動 | `code-complete-candidate` | 移動・ターゲット可否・後始末までカバー済み。 |
| 霊魂ライフサイクル | `human-visual-review-needed` | 生成・クールダウン・容量制限・ready 状態までは実装済み。 |
| 城 / 基地ガード | `human-visual-review-needed` | 実行時はあるが、見た目のレビューが残る。 |
| 財布 / 配置コスト / リスポーン | `code-complete-candidate` | BCU の式と生産ロジックが接続済み。 |
| 基本 / 非基本キャノン | `code-complete-candidate` | 実行時所有権とチェックはある。見た目タイミングは未受け入れ。 |

## ローダーで裏付けられた完了候補

以下の項目は、実データの BCU フォーマットを読み込み、既存ランタイムに接続できたことで、非見た目の整合性候補として上がっています。

- SUMMON: proc-object での実データ読込が確認済み。見た目の入場だけが残る。
- `Trait.targetForms`: 実データの `Trait` が読み込まれ、判定経路に接続されている。
- combo / orb / treasure / talent / PCoin: 既存の実行時と実データの組み合わせが確認済み。
- 追加 / カスタム zombie revive: 実データの proc-object から source/range フィルタが動く。
- リポジトリ内永続化: 読み書き失敗の可視化ができている。

## 未完了の項目

- summon entry の見た目
- death-surge の demon-soul 見た目
- spirit / guard / shield / cannon の見た目受け入れ
- BCU セーブや陣形の import/export 互換性は対象外

## 受け入れ前に必要なチェック

```bash
node scripts/check-bcu-parser-indexes.mjs
node scripts/check-projectile-damage-parity.mjs
node scripts/check-proc-immunity-resistance-parity.mjs
node scripts/check-bcu-delay-runtime.mjs
node scripts/check-bcu-burrow-lifecycle-parity.mjs
node scripts/check-bcu-death-animation-parity.mjs
node scripts/check-bcu-warp-lifecycle-parity.mjs
node scripts/check-bcu-warp-interrupt-scene-parity.mjs
node scripts/check-bcu-zombie-corpse-soulstrike-parity.mjs
node scripts/check-bcu-barrier-shield-effect-parity.mjs
node scripts/check-bcu-summon-runtime-parity.mjs
node scripts/check-bcu-summon-procobject-loader-parity.mjs
node scripts/check-bcu-trait-targetforms-loader-parity.mjs
node scripts/check-bcu-modifier-realdata-sweep-parity.mjs
node scripts/check-bcu-zombie-extra-revive-source-range-parity.mjs
node scripts/check-formation-storage-failure-visibility.mjs
node scripts/check-bcu-spirit-bundle-manifest-parity.mjs
node scripts/check-bcu-castle-guard-parity.mjs
node scripts/check-bcu-wallet-runtime-parity.mjs
node scripts/check-bcu-non-basic-cat-cannon-runtime-parity.mjs
node scripts/check-ability-partial-blockers.mjs
```

決定的なチェックはその主張に対応する範囲だけを証明するため、見た目受け入れは別途台帳で管理します。
