import assert from 'node:assert/strict';
import { BattleActor } from '../js/battle/BattleActor.js';
import { BattleAttackResolver } from '../js/battle/BattleAttackResolver.js';
import '../js/battle/BattleSoulstrikePatch.js';
import '../js/battle/BattleActorZombieRevivePatch.js';
import '../js/battle/BattleBcuDeathAnimationRuntimePatch.js';
import { BcuCombatModel, BCU_ABI } from '../js/battle/BcuCombatModel.js';
import { BCU_BATTLE_TIMER_PERIOD_MS } from '../js/battle/BattleFrameClock.js';
import { BCU_REVIVE_SHOW_TIME } from '../js/battle/bcu-runtime/BcuZombieCorpseRuntime.js';
import { BCU_DEATH_SURGE_TRIGGER_FRAME, tickBcuDeathAnimation } from '../js/battle/bcu-runtime/BcuDeathAnimationRuntime.js';

function raw(length, entries) {
  const out = Array.from({ length }, () => 0);
  for (const [index, value] of entries) out[index] = value;
  return out;
}

function actor(id, model, side = 'cat-enemy', x = 1000) {
  const a = new BattleActor({
    assetDef: { id },
    sprite: null,
    model: { parts: [] },
    side,
    x,
    y: 0,
    direction: side === 'dog-player' ? -1 : 1,
    stats: { hp: 100, damage: 100, speed: 0, bcuCombatModel: model },
    animations: { anim00: { tracks: [], maxFrame: 1 } }
  });
  a.instanceId = id;
  a.detectionRangeBcu = 500;
  a.detectionRangePx = 500;
  a.attackWidthBcu = 0;
  a.attackWidthPx = 0;
  return a;
}

const zombieModel = BcuCombatModel.parseStats({ kind: 'enemy', rawValues: raw(116, [[19, 1], [45, 1], [46, 30], [47, 50], [89, 100], [90, 40], [91, 120], [92, 3]]) });
assert.equal(zombieModel.proc.revive.count, 1, 'DataEnemy.ints[45] parses REVIVE.count');
assert.equal(zombieModel.proc.revive.time, 30, 'DataEnemy.ints[46] parses REVIVE.time');
assert.equal(zombieModel.proc.revive.health, 50, 'DataEnemy.ints[47] parses REVIVE.health');
assert.equal(zombieModel.proc.deathSurge.prob, 100, 'DataEnemy.ints[89] parses DEATHSURGE.prob');
assert.equal(zombieModel.proc.deathSurge.dis0, 10, 'DataEnemy.ints[90] parses DEATHSURGE.dis_0 / 4');
assert.equal(zombieModel.proc.deathSurge.dis1, 40, 'DataEnemy.ints[91] parses DEATHSURGE range end / 4');

const soulModel = BcuCombatModel.parseStats({ kind: 'unit', rawValues: raw(120, [[52, 1], [98, 1]]) });
assert.equal((soulModel.ability.abi & BCU_ABI.AB_ZKILL) !== 0, true, 'DataUnit.ints[52] parses AB_ZKILL');
assert.equal((soulModel.ability.abi & BCU_ABI.AB_CKILL) !== 0, true, 'DataUnit.ints[98] parses AB_CKILL');

const zombie = actor('zombie', zombieModel);
zombie.takeDamage(150, { timeMs: 0, damageCalculation: { abilityDebug: { eventAbilitySemantic: {} } } });
const revive = zombie.resolvePostDamage({ nowMs: 0, tuning: { finalKnockbackBeforeDeath: false } });
assert.equal(revive.zombieReviveScheduled, true, 'non-zombie-killer death schedules revive');
assert.equal(zombie.hp, 50, 'revive HP uses maxH * REVIVE.health / 100');
assert.equal(zombie.bcuZombieCorpseTargetable, false, 'corpse is not targetable before REVIVE_SHOW_TIME');

const attacker = actor('soul-attacker', soulModel, 'dog-player', 1300);
const event = { attackKind: 'normal', targetMode: 'range', rangeEndBcu: 500, attackBackBcu: 0, abilities: { soulstrike: true } };
assert.equal(BattleAttackResolver.captureTargets({ attacker, enemyActors: [zombie], enemyBase: null, event }).length, 0, 'soulstrike cannot hit corpse before show window');

