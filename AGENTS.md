# Agent.md — rhgrive2/game BCU寄せ一括改修指示書

このファイルは、Codex に `https://github.com/rhgrive2/game` の作業ツリーを修正させるための実行指示書である。Codex はこの文書を最優先の実装方針として読み、**本文を読まずに推測で実装してはいけない**。

> 推奨配置: repo root の `Agent.md`。Codex が `AGENTS.md` を優先参照する環境では、同じ内容を `AGENTS.md` としても置くこと。

---

## 0. 今回の目的

現コード `rhgrive2/game` の戦闘・ステージ・描画・ロジック実装を、BCU common の実装思想に寄せる。

最重要の移行方針は以下。

1. `StageDefinitionLoader` を **純parser** にする。
2. CSV由来値を `StageDefinition` / `StageRuntime` に保持し、`BattleConfig` の固定値で上書きしない。
3. `castleId`, `animBaseId`, `bgId`, `stageLen`, `enemyBaseHp`, `maxEnemyCount`, `enemyRows` を `BattleScene.init` から runtime / asset resolver / renderer まで流す。
4. 敵出現を `EnemySpawnRuntime` で **frame based / CSV row based** にする。
5. `actor.worldX`, `base.worldX`, `spawnX`, `stageLen` は world 座標として固定し、zoom / pinch / scroll で変更しない。
6. `BattleCamera` は `worldToScreen` / `screenToWorld` 変換だけを担当する。
7. `BattleScene` から parser / asset resolve / damage / proc / KB / effect / animation の責務を分離する。
8. 既存UIと既存assetを壊さず、fallbackとdebug reportを残しながら段階的に置換する。

---

## 1. 絶対禁止事項

以下は禁止。

- GitHubや外部リンクを見に行って、現repo本文の代替にすること。
- 対象ファイル本文を読まずに推測で変更すること。
- `public/assets/bcu/` 配下の大量assetを削除・移動・リネームすること。
- npm依存を追加すること。現repoは `package.json` のない browser app 構成として扱う。
- `stageLen`, `actor.worldX`, `base.worldX`, `spawnX` を zoom / pinch / wheel 処理で変更すること。
- CSV由来の `castleId`, `bgId`, `stageLen`, `enemyBaseHp`, `maxEnemyCount`, `enemyRows` を `BattleConfig` の固定値で無条件上書きすること。
- fallbackを無言で行うこと。fallbackした場合は debug report / inspector / warning に残すこと。
- `BattleScene.js` に新しい巨大責務を追加すること。`BattleScene` は orchestration に寄せる。
- renderer内で戦闘判定・spawn判定・damage判定を行うこと。
- UI座標、screen座標、world座標、BCU model local transform を混在させること。
- 攻撃アニメーションの見た目進行と hit / damage timing を同一処理に押し込めること。
- 既存featureを消して「簡単に動く」だけの仮実装に置き換えること。

---

## 2. 変更前に必ず読むファイル

作業開始時、以下のファイル本文を必ず読む。

### Stage / spawn / scene

- `js/battle/StageDefinitionLoader.js`
- `js/battle/BcuStageSpawnRuntime.js`
- `js/battle/BcuStageEnemyResolver.js`
- `js/battle/StageSpawnPreviewBuilder.js`
- `js/battle/BattleScene.js`
- `js/battle/BattleConfig.js`

### Base / camera / renderer / assets

- `js/battle/BattleBase.js`
- `js/battle/BattleCamera.js`
- `js/battle/BattleSceneRenderer.js`
- `js/battle/StageBackgroundLoader.js`
- `js/battle/BcuCastleAssetLoader.js`
- `js/battle/BattleBodyResolver.js`

### Stats / actor / attack / effect

- `js/battle/BattleStatsLoader.js`
- `js/battle/BcuStatsSchema.js`
- `js/battle/BattleActorFactory.js`
- `js/battle/BattleActor.js`
- `js/battle/BattleAttackProfile.js`
- `js/battle/BattleAttackResolver.js`
- `js/battle/BattleEffect.js`
- `js/battle/BattleEffectLoader.js`
- `js/battle/BcuKbeffLoader.js`
- `js/battle/BattleEconomy.js`

### Preview / UI / BCU animation

