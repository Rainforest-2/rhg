# AGENTS.md — BCU / スマホ版準拠で戦闘UI・状態異常・波動/烈波・ステージ選択を完成させる指示書

Repository: `rhgrive2/game`  
Target branch: `main`  
Primary goal: **ブラウザ版の戦闘体験を、スマホ版BCU / BCU common の挙動・表示・入力・asset使用に照合しながら修正する。推測・見た目だけの近似・エラー握りつぶしは禁止。**

このファイルは Codex に渡すための作業指示です。Codex 側に過去会話やアップロードzipが無い前提で、必要なBCU参照コード・現在コードの問題・修正方針・検証条件をここに埋め込みます。

---

## 0. 最重要ルール

1. **推測で実装しない。**  
   BCU準拠と書いてあるものは、必ず BCU Android / BCU_java_util_common / BCU-java-PC の実コードと現コードを比較してから修正する。

2. **古いtxt解析メモを根拠にしない。**  
   `*.txt` の古い解析ファイル、過去レポート、会話ログは証拠として使わない。使ってよい根拠は次だけ。
   - 現在の `rhgrive2/game` の実コード
   - BCU 本体コード
   - BCU 実asset / zip / generated bundle 中身
   - 実ブラウザでの再現結果

3. **fallbackでエラーを隠さない。**  
   `try/catch` で通常ダメージ・空描画・代替assetへ逃がして「ゲームが止まらない」ようにする修正は禁止。semantic-strict で必要assetが無い場合は、明示エラーまたは明示debugにする。

4. **「100%準拠」と言う前に証拠を出す。**  
   修正PR/commit説明には必ず以下を書く。
   - 原因
   - BCU参照ファイルと該当メソッド
   - 現JSの該当ファイル
   - 変更内容
   - 手動確認手順
   - 残る未検証・未準拠

5. **UIでもBCUに存在しないものを足さない。**  
   戦闘中の段切替に `▲/▼` ボタンを足すような補完は禁止。スマホ版BCUは指スライドで切り替えている。ボタンを出すなら「BCU外拡張」として明示し、標準では無効にする。

6. **CSSだけで本家っぽく作らない。**  
   生産カード、数字、状態アイコン、波動/烈波エフェクトは BCU / にゃんこ実assetを使う。CSSグラデーションや手描き風UIで置き換えない。

7. **変更は大きくてもよいが、不整合を作らない。**  
   一箇所だけBCU風にして他の経路が旧仕様のままになるのは禁止。入力→状態→描画→debug→テストまで通す。

---

## 1. 参照すべきBCUソース

Codex は作業開始時に以下をcloneして取得すること。取得できない場合は、推測実装せず停止して報告する。

```text
battlecatsultimate/BCU_Android
battlecatsultimate/BCU_java_util_common
battlecatsultimate/BCU-java-PC
```

最低限読むファイル:

```text
# Android / スマホ版入力
BCU_Android/app/src/main/java/com/mandarin/bcu/BattleSimulation.kt
BCU_Android/app/src/main/java/com/mandarin/bcu/androidutil/battle/BattleView.kt

# 共通戦闘制御
BCU_java_util_common/battle/SBCtrl.java
BCU_java_util_common/battle/StageBasis.java
BCU_java_util_common/battle/entity/Entity.java
BCU_java_util_common/battle/entity/EUnit.java
BCU_java_util_common/battle/entity/EEnemy.java

# 波動・烈波・攻撃継続体
BCU_java_util_common/battle/attack/AttackSimple.java
BCU_java_util_common/battle/attack/ContWaveAb.java
BCU_java_util_common/battle/attack/ContWaveDef.java
BCU_java_util_common/battle/attack/ContVolcano.java
BCU_java_util_common/battle/attack/AttackWave.java
BCU_java_util_common/battle/attack/AttackVolcano.java

# asset/effect定義
BCU_java_util_common/util/pack/EffAnim.java
BCU_java_util_common/util/Data.java
BCU-java-PC/src/main/java/main/Timer.java
```

---

## 2. 現在のrepoで特に読むファイル

```text
# 起動とpatch順
js/main.js

# 戦闘シーンとtick順
js/battle/BattleScene.js
js/battle/BattleSceneBcuTimerPatch.js
js/battle/BattleSceneBcuLineupPatch.js
js/battle/BattleFrameClock.js
js/preview/BattleSimulationClock.js

# 戦闘中UI / 生産カード
js/ui/PlayerProductionBar.js
js/ui/ProductionCardSkin.js
js/ui/BcuSpriteText.js
css/style.css
css/touch-fix.css
index.html

# 編成画面 / ステージ選択候補
js/ui/FormationEditor.js
js/preview/PreviewApp.js
js/battle/FormationStore.js
js/battle/StageDefinitionLoader.js
js/battle/BcuStageSpawnRuntime.js
public/assets/generated/bcu-stage-index.json
public/assets/generated/bcu-bundle-manifest.json

# 波動・烈波
js/battle/BattleWaveRuntimePatch.js
js/battle/BattleSurgeRuntimePatch.js
js/battle/BattleSceneAttackEffectPatch.js
js/battle/BattleEffectLoader.js

# 状態異常・停止・移動
js/battle/BattleActor.js
js/battle/BattleActorProcStatusPatch.js
js/battle/BattleSceneProcApplyPatch.js
js/battle/BattleActorBarrierShieldPatch.js
js/battle/BattleActorZombieRevivePatch.js

# renderer / effect描画
js/battle/BattleSceneRenderer.js
js/bcu/BcuAnimator.js
js/bcu/AnimationRuntime.js
scripts/build-bcu-effect-bundle.mjs
scripts/build-bcu-ui-bundle.mjs
scripts/build-bcu-semantic-bundles.mjs
```

