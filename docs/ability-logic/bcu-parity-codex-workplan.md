# BCU パリティ作業計画

更新日: 2026-07-24  
基準 `main`: `d43f53ea25cc589c16d3b39a5be08913d1ea32f0`

この文書は active open Issue の実行順と完了条件だけを管理します。status は `../bcu-migration-status.md`、source/evidence blocker は `bcu-unresolved-evidence-blockers.md`、visual result は `bcu-visual-review-checklist.md` を参照してください。

## 共通完了条件

各 Issue で次を満たします。

1. BCU file/class/method/field/state transition を Issue または test に固定する。
2. 現行 JS owner と boot reachability を確認する。
3. 不具合を再現する regression check を先に追加または同時追加する。
4. 変更を最小 owner に限定し、wrapper/import order を壊さない。
5. focused check、adjacent check、`npm test`、`npm run build` を実行する。
6. Issue を閉じる変更と同じバッチで current docs を更新する。

## P0 — Runtime integrity

### #9 Required patch groups must fail closed

- required/optional group を明示する。
- required import/installer failure は boot を中断し、部分 semantics の battle を開始しない。
- error diagnostics は保持するが、success path と混同しない。
- boot failure と optional degradation の回帰 check を追加する。

### #10 Restore stage-runtime wiring verification

- stale source-string assertion を現在の logical-X interpolation / projection contract に置換する。
- behavior-oriented assertion を優先し、formatting や exact source text へ過度に依存しない。
- check を safe suite へ戻し、#6/#7/#17 の修正を継続的に gate できるようにする。

## P1 — Damage and trait semantics

### #12 Metal target vs `AB_METALIC`

- target trait と defender ability を別 field/semantic にする。
- ordinary Metal-targeting cat への incoming damage cap / Metal Killer 適用を禁止する。
- enemy Metal trait、unit `AB_METALIC`、target Metal の全組合せを test matrix にする。

### #13 Critical draw count

- critical probability は一度だけ抽選する。
- `AB_METALIC` fallback は既存の抽選結果を再利用し、追加 RNG draw を消す。
- success/failure 両経路で deterministic RNG draw count を固定する。

### #14 Fully target-traited definition

- BCU と同じ trait set: red/floating/black/angel/alien/zombie/demon/relic。Metal は除外する。
- `targetType/targetForms` の positive/negative cases を実データ fixture で固定する。

## P1 — Stage and semantic asset pipeline

### #6 Spawn layer ownership

- `BcuStageSpawnRuntime.commitSpawn()` の CopRand-derived `currentLayer` を生成 actor へ一度だけ適用する。
- `Math.random()` の再抽選を削除する。
- row respawn / layer / global respawn の RNG draw order を固定する。

### #7 KC unit-death semantics

- actor 自身の row index ではなく、BCU の global death notification として全対象 counter を評価する。
- castle HP window と対象条件を death 時に確認する。
- one death が複数 row counter に影響する fixture を追加する。

### #17 Ranking / trail stage

- stage header の time-limit/trail semantics を parser と runtime に伝播する。
- trail stage の accumulated-damage threshold を normal HP percentage rewrite へ通さない。
- 極ランキングの間など実データ fixture で magnification、spawn trigger、score/timer boundary を固定する。

### #18 Background index header selection

- castle row の有無を runtime parser と同じ shape rule で判定する。
- main-story `type != 0` は `rows[0]`、castle row ありは正しい header row を読む。
- generated background index/bundle と runtime load を実 stage fixture で確認する。

## P2 — Renderer layer order

### #8 `currentLayer` paint order

- actor vertical placement と paint sort の layer source を一致させる。
- same-layer tie-break は deterministic に保つ。
- visual crowd offset を BCU layer order の代替にしない。
- overlapping actors の deterministic draw-order check と browser fixture を追加する。

## Correctness 後の queue

- visual acceptance: P_DELAY、burrow、spirit、SUMMON、death-surge、non-basic cannon、BASE_WALL、effect layers
- physical-device acceptance: mobile keyboard/safe-area/orientation/touch/audio
- performance cleanup: debug allocation、重複 wrapper、renderer hot path。correctness owner/check を先に固定する

## Historical work items

旧 W1–W3（SUMMON loader、storage failure visibility、modifier/trait fixture）は source-loading task としては完了済みです。旧 W7 の同フレーム攻撃監査は active work から外れています。解決済み項目を active roadmap に残しません。