- `js/preview/BattleSimulationClock.js`
- `js/preview/BattleCameraInputController.js`
- `js/ui/PlayerProductionBar.js`
- `js/ui/FormationEditor.js`
- `js/data/previewAssets.js`
- `js/bcu/BcuAssetLoader.js`
- `js/bcu/BcuSpriteSheet.js`
- `js/bcu/BcuModelInstance.js`
- `js/bcu/BcuAnimator.js`

---

## 3. BCU common実コードからの移植前提

以下は BCU common ZIP 実コードから確認済みの設計前提である。現コードをこの思想に寄せること。

### 3.1 Stage parser

BCU common の `util/stage/Stage.java` は stage CSV を読み、少なくとも以下を `Stage` に保持する。

- `len`
- `health`
- `minSpawn`
- `maxSpawn`
- `bg`
- `max`
- `timeLimit`
- `bossGuard`
- `castle`
- `data: SCDef`

`Stage.java` の読み込みでは、CSVの2行目相当から以下を読む。

```text
len        = strs[0]
health     = strs[1]
minSpawn   = strs[2]
maxSpawn   = strs[3]
bg         = strs[4]
max        = min(50, strs[5])
timeLimit  = strs[7] if present
bossGuard  = strs[8] if castle data exists
```

敵行は `util/stage/SCDef.java` の `SCDef.Line` に正規化される。

`SCDef` の主要index:

```text
E  = 0   enemy id
N  = 1   number/count
S0 = 2   first spawn frame base
R0 = 3   respawn min frame base
R1 = 4   respawn max frame base
C0 = 5   castle/base HP trigger
L0 = 6   layer min
L1 = 7   layer max
B  = 8   boss flag
M  = 9   hp magnification / default magnification
S1 = 10  spawn secondary / extra
C1 = 11  castle secondary / extra
G  = 12  group
M1 = 13  attack magnification
KC = 14  kill count trigger
SC = 15  score
```

`Stage.java` では敵行に以下の補正がある。

- `data[0] -= 2`
- `data[2] *= 2`
- `data[3] *= 2`
- `data[4] *= 2`
- `!trail && data[5] > 100 && data[9] == 100` の場合、`data[9] = data[5]`, `data[5] = 100`
- `ss[10]` があれば score
- `ss[11]` が整数なら `M1`。ただし `M1 == 0` なら `M` を使う
- `ss[12] == 1` なら `S0 *= -1`
- `ss[13]` が整数なら `KC`
- base enemy row の場合 `C0 = 0`
- 最終的に `SCDef.Line` 配列は読み込み順を反転して格納している

現コード側ではこの補正を、無理に完全コピーするのではなく、**StageDefinitionとして意味が分かるfield名へ正規化**する。

### 3.2 BCU battle update order

BCU common の `battle/StageBasis.java` の update comment は以下の意味を持つ。

```text
process actions and add enemies from stage first
then update each entity
and receive attacks
then execute attacks
and do post update
then delete dead entities
```

`StageBasis.update()` では大枠として以下の順に処理する。

1. battle active 判定
2. background effect 初期化 / update
3. player deploy request / duplicate deploy処理
4. enemy spawn check
5. respawn timer decrement
6. lineup / cooldown / economy update
7. enemy stage controller update
8. entity update
9. attack capture
10. attack execute
11. base postUpdate
12. entity postUpdate
13. boss shockwave / effect
14. dead entity / wave / effect cleanup
15. money / cannon clamp

現コードの `BattleScene.tick` は、この順序に寄せる。ただし一気に完全一致を狙わず、まず以下を守る。

- spawn check は actor update より前
- movement / target search / attack start は actor update phase
- hit target capture と damage resolve は attack phase
- KB/death/effect cleanup は post phase
- render は simulation step の後

---

## 4. 現コードで既知の重点修正点

現コードZIP実読解で、以下は特に壊れやすい。

1. `StageDefinitionLoader.js` が `rowIndex` を正しく設定していない可能性がある一方、`BcuStageSpawnRuntime.js` は `stageSpawn?.rowIndex` / `row.rowIndex` で対応付ける。
2. `BattleScene.tick` が `stageSpawnRuntime.tick(... enemyBaseHpPercent: 100 ...)` のように敵城HP triggerを固定値で渡している可能性がある。
3. `bgId` が stage definition から背景asset resolver / rendererまで十分に流れていない可能性がある。
4. `castleId` / `animBaseId` が敵城asset / `BattleBase` へ確実に流れていない可能性がある。
5. `stageLen` が runtime world幅としてではなく、configやcamera/zoom処理と混ざる可能性がある。
6. enemy row の `magnification`, `mult_atk`, `baseHpTrigger`, `bossFlag`, `layer`, `kill_count` が actor stats / spawn runtime へ十分に適用されていない可能性がある。
7. `BattleScene` が parser、runtime、spawn、combat、effect、debugを持ちすぎているため、責務を段階的に外へ出す必要がある。

