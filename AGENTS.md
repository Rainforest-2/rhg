# AGENTS.md — BCU完全準拠化 実装指示書

Repository: `rhgrive2/game`  
Target branch: `main`  
Goal: ブラウザ版にゃんこ/BCU準拠ゲームを、BCU common / Android / PC / 本家assetに照合しながら、戦闘ロジック・描画・状態異常・波動/烈波・スマホ入力を段階的に完成させる。

この文書はCodexに渡す作業指示書である。Codexは過去会話を参照できない前提で、ここに書かれた順序・禁止事項・検証手順を必ず守ること。

---

## 0. ファクトチェック済み事項

このAGENTS.mdは以下のBCU実コードと現repo実コードに基づく。

### 0.1 BCU参照ファイルのパス

以下のパスは存在確認済み。

```text
battlecatsultimate/BCU_java_util_common/battle/StageBasis.java
battlecatsultimate/BCU_java_util_common/battle/SBCtrl.java
battlecatsultimate/BCU_java_util_common/battle/entity/Entity.java
battlecatsultimate/BCU_java_util_common/battle/entity/EUnit.java
battlecatsultimate/BCU_java_util_common/battle/entity/EEnemy.java
battlecatsultimate/BCU_java_util_common/battle/attack/AttackWave.java
battlecatsultimate/BCU_java_util_common/battle/attack/AttackVolcano.java
battlecatsultimate/BCU_java_util_common/battle/attack/ContWaveAb.java
battlecatsultimate/BCU_java_util_common/battle/attack/ContWaveDef.java
battlecatsultimate/BCU_java_util_common/battle/attack/ContVolcano.java
battlecatsultimate/BCU_java_util_common/util/anim/AnimU.java
battlecatsultimate/BCU_java_util_common/util/anim/EAnimD.java
battlecatsultimate/BCU_java_util_common/util/anim/EPart.java
battlecatsultimate/BCU_java_util_common/util/ImgCore.java
battlecatsultimate/BCU_java_util_common/util/pack/EffAnim.java
battlecatsultimate/BCU_java_util_common/util/Data.java
battlecatsultimate/BCU_Android/app/src/main/java/com/mandarin/bcu/BattleSimulation.kt
battlecatsultimate/BCU_Android/app/src/main/java/com/mandarin/bcu/androidutil/battle/BattleView.kt
battlecatsultimate/BCU-java-PC/src/main/java/main/Timer.java
```

注意: 旧案にあった `EAnimU.java` は誤り。正しくは `util/anim/AnimU.java`。

### 0.2 BCU `UType.HB` とKBアニメ

`AnimU.UType` は `WALK, IDLE, ATK, HB, ENTER, ...` を持ち、`TYPE4` は `{ WALK, IDLE, ATK, HB }`。つまりunitの4番目アニメがBCUのHB/KBアニメである。現repoではsemantic bundleの `kb.maanim` がこの役割を担う。

### 0.3 BCU波動

`ContWaveDef.update()` は、通常波動attack frameを6、mini wave attack frameを4として扱う。`t <= attack` の間にwave stopperをcaptureし、stopperがあれば停止effectを出して関連waveをdeactivateする。`t == attack` で `sb.getAttack(atk)`、`t == W_TIME / W_MINI_TIME` で次waveを作る。

`AttackWave` は `incl` setを持ち、同一wave chainで同じEntityを重複hitしない。

### 0.4 BCU烈波

`ContVolcano.update()` は `START -> DURING -> END` のEffAnim状態を持つ。`t >= VOLC_PRE` でDURING、`t > VOLC_PRE + aliveTime` でENDへ移行し、alive期間中に `sb.getAttack(v)` を呼ぶ。`updateProc()` はattackerのCURSE/SEAL状態を見て烈波中のprocを消す/復元する。

`AttackVolcano` は `vcapt` と `VOLC_ITV` を持ち、同一対象への再hit間隔を制御する。

### 0.5 状態異常アイコン

`Entity.AnimManager.getEff()` は STOP/SLOW/WEAK/CURSE/SEAL/POISON/WARP/BARRIER/SHIELD/COUNTER/DMGCUT/DMGCAP などに対応するEffAnimを `effs[]` にセットする。状態アイコンは本体modelのpartではなく、Entity animation managerのeffectとして扱う。

### 0.6 EPart / ImgCore / glow

`EPart.drawPart()` は親transformを再帰適用し、`opa()` で親opacityを含めた不透明度を計算し、`ImgCore.drawImg()` に `opa, glow, extendX, extendY` を渡す。`ImgCore.drawImg()` は `glow` が `1/2/3/-1` の場合だけBLENDを使い、それ以外は通常合成/透過合成を使う。描画後は必ずDEFへ戻す。

024の黒塊バグは、glow=0の通常パーツまでglow合成経路へ流し、caller側alphaを壊した副作用だった。現mainでは `BcuSpriteSheet.js` / `BcuCanvasComposite.js` の最小修正で直っているはず。今後renderer全体置換で再発させないこと。

### 0.7 Androidスマホ入力