---

## 3. 確定している現状問題

### 3.1 ゲーム中の長押し選択・ダブルタップ拡大・ページスクロール抑止が不十分

ユーザー報告: 生産カードを縦スライドするとページ全体が上に動く。  
現状 `css/touch-fix.css` は追加済みだが、`index.html` で読み込むだけでは、全端末・iOS Safari・Android Chrome の長押し選択/ダブルタップ拡大を完全には潰せない可能性がある。

必須対応:

- `index.html` の viewport をゲーム中に適したものへ変更する。
  - 候補: `width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover`
  - ただしこれはWebアクセシビリティ上の副作用があるため、ゲーム画面で必要な理由をcommitに明記する。
- `html, body, .app-shell, .game-stage, .canvas-panel, #preview-canvas, .prod-ui, .prod-ui .cards, .prod-card-stack, .prod-card` に対して以下を明示する。
  - `touch-action: none`
  - `overscroll-behavior: none` または `contain`
  - `user-select: none`
  - `-webkit-user-select: none`
  - `-webkit-touch-callout: none`
  - `-webkit-tap-highlight-color: transparent`
- JS側でも保険を入れる。
  - `.canvas-panel` / `preview-canvas` / `.prod-ui .cards` で `touchstart`, `touchmove`, `gesturestart`, `contextmenu`, `selectstart`, `dragstart` を必要範囲だけ `preventDefault()` する。
  - イベントは `passive: false` で登録する。
  - ただし入力イベントを握りつぶして生産クリックやスライド判定が壊れないよう、`PlayerProductionBar` と `BattleCameraInputController` の順序を確認する。

BCU Android側の根拠:

```kotlin
// BCU_Android BattleSimulation.kt
if (action == MotionEvent.ACTION_DOWN) {
    battleView.scaleMode = true
    battleView.velocity = 0f
    x = event.x
    y = event.y
    if(event.pointerCount == 1) {
        ...
        battleView.dragFrame = 1
        battleView.initPoint?.x = event.x
        battleView.initPoint?.y = event.y
        battleView.isSliding = true
        velocity?.addMovement(event)
    } else if(event.pointerCount == 2)
        twoTouched = true
} else if (action == MotionEvent.ACTION_MOVE) {
    ...
    if(!twoTouched && !vertical && (horizontal || (!battleView.isInSlideRange() && abs(velocity?.xVelocity ?: 0f) > abs(velocity?.yVelocity ?: 0f) && abs(velocity?.xVelocity ?: 0f) > six))) {
        battleView.painter.bf.sb.pos += x2 - preX
        horizontal = true
    } else {
        battleView.checkSlideUpDown()
        if(battleView.performed)
            vertical = true
    }
}
```

BCU AndroidはView内でタッチ処理しており、ブラウザページスクロールという概念が無い。Webではページスクロールを明示的に止める必要がある。

検証条件:

- Android Chromeで、生産カード上を上下スライドしてもページ全体が動かない。
- iOS Safariで、長押しメニュー、画像保存メニュー、テキスト選択、ダブルタップズームがゲーム中に出ない。
- 生産カードのタップは壊れない。
- カメラ横スライドと段切替縦スライドが競合しない。
- `globalThis.__PRODUCTION_PAGE_DEBUG__.lastGesture` が更新される。

---

### 3.2 戦闘中の段切替は「ボタン」ではなくスマホ版BCUの縦スライド

絶対条件: `▲/▼` のような戦闘中切替ボタンは出さない。スマホ版BCU準拠ではない。

BCU Android `BattleView.checkSlideUpDown()` の根拠:

```kotlin
fun checkSlideUpDown() {
    val e = endPoint ?: return
    val i = initPoint ?: return

    if(battleEnd || painter.bf.sb.lineupChanging || painter.bf.sb.isOneLineup || painter.bf.sb.ubase.health == 0.toLong() || dragFrame == 0 || performed)
        return

    val minDistance = height * 0.15
    val dy = e.y - i.y
    val v = dy / dragFrame

    if(abs(dy) >= minDistance) {
        performed = true
        if(painter is BBCtrl) {
            if(v < 0) {
                (painter as BBCtrl).perform(BBCtrl.ACTION_LINEUP_CHANGE_UP)
            } else {
                (painter as BBCtrl).perform(BBCtrl.ACTION_LINEUP_CHANGE_DOWN)
            }
        } else {
            painter.bf.sb.lineupChanging = true
            painter.bf.sb.changeFrame = Data.LINEUP_CHANGE_TIME
            painter.bf.sb.changeDivision = painter.bf.sb.changeFrame / 2
            painter.bf.sb.goingUp = v < 0
        }
    }
}

fun isInSlideRange() : Boolean {
    val e = endPoint ?: return false
    val i = initPoint ?: return false
    val dx = e.x - i.x
    val dy = e.y - i.y
    return tan(Math.toRadians(50.0)) >= abs(dx) / abs(dy)
}
```

BCU common `SBCtrl.actions()` の根拠:

```java
if (!CommonStatic.getConfig().twoRow && (keys.pressed(-3, 0) || action.contains(-4)) && act_change_up()) {
    rec |= 1 << 24;
    keys.remove(-3, 0);
}
if (!CommonStatic.getConfig().twoRow && action.contains(-5) && act_change_down()) {
    rec |= 1 << 25;
}

// twoRow=false の生産は sb.frontLineup の5枠だけ
for (int j = 0; j < 5; j++) {
    boolean b0 = keys.pressed(sb.frontLineup, j);
    boolean b1 = action.contains(sb.frontLineup * 5 + j);
    ...
    for (int i = 0; i < 2; i++) {
        int row = (i + sb.frontLineup) % 2; // check front row first, then back row
        if (act_spawn(row, j, (b0 || b1) && row == sb.frontLineup) && (b0 || b1))
            rec |= 1 << (row * 5 + j + 13);
    }
}
```

