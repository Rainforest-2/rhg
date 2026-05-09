0. この repo の目的

rhgrive2/game は browser app として動作する戦闘プレビュー / ゲーム実装である。
現在の目的は、戦闘・ステージ・描画・編成・キャラ・敵・アニメーション・カメラ・UI ロジックを、BCU common / BCU PC の実装思想に段階的に寄せることである。
参考
BCU: https://github.com/battlecatsultimate/BCU_java_util_common
https://github.com/battlecatsultimate/BCU-java-PC
最終的な設計目標は以下。

1. Stage CSV を純 parser で読み、意味付き StageDefinition に変換する。
2. StageDefinition から StageRuntime を作る。
3. StageRuntime を BattleScene / base / background / spawn / camera / renderer へ流す。
4. 敵出現を CSV row 駆動・frame 駆動にする。
5. BattleScene.js から parser / resolver / damage / proc / KB / effect / animation / production の責務を外へ出す。
6. world 座標、screen 座標、BCU model local 座標を混在させない。
7. fallback を無言で行わず、debug / status / inspector に必ず残す。
8. BCU に寄せるが、既存 UI / asset / browser 実行を壊さず段階的に置換する。

⸻

1. 最重要ルール

1.1 Codex が必ず守ること

作業開始前に、必ずこの順で確認する。

1. AGENTS.md の対象タスクを読む。
2. 現コード rhgrive2/game の対象ファイル本文を読む。
3. 既存実装の呼び出し元と呼び出し先を検索する。
4. 変更範囲を最小化する。
5. 実装する。
6. 既存の軽量検証 script がある場合だけ実行する。
7. 変更内容、未完了、手動確認項目を docs/bcu-migration-status.md に残す。

1.2 禁止事項

以下は絶対禁止。

* 対象ファイル本文を読まずに変更すること。
* ファイル名だけで役割を推測すること。
* BCU 仕様をこの文書と違う形で勝手に推測すること。
* public/assets/bcu/ 配下の大量 asset を削除・移動・rename すること。
* npm dependency を追加すること。
* package.json 前提の構成に変えること。
* BattleScene.js を巨大な一括置換で壊すこと。
* BattleScene.js に新しい巨大責務を追加すること。
* renderer 内で spawn / combat / damage / proc / KB 判定を行うこと。
* camera / zoom / pinch / wheel 処理で stageLen, base.x, actor.x, spawnX を変更すること。
* enemyBaseHpPercent を 100 固定に戻すこと。
* spawnWorldXSource を消すこと。
* fallback を無言で行うこと。
* debug event / inspector / status document を削ること。
* 見た目だけ動く仮実装で既存 feature を消すこと。
* 未実装 ability / proc を黙って無視すること。
* PR を勝手に作ること。
* issue を勝手に作ること。

⸻

2. 現コードで必ず確認する主要ファイル

Codex はタスクごとに対象ファイルを読むこと。
全タスク共通の主要ファイルは以下。

2.1 Stage / runtime / spawn / scene

js/battle/StageDefinitionLoader.js
js/battle/StageRuntime.js
js/battle/StageRuntimeSceneAdapter.js
js/battle/BattleSceneStageRuntimeWiring.js
js/battle/BcuStageSpawnRuntime.js
js/battle/BcuStageEnemyResolver.js
js/battle/BattleSpawnResolver.js
js/battle/StageSpawnPreviewBuilder.js
js/battle/BattleScene.js
js/battle/BattleConfig.js
js/battle/DebugBattleInspector.js

2.2 Base / castle / background / camera / renderer

js/battle/BattleBase.js
js/battle/CastleAssetResolver.js
js/battle/BcuCastleAssetLoader.js
js/battle/StageBackgroundResolver.js
js/battle/StageBackgroundLoader.js
js/battle/BattleCamera.js
js/preview/BattleCameraInputController.js
js/battle/BattleSceneRenderer.js
js/battle/BattleBodyResolver.js

2.3 Actor / stats / attack / damage / proc / KB / effect

js/battle/BattleStatsLoader.js
js/battle/BcuStatsSchema.js
js/battle/BattleActorFactory.js
js/battle/BattleActor.js
js/battle/BattleAttackProfile.js
js/battle/BattleAttackResolver.js
js/battle/BattleAttackTimeline.js
js/battle/DamageCalculator.js
js/battle/BattleEffect.js
js/battle/BattleEffectLoader.js
js/battle/BcuKbeffLoader.js

2.4 Economy / production / formation / UI

js/battle/BattleEconomy.js
js/ui/PlayerProductionBar.js
js/ui/FormationEditor.js
js/battle/FormationStore.js
js/battle/CharacterCatalog.js
js/battle/PlayableCharacterRegistry.js

2.5 BCU animation runtime

js/bcu/BcuAssetLoader.js
js/bcu/BcuSpriteSheet.js
js/bcu/BcuModelInstance.js
js/bcu/BcuAnimator.js
js/data/previewAssets.js

⸻

3. BCU common 実コードから固定する仕様

この章は、Codex が BCU ZIP を直接読めない前提で、BCU common 実コードから読み取った仕様を埋め込んだものである。
ここに書かれている内容は、現コードの設計判断に使ってよい。

⸻

3.1 Stage.java の stage model

BCU common の common.util.stage.Stage は stage CSV から Stage object を作る。

確認元:

util/stage/Stage.java
util/stage/SCDef.java
util/stage/EStage.java

Stage の主要 field:

public boolean non_con, trail, bossGuard;
public boolean drop = true;
public int len, health, max, mush, bgh;
public int timeLimit = 0;
public int minSpawn = 1, maxSpawn = 1;
public Identifier<CastleImg> castle;
public Identifier<Background> bg, bg1;
public Identifier<Music> mus0, mus1;
public SCDef data;
public Limit lim;
public BattlePreset preset;

現コードに対応させる field:

BCU Stage field	現コードの意味付き field
len	stageLen
health	enemyBaseHp
minSpawn	minSpawnFrame または header min spawn
maxSpawn	maxSpawnFrame または header max spawn
bg	bgId
max	maxEnemyCount
timeLimit	timeLimit
bossGuard	bossGuard
castle	castleId / animBaseId
data	enemyRows

⸻

3.2 Stage.java の CSV header 読み取り

BCU Stage.java では、stage CSV の先頭付近を以下のように読む。

castle row

通常 stage type == 0 では、最初の row から castle / no continue を読む。

int cas = CommonStatic.parseIntN(strs[0]);
if (cas == -1)
    cas = CH_CASTLES[id.id];
if (sm.cast != -1)
    cas = sm.cast * 1000 + cas;
castle = Identifier.parseInt(cas, CastleImg.class);
non_con = strs[1].equals("1");

現コード側の設計:

{
  castleId,
  animBaseId,
  cannonId,
  noContinue,
  castleRawRow,
  warnings
}

必要条件:

* castleId は CSV row から保持する。
* -1 fallback が必要な場合、fallback reason を残す。
* sm.cast * 1000 + cas に相当する grouping は、現コードの asset layout と照合して CastleAssetResolver 側で扱う。
* noContinue は StageDefinition に保持する。
* castleId を BattleConfig で無条件上書きしない。

