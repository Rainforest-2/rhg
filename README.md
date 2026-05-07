# ZIP実コード読解版：BCU common と現コードの戦闘・ステージ・描画・ロジック差分完全分析

本レポートは、指定された2つのZIPを展開し、ZIP内の実ファイル本文を読んだ結果だけに基づく。対象は以下の2系統である。

- 現コードZIP: `/mnt/data/game-main.zip`
- BCU common ZIP: `/mnt/data/BCU_java_util_common-ef840238e4700eb4b8eb57b4446633e465f4edd5.zip`

本文中の「現コード」は `game-main` の JavaScript / browser app 実装、「BCU common」は `BCU_java_util_common-ef840238e4700eb4b8eb57b4446633e465f4edd5` の Java 実装を指す。

---

## 第0章：ZIP開封確認

### 0.1 ZIP確認結果

| repo | ZIPファイル名 | ZIP絶対パス | path存在確認 | 展開後root directory名 | ZIP内エントリ数 | 展開後ファイル数 |
|---|---|---:|---|---|---:|---:|
| 現コードZIP | `game-main.zip` | `/mnt/data/game-main.zip` | 存在 | `game-main` | 56,512 | 47,494 |
| BCU common ZIP | `BCU_java_util_common-ef840238e4700eb4b8eb57b4446633e465f4edd5.zip` | `/mnt/data/BCU_java_util_common-ef840238e4700eb4b8eb57b4446633e465f4edd5.zip` | 存在 | `BCU_java_util_common-ef840238e4700eb4b8eb57b4446633e465f4edd5` | 221 | 200 |

### 0.2 root直下のファイル・フォルダ一覧

#### 現コードZIP root: `game-main/`

- `.github/`
- `README.md`
- `css/`
- `docs/`
- `index.html`
- `js/`
- `public/`
- `scripts/`
- `tools/`

#### BCU common ZIP root: `BCU_java_util_common-ef840238e4700eb4b8eb57b4446633e465f4edd5/`

- `.gitignore`
- `CommonStatic.java`
- `README.md`
- `battle/`
- `io/`
- `pack/`
- `system/`
- `util/`

### 0.3 主要ファイル・ディレクトリの有無

| 対象 | 現コードZIP | BCU common ZIP | 判定 |
|---|---:|---:|---|
| `package.json` | なし | なし | 現コードはnpm package形式ではなく、`index.html` 起点のbrowser app構成。 |
| `build.gradle` | なし | なし | BCU common ZIPはbuild fileなしのJava source snapshot。 |
| `pom.xml` | なし | なし | Maven構成ではない。 |
| `README.md` | あり | あり | 両方あり。 |
| `src/` | なし | なし | BCU commonはroot直下にJava package directoryを持つ。 |
| `js/` | あり | なし | 現コードの主実装。 |
| `public/` | あり | なし | 現コードのasset配置。 |
| `public/assets/bcu/` | あり | なし | 現コードがBCU資産を同梱している根拠。 |
| `assets/` | なし | なし | BCU commonは資産配布repoではなくcommon Java code。 |
| `battle/` | なし | あり | BCU common内の戦闘runtime package。 |
| `util/stage/` | なし | あり | BCU stage parser/model package。 |
| `util/unit/` | なし | あり | BCU unit/enemy model package。 |
| `util/anim/` | なし | あり | BCU animation parser/runtime package。 |

### 0.4 現コードZIPだと判断した根拠

`game-main/` は root に `index.html`、`js/`、`css/`、`public/assets/bcu/` を持つ。`js/battle/`、`js/bcu/`、`js/preview/`、`js/ui/`、`js/data/` が存在し、戦闘・BCU資産・preview UI・UI・data manifestが同一browser appとして構成されている。`public/assets/bcu/` には多数の番号付き資産directoryと `.csv`、`.imgcut`、`.mamodel`、`.maanim`、`.png` が入っており、現コードがBCU資産を直接読んで描画・戦闘previewする実装であると判断できる。

### 0.5 BCU common ZIPだと判断した根拠

`BCU_java_util_common-ef840238e4700eb4b8eb57b4446633e465f4edd5/` は root に `CommonStatic.java`、`battle/`、`io/`、`pack/`、`system/`、`util/` を持つ。`util/stage/Stage.java`、`util/stage/SCDef.java`、`util/stage/EStage.java`、`util/unit/Enemy.java`、`util/unit/Unit.java`、`util/anim/ImgCut.java`、`util/anim/MaModel.java`、`util/anim/MaAnim.java`、`battle/StageBasis.java`、`battle/entity/Entity.java`、`battle/attack/AttackSimple.java`、`battle/data/DataUnit.java`、`battle/data/DataEnemy.java` が存在するため、BCUの共通Javaロジックrepoである。

### 0.6 調査対象にした主要拡張子

| repo | 拡張子 | ファイル数 | 用途 |
|---|---:|---:|---|
| 現コードZIP | `.js` | 97 | 戦闘runtime、BCU parser、preview、UI、data loader。 |
| 現コードZIP | `.json` | 471 | asset metadata、manifest、info。 |
| 現コードZIP | `.csv` | 10,620 | stage / unit / enemy / backgroundなどのBCU由来data。 |
| 現コードZIP | `.txt` | 129 | asset notes / data。 |
| 現コードZIP | `.md` | 3 | README / docs。 |
| 現コードZIP | `.imgcut` | 3,642 | BCU sprite cut data。 |
| 現コードZIP | `.mamodel` | 3,630 | BCU model part data。 |
| 現コードZIP | `.maanim` | 14,012 | BCU animation tracks。 |
| 現コードZIP | `.png` | 14,841 | sprite / background / castle / effect image。 |
| 現コードZIP | `.properties` | 21 | resource properties。 |
| BCU common ZIP | `.java` | 189 | BCU common実装本体。 |
| BCU common ZIP | `.json` | 8 | data / config fragment。 |
| BCU common ZIP | `.kt` | 1 | Kotlin補助source。 |
| BCU common ZIP | `.md` | 1 | README。 |

---

## 第1章：ファイルツリー索引

### 1.1 現コードZIP：戦闘・ステージ・描画・BCU資産関連ファイル

#### 1.1.1 必須ディレクトリ確認

| path | 存在 | 読解状況 | 備考 |
|---|---:|---|---|
| `js/battle/` | あり | 対象JS本文を読解 | 戦闘runtime、stage parser、camera、renderer、stats、attack、effect。 |
| `js/bcu/` | あり | 対象JS本文を読解 | BCU imgcut/model/anim asset parserとrenderer model。 |
| `js/preview/` | あり | 対象JS本文を読解 | clock / camera input / preview app。 |
| `js/ui/` | あり | 対象JS本文を読解 | production bar、formation editor等。 |
| `js/data/` | あり | 対象JS本文を読解 | preview assets、available enemy manifest、stage manifest。 |
| `public/assets/bcu/` | あり | treeと主要path確認 | 番号付きasset pack directory。 |
| `package.json` | なし | 第16章に記載 | rootに存在しない。 |
| `index.html` | あり | 存在確認 | browser app entry。 |
| `README.md` | あり | 存在確認 | repo説明。 |

#### 1.1.2 現コードZIPで本文を読んだ主要ファイル

| repo | path | 種別 | 役割 | 今回読んだか | 読んだ範囲 | 後続章 |
|---|---|---|---|---|---|---|
| 現コード | `js/battle/StageDefinitionLoader.js` | JS class | stage CSV parser / StageDefinition生成 | 読んだ | 全43行 | 2,4,5,13,14,15 |
| 現コード | `js/battle/BcuStageSpawnRuntime.js` | JS class | CSV enemyRowsの出現runtime | 読んだ | 全57行 | 2,4,6,8,13,14,15 |
| 現コード | `js/battle/BcuStageEnemyResolver.js` | JS module | enemyId→asset/unitDef解決 | 読んだ | 全57行 | 2,4,6,9 |
| 現コード | `js/battle/StageSpawnPreviewBuilder.js` | JS class | spawn preview構築 | 読んだ | 全114行 | 2,5,6 |
| 現コード | `js/battle/BattleScene.js` | JS class | battle orchestration / tick / spawn / combat | 読んだ | 全148行 | 2,4,6,7,8,9,10,12,13,14,15 |
| 現コード | `js/battle/BattleConfig.js` | JS const | stage/tuning/actor/economy defaults | 読んだ | 全36行 | 2,4,6,7,13 |
| 現コード | `js/battle/BattleBase.js` | JS class | player/enemy base runtime | 読んだ | 全46行 | 2,7,10 |
| 現コード | `js/battle/BattleCamera.js` | JS class | world/screen transform、zoom、clamp | 読んだ | 全31行 | 2,7,8,13 |
| 現コード | `js/battle/BattleSceneRenderer.js` | JS class/module | background/base/actor/effect描画 | 読んだ | 全259行 | 2,7,10,11,13 |
| 現コード | `js/battle/StageBackgroundLoader.js` | JS class | background csv/imgcut/image loading | 読んだ | 全63行 | 2,7,11 |
| 現コード | `js/battle/BcuCastleAssetLoader.js` | JS class | castle asset candidate resolver | 読んだ | 全76行 | 2,7,10 |
| 現コード | `js/battle/BattleBodyResolver.js` | JS class | combat body / distance / touch | 読んだ | 全240行 | 2,7,8,9 |
| 現コード | `js/battle/BattleStatsLoader.js` | JS class | unit/enemy stats CSV loader | 読んだ | 全83行 | 2,9,12 |
| 現コード | `js/battle/BcuStatsSchema.js` | JS const/functions | unit/enemy CSV index schema | 読んだ | 全84行 | 2,9,12 |
| 現コード | `js/battle/BattleActorFactory.js` | JS class | asset/stats preload, actor生成 | 読んだ | 全54行 | 2,9,11 |
| 現コード | `js/battle/BattleActor.js` | JS class | actor state, attack, KB, damage lifecycle | 読んだ | 全431行 | 2,8,9,10,11 |
| 現コード | `js/battle/BattleAttackProfile.js` | JS module | attack hit timeline生成 | 読んだ | 全35行 | 2,9,15 |
| 現コード | `js/battle/BattleAttackResolver.js` | JS class | target capture / range 判定 | 読んだ | 全38行 | 2,8,9 |
| 現コード | `js/battle/BattleEffect.js` | JS class | simple effect runtime | 読んだ | 全4行 | 10 |
| 現コード | `js/battle/BattleEffectLoader.js` | JS class | simple effect asset loader | 読んだ | 全24行 | 10 |
| 現コード | `js/battle/BcuKbeffLoader.js` | JS class | kbeff asset loader | 読んだ | 全60行 | 10 |
| 現コード | `js/battle/BattleEconomy.js` | JS class | money / cooldown | 読んだ | 全17行 | 12 |
| 現コード | `js/preview/BattleSimulationClock.js` | JS class | fixed-ish preview clock | 読んだ | 全30行 | 8 |
| 現コード | `js/preview/BattleCameraInputController.js` | JS class | wheel/pinch/pan controller | 読んだ | 全12行 | 7 |
| 現コード | `js/ui/PlayerProductionBar.js` | JS class | production UI | 読んだ | 全33行 | 12 |
| 現コード | `js/ui/FormationEditor.js` | JS class | formation UI | 読んだ | 全11行 | 12 |
| 現コード | `js/data/previewAssets.js` | JS data | preview asset definitions | 読んだ | 全19行 | 11 |
| 現コード | `js/bcu/BcuAssetLoader.js` | JS class | image/imgcut/model/anim load | 読んだ | 全119行 | 11 |
| 現コード | `js/bcu/BcuSpriteSheet.js` | JS class | imgcut crop abstraction | 読んだ | 全3行 | 11 |
| 現コード | `js/bcu/BcuModelInstance.js` | JS class | model transform / draw list | 読んだ | 全55行 | 11 |
| 現コード | `js/bcu/BcuAnimator.js` | JS class | maanim frame player | 読んだ | 全7行 | 11 |

### 1.2 BCU common ZIP：戦闘・ステージ・描画・BCU資産関連ファイル

#### 1.2.1 必須ディレクトリ確認

| path | 存在 | 読解状況 | 備考 |
|---|---:|---|---|
| `battle/` | あり | 全ファイル一覧確認、主要本文読解 | battle runtime、entity、attack、data。 |
| `common/` | なし | 第16章に記載 | root package名は `common` だがdirectory `common/` は存在しない。 |
| `io/` | あり | tree確認 | zip/file IO等。 |
| `jogl/` | なし | 第16章に記載 | common ZIPにJOGL layerはない。 |
| `pack/` | あり | tree確認 | pack interface。 |
| `system/` | あり | tree確認 | system/common support。 |
| `util/` | あり | 主要本文読解 | stage/unit/anim/pack/lang等。 |
| `util/stage/` | あり | 主要本文読解 | Stage parser/model。 |
| `util/unit/` | あり | 主要本文読解 | Unit/Enemy/Form等。 |
| `util/anim/` | あり | 主要本文読解 | ImgCut/MaModel/MaAnim/EAnim。 |
| `util/pack/` | あり | 主要本文読解 | Background/NyCastle/EffAnim。 |
| `util/lang/` | あり | tree確認 | language data。 |

#### 1.2.2 BCU common ZIPで本文を読んだ主要ファイル