`BattleView.checkSlideUpDown()` は、lineupChanging / isOneLineup / 自城HP0 / dragFrame0 / performed済みなら何もしない。`abs(dy) >= height * 0.15` かつ縦判定で、`dy / dragFrame < 0` なら上、そうでなければ下のlineup change actionへ送る。`isInSlideRange()` は `tan(50°) >= abs(dx) / abs(dy)`。

---

## 1. 絶対ルール

### 1.1 推測実装禁止

BCU準拠と主張する変更は、必ずBCU実コードまたは現repo実コードを読んでから行う。古いtxt解析、会話ログ、曖昧な記憶を証拠にしない。

### 1.2 fallback禁止

assetが無い、bundleが無い、parserが失敗した場合に、通常effect・空描画・仮assetへ黙って逃がすのは禁止。必要assetが無いなら明示debugまたは明示エラーにする。

### 1.3 巨大置換禁止

以下を丸ごと置換・大幅短縮しない。

```text
js/battle/BattleScene.js
js/battle/BattleSceneRenderer.js
js/battle/BattleActor.js
js/main.js
index.html
css/style.css
```

特に `BattleSceneRenderer.js` は過去に大幅置換で戦闘不能になった。renderer全体の書き換えは禁止。必要なら小さなadapter/patched methodだけにする。

### 1.4 1機能1patch

新規実装は原則として新規runtime/adapter/patchに分離する。

```text
js/battle/bcu-runtime/*.js
js/bcu-render/*.js
js/input/*.js
```

### 1.5 trace必須

BCU準拠作業には必ずdebug traceを付ける。

```js
globalThis.__BCU_FRAME_TRACE__
globalThis.__BCU_ENTITY_TRACE__
globalThis.__BCU_ATTACK_TRACE__
globalThis.__BCU_PROC_TRACE__
globalThis.__BCU_RENDER_TRACE__
globalThis.__BCU_WAVE_TRACE__
globalThis.__BCU_SURGE_TRACE__
globalThis.__BCU_STATUS_ICON_TRACE__
globalThis.__BCU_STAGEBASIS_TRACE__
globalThis.__BCU_INPUT_TRACE__
globalThis.__BCU_BLEND_TRACE__
globalThis.__BCU_EPART_MATRIX_TRACE__
```

### 1.6 報告テンプレ

各commit後、必ず以下を報告する。

```text
原因:
BCU根拠:
JS対象コード:
修正:
commit:
確認方法:
残る未解決:
rollback方法:
```

「100%準拠」と言えるのは、BCUコード根拠とtrace一致がある範囲だけ。

---

## 2. 作業開始時の必須手順

### 2.1 現main確認

```bash
git fetch origin
git checkout main
git pull --ff-only origin main
git log --oneline -20
```

必ず読むファイル:

```text
AGENTS.md
index.html
js/main.js
js/battle/BattleScene.js
js/battle/BattleSceneRenderer.js
js/battle/BattleActor.js
js/battle/BcuKnockbackRuntimePatch.js
js/battle/BcuKnockbackProcPriorityPatch.js
js/battle/BcuKnockbackEffectLayerPatch.js
js/battle/BcuKnockbackAnimationPatch.js
js/battle/BcuProcImmunityPatch.js
js/bcu/BcuSpriteSheet.js
js/bcu/BcuCanvasComposite.js
css/touch-fix.css
```

### 2.2 BCU repo取得

```bash
mkdir -p ../bcu-ref
cd ../bcu-ref

git clone https://github.com/battlecatsultimate/BCU_java_util_common.git || true
git clone https://github.com/battlecatsultimate/BCU_Android.git || true
git clone https://github.com/battlecatsultimate/BCU-java-PC.git || true
```

取得できない場合、推測実装せず停止して報告する。

### 2.3 実装前に必ずgrepする語

```bash
grep -R "class ContWaveDef\|class AttackWave" ../bcu-ref/BCU_java_util_common/battle/attack -n
grep -R "class ContVolcano\|class AttackVolcano" ../bcu-ref/BCU_java_util_common/battle/attack -n
grep -R "void update()" ../bcu-ref/BCU_java_util_common/battle/StageBasis.java -n
grep -R "getEff\|drawEff\|checkEff" ../bcu-ref/BCU_java_util_common/battle/entity/Entity.java -n
grep -R "drawImg\|drawRandom" ../bcu-ref/BCU_java_util_common/util/ImgCore.java -n
grep -R "checkSlideUpDown\|isInSlideRange" ../bcu-ref/BCU_Android/app/src/main/java -n
```

---

## 3. 推奨実装順

この順番を守る。

```text
Phase 0: Trace基盤
Phase 1: FakeGraphics / EPart / EffAnim / Blend互換層
Phase 2: 状態異常アイコン
Phase 3: Proc / 免疫 / 耐性 / 妨害完全化
Phase 4: 波動 ContWaveDef 完全化
Phase 5: 烈波 ContVolcano 完全化
Phase 6: Barrier / Shield / Zombie / Warp / Revenge / Soulstrike
Phase 7: StageBasis.update順序一致
Phase 8: スマホ版BCU入力完全化
```

理由:

- 描画互換層が曖昧なままwave/surge/status iconを入れると、黒塊・巨大化・ズレが再発する。
- Proc完全化前にwave/surgeを完成扱いすると、免疫・耐性・curse/sealで再修正になる。
- StageBasis.updateを先に置換すると全戦闘が壊れやすい。
- DOM touch policyをAndroid入力と分離しないとoverlay/scrollが死ぬ。

---

# Phase 0: Trace基盤

## 目的

ロジック変更前に観測基盤を作る。このphaseでは戦闘挙動を変えない。

## 新規作成ファイル

```text
js/battle/bcu-runtime/BcuTraceRuntime.js
js/battle/bcu-runtime/BcuFrameTrace.js
js/battle/bcu-runtime/BcuEntityTrace.js
js/battle/bcu-runtime/BcuAttackTrace.js
js/battle/bcu-runtime/BcuProcTrace.js
js/battle/bcu-runtime/BcuRenderTrace.js
```

## API

`BcuTraceRuntime.js`:

```js
const MAX_TRACE = 200;

export const BcuTraceRuntime = {
  enabled: true,
  frame: 0,
  channels: new Map(),
  resetFrame(frame) {},
  push(channel, entry) {},
  get(channel) {},
  expose() {}
};
```

仕様:

- 各channelはring buffer最大200件。
- actor/model/imageなど巨大objectを入れない。
- entryには `frame`, `source`, `bcuReference` を入れる。

## main.js接続

`js/main.js` の早い段階で追加。

```js
await import('./battle/bcu-runtime/BcuTraceRuntime.js');
```

既存patch順を壊さないこと。

## 確認

```js
globalThis.__BCU_FRAME_TRACE__
globalThis.__BCU_ENTITY_TRACE__
```

戦闘が今まで通り起動し、traceが見えること。

## rollback

`main.js` のimportと新規ファイル削除。

---

# Phase 1: FakeGraphics / EPart / EffAnim / Blend互換層

## 目的

024黒塊、KBEff巨大化、wave/surge/status icon描画ズレを防ぐ描画基盤を作る。renderer全体を触らない。

## BCU根拠

- `EPart.drawPart()` は `transform()`, `getSize()`, `opa()`, `glow`, `extendX/Y` を使って `drawImg()` / `drawRandom()` へ渡す。
- `EPart.opa()` は親opacityを掛ける。
- `EPart.setPara()` は親partを差し替える。KBEff paraToもここに関係する。
- `ImgCore.drawImg()` は `glow=1/2/3/-1` だけBLEND。それ以外は通常/透過合成。描画後DEFへ戻す。

## 新規作成ファイル

```text
js/bcu-render/BcuBlendRuntime.js
js/bcu-render/BcuFakeGraphicsCanvas2D.js
js/bcu-render/BcuEPartTransformRuntime.js
js/bcu-render/BcuEffAnimRuntime.js
js/bcu-render/BcuRenderTrace.js
```

## 1. BcuBlendRuntime

### API

```js
export function isBcuBlendGlow(glow) {
  return glow === 1 || glow === 2 || glow === 3 || glow === -1;
}

export function drawBcuImage(ctx, image, sx, sy, sw, sh, dx, dy, dw, dh, options = {}) {}
```

### 必須仕様

- `glow=0` の通常描画ではcallerの `ctx.globalAlpha` を壊さない。
- `glow=1/2/3/-1` のときだけblend経路。
- 描画後に `globalCompositeOperation` と `globalAlpha` を必ず戻す。
- `extendX/Y` は最初はtraceだけでよい。実装するときは `ImgCore.drawImg()` の分割描画を参照する。

### debug

```js
globalThis.__BCU_BLEND_TRACE__
```

entry例:

```js
{
  frame,
  partIndex,
  glow,
  opacity,
  callerAlpha,
  compositeBefore,
  compositeAfter,
  path: 'normal' | 'blend' | 'pixel-fallback',
  bcuReference: 'ImgCore.drawImg'
}
```

## 2. BcuEPartTransformRuntime

### API

```js
export function computeBcuPartDrawEntry({ model, anim, frame, partIndex, parentMatrix }) {}
export function computeBcuDrawList({ model, anim, frame, parentMatrix }) {}
```

### 出力

```js
{
  partIndex,
  parentIndex,
  matrix,
  graphicsMatrix,
  opacity,
  glow,
  pivotX,
  pivotY,
  scaleX,
  scaleY,
  angle,
  extendX,
  extendY,
  source: 'BcuEPartTransformRuntime'
}
```

### 実装上の注意

最初は既存 `BcuModelInstance.getBattleDrawList()` と比較traceだけにする。rendererへ直接接続しない。

### debug

```js
globalThis.__BCU_EPART_MATRIX_TRACE__
```

## 3. BcuEffAnimRuntime

### API

```js
export class BcuEffAnimRuntime {
  constructor({ model, anim, imgcut, image, type }) {}
  setFrame(frame) {}
  update() {}
  done() {}
  getDrawList({ parentMatrix } = {}) {}
}
```

### 検証fixture

```text
024 attack glow
KBEff KB
wave effect
surge effect
status icon effect
```

## 既存コードへの接続

