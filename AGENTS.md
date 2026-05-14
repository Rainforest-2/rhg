# AGENTS.md — BCU準拠の戦闘表示・背景・生産アイコン修正タスク

Repository: `rhgrive2/game`  
Target branch: `main`

このファイルは Codex に渡す修正タスクです。Codex は **現在の `rhgrive2/game` のコード**を読み、BCU準拠が必要な箇所では下記の BCU 公式リポジトリを clone して比較してください。過去の会話や古い分析メモに依存せず、現在のコードと実際の BCU 実装を根拠に修正してください。

現在、Formation 側の DOM/仮想リスト問題は改善済みですが、戦闘画面で以下の問題が残っています。

```text
1. 背景の描画がBCU本家と一致していない。
2. 生産カードでアイコンが出ないキャラがいる。
3. キャラモデルが巨大な切り抜き画像・顔の断片のように崩れて表示される。
4. 味方キャラの登場位置・見た目のアンカーが不自然に見える。
```

これらは同一原因とは限りません。背景、アイコン、モデル描画、spawn/anchor を分けて原因を特定し、それぞれに診断ログと検査スクリプトを追加してください。

---

## 1. 参照するBCUリポジトリ

BCU準拠が必要な箇所では、Codex 側で以下を clone して実装を確認してください。

```bash
mkdir -p /tmp/bcu-reference
cd /tmp/bcu-reference
git clone https://github.com/battlecatsultimate/BCU_java_util_common.git
git clone https://github.com/battlecatsultimate/BCU-java-PC.git
```

主に確認する対象は以下です。パスが変わっている場合は検索して同等クラスを見つけてください。

```text
BCU_java_util_common:
  util/pack/Background.java
  util/anim/ImgCut.java
  util/anim/MaModel.java
  util/anim/MaAnim.java
  util/anim/Part.java
  util/anim/EPart.java
  util/anim/EAnimD.java
  util/ImgCore.java
  battle/StageBasis.java
  battle/entity/Entity.java
  battle/entity/EUnit.java
  battle/entity/EEnemy.java

BCU-java-PC:
  src/main/java/page/battle/BattleBox.java
```

特に以下の仕様を確認し、JS側と差分があれば BCU に合わせてください。

```text
Background:
  背景本体のimgcut partは BG = 0。
  上部背景は TOP = 20。
  bg.csv の column 13 が imgcut id。
  bg.csv の column 14 が上部背景フラグ。
  bg.csv の column 15 が image reference id。
  draw() の背景X位置は pos + 200 * siz - backgroundWidth。
  地面グラデーション、空/上部背景、本体背景タイルの描画順を確認する。

ImgCut:
  cut rectangle は画像サイズ内に clamp される。
  x/y が負なら 0。
  w/h <= 0 は 1。
  画像外にはみ出す w/h は画像境界まで縮める。

MaModel:
  parts column:
    0 parent
    1 id
    2 img / imgcut part index
    3 z
    4 posX
    5 posY
    6 pivotX
    7 pivotY
    8 scaleX
    9 scaleY
    10 angle
    11 opacity
    12 glow
    13 extendX
  ints[0] は scale denominator。
  ints[1] は angle denominator。
  ints[2] は opacity denominator。
  check() は imgcut範囲外参照や parent loop をBCU仕様で補正する。

MaAnim / Part:
  frame 0 では model part を setValue() で初期化する。
  loop, offset, fir/max, ensureLast の扱いをBCU通りにする。
  modification 2 の画像index補間、modification 13/14 の step 処理、easing 2/3/4 をBCU通りにする。

EPart / ImgCore:
  parent transform を再帰的に適用する。
  draw image は part 中心ではなく pivot 基準。
  draw位置は -pivot * size * sizer。
  drawサイズは cut image の width/height * size * sizer。
  opacity は親子で乗算する。
  z は zValue * partCount + partIndex。

BattleBox / StageBasis:
  getX(x) = (x * ratio + off) * siz + sb.pos。
  drawEntity() のYは midh - (road_h - currentLayer * DEP) * siz。
  entity sprite scale は siz * sprite。
  enemy base は 800。
  player base は stageLen - 800。
  player unit spawn は stageLen - 700。
  enemy normal spawn は 700。
```