---

## 5. 一括実行モードの進め方

今回はトークン節約と一括実行を優先する。Codex は以下の順で実装する。

ただし、**各Phase完了ごとに内部で自己検証すること**。あるPhaseが破綻した場合、後続Phaseへ進むより、破綻Phaseを最小修正して通すことを優先する。

### 完了優先度

時間やコンテキストが足りない場合は、以下の順で完了させる。

1. Phase A: 監査・debug可視化
2. Phase B: `StageDefinitionLoader` 純parser化
3. Phase C: `StageRuntime` / `BattleScene.init` ロード順修正
4. Phase D: castle/background/spawn/camera world座標統一
5. Phase E: `EnemySpawnRuntime` CSV駆動化
6. Phase F: frame clock / tick order
7. Phase G: stats倍率 / attack timeline / damage / proc
8. Phase H: KB / effect / animation / production

Phase G/H を半端に壊すくらいなら、Phase A〜Fを完全に通し、未完了を `docs/bcu-migration-status.md` に明記する。

---

# Phase A: 監査・DebugBattleInspector

## 目的

変更前後で `stage`, `runtime`, `camera`, `spawn`, `actors`, `fallback` を確認できるようにする。

## 変更ファイル

新規:

- `js/battle/DebugBattleInspector.js`

変更:

- `js/battle/BattleScene.js`
- `js/battle/BattleSceneRenderer.js`
- 必要なら `js/battle/BattleConfig.js`

## 実装指示

1. `DebugBattleInspector` を追加する。
2. `DebugBattleInspector.collect(scene)` を実装し、以下を返す。

```js
{
  frame,
  timeMs,
  stage: {
    castleId,
    animBaseId,
    cannonId,
    bgId,
    stageLen,
    enemyBaseHp,
    maxEnemyCount,
    enemyRowsCount,
    warnings
  },
  runtime: {
    playerBaseWorldX,
    playerBaseFrontX,
    playerBaseHp,
    enemyBaseWorldX,
    enemyBaseFrontX,
    enemyBaseHp,
    groundY,
    scrollMinX,
    scrollMaxX
  },
  camera: {
    x,
    offsetX,
    zoom,
    viewportWidth
  },
  spawn: {
    rowCount,
    activeRows,
    doneRows,
    nextFrameMin,
    deferredCount
  },
  actors: {
    playerAlive,
    enemyAlive,
    dead,
    knockback
  },
  warnings: []
}
```

3. `?debugBattle=1` または `BattleConfig.debugBattle === true` で overlay を出す。
4. overlay は canvas左上に小さく出す。
5. collectは絶対にbattle stateを書き換えない。

## 受け入れ条件

- 通常起動ではoverlayなし。
- `?debugBattle=1` でoverlayが出る。
- stage未ロード中でも落ちない。
- `castleId`, `bgId`, `stageLen`, `enemyBaseHp`, `maxEnemyCount`, `enemyRowsCount` が見える。
- fallback warning が見える。

---

# Phase B: StageDefinitionLoader純parser化

## 目的

`StageDefinitionLoader.js` を BCU stage CSV parser に寄せる。runtime座標、base生成、asset解決はしない。

## 変更ファイル

- `js/battle/StageDefinitionLoader.js`
- 必要なら新規 `js/battle/StageDefinition.js`
- 互換に必要な最小範囲で `js/battle/StageSpawnPreviewBuilder.js`
- 互換に必要な最小範囲で `js/battle/BcuStageSpawnRuntime.js`

## 正規StageDefinition shape

必ずこのshapeを返す。既存呼び出しがある場合はaliasを残す。