初回commitでは接続しない。traceだけ。  
次commitで `BcuSpriteSheet` / `BcuCanvasComposite` の内部から `BcuBlendRuntime` を呼ぶ。

禁止:

```text
BattleSceneRenderer.js全体置換
actor renderer全体置換
glow=0をblend処理へ流す
```

## 検証

```js
globalThis.__BCU_BLEND_TRACE__
globalThis.__BCU_EPART_MATRIX_TRACE__
globalThis.__BCU_RENDER_TRACE__
```

手動確認:

```text
024攻撃で黒塊再発なし
KBEff巨大化なし
通常actorの透明度が壊れない
戦闘起動不能にならない
```

---

# Phase 2: 状態異常アイコン

## 目的

BCU `Entity.AnimManager.effs[]` 相当の状態アイコン表示を実装する。

## BCU根拠

参照:

```text
BCU_java_util_common/battle/entity/Entity.java
- AnimManager.effs[]
- AnimManager.getEff(int t)
- AnimManager.drawEff(...)
- AnimManager.checkEff()
```

主な対応:

```text
P_STOP  -> A_STOP / A_E_STOP
P_SLOW  -> A_SLOW / A_E_SLOW
P_WEAK  -> A_DOWN / A_E_DOWN or A_WEAK_UP / A_E_WEAK_UP
P_CURSE -> A_CURSE / A_E_CURSE
P_SEAL  -> A_SEAL / A_E_SEAL
P_POISON -> A_POI*
P_WARP -> WaprCont / A_W enter/exit
BREAK_* -> A_B / A_E_B
SHIELD_* -> A_DEMON_SHIELD / A_E_DEMON_SHIELD
P_ARMOR / P_SPEED / P_LETHARGY / P_COUNTER / P_DMGCUT / P_DMGCAP
```

表示抑制:

```text
dead中は描かない
warp中は描かない
STOP中はSLOWアイコンを出さない
WEAK中はUPアイコンを出さない
SEAL中はCURSEアイコンを出さない
EWID = 36
scale = siz * 0.75
```

## 新規作成ファイル

```text
js/battle/bcu-runtime/BcuStatusIconResolver.js
js/battle/bcu-runtime/BcuEntityEffectIconRuntime.js
js/battle/BattleSceneBcuStatusIconPatch.js
```

## 実装手順

### 1. BcuStatusIconResolver

API:

```js
export function resolveStatusIcons(actor, scene) {}
```

戻り値:

```js
[
  {
    id: 'A_STOP',
    bcuStatus: 'P_STOP',
    variant: 'unit' | 'enemy',
    effectKey: 'A_STOP',
    suppressed: false,
    suppressedReason: null,
    xSlot: 0,
    yOffset: 0,
    scale: 0.75
  }
]
```

actorから読む候補:

```text
actor.bcuProcStatuses
actor.status
actor.side
actor.direction / dire
actor.hp / health
actor.state
actor.kbBcuType
actor.bcuWarpState
```

### 2. BcuEntityEffectIconRuntime

EffAnim bundleからstatus iconを読む。assetがない場合はfallbackしない。

### 3. BattleSceneBcuStatusIconPatch

renderer本体を大きく変更しない。`scene.effects` にstatus icon effectとして追加するか、専用小patchで描画する。

禁止:

```text
CSS/emoji/文字で代用
actor本体modelへ混ぜる
missing assetを空描画で握りつぶす
```

## debug

```js
globalThis.__BCU_STATUS_ICON_TRACE__
```

entry:

```js
{
  frame,
  actorId,
  statusSnapshot,
  icons,
  suppressed,
  source: 'BcuStatusIconResolver',
  bcuReference: 'Entity.AnimManager.getEff/drawEff'
}
```

## 検証

```text
STOPだけ -> STOP表示
SLOWだけ -> SLOW表示
STOP+SLOW -> SLOW抑制
WEAK down -> DOWN表示
WEAK up -> WEAK_UP表示
CURSE+SEAL -> CURSE抑制
WARP中 -> 状態アイコン非表示
dead中 -> 状態アイコン非表示
```

---

# Phase 3: Proc / 免疫 / 耐性 / 妨害完全化

## 目的

full immunityだけでなく、BCUの `processProcs()` / `damaged()` / `getResistValue()` を分解して移植する。

## BCU根拠

参照:

```text
BCU_java_util_common/battle/entity/Entity.java
- damaged(AttackAb atk)
- processProcs(AttackAb atk)
- getResistValue(...)
BCU_java_util_common/battle/entity/EUnit.java
- getResistValue(...)
BCU_java_util_common/battle/entity/EEnemy.java
- getResistValue(...)
```

重要:

```text
time = cannon攻撃なら1、それ以外は 1 + fruit * 0.2 / 3
dist = 1 + fruit * 0.1
STOP/SLOW/WEAK/CURSE/KB/WARP/SEAL/POISON/ARMOR/SPEED/LETHARGYは耐性を通す
IMUWAVE/IMUVOLCなどはdamaged側でdamage無効/減衰
無効ならINV effect
EUnitとEEnemyでgetResistValue実装が違う
```

## 現状