| repo | path | 種別 | 役割 | 今回読んだか | 読んだ範囲 | 後続章 |
|---|---|---|---|---|---|---|
| BCU common | `util/stage/Stage.java` | Java class | stage CSV parser / stage model | 読んだ | 全388行、特に135-265 | 3,4,5,7,13 |
| BCU common | `util/stage/SCDef.java` | Java class | spawn line schema / allow check | 読んだ | 全252行、特に28-72,195-199 | 3,5,6 |
| BCU common | `util/stage/EStage.java` | Java class | stage spawn runtime | 読んだ | 全188行、特に48-160 | 3,4,6,8 |
| BCU common | `util/stage/StageMap.java` | Java class | map/stage container | 読んだ | 全197行 | 3,5 |
| BCU common | `util/stage/MapColc.java` | Java class | map collection / read | 読んだ | 全1667行、主要path確認 | 3 |
| BCU common | `util/stage/CastleImg.java` | Java class | castle image metadata | 読んだ | 全124行 | 7 |
| BCU common | `util/stage/info/StageInfo.java` | Java class | stage info abstraction | 読んだ | 全36行 | 3,5 |
| BCU common | `util/stage/info/DefStageInfo.java` | Java class | default stage info/reward | 読んだ | 全219行 | 3,5 |
| BCU common | `util/unit/Enemy.java` | Java class | enemy data holder | 読んだ | 全255行 | 3,9 |
| BCU common | `util/unit/Unit.java` | Java class | unit data holder | 読んだ | 全240行 | 3,12 |
| BCU common | `util/unit/Form.java` | Java class | unit form / anim / price refs | 読んだ | 全332行 | 3,12 |
| BCU common | `util/unit/AbEnemy.java` | Java class | enemy abstraction/entity creation | 読んだ | 全30行 | 3,6 |
| BCU common | `battle/StageBasis.java` | Java class | battle runtime core / update order / economy | 読んだ | 全1270行、特に115-210,680-920 | 3,4,6,7,8,12,13 |
| BCU common | `battle/entity/Entity.java` | Java class | actor runtime / attack / damage / proc / KB | 読んだ | 全2748行、主要method範囲 | 3,8,9,10,13 |
| BCU common | `battle/entity/EEnemy.java` | Java class | enemy entity | 読んだ | 全256行 | 3,6,9 |
| BCU common | `battle/entity/EUnit.java` | Java class | player unit entity | 読んだ | 全565行 | 3,12 |
| BCU common | `battle/entity/ECastle.java` | Java class | base/castle entity | 読んだ | 全159行 | 7,10 |
| BCU common | `battle/attack/AttackAb.java` | Java class | attack base / proc bridge | 読んだ | 全227行 | 8,9 |
| BCU common | `battle/attack/AttackSimple.java` | Java class | normal/LD/omni hit capture/excuse | 読んだ | 全253行、特に51-160 | 8,9 |
| BCU common | `battle/attack/AttackWave.java` | Java class | wave attack runtime | 読んだ | 全93行 | 9,10 |
| BCU common | `battle/attack/AttackVolcano.java` | Java class | surge runtime | 読んだ | 全74行 | 9,10 |
| BCU common | `battle/attack/AtkModelEntity.java` | Java class | attack model / range / proc mapping | 読んだ | 全313行、特に153-260 | 9 |
| BCU common | `battle/data/DataUnit.java` | Java class | unit CSV stat parser | 読んだ | 全290行、特に23-110 | 3,9,12 |
| BCU common | `battle/data/DataEnemy.java` | Java class | enemy CSV stat parser | 読んだ | 全256行、特に23-120 | 3,9 |
| BCU common | `battle/data/DataEntity.java` | Java class | shared entity stats | 読んだ | 全93行 | 9 |
| BCU common | `battle/data/DataAtk.java` | Java class | attack segment model | 読んだ | 全61行 | 9 |
| BCU common | `util/anim/ImgCut.java` | Java class | imgcut parser | 読んだ | 全140行 | 3,11 |
| BCU common | `util/anim/MaModel.java` | Java class | mamodel parser/runtime source | 読んだ | 全233行 | 3,11 |
| BCU common | `util/anim/MaAnim.java` | Java class | maanim parser/runtime | 読んだ | 全175行 | 3,11 |
| BCU common | `util/anim/Part.java` | Java class | maanim track interpolation | 読んだ | 全223行 | 11 |
| BCU common | `util/anim/EPart.java` | Java class | part transform/draw | 読んだ | 全428行 | 11 |
| BCU common | `util/anim/EAnimD.java` | Java class | animation instance runtime | 読んだ | 全138行 | 11 |
| BCU common | `util/pack/Background.java` | Java class | background asset/render model | 読んだ | 全454行、特にread/draw/load | 7,11 |
| BCU common | `util/pack/NyCastle.java` | Java class | player castle animation asset | 読んだ | 全110行 | 7,11 |
| BCU common | `util/pack/EffAnim.java` | Java class | effect animation registry | 読んだ | 全763行、主要field確認 | 10 |
| BCU common | `util/pack/bgeffect/BackgroundEffect.java` | Java class | background effect base | 読んだ | 全174行 | 7,11 |

### 1.3 BCU common ZIPで指定検索語を当てた結果の要約

検索語群 `class Stage`, `class StageInfo`, `class SEnemy`, `class Enemy`, `class Unit`, `class Anim`, `class EAnim`, `class MaAnim`, `class MaModel`, `class ImgCut`, `battle`, `update`, `tick`, `frame`, `spawn`, `enemy`, `base`, `castle`, `background`, `attack`, `damage`, `proc`, `ability`, `trait`, `knockback`, `kb`, `death`, `effect`, `target`, `range`, `wave`, `surge`, `freeze`, `slow`, `weaken`, `warp`, `curse`, `barrier`, `shield`, `zombie`, `revive` は、主に以下に集約された。

- stage parser / model: `util/stage/Stage.java`, `SCDef.java`, `EStage.java`, `StageMap.java`, `MapColc.java`
- unit/enemy/stats/procs: `battle/data/DataUnit.java`, `DataEnemy.java`, `DataEntity.java`, `util/unit/Unit.java`, `Enemy.java`, `Form.java`, `AbEnemy.java`
- animation: `util/anim/ImgCut.java`, `MaModel.java`, `MaAnim.java`, `Part.java`, `EPart.java`, `EAnimD.java`
- battle update / spawn / economy: `battle/StageBasis.java`, `battle/ELineUp.java`, `battle/entity/*`
- attack/damage/proc: `battle/entity/Entity.java`, `battle/attack/AttackAb.java`, `AttackSimple.java`, `AttackWave.java`, `AttackVolcano.java`, `AtkModelEntity.java`
- background/castle/effect: `util/pack/Background.java`, `NyCastle.java`, `EffAnim.java`, `util/pack/bgeffect/*`

---

## 第2章：現コードZIPの実コード分析

### 2.1 `js/battle/StageDefinitionLoader.js`

- export/import: `export class StageDefinitionLoader`; `import { formatBcuId } from './BcuStageEnemyResolver.js'`。
- 主要class: `StageDefinitionLoader`。
- 主要method: `constructor`, `parse`, `createFallback`, `load`。
- 状態: `log`のみ。
- BCU資産接点: `formatBcuId`でenemy idのasset idを作る。
- stage data接点: `stageConfig.stageCsvPath` をfetchしてCSVをparseする。
- actor/renderer/camera接点: directにはないが、返した`runtime`と`enemyRows`が `BattleScene`、`BcuStageSpawnRuntime`、`BcuStageEnemyResolver` に流れる。

#### 読解結果

`parse(text,path)` はCSVからnumeric rowsを作り、`rows[0]`をcastle row、`rows[1]`をmeta row、`rows.slice(2)`をenemy rowとして扱う。enemy rowではBCU同様に以下を行っている。

- `enemyId = rawEnemyId - 2`
- `firstFrame = raw[2] * 2`
- `respawnMinFrame = raw[3] * 2`
- `respawnMaxFrame = raw[4] * 2`
- `baseHpTrigger = raw[5] ?? 100`
- `magnification = raw[9] ?? 100`
- `baseHpTrigger > 100 && magnification === 100` のとき倍率と城HP triggerを入れ替える
- `raw[12] === 1` のときfirstFrameを負値化する
- `raw[13]` をkillCountとして読む
- 行順を `mapped.slice().reverse()` で反転する

BCU commonの `Stage.java` と一致している点は、enemy idの `-2` 補正、spawn/respawn frameの `*2`、baseHpTriggerとmagnificationの入れ替え、row order reverse、enemy base rowのcastle triggerを0にする点である。

#### 問題点

1. **`rowIndex` が設定されていない。** 返却rowには `csvRowIndex`、`originalCsvOrderIndex`、`runtimeOrderIndex` はあるが、`BcuStageSpawnRuntime.js` は `r.rowIndex` を使う。現状では全rowの `rowIndex` が `undefined` になり、`stageEnemyUnitDefs` との対応が崩れる。
2. **row0 col1を `cannonId` として扱っている。** BCU common `Stage.java` では通常stageのrow0 col1は `non_con` であり、cannon idではない。現コードの `cannonId: castleRow[1]` は意味がずれている可能性が高い。
3. **BCUのcastle fallbackを未実装。** BCUでは `cas == -1` のとき `CH_CASTLES[id.id]` を使い、`StageMap.cast` がある場合は `sm.cast * 1000 + cas` する。現コードは `castleId = castleRow[0]` のみ。
4. **bossGuardのrowが違う。** BCU commonはmeta rowの `strs[8]` を `bossGuard` にする。現コードは `castleRow[8]` を `bossGuard` にしている。
5. **`castle_1`, `spawn_1`, `group`, `score`, `mult_atk` のSCDef的意味が不完全。** `mult_atk` と `score` は読んでいるが、BCUの `SCDef.Line` としての完全な状態遷移には繋がっていない。
6. **runtime値とparser値が混在。** parserが `enemyBaseWorldX=800`、`playerBaseWorldX=stageLen-800`、`enemySpawnWorldX=700`、`playerSpawnWorldX=stageLen-700` まで作る。BCU寄せでは、CSV parserは純data、座標はStageRuntimeへ分離するべき。

#### 修正対象

- `StageDefinitionLoader.js`: `rowIndex`追加、row0/row1列意味修正、`SCDef.Line`相当の内部形式追加、parser純化。
- `BcuStageSpawnRuntime.js`: `rowIndex`依存を `runtimeOrderIndex` fallback付きにするか、StageDefinitionで必ず `rowIndex` を保証する。
- `BattleScene.js`: parserが出した座標をそのまま authoritative にしない。`StageRuntime`で計算する。

### 2.2 `js/battle/BcuStageSpawnRuntime.js`

- export/import: `export class BcuStageSpawnRuntime`; importなし。
- 主要class: `BcuStageSpawnRuntime`。
- constructor状態: `rows`、`disabledRows`。
- public method: `markRowDisabled`, `getStates`, `tick`。
- 呼び出し元: `BattleScene.init`で生成、`BattleScene.tick`で呼ぶ。
- 呼び出し先: 外部なし。spawn eventを返すだけ。

#### 読解結果

constructorは `stageEnemyUnitDefs.map((u) => [u.stageSpawn?.rowIndex, u])` でMapを作り、`stageRuntime.enemyRows` の `r.rowIndex` でunitDefを引く。各row stateは `nextAtMs`、`countRemaining`、`lastSpawnMs`、`disabled` を持つ。`tick(timeMs, context)` は、alive count、maxEnemyCount、baseHpTriggerPercent、respawn random、count remainingを見てspawn eventを返す。

#### BCUとの差分

BCU commonの `EStage.assign/update/allow` はframe countdown方式である。`rem[i]` にfirst spawn frameを入れ、health triggerに入った負値を正値化し、毎frame `rem--` し、`rem <= 1 && rem >= 0` でspawn可能にする。respawnもframe rangeでrandomし、`rem++` する。現コードはms absolute time方式であり、BCUの `rem` と `StageBasis.respawnTime` の二重gateがない。

#### 問題点

- `rowIndex`不整合によりunitDef mappingが壊れ得る。
- `enemyBaseHpPercent` をBattleSceneが常に100で渡しているため、`baseHpTrigger`が正しく動かない。
- `count=0`をInfinityにするのは方向性として正しいが、BCUの `num == -1` 終了状態とは表現が違う。
- `maxEnemyCount` は単純なalive enemy countで、BCUの `entityCount(1)` + enemy `will` weightとは違う。
- kill count trigger、line delay、group sublimit、stage min/max spawn gate、boss shock stateがない。

### 2.3 `js/battle/BcuStageEnemyResolver.js`

- export: `formatBcuId`, `getStageEnemySlotId`, `buildBcuEnemyAssetDef`, `buildStageEnemyUnitDef`。
- 役割: stage enemy rowからactorFactory用unitDefを作る。
- BCU資産接点: `./public/assets/bcu/000002/org/enemy/${id}/` の `enemy_icon_`, `enemy_`, `.imgcut`, `.mamodel`, `.maanim00..03`。
- stats接点: `statsType: 'enemy'`, `statsId: row.enemyId`。

#### 問題点

- row倍率 `magnification` と `mult_atk` は `stageSpawn` に残すだけで、statsに適用しない。
- BCU common `EStage.allow` は `multi` と `mulatk` を計算して `AbEnemy.getEntity(...)` に渡す。現コードではspawn時にActorへ倍率適用する層が必要。
- unavailable assetのdisabled row化はあるが、BCUのenemy dataが存在してassetがない場合のfallback actor / debug仕様は整理が必要。

### 2.4 `js/battle/StageSpawnPreviewBuilder.js`

- 役割: stage definitionからpreview summary/timelineを作る。
- 読解範囲: 全114行。
- BCUとの差分: previewがruntimeと同じ `EnemySpawnRuntime` state machineを使わず、独自summary計算になる可能性がある。
- 修正方針: `EnemySpawnRuntime` をread-only/dry-run modeで動かしてpreviewを作る。preview専用の補正を入れない。

### 2.5 `js/battle/BattleScene.js` 詳細

- export/import: 多数のbattle/bcu/ui/data classをimportし、`export class BattleScene`。
- 主要class: `BattleScene`。
- 主状態: `bgLoader`, `stageDefinitionLoader`, `actorFactory`, `battleState`, `timeMs`, `actors`, `bases`, `effects`, `economy`, `stage`, `camera`, `stageSpawnRuntime`, `playerProductionRoster`, `stageEnemyUnitDefs`。
- 主要method: `constructor`, `init`, `loadBase`, `buildStageRuntime`, `applyStageDefinitionToRuntime`, `tick`, `spawnActor`, `spawnStageEnemy`, `getSpawnWorldX`, `requestPlayerSpawn`, `findTargetForActor`, `canAttack`, `startActorAttack`, `tickKnockback`, `cleanupDead`, `tickEffects`, `getStatsSourceReport`。

#### 2.5.1 constructor

constructorはロガーとoptionsを取り、loader/factory/economy/scene stateをまとめて作る。`resolveSelectedStage` で `selectedStage` を `this.stage` に入れるが、後続 `init` では `this.stageDefinitionLoader.load(BATTLE_CONFIG.stage)` と `this.bgLoader.load(BATTLE_CONFIG.stage)` を呼ぶため、selected stageの値が `BATTLE_CONFIG.stage` に反映されていない場合はstage selectionとload targetがずれる。

#### 2.5.2 initの処理順

現コード `BattleScene.init` の実処理順は以下である。

1. actors/bases/effects/time/state/economy/spawnRuntimeをreset。
2. player production rosterをbuild。
3. selected stageを再resolveして `this.stage` に入れる。
4. `StageDefinitionLoader.load(BATTLE_CONFIG.stage)` でstage definitionを読む。
5. production rosterのstats preloadを開始。
6. `StageBackgroundLoader.load(BATTLE_CONFIG.stage)` で背景を読む。
7. `StageSpawnPreviewBuilder` でspawn previewを作る。
8. `buildStageRuntime()` でplain runtime objectを作る。
9. `buildStageEnemyUnitDefs()` でenemy unitDefsを作り、`BcuStageSpawnRuntime`を作る。
10. `BattleCamera({ stageLen: runtime.stageLen })` を作り、player baseにfocusする。
11. stats preload完了後、production statsをtemplateから反映。
12. critical templatesをpreload。
13. `loadBase`でenemy/player baseをloadする。
14. background loadをrace/deferredで扱う。
15. `applyStageDefinitionToRuntime()` でenemy base HP、base x等を反映。
16. background warmupを開始。

#### 2.5.3 stage definition load

`StageDefinitionLoader.load(BATTLE_CONFIG.stage)` を呼ぶ。ここは現コードのstage registry/selectedStageを使うなら `this.stage.config` または `this.stage.stageConfig` のようなruntime selectionを通すべきである。BCU寄せでは、stage file path決定は `StageRegistry/MapColc相当` が担当し、`BattleScene` は決定済み `StageConfig` をloaderへ渡すだけにする。

#### 2.5.4 background load

`StageBackgroundLoader.load(BATTLE_CONFIG.stage)` は `stage.imagePath/imgcutPath/csvPath/id` から背景を読む。`StageDefinition.bgId` がbackground asset resolverへ流れていない。つまりCSV row1 col4から読んだ `bgId` は、現状ログ/debug値に近く、実際の背景asset選択に使われない可能性がある。

#### 2.5.5 base load

`loadBase(def, stageRuntime)` はenemy sideの場合 `stageRuntime.castleId` を使い、`BcuCastleAssetLoader.load(requestedCastleId)` を呼ぶ。`castleId` が欠落すると0番にfallbackする。したがって、`StageDefinitionLoader` と `buildStageRuntime` が正しく `castleId` を保持していればenemy castle idはloadBaseまで流れる。一方、`castleId == -1` のBCU fallbackや `CastleImg.boss_spawn` は未対応である。