```js
{
  sourcePath,
  sourceType: 'bcu-stage-csv',
  coordinateMode: 'bcu-stage-world',
  warnings: [],
  rawRows: [],

  castleId,
  animBaseId,
  cannonId,
  bgId,
  stageLen,
  enemyBaseHp,
  maxEnemyCount,
  minSpawnFrame,
  maxSpawnFrame,
  timeLimit,
  noContinue,
  bossGuard,
  musicId,
  mapId,
  stageId,

  enemyRows: [
    {
      rowIndex,
      sourceOrder,
      enemyId,
      sourceEnemyId,
      rawEnemyId,
      count,
      isInfinite,
      firstFrame,
      respawnMinFrame,
      respawnMaxFrame,
      baseHpTrigger,
      baseHpTriggerPercent,
      bossFlag,
      magnification,
      hpMagnification,
      attackMagnification,
      layerMin,
      layerMax,
      group,
      killCountTrigger,
      score,
      raw
    }
  ]
}
```

## 必須実装ルール

1. `rowIndex` は CSV上の敵行ごとに必ず設定する。
2. `sourceOrder` はCSV読み込み順、`rowIndex` はruntime対応付けに使う安定IDにする。
3. BCU同様、敵IDは `rawEnemyId - 2` 補正を考慮する。ただし既存asset resolverとの互換がある場合、`sourceEnemyId`, `rawEnemyId`, `enemyId` をすべて保持し、どれを使ったかwarning/debugに残す。
4. `firstFrame`, `respawnMinFrame`, `respawnMaxFrame` はframe値として保持する。
5. BCU `Stage.java` では `S0/R0/R1 *= 2` がある。現コードの既存挙動を調べ、既に補正済みなら二重補正しない。どちらにしたか `warnings` または `docs/bcu-migration-status.md` に明記する。
6. `count === 0` は `isInfinite: true` として扱う。
7. `maxEnemyCount` はstage header由来。最終runtimeでは50 capを適用してよいが、parserでは元値も保持する。
8. `baseHpTrigger > 100 && magnification == 100` の補正をBCUに寄せる。補正時はwarningに残す。
9. 追加列 `attackMagnification/M1`, `killCountTrigger/KC`, `score/SC` を落とさない。
10. parser内で `enemySpawnWorldX`, `playerSpawnWorldX`, `camera`, `base object`, `asset` を作らない。

## 受け入れ条件

- `enemyRows` の全要素に `rowIndex` がある。
- `castleId`, `bgId`, `stageLen`, `enemyBaseHp`, `maxEnemyCount` がStageDefinitionにある。
- `StageDefinitionLoader` は asset loader / renderer / camera をimportしない。
- 既存previewが完全には壊れない。必要なら互換adapterを残す。

---

# Phase C: StageRuntime と BattleScene.init ロード順修正

## 目的

`BattleScene.init` を BCU型のロード順へ寄せる。

正しい順序:

1. stage definition load
2. stage asset resolve
3. stage runtime build
4. base runtime build
5. actor factory preload
6. player production roster build
7. enemy spawn runtime build
8. camera setup
9. battle start

## 変更ファイル

新規候補:

- `js/battle/StageRuntime.js`
- `js/battle/StageAssetResolver.js`

変更:

- `js/battle/BattleScene.js`
- `js/battle/BattleBase.js`
- `js/battle/BattleConfig.js`

## StageRuntime shape

```js
{
  stageDefinition,
  stageLen,
  groundY,
  scrollMinX,
  scrollMaxX,

  playerBase: {
    side: 'cat-player',
    worldX,
    frontX,
    hp,
    maxHp,
    assetRef,
    body
  },

  enemyBase: {
    side: 'cat-enemy',
    worldX,
    frontX,
    hp,
    maxHp,
    castleId,
    animBaseId,
    assetRef,
    body
  },

  spawn: {
    playerSpawnWorldX,
    enemySpawnWorldX,
    bossSpawnWorldX
  },

  background: {
    bgId,
    assetRef,
    usedFallback
  },

  warnings: []
}
```

## 実装指示

1. `BattleScene.init` で `stageDefinition` を先に取得する。
2. `enemyBaseHp` を enemy base HP に反映する。未取得ならfallbackしwarning。
3. `stageLen` から player/enemy base の world座標を決める。
4. `castleId` / `animBaseId` を enemy base asset resolver へ渡す。
5. `bgId` を background resolver へ渡す。
6. `BattleConfig` の固定 stageLen は fallback としてのみ使う。
7. `BattleScene` に旧API互換が必要なら `this.stage = { definition, runtime }` のようにまとめる。

## 受け入れ条件