stage header row

BCU Stage.java は次の row を以下のように読む。

len = Integer.parseInt(strs[0]);
health = Integer.parseInt(strs[1]);
minSpawn = Integer.parseInt(strs[2]);
maxSpawn = Integer.parseInt(strs[3]);
bg = Identifier.rawParseInt(Integer.parseInt(strs[4]), Background.class);
max = Math.min(50, Integer.parseInt(strs[5]));
timeLimit = strs.length >= 8 ? Math.max(Integer.parseInt(strs[7]), 0) : 0;
if(timeLimit != 0)
    health = Integer.MAX_VALUE;
if (hasCastleData) {
    bossGuard = Integer.parseInt(strs[8]) == 1;
}
trail = timeLimit != 0;
drop = !trail;
int isBase = Integer.parseInt(strs[6]) - 2;

現コード側の StageDefinition header shape:

{
  sourcePath,
  sourceType: 'bcu-stage-csv',
  coordinateMode: 'bcu-stage-world',
  castleId,
  animBaseId,
  cannonId,
  noContinue,
  stageLen,
  enemyBaseHp,
  minSpawnFrame,
  maxSpawnFrame,
  bgId,
  maxEnemyCount,
  maxEnemyCountRaw,
  timeLimit,
  bossGuard,
  trail,
  drop,
  baseEnemyId,
  warnings: [],
  rawRows: []
}

重要:

* parser は maxEnemyCountRaw と maxEnemyCount を分ける。
* BCU runtime では max = Math.min(50, csvMax) なので、runtime cap は 50。
* parser 時点で raw 値を捨てない。
* timeLimit != 0 の場合、BCU は health = Integer.MAX_VALUE にしている。
* 現コードでも time limit stage の扱いは warnings 付きで明示する。勝手に通常 stage と同じにしない。

⸻

3.3 SCDef.java の enemy row model

BCU common の SCDef は enemy row を SCDef.Line に正規化する。

確認元:

util/stage/SCDef.java

SCDef.Line field:

public Identifier<AbEnemy> enemy;
public int number, boss, multiple, group;
public int spawn_0, spawn_1, respawn_0, respawn_1;
public int castle_0, castle_1, layer_0, layer_1;
public int mult_atk;
public int kill_count;
public int score;

SCDef index constants:

public static final int SIZE = 16,
  E = 0,
  N = 1,
  S0 = 2,
  R0 = 3,
  R1 = 4,
  C0 = 5,
  L0 = 6,
  L1 = 7,
  B = 8,
  M = 9,
  S1 = 10,
  C1 = 11,
  G = 12,
  M1 = 13,
  KC = 14,
  SC = 15;

現コードの StageDefinition.enemyRows[] は次の shape にする。

{
  rowIndex,
  sourceOrder,
  rawEnemyId,
  sourceEnemyId,
  enemyId,
  count,
  isInfinite,
  firstFrame,
  firstFrameMin,
  firstFrameMax,
  respawnMinFrame,
  respawnMaxFrame,
  baseHpTrigger,
  baseHpTriggerPercent,
  baseHpTriggerUpper,
  baseHpTriggerLower,
  bossFlag,
  magnification,
  hpMagnification,
  attackMagnification,
  layerMin,
  layerMax,
  group,
  killCountTrigger,
  score,
  raw,
  warnings
}

対応表:

BCU SCDef field	index	現コード field
enemy	E	enemyId, sourceEnemyId, rawEnemyId
number	N	count, isInfinite
spawn_0	S0	firstFrame / firstFrameMin
spawn_1	S1	firstFrameMax または secondary spawn
respawn_0	R0	respawnMinFrame
respawn_1	R1	respawnMaxFrame
castle_0	C0	baseHpTrigger, baseHpTriggerPercent
castle_1	C1	baseHpTriggerUpper / second threshold
layer_0	L0	layerMin
layer_1	L1	layerMax
boss	B	bossFlag
multiple	M	magnification, hpMagnification
mult_atk	M1	attackMagnification
group	G	group
kill_count	KC	killCountTrigger
score	SC	score

⸻

3.4 Stage.java の enemy row 補正

BCU Stage.java の enemy row 読み取りでは、以下の補正がある。

data[0] -= 2;
data[2] *= 2;
data[3] *= 2;
data[4] *= 2;
if (!trail && intl > 9 && data[5] > 100 && data[9] == 100) {
    data[9] = data[5];
    data[5] = 100;
}
if (ss.length > 10) {
    data[SCDef.SC] = CommonStatic.parseIntN(ss[10]);
}
if (ss.length > 11 && CommonStatic.isInteger(ss[11])) {
    data[SCDef.M1] = Integer.parseInt(ss[11]);
    if(data[SCDef.M1] == 0)
        data[SCDef.M1] = data[SCDef.M];
} else {
    data[SCDef.M1] = data[SCDef.M];
}
if(ss.length > 12 && CommonStatic.isInteger(ss[12]) && Integer.parseInt(ss[12]) == 1) {
    data[SCDef.S0] *= -1;
}
if(ss.length > 13 && CommonStatic.isInteger(ss[13])) {
    data[SCDef.KC] = Integer.parseInt(ss[13]);
}
if (data[0] == isBase)
    data[SCDef.C0] = 0;

現コード implementation rule:

1. rawEnemyId は CSV raw のまま残す。
2. enemyId は BCU 補正後 ID を入れる。
3. sourceEnemyId は asset / stats resolver が実際に探す候補として残す。
4. firstFrame, respawnMinFrame, respawnMaxFrame は BCU 補正後 frame を入れる。
5. 二重補正を防ぐため、parser 内に frameScaleApplied または warning を残す。
6. count === 0 は isInfinite: true。
7. baseHpTrigger > 100 && magnification == 100 の補正は BCU と同じ意味で実装する。
8. attackMagnification は M1 がない場合 magnification と同じ。
9. M1 == 0 の場合も magnification と同じ。
10. ss[12] == 1 の negative first spawn は意味を壊さず保持する。
11. base enemy row の C0 = 0 は baseHpTrigger = 0 として扱う。
12. BCU は SCDef.Line 配列を読み込み順の逆順で格納する。現コードでは sourceOrder と rowIndex を分けて、runtime 対応が壊れないようにする。

⸻

3.5 EStage.java の enemy spawn runtime

BCU common の EStage は stage enemy spawn controller である。

確認元:

util/stage/EStage.java

主要 field:

public final Stage s;
public final Limit lim;
public final int[] num, rem, first;
public final float mul;
public final int star;
public final int[] killCounter;
private StageBasis b;

EStage constructor:

Line[] datas = s.data.getSimple();
rem = new int[datas.length];
num = new int[datas.length];
first = new int[datas.length];
for (int i = 0; i < rem.length; i++)
    num[i] = datas[i].number;
lim = st.getLim(star);
mul = st.getCont().stars[star] * 0.01f;
killCounter = new int[s.data.datas.length];
for(int i = 0; i < killCounter.length; i++) {
    if(s.data.datas[i].castle_0 != 0) {
        killCounter[i] = s.data.datas[i].kill_count;
    }
}