#### 2.5.6 actor factory preload

`preloadProductionRosterStatsAsync` / `preloadProductionRoster` / `actorFactory.preloadTemplate` でUI rosterのunit stats/assetを読み込む。enemy側は `buildStageEnemyUnitDefs` でunitDefsを作り、`preloadCriticalTemplates`等で必要分をpreloadする。BCU commonでは `AbEnemy.getEntity` がspawn時にDataEnemyと倍率を持ったEntityを作るため、現コードでは `BattleActorFactory` に倍率適用済み `ActorStatsModel` を渡す層が必要である。

#### 2.5.7 enemy spawn runtime build

`buildStageRuntime` 後に `BcuStageSpawnRuntime(this.stage.runtime, this.stageEnemyUnitDefs)` を作る。ただし `StageDefinitionLoader` のrowが `rowIndex`を持たないため、constructor内のMap keyが `undefined` になり、複数enemy rowでunitDef対応が壊れる可能性が高い。

#### 2.5.8 camera setup

`BattleCamera` は `stageLen`、`logicalW`、ratio、sizを受ける。`BattleCameraInputController` のwheel/pinchは `camera.zoomAtScreenPoint` と `panByScreenDelta` を呼ぶだけで、`stageLen` を直接書き換えない。この点は良い。ただし、`applyStageDefinitionToRuntime` がbase.xを書き換えた後にcamera clamp/focusを再計算しない可能性がある。

#### 2.5.9 tick処理順

現コードtickは概ね以下である。

1. `battleState !== 'running'`ならreturn。
2. `timeMs += dt * battleTimeScale`。
3. `economy.tick(e)`。
4. lineup animation更新。
5. stage spawn runtime tick、spawn eventsを `spawnStageEnemy`。
6. actor loopで `a.tick(e)` によりanimation/frame advance。
7. dead actor skip。
8. knockback actorは `tickKnockback` してcontinue。
9. attack中actorはattackElapsedを進め、hit event crossing時に `captureHitTargets` してdamage queueへ積む。
10. attack終了処理。
11. 非attack actorはtarget探索、移動、攻撃開始。
12. damage queueを適用。
13. actorsの `resolvePostDamage` を呼び、KB/deathを反映。
14. kbeff/effectsを作る。
15. `tickEffects`。
16. `cleanupDead`。
17. battle state更新。

BCU commonの `StageBasis.update` は「spawn/actions → entity update → attacks capture → attacks excuse → postUpdate → cleanup」の順で、さらに `AttackAb.capture` を全攻撃分先に実行し、その後 `AttackAb.excuse` を全攻撃分実行する。現コードはactor loop中にhit targetをcaptureしてdamage queueへ入れるため、全攻撃のcapture phaseとdamage application phaseは分離されているが、BCUほど厳密に「全AttackAb capture完了後に全excuse」ではない。

#### 2.5.10 `spawnActor` / `spawnStageEnemy`

`spawnStageEnemy(unitDef,row)` はunitDef未preloadならtemplate preloadを予約してspawnをdeferし、preload済みなら `getSpawnWorldX('cat-enemy', row)` を使ってactorをspawnする。spawn後、actor.xをspawnXへ強制設定する。row倍率のstats適用はここでは見えない。

#### 2.5.11 `getSpawnWorldX`

`getSpawnWorldX(side,rowOrOptions)` はexplicit `spawnWorldX` があればそれを優先し、なければstage runtimeの `enemySpawnWorldX` / `playerSpawnWorldX` を返す。つまり現状はbase front edgeから都度算出ではなく、parser/runtimeに入った固定spawn world xに依存する。BCUではenemy通常spawnは700、enemy baseは800、player unit spawnは `st.len - 700`、player baseは `st.len - 800` で、castle assetのfront edgeではない。ただし現コードが任意stage/任意castle asset visual boundsを扱うなら、BCU定数に合わせた `StageCoordinate` とbase combat bodyを分離しておくべきである。

#### 2.5.12 `requestPlayerSpawn`

production UIから呼ばれる。economyがmoney/cooldownを判定し、成功するとplayer actorをspawnする。BCU common `StageBasis.act_spawn` と比べると、worker cat、wallet max、lineup cooldown frame、max teammate count、rarity cap、summoner/spirit、unitRespawnTime等がない。

#### 2.5.13 `findTargetForActor`, `canAttack`, `startActorAttack`

`findTargetForActor` は敵actorsを `BattleBodyResolver.getCombatBodyDistance` でsortし、なければenemy baseをtargetにする。`canAttack` はdistanceと `BattleAttackResolver.isTargetTouchable` を見る。`startActorAttack` はcooldownとattack animation availabilityを見てattack stateへ入る。BCU commonでは `Entity.update2` がtouch判定、walking/idle、startAttack、updateAttackを分け、攻撃発生は `AtkManager.updateAttack` がpreTimeで管理し、hit時に `basis.getAttack` へAttackAbを投入する。

#### 2.5.14 `tickKnockback`, `cleanupDead`, `tickEffects`

現コードのKBは `BattleActor.stepKnockbackFrame` と `BattleScene.tickKnockback` でフレーム単位に近い進行をする。`cleanupDead` はdead actorを削除するが、final knockbackやdead state中は残す。BCU commonは `Entity.postUpdate` でdamageを反映し、`KBManager` がinterruptを処理し、`AnimManager.kill` / death animation / soul / smoke / kbeff等を進め、dead anim complete後にcleanupされる。

### 2.6 `js/battle/BattleConfig.js`

`BattleConfig` はstage/tuning/economy/actor等のdefaultを持つ。問題は、stage authoritative値がconfig defaultに残ると、CSV由来の `stageLen/bgId/castleId/enemyBaseHp/maxEnemyCount` と競合する点である。BCU寄せではconfigはfallback/feature flagに限定し、stageの真値は `StageDefinition` からのみ来るようにする。

### 2.7 `js/battle/BattleBase.js`

`BattleBase` は `id`, `side`, `label`, `x`, `y`, `maxHp`, `collisionRadius`, visual fields, combat body fieldsを持つ。`updateCombatBodyFromVisualBounds` がvisual boundsからcombat bodyを推定する。BCU commonではbaseもEntity/ECastleとしてpositionとbodyを持つため、現コードもbase runtimeをactorと同じworld bodyに寄せる方針は良い。ただしvisual bounds由来のbody推定はasset差でズレるため、`BaseCombatBodyResolver`を分離し、BCU coordinate定数とasset visualを混ぜないようにする。

### 2.8 `js/battle/BattleCamera.js` / `BattleCameraInputController.js`

`BattleCamera` は `worldToScreenX`, `screenToWorldX`, `panByScreenDelta`, `zoomAtScreenPoint`, clampを持つ。wheel/pinchでstageLenを書き換える実装は見当たらない。この点はBCU寄せに向いている。ただしrenderer側がlocal pixel offsetをworld coordinateへ混ぜる箇所があるため、camera単体よりrenderer transformの整理が重要である。

### 2.9 `js/battle/BattleSceneRenderer.js`

- 役割: background、base、actor、effect、debug overlay描画。
- BCU資産接点: actorの `model.getBattleDrawList`、enemy castle asset、background image/imgcut。
- camera接点: `projectX(scene, worldX)` が `camera.worldToScreenX` を呼ぶ。

問題点は、actor/base/backgroundで座標単位が完全には統一されていないこと。enemy castleは `projectX(base.x)` で描くためworld基準だが、player base composite layerは `base.x + offsetX * s` のようにstage/camera scaleを混ぜた値をworld xへ加えている。actor描画も `actor.x + visualOffset` をprojectするが、BCU model内のpart transformはlocal pixel系であり、どこまでworld単位にするかを明示する必要がある。

### 2.10 `js/battle/StageBackgroundLoader.js`

`StageBackgroundLoader` は `stage.imagePath`, `imgcutPath`, `csvPath`, `id` を受け、background csvから色・imgcut id・upper flagを読む。BCU commonの `Stage.java` はstage CSV row1 col4を `bg` として `Background` idにする。現コードは `StageDefinition.bgId` からbackground assetをresolveしていないため、stage CSVでbgIdが変わっても背景が変わらない構造になり得る。

### 2.11 `js/battle/BcuCastleAssetLoader.js`

`BcuCastleAssetLoader.load(castleId)` は `public/assets/bcu/000001/org/castle/${id3}/nyankoCastle_${id}_00...` のcandidateを試す。BCU commonの `Stage.java` は `CastleImg` idを持ち、`StageBasis` は `Identifier.getOr(st.castle, CastleImg.class).boss_spawn` を読む。現コードは `CastleImg.boss_spawn`、stage map cast offset、`animBaseId` を扱わない。enemy castle idがmissingなら0番にfallbackする可能性があるが、stage runtimeに正しいcastleIdがあればloadBaseまでは流れる。

### 2.12 `js/battle/BattleBodyResolver.js`

actor/base間のcombat body distance、touchable判定、range判定に関与する。BCU commonでは `AtkModelEntity.touchRange` / `StageBasis.inRange` がworld positionとwidth/rangeから攻撃対象を選ぶ。現コードも方向性は近いが、`combatPositionMode: 'screen-combat-point'` のself checkが存在するなど、screen-space由来の概念が残っている。BCU寄せでは完全にworld-space bodyへ統一する。

### 2.13 `js/battle/BattleStatsLoader.js` / `BcuStatsSchema.js`

現コードはunitとenemyのCSV indexを読み、HP、KB、speed、damage、TBA、range、price、respawn、width、attack startup、LD、multi-hitを正規化している。BCU commonの `DataUnit.java` / `DataEnemy.java` と照合すると、基礎statsとLD/multi-hitの一部は対応している。一方でproc/ability/trait/immunityは大幅に未読または未適用である。

### 2.14 `js/battle/BattleActorFactory.js`

asset loader、sprite sheet、model instance、stats loaderを組み合わせて `BattleActor` を作る。BCU commonでは `AbEnemy.getEntity` / `Form` / `DataUnit` / `DataEnemy` がEntity生成の起点で、倍率やstage line情報もEntity生成時に渡る。現コードはasset templateとruntime actorは分離できているが、stage row倍率をstatsへ適用する入口を追加する必要がある。

### 2.15 `js/battle/BattleActor.js`

`BattleActor` はanimation、movement、attack、damage、knockback、deathを広く持つ。KBは `BcuKnockbackSpec` と `stepKnockbackFrame` があり、HP KB、final KB、proc KB、boss shockwave、assistの距離・frame概念を持つ。これはBCU寄せとして良い方向である。ただし `Entity.java` のようなproc token、barrier/shield、zombie revive、curse/warp/freeze/slow/weaken等の状態管理はない。

### 2.16 `js/battle/BattleAttackProfile.js` / `BattleAttackResolver.js`

`BattleAttackProfile` はattackHitsからhit eventを作り、`BattleAttackResolver` はsingle/area、LD/omni interval、base/actor target captureを行う。BCU commonの `AtkManager` / `AttackSimple` / `AtkModelEntity` と比べると、hit timingとtarget captureの骨格はあるが、proc payload、trait filter、damage calculator、wave/surge continuation、capture-all-before-excuseの厳密性が不足している。

### 2.17 `BattleEffect`, `BattleEffectLoader`, `BcuKbeffLoader`

simple effect runtimeとkbeff loaderがある。BCU commonでは `EffAnim` にA_KB/A_WAVE/A_MINIWAVE/A_VOLC/A_CRIT/A_SHIELD等、多数のeffect registryがあり、`Entity.AnimManager` と `StageBasis.lea` がeffect animationを管理する。現コードはKB effectに寄っており、attack/proc effect runtimeは未分離である。

### 2.18 `BattleEconomy`, `FormationStore`, `PlayerProductionBar`, `FormationEditor`

`BattleEconomy` はmoneyとcooldownをmsで進める。`FormationStore` は2行×5列の10枠formationをlocalStorageに保持する。`PlayerProductionBar` はfront/back rowを表示し、front rowのみ生産操作する。BCU commonの `StageBasis.act_spawn` はframe cooldown、money、worker/wallet、max unit count、rarity cap等を統合しているため、現コードはUIとruntime分離は良いが、economy runtimeのBCU再現度は低い。

### 2.19 `js/bcu/*`

`BcuAssetLoader` はimage/imgcut/mamodel/maanimを読み、`BcuModelInstance` はpart transformを作り、`BcuAnimator` はms→frameでtrackを適用する。BCU commonの `ImgCut` / `MaModel` / `MaAnim` / `Part` / `EPart` と比べ、imgcut/mamodel/maanimの骨格はある。ただし `BcuAnimator.js` は7行の簡易frame playerで、BCU `MaAnim.update` のloop/protect/rotate/half-speed/performance mode、`Part.update` のeasing、`EPart.alter` の全modification semanticsを完全再現しているわけではない。

---

## 第3章：BCU common ZIPの実コード分析

### 3.1 package構造

BCU common ZIPはroot直下にJava package directoryを置く。

| package/directory | 主な役割 |
|---|---|
| `battle/` | 戦闘runtime core、lineup、battle field、cannon、treasure。 |
| `battle/attack/` | attack object、wave/surge/blast/volcano、target capture/damage apply。 |
| `battle/data/` | unit/enemy/entity stats、attack data、mask interface。 |
| `battle/entity/` | Entity、EUnit、EEnemy、ECastle、Cannon、Sniper、warp/summon controller。 |
| `io/` | input/output utilities。 |
| `pack/` | pack abstraction。 |
| `system/` | system utilities。 |
| `util/` | shared data base classes。 |
| `util/stage/` | stage/map/stage CSV/parser/spawn line。 |
| `util/stage/info/` | stage info/reward metadata。 |
| `util/unit/` | unit/enemy/form/trait/level/magnification。 |
| `util/anim/` | BCU animation data/parser/runtime。 |
| `util/pack/` | background、castle、effect、soul、wave animation。 |
| `util/lang/` | language data。 |

### 3.2 `util/stage`: Stage CSV読み込みとStage model

#### 3.2.1 `Stage.java`

主要field:

- `boolean non_con, trail, bossGuard`
- `boolean drop`
- `int len, health, max, mush, bgh`
- `int timeLimit`
- `int minSpawn, maxSpawn`
- `Identifier<CastleImg> castle`
- `Identifier<Background> bg, bg1`
- `Identifier<Music> mus0, mus1`
- `SCDef data`
- `Limit lim`
- `BattlePreset preset`

主要method:

- `Stage(Identifier<Stage> id, VFile f, int type)`: CSV parser本体。
- `validate()`: stage data validation。
- `getCont()`: container取得。
- その他clone/json/save系。

CSV列の読み方:

- row0通常stage:
  - `strs[0]`: castle id。`-1` の場合 `CH_CASTLES[id.id]`。`StageMap.cast != -1` の場合 `sm.cast * 1000 + cas`。
  - `strs[1]`: `non_con`。
  - row0は `DefStageInfo.setData(strs)` にも渡される。
- row1/meta:
  - `strs[0]`: `len`
  - `strs[1]`: `health`
  - `strs[2]`: `minSpawn`
  - `strs[3]`: `maxSpawn`
  - `strs[4]`: `bg`
  - `strs[5]`: `max = Math.min(50, ...)`
  - `strs[6]`: `isBase = value - 2`
  - `strs[7]`: `timeLimit`。非0なら `health = Integer.MAX_VALUE`
  - `strs[8]`: `bossGuard`。ただしcastle dataがある場合のみ。
