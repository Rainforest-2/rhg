# AGENTS.md — BCU妨害アイコン・状態異常表示 完全実装指示書（リスク潰し込み版）

Repository: `rhgrive2/game`  
Target branch: `main`  
Baseline: `b66889b4f5aff0e8be7b7a142908432ae13bb1a5` 以降

目的:  
既存のBCU runtime / trace / skeletonを、**妨害アイコン・状態異常effect animation・状態異常中actor挙動の実描画/実反映** まで完成させる。  
この版では、前版で残っていたリスクを以下のように実装仕様へ落とし込んで潰す。

```text
RISK 1: BCU effect assetがpack分散している
  -> suffix match algorithm / 優先順位 / ambiguity error / inventory schemaを固定

RISK 2: bundle reader APIをCodexが読み違える
  -> SemanticAssetProvider の実API名を固定

RISK 3: actor status保持形式が複数ある
  -> status snapshot normalizer の入力候補と正規化形式を固定

RISK 4: actor head/top座標がrenderer依存
  -> BattleSceneRendererの既存bounds APIとscreen座標変換式を固定

RISK 5: POISON/WARP/BARRIER/SHIELD/COUNTER/DMGCUT/DMGCAPが難しい
  -> Phase A/B/Cに分け、STOP/SLOW/WEAK/CURSE/SEALを完了ゲート、残りをasset-resolved実装/未解決分類へ分離
```

---

## 0. 最重要ゲート

今回の作業は、少なくとも以下が実際に戦闘画面で確認できるまで完了ではない。

```text
STOP / SLOW / WEAK / CURSE / SEAL のBCU状態effect iconがactor上に実描画される
STOP+SLOW ではSLOW iconがBCU通り抑制される
CURSE+SEAL ではCURSE iconがBCU通り抑制される
statusが消えたらeffectも消える
status継続中はeffect animationが更新される
STOP/SLOW/WEAK/CURSE/SEAL procが実際のactor状態へ反映される
```

以下は禁止。

```text
traceOnly:true のまま完了
resolverだけ作って完了
CSS/文字/emoji/仮画像で代用
asset missingを黙って無視
通常effectへfallback
wave/surge/StageBasisへ先に進み、妨害アイコンを後回し
```

**妨害アイコン・状態異常effect・状態中actor挙動が完成するまで、wave/surge/StageBasisの実置換へ進まないこと。**

---

## 1. BCU根拠ファイル

必ず読む。

```text
BCU_java_util_common/battle/entity/Entity.java
  - AnimManager.effs[]
  - AnimManager.getEff(int t)
  - AnimManager.checkEff()
  - AnimManager.drawEff(...)
  - Entity.processProcs(...)
  - Entity.damaged(...)

BCU_java_util_common/util/pack/EffAnim.java
  - EffAnimStore
  - EffAnim.read()
  - readCustom()
  - WarpEff / BarrierEff / ShieldEff / WeakUpEff / SpeedEff / ArmorEff / DmgCap

BCU_java_util_common/util/Data.java
  - A_PATH
  - P_STOP / P_SLOW / P_WEAK / P_CURSE / P_SEAL / P_POISON
  - REMOVABLE_PROC
```

古いtxt解析や推測を根拠にしない。

---

## 2. 現repoの実API固定

### 2.1 SemanticAssetProvider のbundle reader API

現repoには `js/bcu/SemanticAssetProvider.js` があり、STORE zipを読むための実APIは以下である。Codexはこれを使うこと。

```js
provider.archive(bundleRef)
provider.readArrayBufferByBundleRef(bundleRef, internalPath)
provider.readTextByBundleRef(bundleRef, internalPath)
provider.readBlobByBundleRef(bundleRef, internalPath, mimeType)
provider.createObjectUrl(bundleRef, internalPath, mimeType)
```

`bundleRef` は最低限これを持つ。

```js
{
  bundleKey: "effect:status",
  bundlePath: "public/assets/bundles/effect/status-effects.zip"
}
```