BCU common `StageBasis.act_change_up/down()` の根拠:

```java
protected boolean act_change_up() {
    if(lineupChanging || isOneLineup || ubase.health == 0)
        return false;
    lineupChanging = true;
    goingUp = true;
    changeFrame = Data.LINEUP_CHANGE_TIME;
    changeDivision = changeFrame / 2;
    return true;
}

protected boolean act_change_down() {
    if(lineupChanging || isOneLineup || ubase.health == 0)
        return false;
    lineupChanging = true;
    goingUp = false;
    changeFrame = Data.LINEUP_CHANGE_TIME;
    changeDivision = changeFrame / 2;
    return true;
}
```

BCU common `StageBasis.update()` 末尾の入替処理:

```java
if(changeFrame != -1) {
    changeFrame--;

    if(changeFrame == 0) {
        changeFrame = -1;
        changeDivision = -1;
        lineupChanging = false;
    } else if(changeFrame == changeDivision-1) {
        frontLineup = 1 - frontLineup;
    }
}
```

現JSで見るべきファイル:

```text
js/ui/PlayerProductionBar.js
js/battle/BattleSceneBcuLineupPatch.js
js/battle/BattleSceneBcuTimerPatch.js
js/battle/BattleScene.js
css/touch-fix.css
```

修正条件:

- `PlayerProductionBar` はボタンを出さない。
- `pointerdown/move/up` は Androidの `ACTION_DOWN/MOVE/UP` に相当させる。
- 判定は `height * 0.15`、角度は `tan(50°) >= abs(dx)/abs(dy)`。
- `dy / dragFrame < 0` で up、そうでなければ down。
- `lineupChanging`, one-lineup相当, 自城HP0, battleEnd相当, dragFrame 0, performed は拒否。
- `SBCtrl` と同じく、生産は `frontLineup` の5枠だけを手動入力対象にする。
- 入替は `Data.LINEUP_CHANGE_TIME` と `changeDivision = changeFrame / 2` に合わせる。
- `frontLineup` の切替は `changeFrame == changeDivision - 1` の時点。
- `lineupChanging=false` は `changeFrame == 0`。

検証条件:

```js
const s = globalThis.__APP__?.battleScene || globalThis.__APP__?.scene;
s.frontLineup;
s.lineupChanging;
s.debugEvents?.slice(-20);
globalThis.__PRODUCTION_PAGE_DEBUG__;
```

成功時に以下の流れが確認できること。

```text
bcuLineupChangeStarted
bcuLineupFrontSwapped
bcuLineupChangeEnded
```

また、カード上の縦スライドでページスクロールが起きないこと。

---

### 3.3 ワンコの生産カード背景が灰色になっている

ユーザー要求: ワンコカードの背景を白にする。  
注意: ワンコは本家に存在しないプレイヤー生産カードなので、カード「内容」はBCU本家そのものではない。ただし枠・数字・寸法・描画手順はBCUの猫カードassetを流用すること。

参照asset:

```text
public/assets/bcu/000001/org/page/uni.png
public/assets/bcu/000001/org/data/uni.imgcut
```

現runtimeでは semantic-strict にするため、以下bundle経由で読む。

```text
public/assets/bundles/ui/battle-ui.zip
scripts/build-bcu-ui-bundle.mjs
```

修正条件:

- `ProductionCardSkin.drawDogCard()` は手描き灰色フレームを使わない。
- `drawSlotFrame()` が BCU `uni.png` + `uni.imgcut` part[0] を確実に描いているか確認する。
- もしdog iconを中に配置するための背景が灰色になっているなら、その灰色矩形を削除するか、BCUカード内の白地をそのまま使う。
- semantic-strictで `ui:battle` bundleが無い場合、灰色fallbackに逃げず、エラーまたは明示debugにする。
- コスト文字は `BcuSpriteText` の `img001.png/img001.imgcut/moneySign` によるBCU sprite textを使う。canvas font fallbackはdiagnostics用途だけ。

検証条件:

```js
globalThis.__BCU_PRODUCTION_CARD_SKIN_DEBUG__
globalThis.__BCU_SPRITE_TEXT_DEBUG__
```

- `source` が `semantic-bundle:ui:battle`。
- ワンコカードに灰色の背景矩形が無い。
- missing asset時に灰色fallbackでごまかさない。

---

### 3.4 ステージを選択できるようにする

現状 `PreviewApp.resetBattle()` は `new BattleScene(... { selectedStageId: this.selectedStageId || undefined })` を渡せる構造になっている。つまり `selectedStageId` をUIで設定する入口が不足している。

現JSで読む箇所:

```text
js/preview/PreviewApp.js
js/battle/StageDefinitionLoader.js
js/battle/BcuStageSpawnRuntime.js
public/assets/generated/bcu-stage-index.json
public/assets/bundles/stage/*.zip
public/assets/generated/bcu-bundle-manifest.json
```

実装方針:

- 編成画面または専用のステージ選択画面を作る。
- `bcu-stage-index.json` と stage bundle manifest を読み、利用可能なステージだけ表示する。
- ステージ名は言語bundle / BCU name resolver がある場合はそれを使う。無ければ `stageKey` / map id を表示する。ただし「名前が無いから適当に命名」は禁止。
- 選択値は `PreviewApp.selectedStageId` に入れ、Apply時に `BattleScene` へ渡す。
- ステージ変更時は spawn schedule, background, castle, base HP, maxEnemyCount, stageLen をすべて再ロードする。
- 途中で未対応assetが見つかった場合、fallback stageへ勝手に逃がさない。