- enemy rows:
  - numeric rowを読む。空行、非数字開始、`0,`開始で終了。
  - `SCDef.SIZE=16`のint配列へ読み込む。
  - `data[0] -= 2`。
  - `data[2]`, `data[3]`, `data[4]` を2倍。
  - `data[5] > 100 && data[9] == 100`ならbase triggerとmagnificationを入れ替え。
  - columns >10: score。
  - columns >11: attack magnification。
  - columns >12: spawn_0 negative flag。
  - columns >13: kill count。
  - enemy idがbase enemy idなら `C0=0`。
  - 最後にrow orderを反転して `SCDef` へ格納。

返すデータ構造:

`Stage` はstage header/metaと `SCDef` を保持する。`SCDef.Line` が敵出現row modelである。

#### 3.2.2 `SCDef.java`

`SCDef.Line` fields:

- `Identifier<AbEnemy> enemy`
- `int number, boss, multiple, group`
- `int spawn_0, spawn_1, respawn_0, respawn_1`
- `int castle_0, castle_1, layer_0, layer_1`
- `int mult_atk`
- `int kill_count`
- `int score`

index constants:

`SIZE=16, E=0, N=1, S0=2, R0=3, R1=4, C0=5, L0=6, L1=7, B=8, M=9, S1=10, C1=11, G=12, M1=13, KC=14, SC=15`。

`allow(StageBasis sb, AbEnemy e)` はstage max enemy countとenemy `will` を見て出現可否を判定する。現コードのalive countとは違い、BCUはentity countにweightを持ち込む。

#### 3.2.3 `EStage.java`

主要field:

- `Stage s`
- `Limit lim`
- `int[] num, rem, first`
- `float mul`
- `int star`
- `int[] killCounter`

主要method:

- `assign(StageBasis sb)`: first spawn countdown `rem` を初期化。`spawn_0/spawn_1` でrandom化し、base HP trigger rowは初期remを0にすることがある。
- `allow()`: 出現可能rowを探し、respawn countdownを再設定し、countを減らし、boss shockを立て、magnificationとattack magnificationを計算し、`AbEnemy.getEntity` で `EEnemy` を返す。
- `base(StageBasis sb)`: 最後のrowが `castle_0 == 0` ならenemy base entityとして使う。
- `update()`: health triggerに入った負のremを正にし、remを毎frame decrement。
- `inHealth(...)`: enemy base HP percentと `castle_0/castle_1` でtrigger判定。

現コードとの差分:

現コード `BcuStageSpawnRuntime` は `timeMs` と `nextAtMs` で出現を管理するが、BCU commonはframe countdown `rem`、health trigger、global `StageBasis.respawnTime`、SCDef allow、killCounter、boss shockを組み合わせる。

### 3.3 `util/unit` / `battle/data`: unit/enemy stats

#### 3.3.1 `DataUnit.java`

`DataUnit(Form f, String[] data)` はunit CSVから以下を読む。

- `ints[0]`: HP
- `ints[1]`: KB count
- `ints[2]`: speed
- `ints[3]`: attack
- `ints[4]`: TBA
- `ints[5]`: range
- `ints[6]`: price
- `ints[7] * 2`: respawn
- `ints[9]`: width
- trait flags: red/floating/black/metal/white/angel/alien/zombie等
- `ints[12]`: area attack flag
- `ints[13]`: pre / attack startup
- `ints[14]`, `ints[15]`: front/back
- procs/abilities: KB, STOP, SLOW, RESIST, MASSIVE, CRIT, ONLY, BOUNTY, ATKBASE, WAVE/MINIWAVE, WEAK, STRONG, LETHAL, METAL, LD, wave immunity, KB immunity, stop/slow/weaken immunity, barrier/shield/surge/mini-surge/blast/metal killer/summon等、多数。

#### 3.3.2 `DataEnemy.java`

`fillData(String[] strs)` はenemy CSVから以下を読む。

- `ints[0]`: HP
- `ints[1]`: KB count
- `ints[2]`: speed
- `ints[3]`: attack
- `ints[4]`: TBA
- `ints[5]`: range
- `ints[6]`: earn
- `ints[8]`: width
- trait flags: red/floating/black/metal/white/angel/alien/zombie/witch/eva/relic/demon/baron/beast/sage/villain等
- `ints[11]`: area attack flag
- `ints[12]`: pre
- procs/abilities: KB, STOP, SLOW, CRIT, base destroyer, WAVE/MINIWAVE, WEAK, STRONG, LETHAL, LD, immunities, BURROW, REVIVE, BARRIER, WARP, CURSE, SAVAGE, poison attack, SURGE/MINISURGE, shield, death surge, blast, delay等。

現コードとの差分:

現コード `BattleStatsLoader/BcuStatsSchema` は基礎stats、LD、multi-hitの一部に対応しているが、BCU commonのproc/ability/trait/immunity全域は `AbilityModel` と `ProcResolver` として正規化されていない。

### 3.4 `util/anim`: animation object / frame / interpolation

#### 3.4.1 `ImgCut.java`

`[imgcut]` fileを読み、image名、part count、各partの `x,y,w,h,name` を保持し、imageからcut image arrayを作る。

#### 3.4.2 `MaModel.java`

`[mamodel]` fileを読み、partsを生成する。partはparent、imgcut id、z-order、position、pivot、scale、angle、opacity、glow/name等を持つ。`check()` はimgcut id clampやparent loop検出を行い、`arrange()` はruntime用 `EPart` を作る。

#### 3.4.3 `MaAnim.java`

`[maanim]` fileを読み、`Part[] parts` を持つ。`update(f,eAnim,rotate)` はframeをloop/protect/rotate条件に応じて調整し、各 `Part.update` を呼び、最後に `EPart` をsortする。

#### 3.4.4 `Part.java`

各trackのkeyframe列を持ち、frame間をinterpolationする。easingは即時、linear、sqrt、三次系、cos/sin系などがある。更新結果は `EPart.alter(modification,value)` に流れる。

#### 3.4.5 `EPart.java`

runtime part。`alter` はparent/id/imgcut/z/position/pivot/scale/angle/opacity/flip/extend/special scale等を更新する。`drawPart` はparent matrix、pivot、scale、opacity/glow/extendを反映して描画する。

現コードとの差分:

現コード `BcuModelInstance` はparent matrixとpart draw listを持ち、かなり近い構造を持つ。しかし `BcuAnimator` は単純なframe playerであり、BCU `MaAnim.update` のloop/protect/rotateや `Part.update` のeasing全種、`EPart.alter` の全modificationを完全には再現していない。

### 3.5 `battle`: runtime / entity / update / spawn / targeting / attack / proc

#### 3.5.1 battle package全ファイル一覧

- `battle/Basis.java`
- `battle/BasisLU.java`
- `battle/BasisSet.java`
- `battle/BattleField.java`
- `battle/CannonLevelCurve.java`
- `battle/ELineUp.java`
- `battle/LineUp.java`
- `battle/SBCtrl.java`
- `battle/SBRply.java`
- `battle/StageBasis.java`
- `battle/Treasure.java`
- `battle/attack/AtkModelAb.java`
- `battle/attack/AtkModelEnemy.java`
- `battle/attack/AtkModelEntity.java`
- `battle/attack/AtkModelUnit.java`
- `battle/attack/AttackAb.java`
- `battle/attack/AttackBlast.java`
- `battle/attack/AttackCanon.java`
- `battle/attack/AttackSimple.java`
- `battle/attack/AttackVolcano.java`
- `battle/attack/AttackWave.java`
- `battle/attack/ContAb.java`
- `battle/attack/ContBlast.java`
- `battle/attack/ContExtend.java`
- `battle/attack/ContMove.java`
- `battle/attack/ContVolcano.java`
- `battle/attack/ContWaveAb.java`
- `battle/attack/ContWaveCanon.java`
- `battle/attack/ContWaveDef.java`
- `battle/data/AtkDataModel.java`
- `battle/data/CustomEnemy.java`
- `battle/data/CustomEntity.java`
- `battle/data/CustomUnit.java`
- `battle/data/DataAtk.java`
- `battle/data/DataEnemy.java`
- `battle/data/DataEntity.java`
- `battle/data/DataUnit.java`
- `battle/data/DefaultData.java`
- `battle/data/MaskAtk.java`
- `battle/data/MaskEnemy.java`
- `battle/data/MaskEntity.java`
- `battle/data/MaskUnit.java`
- `battle/data/Orb.java`
- `battle/data/PCoin.java`
- `battle/entity/AbEntity.java`
- `battle/entity/Cannon.java`
- `battle/entity/EAnimCont.java`
- `battle/entity/ECastle.java`
- `battle/entity/EEnemy.java`
- `battle/entity/EUnit.java`
- `battle/entity/EntCont.java`
- `battle/entity/Entity.java`
- `battle/entity/Sniper.java`
- `battle/entity/SurgeSummoner.java`
- `battle/entity/WaprCont.java`

#### 3.5.2 `StageBasis.java`

主要field:

- `EStage est`
- `Stage st`
- `ELineUp elu`
- `List<Entity> le`
- `List<AttackAb> la`
- `List<EAnimCont> lea`
- `ECastle ubase`
- `AbEntity ebase`
- `Background bg`
- `BackgroundEffect bgEffect`
- economy: `money`, `maxMoney`, worker level, cannon, cooldowns等

constructorで行うこと:

1. `est.assign(this)` でstage spawn stateを初期化。
2. `boss_spawn = Identifier.getOr(st.castle, CastleImg.class).boss_spawn`。
3. `setBackground(st.bg)`。
4. `EStage.base(this)` でenemy base rowがあればenemy entity baseにする。
5. enemy base entityの場合 `ebase.added(1, shock ? boss_spawn : 700)`。
6. 通常enemy castleの場合 `ebase = new ECastle(this); ebase.added(1, 800)`。
7. player base `ubase = new ECastle(this, bas); ubase.added(-1, st.len - 800)`。
8. max unit count、money、worker、stage min/max spawn gateなどを初期化。

update order:

`StageBasis.update()` のコメントは「actions and enemies from stage first → update each entity → receive attacks → excuse attacks → post update → delete dead entities」と明記している。実処理も以下の順である。

1. background effect初期化/更新。
2. delayed unit spawn / button delay処理。
3. entity sort。
4. stage enemy spawn check: `respawnTime <= 0 && active && allow > 0` で `est.allow()`。
5. spawnしたenemyを `e.added(1, boss ? boss_spawn : 700f)` で追加。
6. stage global `respawnTime` を `minSpawn/maxSpawn` randomで再設定。
7. `elu.update()`、cooldown、spirit/cannon/money、`est.update()`。
8. `updateEntities(...)`。Entity側ではmovement/proc tick/attack start/updateが進む。
9. cannon update。
10. effect/wave/surge continuation update。
11. `la.forEach(AttackAb::capture)`。
12. `la.forEach(AttackAb::excuse)`。
13. enemy base post update、base death check。
14. all entity `postUpdate()`。
15. shock interrupt。
16. dead/effect cleanup。
17. theme/stop/sniper/money clamp/lineup change。

#### 3.5.3 `Entity.java`

主要内部class:

- `AnimManager`: main anim、KB anim、death/soul/smoke/effect icon管理。
- `AtkManager`: attack start、preTime、hit frame、attack list投入。
- `KBManager`: HB/proc/final/shock等のinterrupt/KB movement管理。
- proc token classes: poison/weak/barrier/zombie/revive等。

主要method:

- `update()`: movement iteration。TBA/proc time tick、KB/burrow/standard movement、revive等。
- `update2()`: reaction iteration。touch判定、idle/walk、attack start、attack update、animation update。
- `damaged(AttackAb atk)`: damage/proc処理。
- `processProcs(AttackAb atk)`: STOP/SLOW/WEAK/CURSE/KB/WARP/POISON/ARMOR/SPEED等を適用。
- `postUpdate()`: accumulated damage反映、HB threshold、death、KB interrupt、zombie/revive/warp後処理。
- `touchable()`: death/KB/burrow/revive中のtargetability mask。

#### 3.5.4 `AttackAb`, `AttackSimple`, `AtkModelEntity`

`AtkModelEntity.getAttack(ind)` は `Proc.blank()` を作り、攻撃力・range interval・proc payloadを詰めた `AttackSimple` を返す。`inRange(ind)` はLD/omniでshort/long pointを使い、通常攻撃では `pos + range*dire` と `pos - width*dire` を使う。

`AttackSimple.capture()` は `StageBasis.inRange(...)` でtargetを捕捉し、areaでなければfrontmost single targetを選ぶ。`excuse()` はcaptured targetにdamage/procを適用し、wave/miniwave/surge/minisurge/blastなどのcontinuationを生成する。

---

## 第4章：ステージCSVから戦闘シーンまでの完全比較