`readTextByBundleRef` は内部で `readArrayBufferByBundleRef` を呼び、zip内 `internalPath` を読む。  
`archive(bundleRef)` はzip内ファイルMapを返す。  
Codexは未知の `readZipFile` / `loadBundleFile` / `JSZip` APIを新規に仮定しないこと。

### 2.2 既存renderer座標API

現repo `BattleSceneRenderer` には以下がある。status icon位置はこれを使う。

```js
renderer.projectBattleX(scene, actor.x)
renderer.getEntityRenderY(scene, actor, actor.y)
renderer.getEntityRenderScale(scene, actor, actor.scale)
renderer.getBattleDrawListLocalBounds(actor, drawList)
renderer.getBattlePartLocalBounds(actor, drawEntry)
renderer.getActorGroundAnchorLocalY(actor, drawList)
```

`drawActor()` 内では、BCU drawListから `bounds = getBattleDrawListLocalBounds(actor, drawList)` を既に計算している。  
Codexはstatus effect positionerで同じ計算を使うこと。固定y値で完了扱いしない。

### 2.3 現actor status API

既存 `BattleActorProcStatusPatch.js` は `actor.bcuProcStatuses` を作成し、以下のkeyを使う。

```text
freeze
slow
weaken
curse
toxic
```

各statusは概ね以下を持つ。

```js
{
  key,
  framesRemaining,
  untilMs,
  durationMs,
  payload,
  source
}
```

既存patchには `actor.isBcuProcStatusActive(key, nowMs)` がある。  
Codexはstatus判定でこれを優先すること。

不足している `seal` は今回必ず追加する。  
既存 `applyStatus()` が `seal` 未対応なら、`BcuProcRuntime` か `BattleActorProcStatusPatch.js` にBCU根拠付きで追加する。

---

## 3. BCU effect asset mapping（確定）

### 3.1 共通ルール

BCU `EffAnim.load()` は `str + ".mamodel"` と `str + type.path() + ".maanim"` を読む。  
bundleには以下を正規化して入れる。

```text
image.png
imgcut.imgcut
model.mamodel
<VARIANT>.maanim
```

### 3.2 A_PATH系 status icon

BCU `Data.A_PATH` は以下。

```text
["down", "up", "slow", "stop", "shield", "farattack", "wave_invalid", "wave_stop", "waveguard"]
```

`EffAnim.read()` は `org/battle/s0/<name>/skill_<name>` とenemy版 `..._e` を作る。

| BCU effect | source prefix | image | imgcut | model | anim variant |
|---|---|---|---|---|---|
| `A_DOWN` | `org/battle/s0/down/skill_down` | `org/battle/s0/skill000.png` | `org/battle/s0/skill000.imgcut` | `org/battle/s0/down/skill_down.mamodel` | `org/battle/s0/down/skill_down.maanim` |
| `A_E_DOWN` | `org/battle/s0/down/skill_down_e` | `org/battle/s0/skill000.png` | `org/battle/s0/skill000.imgcut` | `org/battle/s0/down/skill_down_e.mamodel` | `org/battle/s0/down/skill_down_e.maanim` |
| `A_UP` | `org/battle/s0/up/skill_up` | `org/battle/s0/skill000.png` | `org/battle/s0/skill000.imgcut` | `org/battle/s0/up/skill_up.mamodel` | `org/battle/s0/up/skill_up.maanim` |
| `A_E_UP` | `org/battle/s0/up/skill_up_e` | `org/battle/s0/skill000.png` | `org/battle/s0/skill000.imgcut` | `org/battle/s0/up/skill_up_e.mamodel` | `org/battle/s0/up/skill_up_e.maanim` |
| `A_SLOW` | `org/battle/s0/slow/skill_slow` | `org/battle/s0/skill000.png` | `org/battle/s0/skill000.imgcut` | `org/battle/s0/slow/skill_slow.mamodel` | `org/battle/s0/slow/skill_slow.maanim` |
| `A_E_SLOW` | `org/battle/s0/slow/skill_slow_e` | `org/battle/s0/skill000.png` | `org/battle/s0/skill000.imgcut` | `org/battle/s0/slow/skill_slow_e.mamodel` | `org/battle/s0/slow/skill_slow_e.maanim` |
| `A_STOP` | `org/battle/s0/stop/skill_stop` | `org/battle/s0/skill000.png` | `org/battle/s0/skill000.imgcut` | `org/battle/s0/stop/skill_stop.mamodel` | `org/battle/s0/stop/skill_stop.maanim` |
| `A_E_STOP` | `org/battle/s0/stop/skill_stop_e` | `org/battle/s0/skill000.png` | `org/battle/s0/skill000.imgcut` | `org/battle/s0/stop/skill_stop_e.mamodel` | `org/battle/s0/stop/skill_stop_e.maanim` |
| `A_SHIELD` | `org/battle/s0/shield/skill_shield` | `org/battle/s0/skill000.png` | `org/battle/s0/skill000.imgcut` | `org/battle/s0/shield/skill_shield.mamodel` | `org/battle/s0/shield/skill_shield.maanim` |
| `A_E_SHIELD` | `org/battle/s0/shield/skill_shield_e` | `org/battle/s0/skill000.png` | `org/battle/s0/skill000.imgcut` | `org/battle/s0/shield/skill_shield_e.mamodel` | `org/battle/s0/shield/skill_shield_e.maanim` |