for (let i = 0; i < BCU_REVIVE_SHOW_TIME; i += 1) {
  zombie.lastSceneTimeMs = (i + 1) * BCU_BATTLE_TIMER_PERIOD_MS;
  zombie.lastSceneLogicFrame = i + 1;
  zombie.tick(BCU_BATTLE_TIMER_PERIOD_MS);
}
assert.equal(zombie.bcuZombieCorpseTargetable, true, 'corpse targetability begins at REVIVE_SHOW_TIME');
assert.equal(BattleAttackResolver.captureTargets({ attacker, enemyActors: [zombie], enemyBase: null, event: { ...event, abilities: {} } }).length, 0, 'non-soulstrike cannot hit corpse-only state');
assert.equal(BattleAttackResolver.captureTargets({ attacker, enemyActors: [zombie], enemyBase: null, event }).length, 1, 'soulstrike can hit corpse during corpse window');
const soulHit = zombie.takeDamage(1, { attacker, event, timeMs: zombie.lastSceneTimeMs });
assert.equal(soulHit.soulstrikeCorpseKill, true, 'soulstrike corpse hit cancels revive');
assert.equal(zombie.bcuZombieRevivePending, false, 'soulstrike cleanup clears revive pending state');

const zkZombie = actor('zk-zombie', zombieModel);
zkZombie.takeDamage(150, { timeMs: 0, damageCalculation: { abilityDebug: { eventAbilitySemantic: { zombieKiller: true } } } });
const zkResult = zkZombie.resolvePostDamage({ nowMs: 0, tuning: { finalKnockbackBeforeDeath: false } });
assert.equal(zkResult.zombieReviveScheduled === true, false, 'zombie killer suppresses revive');
assert.equal(zkZombie.lastBcuZombieReviveDebug.zombieKillerBlocked, true, 'zombie killer suppression records debug evidence');

const dsScene = {
  logicFrame: 0,
  timeMs: 0,
  effects: [],
  soulEffectAssets: { demonSoulEnemy: { loaded: true, image: {}, imgcut: { parts: [] }, model: { parts: [] }, anim: { tracks: [], maxFrame: 24 }, source: 'test' } },
  waveEffectAssets: {},
  __bcuSurgeContainers: [],
  getBcuRandom: () => () => 0,
  ensureBcuSoulEffectLoading() {},
  ensureWaveEffectLoading() {},
  pushEvent(event) { (this.events ||= []).push(event); }
};
const dsActor = actor('death-surge', zombieModel);
dsActor.scene = dsScene;
dsActor.hp = 0;
dsActor.isAliveFlag = false;
dsActor.enterDeadState(0);
for (let i = 0; i < BCU_DEATH_SURGE_TRIGGER_FRAME + 5; i += 1) {
  dsScene.logicFrame = i + 1;
  dsActor.lastSceneLogicFrame = i + 1;
  tickBcuDeathAnimation(dsActor, BCU_BATTLE_TIMER_PERIOD_MS, { scene: dsScene, nowMs: i * BCU_BATTLE_TIMER_PERIOD_MS });
}
assert.equal(dsScene.__bcuSurgeContainers.length, 1, 'death surge fires once at demon soul frame 21 and does not double-spawn');
assert.equal(zombieModel.proc.miniDeathSurge?.implemented === true, false, 'mini-death-surge remains partial without a proven normal enemy CSV holder');

