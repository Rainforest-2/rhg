import { BCU_BATTLE_TIMER_PERIOD_MS } from '../BattleFrameClock.js';
import { EffectRuntime } from '../EffectRuntime.js';

export const BCU_CAT_CANNON_ID_BASIC = 0;
export const BCU_CAT_CANNON_BASIC_RANGE = 400;
export const BCU_CAT_CANNON_BASIC_PRE_FRAMES = 18;
export const BCU_CAT_CANNON_ASSIST_DISTANCE = 55;

export const BCU_DEFAULT_CAT_CANNON_TECH = Object.freeze({
  recharge: 30,
  attack: 30,
  charge: 10
});

export const BCU_DEFAULT_CAT_CANNON_TREASURE = Object.freeze({
  recharge: 600,
  attack: 600
});

function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getPlayerBasePos(scene) {
  const base = scene?.bases?.find?.((b) => b?.side === 'dog-player');
  const pos = base?.getBattlePosBcu?.();
  if (Number.isFinite(pos)) return pos;
  return finite(scene?.stage?.runtime?.playerBasePosBcu, 4000);
}

function isEnemyActor(actor) {
  return actor?.side === 'cat-enemy' && actor?.isAlive?.() && actor?.isTargetable?.() !== false;
}

export function getBcuCatCannonAttack({
  attackTech = BCU_DEFAULT_CAT_CANNON_TECH.attack,
  attackTreasure = BCU_DEFAULT_CAT_CANNON_TREASURE.attack,
  attackComboPercent = 0,
  noCombo = false,
  cannonMultiplier = 100
} = {}) {
  const base = 50 + Math.floor(finite(attackTech, 30)) * 50 + Math.floor(finite(attackTreasure, 600)) * 5;
  const combo = 100 + (noCombo ? 0 : Math.floor(finite(attackComboPercent, 0)));
  return Math.floor((base * combo * Math.floor(finite(cannonMultiplier, 100))) / 10000);
}

export function getBcuCatCannonMaxChargeFrames({
  mapTime = 3,
  attackTech = BCU_DEFAULT_CAT_CANNON_TECH.attack,
  rechargeTech = BCU_DEFAULT_CAT_CANNON_TECH.recharge,
  rechargeTreasure = BCU_DEFAULT_CAT_CANNON_TREASURE.recharge,
  speedComboPercent = 0,
  noCombo = false
} = {}) {
  let base = 1500 + 50 * (Math.floor(finite(attackTech, 30)) - Math.floor(finite(rechargeTech, 30)));
  const treasure = Math.floor(finite(rechargeTreasure, 600));
  if (treasure <= 300) base -= Math.floor(1.5 * treasure);
  else base -= 3 * treasure - 450;
  base += Math.floor(finite(mapTime, 3)) * 450;
  base -= Math.floor((base * (noCombo ? 0 : Math.floor(finite(speedComboPercent, 0)))) / 100);
  return Math.max(950, base);
}

export function getBcuBasicCannonWaveCenters(playerBasePos, {
  chargeTech = BCU_DEFAULT_CAT_CANNON_TECH.charge,
  range = BCU_CAT_CANNON_BASIC_RANGE
} = {}) {
  const waveLevel = Math.floor(finite(chargeTech, 10)) + 2;
  const count = waveLevel + 1;
  const first = finite(playerBasePos, 4000) - 332.5 + range / 2;
  return Array.from({ length: count }, (_, index) => first - range * index);
}

export function initializeBcuCatCannon(scene, options = {}) {
  if (!scene) return null;
  const maxCannon = Math.floor(finite(options.maxCannonFrames, getBcuCatCannonMaxChargeFrames(options)));
  const cannon = Math.max(0, Math.min(maxCannon, Math.floor(finite(options.startChargeFrames, maxCannon))));
  scene.bcuCatCannon = {
    source: 'BCU StageBasis.cannon/maxCannon + Cannon basic runtime',
    enabled: options.enabled !== false,
    id: BCU_CAT_CANNON_ID_BASIC,
    cannon,
    maxCannon,
    requestFire: false,
    active: null,
    tech: {
      recharge: Math.floor(finite(options.rechargeTech, BCU_DEFAULT_CAT_CANNON_TECH.recharge)),
      attack: Math.floor(finite(options.attackTech, BCU_DEFAULT_CAT_CANNON_TECH.attack)),
      charge: Math.floor(finite(options.chargeTech, BCU_DEFAULT_CAT_CANNON_TECH.charge))
    },
    treasure: {
      recharge: Math.floor(finite(options.rechargeTreasure, BCU_DEFAULT_CAT_CANNON_TREASURE.recharge)),
      attack: Math.floor(finite(options.attackTreasure, BCU_DEFAULT_CAT_CANNON_TREASURE.attack))
    },
    attack: getBcuCatCannonAttack(options),
    lastChargeDebug: null,
    lastFireDebug: null,
    lastAttackDebug: null,
    lastAssistDebug: null
  };
  return scene.bcuCatCannon;
}