### 3.3 curse / seal

| BCU effect | source prefix | image | imgcut | model | anim variant |
|---|---|---|---|---|---|
| `A_CURSE` | `org/battle/s3/skill_curse` | `org/battle/s3/skill003.png` | `org/battle/s3/skill003.imgcut` | `org/battle/s3/skill_curse.mamodel` | `org/battle/s3/skill_curse.maanim` |
| `A_E_CURSE` | `org/battle/s11/skill_curse_e` | `org/battle/s11/skill011.png` | `org/battle/s11/skill011.imgcut` | `org/battle/s11/skill_curse_e.mamodel` | `org/battle/s11/skill_curse_e.maanim` |
| `A_SEAL` | `org/battle/s3/seal/seal` | `org/battle/s3/seal/seal.png` | `org/battle/s3/seal/seal.imgcut` | `org/battle/s3/seal/seal.mamodel` | `org/battle/s3/seal/seal.maanim` |
| `A_E_SEAL` | `org/battle/s3/seal_e/seal_e` | `org/battle/s3/seal_e/seal_e.png` | `org/battle/s3/seal_e/seal_e.imgcut` | `org/battle/s3/seal_e/seal_e.mamodel` | `org/battle/s3/seal_e/seal_e.maanim` |

`A_SEAL / A_E_SEAL` は `000001` 固定では見つからない場合がある。suffix match必須。

### 3.4 Phase B以降のeffect

STOP/SLOW/WEAK/CURSE/SEAL完了後、以下を実装する。これらはPhase B/Cとして扱い、Phase A完了の足止めにしない。

| group | effects |
|---|---|
| poison/toxic | `A_POI0`, `A_POI1`, `A_POI1_E`, `A_POI2..A_POI7`, `A_POISON` |
| warp | `A_W`, `A_W_C` with `ENTER`, `EXIT` |
| barrier | `A_B`, `A_E_B` with `NONE`, `BREAK`, `DESTR` |
| demon shield | `A_DEMON_SHIELD`, `A_E_DEMON_SHIELD` with `FULL`, `HALF`, `BROKEN`, `BREAKER`, `REGENERATION` |
| counter/dmgcut/dmgcap | `A_COUNTER`, `A_E_COUNTER`, `A_DMGCUT`, `A_E_DMGCUT`, `A_DMGCAP`, `A_E_DMGCAP` |
| speed/armor/lethargy | `A_SPEED`, `A_E_SPEED`, `A_ARMOR`, `A_E_ARMOR`, `A_LETHARGY` |

---