現コード対応:

class BcuStageSpawnRuntime {
  rows: [
    {
      rowIndex,
      def,
      row,
      unitDef,
      spawnedCount,
      remainingCount,
      nextFrame,
      nextAtFrame,
      waitingForMaxEnemySlot,
      waitingForSpawnCommit,
      pendingSpawnEvent,
      triggered,
      exhausted,
      done,
      disabled,
      disabledReason,
      lastSpawnFrame,
      lastAttemptFrame,
      lastBlockedReason,
      lastSpawnResolveDebug,
      warnings
    }
  ]
}

BCU の num[] に対応するもの:

count / spawnedCount / remainingCount / isInfinite

BCU の rem[] に対応するもの:

nextFrame / nextAtFrame / respawn timer

BCU の killCounter[] に対応するもの:

killCountTrigger

まだ kill count trigger が未実装なら、未実装として docs に書き、勝手に実装済みにしない。

⸻

3.6 EStage.assign()

BCU EStage.assign(StageBasis sb) は spawn 初期値を設定する。

b = sb;
Line[] datas = s.data.getSimple();
for (int i = 0; i < rem.length; i++) {
    rem[i] = datas[i].spawn_0;
    if (Math.abs(datas[i].spawn_0) < Math.abs(datas[i].spawn_1))
        rem[i] += (int) ((datas[i].spawn_1 - datas[i].spawn_0) * b.r.nextFloat());
    if (s.id.pack.equals(Identifier.DEF) && datas[i].castle_0 < 100 && rem[i] > 0 && !s.trail)
        rem[i] = 0;
}

現コード対応:

* firstFrame は spawn_0 に対応。
* firstFrameMax がある場合は random between spawn_0 and spawn_1。
* baseHpTrigger < 100 で BCU が初回 rem を 0 にする挙動は、未実装なら warnings へ書く。
* random は context から渡せるようにする。
* Math.random() を直接呼ぶ場合でも、テスト可能にするため context.random を優先する。

⸻

3.7 EStage.allow()

BCU EStage.allow() は enemy spawn 可否を判定し、spawn 可能なら EEnemy を返す。

重要条件:

if(s.trail && s.timeLimit != 0 && s.timeLimit * 60 * 30 - b.time < 0)
    return null;
for (int i = 0; i < rem.length; i++) {
    Line data = s.data.getSimple(i);
    if (
        inHealth(data, i, true)
        && s.data.allow(b, data.group, Identifier.getOr(data.enemy, AbEnemy.class))
        && rem[i] <= 1
        && rem[i] >= 0
        && num[i] != -1
        && killCounter[i] == 0
    ) {
        ...
        return ee;
    }
}
return null;

現コード BcuStageSpawnRuntime.tick(frame, context) の条件:

if (timeLimitExpired) return [];
if (!inHpWindow(row, context.enemyBaseHpPercent)) block;
if (!groupAllowed(row, context)) block; // group 未実装なら docs に書く
if (frame < nextFrame) block;
if (remainingCount === 0 && !isInfinite) done;
if (killCountTrigger > 0 && killCounter not 0) block; // 未実装なら docs
if (aliveEnemyCount >= maxEnemyCount) waitingForMaxEnemySlot
if (!unitDef || unitDef.unavailable) disabled
else spawn event

BCU の s.data.allow(...) は StageBasis.entityCount(1) >= st.max - enemyWill も見る。
現コードでは will がまだ明確に実装されていない場合、当面は aliveEnemyCount >= maxEnemyCount で保留し、will 未実装を docs に書く。

⸻

3.8 EStage.allow() の respawn / count

BCU EStage.allow() は spawn 直後に respawn timer と count を更新する。

if(data.respawn_0 >= data.respawn_1)
    rem[i] = data.respawn_0;
else
    rem[i] = data.respawn_0 + (int) (b.r.nextFloat() * (data.respawn_1 - data.respawn_0));
rem[i]++;
if (num[i] > 0) {
    num[i]--;
    if (num[i] == 0)
        num[i] = -1;
}

現コード対応:

commitSpawn(event) {
  spawnedCount += 1;
  if (!isInfinite && spawnedCount >= count) {
    exhausted = true;
    done = true;
    return;
  }
  interval = respawnMinFrame >= respawnMaxFrame
    ? respawnMinFrame
    : respawnMinFrame + random() * (respawnMaxFrame - respawnMinFrame);
  nextFrame = spawnFrame + interval + 1; // BCU の rem++ 相当を考慮
}

注意:

* 現コードが既に +1 を含めているか確認してから変更する。
* 既存テストがある場合は二重加算しない。
* 変更する場合は docs/bcu-migration-status.md に書く。

⸻

3.9 EStage.inHealth()

BCU EStage.inHealth() は base HP trigger を判定する。

int c0 = !s.trail ? Math.min(line.castle_0, 100) : line.castle_0;
int c1 = line.castle_1;
float d = !s.trail ? b.getEBHP() : (b.ebase.maxH - b.ebase.health);
boolean inRange =
  c0 >= c1
    ? (s.trail ? d >= c0 : d <= c0)
    : (d > c0 && d <= c1);

現コード対応:

function inBaseHpWindow(row, enemyBaseHpPercent, trail = false, baseDamage = null) {
  const c0 = trail ? row.baseHpTrigger : Math.min(row.baseHpTrigger, 100);
  const c1 = row.baseHpTriggerUpper ?? row.baseHpTriggerSecondary ?? 0;
  const d = trail ? baseDamage : enemyBaseHpPercent;
  if (c0 >= c1) {
    return trail ? d >= c0 : d <= c0;
  }
  return d > c0 && d <= c1;
}

重要:

* enemyBaseHpPercent を 100 固定に戻してはいけない。
* StageRuntimeSceneAdapter.getEnemyBaseHpPercent(scene) または equivalent helper を使う。
* base が未生成の時だけ fallback 100 を使い、その場合 warning を出す。

⸻

3.10 EStage.base()

BCU EStage.base(StageBasis sb) は enemy base を stage enemy row から作る場合がある。

int ind = num.length - 1;
Line data = s.data.getSimple(ind);
if (data.castle_0 == 0) {
    num[ind] = -1;
    float multi = data.multiple * mul * 0.01f;
    float mulatk = data.mult_atk * mul * 0.01f;
    ...
    return e.getEntity(sb, this, multi, mulatk, data.layer_0, data.layer_1, data.boss >= 1 ? -2 : -1, 0);
}

現コードでは、enemy base は BattleBase として持つ。
ただし、BCU では base enemy row が存在しうるため、現コードも以下を区別する。

- visual enemy castle / BattleBase
- battle base HP object
- stage enemy row による base enemy 相当

現時点で完全に一致させない。
まずは enemyBaseHp, castleId, animBaseId, base combat body, frontX を確実に runtime/debug に残す。

⸻

3.11 StageBasis.java の battle update order

BCU common battle/StageBasis.java には update order の comment がある。

/**
 * process actions and add enemies from stage first then update each entity
 * and receive attacks then excuse attacks and do post update then delete dead
 * entities
 */