| 順番 | 処理 | BCU commonのファイル/クラス/メソッド | 現コードのファイル/クラス/メソッド | BCUのやり方 | 現コードのやり方 | 差分 | 現コードの問題点 | BCU寄せ修正案 | 優先度 |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | stage file path決定 | `MapColc`, `StageMap`, `Stage` constructor | `BattleScene.init` → `StageDefinitionLoader.load(BATTLE_CONFIG.stage)` | map/stage containerからstage fileを読む | global configのstageCsvPath依存 | selection層が薄い | selectedStageとBATTLE_CONFIGがずれる可能性 | `StageRegistry.resolve()` を唯一の入口にする | 高 |
| 2 | CSV読み込み | `Stage(Identifier,VFile,type)` | `StageDefinitionLoader.load` | `VFile`からqueueでreadLine | fetch pathからtext | 方向性は同じ | error時fallbackが強い | loaderはparse errorをdiagnostic付きで返す | 高 |
| 3 | header parse row0 | `Stage.java` 150-164 | `StageDefinitionLoader.parse` | castle/nonContinue/stageInfo | castle/cannon扱い | row0 col1意味が違う | `cannonId`誤読の可能性 | `nonContinue`へ修正、cannonは別source | 高 |
| 4 | meta parse row1 | `Stage.java` 176-189 | `StageDefinitionLoader.parse` | len/health/minSpawn/maxSpawn/bg/max/base/time/bossGuard | stageLen/enemyBaseHp/min/max/bg/max/base、一部bossGuard誤row | bossGuard row差 | bossGuardが効かない | row1 col8をbossGuardにする | 高 |
| 5 | enemy row parse | `Stage.java` 198-244 + `SCDef.Line` | `StageDefinitionLoader.parse` | SCDef.SIZE=16に正規化 | object rowへ正規化 | 一部一致 | rowIndexなし、C1/S1/G等不完全 | `StageEnemyLine`をSCDef準拠にする | 最優先 |
| 6 | Stage model作成 | `Stage` + `SCDef` | object `{meta,runtime,enemyRows}` | dataとruntimeが分離 | parserが座標も作る | 責務混在 | testしづらい | parserは純data、座標はStageRuntime | 最優先 |
| 7 | castleId保持 | `Stage.castle` | `runtime.castleId` | `CastleImg` Identifier、fallbackあり | row0 col0 raw | fallback不足 | `-1`やmap offset未対応 | `CastleAssetResolver`でfallback込み | 高 |
| 8 | bgId保持 | `Stage.bg` | `runtime.bgId` | `Background` Identifier | metaRow[4] | 取得はする | asset loadに流れない | `StageBackgroundResolver.resolve(bgId)` | 高 |
| 9 | stageLen保持 | `Stage.len` | `runtime.stageLen`, camera | runtime coreのworld length | parser runtimeに格納 | 方向性は近い | config fallback混在 | `StageRuntime.stageLen`だけを真値にする | 高 |
| 10 | enemyBaseHp保持 | `Stage.health` | `runtime.enemyBaseHp`, base maxHp反映 | enemy base/ECastleに反映 | applyStageDefinitionToRuntimeで反映 | 方向性は近い | timeLimit時HP補正なし | `timeLimit`ならBCU同様特殊扱い | 中 |
| 11 | maxEnemyCount保持 | `Stage.max`, `SCDef.allow` | `effectiveMaxEnemyCount` | max 50 + entity will | alive enemy数 | weight差 | will無視 | `EnemyCountRuntime`でwill対応 | 中 |
| 12 | enemyId変換 | `data[0]-=2` | `enemyId=rawEnemyId-2` | 一致 | 一致 | 良い | なし | 維持 | 高 |
| 13 | enemy stats解決 | `AbEnemy.getEntity` + `DataEnemy` | `BattleStatsLoader.loadEnemyStats` | spawn時倍率込みentity | template stats + stageSpawn | 倍率適用不足 | magnification未反映 | `ActorStatsModel.applyStageLine` | 最優先 |
| 14 | enemy asset解決 | `Enemy`/anim refs | `BcuStageEnemyResolver` | entity/form dataからanim | asset dir決め打ち | 方向性は近い | unavailable fallback弱い | asset resolverを診断付きに | 中 |
| 15 | background asset解決 | `StageBasis.setBackground(st.bg)` | `StageBackgroundLoader.load(BATTLE_CONFIG.stage)` | stage.bgからBackground | config path/id | bgIdが効かない | stage CSV背景にならない | bgId resolver導入 | 高 |
| 16 | castle asset解決 | `CastleImg`, `NyCastle`, `boss_spawn` | `BcuCastleAssetLoader.load(castleId)` | CastleImg metadataを使う | castle asset candidateのみ | boss_spawn等不足 | spawn position等に未反映 | CastleImg metadataを読む | 高 |
| 17 | player base作成 | `new ECastle(...); added(-1, st.len-800)` | `loadBase(cat-player)` | st.len基準 | runtime playerBaseWorldX | 近い | camera後にbase x変更あり | StageRuntime作成後base生成 | 高 |
| 18 | enemy base作成 | `EStage.base` or `new ECastle; added(1,800)` | `loadBase(cat-enemy)` | base row enemy or castle | castle only寄り | enemy base row不足 | enemy base enemy未再現 | `EnemyBaseResolver`導入 | 中 |
| 19 | stage coordinate作成 | `added` positions 700/800/st.len-700/800 | `buildStageRuntime` | fixed BCU coordinate | parser由来runtime | 近い | 責務場所が違う | `StageCoordinate`へ移動 | 高 |
| 20 | camera作成 | app layer側、commonにcameraなし | `new BattleCamera(stageLen)` | commonはworldのみ | browser cameraあり | common対象外 | renderer混在 | CameraTransformを唯一の投影器に | 高 |
| 21 | spawn runtime作成 | `EStage.assign` | `new BcuStageSpawnRuntime` | frame rem初期化 | ms nextAt | 単位差 | trigger/respawn差 | frame-based runtimeへ | 最優先 |
| 22 | battle tick開始 | `StageBasis.update` | `BattleScene.tick` | deterministic frame update | dt ms update | 単位差 | order差/時間差 | `BattleFrameClock`導入 | 高 |
| 23 | firstFrame到達 | `EStage.update` rem decrement | `nextAtMs <= timeMs` | frame countdown | ms absolute | 差大 | firstFrame補正が揺れる | frame countで比較 | 高 |
| 24 | enemy actor生成 | `AbEnemy.getEntity` + `added(1,spawn)` | `spawnStageEnemy` | stats倍率/entity layer込み | unitDefからBattleActor | 差大 |倍率/layer/proc不足 | `EnemyActorFactory.spawnFromLine` | 最優先 |
| 25 | actor描画 | `EAnimD/EPart` | `BcuModelInstance/BattleSceneRenderer` | BCU anim runtime | JS簡易runtime | 部分一致 | easing/loop/offset差 | animation parity phase | 中 |
| 26 | attack/damage/KB/death | `Entity/AttackAb/StageBasis` | `BattleScene/BattleActor/BattleAttackResolver` | capture→excuse→postUpdate | queue damage→post | 構造は近いがproc不足 | ability未再現 | AttackTimeline/Damage/Proc分離 | 高 |

---

## 第5章：StageDefinitionLoader と BCU Stage Parser の詳細比較

### 5.1 詳細比較表

| 項目 | BCU common | 現コード | 差分 | 修正 |
|---|---|---|---|---|
| CSV row0 | `Stage.java`: castle id, non_continue, stageInfo | `StageDefinitionLoader`: castleId, cannonId扱い | row0 col1誤読疑い | `nonContinue`へ変更。cannonは別仕様として未使用にする。 |
| CSV row1 | len, health, minSpawn, maxSpawn, bg, max, baseEnemy, timeLimit, bossGuard | stageLen, enemyBaseHp, min/max, bg, max, baseEnemy。bossGuardはrow0扱い | bossGuard row違い | row1[8]に修正。 |
| enemy rows | `SCDef.SIZE=16`へ正規化 | objectへ直接map | 部分一致 | `StageEnemyLine`にSCDef準拠fieldを持つ。 |
| castleId | `cas == -1` fallback、map cast offset | row0[0] raw | fallback不足 | `resolveCastleId(raw, mapContext)`追加。 |
| cannonId | Stage parserにはない | row0[1] | 意味違い | `cannonId`削除または常にnull。 |
| bgId | row1[4] → `Background` Identifier | row1[4]をruntime.bgId | 読むがassetに流れない | BackgroundResolverへ渡す。 |
| stageLen | row1[0] | row1[0] or 4000 | fallbackあり | parse errorとfallbackを区別。 |
| enemyBaseHp | row1[1]、timeLimit時MAX | row1[1] | timeLimit補正なし | `timeLimit != 0`ならBCU仕様に合わせる。 |
| maxEnemyCount | `Math.min(50,row1[5])` | 同等 | 近い | entity will対応をruntimeで追加。 |
| timeLimit | row1[7] | 読む | base HP補正未反映 | trail/timeLimit state追加。 |
| noContinue | row0[1] | cannonId扱い | 誤読 | `nonContinue`として保持。 |
| enemyId補正 | `E -= 2` | `rawEnemyId - 2` | 一致 | 維持。 |
| firstFrame補正 | `S0 *= 2` | `raw[2] * 2` | 一致 | 維持。 |
| respawn補正 | `R0/R1 *= 2` | `raw[3/4] * 2` | 一致 | 維持。 |
| count=0 | `number=0`はEStage側で有限/無限 semantics | count=0をunlimited | 方向性は近い | BCUの`num`終了状態に合わせる。 |
| baseHpTrigger | `C0/C1`、health trigger in EStage | `baseHpTrigger`のみ | C1不足 | `baseHpTriggerMin/Max`を持つ。 |
| bossFlag | `B`、boss>=1 shock、boss==2 shake | boolean bossFlag | boss==2差 | `bossType` intにする。 |
| magnification | `M`、stage star mulと合成 | raw magnification | stats未適用 | spawn時にhp/atkへ適用。 |
| attack magnification | `M1` | `mult_atk`あり | 未適用 | atk倍率へ適用。 |
| layer | `L0/L1` | front/back layerあり | 未使用 | target/draw/groupへ接続。 |
| kill count | `KC`, `killCounter` | killCountあり | 未使用 | `KillCounterRuntime`追加。 |
| 追加列 | `S1/C1/G/M1/KC/SC` | 一部のみ | 不完全 | 全列保持。 |
| fallback | castle fallbackあり | stage fallbackありすぎ | silent fallback危険 | diagnostic付きfallback。 |
| warning/error | validateあり | log中心 | schema validation不足 | structured warnings追加。 |

### 5.2 現コードのStageDefinitionLoader修正疑似コード

```js
export class StageDefinitionLoader {
  parse(text, path = '', context = {}) {
    const rows = parseNumericRows(text);
    if (rows.length < 2) throw new StageParseError('missing header/meta');

    const row0 = rows[0];
    const row1 = rows[1];

    const rawCastleId = intOr(row0[0], -1);
    const castleId = resolveCastleId(rawCastleId, context); // CH_CASTLES / mapCast offset対応

    const meta = {
      castleId,
      nonContinue: intOr(row0[1], 0) === 1,
      stageLen: requiredInt(row1[0], 'stageLen'),
      enemyBaseHp: requiredInt(row1[1], 'enemyBaseHp'),
      minSpawnFrame: intOr(row1[2], 0),
      maxSpawnFrame: intOr(row1[3], 0),
      bgId: requiredInt(row1[4], 'bgId'),
      maxEnemyCount: Math.min(50, intOr(row1[5], 50)),
      enemyBaseEnemyId: intOr(row1[6], 0) - 2,
      timeLimitFrame: intOr(row1[7], 0) * 60 * 30,
      bossGuard: intOr(row1[8], 0) === 1,
    };

    if (meta.timeLimitFrame > 0) {
      meta.enemyBaseHp = Number.MAX_SAFE_INTEGER;
      meta.trail = true;
    }

    const enemyRows = [];
    for (let csvIndex = 2; csvIndex < rows.length; csvIndex++) {
      const raw = rows[csvIndex];
      if (!raw.length || raw[0] === 0) break;
      const line = parseStageEnemyLine(raw, { csvIndex, enemyBaseEnemyId: meta.enemyBaseEnemyId, trail: meta.trail });
      enemyRows.push(line);
    }

    const runtimeOrder = enemyRows.slice().reverse().map((line, runtimeOrderIndex) => ({
      ...line,
      rowIndex: runtimeOrderIndex,
      runtimeOrderIndex,
    }));

    return new StageDefinition({ path, meta, enemyRows: runtimeOrder });
  }
}

function parseStageEnemyLine(raw, ctx) {
  const arr = new Array(16).fill(0);
  for (let i = 0; i < Math.min(raw.length, 10); i++) arr[i] = intOr(raw[i], i === 9 ? 100 : 0);

  arr[E] -= 2;
  arr[S0] *= 2;
  arr[R0] *= 2;
  arr[R1] *= 2;

  if (!ctx.trail && arr[C0] > 100 && arr[M] === 100) {
    arr[M] = arr[C0];
    arr[C0] = 100;
  }

  if (raw.length > 10) arr[SC] = intOr(raw[10], 0);
  if (raw.length > 11) arr[M1] = intOr(raw[11], arr[M]); else arr[M1] = arr[M];
  if (raw.length > 12 && intOr(raw[12], 0) === 1) arr[S0] *= -1;
  if (raw.length > 13) arr[KC] = intOr(raw[13], 0);

  if (arr[E] === ctx.enemyBaseEnemyId) arr[C0] = 0;

  return {
    raw,
    csvRowIndex: ctx.csvIndex,
    enemyId: arr[E],
    count: arr[N],
    spawnFrame0: arr[S0],
    spawnFrame1: arr[S1],
    respawnFrame0: arr[R0],
    respawnFrame1: arr[R1],
    castleHp0: arr[C0],
    castleHp1: arr[C1],
    layer0: arr[L0],
    layer1: arr[L1],
    bossType: arr[B],
    hpMagnification: arr[M] || 100,
    atkMagnification: arr[M1] || arr[M] || 100,
    group: arr[G],
    killCount: arr[KC],
    score: arr[SC],
  };
}
```

---

## 第6章：EnemySpawnRuntime完全比較

### 6.1 比較表

| 項目 | BCU common | 現コード | 問題 | BCU寄せ |
|---|---|---|---|---|
| count有限 | `num[i]--`, 0で`-1`終了 | `countRemaining--` | 概ね可 | finite/unlimited/done enum化 |
| count=0無限 | BCU line semanticsをEStageが管理 | `Infinity` | 方向性は可 | `remaining: Infinity`ではなく`mode:'infinite'`明示 |
| firstFrame | `rem=spawn_0`, frame decrement | `nextAtMs=firstMs` | ms差 | frame countdownへ |
| respawnMin/Max | `respawn_0 + rand(respawn_1-respawn_0)` | ms random | ms差 | frame randomへ |
| random interval | CopRand seed | Math.random | deterministicでない | seeded RNG導入 |
| baseHpTrigger | `inHealth(C0,C1)` | `enemyBaseHpPercent`を見る | BattleSceneが100固定 | actual enemy base HP percentを渡す |
| bossFlag | boss>=1 shock, boss==2 shake | boolean | boss type不足 | int bossType |
| maxEnemyCount | `SCDef.allow` + will | alive count | weightなし | will対応 |
| magnification | hp/atk倍率としてentity生成 | rowに残る | stats未適用 | spawn時statsに適用 |
| layer | entity layerへ | row保持のみ | 未接続 | actor layerへ |
| kill count trigger | `killCounter` | row保持のみ | 未実装 | kill counter runtime |
| spawn block | max/entity/sublimit/health/rem | alive/max/time | sublimit不足 | `canSpawnLine`分離 |
| spawn retry | rem/respawnTimeで管理 | max満杯なら次tick再試行 | 近いがglobal gateなし | global stage respawn gate追加 |
| stage clear/loss | base HP/timeLimit/dojo | battle state update | 部分 | objective runtime |
| enemy actor生成 | `AbEnemy.getEntity` | unitDef/template | 倍率不足 | `spawnFromStageLine` |
| enemy stats適用 | `multi/mulatk` | なし/弱い | 大 | `ActorStatsModel.applyMagnification` |
| enemy asset適用 | enemy/form anim refs | directory candidate | 近い | resolver診断強化 |
| spawnX | `boss_spawn` or 700 | row.spawnWorldX or runtime | boss_spawnなし | CastleImg.boss_spawn反映 |

### 6.2 現コードに入れるべき EnemySpawnRuntime 設計

#### 新規class案

- `StageEnemyLine`: parser output。SCDef.Line互換fieldを持つ。
- `EnemySpawnRuntime`: stage line stateをframeで管理。
- `StageSpawnGate`: max enemy count、stage global min/max spawn、group sublimitを管理。
- `SpawnEvent`: actor生成に必要なline、enemyId、magnification、layer、bossType、spawnWorldXを持つ。

#### 疑似コード