## 4. RISK 1対策: suffix match algorithm固定

### 4.1 新規script

作成:

```text
scripts/build-bcu-status-effect-bundle.mjs
```

### 4.2 source scan

scan root:

```text
public/assets/bcu
```

対象拡張子:

```text
.png
.imgcut
.mamodel
.maanim
```

### 4.3 suffix normalize

```js
function normalizeAssetPath(p) {
  return String(p || '').replace(/\\/g, '/').replace(/^\.?\//, '').replace(/^public\/assets\/bcu\/[^/]+\//, '');
}
```

ただし候補比較では、full pathから `org/battle/...` 以降を抽出して比較すること。

```js
function extractOrgBattleSuffix(fullPath) {
  const s = normalizeAssetPath(fullPath);
  const i = s.indexOf('org/battle/');
  return i >= 0 ? s.slice(i) : s;
}
```

### 4.4 findBySuffix

```js
function findBySuffix(allFiles, suffix) {
  const want = suffix.replace(/\\/g, '/').replace(/^\.?\//, '');
  const candidates = allFiles
    .filter((file) => extractOrgBattleSuffix(file) === want)
    .map((file) => ({
      file,
      packId: String(file).match(/public\/assets\/bcu\/([^/]+)\//)?.[1] || '',
      suffix: extractOrgBattleSuffix(file)
    }));

  candidates.sort((a, b) => {
    const ap = a.packId === '000001' ? 0 : 1;
    const bp = b.packId === '000001' ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return a.packId.localeCompare(b.packId) || a.file.localeCompare(b.file);
  });

  return {
    selected: candidates[0] || null,
    candidates,
    ambiguous: candidates.length > 1 && candidates[0].packId !== '000001'
  };
}
```

### 4.5 ambiguity policy

- 候補に `000001` がある場合は `000001` を選ぶ。
- `000001` がなく、候補が複数ある場合はpack id昇順で選ぶが、`ambiguous:true` をinventoryへ出す。
- Phase A必須effectで `ambiguous:true` の場合は完了禁止。AGENTS報告で候補一覧を出す。
- Phase B/C effectでambiguousなら未解決に分類してよい。

### 4.6 bundle internal path

zip内はこの形式に固定。

```text
A_STOP/image.png
A_STOP/imgcut.imgcut
A_STOP/model.mamodel
A_STOP/DEF.maanim

A_W/ENTER.maanim
A_W/EXIT.maanim

A_DEMON_SHIELD/FULL.maanim
A_DEMON_SHIELD/HALF.maanim
A_DEMON_SHIELD/BROKEN.maanim
A_DEMON_SHIELD/BREAKER.maanim
A_DEMON_SHIELD/REGENERATION.maanim
```

---

## 5. RISK 2対策: bundle reader実装固定

### 5.1 manifest更新

`public/assets/generated/bcu-bundle-manifest.json` に追加。

```json
{
  "bundles": {
    "effect:status": {
      "kind": "effect",
      "key": "effect:status",
      "bundlePath": "public/assets/bundles/effect/status-effects.zip",
      "status": "full"
    }
  }
}
```

### 5.2 inventory出力

作成:

```text
public/assets/generated/bcu-status-effect-inventory.json
```

形式:

```json
{
  "A_STOP": {
    "resolved": true,
    "ambiguous": false,
    "bundleRef": {
      "bundleKey": "effect:status",
      "bundlePath": "public/assets/bundles/effect/status-effects.zip"
    },
    "internal": {
      "image": "A_STOP/image.png",
      "imgcut": "A_STOP/imgcut.imgcut",
      "model": "A_STOP/model.mamodel",
      "DEF": "A_STOP/DEF.maanim"
    },
    "sources": {
      "image": "public/assets/bcu/000001/org/battle/s0/skill000.png",
      "imgcut": "public/assets/bcu/000001/org/battle/s0/skill000.imgcut",
      "model": "public/assets/bcu/000001/org/battle/s0/stop/skill_stop.mamodel",
      "DEF": "public/assets/bcu/000001/org/battle/s0/stop/skill_stop.maanim"
    },
    "candidates": {}
  }
}
```