UI条件:

- ステージ選択は「安いフォーム」ではなく、ゲームUIとして整理する。
- ただしCSSで勝手に本家風を捏造しない。背景・枠・数字などは可能な限りBCU asset bundle化して使う。
- ステージカードには最低限以下を表示。
  - stageKey / map id
  - 表示名または未解決理由
  - background id
  - enemy base HP
  - enemy row count
  - unresolved enemy count
  - bundle availability

検証条件:

- 3つ以上のステージを選択してApplyし、敵出現・背景・城HP・ステージ長が変わる。
- `globalThis.__LAST_APPLY_BATTLE_REPORT__.selectedStageId` が選択した値になる。
- stage bundle missing時に silent fallback しない。

---

### 3.5 編成画面・ボタン・全体UIをプロ品質にする。ただしBCU/asset根拠なしの飾りは禁止

現在の `css/style.css` には、以前の推測デザインが残っている可能性がある。特に以下はBCU準拠ではない可能性が高い。

```text
formation-header の BATTLE FORMATION / READY 演出
formation-character-card の青/橙グラデーション
apply-battle-button の汎用金色ボタン
```

修正方針:

- 「プロ品質」と「BCU準拠」を両立する。
- BCU本家に該当assetがあるUIはassetベースにする。
- BCU本家に存在しないUI、例えばワンコ側拡張・ステージ選択拡張は、BCUの色/寸法/数字/カード枠に寄せるが、AGENTS/commitで `BCU外拡張` と明記する。
- 安っぽいCSSグラデーション、影、謎ラベルでごまかさない。
- UI状態遷移を整理する。
  - 起動中
  - 編成中
  - ステージ選択中
  - 戦闘ロード中
  - 戦闘中
  - エラー表示
- エラー表示はユーザーが原因を理解できるよう、失敗subsystem / missing bundle / missing internal path / stage key を出す。

受け入れ条件:

- DOM構造が整理され、CSSが「巨大1ファイルに何でも書く」状態から脱していること。
- UI部品ごとにCSSを分けてもよい。
- 画面幅/高さがスマホ縦横・PCで破綻しない。
- BCU asset由来でない装飾は、どこが拡張かコメントで明示する。

---

## 4. 波動ロジックとアニメーションをBCU準拠にする

現状 `js/battle/BattleWaveRuntimePatch.js` は、簡易queue方式で範囲ダメージを1フレーム後に入れている。これはBCUの `ContWaveDef` の挙動とは一致していない。

現JSの確定問題:

```text
BattleWaveRuntimePatch.js:
- WAVE_STEP_RANGE = 200, WAVE_BASE_RANGE = 467, WAVE_HIT_WIDTH = 532 という固定近似
- dueFrame = logicFrame + 1
- animation containerが無い
- ContWaveDef の t, maxt, attack frame, nextWave chain, wave blocker, invalid/stop effect が無い
- A_WAVE / A_MINIWAVE / A_E_WAVE / A_E_MINIWAVE の実EffAnimを使っていない
```

BCU `AttackSimple.excuse()` の根拠:

```java
if (!capt.isEmpty() && proc.WAVE.exists()) {
    int dire = model.getDire();
    int wid = dire == 1 ? W_E_WID : W_U_WID;
    float addp = (dire == 1 ? W_E_INI : W_U_INI) + wid / 2f;
    float p0 = model.getPos() + dire * addp;

    if (proc.WAVE.maxlv > proc.WAVE.lv) {
        proc.WAVE.lv = proc.WAVE.lv + (int)(model.b.r.nextFloat() * ((proc.WAVE.maxlv - proc.WAVE.lv) + 1));
    }

    if (proc.WAVE.inverted) {
        p0 = model.getPos() + (dire * addp) + ((200 * (proc.WAVE.lv - 1)) * dire);
    }

    ContWaveDef wave = new ContWaveDef(new AttackWave(attacker, this, p0, wid, WT_WAVE), p0, layer, -3);
    if(attacker != null) {
        attacker.summoned.add(wave);
    }
}
```

BCU `ContWaveDef.update()` の根拠:

```java
boolean isMini = atk.waveType == WT_MINI;
int attack = (isMini ? 4 : 6);
if (t == 0)
    CommonStatic.setSE(soundEffect);
if (t <= attack) {
    atk.capture();
    for (AbEntity e : atk.capt)
        if ((e.getAbi() & AB_WAVES) > 0) {
            if (e instanceof Entity)
                ((Entity) e).anim.getEff(STPWAVE);
            if (t < 0)
                CommonStatic.setSE(soundEffect);
            deactivate();
            return;
        }
}
if (!activate)
    return;
if (t == (isMini ? W_MINI_TIME : W_TIME)) {
    if (isMini && atk.proc.MINIWAVE.lv > 0)
        nextWave();
    else if (!isMini && atk.getProc().WAVE.lv > 0)
        nextWave();
}
if (t == attack) {
    sb.getAttack(atk);
    tempAtk = true;
}
if (maxt == t)
    activate = false;
if (t >= 0)
    anim.update(false);
t++;
```

修正方針:

- `BcuWaveContainer` を作る。JSの単純queueではなく、BCU `ContWaveDef` 相当の状態機械にする。
- `t`, `delay`, `maxt`, `attackFrame`, `activate`, `waves set`, `nextWave()` を実装する。
- wave生成位置は `W_E_INI`, `W_U_INI`, `W_E_WID`, `W_U_WID`, `W_PROG`, `W_TIME`, `W_MINI_TIME` を BCU `Data` から確認して使う。値を推測しない。
- wave blocker (`AB_WAVES`) をチェックし、該当時は全関連waveを deactivate し、`Entity.anim.getEff(STPWAVE)` 相当のエフェクトを出す。
- wave invalid / wave stop effect を `EffAnim` からbundle化して描画する。
- wave damageは `sb.getAttack(atk)` と同じタイミング、つまり `t == attack` で発生させる。
- miniWaveも同じcontainerで `attack=4`、通常waveは `attack=6`。
- animationは `A_WAVE`, `A_MINIWAVE`, `A_E_WAVE`, `A_E_MINIWAVE` を使う。
- `BattleSceneRenderer` に wave/surge/effect layer を追加し、BCU `lea` と同等のeffect list順序に寄せる。

検証条件:

- wave発生時、ダメージだけでなく波動アニメーションが出る。
- wave blockerで波が停止し、停止エフェクトが出る。
- miniWaveは通常波動と攻撃frameが異なる。
- `debugEvents` に生成・攻撃frame・nextWave・deactivate理由が残る。

---

## 5. 烈波ロジックとアニメーションをBCU準拠にする

現状 `js/battle/BattleSurgeRuntimePatch.js` は簡易queue方式で、`SURGE_HALF_WIDTH = 250`、`dueFrame = logicFrame + 1`、`repeatIntervalFrames = 20` を使っている。これはBCU `ContVolcano` の状態機械と一致していない。

BCU `AttackSimple.excuse()` の烈波生成根拠:

```java
if (!capt.isEmpty() && proc.VOLC.exists()) {
    int dire = model.getDire();
    VOLC volc = proc.VOLC;
    int addp = volc.dis_0 + (int) (model.b.r.nextFloat() * (volc.dis_1 - volc.dis_0));
    float p0 = model.getPos() + dire * addp;
    float sta = p0 + (dire == 1 ? W_VOLC_PIERCE : W_VOLC_INNER);
    float end = p0 - (dire == 1 ? W_VOLC_INNER : W_VOLC_PIERCE);

    if (volc.maxtime > volc.time) {
        volc.time = volc.time + (int)(model.b.r.nextFloat() * ((volc.maxtime - volc.time) + 1));
        volc.time = (int) (Math.floor(volc.time / 20.0) * 20);
    }

    ContVolcano volcano = new ContVolcano(new AttackVolcano(attacker, this, sta, end, Data.WT_VOLC), p0, layer, volc.time, volc.dis_0, volc.dis_1, ind);
    if(attacker != null) {
        attacker.summoned.add(volcano);
    }
}
```

BCU `ContVolcano.update()` の根拠:

```java
updateProc();
if (t >= VOLC_PRE && t <= VOLC_PRE + aliveTime && anim.type != VolcEff.DURING) {
    anim.changeAnim(VolcEff.DURING, false);
    CommonStatic.setSE(SE_VOLC_LOOP);
} else if (t > VOLC_PRE + aliveTime && anim.type != VolcEff.END)
    anim.changeAnim(VolcEff.END, false);

if (t >= VOLC_PRE && t < VOLC_PRE + aliveTime && (t - VOLC_PRE) % VOLC_SE == 0) {
    CommonStatic.setSE(SE_VOLC_LOOP);
}

if (t >= aliveTime + VOLC_POST + VOLC_PRE) {
    activate = false;
} else {
    t++;
    if (t > VOLC_PRE && t < VOLC_POST + aliveTime)
        sb.getAttack(v);
    updateAnimation();
}
```

修正方針:

- `BcuVolcanoContainer` を作り、`ContVolcano` 相当の状態機械にする。
- `VOLC_PRE`, `VOLC_POST`, `VOLC_SE`, `W_VOLC_PIERCE`, `W_VOLC_INNER` は BCU `Data` から取得・固定化する。推測禁止。
- `VolcEff.START`, `VolcEff.DURING`, `VolcEff.END` の animation切替を実装。
- `t > VOLC_PRE && t < VOLC_POST + aliveTime` の間、毎tick攻撃処理する。
- `updateProc()` の curse/seal 再評価を移植する。現JSのsurgeはここを持っていない。
- `A_VOLC`, `A_E_VOLC`, `A_MINIVOLC`, `A_E_MINIVOLC` をbundle化して描画する。
- `SE_VOLC_START`, `SE_VOLC_LOOP` は音が未実装でもdebug eventに残す。音を入れる場合もBCU SE参照必須。
- death surge / mini death surge / counter surge は `Entity.java` / `EUnit.java` を見て同じcontainerで扱う。

検証条件:

- 烈波が START→DURING→END のアニメーションを持つ。
- 持続中に複数tickの攻撃判定が出る。
- `aliveTime` が `maxtime` 範囲内ランダム・20丸めに一致する。
- curse/seal中にprocがBCU通り消える/戻る。

---

## 6. 状態異常アイコンとアニメーションをBCUと同じにする

現状 `BattleActorProcStatusPatch.js` は `bcuProcStatuses` を持つが、BCU `Entity.Animation.getEff()` 相当の状態異常アイコン描画が未完成。ユーザー要望は「状態異常中にその状態異常のアイコンとそのアニメーションをBCUと全く同じでキャラに表示」。

BCU `Entity.Animation.getEff(int t)` の根拠:

```java
} else if (t == P_STOP) {
    int id = dire == -1 ? A_STOP : A_E_STOP;
    effs[id] = (dire == -1 ? effas().A_STOP : effas().A_E_STOP).getEAnim(DefEff.DEF);
} else if (t == P_SLOW) {
    int id = dire == -1 ? A_SLOW : A_E_SLOW;
    effs[id] = (dire == -1 ? effas().A_SLOW : effas().A_E_SLOW).getEAnim(DefEff.DEF);
} else if (t == P_WEAK) {
    if (status[P_WEAK][1] <= 100) {
        int id = dire == -1 ? A_DOWN : A_E_DOWN;
        effs[id] = (dire == -1 ? effas().A_DOWN : effas().A_E_DOWN).getEAnim(DefEff.DEF);
    } else {
        int id = dire == -1 ? A_WEAK_UP : A_E_WEAK_UP;
        effs[id] = (dire == -1 ? effas().A_WEAK_UP : effas().A_E_WEAK_UP).getEAnim(WeakUpEff.UP);
    }
} else if (t == P_CURSE) {
    int id = dire == -1 ? A_CURSE : A_E_CURSE;
    effs[id] = (dire == -1 ? effas().A_CURSE : effas().A_E_CURSE).getEAnim(DefEff.DEF);
} else if (t == P_SEAL) {
    effs[dire == -1 ? A_SEAL : A_E_SEAL] = (dire == -1 ? effas().A_SEAL : effas().A_E_SEAL).getEAnim(DefEff.DEF);
}
```

BCU `Entity.Animation.draw()` の配置根拠:

```java
int EWID = 36;
float x = p.x;
...
eae.draw(g, new P(x, p.y+offset), siz * 0.75f);
x -= EWID * e.dire * siz;
```

また一部アイコンは別オフセット:

```java
if(i == A_B || i == A_E_B || i == A_DEMON_SHIELD || ... ) {
    float offset = -25f * siz;
    eae.draw(g, new P(x, p.y + offset), siz * 0.75f);
}
```

修正方針:

- `BcuActorStatusEffectRuntime` を作る。
- `BattleActor` に `bcuEffectIcons` / `bcuEffectIconRuntimes` を持たせる。
- `applyBcuProc()` で freeze/slow/weaken/curse/seal/poison/barrier/shield/armor/speed/lethargy/dmgcut/dmgcap などを受けたら、BCU `anim.getEff(t)` と同じ effect を生成する。
- `EffAnim` の `A_STOP/A_E_STOP/A_SLOW/A_E_SLOW/A_DOWN/A_E_DOWN/A_WEAK_UP/A_E_WEAK_UP/A_CURSE/A_E_CURSE/A_SEAL/A_E_SEAL/...` を semantic bundle化する。
- `draw` 時はキャラの描画位置 `p` に対して `siz * 0.75`、横間隔 `36 * dire * siz` を使用する。
- `Entity.Animation.update()` と同じく、アイコンeffectは毎tick `update(false)` する。freeze中でも `effs[i].update(false)` は回る点に注意。
- STOP中は SLOW icon を描かない、WEAK中は UP icon を描かない、SEAL中は CURSE icon を描かない、というBCU条件も再現する。

BCU条件:

```java
if (((i == A_SLOW || i == A_E_SLOW) && status[P_STOP][0] != 0) ||
    ((i == A_UP || i == A_E_UP) && status[P_WEAK][0] != 0) ||
    ((i == A_CURSE || i == A_E_CURSE) && status[P_SEAL][0] != 0))
    continue;
```

検証条件:

- freeze中にSTOPアイコンがアニメーションする。
- slow中にSLOWアイコンがアニメーションする。
- freeze + slow 併発時にBCUと同じくSLOW表示が抑制される。
- icon位置がキャラ頭上に横並びし、BCUの `EWID=36`, `scale=0.75` に合う。
- barrier/shield等の特別offset系は `-25f * siz` を再現する。

---

## 7. 動きを止める処理: freeze中に移動が止まらないバグを修正する

ユーザー報告: 「動きを止める処理が、敵のアニメーションは止まるけど移動が止まらない」。これは現コード上も説明できる。

現JSの問題:

- `BattleActorProcStatusPatch.js` は freeze中に `BattleActor.tick()` を return している。
- しかし `BattleScene.tick()` の `actor-state-update` 内では、`a.tick(scaledDt)` の後に `a.x += a.direction * a.moveSpeed * (scaledDt/1000)` を直接実行している箇所が複数ある。
- つまり actor animation は止まっても、BattleScene側の直接移動が止まらない。

現JSの該当構造:

```js
// BattleScene.tick actor-state-update 内
for (const a of this.actors) {
  ...
  a.tick(scaledDt);
  ...
  if(!sel){
    ...
    if(a.state==='move') a.x += a.direction*a.moveSpeed*(scaledDt/1000);
    continue;
  }
  ...
  if(!this.canAttack(a,target)){
    a.setState('move');
    a.setAnimation(a.moveAnimId,'move');
    a.x += a.direction*a.moveSpeed*(scaledDt/1000);
    continue;
  }
}
```

BCU `Entity.update()` の根拠:

```java
updateProc();
barrier.update();

if (kbTime > 0)
    kb.updateKB();
else if (status[P_STOP][0] == 0) {
    if (kbTime < -1)
        updateBurrow();
    else if (kbTime == 0 && walking && !checkTouch())
        updateMove(0);
}
```

BCU `Entity.update2()` の根拠:

```java
boolean nstop = status[P_STOP][0] == 0;
...
if (checkTouch()) {
    walking = false;
    anim.setAnim(UType.IDLE, true);
    if(nstop) {
        ... startAttack();
    }
} else {
    walking = true;
    anim.setAnim(UType.WALK, true);
}

if (atkm.atkTime > 0 && nstop)
    atkm.updateAttack();

anim.update();
bondTree.update();
```