```js
export class EnemySpawnRuntime {
  constructor(stageRuntime, { rng, enemyCounter }) {
    this.stage = stageRuntime;
    this.rng = rng;
    this.enemyCounter = enemyCounter;
    this.globalRespawnFrame = randomBetween(stageRuntime.minSpawnFrame, stageRuntime.maxSpawnFrame, rng);
    this.rows = stageRuntime.enemyRows.map((line, index) => ({
      line,
      rowIndex: line.rowIndex ?? index,
      remaining: line.count === 0 ? Infinity : line.count,
      done: false,
      rem: initialSpawnRem(line, rng, stageRuntime),
      killCounter: line.killCount || 0,
      disabled: false,
    }));
  }

  stepFrame(context) {
    const events = [];

    for (const state of this.rows) {
      if (state.disabled || state.done) continue;
      if (this.isInHealthWindow(state.line, context.enemyBaseHpPercent) && state.rem < 0) {
        state.rem *= -1;
      }
      if (state.rem > 0) state.rem--;
    }

    if (this.globalRespawnFrame > 0) {
      this.globalRespawnFrame--;
      return events;
    }

    const allow = this.stage.maxEnemyCount - this.enemyCounter.enemyWillCount();
    if (allow <= 0) return events;

    const state = this.rows.find((s) => this.canSpawnLine(s, context));
    if (!state) return events;

    events.push(this.createSpawnEvent(state, context));
    this.afterSpawn(state);
    this.globalRespawnFrame = randomBetween(this.stage.minSpawnFrame, this.stage.maxSpawnFrame, this.rng);
    return events;
  }

  canSpawnLine(state, context) {
    const line = state.line;
    return !state.done
      && state.remaining !== 0
      && state.killCounter === 0
      && this.isInHealthWindow(line, context.enemyBaseHpPercent)
      && state.rem <= 1
      && state.rem >= 0
      && this.stage.groupLimits.allow(line.group)
      && this.enemyCounter.canFit(line.enemyWill ?? 1);
  }

  afterSpawn(state) {
    const line = state.line;
    state.rem = randomBetween(line.respawnFrame0, line.respawnFrame1, this.rng) + 1;
    if (state.remaining !== Infinity) {
      state.remaining -= 1;
      if (state.remaining <= 0) state.done = true;
    }
  }

  createSpawnEvent(state, context) {
    const line = state.line;
    return {
      type: 'spawnEnemy',
      rowIndex: state.rowIndex,
      enemyId: line.enemyId,
      hpMagnification: line.hpMagnification,
      atkMagnification: line.atkMagnification,
      layer0: line.layer0,
      layer1: line.layer1,
      bossType: line.bossType,
      spawnWorldX: line.bossType >= 1 ? this.stage.enemyBossSpawnWorldX : this.stage.enemySpawnWorldX,
      line,
    };
  }
}
```

---

## 第7章：城・背景・座標・カメラ比較

### 7.1 必須確認事項

| 確認項目 | 現コード実コードでの結果 | BCU common | 判定/修正 |
|---|---|---|---|
| 敵城が0番に落ちる可能性 | `loadBase`でrequestedCastleIdがfiniteでない場合0にfallback | `Stage.java`はcastle fallbackを明示 | 可能性あり。ただしruntimeにcastleIdがあれば流れる。fallback理由をdebug表示する。 |
| stage runtime作成前にbase loadしているか | `buildStageRuntime`後に`loadBase` | `StageBasis` constructor内でStage/EStage後にbase生成 | 順序は概ね良い。 |
| castleIdがloadBaseまで流れているか | `stageRuntime.castleId`を`loadBase`で読む | `Stage.castle`→`CastleImg` | 流れる。ただし`-1`/map offset未対応。 |
| bgIdが背景assetまで流れているか | `runtime.bgId`はあるが`StageBackgroundLoader.load(BATTLE_CONFIG.stage)` | `Stage.bg`→`setBackground` | 流れていない。最優先修正。 |
| spawnがbase front基準か | `enemySpawnWorldX=700`, `playerSpawnWorldX=stageLen-700` | BCUも通常spawnは700/st.len-700、baseは800/st.len-800 | 定数としては近い。asset front edgeからではない。StageCoordinateへ明示。 |
| backgroundとactorが同じcamera変換か | actor/baseは`worldToScreenX`、backgroundは独自pos/siz処理 | commonはcameraなし、Background.drawはpos/siz | browser側で統一が必要。 |
| pinch/wheelでstageLenを書き換えるか | `BattleCameraInputController`はzoom/panのみ | common対象外 | 書き換えなし。良い。 |
| worldToScreen/screenToWorld統一 | `BattleCamera`に存在 | common対象外 | rendererのoffset混在を直す。 |
| UI coordinate | ProductionBarはUI側 | commonはlineup runtime別 | UIはcamera外。良い。 |

### 7.2 BCU common側

- `Stage.java`: `castle`, `bg`, `len`, `health`, `max`をstage modelに持つ。
- `StageBasis`: `boss_spawn = CastleImg.boss_spawn`、`setBackground(st.bg)`、enemy base `added(1, 800)`、player base `added(-1, st.len - 800)`、enemy spawn `added(1, boss_spawn or 700)`。
- `Background.java`: bg idからimage/csv/effect/overlay/top layerを読み、draw時にpos/siz/groundHeightで描画。
- `NyCastle.java`: player castle animation assetを読み、BASE/ATK/EXT animを提供。

### 7.3 Codex向け修正指示

```text
目的:
Stage CSVのcastleId/bgId/stageLenをBattleSceneの描画とruntimeへ確実に流す。

変更ファイル:
- js/battle/StageDefinitionLoader.js
- js/battle/StageRuntime.js 新規
- js/battle/CastleAssetResolver.js 新規または BcuCastleAssetLoader.js 拡張
- js/battle/StageBackgroundResolver.js 新規または StageBackgroundLoader.js 拡張
- js/battle/BattleScene.js
- js/battle/BattleSceneRenderer.js
- js/battle/BattleCamera.js

禁止事項:
- StageDefinitionLoaderでscreen座標やcamera値を計算しない。
- zoom/pinchでstageLenを書き換えない。
- bgIdを読んだだけで捨てない。
- castleId missing時に無言で0番へ落とさない。

実装:
1. StageDefinitionに`meta.castleId`, `meta.bgId`, `meta.stageLen`, `meta.enemyBaseHp`, `meta.maxEnemyCount`を保持。
2. StageRuntimeで`enemyBaseWorldX=800`, `enemySpawnWorldX=700`, `playerBaseWorldX=stageLen-800`, `playerSpawnWorldX=stageLen-700`を計算。
3. BattleScene.initは StageDefinition → StageRuntime → background/castle resolve → base生成 → spawn runtime → camera の順にする。
4. StageBackgroundResolver.resolve(bgId)を作り、rendererはそのassetを描く。
5. CastleAssetResolver.resolveEnemyCastle(castleId)を作り、fallback時はdebug reportにwanted id/reasonを出す。
```

---

## 第8章：Battle tick / update order比較

| order | BCU commonの処理 | BCU commonのファイル/メソッド | 現コードの処理 | 現コードのファイル/メソッド | 差分 | 挙動への影響 | BCU寄せ修正案 |
|---:|---|---|---|---|---|---|---|
| 1 | frame update entry | `StageBasis.update()` | dt ms tick entry | `BattleScene.tick(dt)` | frame vs ms | timingずれ | `BattleFrameClock`でframe step化 |
| 2 | delayed spawns/button input | `StageBasis.update` | economy tick先行 | `BattleScene.tick` | economy順が違う | money/cooldown境界差 | frame order定義 |
| 3 | enemy spawn check | `respawnTime` + `est.allow()` | `stageSpawnRuntime.tick(timeMs)` | global gateなし | 湧き頻度差 | stage global respawn追加 |
| 4 | player production request | `act_spawn` input queue | UIから随時`requestPlayerSpawn` | 入力タイミング差 | 同frame判定差 | request queue化 |
| 5 | actor state update movement | `updateEntities`→`Entity.update` | actor loop `a.tick`, movement | `BattleScene.tick` | animation advanceが先 | hit frame差 | state updateとanim update分離 |
| 6 | target search | `Entity.update2` touch/startAttack | `findTargetForActor` | 概ね同等 | BCUはtouch range | body統一必要 | `TargetResolver`導入 |
| 7 | attack start | `AtkManager.startAttack` | `startActorAttack` | 近い | anim availability差 | `AttackTimeline`へ |
| 8 | attack animation advance | `AtkManager.updateAttack` | attackElapsedMs | frame vs ms | hit frameずれ | attackFrameで管理 |
| 9 | hit timing | `preTime==0`で`basis.getAttack` | crossing event atMs | 近い | ms crossing | frame event化 |
| 10 | target capture | `la.forEach(capture)`全攻撃 | actor loop中capture | BCUは全capture先 | 同時攻撃差 | capture phase queue導入 |
| 11 | damage resolve | `la.forEach(excuse)` | damage queue apply | 近い | procなし | DamageCalculator/ProcResolver |
| 12 | proc resolve | `Entity.processProcs` | ほぼなし | 大差 | 状態異常未再現 | ProcResolver導入 |
| 13 | KB check | `Entity.postUpdate` | `BattleActor.resolvePostDamage` | 近い | proc KB/immune差 | KBRuntimeへ |
| 14 | death check | `postUpdate`/AnimManager | enterDeadState | 近い | zombie/revive/soul不足 | DeathRuntime追加 |
| 15 | effect spawn | `lea`, `EffAnim`, continuation | hit/kbeff effects | 部分 | wave/surge等なし | EffectRuntime |
| 16 | effect tick | `lea/update`, `lw/tlw` | `tickEffects` | BCU多層 | effect不足 | effect categories追加 |
| 17 | cleanup | dead anim complete/effects remove | `cleanupDead` | 近い | dead anim条件差 | death animation done条件を使う |
| 18 | camera update | commonにcameraなし | input controller/camera | app層差 | なし | renderer側で統一 |
| 19 | render | app layer + anim draw | `BattleSceneRenderer` | common外 | world/local混在 | RenderTransform整理 |

---

## 第9章：攻撃・ダメージ・能力/proc比較

### 9.1 現コードで実装済み能力/機構

| 機構 | 現コード | 備考 |
|---|---|---|
| single / area | `BattleAttackResolver.captureTargets` | `targetMode`でsingle/area。 |
| multi-hit | `BattleAttackProfile` | attackHitsから複数event生成。 |
| long distance | `BattleAttackResolver.isTargetInRange` | LD interval対応。 |
| omnistrike | `BattleAttackResolver.isTargetInRange` | omni interval対応。 |
| base target | `captureTargets` | actor候補に加えてbase判定。 |
| HP damage | `BattleActor.takeDamage` / `BattleBase.takeDamage` | raw damageのみ。 |
| HP KB | `BattleActor.resolvePostDamage` | threshold方式。 |
| final KB/death | `BattleActor.enterDeadState` | death stateあり。 |
| kbeff | `BcuKbeffLoader`, `BcuKbeffRuntime` | KB effect対応。 |
| basic attack animation hit timing | `BattleAttackProfile` + `BattleScene.tick` | ms-based。 |

### 9.2 現コードで未実装能力一覧

- critical
- savage blow
- wave
- mini-wave
- surge
- mini-surge
- freeze / stop
- slow
- weaken
- proc knockback
- warp
- curse
- toxic / poison
- barrier breaker
- shield pierce / shield break
- zombie killer
- zombie revive / burrow
- metal damage rule
- trait target / ability target only
- resistant
- massive damage
- insane damage
- tough / strong against
- insanely tough
- ability immunity: wave, surge, KB, stop, slow, weaken, warp, curse, toxic, etc.
- base destroyer
- soulstrike / soul attack
- conjure / summon / spirit
- blast
- delay
- death surge
- boss shockwave proc integration
- bounty/money proc
- attack base proc as separate damage multiplier

### 9.3 現コードで仮実装または部分実装の能力

| 能力 | 現コード状態 | 問題 |
|---|---|---|
| LD/omni | range intervalはある | BCUのtarget capture/long attack base exceptionが完全ではない。 |
| multi-hit | hit eventはある | ability/proc per hitがない。 |
| KB | HP/death KBはある | proc KB、KB immunity、KB中touchable mask不足。 |
| base destroyer | stats schemaにindex認識がある可能性 | DamageCalculatorで未適用。 |
| stage倍率 | rowに値はある | actor statsに未適用。 |
| traits | stats schemaで一部読める | damage/proc targetに未接続。 |

### 9.4 BCU commonで確認できた能力/Proc系

`DataUnit.java`, `DataEnemy.java`, `AtkModelEntity.java`, `Entity.processProcs`, `AttackSimple.excuse` で確認できるもの:

- KB
- STOP / freeze
- SLOW
- WEAK
- CRIT
- ATKBASE / base destroyer
- WAVE / MINIWAVE
- STRONG / tough and strong style modifiers
- LETHAL / survive
- METAL / metal damage rule
- LD / omni range model
- wave immunity
- KB immunity
- stop/slow/weaken immunity
- BURROW
- REVIVE
- BARRIER / BREAK
- WARP / anti-warp
- CURSE / curse immunity
- SAVAGE
- poison attack / toxic
- SURGE / MINISURGE / death surge
- demon shield / shield break
- METALKILL
- BLAST
- DELAY
- SUMMON / conjure
- BOSS shockwave
- MOVEWAVE
- SNIPER
- ARMOR / SPEED / LETHARGY系proc

### 9.5 AbilityModel設計

```js
export class AbilityModel {
  constructor(rawStats, side) {
    this.traits = parseTraits(rawStats, side);
    this.attackType = rawStats.isArea ? 'area' : 'single';
    this.damageModifiers = {
      massive: flag(rawStats, 'massive'),
      insaneDamage: flag(rawStats, 'insaneDamage'),
      resistant: flag(rawStats, 'resistant'),
      tough: flag(rawStats, 'strong'),
      baseDestroyer: proc(rawStats, 'ATKBASE'),
      metal: flag(rawStats, 'metal'),
    };
    this.immunities = parseImmunities(rawStats);
    this.procs = parseProcPayloads(rawStats);
  }
}
```

### 9.6 ProcResolver設計

```js
export class ProcResolver {
  resolve({ attacker, target, attackEvent, damageResult, rng }) {
    const out = [];
    for (const proc of attackEvent.procPayloads) {
      if (target.abilities.immunities[proc.type]) continue;
      if (!procAppliesToTrait(proc, target.traits)) continue;
      if (!rng.percent(proc.probability)) continue;
      out.push(this.toStateEvent(proc, attacker, target, damageResult));
    }
    return out;
  }
}
```

### 9.7 DamageCalculator設計

```js
export class DamageCalculator {
  calculate({ attacker, target, attackEvent, rng }) {
    let damage = attackEvent.damage;
    const traits = target.stats.traits;
    const abilities = attacker.stats.abilities;

    damage *= traitDamageMultiplier(abilities, traits);
    damage *= baseDestroyerMultiplier(abilities, target);
    damage = applyMetalRule(damage, target, attackEvent, rng);
    damage = applyBarrierShield(damage, target, attackEvent, rng);
    damage = applyWeaken(attacker, damage);
    damage = applyDamageCapCut(target, damage);

    return { damage: Math.floor(damage), brokeBarrier: false, brokeShield: false, critical: false };
  }
}
```

### 9.8 AttackTimeline設計

```js
export class AttackTimeline {
  constructor(rawStats, abilityModel) {
    this.hits = rawStats.attackHits.map((hit, index) => ({
      index,
      hitFrame: hit.preFrame,
      damage: hit.damage,
      rangeShape: buildRangeShape(rawStats, hit),
      targetMode: rawStats.isArea ? 'area' : 'single',
      procPayloads: abilityModel.procs.forHit(index),
    }));
    this.recoverFrame = rawStats.attackIntervalFrame;
  }
}
```

### 9.9 導入順

1. `ActorStatsModel`にtraits/abilities/procsを保持。
2. `AttackTimeline`へprocPayloadsを追加。
3. `DamageCalculator`でtrait damage、metal、base destroyer、barrier/shieldを処理。
4. `ProcResolver`でfreeze/slow/weaken/KB/warp/curse等のstate eventsを返す。
5. `EffectRuntime`でwave/surge/blast/crit等を描画・継続attack化。
6. `EntityStateRuntime`でzombie/revive/burrow/soulstrike/summonを扱う。

---

## 第10章：KB・死亡・エフェクト比較

### 10.1 比較表

