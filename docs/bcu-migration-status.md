# BCU 移行状況

更新日: 2026-07-24  
対象: `Rainforest-2/rhg`  
確認した `main`: `d43f53ea25cc589c16d3b39a5be08913d1ea32f0`

## 結論

semantic ZIP、主要 battle runtime、character modification、RHG 内部永続化は広く実装されています。一方、2026-07-24 時点で source-backed な correctness / reliability Issue が残っています。したがって、現在の状態を「見た目確認だけが残る」「確認済み Critical 欠陥なし」とは表現しません。

この文書が project 全体の current status と open Issue 分類の一次情報源です。個別能力は `ability-logic/current-ability-parity-status.md`、証拠不足は `ability-logic/bcu-unresolved-evidence-blockers.md`、見た目結果は `ability-logic/bcu-visual-review-checklist.md` が所有します。

## 現在の open Issue

| 優先 | Issue | 分野 | 現在の欠陥 |
|---:|---:|---|---|
| P0 | #9 | Boot reliability | 必須 battle patch group の import/installer 失敗を記録しても boot を続行し、部分 semantics で戦闘を開始できる |
| P0 | #10 | Verification | `check-battle-scene-stage-runtime-wiring` が stale assertion で false-fail し、safe suite から外れている |
| P1 | #12 | Damage / Metal | Metal を対象にする unit trait と、被弾側 `AB_METALIC` を混同する |
| P1 | #13 | Damage / RNG | `AB_METALIC` fallback が critical を二重抽選し、確率と deterministic RNG 消費を変える |
| P1 | #14 | Trait compatibility | fully target-traited 判定から Demon / Relic が欠落する |
| P1 | #6 | Stage spawn RNG | CopRand で決めた spawn layer を捨て、actor 側で `Math.random()` により再抽選する |
| P1 | #7 | Stage KC | dead actor 自身の spawn row だけを減算し、BCU の global unit-death / castle HP window semantics と異なる |
| P1 | #17 | Stage parser | ranking/trail stage を通常の castle-HP percentage stage として解釈する |
| P1 | #18 | Semantic background index | castle row のない main-story stage でも `rows[1]` を header として読み、background id を誤る |
| P2 | #8 | Renderer | actor paint order が `currentLayer` を使わず、lane depth を反転できる |

Issue の詳細、BCU source、再現条件、期待動作は各 Issue 本文を一次情報源とします。この表は Issue 本文を複製せず、修正順を示すための要約です。

## 実行順

1. #9 を直し、必要な patch graph が欠けた状態で boot を成功扱いしない。
2. #10 を直して stage-runtime wiring check を安全な suite へ戻す。
3. #12 / #13 / #14 を同じ damage/trait audit として修正し、確率・RNG draw count・trait boundary を固定する。
4. #6 / #7 / #17 / #18 を stage loader/runtime/index pipeline として順に修正する。
5. #8 を `currentLayer` placement と paint order の同一契約として修正する。
6. correctness Issue を閉じた後に、未受け入れ visual 項目と performance cleanup を進める。

詳細な完了条件は `ability-logic/bcu-parity-codex-workplan.md` を参照してください。

## 現在維持する実装済み領域

以下は「今後不具合が見つからない」という意味ではなく、現行 owner と focused check が存在する領域です。

- `semantic-strict` boot と semantic ZIP provider/repository
- 通常 attack / multi-hit / capture / damage / proc の基盤
- wave / mini-wave / surge / mini-surge / blast runtime
- status、KB、death、standard zombie revive、warp、burrow、summon、spirit
- castle guard、特殊 `EEnemy` base、basic/non-basic cat cannon runtime
- combo / orb / treasure / talent / PCoin、wallet / cost / respawn
- formation / custom stage / mobile UI
- RHG character modification v1、formation v5、custom stage v2、pack v1
- RHG 内部 storage migration と失敗可視化
- BCU sound id / stage music / SE voice pool

Issue #6–#18 は上記の一部に具体的な defect があることを示すため、広い `code-complete-candidate` ラベルを個別 Issue より優先しません。

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
- deterministic RNG の draw order/count を変える場合は明示的に固定する
- parser/index 修正では実データ fixture と generated artifact の両方を確認する
- renderer 修正では logical layer、visual Y、paint order を分けて検証する
- 必要な adjacent check、`npm test`、`npm run build` を実行する
- Issue を閉じる変更と同じバッチで、この文書と該当 focused status を更新する

## 文書責務

文書の全体構成は `docs/README.md` を参照してください。新しい `*-current-status.md` を増やさず、既存 SSOT を更新します。