BCUの意味:

- STOP中は `updateMove()` を呼ばない。
- STOP中でも `update2()` の collision / walking readiness / animation state selection は一部行う。
- STOP中は攻撃進行 `atkm.updateAttack()` も止める。
- icon/effect animation は `Entity.Animation.update()` 内で `effs[i].update(false)` が回る。

修正方針:

- BattleSceneで直接 `a.x += ...` しない。必ず `actor.updateMoveBcu()` のような関数に寄せる。
- 移動前に `actor.isBcuProcStatusActive('freeze', this.timeMs)` を確認し、activeなら移動距離0。
- slow中は `Entity.updateMove()` と同じく `pos += 0.25f * dire` 相当にする。現 `getBcuMoveDistanceForDt()` はあるが、BattleSceneが使っていないため接続する。
- STOP中でも `walking` / state selection がBCUと同じか確認する。単純に全処理returnすると、BCUと違う。
- attack中にfreezeされた場合、BCUの `atkm.updateAttack()` が進まないことに合わせ、attack timelineのelapsed/hit resolveも止める。

検証条件:

- freeze付与中、対象の `x` が変わらない。
- freeze付与中、攻撃hit timelineが進まない。
- freeze解除フレームにBCUと同じく移動/攻撃が再開する。
- slow付与中、移動距離が通常速度でなく `0.25 * dire per tick` になる。
- debugに `lastBcuStopMoveDebug` / `lastBcuSlowMoveDebug` を残す。

---

## 8. 状態異常時間・proc適用の精査

現 `BattleActorProcStatusPatch.js` は msベースで `untilMs` を持っている。しかしBCUは frame count `status[P_*][0]--` で管理している。

BCU `Entity.updateProc()` の根拠:

```java
if (status[P_STOP][0] > 0)
    status[P_STOP][0]--;
if (status[P_SLOW][0] > 0)
    status[P_SLOW][0]--;
if (status[P_CURSE][0] > 0)
    status[P_CURSE][0]--;
if (status[P_SEAL][0] > 0)
    status[P_SEAL][0]--;
```

修正方針:

- ms-based `untilMs` だけに依存しない。BCU互換の `statusFrames` を持つ。
- 各battle tickで frame decrement する。
- `BCU_BATTLE_TIMER_PERIOD_MS = 33` を使うが、状態異常は「ms経過」より「tickごとの--」を正とする。
- debug表示はms換算してよいが、ロジック判定はframeを正とする。
- Treasure / decoration magnification / resist / immunity は BCU `Entity.processProcs` を参照して不足分を列挙し、未実装なら明示debugにする。

---

## 9. AGENTSが指示する実装順序

以下順でやること。順番を飛ばさない。

### Phase A — 入力とページスクロールを修正

1. `index.html` viewportをゲーム向けに変更。
2. `css/touch-fix.css` または `css/style.css` でゲーム領域のtouch/callout/select/zoomを明示的に禁止。
3. JSで `touchmove/contextmenu/selectstart/dragstart/gesturestart` をゲーム領域に限定してpreventDefault。
4. 戦闘中段切替が縦スライドで発火するか確認。
5. ページスクロールしないことを確認。

### Phase B — freeze/slowをBCU tickに接続

1. `BattleScene.tick()` の直接移動を排除またはラップ。
2. STOP中の移動0を実装。
3. SLOW中の `0.25 * dire` per tickを実装。
4. attack timeline進行もSTOP中に止める。
5. `Entity.update/update2` の順序に近づける。

### Phase C — 生産カード見た目

1. `ui:battle` bundle中身を確認。
2. `ProductionCardSkin` でdog card背景の灰色を削除。
3. BCU `uni.png` frameとsprite textだけで描く。
4. missing asset時はエラー/debugで止める。

### Phase D — ステージ選択

1. stage index / bundle manifestを読み、利用可能stage一覧を作る。
2. UIを作る。
3. `PreviewApp.selectedStageId` に接続。
4. Applyでstage runtimeが完全に変わることを確認。

### Phase E — 波動/烈波containerとanimation

1. BCU `Data` 定数を抽出。
2. effect bundleに wave/surge関連EffAnimを追加。
3. `BcuWaveContainer`, `BcuVolcanoContainer` 実装。
4. 現簡易queueを置換。
5. rendererにeffect layerを追加。

### Phase F — 状態異常アイコン

1. effect bundleに状態異常 icon EffAnimを追加。
2. `Entity.Animation.getEff` 相当を実装。
3. rendererでキャラ頭上にBCU配置で描画。
4. STOP/SLOW/WEAK/CURSE/SEALの抑制条件を実装。

### Phase G — UI全体のプロ品質化

1. 推測CSSを整理。
2. BCU asset-driven UIへ置換。
3. stage selection / formation / loading / battle overlay の状態遷移を整理。
4. エラーUIを整備。

---

## 10. 絶対に入れてはいけない修正

```text
- 戦闘中の明示PAGEボタン / ▲▼ボタンを標準表示すること
- 波動/烈波を単なる透明な範囲ダメージqueueで済ませること
- 状態異常アイコンをCSSやemojiで代用すること
- freeze中に actor.tick だけ止めて BattleScene 側の移動を放置すること
- BCU assetが無いのに灰色fallbackや仮画像でごまかすこと
- エラーをcatchして通常攻撃/通常描画に戻すこと
- 古いtxt解析ファイルを根拠にすること
- 「多分BCUっぽい」という言葉でcommitすること
```

---

## 11. 必須debug globals

修正後も以下を確認できるようにする。