| 項目 | BCU common | 現コード | 差分 | 修正 |
|---|---|---|---|---|
| HP KB | `Entity.postUpdate`でHB threshold | `BattleActor.resolvePostDamage` | 近い | KBRuntimeへ移動 |
| final KB | `AnimManager.kill`, KB/death anim | `enterDeadState` | 近いが簡略 | death timeline追加 |
| proc KB | `processProcs` + KBManager | ほぼなし | 未実装 | ProcResolverからKB event |
| boss shockwave | `boss_spawn`, `shock`, `A_SHOCKWAVE` | bossFlag boolean/KB spec一部 | 不足 | bossType and shock runtime |
| KB distance | BCU constants/status dependent | `BcuKnockbackSpec` | 部分 | BCU spec table化 |
| KB duration/frame | `KBManager`, AnimManager | `stepKnockbackFrame` | 近い | frame clock統一 |
| KB animation | `AnimManager.kbAnim` | actor KB anim/kbeff | 部分 | main/back anim分離 |
| kbeff | `EffAnim.A_KB` | `BcuKbeffLoader` | 近い | effect runtimeへ統合 |
| targetable during KB | `touchable()` mask | `isTargetable` simplified | 不足 | touch mask導入 |
| death animation | `AnimManager.kill` | dead state | 簡略 | death anim done cleanup |
| wave/surge/crit effect | `EffAnim`, continuation | なし/弱い | 未実装 | EffectRuntime category追加 |
| effect coordinate | world pos/layer | world-ish | 近い | unified world effect |

### 10.2 KBRuntime設計

```js
export class KBRuntime {
  start(actor, reason, context) {
    const spec = this.specTable.resolve(reason, actor, context);
    actor.kb = {
      reason,
      frame: 0,
      durationFrame: spec.durationFrame,
      fromX: actor.x,
      toX: actor.x + spec.distanceWorld * -actor.direction,
      touchMask: spec.touchMask,
      animationId: spec.animationId,
      effects: spec.effects,
    };
  }

  step(actor) {
    if (!actor.kb) return [];
    actor.kb.frame++;
    actor.x = interpolateKb(actor.kb);
    if (actor.kb.frame >= actor.kb.durationFrame) return this.finish(actor);
    return [];
  }
}
```

### 10.3 EffectRuntime設計

```js
export class EffectRuntime {
  spawn(type, { x, y, layer, direction, source, payload }) {
    const asset = this.effectAssetResolver.resolve(type, payload);
    this.effects.push(new BattleEffectRuntime({ type, asset, x, y, layer, direction }));
  }

  stepFrame() {
    for (const effect of this.effects) effect.stepFrame();
    this.effects = this.effects.filter((e) => !e.done);
  }
}
```

### 10.4 現コードの修正対象

- `BattleActor.resolvePostDamage` からKB開始判定を `KBRuntime` へ移す。
- `BattleScene.tickKnockback` を `KBRuntime.step` へ置き換える。
- `BcuKbeffRuntime` を `EffectRuntime` の1カテゴリにする。
- `BattleEffectLoader` はhit/crit/wave/surge/death/smoke/kbeffを统一的にresolveする。
- `BattleSceneRenderer.drawEffects` はeffect world coordinateをcameraで投影するだけにする。

---

## 第11章：アニメーション・モデル・描画比較

### 11.1 比較表

| 項目 | BCU common | 現コード | 一致/差分 | 修正案 |
|---|---|---|---|---|
| imgcut parse | `ImgCut.java` | `BcuImgcutParser`, `BcuSpriteSheet` | 概ね一致 | crop validation追加 |
| mamodel parse | `MaModel.java` | `BcuModelParser`, `BcuModelInstance` | 概ね一致 | parent loop / invalid id clamp追加 |
| maanim parse | `MaAnim.java`, `Part.java` | `BcuAnimParser`, `BcuAnimator` | 部分 | loop/easing/protect実装 |
| part hierarchy | `EPart` parent | `BcuModelInstance` parent matrix | 近い | modification mapping再確認 |
| parent matrix | `EPart.drawPart` | `getBattleDrawList` | 近い | local/world単位を明文化 |
| pivot/scale/rotation | `EPart.alter/drawPart` | model transforms | 近い | BCU exact transform tests |
| opacity | `EPart` | draw list opacity | 近い | glow/extend対応 |
| z-order | `EPart.compareTo` | z sort | 近い | stable sort parity test |
| interpolation/easing | `Part.update`多種 | 簡略 | 差大 | BcuAnimatorにeasing port |
| frame advance | `MaAnim.update` | ms→frame | 差 | frame clock連動 |
| animation switching | `EAnimD.changeAnim` | actor.setAnimation | 部分 | done/loop semantics追加 |
| renderFlipX/direction | EAnim/graphics transform | renderer flip | 部分 | side/facing/renderFlip分離 |
| visual offset vs combat | Entity pos + model local | actor.x + offsets | 混在 | CombatAnchor/VisualAnchor分離 |
| attack animationとhit timing | AtkManager preTime | BattleAttackProfile | 近い | frame exact化 |

### 11.2 現コードでBCUと一致している部分

- imgcut/mamodel/maanimという資産三層を読む構造。
- model instanceがparent transformを持つ構造。
- actor root positionとpart local transformを分ける方向性。
- z-order sortとopacityを持つ方向性。
- attack animationとdamage hit timingを別データとして扱う方向性。

### 11.3 現コードでBCUと違う部分・簡略化

- `BcuAnimator` が非常に薄く、BCU `MaAnim.update` / `Part.update` のloop/easing/rotate/protectを完全に持たない。
- `BcuModelInstance.applyTrack` のmodification mappingをBCU `EPart.alter` と完全照合するtestが必要。
- rendererがlocal pixel offsetをworld座標へ混ぜる箇所がある。
- castle/backgroundもunitと同じanimation runtimeへ統合されていない。
- attack animation end / wait / recover frameとbattle update frameの関係がms寄り。

### 11.4 BcuAnimator / BcuModelInstance 修正案

1. `BcuAnimationClip` を作り、raw maanim trackをBCU `Part`互換に保持。
2. `BcuAnimator.stepFrame()` を追加し、battle frame clockで進める。
3. `valueAtBcu` をBCU `Part.update` のeasingと同じ式にする。
4. `BcuModelInstance.applyModification(partId, modification, value)` をBCU `EPart.alter`のcase番号に合わせてtestする。
5. `getBattleDrawList` はscreen座標を返さず、local model draw commandだけを返す。
6. `BattleSceneRenderer` が `worldRoot -> camera -> local model matrix` の順で合成する。

---

## 第12章：編成・生産・経済比較

### 12.1 比較表

| 項目 | BCU common | 現コード | 差分 | 改善案 |
|---|---|---|---|---|
| costをどこから読むか | `DataUnit.price` | `BattleStatsLoader`→`BattleEconomy.produce` | 近い | stats model経由で統一 |
| respawnをどこから読むか | `DataUnit.respawn = ints[7]*2` | `respawnFrames`→cooldownMs | frame→ms変換 | frame cooldownにする |
| cooldown単位 | frame | ms | 差 | `ProductionRuntime.stepFrame` |
| production request timing | `StageBasis.act_spawn` | UI eventで即request | frame queue差 | input queue化 |
| max unit count | `maxNum`, `entityCount` | 直接統合弱い | 不足 | deploy counter追加 |
| money増加 | worker/wallet/treasure/combo | `incomePerSecond` | 簡略 | WalletRuntime追加 |
| worker level | あり | なし | 未実装 | WorkerCatRuntime |
| UIとruntime分離 | line up/runtime別 | UIとeconomy分離はある | 良い | UIはruntime statusを読むだけにする |
| 5枠固定か可変か | lineup 10枠文化 | `FormationStore` 2×5、barは5列front/back | 近い | row swap/lineup changeをruntime化 |
| formation | `LineUp`, `ELineUp` | `FormationStore`, `FormationEditor` | 近い | slot id to unit form model統一 |

### 12.2 現コード改善案

- `BattleEconomy` を `ProductionRuntime` と `WalletRuntime` に分ける。
- `cooldownMs` を廃止し、`cooldownFrame` を保持する。
- `PlayerProductionBar` は `ProductionRuntime.getSlotStatus(slotId)` を読むだけにする。
- `requestPlayerSpawn` は即spawnせず `inputQueue.enqueue({frame, slotId})` に入れる。
- `BattleScene.stepFrame` のproduction phaseでwallet/cooldown/max unitを判定する。

---

## 第13章：根本差分一覧

| 分野 | BCU common path/class/method | 現コード path/class/method | BCUのやり方 | 現コードのやり方 | 差分の本質 | 現コードで起きる問題 | BCU寄せ修正 | 優先度 | 難度 | 依存関係 | テスト方法 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| stage parser | `util/stage/Stage.java` | `StageDefinitionLoader.js` | SCDef準拠・fallbackあり | object化・座標込み | parser責務混在 | rowIndex bug等 | parser純化 | 最優先 | 中 | なし | fixture CSV parse |
| enemy row identity | `SCDef.Line` | `enemyRows` | line index明確 | rowIndexなし | identity欠落 | unitDef mapping崩壊 | rowIndex保証 | 最優先 | 低 | parser | 2 enemy rows test |
| row0 semantics | `Stage.java` | `StageDefinitionLoader` | non_continue | cannonId | 列意味誤読 | debug/logic誤り | nonContinueへ | 高 | 低 | parser | row0 test |
| spawn runtime | `EStage` | `BcuStageSpawnRuntime` | frame rem | ms nextAt | 時間単位差 | 湧きズレ | frame runtime | 高 | 中 | clock | deterministic spawn test |
| base HP trigger | `EStage.inHealth` | BattleScene context | actual HP | 100固定 | trigger入力誤り | HP trigger不動 | actual percent | 最優先 | 低 | base runtime | trigger stage test |
| stage global respawn | `StageBasis.respawnTime` | なし | global gateあり | rowごと | 湧き頻度差 | 過湧き/同時湧き | global gate | 中 | 中 | spawn runtime | min/max spawn test |
| max enemy count | `SCDef.allow` | alive count | will weight | count only | entity weight差 | cap差 | will導入 | 中 | 中 | stats | will test |
| stats倍率 | `EStage.allow` | row保持 | hp/atk倍率適用 | 未適用 | spawn stats差 | 敵が弱い/強い | apply line magnification | 最優先 | 中 | stats loader | magnification test |
| background | `StageBasis.setBackground` | `StageBackgroundLoader.load(config)` | bgId駆動 | config駆動 | bgId未接続 | 背景不一致 | bg resolver | 高 | 中 | stage parser | bg fixture |
| castle | `CastleImg`, `boss_spawn` | `BcuCastleAssetLoader` | metadata込み | image candidate | metadata不足 | boss spawn不一致 | castle resolver | 高 | 中 | stage parser | castle id test |
| update order | `StageBasis.update` | `BattleScene.tick` | capture all→excuse all | actor loop queue | phase差 | 同時hit差 | phase分離 | 高 | 高 | frame clock | simultaneous attack test |
| attack/proc | `AttackSimple/Entity` | `BattleAttackResolver` | proc full | damage only | ability未実装 | 本家挙動不可 | Damage/Proc分離 | 高 | 高 | stats ability | proc tests |
| KB/death | `KBManager/AnimManager` | `BattleActor` | token/effect連携 | 部分 | state不足 | KB中target差 | KBRuntime | 中 | 中 | proc | KB test |
| animation | `MaAnim/Part/EPart` | `BcuAnimator/ModelInstance` | easing/loop full | 簡略 | asset再現差 | 動きズレ | animator parity | 中 | 高 | renderer | anim snapshot test |
| economy | `StageBasis.act_spawn` | `BattleEconomy` | frame/worker/max | ms/simple | runtime差 | cooldown/money差 | ProductionRuntime | 中 | 中 | clock | production fixture |

---

## 第14章：現コードをBCU寄せする実装ロードマップ

### Phase 1. DebugBattleInspector追加

- 目的: `castleId/bgId/stageLen/enemyRows/baseHp/spawnState/camera` を可視化する。
- 変更対象: `BattleScene.js`, `BattleSceneRenderer.js`
- 新規: `js/battle/DebugBattleInspector.js`
- 縮小責務: renderer内debug散在。
- 追加関数: `collectBattleDebugSnapshot(scene)`。
- 完了条件: debug overlayにStageDefinitionとRuntimeの差が出る。
- テスト: fixture stageでcastleId/bgIdが表示される。
- rollback: feature flag off。
- Codexプロンプト: `DebugBattleInspectorを追加し、stage definition/runtime/camera/spawn row stateを1 objectに集約してrenderer overlayから表示してください。`

### Phase 2. StageDefinitionLoader純parser化

- 目的: CSV parseとruntime座標を分離。
- 変更対象: `StageDefinitionLoader.js`
- 新規: `StageDefinition.js`, `StageEnemyLine.js`
- 変更関数: `parse`, `createFallback`
- 追加関数: `parseStageHeader`, `parseStageMeta`, `parseStageEnemyLine`
- 疑似コード: 第5章参照。
- 完了条件: `rowIndex`あり、row0/row1意味がBCU準拠。
- テスト: rowIndex、castleId fallback、bgId、S0/R0/R1*2、reverse。
- rollback: old parser adapterを残す。

### Phase 3. StageRuntime導入

- 目的: stageLen/base座標/spawn座標/max countをruntime化。
- 変更対象: `BattleScene.js`
- 新規: `StageRuntime.js`, `StageCoordinate.js`
- 削除/縮小: `StageDefinitionLoader`の座標出力。
- 完了条件: `BattleScene.buildStageRuntime` がclassへ移る。
- テスト: stageLen=6000でbase/spawn座標一致。
- rollback: legacy runtime builder flag。

### Phase 4. BattleScene.initロード順修正

- 目的: StageDefinition → Runtime → Asset resolve → Base → Spawn → Cameraの順に固定。
- 変更対象: `BattleScene.js`
- 完了条件: selected stage configからすべて読み込む。
- テスト: stage切替でCSV/bg/castleが同時に変わる。
- rollback: initLegacy。

### Phase 5. CastleAssetResolver導入

- 目的: castleId fallback、asset candidate、debugを整理。
- 変更対象: `BcuCastleAssetLoader.js`, `BattleBase.js`
- 新規: `CastleAssetResolver.js`
- 完了条件: missing castle id時にwanted id/reason/fallback idがdebugへ出る。
- テスト: valid/missing/-1 castle id。

### Phase 6. StageBackgroundResolver導入

- 目的: `bgId` を背景assetへ接続。
- 変更対象: `StageBackgroundLoader.js`, `BattleSceneRenderer.js`
- 新規: `StageBackgroundResolver.js`
- 完了条件: CSV bgId変更で背景が変わる。
- テスト: bgId fixture。

### Phase 7. BattleSpawnResolver導入

- 目的: spawn world xの唯一化。
- 変更対象: `BattleScene.js`, `BattleSpawnResolver.js`
- 新規/修正: `getEnemySpawnWorldX`, `getPlayerSpawnWorldX`
- 完了条件: getSpawnWorldXがStageRuntime/Resolverのみ参照。
- テスト: stageLen別spawn位置。

### Phase 8. CameraTransform統一

- 目的: cameraを唯一のworld/screen投影器にする。
- 変更対象: `BattleCamera.js`, `BattleCameraInputController.js`
- 完了条件: zoom/panでstageLen不変。
- テスト: zoom before/after worldToScreen/screenToWorld roundtrip。

### Phase 9. BattleSceneRenderer world座標統一

