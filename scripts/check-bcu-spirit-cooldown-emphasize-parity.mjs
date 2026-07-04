import assert from 'node:assert/strict';
import '../js/battle/BattleSceneBcuSpiritPatch.js';
import { BattleScene } from '../js/battle/BattleScene.js';
import { isActorShockwaveTouchable } from '../js/battle/BattleBossShockwaveRuntimePatch.js';
import { BCU_ABI, BcuCombatModel } from '../js/battle/BcuCombatModel.js';
import {
  SPIRIT_SUMMON_DELAY,
  getBcuSpiritProductionState,
  markBcuSummonerSpawned,
  requestBcuSpiritSpawn,
  tickBcuSpiritState
} from '../js/battle/bcu-runtime/BcuSpiritLifecycleRuntime.js';

function raw(length, entries) {
  const out = Array.from({ length }, () => 0);
  for (const [index, value] of entries) out[index] = value;
  return out;
}

const summonerModel = BcuCombatModel.parseStats({ kind: 'unit', rawValues: raw(120, [[110, 77]]) });
const spiritModel = BcuCombatModel.parseStats({ kind: 'unit', rawValues: raw(120, []) });

function makeSummoner(id, x = 3000) {
  return {
    instanceId: id,
    slotId: id,
    side: 'dog-player',
    x,
    hp: 100,
    state: 'move',
    detectionRangeBcu: 100,
    stats: { bcuCombatModel: summonerModel },
    isAlive() { return this.hp > 0 && this.state !== 'dead'; }
  };
}

function makeScene(summoner) {
  return {
    logicFrame: 0,
    timeMs: 0,
    actors: [summoner],
    bases: [
      { side: 'cat-enemy', posBcu: 800, getBattlePosBcu() { return this.posBcu; } },
      { side: 'dog-player', posBcu: 3200, getBattlePosBcu() { return this.posBcu; } }
    ],
    actorFactory: { templates: new Map([['spirit-slot', { unitDef: { slotId: 'spirit-slot' }, loadingLevel: 'spawn-ready' }]]) },
    bcuSpiritUnitDefs: new Map([[summoner.slotId, {
      slotId: 'spirit-slot', statsType: 'unit', statsId: 77, side: 'dog-player',
      direction: -1, facing: -1, moveAnimId: 'anim02', idleAnimId: 'anim02',
      attackAnimId: 'anim02', knockbackAnimId: 'anim02', bcuCombatModel: spiritModel
    }]]),
    spawnActor(unitDef, side, isPlayerProduced, options) {
      const a = {
        instanceId: `spirit-${this.actors.length}`,
        slotId: unitDef.slotId,
        side,
        x: options.x,
        hp: 100,
        state: 'attack',
        attackAnimId: 'anim02',
        isAlive() { return this.hp > 0 && this.state !== 'dead'; },
        setState(s) { this.state = s; },
        setAnimation() {}
      };
      this.actors.push(a);
      return a;
    },
    pushEvent() {}
  };
}

// --- 1. Cooldown decrements exactly once per logicFrame even though the scene patch
//        calls tickBcuSpiritState multiple times per frame (before player-production,
//        after actor-state-update, after cleanup). BCU StageBasis decrements once. ---
{
  const summoner = makeSummoner('cd-summoner');
  const scene = makeScene(summoner);
  markBcuSummonerSpawned(scene, summoner, { slotId: 'cd-summoner' });
  const st = scene.bcuSpiritState.get('cd-summoner');
  assert.equal(st.cooldownFrames, SPIRIT_SUMMON_DELAY, 'cooldown starts at SPIRIT_SUMMON_DELAY');

  for (let frame = 1; frame <= SPIRIT_SUMMON_DELAY; frame += 1) {
    scene.logicFrame = frame;
    // Simulate the 3 ticks the scene patch issues within one logicFrame.
    tickBcuSpiritState(scene);
    tickBcuSpiritState(scene);
    tickBcuSpiritState(scene);
    assert.equal(st.cooldownFrames, SPIRIT_SUMMON_DELAY - frame, `frame ${frame} decrements cooldown exactly once`);
  }
  assert.equal(st.cooldownFrames, 0, 'cooldown reaches zero after exactly SPIRIT_SUMMON_DELAY frames');
  assert.equal(st.spiritReady, true, 'cooldown completion arms the ready cue');
  assert.equal(st.spiritEmphasizeCount, 10, 'BCU StageBasis sets spiritEmphasizeCount=10 when cooldown hits 0');
  assert.equal(st.spiritEmphasizeStartFrame, SPIRIT_SUMMON_DELAY, 'emphasize start frame is the ready frame');
}