- Debug overlayでStageDefinitionとStageRuntimeの値が一致する。
- `enemyBaseHpPercent` を100固定でspawn runtimeへ渡さない。
- `castleId` が enemy base / castle asset resolver に流れる。
- `bgId` が background resolver / renderer に流れる。
- stageLenはzoomやviewportで変更されない。

---

# Phase D: CastleAssetResolver / StageBackgroundResolver / CameraTransform / Renderer world座標統一

## 目的

城、背景、camera、rendererを world座標とasset resolverに分離する。

## 変更ファイル

新規候補:

- `js/battle/CastleAssetResolver.js`
- `js/battle/StageBackgroundResolver.js`
- `js/battle/CameraTransform.js` または既存 `BattleCamera.js` 拡張

変更:

- `js/battle/BcuCastleAssetLoader.js`
- `js/battle/StageBackgroundLoader.js`
- `js/battle/BattleCamera.js`
- `js/battle/BattleCameraInputController.js`
- `js/battle/BattleSceneRenderer.js`
- `js/battle/BattleBodyResolver.js`
- `js/battle/BattleBase.js`
- `js/battle/BattleScene.js`

## 実装指示

### Castle

1. `resolveEnemyCastle({ castleId, animBaseId })` を作る。
2. `resolvePlayerCastle(...)` と敵城を分ける。
3. fallback時は `{ usedFallback: true, requestedCastleId, reason }` を返す。
4. `BattleBase` には `assetRef` と `body` のみ渡す。asset探索を `BattleBase` 内で行わない。

### Background

1. `resolveBackground(bgId)` を作る。
2. 返り値は `{ bgId, image, metadata, parallaxX, overlay, usedFallback, reason }`。
3. `StageBackgroundLoader` は低レベルloader、`StageBackgroundResolver` はID解決役にする。

### Camera

`BattleCamera` は以下APIを持つ。

```js
worldToScreenX(worldX)
worldToScreenY(worldY)
screenToWorldX(screenX)
screenToWorldY(screenY)
setZoom(zoom, anchorScreenX)
setViewport(width, height)
clampToStage(stageLen)
```

禁止:

- zoomで `stageLen` を変更しない。
- zoomで actor/base/spawn worldX を変更しない。
- rendererが独自のworld/screen変換を持たない。

### Renderer

1. background, base, actor, effect はすべて world座標を入力にし、cameraでscreenへ投影する。
2. UIはcamera変換しない。
3. background parallax はbackground専用。actor/baseには適用しない。
4. actor visual offset と combat body は分ける。

## 受け入れ条件

- wheel/pinchしても `stageLen`, `base.worldX`, `actor.worldX`, `spawnX` が変わらない。
- background, base, actor が同じcamera scrollで整合して動く。
- `castleId` fallbackがdebugに出る。
- `bgId` fallbackがdebugに出る。

---

# Phase E: BattleSpawnResolver / EnemySpawnRuntime CSV完全駆動化

## 目的

敵出現をBCUの `SCDef.Line` 的な row state に寄せる。

## 変更ファイル

新規候補:

- `js/battle/BattleSpawnResolver.js`
- `js/battle/EnemySpawnRuntime.js`

変更:

- `js/battle/BcuStageSpawnRuntime.js`
- `js/battle/BcuStageEnemyResolver.js`
- `js/battle/BattleScene.js`
- `js/battle/BattleActorFactory.js`
- `js/battle/BattleStatsLoader.js`

## Spawn row state

```js
{
  rowIndex,
  def,
  unitDef,
  spawnedCount,
  nextFrame,
  armed,
  done,
  disabled,
  disabledReason,
  waitingForMaxEnemySlot
}
```

## Spawn event

```js
{
  type: 'spawnEnemy',
  rowIndex,
  unitDef,
  enemyId,
  worldX,
  bossFlag,
  magnification,
  hpMagnification,
  attackMagnification,
  layerMin,
  layerMax,
  row
}
```

## 実装指示

1. `BattleSpawnResolver.getEnemySpawnWorldX(stageRuntime, row)` を作る。
2. spawnX は enemy base `frontX` 基準にする。fallbackは旧値700でもよいがwarning。
3. `EnemySpawnRuntime.tick(frame, context)` を実装する。
4. contextには以下を渡す。

```js
{
  aliveEnemyCount,
  maxEnemyCount,
  enemyBaseHpPercent,
  random
}
```