protected void update() {
  ...
}

実際の大枠:

1. battle active 判定
2. background effect 初期化 / update
3. player deploy request / duplicate deploy
4. enemy spawn check: est.allow()
5. respawn timer update: est.update()
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

現コード目標 order:

1. fixed frame clock advance
2. collect queued player production requests
3. enemy spawn check
4. economy / production cooldown update
5. actor state update
6. movement
7. target search
8. attack start
9. attack timeline advance
10. hit target capture
11. damage resolve
12. proc resolve
13. KB / death update
14. base post update
15. effect spawn
16. effect tick
17. cleanup
18. camera update
19. render outside simulation

⸻

3.12 StageBasis.getEBHP()

BCU StageBasis.getEBHP():

public float getEBHP() {
    return Math.min(100f, 100f * ebase.health / ebase.maxH);
}

現コード対応:

function getEnemyBaseHpPercent(scene) {
  const base = scene.bases.find(b => b.side === 'cat-enemy');
  if (!base || !Number.isFinite(base.hp) || !Number.isFinite(base.maxHp) || base.maxHp <= 0) {
    return 100; // fallback only
  }
  return Math.max(0, Math.min(100, base.hp / base.maxHp * 100));
}

fallback 100 は base 未生成時のみ。
spawn runtime に常時 100 を渡してはいけない。

⸻

3.13 Unit deploy spawn position

BCU StageBasis.act_spawn() では player unit の追加位置に以下がある。

eu.added(-1, st.len - 700);

BCU enemy spawn は EStage.allow() から entity を生成し、enemy entity 側の added / entity 初期化に渡る。
現コード設計:

side	spawn position
enemy	BCU standard 700、boss は bossSpawnWorldX がある場合それを優先
player	stageLen - 700
fallback	base front から gap fallback。ただし warning/debug に残す

⸻

4. BCU PC から固定する仕様

BCU PC は battle logic の一次ソースではなく、common を viewer / editor / renderer に統合する参照実装である。
logic 判断は BCU common を優先する。

4.1 参照する BCU PC ファイル

src/main/java/page/battle/BattleBox.java
src/main/java/jogl/GLBattleBox.java
src/main/java/page/awt/BattleBoxDef.java
src/main/java/page/info/StageViewPage.java
src/main/java/page/info/edit/StageEditPage.java
src/main/java/page/info/edit/StageEditTable.java
src/main/java/page/anim/AnimBox.java
src/main/java/page/anim/DIYViewPage.java
src/main/java/page/anim/ImgCutEditPage.java
src/main/java/page/anim/ImgCutEditTable.java
src/main/java/page/anim/AdvAnimEditPage.java
src/main/java/page/anim/AbEditPage.java
src/main/java/page/anim/AnimGroupTree.java

4.2 PC 側から現コードへ持ち込む考え方

* stage / unit / enemy / anim の data model は common 側から参照する。
* viewer / renderer は runtime state を読む。
* renderer は battle logic を進めない。
* editor は model を編集するが、battle runtime の責務を持たない。
* animation viewer は imgcut / mamodel / maanim の見た目確認に使うが、combat timing は battle logic 側が持つ。

⸻

5. 現コードの現在状態

Codex は必ず現コードで再確認すること。
以下は直近の作業から見た前提である。

5.1 既に存在する可能性が高いファイル

js/battle/StageRuntime.js
js/battle/StageRuntimeSceneAdapter.js
js/battle/BattleSceneStageRuntimeWiring.js
js/battle/CastleAssetResolver.js
js/battle/StageBackgroundResolver.js
js/battle/BattleSpawnResolver.js
js/battle/BcuStageSpawnRuntime.js
js/battle/BcuCastleAssetLoader.js
js/battle/StageBackgroundLoader.js
js/battle/BattleFrameClock.js
js/battle/DamageCalculator.js
scripts/check-stage-runtime.mjs
scripts/check-bcu-stage-spawn-runtime.mjs
scripts/check-battle-scene-stage-runtime-wiring.mjs

5.2 重要な注意

現在、BattleSceneStageRuntimeWiring.js は prototype patch 方式で BattleScene を補強している可能性が高い。

これは事故を避けるための暫定方式である。
将来的には BattleScene.js 本体に正式統合してよいが、以下を守ること。

* いきなり全面置換しない。
* BattleScene.init / buildStageRuntime / tickStageEnemySpawn / spawnStageEnemy を小さい差分で整理する。
* wiring を消す場合は、同等 debug event / helper / fallback を本体へ移す。
* wiring を残す場合は、docs/bcu-migration-status.md に暫定であることを書く。

⸻

6. 正規データモデル

6.1 StageDefinition

StageDefinitionLoader.js は最終的にこの shape を返す。

{
  ok: true,
  sourcePath,
  sourceType: 'bcu-stage-csv',
  coordinateMode: 'bcu-stage-world',
  warnings: [],
  rawRows: [],
  mapId,
  stageId,
  castleId,
  animBaseId,
  cannonId,
  noContinue,
  bgId,
  stageLen,
  enemyBaseHp,
  minSpawnFrame,
  maxSpawnFrame,
  maxEnemyCount,
  maxEnemyCountRaw,
  timeLimit,
  trail,
  drop,
  bossGuard,
  musicId,
  baseEnemyId,
  enemyRows: [
    {
      rowIndex,
      sourceOrder,
      rawEnemyId,
      sourceEnemyId,
      enemyId,
      count,
      isInfinite,
      firstFrame,
      firstFrameMin,
      firstFrameMax,
      respawnMinFrame,
      respawnMaxFrame,
      baseHpTrigger,
      baseHpTriggerPercent,
      baseHpTriggerUpper,
      bossFlag,
      magnification,
      hpMagnification,
      attackMagnification,
      layerMin,
      layerMax,
      group,
      killCountTrigger,
      score,
      raw,
      warnings: []
    }
  ],
  runtime: {
    castleRawRow,
    headerRawRow,
    sourceEnemyRows,
    bgId,
    castleId,
    animBaseId,
    enemyRows
  }
}

StageDefinition 禁止

StageDefinitionLoader.js は以下をしてはいけない。

- Image を読む
- canvas を触る
- actor を作る
- BattleBase を作る
- camera を作る
- spawn runtime を作る
- renderer を import する
- asset loader を import する

⸻

6.2 StageRuntime

StageRuntime.js は StageDefinition から runtime world model を作る。

{
  stageDefinition,
  sourcePath,
  sourceType,
  coordinateMode,
  stageLen,
  groundY,
  scrollMinX,
  scrollMaxX,
  castleId,
  animBaseId,
  cannonId,
  bgId,
  enemyBaseHp,
  maxEnemyCountRaw,
  maxEnemyCount,
  effectiveMaxEnemyCount,
  minSpawnFrame,
  maxSpawnFrame,
  timeLimit,
  noContinue,
  bossGuard,
  mapId,
  stageId,
  enemyRows,
  sourceEnemyRows,
  playerBase: {
    side: 'dog-player',
    worldX,
    x,
    frontX,
    hp,
    maxHp,
    assetRef,
    body
  },
  enemyBase: {
    side: 'cat-enemy',
    worldX,
    x,
    frontX,
    hp,
    maxHp,
    castleId,
    animBaseId,
    cannonId,
    assetRef,
    body
  },
  enemyBaseWorldX,
  enemyBaseFrontX,
  playerBaseWorldX,
  playerBaseFrontX,
  enemySpawnWorldX,
  playerSpawnWorldX,
  bossSpawnWorldX,
  spawn: {
    playerSpawnWorldX,
    enemySpawnWorldX,
    bossSpawnWorldX
  },
  background: {
    bgId,
    assetRef,
    usedFallback,
    reason
  },
  warnings
}