`BcuProcImmunityPatch.js` はfull immunity `mult >= 100` の入口だけ。完全化では `BcuProcRuntime` へ統合する。

## 新規作成ファイル

```text
js/battle/bcu-runtime/BcuProcRuntime.js
js/battle/bcu-runtime/BcuImmunityRuntime.js
js/battle/bcu-runtime/BcuResistRuntime.js
js/battle/bcu-runtime/BcuProcRandomRuntime.js
js/battle/bcu-runtime/BcuDamageGuardRuntime.js
js/battle/BattleSceneBcuProcRuntimePatch.js
```

## 実装手順

### 1. BcuProcRuntime skeleton

```js
export class BcuProcRuntime {
  performProc({ attacker, target, attack, proc, rng }) {}
  applyStop(ctx) {}
  applySlow(ctx) {}
  applyWeak(ctx) {}
  applyCurse(ctx) {}
  applyKb(ctx) {}
  applyWarp(ctx) {}
  applySeal(ctx) {}
  applyPoison(ctx) {}
  applyArmor(ctx) {}
  applySpeed(ctx) {}
  applyLethargy(ctx) {}
}
```

### 2. BcuResistRuntime

```js
export function getBcuResistValue({ target, attack, procName, procResist }) {}
export function applyBcuProcDuration({ rawTime, fruit, attack, resist }) {}
export function applyBcuProcDistance({ rawDistance, fruit, resist }) {}
```

EUnit/EEnemyで分岐する。

### 3. BcuDamageGuardRuntime

`damaged()` 前処理を分離。

対象:

```text
IMUCANNON
IMUWAVE
IMUMOVING
IMUVOLC
IMUBLAST
IMUATK / IMUATKANY
DMGCUT
DMGCAP
BARRIER
DEMONSHIELD
```

### 4. 接続

`BattleActor.applyBcuProc()` を肥大化させない。`BattleSceneBcuProcRuntimePatch.js` で入口だけ差し替える。

## debug

```js
globalThis.__BCU_PROC_TRACE__
globalThis.__BCU_DAMAGE_GUARD_TRACE__
```

entry:

```js
{
  frame,
  attacker,
  target,
  procName,
  rawTime,
  rawDistance,
  fruit,
  resist,
  finalTime,
  finalDistance,
  blocked,
  blockedReason,
  invEffect,
  statusBefore,
  statusAfter
}
```

## 検証

```text
full immunity 100% -> statusなし + INV effect
resist 50% -> duration/distance減衰
KB resist -> KB距離減衰
wave immune -> damage無効/減衰
surge immune -> damage無効/減衰
curse/seal中のproc制限
```

---

# Phase 4: 波動 ContWaveDef完全化

## BCU根拠

参照:

```text
BCU_java_util_common/battle/attack/ContWaveAb.java
BCU_java_util_common/battle/attack/ContWaveDef.java
BCU_java_util_common/battle/attack/AttackWave.java
```

仕様:

```text
ContWaveDef:
- mini attack frame = 4
- normal attack frame = 6
- t==0でSE
- t<=attackでwave stopper判定
- stopperならSTPWAVE effect, deactivate
- t==attackでsb.getAttack(atk)
- t==W_TIME/W_MINI_TIMEでnextWave
- nextWaveはW_PROG進む

AttackWave:
- incl Set<Entity>を共有
- captureでincl済みを除外
- excuseでdamage後inclへ追加
```

## 新規作成ファイル

```text
js/battle/bcu-runtime/BcuAttackWaveRuntime.js
js/battle/bcu-runtime/BcuContWaveDefRuntime.js
js/battle/bcu-runtime/BcuWaveStopperRuntime.js
js/battle/BattleSceneBcuWaveRuntimePatch.js
```

## 実装手順

### 1. BcuAttackWaveRuntime

保持:

```js
{
  attacker,
  sourceAttack,
  pos,
  sta,
  end,
  waveType,
  incl: new Set(),
  proc,
  rawAtk
}
```

`capture(scene)`:

- BCU `model.b.inRange()` 相当を既存hit adapterで行う。
- `incl` 済みactorは除外。
- `AB_ONLY` / traitCompatible相当が未実装ならdebugへ出し、推測しない。

`excuse(scene)`:

- damage/proc処理。
- damagedしたtargetをinclへ追加。

### 2. BcuContWaveDefRuntime

保持:

```js
{
  atk,
  anim,
  waves,
  t,
  maxt,
  layer,
  pos,
  activate,
  tempAtk
}
```

update順:

```js
const attackFrame = atk.waveType === WT_MINI ? 4 : 6;

if (t === 0) playSE(SE_WAVE);

if (t <= attackFrame) {
  atk.capture();
  if (hasWaveStopper(atk.capt)) {
    spawnStopWaveEffect();
    deactivateAllRelatedWaves();
    return;
  }
}

if (!activate) return;

if (t === waveLifeTime) maybeNextWave();
if (t === attackFrame) scene.bcuAttackRuntime.getAttack(atk);
if (maxt === t) activate = false;
if (t >= 0) anim.update(false);
t++;
```

### 3. 既存簡易waveを排他

