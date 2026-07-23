# AGENTS.md

`Rainforest-2/rhg` を変更するエージェント向けの入口です。

## Read first

1. `README.md`
2. `docs/README.md`
3. `docs/bcu-migration-status.md`
4. `docs/RHG_BCU_CORE_ARCHITECTURE_AND_LOGIC_REFERENCE_2026-07-23.md`
5. 変更対象に対応する focused document

短い導線が必要な場合:

```bash
npm run agent:context -- --topic "<area>"
npm run agent:find -- --topic "<area>"
```

`docs/README.md` が文書の責務と current / reference / ledger / historical の区分を定義します。古いレポートや実装計画を current status として使わないでください。

## 現在の優先順位

現行コード、merged PR、active Issue、`docs/bcu-migration-status.md` を基準にします。

1. #22: crown/star 選択値を production `StageRuntime` へ一度だけ正しく伝播する
2. #20: crown倍率を途中の整数percentへ丸めず、BCUの最終変換順を維持する
3. #23: ranking/trail overtime、spawn停止、dojo score、score-limit outcome を実装する
4. 上記 correctness 項目を閉じた後に visual acceptance と performance cleanup を進める

PR #21 は #6–#18 の実装修正と回帰チェックを main に導入済みです。Issueページのstateだけを見て旧欠陥を再実装せず、`105411944e64cecc06ec89a53a3ad6e038846902` 以降のコードと `check-open-issue-regressions` を確認してください。

## 変更フロー

```text
BCU fact -> current JS owner audit -> minimal change -> deterministic check -> focused docs update
```

変更前に確認すること:

- BCU の file / class / method / field / state transition
- raw holder が実在すること
- 現行 JS owner と boot import order
- 同じ method を wrap する patch の数と順序
- raw CSV / BCU frame-world / RHG ms-pixel の単位
- target capture と damage execution の時点
- side / trait / targetable / touchable / base 条件
- barrier / shield / nullify / immunity / proc / KB / death の順序
- logic container と visual effect の lifetime
- 追加する check が何を証明し、何を証明しないか

## 禁止事項

- BCU 根拠なしに CSV index、proc holder、save schema、effect alias を作る
- `public/assets/bcu/**` を暗黙 fallback にする
- wrapper chain の元呼び出しや import 順を確認せず置換する
- 必須 patch の失敗を warning だけで握りつぶす
- `Math.random()` を battle deterministic RNG の代替にする
- 通常の castle-owned attack runtime を作る
- RHG の `localStorage` / JSON を BCU 互換と呼ぶ
- headless trace や DOM check だけで見た目を accepted にする
- raw source object を mutation して character modification を実装する
- Markdown だけでコード・asset・bundle が変わったと主張する

## キャラクター改造

現行責務は `docs/RHG_CHARACTER_MODIFICATION_ARCHITECTURE_ADDENDUM_2026-07-23.md` を参照します。実装計画書は設計履歴であり、現行 status の一次情報源ではありません。

契約:

```text
normal final stats
-> CharacterModificationResolver
-> CharacterModificationDerivedModel
-> BattleActorFactory / ProductionRuntime
```

`CharacterModificationFieldRegistry.js` が editable field metadata の単一定義元です。SUMMON 先へ召喚元の改造を暗黙継承しません。

## 検証

変更した JS / MJS には `node --check` を実行し、Issue または変更領域に対応する focused check を実行します。

```bash
npm run agent:checks -- --changed --run
npm run check:character-modification
npm run check:character-modification:ui
```

コマンド出力を確認していない状態で、完了・整合性・CI 成功を報告しないでください。

## ドキュメント更新

- 高水準 status / active correctness summary: `docs/bcu-migration-status.md`
- 能力/proc matrix: `docs/ability-logic/current-ability-parity-status.md`
- 証拠不足・互換性境界: `docs/ability-logic/bcu-unresolved-evidence-blockers.md`
- 実ブラウザ結果: `docs/ability-logic/bcu-visual-review-checklist.md`
- 実行順: `docs/ability-logic/bcu-parity-codex-workplan.md`
- architecture: 中核参照書または subsystem document

並列の `*-current-status.md` を新設しないでください。既存の一次情報源を更新します。