StageRuntime 座標規約

値	規約
enemyBaseWorldX	原則 800
enemySpawnWorldX	原則 700
playerBaseWorldX	stageLen - 800
playerSpawnWorldX	stageLen - 700
bossSpawnWorldX	stage row / stage runtime にある場合だけ
stageLen	world width。zoom で変更禁止

⸻

6.3 Spawn event

BcuStageSpawnRuntime.tick() が返す event。

{
  type: 'spawnEnemy',
  rowIndex,
  spawnId,
  spawnFrame,
  unitDef,
  enemyId,
  sourceEnemyId,
  rawEnemyId,
  worldX,
  spawnWorldX,
  spawnWorldXSource,
  spawnResolveDebug,
  bossFlag,
  magnification,
  hpMagnification,
  attackMagnification,
  layerMin,
  layerMax,
  frontLayer,
  backLayer,
  baseHpTrigger,
  baseHpTriggerPercent,
  firstFrame,
  respawnMinFrame,
  respawnMaxFrame,
  row
}

spawn event の絶対ルール

* BcuStageSpawnRuntime が作った spawnWorldX を BattleScene 側で無条件再計算しない。
* spawnWorldXSource を debug event まで保持する。
* spawnResolveDebug を消さない。
* template missing の場合は commitSpawn しない。
* spawn 成功した場合だけ commitSpawn する。
* spawn 失敗した場合は rejectSpawn し、次 frame 以降に retry できる状態にする。

⸻

6.4 Castle resolver

CastleAssetResolver.js の契約。

{
  requestedCastleId,
  resolvedCastleId,
  requestedAnimBaseId,
  resolvedAnimBaseId,
  requestedCannonId,
  requestedGroupIndex,
  resolvedGroupIndex,
  groupIndex,
  groupName,
  localCastleId,
  imagePath,
  imageCandidates,
  imgcutCandidates,
  usesImgcut,
  assetKind,
  usedFallback,
  fallbackReason,
  fallbackTrace,
  candidateReport
}

group rule

BCU / current asset layout の敵城 group は以下。

['rc', 'ec', 'wc', 'sc']

castleId の group は Math.floor(castleId / 1000)。
local id は castleId % 1000。
out-of-range group は rc fallback にするが、必ず fallbackReason に残す。

例:

0    -> rc/rc000.png
1005 -> ec/ec005.png
2007 -> wc/wc007.png
3007 -> sc/sc007.png
9001 -> group out-of-range。rc/rc001.png fallback。reason 必須。
invalid -> castleId 0 fallback。reason 必須。

⸻

6.5 Background resolver

StageBackgroundResolver.js の契約。

{
  requestedBgId,
  resolvedBgId,
  imagePath,
  imgcutPath,
  csvPath,
  imageCandidates,
  imgcutCandidates,
  stageId,
  cropName,
  assetKind: 'bcu-stage-background',
  backgroundCsvKind: 'bcu-bg-csv',
  usedFallback,
  fallbackReason,
  candidateReport
}

bgId 解決優先順位

1. explicit runtime.bgId
2. stage.runtime.bgId
3. stage.definition.runtime.bgId
4. stage.definition.bgId
5. stage.bgId
6. fallback 0

path rule

imagePath = ./public/assets/bcu/000001/org/img/bg/bg{bgId 3桁}.png
imgcutPath = ./public/assets/bcu/000001/org/battle/bg/bg{bgId 2桁}.imgcut
csvPath = ./public/assets/bcu/000001/org/battle/bg/bg.csv

⸻

6.6 Camera transform

BattleCamera は world/screen transform の唯一の責務を持つ。

目標 API:

worldToScreenX(worldX)
worldToScreenY(worldY)
screenToWorldX(screenX)
screenToWorldY(screenY)
setZoom(zoom, anchorScreenX)
setViewport(width, height)
clampToStage(stageLen)

camera 禁止

- stageLen を変更しない
- actor.x を変更しない
- base.x を変更しない
- spawnX を変更しない
- renderer に別 camera 変換を増やさない

⸻

7. 実装タスク設計図

ここからが Codex の実行順である。
順番を飛ばしてはいけない。
各タスクは完了条件を満たすまで次へ進まない。

⸻

Task 0: 現在状態を docs 化する

目的

現在の main に何が入っていて、何が未完かを明確にする。

変更ファイル

docs/bcu-migration-status.md

存在しない場合は作る。

必ず読む現コード

AGENTS.md
js/battle/StageDefinitionLoader.js
js/battle/StageRuntime.js
js/battle/StageRuntimeSceneAdapter.js
js/battle/BattleSceneStageRuntimeWiring.js
js/battle/BcuStageSpawnRuntime.js
js/battle/BattleSpawnResolver.js
js/battle/BattleScene.js
js/battle/CastleAssetResolver.js
js/battle/StageBackgroundResolver.js

書く内容

# BCU migration status
## Current implementation
- StageDefinitionLoader:
- StageRuntime:
- BattleSceneStageRuntimeWiring:
- BcuStageSpawnRuntime:
- BattleSpawnResolver:
- CastleAssetResolver:
- StageBackgroundResolver:
- BattleFrameClock:
- DamageCalculator:
## Completed
...
## Partial
...
## Unresolved
...
## Manual browser check
...

完了条件

* 既存ファイルの有無を実際に確認して書いている。
* 推測で「完了」と書いていない。
* prototype wiring が暫定なら暫定と書いている。
* 未確認点は未確認として理由を書く。

⸻

Task 1: BattleScene runtime wiring の正式化判断

目的

BattleSceneStageRuntimeWiring.js の prototype patch 方式を残すか、BattleScene.js 本体に安全に移すか判断する。

変更候補

js/battle/BattleScene.js
js/battle/BattleSceneStageRuntimeWiring.js
js/battle/StageRuntimeSceneAdapter.js
docs/bcu-migration-status.md

必ず読む現コード

js/battle/BattleScene.js
js/battle/BattleSceneStageRuntimeWiring.js
js/battle/StageRuntimeSceneAdapter.js
js/battle/StageRuntime.js
js/battle/StageBackgroundLoader.js
js/battle/BcuCastleAssetLoader.js
js/battle/BcuStageSpawnRuntime.js

確認する関数

BattleScene.constructor
BattleScene.init
BattleScene.buildStageRuntime
BattleScene.loadBase
BattleScene.tickStageEnemySpawn
BattleScene.spawnStageEnemy
BattleScene.getSpawnWorldX
BattleScene.getEffectiveEnemyMaxCount

