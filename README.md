# rhg

BCU の戦闘データとロジックを、ブラウザ上の戦闘プレビューとして再構成する Vite/ESM プロジェクトです。

## 現在の基準

- 対象リポジトリ: `Rainforest-2/rhg`
- 状態確認日: 2026-07-24
- 確認した `main`: `d43f53ea25cc589c16d3b39a5be08913d1ea32f0`
- 実行時モード: `semantic-strict`
- 実行時アセットの正規経路: 生成済み semantic ZIP
- BCU 根拠: `references/bcu/` の Common / PC / Android 参照コード

`public/assets/bcu/**` はソース素材であり、暗黙の実行時フォールバックではありません。BCU の挙動主張には、参照ソース、現在の JS オーナー、実行時接続、決定的チェックが必要です。見た目に関する主張には、さらにブラウザまたは実機での比較記録が必要です。

## 現在の状況

主要な runtime、semantic asset loader、キャラクター改造、ローカル自己永続化は実装されています。ただし、2026-07-24 時点で BCU 整合性・信頼性に関する open Issue が残っているため、「残作業は見た目だけ」「Critical 欠陥なし」とは扱いません。

| 分野 | open Issue | 概要 |
|---|---|---|
| Boot / 検証 | #9, #10 | 必須 patch group の fail-open、stage-runtime check の stale / safe-suite 未接続 |
| Stage / spawn | #6, #7, #17, #18 | CopRand layer の破棄、KC death semantics、trail stage、castle-less stage の background header |
| Damage / trait | #12, #13, #14 | Metal target と AB_METALIC の混同、critical 二重抽選、Demon / Relic の target-traited 判定欠落 |
| Renderer | #8 | `currentLayer` を無視した actor paint order |

詳細と優先順位は [docs/bcu-migration-status.md](docs/bcu-migration-status.md) を参照してください。

## 実装済みの主要領域

- semantic ZIP による unit / enemy / stage / background / castle / effect 読み込み
- BattleScene の固定 30fps logic と 60fps paint
- 通常攻撃、multi-hit、proc、wave / surge / blast、KB、death、zombie、warp、burrow、summon、spirit、castle guard、cat cannon
- combo / orb / treasure / talent / PCoin と production / economy
- formation / custom stage / mobile UI
- キャラクター改造: 通常計算後の sparse absolute override と派生モデル再構築

キャラクター改造は RHG 独自形式です。RHG JSON や `localStorage` を BCU セーブ、BCU 陣形、BCU 公式ステージ互換とは呼びません。

## ドキュメント

現在読むべき文書と各文書の責務は [docs/README.md](docs/README.md) に集約しています。新しい status 文書を増やす前に、既存の一次情報源を更新してください。

主要入口:

- [docs/README.md](docs/README.md): 文書の索引と責務
- [docs/bcu-migration-status.md](docs/bcu-migration-status.md): 現在の高水準 status と open Issue
- [docs/RHG_BCU_CORE_ARCHITECTURE_AND_LOGIC_REFERENCE_2026-07-23.md](docs/RHG_BCU_CORE_ARCHITECTURE_AND_LOGIC_REFERENCE_2026-07-23.md): 中核アーキテクチャ参照
- [AGENTS.md](AGENTS.md): エージェント作業規則

## 開発

```bash
npm run dev
npm run build
npm test
```

調査・変更時は、広い一括チェックではなく影響範囲に対応する焦点チェックを使います。

```bash
npm run agent:context -- --topic "<area>"
npm run agent:find -- --topic "<area>"
npm run agent:checks -- --topic "<area>" --file js/path/File.js
npm run agent:checks -- --changed --run
npm run agent:probe -- --expr "..."
```

基本フロー:

```text
BCU source fact
-> current JS owner / boot reachability
-> minimal change
-> deterministic regression check
-> adjacent integration checks
-> focused documentation update
```

## 重要な非主張

- 通常の `ECastle` に汎用 attack owner はありません。攻撃する特殊拠点は `EEnemy`、出現条件は stage runtime が所有します。
- 決定的チェックは assertion した範囲だけを証明します。
- headless UI check は物理端末の safe-area、software keyboard、orientation change や BCU 見た目比較を代替しません。
- 古いレポートの未実装一覧は、現行コード・open Issue・チェックで再確認するまで現在の欠陥一覧として使いません。