5. `enemyBaseHpPercent` は enemy base runtime HPから計算する。
6. `count > 0` は有限。`count === 0` / `isInfinite` は無限。
7. `firstFrame` 前はspawnしない。
8. `baseHpTrigger` がある場合、敵城HP%が閾値以下になるまでspawnしない。
9. `maxEnemyCount` 到達時はdoneにせず保留する。
10. respawnは `respawnMinFrame` と `respawnMaxFrame` の範囲で次回frameを決める。
11. `bossFlag`, `magnification`, `hpMagnification`, `attackMagnification`, `layer` を actor生成へ渡す。
12. enemy assetがない場合、rowをdisabledにしてdebugに残す。

## 受け入れ条件

- `rowIndex` による unitDef対応が壊れない。
- enemy base HP triggerが100固定ではなくなる。
- maxEnemyCount到達時はspawnが保留され、枠が空けば再開できる。
- count有限/無限が区別される。
- Debug overlayでrow stateが見える。

---

# Phase F: BattleFrameClock と tick order整理

## 目的

戦闘runtimeをframe basedに寄せる。

## 変更ファイル

新規候補:

- `js/battle/BattleFrameClock.js`

変更:

- `js/preview/BattleSimulationClock.js`
- `js/battle/BattleScene.js`
- `js/battle/BattleActor.js`
- `js/battle/BattleAttackResolver.js`

## 実装指示

1. 30fps fixed-step clockを作る。
2. `BattleScene.tick` は `dt ms` ではなく、内部で `logicFrame` を進める。
3. 1 logic frame の順序を以下に寄せる。

```text
1. collect queued player production requests
2. enemy spawn check
3. economy / production cooldown update
4. actor preUpdate / state update
5. movement
6. target search
7. attack start
8. attack timeline advance
9. hit target capture
10. damage event resolve
11. proc event resolve
12. KB/death state update
13. base postUpdate
14. effect spawn
15. effect tick
16. cleanup dead/effects
17. camera update
18. render outside simulation
```

4. rendererはsimulationを進めない。
5. `BattleActor.tick(dt)` がms前提なら互換adapterを置き、徐々にframeに寄せる。

## 受け入れ条件

- pause/resumeでlogic frameが飛びすぎない。
- spawn firstFrameがframe基準で再現できる。
- attack hit frameがframe基準で扱える準備ができる。

---

# Phase G: ActorStatsModel / AttackTimeline / DamageCalculator / ProcResolver

## 目的

攻撃・能力・倍率をBCU寄せの分離構造にする。

## 変更ファイル

新規候補:

- `js/battle/ActorStatsModel.js`
- `js/battle/AttackTimeline.js`
- `js/battle/DamageCalculator.js`
- `js/battle/AbilityModel.js`
- `js/battle/ProcResolver.js`

変更:

- `js/battle/BattleStatsLoader.js`
- `js/battle/BcuStatsSchema.js`
- `js/battle/BattleActorFactory.js`
- `js/battle/BattleActor.js`
- `js/battle/BattleAttackProfile.js`
- `js/battle/BattleAttackResolver.js`
- `js/battle/BattleScene.js`

## ActorStatsModel shape

```js
{
  id,
  sideType: 'unit' | 'enemy',
  maxHp,
  attackPower,
  attackPowers,
  range,
  speed,
  kbCount,
  attackIntervalFrame,
  foreswingFrame,
  backswingFrame,
  attackCount,
  hitFrames,
  cost,
  respawnFrame,
  traits: [],
  abilities: {},
  procs: [],
  body: {
    halfWidth,
    frontOffset,
    backOffset
  },
  render: {
    visualOffsetX,
    visualOffsetY,
    scale
  }
}
```

## 倍率適用

Enemy spawn row 由来の倍率は actor生成時に適用する。

```js
finalMaxHp = baseMaxHp * hpMagnification / 100
finalAttack = baseAttack * attackMagnification / 100
```

`magnification` しかない場合は hp/attack の両方に使う。BCU `M` / `M1` に合わせ、`hpMagnification` と `attackMagnification` を分ける。

## AttackTimeline

```js
{
  attackCount,
  hitFrames: [],
  totalDurationFrame,
  foreswingFrame,
  backswingFrame,
  rangeShape,
  isArea,
  isLongDistance,
  isOmni,
  minRange,
  maxRange,
  hitboxes: []
}
```