`BattleWaveRuntimePatch.js` のqueueと二重発火しないようにfeature flag。

```js
BATTLE_CONFIG.bcuRuntime.waveMode = 'cont-wave-def';
```

## debug

```js
globalThis.__BCU_WAVE_TRACE__
```

entry:

```js
{
  frame,
  waveId,
  t,
  attackFrame,
  pos,
  waveType,
  levelRemaining,
  blocked,
  blockerActor,
  hitTargets,
  nextWaveCreated,
  active
}
```

## 検証

```text
通常波動 attackFrame=6
mini波動 attackFrame=4
同一chainで同target重複hitなし
wave stopperで停止effect
W_PROGで次wave生成
既存queueと二重hitしない
```

---

# Phase 5: 烈波 ContVolcano完全化

## BCU根拠

参照:

```text
BCU_java_util_common/battle/attack/ContVolcano.java
BCU_java_util_common/battle/attack/AttackVolcano.java
```

仕様:

```text
ContVolcano:
- START animationで生成
- t>=VOLC_PRE でDURING
- t>VOLC_PRE+aliveTime でEND
- aliveTime中に毎frame sb.getAttack(v)
- VOLC_SE周期でloop SE
- updateProcでattackerのCURSE/SEALを見てproc消去/復元
- reflected counter surgeあり

AttackVolcano:
- vcaptでhit済み対象管理
- VOLC_ITV周期でvcapt.clear()
- excuseでdamage後vcapt.add(target)
```

## 新規作成ファイル

```text
js/battle/bcu-runtime/BcuAttackVolcanoRuntime.js
js/battle/bcu-runtime/BcuContVolcanoRuntime.js
js/battle/bcu-runtime/BcuCounterSurgeRuntime.js
js/battle/BattleSceneBcuSurgeRuntimePatch.js
```

## 実装手順

### 1. BcuAttackVolcanoRuntime

保持:

```js
{
  attacker,
  sta,
  end,
  waveType,
  handler,
  vcapt: new Set(),
  volcTime: VOLC_ITV,
  attacked: false
}
```

`capture()` は `vcapt` にいるtargetを除外。

`excuse()`:

```js
processProc();
volcTime--;
if (volcTime === 0) {
  volcTime = VOLC_ITV;
  vcapt.clear();
}
applyDamage();
vcapt.add(target);
attacked = true;
```

### 2. BcuContVolcanoRuntime

保持:

```js
{
  v,
  anim,
  t,
  aliveTime,
  startPoint,
  endPoint,
  reflected,
  surgeSummoned,
  activate
}
```

update順:

```js
updateProc();
if (t >= VOLC_PRE && t <= VOLC_PRE + aliveTime && phase !== DURING) change DURING;
else if (t > VOLC_PRE + aliveTime && phase !== END) change END;

if (t >= VOLC_PRE && t < VOLC_PRE + aliveTime && (t - VOLC_PRE) % VOLC_SE === 0) play loop SE;

if (t >= aliveTime + VOLC_POST + VOLC_PRE) activate = false;
else {
  t++;
  if (t > VOLC_PRE && t < VOLC_POST + aliveTime) scene.getAttack(v);
  updateAnimation();
}
```

### 3. updateProc

BCU `ContVolcano.updateProc()` 通りに、curse/sealでprocを消す/復元する。文字列配列もBCUからそのまま写す。

## debug

```js
globalThis.__BCU_SURGE_TRACE__
```

entry:

```js
{
  frame,
  surgeId,
  t,
  phase,
  aliveTime,
  startPoint,
  endPoint,
  attackIssued,
  vcaptSize,
  procCleared,
  procRestored,
  reflected
}
```

## 検証

```text
START/DURING/END切替
aliveTime中だけhit
VOLC_ITVで同target再hit可能
curse/sealでproc消去/復元
counter surge二重発火なし
```

---

# Phase 6: Barrier / Shield / Zombie / Warp / Revenge / Soulstrike

## BCU根拠

参照:

```text
BCU_java_util_common/battle/entity/Entity.java
- Barrier
- ZombX
- KBManager
- damaged()
- preKill()
- kill()
- updateRevive()
```

## 実装順

### 6.1 Barrier

新規:

```text
js/battle/bcu-runtime/BcuBarrierRuntime.js
```

仕様:

```text
barrierありなら本体damage前に処理
breakBarrier(true) -> BREAK_ABI
breakBarrier(false) -> BREAK_ATK
breakしないhit -> BREAK_NON
regen timerでbarrier復帰
```

trace:

```js
globalThis.__BCU_BARRIER_TRACE__
```

### 6.2 Demon Shield

新規:

```text
js/battle/bcu-runtime/BcuDemonShieldRuntime.js
```

仕様:

```text
currentShield > 0 なら本体damage前にshield処理
SHIELDBREAKならcurrentShield=0
damage>=shieldならSHIELD_BROKEN
damage<shieldならSHIELD_HIT
INT_HB終了時にSHIELD_REGEN
```

trace:

```js
globalThis.__BCU_SHIELD_TRACE__
```

### 6.3 Zombie revive

新規:

```text
js/battle/bcu-runtime/BcuZombieReviveRuntime.js
```