### 5.3 runtime loader

作成/更新:

```text
js/battle/bcu-runtime/BcuStatusEffectAssetInventory.js
```

API固定:

```js
export async function loadBcuStatusEffectInventory(provider) {
  const root = provider.indexRoot?.replace(/\/$/, '') || './public/assets/generated';
  const inventory = await provider.fetchJson(`${root}/bcu-status-effect-inventory.json`);
  return inventory;
}

export function getStatusEffectBundleRef(provider) {
  const entry = provider.indexes?.bundleManifest?.bundles?.['effect:status'];
  if (!entry?.bundlePath) throw new Error('Missing effect:status bundle in bcu-bundle-manifest.json');
  return { bundleKey: 'effect:status', bundlePath: entry.bundlePath };
}

export async function readStatusEffectText(provider, effectKey, internalPath) {
  const bundleRef = getStatusEffectBundleRef(provider);
  return await provider.readTextByBundleRef(bundleRef, internalPath);
}

export async function readStatusEffectImageBlob(provider, effectKey, internalPath) {
  const bundleRef = getStatusEffectBundleRef(provider);
  return await provider.readBlobByBundleRef(bundleRef, internalPath, 'image/png');
}
```

CodexはこのAPI以外を仮定しない。

---

## 6. RISK 3対策: status snapshot normalizer固定

作成:

```text
js/battle/bcu-runtime/BcuStatusSnapshot.js
```

### 6.1 正規化出力

```js
{
  STOP: { active, framesRemaining, untilMs, sourceKeys: ['freeze'] },
  SLOW: { active, framesRemaining, untilMs, sourceKeys: ['slow'] },
  WEAK: { active, framesRemaining, untilMs, mult, sourceKeys: ['weaken'] },
  CURSE: { active, framesRemaining, untilMs, sourceKeys: ['curse'] },
  SEAL: { active, framesRemaining, untilMs, sourceKeys: ['seal'] },
  POISON: { active, framesRemaining, untilMs, sourceKeys: ['toxic', 'poison'] },
  WARP: { active, framesRemaining, untilMs, sourceKeys: ['warp'] },
  DEAD: { active, sourceKeys: ['state'] }
}
```

### 6.2 入力候補

優先順:

```text
1. actor.isBcuProcStatusActive(key, scene.timeMs)
2. actor.bcuProcStatuses[key]
3. actor.status[key]
4. actor.<key>UntilMs
5. actor.state / actor.bcuWarpState
```

key mapping:

```js
const STATUS_KEY_ALIASES = {
  STOP: ['freeze', 'stop', 'P_STOP'],
  SLOW: ['slow', 'P_SLOW'],
  WEAK: ['weaken', 'weak', 'P_WEAK'],
  CURSE: ['curse', 'P_CURSE'],
  SEAL: ['seal', 'P_SEAL'],
  POISON: ['toxic', 'poison', 'P_POISON', 'P_POIATK'],
  WARP: ['warp', 'P_WARP']
};
```

### 6.3 active判定

```js
function isActiveStatusValue(st, nowMs) {
  if (!st) return false;
  if (typeof st === 'boolean') return st;
  if (Number.isFinite(st.framesRemaining)) return st.framesRemaining > 0;
  if (Number.isFinite(st.untilMs)) return !Number.isFinite(nowMs) || nowMs < st.untilMs;
  if (Number.isFinite(st.remaining)) return st.remaining > 0;
  if (Number.isFinite(st.time)) return st.time > 0;
  return true;
}
```

### 6.4 resolverはnormalizerだけを見る

`BcuStatusIconResolver.js` は `actor.bcuProcStatuses` を直接読まず、必ず `getBcuStatusSnapshot(actor, scene)` を読む。

---

## 7. RISK 4対策: icon position algorithm固定

作成:

```text
js/battle/bcu-runtime/BcuStatusEffectPositioner.js
```