判断基準

prototype wiring を残してよい条件:

- BattleScene.js 本体を触ると巨大置換になる
- wiring が idempotent
- main.js で PreviewApp 起動前に import されている
- debug event が十分に出る
- docs に暫定であることが書かれている

BattleScene.js 本体へ移す条件:

- buildStageRuntime / tickStageEnemySpawn / spawnStageEnemy の小さい差分だけで済む
- import 追加が安全
- prototype patch を消しても同等挙動を維持できる

禁止

- BattleScene.js の全面置換
- init 全体の巨大書き換え
- load order を理解せず変更すること

完了条件

- stage definition -> stage runtime -> background -> base -> spawn runtime の流れが docs に書かれている
- enemyBaseHpPercent が 100 固定ではない
- castleId が loadBase / castle loader へ流れる
- bgId が background loader へ流れる
- stageLen が camera zoom で変更されない

⸻

Task 2: spawn runtime 締め

目的

BcuStageSpawnRuntime の spawn event が BattleScene.spawnStageEnemy() まで破壊されず、BCU 寄せの spawn source / retry / commit / reject が成立するようにする。

変更候補

js/battle/BcuStageSpawnRuntime.js
js/battle/BattleSpawnResolver.js
js/battle/BattleSceneStageRuntimeWiring.js
js/battle/BattleScene.js
docs/bcu-migration-status.md

必ず読む現コード

js/battle/BcuStageSpawnRuntime.js
js/battle/BattleSpawnResolver.js
js/battle/BattleSceneStageRuntimeWiring.js
js/battle/BattleScene.js
js/battle/StageRuntimeSceneAdapter.js
js/battle/DebugBattleInspector.js
scripts/check-bcu-stage-spawn-runtime.mjs
scripts/check-battle-scene-stage-runtime-wiring.mjs

必ず守る spawn priority

1. event.worldX
2. event.spawnWorldX
3. bossFlag && bossSpawnWorldX
4. BCU standard enemy spawn 700
5. base front fallback
6. legacy fallback

実装内容

2.1 BattleSpawnResolver

resolveSpawnWorldXWithDebug() は以下を返す。

{
  ok,
  worldX,
  source,
  side,
  baseId,
  baseX,
  baseFrontX,
  stageLen,
  bossFlag,
  bossSpawnX,
  explicitWorldX,
  explicitSpawnWorldX,
  fallbackReason
}

source 値:

event-worldX
event-spawnWorldX
bcu-boss-spawn
bcu-enemy-spawn-700
bcu-player-spawn-stageLen-700
bcu-player-spawn-base-pos+100
stage-runtime-enemy-base-front-fallback
legacy-fixed-700-fallback
bcu-spawn-unresolved

2.2 BcuStageSpawnRuntime

通常 enemySpawnWorldX === 700 の場合は explicit override 扱いしない。
この場合、source は bcu-enemy-spawn-700 でなければならない。

enemySpawnWorldX !== 700 の場合だけ explicit override として扱う。

2.3 BattleScene spawn

spawnStageEnemy(unitDef, rowOrEvent) は、rowOrEvent.spawnWorldX または rowOrEvent.worldX がある場合、それを尊重する。

やってはいけない例:

const sx = this.getSpawnWorldX('cat-enemy', row); // event.spawnWorldX があるのに無条件再計算

安全な形:

const sx = Number.isFinite(row?.spawnWorldX)
  ? row.spawnWorldX
  : Number.isFinite(row?.worldX)
    ? row.worldX
    : this.getSpawnWorldX('cat-enemy', row);

2.4 commit / reject

spawn 成功:

const actor = this.spawnActor(...);
if (actor) {
  this.stageSpawnRuntime.commitSpawn(event);
}

spawn 失敗:

if (!actor) {
  this.stageSpawnRuntime.rejectSpawn(event, reason, { currentFrame: this.logicFrame });
}

template missing:

- commitSpawn しない
- rejectSpawn する
- retry 可能にする
- debug event に reason を残す

debug event に必ず残す

rowIndex
spawnId
spawnFrame
spawnWorldX
spawnWorldXSource
baseFrontX
stageLen
bossFlag
fallbackReason
enemyBaseHpPercent
maxEnemyCount
aliveEnemyCount
templateMissing

Node 検証

新規 script は増やさない。
必要なら以下に assertion を少し追加する。

scripts/check-bcu-stage-spawn-runtime.mjs
scripts/check-battle-scene-stage-runtime-wiring.mjs

完了条件

- 通常敵 spawn source が bcu-enemy-spawn-700
- bossFlag + bossSpawnWorldX で bcu-boss-spawn
- event.spawnWorldX が BattleScene 側で潰れない
- maxEnemyCount block は done にならない
- template missing は commit されない
- reject 後に retry 可能
- debug event に spawnWorldXSource が残る

⸻

Task 3: castle / background resolver final audit

目的

castleId, animBaseId, cannonId, bgId が CSV / StageDefinition / StageRuntime / loader / debug まで正しく流れることを確認する。

変更候補

js/battle/CastleAssetResolver.js
js/battle/BcuCastleAssetLoader.js
js/battle/StageBackgroundResolver.js
js/battle/StageBackgroundLoader.js
js/battle/BattleBase.js
js/battle/DebugBattleInspector.js
docs/bcu-migration-status.md

確認すること

Castle

- StageDefinition.castleId があるか
- StageRuntime.castleId があるか
- StageRuntime.animBaseId があるか
- BattleScene.loadBase が castleId / animBaseId / cannonId を loader に渡すか
- BcuCastleAssetLoader.load() が CastleAssetResolver を使うか
- fallback reason が debug に残るか

Background

- StageDefinition.bgId があるか
- StageRuntime.bgId があるか
- StageBackgroundResolver.fromStage() が stage.definition.bgId も見るか
- StageBackgroundLoader.load() が resolver を使うか
- fallback reason が source/debug に残るか

禁止

- asset path rename
- fallback を null で握りつぶす
- BattleBase 内で asset 探索責務を増やす

完了条件

- castle requested/resolved/fallback が debug で見える
- background requested/resolved/fallback が debug で見える
- stage runtime と loader の値が一致する

⸻

Task 4: camera transform 統一

目的

world 座標と screen 座標を分離し、camera 変換を BattleCamera に集約する。

変更候補

js/battle/BattleCamera.js
js/preview/BattleCameraInputController.js
js/battle/BattleSceneRenderer.js
js/battle/DebugBattleInspector.js
docs/bcu-migration-status.md

必ず確認する現コード

BattleCamera.worldToScreenX
BattleCamera.screenToWorldX
BattleCamera.setZoom
BattleCamera.clamp
BattleCameraInputController wheel / pinch / drag handlers
BattleSceneRenderer projectX / drawBackground / drawBases / drawActors / drawEffects

実装方針

* stageLen は world width。
* zoom は camera scale。
* scroll は camera offset。
* actor/base/effect は world 座標。
* UI は screen 座標。
* background parallax は background 専用。

禁止

- zoom で stageLen を変更
- zoom で base.x を変更
- zoom で actor.x を変更
- zoom で spawnX を変更
- renderer に別 transform を増やす