export function getBcuCatCannonStatus(scene) {
  const state = scene?.bcuCatCannon || initializeBcuCatCannon(scene);
  if (!state) return null;
  return {
    source: state.source,
    enabled: state.enabled,
    id: state.id,
    cannon: state.cannon,
    maxCannon: state.maxCannon,
    chargeRatio: state.maxCannon > 0 ? state.cannon / state.maxCannon : 0,
    ready: state.enabled && state.cannon >= state.maxCannon && !state.active,
    active: !!state.active,
    attack: state.attack,
    requestFire: state.requestFire,
    lastFireDebug: state.lastFireDebug,
    lastAttackDebug: state.lastAttackDebug
  };
}

export function requestBcuCatCannonFire(scene) {
  const state = scene?.bcuCatCannon || initializeBcuCatCannon(scene);
  if (!state?.enabled) return false;
  state.requestFire = true;
  return true;
}

export function tickBcuCatCannonCharge(scene, dt = BCU_BATTLE_TIMER_PERIOD_MS) {
  const state = scene?.bcuCatCannon || initializeBcuCatCannon(scene);
  if (!state?.enabled) return state;
  const stepFrames = Math.max(1, Math.round(finite(dt, BCU_BATTLE_TIMER_PERIOD_MS) / BCU_BATTLE_TIMER_PERIOD_MS));
  const before = state.cannon;
  if (!state.active) state.cannon = Math.min(state.maxCannon, state.cannon + stepFrames);
  state.lastChargeDebug = {
    source: 'BCU StageBasis.update active block: cannon++',
    before,
    after: state.cannon,
    stepFrames,
    ready: state.cannon >= state.maxCannon
  };
  if (state.requestFire) activateBcuCatCannon(scene);
  return state;
}

export function activateBcuCatCannon(scene) {
  const state = scene?.bcuCatCannon || initializeBcuCatCannon(scene);
  if (!state?.enabled) return false;
  const before = getBcuCatCannonStatus(scene);
  state.requestFire = false;
  if (state.active || state.cannon < state.maxCannon) {
    state.lastFireDebug = { ok: false, reason: state.active ? 'active' : 'not-charged', before };
    scene?.pushEvent?.({ type: 'bcuCatCannonRejected', ...state.lastFireDebug });
    return false;
  }
  state.active = { preFrames: BCU_CAT_CANNON_BASIC_PRE_FRAMES, startedFrame: scene?.logicFrame ?? null };
  state.cannon = 0;
  // BCU Cannon.activate() starts the cannon BASE animation at the player base on press;
  // damage resolves preTime (NYPRE[BASE_H]=18) frames later. The scene owns the visual.
  const animSpawned = scene?.spawnCatCannonFireEffect?.() === true;
  state.lastFireDebug = {
    ok: true,
    reason: 'ok',
    before,
    after: getBcuCatCannonStatus(scene),
    animSpawned,
    source: 'BCU StageBasis.act_can -> canon.activate(); cannon = 0',
    bcuReference: 'Cannon.activate: anim = atks[BASE_H].getEAnim(BASE); preTime = NYPRE[BASE_H] = 18'
  };
  scene?.pushEvent?.({ type: 'bcuCatCannonActivated', ...state.lastFireDebug });
  return true;
}

function captureBasicCannonTargets(scene, centers, range) {
  const half = range / 2;
  const seen = new Set();
  const hits = [];
  for (const actor of scene?.actors || []) {
    if (!isEnemyActor(actor)) continue;
    const pos = finite(actor.posBcu, finite(actor.x, NaN));
    if (!Number.isFinite(pos)) continue;
    for (let waveIndex = 0; waveIndex < centers.length; waveIndex += 1) {
      const center = centers[waveIndex];
      if (pos < center - half || pos > center + half) continue;
      const key = actor.instanceId || actor.label || String(hits.length);
      if (seen.has(key)) break;
      seen.add(key);
      hits.push({ actor, waveIndex, center, pos });
      break;
    }
  }
  return hits;
}

