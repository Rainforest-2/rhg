import { BattleScene } from './BattleScene.js';

const PATCH_FLAG = Symbol.for('wanko-battle.custom-stage-base-hp-policy.v2-hardened');
const FIXED_HP = 10000000;
const DRAIN_PER_FRAME = 100;

function stageHp(stageState) {
  const hp = Number(stageState?.runtime?.enemyBaseHp ?? stageState?.definition?.enemyBaseHp ?? stageState?.definition?.meta?.enemyBaseHp);
  return Number.isFinite(hp) && hp > 0 ? Math.floor(hp) : null;
}

function findBase(scene, side) {
  return (scene?.bases || []).find((b) => b?.side === side) || null;
}

function firstStageForSide(scene, side) {
  return (scene?.customStageBattle?.stageStates || []).find((s) => s?.side === side) || null;
}

function snapshotBases(scene) {
  return (scene?.bases || []).map((b) => ({ side: b.side, hp: b.hp, maxHp: b.maxHp, destroyed: b.destroyed === true }));
}

function publishDebug(scene, source, extra = {}) {
  const debug = {
    source,
    logicFrame: scene?.logicFrame ?? null,
    config: scene?.customStageBattle?.config || scene?.options?.customStageBattle || null,
    customEnabled: scene?.customStageBattle?.enabled === true,
    bases: snapshotBases(scene),
    ...extra
  };
  scene && (scene.lastCustomStageBaseHpPolicyDebug = debug);
  globalThis.__CUSTOM_STAGE_BATTLE_BASE_HP_DEBUG__ = debug;
  return debug;
}

function setBaseHp(base, hp, source, extra = {}) {
  if (!base || !Number.isFinite(hp) || hp <= 0) return null;
  const previous = { hp: base.hp, maxHp: base.maxHp, destroyed: base.destroyed };
  const next = Math.floor(hp);
  base.maxHp = next;
  base.hp = next;
  base.destroyed = false;
  base.__customStageFixedBaseHpInitialized = true;
  base.debug = {
    ...(base.debug || {}),
    customStageBattleBaseHpPolicy: {
      side: base.side,
      previous,
      appliedHp: next,
      source,
      ...extra
    }
  };
  return base.debug.customStageBattleBaseHpPolicy;
}

function ensureFixedMaxHp(scene) {
  const cfg = scene?.customStageBattle?.config || scene?.options?.customStageBattle || globalThis.__CUSTOM_STAGE_BATTLE_CONFIG__ || {};
  if (!scene?.customStageBattle?.enabled || cfg.fixedBaseHpEnabled !== true) return null;
  const fixedHp = Number.isFinite(Number(cfg.fixedBaseHpValue)) ? Math.floor(Number(cfg.fixedBaseHpValue)) : FIXED_HP;
  const changed = [];
  for (const side of ['cat-enemy', 'dog-player']) {
    const base = findBase(scene, side);
    if (!base) continue;
    const before = { hp: base.hp, maxHp: base.maxHp, destroyed: base.destroyed === true, initialized: base.__customStageFixedBaseHpInitialized === true };
    if (base.__customStageFixedBaseHpInitialized !== true) {
      base.maxHp = fixedHp;
      base.hp = fixedHp;
      base.destroyed = false;
      base.__customStageFixedBaseHpInitialized = true;
    } else if (base.maxHp !== fixedHp) {
      const ratio = Number.isFinite(base.maxHp) && base.maxHp > 0 && Number.isFinite(base.hp) ? Math.max(0, Math.min(1, base.hp / base.maxHp)) : 1;
      base.maxHp = fixedHp;
      base.hp = Math.max(0, Math.min(fixedHp, Math.round(fixedHp * ratio)));
      base.destroyed = base.hp <= 0;
    }
    if (before.hp !== base.hp || before.maxHp !== base.maxHp || before.destroyed !== (base.destroyed === true)) {
      changed.push({ side, before, after: { hp: base.hp, maxHp: base.maxHp, destroyed: base.destroyed === true } });
    }
  }
  if (!changed.length) return null;
  const result = { source: 'BattleSceneCustomStageBaseHpPatch.ensureFixedMaxHp', fixedHp, changed };
  scene.customStageBattle.lastFixedBaseHpEnsure = result;
  scene.pushEvent?.({ type: 'customStageBattleFixedBaseHpEnsured', ...result });
  publishDebug(scene, result.source, result);
  return result;
}

