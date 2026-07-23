# BCU 移行状況

更新日: 2026-07-24  
対象: `Rainforest-2/rhg`  
確認した `main`: `aa6ed5eb82324be4a745a8d85237d4d68775424d`

## 結論

semantic ZIP、主要 battle runtime、character modification、RHG 内部永続化は広く実装されています。PR #21（merge commit `105411944e64cecc06ec89a53a3ad6e038846902`）により、旧 #6–#18 の boot、verification、Metal/critical、trait、stage spawn/KC、trail parsing、background index、actor layer order の実装差分は修正され、回帰チェックが追加されました。

2026-07-24 時点で現在確認されている未解決の correctness 項目は #20、#22、#23 です。したがって「見た目確認だけが残る」とは表現しません。

この文書が project 全体の current status と active correctness 分類の一次情報源です。個別能力は `ability-logic/current-ability-parity-status.md`、証拠不足は `ability-logic/bcu-unresolved-evidence-blockers.md`、見た目結果は `ability-logic/bcu-visual-review-checklist.md` が所有します。

## Active correctness items

| 優先 | Issue | 分野 | 現在の欠陥 |
|---:|---:|---|---|
| P0 | #22 | Stage crown wiring | UIから渡された crown/star 選択が adapter runtime の100%/★1既定値で上書きされ、production battleへ届かない |
| P1 | #20 | Crown precision | row倍率 × crown倍率を途中で整数percentへ丸め、BCUが保持するfloat multiplierと最終HP/ATKがずれる |
| P1 | #23 | Ranking lifecycle / score | trail認識後の overtime、stage activity/spawn停止、dojo score、score-limit outcome にruntime ownerがない |

Issue の詳細、BCU source、再現条件、期待動作は各 Issue 本文を一次情報源とします。この表は本文を複製せず、修正順を示す要約です。

## 2026-07-24 resolved batch

PR #21で次を修正済みです。

- #9: required battle patch group を fail closed に変更
- #10: stale source-string check を behavior-level stage-runtime check に置換し、main checkへ接続
- #12 / #13: enemy Metalとunit `AB_METALIC`を正しく分類し、critical RNGを一回だけ抽選
- #14: fully target-traited 判定へ Demon / Relic を追加
- #6: CopRandのcommitted spawn layerをactorへ適用し、`Math.random()`再抽選を除去
- #7: player-unit deathから全KC rowをBCU health window付きで通知
- #17: trail/ranking stageのtrigger domainとbase damage windowを復元
- #18: castle row有無を共有CSV layout resolverで判定
- #8: actor paint orderを`currentLayer`優先のstable orderへ変更

Issueページがopen表示のままでも、これらを現在の欠陥として再掲する前に、mainの修正と `scripts/check-open-issue-regressions.mjs` を確認します。

## 実行順

1. #22 を修正し、production `PreviewApp -> BattleScene -> StageRuntimeSceneAdapter` で選択 crown/star を一度だけ保持する。
2. #20 を修正し、row/crown multiplierを最終stat構築境界までfloat精度で維持する。
3. #23 を修正し、BCU logic frame基準のovertime、spawn停止、kill score、score-limit outcomeを実装する。
4. correctness項目を閉じた後に、未受け入れvisual項目とperformance cleanupを進める。

詳細な完了条件は `ability-logic/bcu-parity-codex-workplan.md` を参照してください。

## 現在維持する実装済み領域

以下は「今後不具合が見つからない」という意味ではなく、現行 owner と focused check が存在する領域です。

- `semantic-strict` boot と semantic ZIP provider/repository
- 通常 attack / multi-hit / capture / damage / proc の基盤
- wave / mini-wave / surge / mini-surge / blast runtime
- status、KB、death、standard zombie revive、warp、burrow、summon、spirit
- castle guard、特殊 `EEnemy` base、basic/non-basic cat cannon runtime
- deterministic stage spawn layer、unit-death KC、trail trigger domain
- combo / orb / treasure / talent / PCoin、wallet / cost / respawn
- formation / custom stage / mobile UI
- RHG character modification v1、formation v5、custom stage v2、pack v1
- RHG 内部 storage migration と失敗可視化
- BCU sound id / stage music / SE voice pool

#20/#22/#23 は上記のstage/crown/ranking領域に具体的なdefectがあることを示すため、広い完了ラベルを個別Issueより優先しません。

## Character modification

Character modification は BCU parity 機能ではなく、通常計算後の RHG 拡張です。

```text
BCU/RHG normal final stats
-> sparse absolute override
-> derived model rebuild
-> BattleActorFactory / ProductionRuntime
```

現行の schema / owner / cache / import 境界は `RHG_CHARACTER_MODIFICATION_ARCHITECTURE_ADDENDUM_2026-07-23.md` を参照します。実装計画書は historical design です。

## Evidence / visual / compatibility boundaries

コード defect とは別に、次の境界が残ります。

- P_DELAY、burrow、spirit / A_IMUATK、SUMMON entry、death-surge、non-basic cannon、BASE_WALL 等の visual acceptance
- mobile input、safe-area、software keyboard、orientation change、BGM/SE の実機確認
- streaming asset load に伴う browser-specific timing
- BCU save / lineup import-export は対象外
- RHG JSON / `localStorage` は BCU serializer 互換ではない

詳細は blocker document と visual ledger を参照してください。

## 修正時の最低条件

- Issue の BCU source fact と current JS owner を明示する
- 回帰を再現する focused check を追加する
- multiplier修正では中間precisionと最終cast/round orderを分けて検証する
- stage runtime修正ではlegacy/adapterの二重構築とmerge precedenceを確認する
- ranking修正ではlogic-frame boundary、spawn RNG非消費、kill mode、score formulaを固定する
- 必要な adjacent check、`npm test`、`npm run build` を実行する
- Issue を閉じる変更と同じバッチで、この文書と該当 focused status を更新する

## 文書責務

文書の全体構成は `docs/README.md` を参照してください。新しい `*-current-status.md` を増やさず、既存 SSOT を更新します。