export function tickBcuCatCannonAttack(scene) {
  const state = scene?.bcuCatCannon || null;
  if (!state?.enabled || !state.active) return null;
  state.active.preFrames -= 1;
  if (state.active.preFrames > 0) return { attacked: false, remainingPreFrames: state.active.preFrames };
  const playerBasePos = getPlayerBasePos(scene);
  const centers = getBcuBasicCannonWaveCenters(playerBasePos, { chargeTech: state.tech.charge });
  const hits = captureBasicCannonTargets(scene, centers, BCU_CAT_CANNON_BASIC_RANGE);
  const damage = state.attack;
  if (Array.isArray(scene?.effects)) {
    scene.effects.push(EffectRuntime.createEffect({
      id: `bcu-cat-cannon-basic-${scene?.logicFrame ?? 0}`,
      type: 'cat-cannon-basic',
      x: centers[0],
      y: scene?.actorGroundY ?? scene?.groundY ?? 560,
      source: 'bcu-effanim-cat-cannon-basic',
      createdAtMs: scene?.timeMs ?? 0,
      durationMs: 800,
      layer: 9,
      debug: {
        effectKey: 'cat-cannon/basic',
        source: 'BcuCatCannonRuntime.tickBcuCatCannonAttack',
        bcuReference: 'Cannon.drawAtk / ContWaveCanon draw owns basic cannon attack visual; JS keeps source-separated trace until cannon attack bundle alias is proven',
        phase: 'attack'
      }
    }));
  }
  for (const hit of hits) {
    const actor = hit.actor;
    const result = actor.takeDamage?.(damage, {
      attacker: 'bcu-cat-cannon',
      hitIndex: hit.waveIndex,
      attackEventKey: 'bcu-cat-cannon-basic',
      timeMs: scene?.timeMs ?? null,
      damageCalculation: {
        source: 'BCU AttackCanon basic cannon direct damage',
        baseDamage: damage,
        finalDamage: damage,
        multiplier: 1,
        applied: true,
        modifiers: { notes: ['stage/cannon-source-not-unit-proc'] }
      },
      baseDamage: damage,
      finalDamage: damage,
      damageMultiplier: 1
    });
    if (result?.accepted) {
      actor.__bcuCatCannonAssistPending = {
        source: 'BCU Entity.damaged atkProc.SNIPER -> interrupt(INT_ASS, KB_DIS[INT_ASS])',
        waveIndex: hit.waveIndex,
        center: hit.center,
        damage,
        frame: scene?.logicFrame ?? null
      };
    }
  }
  state.lastAttackDebug = {
    source: 'BCU Cannon.update basic canon -> AttackCanon + ContWaveCanon',
    bcuReference: 'BASE_H: WAVE.lv = tech[LV_CRG] + 2; SNIPER.prob = 1; NYRAN[0] = 400',
    playerBasePos,
    centers,
    damage,
    effectSource: 'bcu-effanim-cat-cannon-basic',
    hitCount: hits.length,
    hits: hits.map((hit) => ({ target: hit.actor.instanceId || hit.actor.label || null, waveIndex: hit.waveIndex, pos: hit.pos }))
  };
  scene?.pushEvent?.({ type: 'bcuCatCannonBasicAttack', ...state.lastAttackDebug });
  state.active = null;
  return state.lastAttackDebug;
}

export function resolveBcuCatCannonAssistKnockback(scene, tuning = {}) {
  const state = scene?.bcuCatCannon || null;
  if (!state?.enabled) return { applied: 0, skipped: 0 };
  let applied = 0;
  let skipped = 0;
  const events = [];
  for (const actor of scene?.actors || []) {
    const pending = actor?.__bcuCatCannonAssistPending;
    if (!pending) continue;
    delete actor.__bcuCatCannonAssistPending;
    if (!actor.isAlive?.() || actor.state === 'knockback') {
      skipped += 1;
      events.push({ target: actor?.instanceId || actor?.label || null, skipped: true, reason: 'dead-or-already-knockback' });
      continue;
    }
    const cfg = actor.getKnockbackConfig?.(tuning, 'assist') || {};
    actor.startKnockback?.({
      ...cfg,
      type: 'assist',
      reason: 'bcu-cat-cannon-sniper',
      specType: 'CANNON',
      bcuType: 'INT_ASS',
      bcuDistance: BCU_CAT_CANNON_ASSIST_DISTANCE,
      nowMs: scene?.timeMs ?? 0,
      deathAfterKnockback: false,
      kbeffRuntime: scene?.createKbeffRuntimeForKb?.('INT_ASS') || null,
      kbeffInitialUpdate: true
    });
    applied += 1;
    events.push({ target: actor?.instanceId || actor?.label || null, applied: true, waveIndex: pending.waveIndex });
  }
  state.lastAssistDebug = {
    source: 'BcuCatCannonRuntime.resolveBcuCatCannonAssistKnockback',
    bcuReference: 'Entity.damaged: atkProc.SNIPER.prob > 0 -> interrupt(INT_ASS, KB_DIS[INT_ASS])',
    applied,
    skipped,
    events
  };
  if (applied || skipped) scene?.pushEvent?.({ type: 'bcuCatCannonAssistKnockback', ...state.lastAssistDebug });
  return state.lastAssistDebug;
}