export function applyCustomStageBattleBaseHpPolicy(scene) {
  const cfg = scene?.customStageBattle?.config || scene?.options?.customStageBattle || globalThis.__CUSTOM_STAGE_BATTLE_CONFIG__ || {};
  if (!scene?.customStageBattle?.enabled) {
    return publishDebug(scene, 'BattleSceneCustomStageBaseHpPatch.applyCustomStageBattleBaseHpPolicy:not-custom-enabled');
  }
  const enemyBase = findBase(scene, 'cat-enemy');
  const playerBase = findBase(scene, 'dog-player');
  const enemyStage = firstStageForSide(scene, 'cat-enemy');
  const playerStage = firstStageForSide(scene, 'dog-player');
  const fixed = cfg.fixedBaseHpEnabled === true;
  const enemyHp = fixed ? Number(cfg.fixedBaseHpValue || FIXED_HP) : stageHp(enemyStage);
  const playerHp = fixed ? Number(cfg.fixedBaseHpValue || FIXED_HP) : stageHp(playerStage);
  const applied = {
    source: 'BattleSceneCustomStageBaseHpPatch.applyCustomStageBattleBaseHpPolicy',
    fixedBaseHpEnabled: fixed,
    baseHpDrainEnabled: fixed && cfg.baseHpDrainEnabled === true,
    enemy: setBaseHp(enemyBase, enemyHp, fixed ? 'custom-stage-fixed-10000000' : 'first-enemy-custom-stage.enemyBaseHp', { sourceStageId: enemyStage?.stageId || null, sourceStageKey: enemyStage?.stageKey || null }),
    player: setBaseHp(playerBase, playerHp, fixed ? 'custom-stage-fixed-10000000' : 'first-player-custom-stage.enemyBaseHp', { sourceStageId: playerStage?.stageId || null, sourceStageKey: playerStage?.stageKey || null })
  };
  scene.customStageBattle.baseHpPolicy = applied;
  scene.customStageBattle.initDebug = { ...(scene.customStageBattle.initDebug || {}), baseHpPolicy: applied };
  scene.pushEvent?.({ type: 'customStageBattleBaseHpPolicyApplied', ...applied });
  publishDebug(scene, applied.source, { applied });
  return applied;
}

export function tickCustomStageBattleBaseHpDrain(scene) {
  const cfg = scene?.customStageBattle?.config || scene?.options?.customStageBattle || globalThis.__CUSTOM_STAGE_BATTLE_CONFIG__ || {};
  if (!scene?.customStageBattle?.enabled || cfg.fixedBaseHpEnabled !== true) return null;
  ensureFixedMaxHp(scene);
  if (cfg.baseHpDrainEnabled !== true) {
    publishDebug(scene, 'BattleSceneCustomStageBaseHpPatch.tick:no-drain');
    return null;
  }
  const amount = Number.isFinite(Number(cfg.baseHpDrainPerFrame)) ? Number(cfg.baseHpDrainPerFrame) : DRAIN_PER_FRAME;
  const changed = [];
  for (const side of ['cat-enemy', 'dog-player']) {
    const base = findBase(scene, side);
    if (!base || base.destroyed || !Number.isFinite(base.hp)) continue;
    const before = base.hp;
    base.maxHp = Number.isFinite(Number(cfg.fixedBaseHpValue)) ? Math.floor(Number(cfg.fixedBaseHpValue)) : FIXED_HP;
    base.hp = Math.max(0, base.hp - amount);
    if (base.hp <= 0) base.destroyed = true;
    changed.push({ side, before, after: base.hp, maxHp: base.maxHp, destroyed: base.destroyed });
  }
  if (!changed.length) return null;
  const result = {
    source: 'BattleSceneCustomStageBaseHpPatch.tickCustomStageBattleBaseHpDrain',
    logicFrame: scene.logicFrame,
    amount,
    changed
  };
  scene.customStageBattle.lastBaseHpDrain = result;
  publishDebug(scene, result.source, result);
  if ((scene.logicFrame || 0) % 30 === 0 || changed.some((c) => c.destroyed)) scene.pushEvent?.({ type: 'customStageBattleBaseHpDrained', ...result });
  return result;
}

export function installBattleSceneCustomStageBaseHpPatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalInit = proto.init;
  if (typeof originalInit === 'function') {
    proto.init = async function initWithCustomStageBaseHpPolicy(...args) {
      const result = await originalInit.apply(this, args);
      applyCustomStageBattleBaseHpPolicy(this);
      ensureFixedMaxHp(this);
      return result;
    };
  }

  const originalTick = proto.tick;
  if (typeof originalTick === 'function') {
    proto.tick = function tickWithCustomStageBaseHpDrain(...args) {
      const result = originalTick.apply(this, args);
      tickCustomStageBattleBaseHpDrain(this);
      return result;
    };
  }
}

installBattleSceneCustomStageBaseHpPatch();