注意: BCU が行っている補正、たとえば imgcut範囲外の画像indexを 0 に補正する挙動は、単純に禁止しないでください。巨大な顔断片の原因は、補正そのものではなく、その後の transform / pivot / draw anchor の解釈がBCUと違うことの可能性が高いです。

---

## 2. 現在コードで必ず確認するファイル

```text
js/battle/StageBackgroundLoader.js
js/battle/StageBackgroundResolver.js
js/battle/StageDefinitionLoader.js
js/battle/StageRuntime.js
js/battle/BattleSpawnResolver.js
js/battle/BattleScene.js
js/battle/BattleSceneRenderer.js
js/battle/BattleActor.js
js/battle/BattleActorFactory.js
js/battle/PlayableCharacterRegistry.js
js/ui/PlayerProductionBar.js
js/bcu/SemanticAssetProvider.js
js/bcu/BcuAssetLoader.js
js/bcu/BcuImgcutParser.js
js/bcu/BcuModelParser.js
js/bcu/BcuAnimParser.js
js/bcu/BcuAnimator.js
js/bcu/BcuModelInstance.js
js/bcu/BcuSpriteSheet.js
scripts/build-bcu-background-index.mjs
scripts/build-bcu-semantic-bundles.mjs
scripts/check-actor-bundles-complete.mjs
```

必要に応じて新しい検査スクリプトを追加してください。

---

## 3. P0: キャラモデル崩れを最優先で修正する

巨大な猫顔・画像断片が表示される問題は最優先です。scale や x/y の見た目調整で隠さず、BCU の `EPart + MaAnim + ImgCore.drawImg` と一致するように直してください。

### 3.1 現在の強い疑い

```text
BcuModelParser は mamodel を読めているが、BcuModelInstance / BcuAnimator / BattleSceneRenderer.drawActor が BCU の EPart / MaAnim / ImgCore と一致していない可能性が高い。
特に、JS側が part を中心基準の矩形として扱っている箇所があるなら、BCU の pivot基準描画とズレる。
初期frame適用、parent transform、pivot、scale、opacity、z順、hf/vf、gsca の処理差が巨大な切り抜き表示につながる。
```

### 3.2 `BcuModelInstance.js` の要求

`js/bcu/BcuModelInstance.js` を BCU `EPart` 準拠に修正してください。

各 part の current state は少なくとも以下を持つようにしてください。

```js
{
  index,
  parent,
  id,
  img,
  z,
  pos: { x, y },
  piv: { x, y },
  sca: { x, y },
  angle,
  opacity,
  glow,
  extendX,
  extendY,
  extType,
  hf,
  vf,
  gsca
}
```

必要な挙動:

```text
setValue() 相当で全partをmamodel初期値に戻せる。
base scale / angle / opacity denominator を mamodel ints から使う。
parent が不正・自分自身・loop の場合は BCU と同じ補正にする。
img index が負なら非表示、範囲外ならBCU仕様で補正する。
z = zValue * partCount + index。
opacity は parent chain で乗算する。
size は parent size と current scale/gsca を再帰的に反映する。
root transform は model.confs[0] と root pivot をBCU通りに扱う。
child transform は parent.getSize() * sizer * pos → scale(hf, vf) → rotate の順序をBCUに合わせる。
draw params は pivot 基準:
  drawX = -pivotX * sizeX * baseScale
  drawY = -pivotY * sizeY * baseScale
  drawW = cutWidth * sizeX * baseScale
  drawH = cutHeight * sizeY * baseScale
```

part を中心基準で描かないでください。

追加するメソッド例:

```js
getBcuDrawList({ parentMatrix = null, sizer = 1, imgcut = null } = {})
```

戻り値例:

```js
{
  index,
  img,
  id,
  z,
  opacity,
  glow,
  matrix,
  drawX,
  drawY,
  drawW,
  drawH,
  cut,
  pivot: { x, y },
  size: { x, y },
  transformDebug
}
```

既存コードが `getBattleDrawList()` を使っているなら、互換 wrapper として残し、中身は BCU準拠 draw list にしてください。