// --- 2. The emphasize cue decays every 4 frames for 10 steps (BCU 781-784). ---
{
  const summoner = makeSummoner('emph-summoner');
  const scene = makeScene(summoner);
  markBcuSummonerSpawned(scene, summoner, { slotId: 'emph-summoner' });
  const st = scene.bcuSpiritState.get('emph-summoner');
  for (let frame = 1; frame <= SPIRIT_SUMMON_DELAY; frame += 1) { scene.logicFrame = frame; tickBcuSpiritState(scene); }
  const readyFrame = scene.logicFrame;
  assert.equal(st.spiritEmphasizeCount, 10, 'emphasize armed at 10');

  // Decrement fires when (frame - startFrame) % 4 === 0 and frame > startFrame.
  for (let step = 1; step <= 10; step += 1) {
    const targetFrame = readyFrame + step * 4;
    for (let frame = scene.logicFrame + 1; frame <= targetFrame; frame += 1) { scene.logicFrame = frame; tickBcuSpiritState(scene); }
    assert.equal(st.spiritEmphasizeCount, 10 - step, `emphasize step ${step} (frame +${step * 4}) decremented once`);
  }
  assert.equal(st.spiritEmphasizeCount, 0, 'emphasize cue settles at 0 after 10 four-frame steps');
}

// --- 3. Conjuring the spirit clears the ready cue. ---
{
  const summoner = makeSummoner('clear-summoner');
  const scene = makeScene(summoner);
  markBcuSummonerSpawned(scene, summoner, { slotId: 'clear-summoner' });
  const st = scene.bcuSpiritState.get('clear-summoner');
  for (let frame = 1; frame <= SPIRIT_SUMMON_DELAY; frame += 1) { scene.logicFrame = frame; tickBcuSpiritState(scene); }
  assert.equal(st.spiritReady, true, 'ready before conjure');
  const spawned = requestBcuSpiritSpawn(scene, 'clear-summoner');
  assert.equal(spawned.ok, true, 'spirit conjures at ready');
  assert.equal(st.spiritReady, false, 'conjure clears the ready cue');
  assert.equal(st.spiritEmphasizeCount, 0, 'conjure clears the emphasize cue');
}

// --- 4. Losing the summoner clears the ready/emphasize cue (BCU summonerSummoned reset). ---
{
  const summoner = makeSummoner('lost-summoner');
  const scene = makeScene(summoner);
  markBcuSummonerSpawned(scene, summoner, { slotId: 'lost-summoner' });
  const st = scene.bcuSpiritState.get('lost-summoner');
  for (let frame = 1; frame <= SPIRIT_SUMMON_DELAY; frame += 1) { scene.logicFrame = frame; tickBcuSpiritState(scene); }
  assert.equal(st.spiritReady, true, 'ready while summoner alive');
  scene.actors = [];
  scene.logicFrame += 1;
  tickBcuSpiritState(scene);
  assert.equal(st.summonerSummoned, false, 'summoner loss resets summonerSummoned');
  assert.equal(st.spiritReady, false, 'summoner loss clears ready cue');
  assert.equal(st.spiritEmphasizeCount, 0, 'summoner loss clears emphasize cue');
}

// --- 5. Conjured spirits are immune to the boss shockwave interrupt (BCU StageBasis
//        shock loop excludes EUnit.isSpirit; lifecycle spirits carry bcuIsSpirit). ---
{
  const spirit = { state: 'attack', hp: 100, bcuIsSpirit: true, isAlive() { return true; } };
  const normalUnit = { state: 'move', hp: 100, isAlive() { return true; } };
  assert.equal(isActorShockwaveTouchable(spirit), false, 'bcuIsSpirit actor is excluded from boss shockwave');
  assert.equal(isActorShockwaveTouchable(normalUnit), true, 'a normal unit is still shockwave-touchable');
  assert.equal(isActorShockwaveTouchable({ state: 'move', hp: 100, isAlive() { return true; }, bcuCombatModel: { ability: { abi: BCU_ABI.AB_IMUSW } } }), false, 'AB_IMUSW actor is excluded from INT_SW boss shockwave');
  // Legacy stage-spawn spirit flags remain honored.
  assert.equal(isActorShockwaveTouchable({ state: 'move', hp: 100, isSpirit: true, isAlive() { return true; } }), false, 'isSpirit flag still excluded');
}