## DamageCalculator

責務:

- base damage
- trait target
- resistant / tough
- massive / insane damage
- critical / metal
- base destroyer
- shield / barrier modifiers where data exists

未実装能力はsilent ignoreしない。`unsupportedAbilities` に残す。

## ProcResolver

責務:

- freeze
- slow
- weaken
- knockback proc
- warp
- curse
- toxic
- wave / mini-wave
- surge / mini-surge
- critical visual event
- barrier breaker / shield pierce
- zombie killer / revive flag

一気に全実装できない場合は、正規化モデルとevent pipelineを先に作り、未実装procはdebug warningへ出す。

## 受け入れ条件

- row倍率が敵actorのHP/攻撃に反映される。
- attack animationとdamage timingが分離される。
- 未実装能力がdebug reportに出る。
- 既存の単純攻撃は壊れない。

---

# Phase H: KBRuntime / EffectRuntime / AnimationRuntime / ProductionRuntime

## 目的

KB、死亡、effect、BCU animation、production/economyを分離する。

## 変更ファイル

新規候補:

- `js/battle/KBRuntime.js`
- `js/battle/EffectRuntime.js`
- `js/battle/ProductionRuntime.js`
- `js/bcu/BcuAnimationRuntime.js`

変更:

- `js/battle/BattleActor.js`
- `js/battle/BattleScene.js`
- `js/battle/BattleEffect.js`
- `js/battle/BattleEffectLoader.js`
- `js/battle/BcuKbeffLoader.js`
- `js/battle/BattleSceneRenderer.js`
- `js/battle/BattleEconomy.js`
- `js/ui/PlayerProductionBar.js`
- `js/bcu/BcuAnimator.js`
- `js/bcu/BcuModelInstance.js`

## KB

`KBRuntime` は以下を扱う。

```js
{
  active,
  startFrame,
  durationFrame,
  distance,
  fromX,
  toX,
  reason: 'hp-kb' | 'proc-kb' | 'boss-shockwave' | 'death',
  targetable,
  touchable
}
```

## Effect

`EffectRuntime` は world座標でeffectを管理する。

```js
spawnEffect({ type, worldX, worldY, layer, assetKey, direction, sourceActorId })
tickFrame(frame)
collectRenderableEffects()
```

## Animation

`BcuAnimator` / `BcuModelInstance` は以下を改善する。

- imgcut / mamodel / maanim の分離を維持
- parent-child transform
- local transform / world transform
- pivot
- scale
- rotation
- opacity
- z-order
- frame interpolation / easing
- renderFlipX
- logical side と visual facing の分離

完全再現が難しければ、API境界とdebug warningを先に作る。

## Production

`ProductionRuntime` はUIから分離する。

- cost
- respawn/cooldown frame
- money
- maxMoney
- worker level
- max deploy
- lineup slot

UIはruntimeを読むだけ。spawn可否の最終判断はruntime側。

## 受け入れ条件

- KB中の座標・targetabilityがstateで見える。
- effectはworld座標発生し、cameraで投影される。
- BCU animationのtransform責務が `BcuModelInstance` / `BcuAnimator` に閉じる。
- Production UIとspawn runtimeが分離される。

---

## 6. BattleSceneの最終責務

改修後の `BattleScene` は以下だけを持つ。

- scene lifecycle
- loading orchestration
- runtime object の接続
- input queue 受付
- simulation step 呼び出し
- renderer 呼び出し
- debug report 集約

`BattleScene` に置いてよいmethod:

```js
constructor()
init()
loadStageDefinition()
buildStageRuntime()
preloadActors()
buildProductionRoster()
buildEnemySpawnRuntime()
stepFrame()
tick(dt)
render(ctx)
requestPlayerSpawn(slotId)
getStatsSourceReport()
```

`BattleScene` から外へ出すべきmethod:

- CSV parse本体
- castle asset path探索
- background asset path探索
- spawnX計算本体
- attack target capture詳細
- damage計算
- proc解決
- KB補間
- effect asset解決
- BCU model transform
- production cooldown判定

---

## 7. 最低限のテスト / 自己検証

package managerがない前提なので、以下を実行・確認する。

### 静的確認

```bash
git diff --stat
git diff -- js/battle js/bcu js/preview js/ui js/data | sed -n '1,240p'
```

### 構文確認

