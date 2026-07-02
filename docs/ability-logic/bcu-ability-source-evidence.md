# BCU 能力のソース根拠

更新日: 2026-06-25

これは `RHgrive/rhg` の現行パリティ作業における、BCU ソースの事実一覧です。実際に確認できた根拠を記録するものであり、完了宣言ではありません。各行について、現在の JS オーナー監査・決定的チェック・必要に応じたブラウザレビューが継続して必要です。

## ソース優先順位

1. `references/bcu/` 配下のチェックイン済み BCU 参照 ZIP
2. 現行の rhg コードと決定的テスト
3. 生成された semantic ZIP インベントリと loader 根拠
4. 現行ソース / コードが同じ主張を確認している場合のみに、過去のレポートを使う

## 根拠一覧

| 領域 | BCU ソースオーナー / holder | 確立された挙動 | 現在の rhg 境界 |
|---|---|---|---|
| P_DELAY | `EUnit/EEnemy.processProcs`, `EUnit/EEnemy.postUpdate`, `ELineUp.delay`, `EStage.delay`, `StageBasis` | 受け入れた delay は蓄積され、プレイヤーの cooldown と敵の stage-row delay がそれぞれのオーナーに流れる。`A_E_DELAY` は proc 受理時に始まる。 | 実行時・効果・座標のチェックはあるが、ブラウザ上の見た目は未受け入れ。 |
| 地中移動 | `DataEnemy`, `Entity.startBurrow/updateBurrow/touchable/updateMove`, `StageBasis.inRange` | `ints[43]` の count、`ints[44]/4` の距離、負の KB phase による down / underground / up、phase ごとの touchability 変化。 | ライフサイクル・衝突・targetability のテストはある。見た目受け入れは未完。 |
| ゾンビ revive / soulstrike / death surge | `DataEnemy`, `DataUnit`, `Entity.ZombX`, `AttackSimple`, `AtkModelEntity` | corpse 状態、show-window targetability、zombie killer、soulstrike キャンセル、revive HP / タイミング、death-surge タイミングは entity-owned。 | 標準経路はテスト済み。追加 / カスタム revive の実データ網羅は部分的。 |
| mini death-surge | `EUnit.processAbilityOrbs`, death animation owner | holder は ORB_DEATH_SURGE であり、full と mini の death-surge は排他的。 | holder と実行時はテスト済み。ブラウザ見た目は未受け入れ。 |
| SUMMON | `Proc.SUMMON`, `AtkModelEntity.setProc/invokeLater`, `AtkModelUnit/Enemy.summon`, `Entity.setSummon`, `EntCont`, `SCDef/SCGroup` | SUMMON は proc-object / custom attack data であり、attack model が即時 / 遅延 spawn と stage allow/group 動作を管理する。 | explicit proc-object 実行時はある。通常の CSV holder は未確認で、実カスタムパックの自動読み込みは未完。 |
| 精霊 | `DataUnit.ints[110]`, `StageBasis` (spiritCooldown/spiritEmphasize/unitRespawnTime/shock loop), `LineUp`, `EUnit` | 精霊は通常の proc status ではなく、production / stage state である。once-per-frame cooldown countdown、ready emphasize cue、one-spirit-per-summoner、pre-warp summon origin、side-capacity gating、1 フレームの post-conjure `unitRespawnTime` production lock、attack-on-add、damage rejection、boss-shockwave immunity、自動除去などを持つ。 | 実行時、attack-only bundle path、cooldown / emphasize、post-conjure production lock、card-layer ready-state wiring、shockwave immunity はテスト済み。actor / A_IMUATK と conjure-card flash の見た目受け入れは残る。 |
| boss shockwave / shockwave immunity | `StageBasis` shock loop, `Entity.interrupt(INT_SW)`, `DataUnit.ints[56] -> AB_IMUSW` | boss-spawn shockwave は通常の touchable player unit を割り込むが、target が `AB_IMUSW` を持つ場合は `INT_SW` interruption を拒否する。精霊も shock loop から除外される。 | `BattleBossShockwaveRuntimePatch` で `AB_IMUSW` actor をスキップするようになった。見た目受け入れは別途。 |
| 城 / 基地ガード | `StageBasis.activeGuard`, `ECastle.damaged/guardBreak`, `Entity.postUpdate`, `EffAnim` | ガードは scene / base state で、base damage を保持し、hold / break effect を持つ。 | 実行時・チェックはある。ブラウザ受け入れは未完。 |
| 通常の城攻撃 | `ECastle` | 通常の城には attack runtime の所有者がない。boss base は `EEnemy`、stage trigger は `EStage/StageBasis` である。 | 負の根拠: castle-owned attack system を作らない。 |
| 特殊敵城 / EEnemy base | `EStage.base()`, `StageBasis`, stage header base enemy id | ステージヘッダの base enemy id に一致する敵行は通常 spawn ではなく、敵拠点そのものとして `EEnemy` owner になる。HP%、勝敗、攻撃、波動 / 烈波はその敵アクター側で処理される。 | `StageDefinitionLoader` が base enemy 行を明示し、`StageRuntime` が通常 spawn から除外、`BattleSceneBcuEnemyEntityBasePatch` が初期配置する。`check-bcu-enemy-entity-base-runtime` が `stageRN036_05` raw enemy 317 を固定。 |
| 基本 / 非基本キャノン | `Cannon`, `StageBasis`, `Treasure`, `CannonLevelCurve`, `Data` | キャノンは独自の owner を持ち、id ごとの timing / geometry / targeting / level curve を持つ。`BASE_WALL` は entity lifecycle である。 | 実行時オーナーとチェックはある。キャノンごとの bitmap alias と見た目の厳密性は未完。 |
| combo / orb / treasure / talent / PCoin | `BasisLU`, `LineUp`, `Treasure`, `EUnit/EEnemy`, `PCoin`, attack construction, `ELineUp` | modifier は basis / lineup / entity construction の根本から発生し、stats / damage / proc payload / resistance / traits / price / cooldown に影響する。`EUnit.getAbi()` は active combo increment が正のとき `C_VKILL` から `AB_VKILL` を付与する。BCU の deploy cost は `DataUnit.price` から始まり、`Form/EForm.getPrice(sta)` で `price * (1 + sta * 0.5)` が適用される。通常の `StageMap.price=1` により、通常の deploy cost は内部 `ELineUp.price = 100 * ...` の前に 1.5 倍になる。`PCoin.improve` は `PC2_COST` を `price -= value`、`PC2_CD` を `respawn -= value` として適用し、`ELineUp` が `C_DISCOUNT` と `Treasure.getFinRes(respawn, C_RESP)` を使って production cooldown を調整する。最大 `LV_RES=30/T_RES=300` により、Tank Cat のような short-respawn unit は 60F の下限になる。 | コア hook はある。実データ sweep で combo / orb / treasure / talent / PCoin の経路、`C_VKILL` を damage resolver まで届かせる経路、production cost / cooldown の ELineUp ルートが確認されている。見た目受け入れは別途。 |
| `Trait.targetForms` | `Entity.traitCompatible`, `EEnemy.getDamage` | 互換性は通常の shared trait に加え、target type / form metadata に依存する。 | 実行時フィクスチャはある。実カスタム trait / form と capture / proc の網羅は未完。 |
| 毒撃耐性 | `DataUnit`, `DataEnemy`, `Entity.damaged` | ユニット側の直接 `IMUPOIATK` holder は存在する。確認した通常敵データには toxic attack はあるが、敵側の toxic-immunity holder はない。 | 敵側 CSV の toxic-immunity パースは追加しない。 |
| bounty / money visual | `Entity.damaged`, `EEnemy.kill`, `EUnit.postUpdate`, effect inventory | bounty は kill / economy state である。専用の battle visual owner や安定した alias は未確認。 | 将来のソース根拠が出るまで、logic-only とする。 |
| 特殊 castle boss spawn | `CastleImg`, `CommonStatic.bossSpawnPoint`, `StageBasis` | 特殊 castle データが boss / base の spawn coordinate を決める。 | formula / bundle / runtime bridge は実装済みでテスト済み。 |
| セーブ / 陣形互換 | この監査範囲では BCU のシリアライズ owner が未確認 | BCU の schema / import / export / round-trip 主張はまだできない。 | rhg はリポジトリ内のブラウザ永続化を使う。BCU 互換は unconfirmed と扱う。 |

## 監査修正メモ

2026-06-23 の監査では、StageDefinitionLoader に関する旧 README 主張が古いことが確認された。実装前に、現在のソース根拠と現行コードを合わせて確認する必要がある。

- 過去のソース事実は有効な場合がある
- rhg の実装状態についての過去の記述は、そのまま有効ではない
- 実行時が実装済みでも、実データ読み込みが未完なら「missing runtime」とは扱わない

## 実装前に使う手順

新しい変更ごとに、次を記録する。

```text
BCU file/class/method -> field or state transition -> current JS owner -> test/fixture -> remaining visual or loader boundary
```

ソース根拠が不足している場合は `unconfirmed` または `negative-evidence` と書き、見慣れた名前から holder / asset alias / persistence format を推定しない。