// --- 6. getBcuSpiritProductionState exposes cooldown/ready/summoned to the card layer. ---
{
  const summoner = makeSummoner('prod-summoner');
  const scene = makeScene(summoner);
  assert.equal(getBcuSpiritProductionState(scene, 'prod-summoner'), null, 'no spirit state before a summoner is deployed');
  markBcuSummonerSpawned(scene, summoner, { slotId: 'prod-summoner' });
  let prod = getBcuSpiritProductionState(scene, 'prod-summoner');
  assert.equal(prod.summonerSummoned, true, 'production state reports the summoner on field');
  assert.equal(prod.cooldownFrames, SPIRIT_SUMMON_DELAY, 'production state surfaces the cooldown countdown');
  assert.equal(prod.spiritReady, false, 'not ready during cooldown');
  for (let frame = 1; frame <= SPIRIT_SUMMON_DELAY; frame += 1) { scene.logicFrame = frame; tickBcuSpiritState(scene); }
  prod = getBcuSpiritProductionState(scene, 'prod-summoner');
  assert.equal(prod.cooldownFrames, 0, 'production state cooldown reaches zero');
  assert.equal(prod.spiritReady, true, 'production state flags ready when the emphasize cue is armed');
  assert.equal(prod.spiritEmphasizeCount, 10, 'production state forwards the emphasize count for the card flash');
  requestBcuSpiritSpawn(scene, 'prod-summoner');
  prod = getBcuSpiritProductionState(scene, 'prod-summoner');
  assert.equal(prod.spiritReady, false, 'ready clears once the spirit is conjured');
  assert.equal(prod.spiritSummoned, true, 'production state reports the spirit is out');
}

// --- 7. BCU spiritSummoned is one-shot for a living summoner. It does not clear just
//        because the spirit actor finished its attack and disappeared. ---
{
  const summoner = makeSummoner('one-shot-summoner');
  const scene = makeScene(summoner);
  markBcuSummonerSpawned(scene, summoner, { slotId: 'one-shot-summoner' });
  for (let frame = 1; frame <= SPIRIT_SUMMON_DELAY; frame += 1) { scene.logicFrame = frame; tickBcuSpiritState(scene); }
  const first = requestBcuSpiritSpawn(scene, 'one-shot-summoner');
  assert.equal(first.ok, true, 'first spirit conjure succeeds');
  const spirit = first.spawned[0];
  spirit.state = 'dead';
  spirit.hp = 0;
  scene.actors = scene.actors.filter((actor) => actor !== spirit);
  scene.logicFrame += 1;
  tickBcuSpiritState(scene);
  assert.equal(scene.bcuSpiritState.get('one-shot-summoner').spiritSummoned, true, 'spiritSummoned stays true while summoner remains alive');
  const second = requestBcuSpiritSpawn(scene, 'one-shot-summoner');
  assert.equal(second.ok, false, 'second spirit conjure is rejected for the same living summoner');
  assert.equal(second.reason, 'spirit-already-summoned', 'one-shot rejection reason is explicit');
}

// --- 8. BCU StageBasis unitRespawnTime: a successful conjure locks ALL production for
//        the rest of the frame, then clears on the next frame. ---
{
  const summoner = makeSummoner('lock-summoner');
  const scene = makeScene(summoner);
  scene.frontLineup = 0;
  scene.getPlayerLineupRows = () => [];
  markBcuSummonerSpawned(scene, summoner, { slotId: 'lock-summoner' });
  for (let frame = 1; frame <= SPIRIT_SUMMON_DELAY; frame += 1) { scene.logicFrame = frame; tickBcuSpiritState(scene); }

  const events = [];
  scene.pushEvent = (event) => events.push(event);
  const requestPlayerSpawn = BattleScene.prototype.requestPlayerSpawn;

  const conjure = requestPlayerSpawn.call(scene, 'lock-summoner');
  assert.equal(conjure, true, 'conjure succeeds at ready');
  assert.equal(scene.bcuUnitRespawnLockFrame, scene.logicFrame, 'conjure stamps the unit-respawn lock for this frame');

  // A different (normal) card on the same frame is blocked by the lock before it can
  // reach the underlying production path.
  const blocked = requestPlayerSpawn.call(scene, 'some-other-unit');
  assert.equal(blocked, false, 'unrelated production is blocked on the conjure frame');
  assert.equal(events.at(-1)?.reason, 'unit-respawn-lock', 'block reason is the unit-respawn lock');

  // Next frame the lock clears.
  scene.logicFrame += 1;
  scene.bcuSpiritState.get('lock-summoner').spiritSummoned = true; // spirit still out
  assert.notEqual(scene.bcuUnitRespawnLockFrame, scene.logicFrame, 'lock no longer matches the new frame');
}

console.log('check-bcu-spirit-cooldown-emphasize-parity: OK');