完了条件

manual check:

- debugBattle=1 で stageLen が zoom 前後で不変
- base.x が zoom 前後で不変
- actor.x が zoom 前後で不変
- spawnWorldX が zoom 前後で不変
- screen 表示だけが zoom / scroll で変わる

⸻

Task 5: BattleFrameClock / tick order

目的

BCU の StageBasis.update() に寄せて、1 frame の処理順を整理する。

変更候補

js/battle/BattleFrameClock.js
js/battle/BattleScene.js
js/preview/BattleSimulationClock.js
js/battle/BattleActor.js
js/battle/BattleAttackResolver.js
docs/bcu-migration-status.md

目標 order

1. advance clock
2. collect queued player production requests
3. enemy spawn check
4. economy / production cooldown update
5. actor state update
6. movement
7. target search
8. attack start
9. attack timeline advance
10. hit target capture
11. damage resolve
12. proc resolve
13. KB / death update
14. base post update
15. effect spawn
16. effect tick
17. cleanup
18. camera update
19. render outside simulation

禁止

- render で simulation state を進める
- damage resolve と visual animation を同一タイミングに固定する
- spawn check を actor update 後に移す

完了条件

- phase trace / debug に tick phase が残る
- spawn check が actor update より前
- cleanup が damage / KB 後
- render は simulation step の外

⸻

Task 6: ActorStatsModel / magnification

目的

BCU の stage row 倍率と stats CSV を分離し、base stats / scaled stats / source を保持する。

変更候補

js/battle/BattleStatsLoader.js
js/battle/BcuStatsSchema.js
js/battle/BattleActorFactory.js
js/battle/BattleActor.js
js/battle/DebugBattleInspector.js
新規候補: js/battle/ActorStatsModel.js
docs/bcu-migration-status.md

BCU stat index 参考

BCU csv キャラステータスの読み取りindexについて.txt から読み取った重要 index。
実装時は必ず現コード BcuStatsSchema.js と照合する。

0  HP
1  KB
2  speed
3  damage
4  attack interval / attack wait
5  range
6  cost
7  respawn
12 attack type single/area
13 attack occurrence
23 strong
24 knockback proc
25 freeze chance
26 freeze time
27 slow chance
28 slow time
29 resistant
30 massive damage
31 critical
35 wave chance
36 wave level
37 weaken chance
38 weaken time
39 weaken percent
40 strengthen threshold
41 strengthen multiplier
42 survive
43 metal
46 wave immune
47 wave stopper
48 KB immune
49 freeze immune
50 slow immune
51 weaken immune
52 zombie killer
59 second hit damage
60 third hit damage
61 second hit frame
62 third hit frame
70 barrier breaker
71 warp chance
72 warp time
75 warp immune
78 relic target
79 curse immune
80 insane resistant
81 insane damage
82 savage blow chance
83 savage blow multiplier
86 surge chance
87 surge min position
88 surge max position
89 surge level
90 toxic immune
91 surge immune
92 curse chance
93 curse time
94 mini-wave
95 shield pierce
96 aku target

model 契約

{
  source,
  rawStats,
  baseStats,
  stageMagnification: {
    rowIndex,
    magnification,
    hpMagnification,
    attackMagnification
  },
  levelMagnification,
  finalStats,
  abilityModel,
  warnings
}

禁止

- rawStats を破壊して scaled stats だけ残す
- hpMagnification と attackMagnification を混ぜる
- rowIndex を落とす

完了条件

- actor debug で baseHp / scaledHp / baseDamage / scaledDamage が見える
- rowIndex と倍率 source が見える
- stage row 倍率が enemy actor に反映される

⸻

Task 7: AttackTimeline

目的

攻撃アニメーションと hit / damage timing を分離する。

変更候補

js/battle/BattleAttackTimeline.js
js/battle/BattleAttackProfile.js
js/battle/BattleAttackResolver.js
js/battle/BattleActor.js
js/battle/BattleScene.js
docs/bcu-migration-status.md

timeline 契約

{
  attackId,
  startFrame,
  totalFrame,
  hits: [
    {
      hitIndex,
      hitFrame,
      damageScale,
      procMask,
      targetCaptureMode
    }
  ],
  cooldownFrame,
  source
}

実装方針

* attack animation は見た目。
* hitFrame は damage timing。
* multi-hit は hits[] で扱う。
* target capture と damage resolve は phase を分ける。
* LD / omni は range model として扱う。

禁止

- animation frame 到達だけで damage を即 resolve
- multi-hit を single damage に潰す
- target capture と damage apply を同じ function に閉じ込める

完了条件

- single hit / multi hit の data shape が同じ
- hitFrame が debug で追える
- attack animation ID と hit timing が別 field

⸻

Task 8: DamageCalculator / AbilityModel / ProcResolver

目的

damage と ability / proc を BattleScene から分離する。

変更候補

js/battle/DamageCalculator.js
新規候補: js/battle/AbilityModel.js
新規候補: js/battle/ProcResolver.js
js/battle/BcuStatsSchema.js
js/battle/BattleAttackResolver.js
js/battle/BattleActor.js
docs/bcu-migration-status.md

ability 分類

必ず以下を分類する。

single / area
multi-hit
long distance
omnistrike
critical
savage blow
wave
mini-wave
surge
mini-surge
freeze
slow
weaken
knockback proc
warp
curse
toxic
barrier breaker
shield pierce
zombie killer
revive
metal
trait target
resistant
massive damage
insane damage
tough
insanely tough
ability immunity
base destroyer
soulstrike
conjure / summon

実装状態分類

docs/bcu-migration-status.md に以下を作る。

## Ability status
### Implemented
- ...
### Partial
- ...
### Stub / parsed but not applied
- ...
### Not implemented
- ...

禁止

- 未実装 ability を silently ignore
- proc chance を 100% 扱いにする
- trait target 判定なしに massive/resistant を適用する

⸻

Task 9: KBRuntime / EffectRuntime

目的

KB / death / effect を BattleScene から分離する。

変更候補

js/battle/BattleActor.js
js/battle/BattleScene.js
js/battle/BattleEffect.js
js/battle/BattleEffectLoader.js
js/battle/BcuKbeffLoader.js
新規候補: js/battle/KBRuntime.js
新規候補: js/battle/EffectRuntime.js
docs/bcu-migration-status.md

扱うもの

HP KB
final KB
proc KB
boss shockwave
KB distance
KB duration
KB frame
KB animation
kbeff
targetable during KB
touchable during KB
death animation
death cleanup
hit effect
wave effect
surge effect
critical effect
effect coordinate
effect asset loading
effect render

禁止

- dead actor を即削除して death animation を消す
- KB 中の targetable/touchable を未定義のままにする
- effect 座標を screen 座標で保持する

完了条件

- actor debug で KB state が見える
- death animation と cleanup が分離
- effect runtime が world 座標を保持

⸻

Task 10: AnimationRuntime 改善

目的

BCU imgcut / mamodel / maanim の再現性を上げる。

変更候補