### 7.1 既存rendererからdrawList/boundsを取る

```js
function getActorBattleDrawList(actor) {
  if (!actor?.model) return null;
  if (typeof actor.model.getBattleDrawList === 'function') {
    return actor.model.getBattleDrawList({ parentMatrix: actor.kbeffEnabled ? actor.kbeffParentMatrix : null });
  }
  if (typeof actor.model.getDrawList === 'function') return actor.model.getDrawList();
  return null;
}
```

### 7.2 local bounds

既存renderer methodを使う。

```js
const drawList = getActorBattleDrawList(actor);
const bounds = renderer.getBattleDrawListLocalBounds(actor, drawList);
```

boundsが無い場合:

```text
positionSource: "missing-bounds"
rendered:false
完了扱いしない
```

### 7.3 screen position式

`drawActor()` の変換に合わせる。

```js
const modelAlignOffsetX = Number.isFinite(actor.visualRenderOffsetWorldPx) ? actor.visualRenderOffsetWorldPx : 0;
const crowdOffsetX = Number.isFinite(actor.visualCrowdFanoutPx) ? actor.visualCrowdFanoutPx : 0;
const crowdOffsetY = Number.isFinite(actor.visualCrowdYOffsetPx) ? actor.visualCrowdYOffsetPx : 0;
const kbOffsetX = Number.isFinite(actor.kbVisualOffsetX) ? actor.kbVisualOffsetX : 0;
const kbOffsetY = Number.isFinite(actor.kbVisualOffsetY) ? actor.kbVisualOffsetY : 0;

const worldX = actor.x + modelAlignOffsetX + crowdOffsetX + kbOffsetX;
const baseScreenX = renderer.projectBattleX(scene, worldX);
const baseScreenY = renderer.getEntityRenderY(scene, actor, actor.y) + crowdOffsetY + kbOffsetY;

const renderScale = renderer.getEntityRenderScale(scene, actor, actor.scale || 1);
const anchorY = renderer.getActorGroundAnchorLocalY(actor, drawList);

const topScreenY = baseScreenY + (bounds.top - anchorY) * renderScale;
const centerScreenX = baseScreenX + ((bounds.left + bounds.right) * 0.5) * renderScale;
```

### 7.4 BCU drawEff icon row

```js
const EWID = 36;
const iconScale = renderScale * 0.75;
const direction = actor.renderFlipX ? -1 : 1;
const startX = centerScreenX;
const y = topScreenY - 12 * renderer.getCameraScale(scene);

x = startX - iconIndex * EWID * direction * iconScale;
```

`positionSource` は `battle-draw-list-bounds` とする。  
この式で画面外/NaNならrenderせずtraceに出す。

---

## 8. RISK 5対策: Phase分割

### Phase A: 必須・完了ゲート

必ず実装完了。

```text
A_STOP
A_E_STOP
A_SLOW
A_E_SLOW
A_DOWN
A_E_DOWN
A_CURSE
A_E_CURSE
A_SEAL
A_E_SEAL
```

Phase A完了条件:

```text
inventory resolved:true
runtime load success
rendered:true
STOP/SLOW/WEAK/CURSE/SEAL proc applied:true
抑制条件一致
```

### Phase B: asset-resolvedなら実装

```text
A_POISON
A_POI0..A_POI7
A_W / A_W_C
A_B / A_E_B
A_DEMON_SHIELD / A_E_DEMON_SHIELD
A_COUNTER / A_E_COUNTER
A_DMGCUT / A_E_DMGCUT
A_DMGCAP / A_E_DMGCAP
```

Phase Bは `resolved:true` のものだけ実描画。missing/ambiguousは未解決に分類。

### Phase C: lifecycle完全統合

Barrier / Shield / Warp / Poisonは表示だけでなく、lifecycle runtimeと完全統合する。  
これはPhase Aの完了条件ではない。

---

## 9. Runtime実装ファイル

### 9.1 追加/更新