### 3.3 `BcuAnimator.js` の要求

`js/bcu/BcuAnimator.js` を BCU `MaAnim.update()` / `Part.update()` に近づけてください。

必須:

```text
frame 0 では model を setValue() で初期化。
loop = -1, loop > 0, ensureLast をBCU通りに扱う。
Part.validate 相当の offset/fir/max/doff を実装。
keyframe完全一致はその値を適用。
modification 0 は step。
easing 1 は補間なし。
modification 13/14 は step。
modification 2 の減少方向補間は ceil。
easing 2/3/4 は BCU の式に合わせる。
```

対応すべき modification:

```text
0 parent
1 id
2 img
3 z
4 posX
5 posY
6 pivotX
7 pivotY
8 scale both
9 scaleX
10 scaleY
11 angle
12 opacity
13 hf
14 vf
50 extendX slow
51 extendX curse
52 extendY slow
53 gsca
```

### 3.4 `BattleSceneRenderer.drawActor()` の要求

`BattleSceneRenderer.drawActor()` は BCU準拠 draw list を使って描画してください。

要求:

```text
描画前に現在フレームの animation が actor.model に反映されている。
draw list は BcuModelInstance の BCU準拠 draw list。
各partごとに:
  cut = actor.sprite.imgcut.parts[entry.img]
  ctx.save()
  world/screen transform と entry.matrix を適用
  ctx.globalAlpha = entry.opacity
  ctx.drawImage(
    actor.sprite.image,
    cut.x, cut.y, cut.w, cut.h,
    entry.drawX, entry.drawY, entry.drawW, entry.drawH
  )
  ctx.restore()
```

無効な matrix、非finite draw値、無効cut、異常bounds は、その part だけ skip して診断に出してください。巨大な壊れ画像を描かないでください。

追加診断:

```js
globalThis.__LAST_ACTOR_RENDER_DEBUG__ = {
  semanticKey,
  characterId,
  side,
  sourcePack,
  bundlePath,
  image: { width, height },
  imgcut: { partCount, invalidRectCount },
  model: { partCount, invalidPartRefs },
  animations: { loadedRoles, missingRoles, invalidTrackRefs },
  firstFrameBounds,
  lastFrameBounds,
  skippedParts,
  transformExamples,
  source: 'BattleSceneRenderer.drawActor BCU EPart parity'
};
```

### 3.5 actor bundle互換性チェック

追加:

```text
scripts/check-actor-bundle-compatibility.mjs
```

検査内容:

```text
playable roster で使う actor bundle をすべて開く。
image.png が存在し PNG として読める。
imgcut.imgcut が parse でき、BCU ImgCut.cut と同じ clamp 後の矩形が作れる。
model.mamodel が parse できる。
move/idle/attack/kb maanim が parse できる。
frame 0, 1, 2, max/2, max などで finite な draw list を作れる。
draw bounds が画像サイズや想定画面に対して極端に巨大にならない。
```

失敗形式:

```json
{
  "semanticKey": "enemy:39",
  "bundlePath": "public/assets/bundles/actor/enemy/039.zip",
  "sourcePack": "000002",
  "internalPath": "model.mamodel",
  "reason": "nonfinite-transform | draw-bounds-outlier | missing-entry | invalid-maanim | invalid-imgcut"
}
```

---

## 4. P0: 生産カードのアイコン欠けを修正

疑い:

```text
SemanticAssetProvider.getActorUiIconUrl() は失敗時に provider 側 cache を消して retry 可能にしている。
しかし PlayerProductionBar.ensureCardAssets() 側が失敗結果を this.iconCache に永久保存している可能性がある。
その場合、一度 icon load に失敗したカードは再描画しても blank のままになる。
```

修正対象:

```text
js/ui/PlayerProductionBar.js
```

要求:

```text
semantic icon load 失敗時は this.iconCache.delete(key) する。
{ icon: null, failed: true } の promise を永続キャッシュしない。
次回 update で retry できるようにする。
missing icon は blank ではなく明示 placeholder を描く。
失敗理由を構造化して記録する。
```

実装例:

```js
catch (error) {
  this.iconCache.delete(key);
  const detail = { semanticKey, bundlePath, internalPath, reason, errorMessage: error?.message };
  ...
  return { icon: null, failed: true, errorDetail: detail };
}
```

追加診断:

```js
globalThis.__PRODUCTION_ICON_DEBUG__ = {
  failures: [],
  lastUpdate: {
    requested,
    loaded,
    failed,
    cacheHits,
    retryableFailures
  }
};
```

検査:

```text
scripts/check-production-icons-use-icon-bundles.mjs
```

確認すること:

```text
PlayerProductionBar が provider.getActorUiIconUrl() を使う。
生産アイコンに actor bundle image.png fallback を使わない。
失敗 icon load が永久 cache されない。
```

---

## 5. P0: 背景描画をBCU準拠に修正

注意: `parts[0]` は BCU の `Background.BG` なので、`parts[0]` を使うこと自体は間違いではありません。確認すべきは、**その imgcut と image が bg.csv の指定に合っているか**です。

修正・検証対象:

```text
scripts/build-bcu-background-index.mjs
scripts/bcu-semantic-utils.mjs の background index 生成部
js/battle/StageBackgroundLoader.js
js/battle/BattleSceneRenderer.js
```

BCU準拠要件:

```text
bg.csv column 13 から imgcut id を選ぶ。
bg.csv column 14 から top flag を選ぶ。id 110 の特殊処理も確認。
bg.csv column 15 が存在し -1 でなければ image reference id として使う。id 185 の特殊処理も確認。
background bundle の image.png は bg<imageReferenceId or bgId>.png 由来。
background bundle の imgcut.imgcut は bg<imgcutId>.imgcut 由来。
BG part index は 0。
TOP part index は 20。
BattleSceneRenderer.drawBackgroundBcuStage0 は BCU Background.draw の式に合わせる。
```

追加診断:

```js
globalThis.__LAST_BACKGROUND_DEBUG__ = {
  bgId,
  imgcutId,
  imageReferenceId,
  imagePath,
  imgcutPath,
  partCount,
  crop: { index: 0, w, h },
  upperCrop: { index: 20, w, h } | null,
  draw: { pos, siz, ratio, off, fw, fh, dx, groundY },
  source: 'BCU Background.draw parity'
};
```

検査:

```text
scripts/check-stage-background-asset-parity.mjs
```

確認:

```text
各 background entry の selected image が bg.csv column 15/reference に一致する。
selected imgcut が bg.csv column 13 に一致する。
bundle に image.png / imgcut.imgcut がある。
part 0 がある。
top flag が true の場合 part 20 がある、または理由付きで診断される。
```

---

## 6. P0: spawn座標とvisual anchorを分けて修正

BCU上、player-side spawn が `stageLen - 700` なのは正しい可能性が高いです。見た目が変な位置に出る原因は、spawn座標そのものより **actor model bounds / visual anchor** の可能性があります。

まずモデル描画を直し、その後で座標を検証してください。

BCU準拠として維持すべき座標:

```text
enemy base = 800
enemy normal spawn = 700
player base = stageLen - 800
player spawn = stageLen - 700
boss/enemy-base entity spawn = boss_spawn or 700
```

追加診断:

```js
globalThis.__LAST_SPAWN_DEBUG__ = {
  side,
  stageLen,
  spawnWorldX,
  expectedBcuSpawnWorldX,
  basePos,
  expectedBcuBasePos,
  source,
  actorSemanticKey,
  renderBoundsBeforeAnchor,
  renderBoundsAfterAnchor
};
```

検査:

```text
scripts/check-battle-spawn-resolver.mjs
```

確認:

```text
dog-player spawn = stageLen - 700。
cat-enemy normal spawn = 700。
dog-player base = stageLen - 800。
cat-enemy base = 800。
boss/enemy-base entity spawn は boss_spawn があればそれを使う。
```

---

## 7. P1: actor bundle metadata を強化

`scripts/build-bcu-semantic-bundles.mjs` で actor bundle の `bundle.json` に source を明記してください。

例:

```json
{
  "bundleKey": "actor:enemy:39",
  "semanticKey": "enemy:39",
  "kind": "actor",
  "sourcePack": "000002",
  "sourceRawPaths": {
    "image.png": ".../039_e.png",
    "imgcut.imgcut": ".../039_e.imgcut",
    "model.mamodel": ".../039_e.mamodel",
    "move.maanim": ".../039_e00.maanim",
    "idle.maanim": ".../039_e01.maanim",
    "attack.maanim": ".../039_e02.maanim",
    "kb.maanim": ".../039_e03.maanim"
  }
}
```

required runtime file を黙って落とさないでください。欠けるなら generation/check を失敗させるか、playable roster から理由付きで除外してください。

---

## 8. 必須実行コマンド

修正後に最低限以下を通してください。

```bash
node scripts/build-bcu-manifest.mjs
node scripts/build-bcu-actor-index.mjs
node scripts/build-bcu-background-index.mjs
node scripts/build-bcu-castle-index.mjs
node scripts/build-bcu-stage-index.mjs
node scripts/audit-bcu-icon-sources.mjs
node scripts/build-bcu-icon-index.mjs
node scripts/build-bcu-icon-bundles.mjs
node scripts/check-icon-png-integrity.mjs
node scripts/check-icon-index-paths-exist-in-zips.mjs
node scripts/build-bcu-semantic-bundles.mjs
node scripts/build-bcu-core-db-bundle.mjs
node scripts/build-bcu-core-index.mjs
node scripts/build-bcu-canonical-index.mjs

node scripts/check-stage-background-asset-parity.mjs
node scripts/check-production-icons-use-icon-bundles.mjs
node scripts/check-battle-spawn-resolver.mjs
node scripts/check-actor-bundles-complete.mjs
node scripts/check-actor-bundle-compatibility.mjs
node scripts/check-playable-roster-actor-readiness.mjs
node scripts/check-bundled-assets-never-load-raw.mjs
node scripts/check-no-raw-runtime-paths.mjs
```

存在しない検査スクリプトは実装してください。

---

## 9. ブラウザ確認

同じ iPad/Safari 系の環境で確認してください。

戦闘前:

```js
console.log(globalThis.__FORMATION_ICON_DEBUG__);
console.log(globalThis.__PRODUCTION_ICON_DEBUG__);
performance.getEntriesByType('resource')
  .filter(e => e.name.includes('/assets/bcu/'))
  .map(e => e.name);
```

期待:

```text
raw /assets/bcu/ runtime read がない。
icon failure が retry 可能で診断される。
```

戦闘中:

```js
console.log(globalThis.__LAST_BACKGROUND_DEBUG__);
console.log(globalThis.__BATTLE_PRODUCTION_DEBUG__);
console.log(globalThis.__LAST_ACTOR_RENDER_DEBUG__);
console.log(globalThis.__LAST_SPAWN_DEBUG__);
console.log(globalThis.__BCU_DB__?.semanticProvider?.diagnostics);
```

期待:

```text
背景 debug に bgId / imgcutId / imageReferenceId / part 0 / part 20 が出る。
生産カード icon は出るか、理由付き placeholder になる。
有効な生産カードを押すと actor count が増える。
actor は巨大な切り抜き断片ではなく、まともなアニメキャラとして描画される。
spawn debug は dog-player spawn = stageLen - 700、base = stageLen - 800 を示す。
rawFallbacks / blockedRawReads は空。
```

---

## 10. 完了条件

```text
1. BcuModelInstance / BcuAnimator / BattleSceneRenderer が BCU EPart/MaAnim/ImgCore に準拠する。
2. 巨大な画像断片・顔だけの描画が消える。
3. 無効な actor draw data は描かず、構造化診断される。
4. 生産カード icon 失敗が永久キャッシュされず retry 可能。
5. 背景が BCU Background.draw と同じ source/image/imgcut/crop/draw式になる。
6. spawn座標は BCU StageBasis 準拠で debug に出る。
7. actor/background/icon bundle に source 追跡用 metadata がある。
8. 追加・既存の検査スクリプトが通る。
9. docs/bcu-migration-status.md にブラウザ確認結果を書く。
10. semantic strict mode を弱めず、raw BCU runtime read を復活させない。
```