可能なら Node のES module構文チェックを行う。importの実行でbrowser APIが必要な場合は無理に通さず、syntax errorだけ拾う。

```bash
node --check js/battle/StageDefinitionLoader.js
node --check js/battle/BattleScene.js
node --check js/battle/BattleCamera.js
node --check js/battle/BattleSceneRenderer.js
```

`node --check` がESMやbrowser API都合で不適なら、その理由を最終報告に書く。

### grep確認

以下を確認する。

```bash
# rowIndexがStageDefinition enemyRowsに入ること
grep -R "rowIndex" -n js/battle | head -50

# enemyBaseHpPercent: 100 固定が残っていないこと
grep -R "enemyBaseHpPercent: 100" -n js || true

# stageLenをzoom/pinchで変更していないこと
grep -R "stageLen" -n js/battle js/preview | head -80

# bgId/castleIdがruntime/resolverへ流れていること
grep -R "bgId\|castleId\|animBaseId" -n js/battle | head -120
```

### ブラウザ手動確認

可能ならローカルサーバで起動する。

```bash
python3 -m http.server 8000
```

ブラウザで以下を確認する。

```text
http://localhost:8000/?debugBattle=1
```

確認項目:

- canvasが表示される。
- debug overlayが出る。
- `castleId`, `bgId`, `stageLen`, `enemyBaseHp`, `maxEnemyCount`, `enemyRows` が見える。
- 敵が出現する。
- scroll/zoomしてもbase/actorのworld整合が崩れない。
- consoleに致命的例外がない。

---

## 8. 最終報告フォーマット

Codex は作業完了時に必ず以下の形式で報告する。

```text
実装完了報告

1. 変更ファイル
- ...

2. 新規ファイル
- ...

3. 削除ファイル
- ...

4. 実装したPhase
- Phase A: 完了 / 一部 / 未実施
- Phase B: 完了 / 一部 / 未実施
- Phase C: 完了 / 一部 / 未実施
- Phase D: 完了 / 一部 / 未実施
- Phase E: 完了 / 一部 / 未実施
- Phase F: 完了 / 一部 / 未実施
- Phase G: 完了 / 一部 / 未実施
- Phase H: 完了 / 一部 / 未実施

5. 重要な仕様変更
- ...

6. 受け入れ条件チェック
- rowIndex: OK/NG
- enemyBaseHpPercent固定除去: OK/NG
- castleId伝播: OK/NG
- bgId伝播: OK/NG
- stageLen world固定: OK/NG
- camera world/screen統一: OK/NG
- spawn runtime CSV駆動: OK/NG
- row倍率適用: OK/NG
- debug overlay: OK/NG

7. 実行した確認コマンド
- ...

8. 既知の未対応点
- ...

9. rollback方法
- ...
```

---

## 9. rollback方針

一括改修でも、rollback単位を守る。

- Phase Aだけ戻す: `DebugBattleInspector.js` と renderer overlay接続を戻す。
- Phase Bだけ戻す: `StageDefinitionLoader.js` とStageDefinition adapterを戻す。
- Phase Cだけ戻す: `StageRuntime.js` と `BattleScene.init` のruntime接続を戻す。
- Phase Dだけ戻す: resolver/camera/rendererの接続を旧pathへ戻す。
- Phase Eだけ戻す: `EnemySpawnRuntime` を旧 `BcuStageSpawnRuntime` adapterへ戻す。
- Phase F以降はfeature flagを使い、旧combat pathへ戻せるようにする。

削除ではなくfeature flag / adapterで戻せる構造を優先する。

---

## 10. 最優先で成功させる最小完成形

一括で全部できない場合、最低限ここまでを完成させる。

1. `DebugBattleInspector` で値が見える。
2. `StageDefinitionLoader` が `rowIndex` 付き `enemyRows` を返す。
3. `castleId`, `bgId`, `stageLen`, `enemyBaseHp`, `maxEnemyCount` が `StageRuntime` に入る。
4. `enemyBaseHpPercent: 100` 固定をやめる。
5. enemy spawnX が enemy base `frontX` 起点になる。
6. camera zoom / pinch で `stageLen` と worldX が変わらない。
7. fallbackがdebug warningに出る。
8. 既存戦闘画面が起動し、敵が出る。

この8項目を満たせば、BCU寄せの土台として成功扱いにする。攻撃/proc/animation/productionは次段階に回してよいが、未実装を明記する。