- 目的: background/base/actor/effectを同一座標系にする。
- 変更対象: `BattleSceneRenderer.js`, `BattlefieldRenderTransform.js`
- 完了条件: actor/base/effectがcamera scrollで同じ量動く。
- テスト: debug grid overlay。

### Phase 10. EnemySpawnRuntime完全CSV駆動化

- 目的: BCU EStage相当のframe spawn runtime。
- 変更対象: `BcuStageSpawnRuntime.js`, `BattleScene.tick`
- 新規: `EnemySpawnRuntime.js`, `StageSpawnGate.js`
- 疑似コード: 第6章参照。
- 完了条件: firstFrame/respawn/baseHpTrigger/count/killCountがframeで動く。
- テスト: deterministic spawn fixture。

### Phase 11. BattleFrameClock導入

- 目的: 30fps fixed-step。
- 変更対象: `BattleSimulationClock.js`, `BattleScene.js`
- 新規: `BattleFrameClock.js`
- 完了条件: logicはframe単位、renderはinterpolation optional。
- テスト: 1秒で30 frame。

### Phase 12. ActorStatsModel統一

- 目的: unit/enemy共通statsとstage倍率適用。
- 変更対象: `BattleStatsLoader.js`, `BcuStatsSchema.js`, `BattleActorFactory.js`
- 新規: `ActorStatsModel.js`
- 完了条件: enemy spawn eventのhp/atk倍率がactorに反映。
- テスト: 200% magnification enemy HP/ATK。

### Phase 13. AttackTimeline導入

- 目的: hit frame、range shape、proc payloadのtimeline化。
- 変更対象: `BattleAttackProfile.js`, `BattleActor.js`
- 新規: `AttackTimeline.js`
- 完了条件: multi-hit/LD/omniをframe hitで処理。
- テスト: multi-hit frame snapshot。

### Phase 14. DamageCalculator導入

- 目的: trait/ability/metal/barrier/shield/base destroyerをdamage計算へ。
- 変更対象: `BattleAttackResolver.js`, `BattleActor.js`
- 新規: `DamageCalculator.js`
- 完了条件: raw damage直適用が消える。
- テスト: metal/critical/base destroyer。

### Phase 15. ProcResolver導入

- 目的: freeze/slow/weaken/KB/warp/curse/toxic等をstate event化。
- 新規: `ProcResolver.js`, `ActorStatusRuntime.js`
- 完了条件: procはdamageとは別eventで適用。
- テスト: proc probability deterministic RNG。

### Phase 16. KBRuntime導入

- 目的: KB stateをBattleActorから分離。
- 変更対象: `BattleActor.js`, `BattleScene.tickKnockback`
- 新規: `KBRuntime.js`
- 完了条件: HP KB/final KB/proc KB/boss shockが同一API。
- テスト: KB distance/frame。

### Phase 17. EffectRuntime導入

- 目的: hit/kbeff/wave/surge/crit/death effect統合。
- 新規: `EffectRuntime.js`, `EffectAssetResolver.js`
- 完了条件: effectsはworld coordinateでspawn/render。
- テスト: effect camera projection。

### Phase 18. AnimationRuntime改善

- 目的: BCU MaAnim/Part/EPart parity。
- 変更対象: `BcuAnimator.js`, `BcuModelInstance.js`, `BcuModelParser.js`
- 新規: `BcuAnimationRuntime.js`
- 完了条件: easing/loop/modification parity tests通過。
- テスト: known asset snapshot。

### Phase 19. ProductionRuntime改善

- 目的: frame cooldown/wallet/worker/max deploy。
- 変更対象: `BattleEconomy.js`, `PlayerProductionBar.js`, `BattleScene.requestPlayerSpawn`
- 新規: `ProductionRuntime.js`, `WalletRuntime.js`
- 完了条件: production UIはruntime statusのみ読む。
- テスト: cost/cooldown/max deploy。

### Phase 20. 大量キャラ対応

- 目的: lazy load/cache/asset diagnostics。
- 変更対象: `BattleActorFactory.js`, `BcuAssetLoader.js`, registries。
- 完了条件: 大量unit/enemyでも初回描画が破綻しない。
- テスト: 100 asset preload smoke test。

---

## 第15章：Codex向け実装タスク分割

### Task 1: StageDefinitionLoader / StageRuntime / BattleScene.init

- 目的: stage CSVをBCU準拠の純dataとして読み、StageRuntimeへ渡す。
- 変更ファイル: `StageDefinitionLoader.js`, `BattleScene.js`
- 新規ファイル: `StageDefinition.js`, `StageRuntime.js`, `StageEnemyLine.js`
- 変更内容: row0/row1列意味修正、rowIndex追加、runtime座標分離、init順修正。
- 禁止事項: parserでcamera/screen座標を作らない。`rowIndex`なしのenemy rowを返さない。
- 疑似コード: 第5章。
- テスト: fixture CSVでcastleId/bgId/stageLen/enemyRows reverse/rowIndex/frame*2をassert。
- 受け入れ条件: `BcuStageSpawnRuntime` が全rowで正しいunitDefを引ける。

### Task 2: CastleAssetResolver / BcuCastleAssetLoader / BattleBase

- 目的: castleIdを敵城assetへ確実に流す。
- 変更ファイル: `BcuCastleAssetLoader.js`, `BattleBase.js`, `BattleScene.js`
- 新規: `CastleAssetResolver.js`
- 禁止事項: missing理由なしに0番fallbackしない。
- 疑似コード:
```js
resolveEnemyCastle({ castleId, animBaseId }) {
  const candidates = buildCastleCandidates(castleId, animBaseId);
  const result = tryLoad(candidates);
  return result.ok ? result : fallbackWithDiagnostic(castleId, result.reason);
}
```
- テスト: valid id/missing id/-1 fallback。
- 受け入れ条件: debug snapshotにwanted/fallback castle idが出る。

### Task 3: StageBackgroundResolver / BattleSceneRenderer

- 目的: StageDefinition.bgIdで背景を選ぶ。
- 変更ファイル: `StageBackgroundLoader.js`, `BattleSceneRenderer.js`, `BattleScene.js`
- 新規: `StageBackgroundResolver.js`
- 禁止事項: `BATTLE_CONFIG.stage.imagePath`だけで背景を固定しない。
- 疑似コード:
```js
const bg = await backgroundResolver.resolve(stageDef.meta.bgId);
scene.stage.background = bg;
```
- テスト: bgId違いのstageでbackground assetが変わる。
- 受け入れ条件: `runtime.bgId` と描画asset idが一致。

### Task 4: BattleSpawnResolver / getSpawnWorldX / EnemySpawnRuntime

- 目的: spawn座標とspawn scheduleをBCU準拠にする。
- 変更ファイル: `BcuStageSpawnRuntime.js`, `BattleScene.js`, `BattleSpawnResolver.js`
- 新規: `EnemySpawnRuntime.js`, `StageSpawnGate.js`
- 禁止事項: `enemyBaseHpPercent: 100`固定を残さない。ms absolute scheduleに依存しない。
- 疑似コード: 第6章。
- テスト: firstFrame, respawn range, baseHpTrigger, count=0, maxEnemyCount。
- 受け入れ条件: frame deterministic spawn logがfixture期待値と一致。

### Task 5: BattleCamera / BattleCameraInputController / zoom-scroll

- 目的: world/screen transformを統一し、zoomでstageLenを変えない。
- 変更ファイル: `BattleCamera.js`, `BattleCameraInputController.js`, `BattleSceneRenderer.js`
- 禁止事項: rendererでscreen offsetをworld xへ混ぜない。
- 疑似コード:
```js
const sx = camera.worldToScreenX(worldX);
const local = modelLocalMatrix(...);
ctx.setTransform(cameraScale * local);
```
- テスト: roundtrip、zoom clamp、stageLen不変。
- 受け入れ条件: pinch/wheel後もbase/spawn world xが不変。

### Task 6: BattleFrameClock / tick order

- 目的: BCU `StageBasis.update`に近いphase orderへする。
- 変更ファイル: `BattleScene.js`, `BattleSimulationClock.js`
- 新規: `BattleFrameClock.js`, `BattleSimulationRuntime.js`
- 禁止事項: actor loop中にdamageを即反映しない。
- 疑似コード:
```js
stepFrame() {
  spawnPhase(); productionPhase(); entityMovePhase(); attackStartPhase();
  attackCapturePhase(); attackExcusePhase(); postDamagePhase(); effectPhase(); cleanupPhase();
}
```
- テスト: simultaneous attack capture before damage。
- 受け入れ条件: all attack targets captured before any damage applied。

### Task 7: AttackTimeline / BattleAttackProfile / BattleAttackResolver

- 目的: hit frame/range/proc payloadをtimeline化。
- 変更ファイル: `BattleAttackProfile.js`, `BattleAttackResolver.js`, `BattleActor.js`
- 新規: `AttackTimeline.js`, `RangeShape.js`
- 禁止事項: animation elapsed msだけでhit判定しない。
- テスト: multi-hit/LD/omni/single/area。
- 受け入れ条件: hit frameがstats preFrameと一致。

### Task 8: DamageCalculator / AbilityModel / ProcResolver

- 目的: BCU stats能力を戦闘へ接続。
- 変更ファイル: `BattleStatsLoader.js`, `BcuStatsSchema.js`, `BattleAttackResolver.js`, `BattleActor.js`
- 新規: `ActorStatsModel.js`, `AbilityModel.js`, `DamageCalculator.js`, `ProcResolver.js`
- 禁止事項: raw damageを直接HPへ入れない。
- テスト: critical, metal, massive/resist, barrier, shield, freeze/slow/weaken。
- 受け入れ条件: damage eventとproc eventが別々にdebug表示される。

### Task 9: KBRuntime / EffectRuntime

- 目的: KB/death/effectをBCU風phaseに分離。
- 変更ファイル: `BattleActor.js`, `BattleScene.js`, `BattleSceneRenderer.js`, `BcuKbeffLoader.js`
- 新規: `KBRuntime.js`, `EffectRuntime.js`, `EffectAssetResolver.js`
- 禁止事項: effectをscreen coordinateで保存しない。
- テスト: HP KB/final KB/proc KB/kbeff/death cleanup。
- 受け入れ条件: KB中targetability maskがstateで確認できる。

### Task 10: AnimationRuntime / BcuAnimator / BcuModelInstance

- 目的: `MaAnim/Part/EPart` parityを上げる。
- 変更ファイル: `BcuAnimator.js`, `BcuModelInstance.js`, `BcuAnimParser.js`, `BattleSceneRenderer.js`
- 新規: `BcuAnimationRuntime.js`
- 禁止事項: BCU modification番号を独自意味に変えない。
- テスト: imgcut/mamodel/maanim fixture, easing, z-order, parent transform snapshot。
- 受け入れ条件: known assetのframe poseが期待matrixに一致。

### Task 11: ProductionRuntime / BattleEconomy / PlayerProductionBar

- 目的: economy/productionをframe runtime化。
- 変更ファイル: `BattleEconomy.js`, `BattleScene.requestPlayerSpawn`, `PlayerProductionBar.js`, `FormationStore.js`
- 新規: `ProductionRuntime.js`, `WalletRuntime.js`
- 禁止事項: UI componentがmoney/cooldownを直接進めない。
- テスト: cost, respawnFrame, cooldownFrame, max deploy, row switch。
- 受け入れ条件: ProductionBarは`getSlotStatus`を表示するだけになる。

---

## 第16章：未解消点

今回の未解消点は、ZIP内に存在しない対象、または指定2 repoの範囲外に限定する。ZIP内に存在する対象ファイルは本文を読んだ。

| 未解消項目 | ZIP内で探したpath | ZIP内で使った検索語 | 読んだ代替ファイル | なぜ解消できなかったか | 次に必要な情報 | 実装判断への影響 |
|---|---|---|---|---|---|---|
| 現コード `package.json` | `game-main/package.json` | `package.json` | `README.md`, `index.html`, `js/*` | rootに存在しない。browser app構成でnpm metadataなし。 | 不要。build/test commandを知りたい場合のみ別途必要。 | 自動test script名は判断不能。Codexにはbrowser/js file単位で指示。 |
| BCU common `common/` directory | `BCU.../common/` | `common`, `package common` | `CommonStatic.java`, root Java files | directoryとしては存在しない。Java package名が`common`。 | 不要。 | package構造説明ではroot Java filesとして扱う。 |
| BCU common `jogl/` directory | `BCU.../jogl/` | `jogl`, `FakeGraphics`, `draw` | `util/anim/EPart.java`, `EAnimD.java`, `util/pack/Background.java` | common ZIPにJOGL実装directoryは存在しない。描画はFakeGraphics抽象に寄っている。 | PC描画層まで完全比較するなら別repo ZIPが必要。 | 現コードrenderer比較はcommon側のanim/background draw modelまでに限定。 |
| BCU PC app layerのcamera/UI renderer | 指定2 ZIP内全体 | `camera`, `jogl`, `renderer`, `draw` | `StageBasis`, `Background`, `EPart`, `EAnimD` | 指定ZIPはBCU commonでありPC app layerを含まない。 | PC app repo ZIP。 | camera UIについては現コード側実装とcommonのworld model比較に留める。 |
| BCU full castle enemy asset metadata mapping | `util/stage/CastleImg.java`, `util/pack/NyCastle.java`, asset dirsなし | `castle`, `boss_spawn`, `nyankoCastle` | `StageBasis.java`, `BcuCastleAssetLoader.js` | common ZIPには資産実体repoがない。CastleImg modelは読めるがasset pack実体は現コード側のみ。 | BCU asset distribution ZIP。 | CastleAssetResolverは現コードasset treeに合わせて実装し、metadata不足はdiagnosticで扱う。 |

---

## 最終結論

1. 今回のZIP実コード読解により、前回未確認だったBCU commonの `battle` runtimeは `battle/StageBasis.java`、`battle/entity/Entity.java`、`battle/attack/*` で確認できた。特にupdate orderは `StageBasis.update()` 内に明確にあり、`stage spawn → entity update → attack capture全件 → attack excuse全件 → postUpdate → cleanup` である。

2. 現コードはBCUのstage parser仕様へかなり寄せている。`enemyId - 2`、spawn/respawn frame `*2`、baseHpTrigger/magnification swap、enemy row reverseは実装済みである。一方で `rowIndex` 未設定、row0 col1の `cannonId` 誤読疑い、bossGuard row違い、bgId未接続、stage倍率未適用が重大である。

3. 最優先修正は、`StageDefinitionLoader`の純parser化と `rowIndex` 保証、`BcuStageSpawnRuntime`のframe化、`BattleScene.tick` の `enemyBaseHpPercent: 100` 固定撤廃、enemy stage倍率のstats適用、bgId/castleIdをasset resolverへ流すことである。

4. BCU commonはproc/ability/damage/KB/deathが `DataUnit/DataEnemy → AtkModelEntity/AttackSimple → Entity.processProcs/postUpdate → StageBasis.update` に分かれている。現コードはattack timelineとtarget captureの骨格はあるが、DamageCalculator/ProcResolver/AbilityModelが未分離であるため、ここを導入しない限りBCU再現には届かない。

5. animationは現コードも `imgcut/mamodel/maanim` 三層を扱えているが、BCU commonの `MaAnim/Part/EPart` と比べると `BcuAnimator` が簡略である。easing、loop、modification mapping、parent transform、z-order parityをfixture testで固める必要がある。

6. Codexに渡すべき実装は、第15章のTask 1〜11の順で分割するのが安全である。特にTask 1〜4を先に終えないと、背景・城・spawn・stats・attackの後続修正が正しい入力を受け取れない。