```text
scripts/build-bcu-status-effect-bundle.mjs
scripts/inventory-bcu-status-effects.mjs
scripts/smoke-bcu-status-effects.mjs

js/battle/bcu-runtime/BcuStatusEffectSpec.js
js/battle/bcu-runtime/BcuStatusEffectAssetInventory.js
js/battle/bcu-runtime/BcuStatusSnapshot.js
js/battle/bcu-runtime/BcuStatusEffectManager.js
js/battle/bcu-runtime/BcuStatusEffectPositioner.js
js/battle/BattleSceneBcuStatusEffectRenderPatch.js
```

### 9.2 BcuEntityEffectIconRuntime 完成条件

```text
image/imgcut/model/maanimをeffect:status bundleから読む
BcuModelInstance + BcuAnimator + BcuSpriteSheetでEffAnimを再生
update()でframe進行
isDone()で終了判定
draw(ctx, {x,y,scale,direction}) で実描画
```

CSS/文字/仮画像は禁止。

### 9.3 BcuStatusEffectManager

actorに保持:

```js
actor.bcuStatusEffectManager
```

API:

```js
updateStatusSnapshot()
resolveEffects()
ensureEffect(effectKey, variant, slot)
removeEffect(slot)
updateEffects()
getRenderableEffects()
```

BCU `checkEff()` 相当として、statusが切れたらeffectを消す。

### 9.4 Render patch

`BattleSceneRenderer.render()` はactor描画後にHP barを描く。  
status iconはactor本体描画後、HP bar前に入れる。

patch方針:

```text
BattleSceneRenderer.prototype.render を薄くpatchして、
actorsForRender のdrawActor直後または全actor描画後かつdrawHpBar前に drawBcuStatusEffects を呼ぶ。
全体置換禁止。
```

既存 `drawActor()` 本体は変更しない。

---

## 10. Proc実反映

`BcuProcRuntime.js` が `traceOnly:true` の場合、少なくとも以下は実反映へ変える。

```text
STOP / freeze
SLOW
WEAK
CURSE
SEAL
KB immunity gate
WARP immunity gate
```

二重適用防止:

```js
{
  applied: true,
  handledBy: "BcuProcRuntime",
  legacyShouldSkip: true
}
```

既存へ委譲:

```js
{
  applied: false,
  delegatedToLegacy: true,
  reason: "not-yet-ported"
}
```

statusが入ったら、同frameまたは次frameでstatus effectが生成されること。

---

## 11. 状態異常中actor挙動

### 11.1 STOP

必須:

```text
移動停止
攻撃timeline停止
本体animation停止
STOP icon表示
SLOW icon抑制
```

既存 `BattleActorProcStatusPatch.js` はfreeze中にactor.tickをreturnしているが、BattleScene側で直接 `a.x += ...` していないか必ず再確認する。  
直接移動がある場合、STOP時は移動させない。

### 11.2 SLOW

最低限、移動速度/進行速度へ反映し、traceに倍率とdurationを出す。

### 11.3 WEAK

与ダメ/被ダメ補正へ反映。BCU `processProcs()` / `damaged()` を読んでどちらに効くか明記する。

### 11.4 CURSE / SEAL

攻撃proc生成時点とwave/surge proc再評価時点でBCU条件通りに能力を抑制する。

---

## 12. Debug helper

手動検証用に必ず追加。

```js
globalThis.__BCU_TEST_APPLY_STATUS__ = function(actorOrSelector, statusKey, frames = 180) {}
globalThis.__BCU_TEST_CLEAR_STATUS__ = function(actorOrSelector, statusKey) {}
globalThis.__BCU_TEST_LIST_STATUS_EFFECTS__ = function() {}
```

使用例:

```js
const a = globalThis.__APP__.scene.actors.find(a => a.side === 'cat-enemy');
globalThis.__BCU_TEST_APPLY_STATUS__(a, 'STOP', 180);
globalThis.__BCU_TEST_APPLY_STATUS__(a, 'SLOW', 180);
globalThis.__BCU_TEST_LIST_STATUS_EFFECTS__();
```

