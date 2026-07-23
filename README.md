# rhg

BCU の戦闘データとロジックを、ブラウザ上の戦闘プレビューとして再構成する Vite/ESM プロジェクトです。

## 現在の基準

- 対象リポジトリ: `Rainforest-2/rhg`
- 状態確認日: 2026-07-24
- 確認した `main`: `aa6ed5eb82324be4a745a8d85237d4d68775424d`
- 実行時モード: `semantic-strict`
- 実行時アセットの正規経路: 生成済み semantic ZIP
- BCU 根拠: `references/bcu/` の Common / PC / Android 参照コード

`public/assets/bcu/**` はソース素材であり、暗黙の実行時フォールバックではありません。BCU の挙動主張には、参照ソース、現在の JS オーナー、実行時接続、決定的チェックが必要です。見た目に関する主張には、さらにブラウザまたは実機での比較記録が必要です。

## 現在の状況

2026-07-24 の PR #21 で、boot fail-open、stale stage-runtime check、Metal/critical、trait、spawn layer/KC、trail parsing、background index、actor layer order の各問題（#6–#18）が実装上は修正され、回帰チェックが `npm run check` に集約されました。

現在確認されている未解決の correctness 項目は次の3件です。

| 優先 | Issue | 概要 |
|---:|---:|---|
| P0 | #22 | 選択した crown/star 倍率が `StageRuntimeSceneAdapter` の既定値で上書きされ、★2–★4が実戦に届かない |
| P1 | #20 | row倍率と crown倍率の積を途中で整数percentへ丸め、最終HP/ATKがBCUとずれる |
| P1 | #23 | ranking/trail stage の overtime、spawn停止、dojo score、score-limit判定が未実装 |

詳細と修正順は [docs/bcu-migration-status.md](docs/bcu-migration-status.md) を参照してください。旧 #6–#18 のIssueページがopen表示のままでも、現行コード判定では PR #21 と対応回帰チェックを先に確認します。

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
- [docs/bcu-migration-status.md](docs/bcu-migration-status.md): 現在の高水準 status と active correctness 項目
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
- 古いレポートや未整理のIssue状態は、現行コード・merged PR・チェックで再確認するまで現在の欠陥一覧として使いません。