仕様:

```text
zombie killerでなければrevive可能判定
reviveする場合はSTOP/SLOW/WEAK/CURSE/SEAL/STRONG/LETHAL/POISONをクリア
corpse DOWN / REVIVE animation
revive攻撃タイミング
```

trace:

```js
globalThis.__BCU_ZOMBIE_TRACE__
```

### 6.4 Warp

新規:

```text
js/battle/bcu-runtime/BcuWarpRuntime.js
```

仕様:

```text
INT_WARPはKBの一種
P_WARP enter/exit effect
status[P_WARP][2]でenter/exit状態
exit animation長に達した時にkbmove(kbDis)
```

trace:

```js
globalThis.__BCU_WARP_TRACE__
```

### 6.5 Revenge / Soulstrike

新規:

```text
js/battle/bcu-runtime/BcuRevengeRuntime.js
js/battle/bcu-runtime/BcuSoulstrikeRuntime.js
```

既存 `BattleSoulstrikePatch.js` を必ず読み、二重処理にしない。

統合trace:

```js
globalThis.__BCU_LIFECYCLE_TRACE__
```

---

# Phase 7: StageBasis.update順序一致

## BCU根拠

参照:

```text
BCU_java_util_common/battle/StageBasis.java
- update()
- updateAnimation()
- updateEntities()
- act_spawn()
- act_change_up()
- act_change_down()
```

重要順序:

```text
deployDupe
le.sort(layer)
buttonDelay
tempe add
s_stop / inten
enemy spawn
respawnTime / unitRespawnTime
elu.update()
spirit cooldown
cannon / money
est.update()
sniper.update()
tempe.update()
shake
updateEntities
canon.update()
lea/effects update
lw.addAll(tlw)
attack capture
attack excuse
base postUpdate
entity postUpdate
delay反映
boss shockwave
dead remove
lw inactive remove
lea done remove
lineupChanging update
```

## 新規作成ファイル

```text
js/battle/bcu-runtime/BcuStageBasisShadow.js
js/battle/bcu-runtime/BcuStageBasisScheduler.js
js/battle/BattleSceneBcuStageBasisOrderPatch.js
```

## 実装段階

### A. Shadow traceだけ

既存tickは変えない。BCU順序なら何が起きるかtraceだけ出す。

```js
globalThis.__BCU_STAGEBASIS_TRACE__
```

### B. attack capture/excuse順序一致

攻撃capture/excuseをBCU順へ寄せる。

### C. postUpdate順序一致

damage/proc/KB/death後処理をBCU順へ寄せる。

### D. cont list統合

wave/surgeを `lw/tlw` 相当で管理。

### E. BattleScene.tick thin wrapper化

最後にのみ実施。一気に全置換しない。

## 検証

```js
globalThis.__BCU_STAGEBASIS_TRACE__
```

確認:

```text
attack capture/excuseがentity update後
postUpdateがattack excuse後
boss shockwaveがpostUpdate後
lineupChanging反転タイミング
money/cannon clamp
```

---

# Phase 8: スマホ版BCU入力完全化

## BCU根拠

参照:

```text
BCU_Android/app/src/main/java/com/mandarin/bcu/androidutil/battle/BattleView.kt
- checkSlideUpDown()
- isInSlideRange()
BCU_Android/app/src/main/java/com/mandarin/bcu/BattleSimulation.kt
- MotionEvent handling
BCU_java_util_common/battle/SBCtrl.java
- actions()
- act_change_up()
- act_change_down()
```

Android条件:

```text
battleEndでない
lineupChangingでない
isOneLineupでない
自城HPが0でない
dragFrame != 0
performedでない
abs(dy) >= height * 0.15
v = dy / dragFrame
v < 0 -> ACTION_LINEUP_CHANGE_UP
v >= 0 -> ACTION_LINEUP_CHANGE_DOWN
isInSlideRange: tan(50°) >= abs(dx) / abs(dy)
```

## 新規作成ファイル

```text
js/input/BcuMobileGestureRuntime.js
js/input/BcuBattleInputAdapter.js
js/input/BcuDomTouchPolicy.js
js/battle/BattleSceneBcuMobileInputPatch.js
```

## 1. BcuMobileGestureRuntime

```js
export class BcuMobileGestureRuntime {
  pointerDown(x, y, time) {}
  pointerMove(x, y, time) {}
  pointerUp(x, y, time) {}
  isInSlideRange() {}
  checkSlideUpDown({ height, battleState }) {}
}
```

保持:

```text
initPoint
endPoint
dragFrame
performed
isSliding
horizontal
vertical
velocity
```

## 2. BcuBattleInputAdapter

```text
ACTION_LINEUP_CHANGE_UP -> -4
ACTION_LINEUP_CHANGE_DOWN -> -5
spawn card -> frontLineup * 5 + slot
```

## 3. BcuDomTouchPolicy

Web固有。Android logicと混ぜない。

絶対条件:

```text
body/htmlにtouch-action:noneを入れない
battle canvasとproduction cardだけpreventDefault
formation/stage selector/overlayはpan-y許可
```

preventDefault対象:

```text
#preview-canvas
.canvas-panel
.prod-ui
.prod-ui .cards
.prod-card
```

scroll許可対象:

```text
.formation-ui
.formation-catalog-scroll
.stage-selector
.stage-selector-panel
.app-loading-overlay
.error-overlay
modal
```

## debug

```js
globalThis.__BCU_INPUT_TRACE__
```

entry:

```js
{
  type,
  initPoint,
  endPoint,
  dx,
  dy,
  dragFrame,
  isInSlideRange,
  action,
  preventDefaultTarget
}
```

## 検証

```text
戦闘中カード上下スライドでページが動かない
段切替がBCU条件で発火
stage selector / formation / overlayはスクロール可能
長押し選択 / ダブルタップ拡大 / iOS calloutは戦闘中だけ抑止
```

---

## 9. 手動確認コマンド

### 起動

```bash
npm install
npm run build || true
npm run dev
```

### boot

```js
globalThis.__APP__
globalThis.__BCU_FRAME_TRACE__
```

### KB

```js
const a = globalThis.__APP__?.scene?.actors?.find(a => a.state === 'knockback')
a?.lastBcuKnockbackAnimationDebug
a?.lastBcuKbeffParaToDebug
a?.lastBcuHbAnimLoadDebug
```

### 024 glow

```js
globalThis.__BCU_SPRITE_DRAW_DEBUG__
globalThis.__BCU_CANVAS_COMPOSITE_DEBUG__
globalThis.__BCU_BLEND_TRACE__
```

### status icon

```js
globalThis.__BCU_STATUS_ICON_TRACE__
```

### proc

```js
globalThis.__BCU_PROC_TRACE__
globalThis.__BCU_DAMAGE_GUARD_TRACE__
```

### wave / surge

```js
globalThis.__BCU_WAVE_TRACE__
globalThis.__BCU_SURGE_TRACE__
```

### stage basis

```js
globalThis.__BCU_STAGEBASIS_TRACE__
```

### input

```js
globalThis.__BCU_INPUT_TRACE__
```

---

## 10. 禁止する修正例

```text
BattleSceneRenderer.jsを丸ごと書き換える
BattleScene.jsを一気にBCU StageBasisへ置換する
wave/surgeを dueFrame + damage queue で完成扱いする
状態異常アイコンをCSS/emoji/文字で代用する
missing asset時に通常effectへ逃がす
body/html全体にtouch-action:noneを入れる
stage selectorやoverlayのscrollを殺す
lineup changeボタンを標準UIとして追加する
anim03がKBだと決め打ちしてkb.maanimを確認しない
glow=0までblend処理に流す
try/catchで戦闘継続だけ優先してエラーを握りつぶす
```

---

## 11. commit粒度

良い例:

```text
Add BCU trace runtime
Add BCU blend trace without renderer replacement
Resolve BCU status icons from entity statuses
Add BCU ContWaveDef runtime
Add BCU ContVolcano runtime
Apply BCU proc resist values
```

悪い例:

```text
Fix battle
Improve UI
BCU complete
Renderer rewrite
Many fixes
```

---

## 12. Codexが最初にやるタスク

### Task 1: Trace基盤

作成:

```text
js/battle/bcu-runtime/BcuTraceRuntime.js
js/battle/bcu-runtime/BcuFrameTrace.js
js/battle/bcu-runtime/BcuEntityTrace.js
js/battle/bcu-runtime/BcuAttackTrace.js
js/battle/bcu-runtime/BcuProcTrace.js
js/battle/bcu-runtime/BcuRenderTrace.js
```

接続:

```text
js/main.js
```

確認:

```js
globalThis.__BCU_FRAME_TRACE__
```

### Task 2: BCU render trace

作成:

```text
js/bcu-render/BcuBlendRuntime.js
js/bcu-render/BcuEPartTransformRuntime.js
js/bcu-render/BcuRenderTrace.js
```

renderer本体は置換しない。

確認:

```js
globalThis.__BCU_BLEND_TRACE__
globalThis.__BCU_EPART_MATRIX_TRACE__
```

### Task 3: 024攻撃glow fixture

024攻撃中に以下をtrace:

```text
partIndex
modelPartIndex
glow
opacity
ctx.globalAlpha
composite mode
```

黒塊を再発させない。

### Task 4: 状態異常アイコンskeleton

作成:

```text
js/battle/bcu-runtime/BcuStatusIconResolver.js
js/battle/bcu-runtime/BcuEntityEffectIconRuntime.js
```

まだ描画接続しなくてよい。resolve結果だけtrace。

確認:

```js
globalThis.__BCU_STATUS_ICON_TRACE__
```

---

## 13. 完了条件

```text
mainが起動する
戦闘が開始できる
既存KB / KBEff / 024 glowが壊れていない
新debug traceが存在する
追加runtimeはfeature flagで切れる
変更対象とBCU根拠が報告されている
未実装範囲を正直に書いている
```

報告テンプレ:

```text
原因:
  ...

BCU根拠:
  ...

JS対象コード:
  ...

修正:
  ...

commit:
  ...

確認方法:
  ...

残る未解決:
  ...

rollback方法:
  ...
```
