# BCU 移行状況

更新日: 2026-07-24  
対象: `Rainforest-2/rhg`  
確認基準: `main` `16f0c113c29d87aa8954fef18d0910a3ff154759` + 本修正ブランチ

## 結論

semantic ZIP、主要 battle runtime、character modification、RHG 内部永続化は広く実装されています。PR #21で boot、verification、Metal/critical、trait、stage spawn/KC、trail parsing、background index、actor layer orderを修正し、PR #29でstage group、crown precision、crown propagationを修正しました。本修正ではranking overtime/score、custom-stage trail trigger domain、crown map identityの競合を解消します。

2026-07-24時点で、既知のsource-backed correctness Issue #6–#27に対するコード修正とfocused checkは揃っています。残る項目は主にvisual acceptance、実機確認、明示的out-of-scope境界です。新しい不具合が確認された場合は、この文書へactive correctness項目として再追加します。

この文書がproject全体のcurrent statusとactive correctness分類の一次情報源です。個別能力は `ability-logic/current-ability-parity-status.md`、証拠不足は `ability-logic/bcu-unresolved-evidence-blockers.md`、見た目結果は `ability-logic/bcu-visual-review-checklist.md` が所有します。

## Active correctness items

現在、既知のopen correctness itemはありません。

Issueページのstateがopen表示のままでも、mainの実装と `scripts/check-open-issue-regressions.mjs` を確認せず、修正済み項目を欠陥として再掲しません。merge後に該当Issueを明示的にcloseします。

## 2026-07-24 resolved batches

### PR #21

- #9: required battle patch groupをfail closedへ変更
- #10: stale source-string checkをbehavior-level stage-runtime checkへ置換し、main checkへ接続
- #12 / #13: enemy Metalとunit `AB_METALIC`を正しく分類し、critical RNGを一回だけ抽選
- #14: fully target-traited判定へDemon / Relicを追加
- #6: CopRand committed spawn layerをactorへ適用し、`Math.random()`再抽選を除去
- #7: player-unit deathから全KC rowをBCU health window付きで通知
- #17: trail/ranking stageのtrigger domainとbase damage windowを復元
- #18: castle row有無を共有CSV layout resolverで判定
- #8: actor paint orderを`currentLayer`優先のstable orderへ変更

### PR #29

- #19: `SCGroup.getMax(star)`と生存敵の`getWill()+1`加重数でgroup capacityを判定
- #20: row×crownのfloat倍率を最終stat境界まで保持し、HP=int cast、ATK=Math.roundで確定
- #22: selected crown/starをlegacy builderからadapterへ一度だけ伝播し、不一致をfail closed化

### 本修正ブランチ

- #23: 30fps timeLimit、strict overtime、enemy spawn停止、NORMAL kill score式、任意score-limit outcomeを `BcuRankingRuntime`へ実装
- #25: custom stage spawn/KCを標準stageと同じ `resolveBcuStageHealthWindow`へ統合し、trailを累積城ダメージ領域で判定
- #27: crown indexをpackId+mapId identityで保持し、同名・同mapIdの競合fallbackを★1へfail closed化
- CI verifyログをartifactへ常時保存し、Actionsログ切り捨て時も完全な失敗原因を取得可能にした
- ability status checkerをhistorical prose依存からcurrent SSOT row依存へ更新

## 現在維持する実装済み領域

以下は「今後不具合が見つからない」という意味ではなく、現行ownerとfocused checkが存在する領域です。

- `semantic-strict` bootとsemantic ZIP provider/repository
- 通常attack / multi-hit / capture / damage / procの基盤
- wave / mini-wave / surge / mini-surge / blast runtime
- status、KB、death、standard zombie revive、warp、burrow、summon、spirit
- castle guard、特殊 `EEnemy` base、basic/non-basic cat cannon runtime
- deterministic stage spawn layer、unit-death KC、normal/trail trigger domain
- stage group capacity、crown precision/propagation/map identity、ranking overtime/score
- combo / orb / treasure / talent / PCoin、wallet / cost / respawn
- formation / custom stage / mobile UI
- RHG character modification v1、formation v5、custom stage v2、pack v1
- RHG内部storage migrationと失敗可視化
- BCU sound id / stage music / SE voice pool

## Character modification

Character modificationはBCU parity機能ではなく、通常計算後のRHG拡張です。

```text
BCU/RHG normal final stats
-> sparse absolute override
-> derived model rebuild
-> BattleActorFactory / ProductionRuntime
```

現行のschema / owner / cache / import境界は `RHG_CHARACTER_MODIFICATION_ARCHITECTURE_ADDENDUM_2026-07-23.md` を参照します。実装計画書はhistorical designです。

## Evidence / visual / compatibility boundaries

コードdefectとは別に、次の境界が残ります。

- P_DELAY、burrow、spirit / A_IMUATK、SUMMON entry、death-surge、non-basic cannon、BASE_WALL等のvisual acceptance
- mobile input、safe-area、software keyboard、orientation change、BGM/SEの実機確認
- streaming asset loadに伴うbrowser-specific timing
- BCU save / lineup import-exportは対象外
- RHG JSON / `localStorage` はBCU serializer互換ではない

詳細はblocker documentとvisual ledgerを参照してください。

## 修正時の最低条件

- IssueのBCU source factとcurrent JS ownerを明示する
- 回帰を再現するfocused checkを追加する
- multiplier修正では中間precisionと最終cast/round orderを分けて検証する
- stage runtime修正ではlegacy/adapterの二重構築とmerge precedenceを確認する
- ranking修正ではlogic-frame boundary、spawn RNG非消費、kill mode、score formulaを固定する
- identity fallbackは競合候補を恣意的に選ばずfail closedにする
- 必要なadjacent check、`npm test`、`npm run build`を実行する
- Issueを閉じる変更と同じバッチで、この文書と該当focused statusを更新する

## 文書責務

文書の全体構成は `docs/README.md` を参照してください。新しい `*-current-status.md` を増やさず、既存SSOTを更新します。