```js
globalThis.__PRODUCTION_PAGE_DEBUG__
globalThis.__PRODUCTION_ICON_DEBUG__
globalThis.__BCU_PRODUCTION_CARD_SKIN_DEBUG__
globalThis.__BCU_SPRITE_TEXT_DEBUG__
globalThis.__LAST_APPLY_BATTLE_REPORT__
globalThis.__BATTLE_HIT_EFFECT_LOADER_DEBUG__
globalThis.__BCU_STATUS_ICON_DEBUG__
globalThis.__BCU_WAVE_DEBUG__
globalThis.__BCU_SURGE_DEBUG__
```

追加するdebugは「成功しました」ではなく、BCUのどの処理に対応するかを含めること。

例:

```js
{
  source: 'BcuWaveContainer.update',
  bcuReference: 'ContWaveDef.update t==attack -> sb.getAttack(atk)',
  t,
  attackFrame,
  waveType,
  capturedCount,
  blockedByWaveStopper,
  effectAnim: 'A_WAVE'
}
```

---

## 12. 検証シナリオ

### Scenario 1: スマホ入力

1. Android Chromeで起動。
2. 戦闘開始。
3. 生産カード上で縦スライド。
4. ページがスクロールしない。
5. `frontLineup` がBCUタイミングで切り替わる。
6. `lineupChanging` 中は生産できない。
7. スライド後のタップで表示中5枠からだけ生産される。

### Scenario 2: freeze

1. freezeを持つ敵/味方を編成またはテストステージで出す。
2. freeze発動。
3. 対象のアニメーションが止まる。
4. 対象のx座標も止まる。
5. 攻撃timelineも止まる。
6. STOP iconがBCU assetで出る。
7. freeze解除後に再開。

### Scenario 3: slow

1. slow発動。
2. 通常速度ではなく `0.25 * dire per tick` 相当で移動。
3. SLOW iconが出る。
4. freeze+slow併発時はBCU条件通りSLOW icon表示が抑制される。

### Scenario 4: wave

1. wave持ちキャラを出す。
2. hit後にBCU `ContWaveDef` と同じdelay/t/attackFrameでwaveが進む。
3. A_WAVE/A_E_WAVE animationが表示される。
4. wave blockerに当たると停止エフェクト。

### Scenario 5: surge

1. surge持ちキャラを出す。
2. START/DURING/END animationが出る。
3. 持続中にBCUと同じtick範囲で複数回攻撃する。
4. curse/seal中のproc消去/復帰が一致する。

### Scenario 6: stage selection

1. ステージ一覧を開く。
2. 3ステージ以上選ぶ。
3. Applyごとに背景・敵出現・baseHP・stageLenが変わる。
4. 未解決assetがあるstageでは明示エラー。

---

## 13. 完了報告テンプレート

Codex は修正完了時に以下の形で報告する。

```text
原因:
  ...

BCU根拠:
  - BCU_Android/.../BattleView.kt checkSlideUpDown
  - BCU_java_util_common/battle/StageBasis.java act_change_up/down, update changeFrame
  - ...

現JSの問題:
  - js/battle/BattleScene.js で freeze中も a.x += ... していた
  - ...

修正:
  - ...

確認:
  - Android Chrome: page scrollなし
  - __PRODUCTION_PAGE_DEBUG__.lastAction.ok === true
  - freeze中 x 不変
  - wave animation visible

未完了/未検証:
  - 無い場合のみ「なし」
```

「100%準拠」は、上記の検証が全て通り、未検証が無い場合だけ書くこと。

---

## 14. 追加で必要な修正候補

以下は今回ユーザー要望から見えている、追加でBCU参照しながら潰すべきもの。

1. **effect bundleの網羅性**  
   現在 `effect:kbeff` と `ui:battle` はあるが、状態異常・波動・烈波・barrier/shield等のEffAnimを全部semantic bundle化できているとは限らない。`EffAnim.java` の定義から必要assetを列挙し、bundle builderを拡張する。

2. **BattleScene tick順のBCU化**  
   現 `BattleScene.tick()` は多くのphaseを空で置いている。BCU `Entity.update()` / `update2()` / `updateAnimation()` に合わせて、movement/proc/reaction/attack/effect tick順を再整理する。

3. **状態異常のframe管理**  
   `untilMs` 方式をBCU `status[P_*][0]--` 方式へ寄せる。

4. **UI asset driven化**  
   `FormationEditor` の安っぽいCSS装飾をBCU assetベースに置換する。BCUに無いUI拡張は拡張と明記する。

5. **stage metadata UI**  
   stage選択に名前解決・敵一覧・背景プレビュー・baseHPを表示する。ただし未解決名を勝手に作らない。

6. **debug HUD整理**  
   debug globalsが散らばっているため、常時表示debug panelを1つに統合する。ユーザーが以前要求した「デバッグモードを一つに統一、常に表示」に沿う。

---

## 15. まとめ

このAGENTS.mdの要点:

```text
- 戦闘中段切替はスマホBCU準拠の縦スライド。ボタン禁止。
- ブラウザ固有の長押し/ダブルタップ/ページスクロールは明示的に潰す。
- freezeはアニメーションだけでなく移動と攻撃進行も止める。
- wave/surgeはダメージqueueではなくBCU container + EffAnimで実装する。
- 状態異常はBCU Entity.Animation.getEff と同じアイコン/配置/更新にする。
- ワンコカードは本家に無いが、枠・数字・背景はBCU猫カードasset流用で白にする。
- ステージ選択UIを作り、selectedStageIdをBattleSceneへ渡す。
- 推測・fallback・古いtxt参照は禁止。
```