---

## 13. smoke test

追加:

```text
scripts/smoke-bcu-status-effects.mjs
```

必須test:

```text
inventory resolves Phase A required effects
suffix match selects 000001 when present
suffix match reports ambiguous when no 000001 and multiple candidates
SemanticAssetProvider API readTextByBundleRef/readBlobByBundleRef used
StatusSnapshot normalizes freeze/slow/weaken/curse/seal/toxic/warp
StatusIconResolver STOP only
StatusIconResolver SLOW only
StatusIconResolver STOP+SLOW
StatusIconResolver CURSE+SEAL
StatusIconResolver dead
StatusIconResolver warp
BcuStatusEffectManager ensure/remove/update
BcuProcRuntime STOP applied true
BcuProcRuntime SLOW applied true
BcuProcRuntime CURSE applied true
Positioner returns finite x/y for actor with bounds
```

実行:

```bash
node scripts/build-bcu-status-effect-bundle.mjs
node scripts/inventory-bcu-status-effects.mjs
node scripts/smoke-bcu-status-effects.mjs
find js -name "*.js" -print0 | xargs -0 -n1 node --check
```

`package.json` が無い場合、`npm run build` 失敗を理由に作業を止めない。

---

## 14. 完了条件

以下を全部満たすまで完了禁止。

```text
1. effect:status bundleが生成される
2. bcu-status-effect-inventory.json が生成される
3. Phase A必須10 effectが resolved:true かつ ambiguous:false
4. STOP iconが画面表示される
5. SLOW iconが画面表示される
6. STOP+SLOWでSLOWが抑制される
7. WEAK系iconがBCU条件で表示される
8. CURSE iconが表示される
9. SEAL iconが表示される
10. CURSE+SEALでCURSEが抑制される
11. STOP/SLOW/WEAK/CURSE/SEAL procが実反映される
12. STOP中のactor本体animation/attack/moveがBCU準拠で止まる
13. 状態effect animationがBCU準拠で更新される
14. __BCU_STATUS_ICON_RENDER_TRACE__ に rendered:true が出る
15. traceOnly:true のまま完了扱いしていない
16. 戦闘起動・ステージ選択・カードUI・KBが壊れていない
```

---

## 15. 今回後回しにするもの

妨害アイコンと状態異常表示が完了するまでは、以下を主作業にしない。

```text
wave/surge完全置換
StageBasis.update完全置換
スマホ入力完全置換
UIデザイン調整
glow再調査
```

---

## 16. commit message

`update` 禁止。

推奨:

```text
Render BCU status effect icons and apply status proc runtime
```

---

## 17. 最終報告テンプレ

```text
原因:
  b66889b4時点でtrace-only / skeleton止まりだった箇所

BCU根拠:
  Entity.AnimManager.getEff/drawEff/checkEff
  EffAnim.read/readCustom
  Data.A_PATH
  Entity.processProcs/damaged

JS対象コード:
  変更ファイル一覧

修正:
  effect:status bundle
  bcu-status-effect-inventory.json
  suffix match
  SemanticAssetProvider実API接続
  StatusSnapshot normalizer
  positioner
  妨害アイコン実描画
  状態effect animation更新
  Proc実反映
  STOP/SLOW/WEAK/CURSE/SEAL挙動

commit:
  hash

確認方法:
  __BCU_STATUS_ICON_TRACE__
  __BCU_STATUS_ICON_RENDER_TRACE__
  __BCU_PROC_TRACE__
  node scripts/build-bcu-status-effect-bundle.mjs
  node scripts/inventory-bcu-status-effects.mjs
  node scripts/smoke-bcu-status-effects.mjs
  手動console helper

BCU準拠と言える範囲:
  表示/抑制/更新/Proc反映がBCU根拠と一致した範囲

残る未解決:
  Phase B/C missing asset
  未移植status
  schema未確定
  BCU完全一致未検証箇所

rollback方法:
  revert commit
```