js/bcu/BcuAssetLoader.js
js/bcu/BcuSpriteSheet.js
js/bcu/BcuModelInstance.js
js/bcu/BcuAnimator.js
js/battle/BattleActorFactory.js
js/battle/BattleSceneRenderer.js
docs/bcu-migration-status.md

守る要素

imgcut parse
mamodel parse
maanim parse
part hierarchy
parent matrix
local transform
world transform
pivot
scale
rotation
opacity
z-order
interpolation
easing
frame advance
animation switching
renderFlipX
direction
facing
visual offset
combat offset
attack animation と hit timing の分離

禁止

- visual model bounds を combat body に無条件同期
- parent transform を無視
- opacity / z-order を落とす

⸻

Task 11: ProductionRuntime / Economy / Formation

目的

生産・金・cooldown・編成を runtime と UI に分離する。

変更候補

js/battle/BattleEconomy.js
js/ui/PlayerProductionBar.js
js/battle/FormationStore.js
js/ui/FormationEditor.js
js/battle/CharacterCatalog.js
js/battle/PlayableCharacterRegistry.js
新規候補: js/battle/ProductionRuntime.js
docs/bcu-migration-status.md

実装方針

- cost は stats/catalog source を明記
- respawn は frame/ms 換算 source を明記
- cooldown は runtime が進める
- UI は表示と入力だけ
- production request は battle tick 側で処理

禁止

- UI が cooldown を勝手に進める
- cost / respawn の source を消す
- 5枠固定前提を深く埋め込む

⸻

Task 12: 大量キャラ対応

目的

hardcoded 少数 roster から、BCU asset/stat catalog 駆動へ寄せる。

変更候補

js/battle/CharacterCatalog.js
js/battle/PlayableCharacterRegistry.js
js/battle/BattleStatsLoader.js
js/battle/BcuStatsSchema.js
js/ui/FormationEditor.js
docs/bcu-migration-status.md

方針

- characterId
- sourceRoster
- sourceSlotId
- assetId
- stats source
- animation source
- production cost source
- cooldown source

を分ける。

禁止

- キャラごとの手書き special case を増やす
- asset missing を無言 fallback

⸻

8. docs ルール

docs/bcu-migration-status.md を必ず使う。
大きいタスクごとに更新する。

最低限の template:

# BCU migration status
## Last updated
- date:
- commit:
- task:
## Completed
| Area | Files | What changed | Evidence |
|---|---|---|---|
## Partial
| Area | Files | Done | Remaining | Risk |
|---|---|---|---|---|
## Unresolved
| Item | Current code read | BCU-derived rule in AGENTS | Why unresolved | Impact | Next action |
|---|---|---|---|---|---|
## Manual browser check
- [ ] `?debugBattle=1`
- [ ] stageLen does not change with zoom
- [ ] actor.x does not change with zoom
- [ ] base.x does not change with zoom
- [ ] spawnWorldXSource appears in debug
- [ ] castle fallback appears if asset missing
- [ ] bg fallback appears if asset missing
## Node checks
- command:
- result:

⸻

9. Node 検証ルール

Node script は増やしすぎない。

原則

- 1タスクにつき新規 Node script は最大1本
- 既存 script に 2〜3 assertion 追加で済むなら新規作成しない
- renderer / camera / visual の目視領域を Node で過剰検証しない
- asset 実画像の完全表示確認を Node だけで済ませた扱いにしない

優先して使う既存 script

scripts/check-stage-runtime.mjs
scripts/check-bcu-stage-spawn-runtime.mjs
scripts/check-battle-scene-stage-runtime-wiring.mjs

禁止

- 小さい resolver ごとに大量 script を増やす
- Node script のためだけに production code を歪める

⸻

10. debug に必ず残す値

以下は DebugBattleInspector, debugEvents, docs のどれかで確認可能にする。

stage source path
stageLen
bgId requested/resolved/fallback
castleId requested/resolved/fallback
animBaseId requested/resolved/fallback
cannonId requested/resolved/fallback
enemyBaseHp
enemyBaseHpPercent
maxEnemyCount
enemyRows count
rowIndex
spawnId
spawnFrame
spawnWorldX
spawnWorldXSource
bossFlag
baseHpTrigger
magnification
hpMagnification
attackMagnification
layerMin
layerMax
template missing
asset missing
fallbackReason

⸻

11. commit / PR ルール

- ユーザーが明示しない限り PR を作らない
- main へ直接 push する場合でも commit は小さく分ける
- 1 commit = 1意図
- 巨大置換 commit を避ける
- 変更後は変更ファイル・完了・未完了・次タスクを報告する

⸻

12. すぐ次にやること

Codex がこの AGENTS.md を読んだら、最初にこれを実行する。

Next Task: Task 0 + Task 2

Step 1

docs/bcu-migration-status.md を作る、または更新する。

Step 2

以下を読む。

js/battle/BattleScene.js
js/battle/BattleSceneStageRuntimeWiring.js
js/battle/StageRuntimeSceneAdapter.js
js/battle/BcuStageSpawnRuntime.js
js/battle/BattleSpawnResolver.js
js/battle/DebugBattleInspector.js
scripts/check-bcu-stage-spawn-runtime.mjs
scripts/check-battle-scene-stage-runtime-wiring.mjs

Step 3

以下を確認する。

- spawn event が BattleScene 側で無条件再計算されていないか
- event.spawnWorldX が保持されているか
- spawnWorldXSource が debug event に残るか
- template missing 時に commitSpawn していないか
- rejectSpawn 後に retry 可能か
- maxEnemyCount 到達時に done になっていないか

Step 4

問題があれば、最小差分で直す。

優先修正先:

1. BattleSceneStageRuntimeWiring.js
2. BattleSpawnResolver.js
3. BcuStageSpawnRuntime.js
4. BattleScene.js

BattleScene.js は最後の手段。
触る場合も巨大置換禁止。

Step 5

必要なら既存 script の assertion を少しだけ増やす。

scripts/check-bcu-stage-spawn-runtime.mjs
scripts/check-battle-scene-stage-runtime-wiring.mjs

Step 6

docs/bcu-migration-status.md を更新する。

完了条件

- docs/bcu-migration-status.md が存在する
- 通常敵 spawn source が bcu-enemy-spawn-700
- boss spawn source が bcu-boss-spawn になりうる
- event.spawnWorldX が BattleScene 側で潰れない
- spawnWorldXSource が debugEvents に残る
- template missing は commitSpawn されない
- rejectSpawn 後に retry 可能
- enemyBaseHpPercent は 100 固定ではない

⸻

13. 最後の注意

この repo の BCU 寄せは、巨大な一発置換ではなく、契約を壊さずに段階的に行う。
Codex は「動きそう」ではなく、「値がどこから来て、どこへ渡り、fallback がどこに記録されるか」を常に示すこと。

実装のたびに次を自問する。

- この値は Stage CSV 由来か？
- BattleConfig の固定値で上書きしていないか？
- world 座標と screen 座標を混ぜていないか？
- BCU common のどの概念に対応するか？
- fallback を debug に残したか？
- BattleScene に責務を増やしていないか？
- Codex が次回読んでも状態が分かる docs を残したか？

この問いに答えられない変更は入れない。