// BCU Entity.ZombX.update corpse visual lifecycle:
// doRevive sets status[P_REVIVE][1] = REVIVE.time + A_ZOMBIE REVIVE.len(); corpse anim is DOWN,
// switches to REVIVE at status[P_REVIVE][1] == REVIVE.len() - 2, clears at 0; draw hides the base
// actor while status[P_REVIVE][1] >= REVIVE_SHOW_TIME.
const corpseAsset = (maxFrame) => ({ loaded: true, image: {}, imgcut: { parts: [] }, model: { parts: [] }, anim: { tracks: [], maxFrame }, frameCount: maxFrame + 1, source: 'test' });
const corpseScene = {
  logicFrame: 0,
  timeMs: 0,
  effects: [],
  soulEffectAssets: { zombieCorpseDown: corpseAsset(9), zombieCorpseRevive: corpseAsset(19) },
  waveEffectAssets: {},
  ensureBcuSoulEffectLoading() {},
  ensureWaveEffectLoading() {},
  pushEvent(event) { (this.events ||= []).push(event); }
};
const visualZombie = actor('visual-zombie', zombieModel);
visualZombie.scene = corpseScene;
visualZombie.takeDamage(150, { timeMs: 0, damageCalculation: { abilityDebug: { eventAbilitySemantic: {} } } });
const visualRevive = visualZombie.resolvePostDamage({ nowMs: 0, tuning: { finalKnockbackBeforeDeath: false } });
assert.equal(visualRevive.zombieReviveScheduled, true, 'corpse visual test schedules revive');
const reviveAnimFrames = 20;
const totalFrames = 30 + reviveAnimFrames;
assert.equal(visualZombie.bcuZombieReviveReadyAtMs, totalFrames * BCU_BATTLE_TIMER_PERIOD_MS, 'revive countdown adds A_ZOMBIE REVIVE anim length like ZombX.doRevive');
assert.equal(visualZombie.bcuZombieCorpseVisual?.active, true, 'corpse visual state starts active');
assert.equal(visualZombie.bcuZombieCorpseVisual?.phase, 'down', 'corpse visual starts in DOWN phase');
assert.equal(visualZombie.bcuRenderOverride?.mode, 'zombie-corpse', 'corpse visual installs zombie-corpse render override');
assert.equal(visualZombie.bcuRenderOverride?.hideBaseActor, true, 'base actor hidden while corpse shows');
const downEffect = corpseScene.effects.find((fx) => fx?.effectRuntimeDebug?.effectKey === 'zombieCorpseDown' || fx?.debug?.effectKey === 'zombieCorpseDown');
assert.ok(downEffect, 'DOWN corpse effect spawns from soul bundle zombie-corpse aliases');
assert.equal(downEffect.bcuScaleMode, 'entity-status', 'corpse effect uses entity status scale mode (corpse.draw(gra, p, siz))');
assert.equal(downEffect.renderFlipX, false, 'enemy-side corpse uses A_ZOMBIE without mirror (A_U_ZOMBIE rev only for units)');
let reviveSwapFrame = null;
let baseVisibleFrame = null;
for (let i = 1; i <= totalFrames; i += 1) {
  visualZombie.lastSceneTimeMs = i * BCU_BATTLE_TIMER_PERIOD_MS;
  visualZombie.lastSceneLogicFrame = i;
  visualZombie.tick(BCU_BATTLE_TIMER_PERIOD_MS);
  if (reviveSwapFrame === null && visualZombie.bcuZombieCorpseVisual?.phase === 'revive') reviveSwapFrame = i;
  if (baseVisibleFrame === null && visualZombie.bcuRenderOverride && visualZombie.bcuRenderOverride.hideBaseActor === false) baseVisibleFrame = i;
}
assert.equal(reviveSwapFrame, totalFrames - (reviveAnimFrames - 2), 'corpse switches to REVIVE when remaining == REVIVE.len() - 2');
assert.equal(baseVisibleFrame, totalFrames - BCU_REVIVE_SHOW_TIME + 1, 'base actor draws again when remaining < REVIVE_SHOW_TIME');
assert.equal(visualZombie.bcuZombieRevivePending, false, 'corpse visual zombie revives after full countdown');
assert.equal(visualZombie.hp, 50, 'revived HP uses maxH * REVIVE.health / 100');
assert.equal(visualZombie.bcuZombieCorpseVisual?.active, false, 'corpse visual cleared on revive');
assert.equal(visualZombie.bcuRenderOverride, null, 'zombie-corpse render override cleared on revive');
assert.equal(corpseScene.effects.filter((fx) => fx?.type === 'zombieCorpse').length, 0, 'corpse effects removed from scene on revive');

console.log('check-bcu-zombie-corpse-soulstrike-parity: OK');
