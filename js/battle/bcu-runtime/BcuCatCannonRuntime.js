import { BCU_BATTLE_TIMER_PERIOD_MS } from '../BattleFrameClock.js';
import { EffectRuntime } from '../EffectRuntime.js';
import { getTraitList } from '../BcuTraitCompatibility.js';
import { resolveBcuCatCannonMagnification } from './BcuCannonLevelCurve.js';

export const BCU_CAT_CANNON_ID_BASIC = 0;
export const BCU_CAT_CANNON_BASIC_RANGE = 400;
export const BCU_CAT_CANNON_BASIC_PRE_FRAMES = 18;
export const BCU_CAT_CANNON_ASSIST_DISTANCE = 55;

// BCU util/Data.java NyType ids (BASE_*) and the cannon constant tables. These are the source of
// truth for every non-basic cannon's range / pre-time / target / proc / geometry.
export const BCU_CAT_CANNON_IDS = Object.freeze({
  BASE_H: 0, BASE_SLOW: 1, BASE_WALL: 2, BASE_STOP: 3,
  BASE_WATER: 4, BASE_GROUND: 5, BASE_BARRIER: 6, BASE_CURSE: 7
});
// util/Data.java: NYPRE (preTime per id) and NYRAN (range per id). -1 entries are special (wall).
export const BCU_CAT_CANNON_NYPRE = Object.freeze([18, 1, -1, 27, 37, 18, 10, 1]);
export const BCU_CAT_CANNON_NYRAN = Object.freeze([400, 82.5, -1, 500, 500, 400, 100, 82.5]);
// util/Data.java: TRAIT_METAL=3, TRAIT_ZOMBIE=6; AB_ONLY=1<<3, AB_ZKILL=1<<9, AB_CKILL=1<<18.
export const BCU_TRAIT_METAL = 3;
export const BCU_TRAIT_ZOMBIE = 6;
const AB_ONLY = 1 << 3;
const AB_ZKILL = 1 << 9;
const AB_CKILL = 1 << 18;
// util/Data.java: INT_KB=0, KB_DIS[INT_KB]=165, KB_TIME[INT_KB]=11 (blast/barrier cannon knockback).
export const BCU_CAT_CANNON_BARRIER_KB_DISTANCE = 165;
export const BCU_CAT_CANNON_BARRIER_KB_TIME = 11;
// Cannon.java: freeze/water/blast use duration = 11 (localized AOE persistence frames).
export const BCU_CAT_CANNON_LOCALIZED_DURATION = 11;
// Cannon.java slow/curse: ContExtend(eatk, p, wid, spe=150, itv=1, rem=32, rep=0, layer=9).
export const BCU_CAT_CANNON_EXTEND_SPEED = 150;
export const BCU_CAT_CANNON_EXTEND_INTERVAL = 1;
export const BCU_CAT_CANNON_EXTEND_REPEAT = 32;
// BCU util/Data.java W_TIME = 3: ContWaveCanon spawns the next wave band W_TIME frames later
// (and NYRAN[0] = 400 further out) so the basic cannon wave visibly travels outward.
export const BCU_CAT_CANNON_WAVE_TIME = 3;
// BCU battle/attack/ContWaveCanon.java: band 0 is created at t = -3 and its AttackCanon lands
// at t = 2 (guessed attack point), i.e. 5 frames after the wave is created (preTime reaches 0).
export const BCU_CAT_CANNON_WAVE_FIRST_HIT_FRAMES = 5;

// BCU androidutil/battle/BattleBox.java drawBtm canon.drawBase positioning, indexed by NyType id:
//   canx = { 0, 0, 0, 64, 64, 0, 0, 0 };  cany = { -134, -134, -134, -250, -250, -134, -134, -134 };
//   canon.drawBase(g, setP(getX(ubase.pos) + canx[id]*siz, midh + (cany[id] - road_h)*siz), psiz)
// road_h = 156, sprite = 0.8, psiz = siz*sprite. Since midh - road_h*siz == getBcuLayerScreenY(layer 0),
// the firing animation is drawn at the player base ground line plus a per-cannon pixel offset (scaled by
// camera siz, NOT by sprite), at the BCU sprite scale.
export const BCU_CAT_CANNON_DRAW_OFFSET_X = Object.freeze([0, 0, 0, 64, 64, 0, 0, 0]);
export const BCU_CAT_CANNON_DRAW_OFFSET_Y = Object.freeze([-134, -134, -134, -250, -250, -134, -134, -134]);

// Pure BCU-parity positioning for the cannon BASE firing animation. baseX is projectBattleX(ubase.pos),
// baseY0 is getBcuLayerScreenY(layer 0) (== midh - road_h*siz). Mirrors BattleBox.drawBtm exactly.
export function computeBcuCannonBaseAnimDraw({ baseX = 0, baseY0 = 0, cameraScale = 1, spriteScale = 0.8, offsetX = 0, offsetY = 0 } = {}) {
  const cam = finite(cameraScale, 1);
  return {
    x: finite(baseX, 0) + finite(offsetX, 0) * cam,
    y: finite(baseY0, 0) + finite(offsetY, 0) * cam,
    scale: cam * finite(spriteScale, 0.8),
    bcuReference: 'BattleBox.drawBtm canon.drawBase setP(getX(ubase.pos)+canx*siz, midh+(cany-road_h)*siz) psiz=siz*sprite'
  };
}

// Pure BCU-parity positioning for the ContWaveCanon traveling wave (ATK eanim). baseX is
// projectBattleX(band pos), baseY9 is getBcuLayerScreenY(layer 9). Mirrors BattleBox.drawEff +
// ContWaveCanon.draw: x = getX(pos) - wave*siz + pus.x*(-psiz); y = baseY9 + pus.y*(-psiz);
// scale = psiz*2 with psiz scaled by the per-cannon multiplier (1.25 for basic). For the basic
// cannon pus*(-psiz) collapses to *siz because sprite*1.25 == 1.0, giving offsetX=-37, offsetY=-40.
export function computeBcuCannonWaveAnimDraw({ baseX = 0, baseY9 = 0, cameraScale = 1, spriteScale = 0.8, offsetX = 0, offsetY = 0, scaleMul = 2.5 } = {}) {
  const cam = finite(cameraScale, 1);
  return {
    x: finite(baseX, 0) + finite(offsetX, 0) * cam,
    y: finite(baseY9, 0) + finite(offsetY, 0) * cam,
    scale: cam * finite(spriteScale, 0.8) * finite(scaleMul, 2.5),
    bcuReference: 'BattleBox.drawEff + ContWaveCanon.draw atks[id].getEAnim(ATK)'
  };
}

export function getBcuCatCannonDrawOffsets(cannonId = 0) {
  const id = Number.isInteger(cannonId) && cannonId >= 0 && cannonId < BCU_CAT_CANNON_DRAW_OFFSET_X.length ? cannonId : 0;
  return { offsetX: BCU_CAT_CANNON_DRAW_OFFSET_X[id], offsetY: BCU_CAT_CANNON_DRAW_OFFSET_Y[id] };
}

// Resolve the full BCU behavior spec for a cannon id from battle/entity/Cannon.java `update()`.
// `magnification` supplies the level-curve numbers (Treasure.getCannonMagnification -> CannonLevelCurve),
// which are NOT shipped in this checkout. Any magnification-derived value left null is reported as an
// unresolved blocker rather than guessed (per repo fact-first rule), so callers can gate that cannon.
//
// geometry kinds (Cannon.update):
//   'waved'     id 0,5 : ContWaveCanon traveling wave bands (NYRAN aoe per band, W_TIME apart)
//   'extend'    id 1,7 : ContExtend sweeping wave (spe=150, itv=1, rem=32) applying a status, no damage
//   'localized' id 3,4,6: single AttackCanon AOE over [pos-rad, pos+rad] held `duration` frames
//   'wall'      id 2   : spawns a defensive wall EUnit (Form 339) for an alive-time; no enemy damage
export function getBcuCatCannonSpec(id, { magnification = {} } = {}) {
  const mag = magnification || {};
  const missing = [];
  const need = (key) => {
    const v = Number(mag[key]);
    if (Number.isFinite(v)) return v;
    missing.push(key);
    return null;
  };
  const base = {
    id,
    name: Object.keys(BCU_CAT_CANNON_IDS).find((k) => BCU_CAT_CANNON_IDS[k] === id) || `id-${id}`,
    preTime: BCU_CAT_CANNON_NYPRE[id] ?? null,
    range: BCU_CAT_CANNON_NYRAN[id] ?? null,
    bcuReference: 'battle/entity/Cannon.java update()'
  };
  switch (id) {
    case BCU_CAT_CANNON_IDS.BASE_H: // 0
      return { ...base, geometry: 'waved', targetTrait: null, abilityBits: 0, damage: 'getCanonAtk * cannonMultiplier / 100',
        procs: ['WAVE', 'SNIPER'], waveTime: BCU_CAT_CANNON_WAVE_TIME, magnificationResolved: true, missingMagnification: [] };
    case BCU_CAT_CANNON_IDS.BASE_SLOW: // 1
      return { ...base, geometry: 'extend', targetTrait: null, abilityBits: 0, damage: 0,
        procs: ['SLOW'], slowTime: need('slowTime'), extend: { speed: BCU_CAT_CANNON_EXTEND_SPEED, interval: BCU_CAT_CANNON_EXTEND_INTERVAL, repeat: BCU_CAT_CANNON_EXTEND_REPEAT, width: base.range },
        magnificationResolved: missing.length === 0, missingMagnification: [...missing] };
    case BCU_CAT_CANNON_IDS.BASE_WALL: // 2
      return { ...base, geometry: 'wall', targetTrait: null, abilityBits: 0, damage: 0, procs: [],
        wallFormId: 339, wallAliveTime: need('wallAliveTime'),
        magnificationResolved: missing.length === 0, missingMagnification: [...missing] };
    case BCU_CAT_CANNON_IDS.BASE_STOP: // 3 (freeze)
      return { ...base, geometry: 'localized', targetTrait: null, abilityBits: 0,
        duration: BCU_CAT_CANNON_LOCALIZED_DURATION, radius: base.range / 2,
        damage: 'getCanonAtk * atkMagnification / 100', atkMagnification: need('atkMagnification'),
        procs: ['STOP'], stopTime: need('stopTime'), posAnchor: 'player-side-front',
        magnificationResolved: missing.length === 0, missingMagnification: [...missing] };
    case BCU_CAT_CANNON_IDS.BASE_WATER: // 4
      return { ...base, geometry: 'localized', targetTrait: BCU_TRAIT_METAL, abilityBits: 0,
        duration: BCU_CAT_CANNON_LOCALIZED_DURATION, radius: base.range / 2,
        damage: 1, procs: ['CRIT'], critMult: (() => { const v = need('healthPercentage'); return v == null ? null : -v; })(),
        posAnchor: 'player-side-front', magnificationResolved: missing.length === 0, missingMagnification: [...missing] };
    case BCU_CAT_CANNON_IDS.BASE_GROUND: // 5 (zombie / ground zero)
      return { ...base, geometry: 'waved', targetTrait: BCU_TRAIT_ZOMBIE, abilityBits: AB_ONLY | AB_ZKILL | AB_CKILL,
        damage: 0, procs: ['WAVE', 'STOP', 'SNIPER'], stopTime: need('stopTime'), waveTime: BCU_CAT_CANNON_WAVE_TIME,
        magnificationResolved: missing.length === 0, missingMagnification: [...missing] };
    case BCU_CAT_CANNON_IDS.BASE_BARRIER: // 6 (blast / breaker)
      return { ...base, geometry: 'localized', targetTrait: null, abilityBits: AB_CKILL,
        duration: BCU_CAT_CANNON_LOCALIZED_DURATION, excludeRightEdge: true,
        damage: 'getCanonAtk * atkMagnification / 100', atkMagnification: need('atkMagnification'),
        procs: ['BREAK', 'KB'], kbDistance: BCU_CAT_CANNON_BARRIER_KB_DISTANCE, kbTime: BCU_CAT_CANNON_BARRIER_KB_TIME,
        barrierRange: need('barrierRange'), posAnchor: 'enemy-side-front',
        magnificationResolved: missing.length === 0, missingMagnification: [...missing] };
    case BCU_CAT_CANNON_IDS.BASE_CURSE: // 7
      return { ...base, geometry: 'extend', targetTrait: null, abilityBits: 0, damage: 0,
        procs: ['CURSE'], curseTime: need('curseTime'), extend: { speed: BCU_CAT_CANNON_EXTEND_SPEED, interval: BCU_CAT_CANNON_EXTEND_INTERVAL, repeat: BCU_CAT_CANNON_EXTEND_REPEAT, width: base.range },
        magnificationResolved: missing.length === 0, missingMagnification: [...missing] };
    default:
      return { ...base, geometry: 'unknown', targetTrait: null, abilityBits: 0, damage: 0, procs: [], magnificationResolved: false, missingMagnification: ['unknown-cannon-id'] };
  }
}

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
  // BCU Cannon basic: proc.WAVE.lv = tech[LV_CRG] + 2. Each AttackWave decrements WAVE.lv and the
  // ContWaveCanon chain spawns a band while WAVE.lv > 0, so the chain yields exactly WAVE.lv bands.
  const waveLv = Math.floor(finite(chargeTech, 10)) + 2;
  const count = waveLv;
  const first = finite(playerBasePos, 4000) - 332.5 + range / 2;
  return Array.from({ length: count }, (_, index) => first - range * index);
}

function actorHasTrait(actor, trait) {
  if (trait == null) return true;
  const list = getTraitList(actor) || [];
  return list.map(String).includes(String(trait));
}

function captureEnemiesInRange(scene, lo, hi, targetTrait = null) {
  const hits = [];
  for (const actor of scene?.actors || []) {
    if (!isEnemyActor(actor)) continue;
    const pos = finite(actor.posBcu, finite(actor.x, NaN));
    if (!Number.isFinite(pos) || pos < lo || pos > hi) continue;
    if (!actorHasTrait(actor, targetTrait)) continue;
    hits.push({ actor, pos });
  }
  return hits;
}

// BCU Cannon.update anchor for localized cannons.
//   freeze/water (id 3,4): pos = ubase.pos; for frontmost enemy toward enemy base; pos -= NYRAN/2.
//   blast/barrier (id 6): pos = max(800, ebase.pos); for rearmost enemy toward player base.
// Coordinates increase from enemy base toward player base (basic wave steps by -NYRAN).
function resolveNonBasicCannonAnchor(scene, spec) {
  const playerBasePos = getPlayerBasePos(scene);
  const enemyBasePos = finite(scene?.stage?.runtime?.enemyBasePosBcu, 0);
  if (spec.posAnchor === 'enemy-side-front') {
    let pos = Math.max(800, enemyBasePos);
    for (const actor of scene?.actors || []) {
      if (!isEnemyActor(actor)) continue;
      const p = finite(actor.posBcu, finite(actor.x, NaN));
      if (Number.isFinite(p) && p > pos) pos = p;
    }
    return pos;
  }
  // player-side-front
  let pos = playerBasePos;
  for (const actor of scene?.actors || []) {
    if (!isEnemyActor(actor)) continue;
    const p = finite(actor.posBcu, finite(actor.x, NaN));
    if (Number.isFinite(p) && p < pos) pos = p;
  }
  return pos - (finite(spec.range, 0) / 2);
}

// BCU getBreakerSpawnPoint(pos, range) = pos + ceil(range*4/5)/4.
function getBreakerSpawnPoint(pos, range) {
  return pos + Math.ceil((range * 4) / 5) / 4;
}

// Resolve the damage value for a cannon hit (Cannon.update per id).
function resolveNonBasicCannonDamage(spec, baseCanonAtk, targetActor) {
  if (spec.id === 4) {
    // water cannon (Entity.critCalc, crit < 0): metal -> max(1, health*|crit|/100); else max(1, health/1000).
    const hp = finite(targetActor?.hp, finite(targetActor?.maxHp, 0));
    const pct = -finite(spec.critMult, 0); // critMult is negative health percentage
    if (actorHasTrait(targetActor, 3)) return Math.max(1, Math.floor((hp * pct) / 100));
    return Math.max(1, Math.floor(hp / 1000));
  }
  if (spec.geometry === 'localized' && Number.isFinite(spec.atkMagnification)) {
    // freeze/blast: getCanonAtk * atkMagnification / 100.
    return Math.max(0, Math.floor((finite(baseCanonAtk, 0) * spec.atkMagnification) / 100));
  }
  return Math.max(0, Math.floor(Number(spec.damage) || 0));
}

// Map a cannon proc name to the actor.applyBcuProc status key + payload (cannon-owned, not unit proc).
function cannonProcToStatus(procName, spec) {
  switch (procName) {
    case 'STOP': return Number.isFinite(spec.stopTime) ? { key: 'freeze', payload: { time: spec.stopTime } } : null;
    case 'SLOW': return Number.isFinite(spec.slowTime) ? { key: 'slow', payload: { time: spec.slowTime } } : null;
    case 'CURSE': return Number.isFinite(spec.curseTime) ? { key: 'curse', payload: { time: spec.curseTime } } : null;
    default: return null; // WAVE/SNIPER/BREAK/KB/CRIT handled outside applyBcuProc
  }
}

// Apply a non-basic cannon attack to a set of captured enemy hits. Cannon-owned: uses actor.takeDamage,
// actor.applyBcuProc, and actor.startKnockback directly (never unit-proc queueAttackDamage).
export function applyBcuNonBasicCannonEffect(scene, state, hits, { tuning = {} } = {}) {
  const spec = state.spec;
  const baseCanonAtk = state.attack;
  const events = [];
  for (const { actor } of hits) {
    const damage = resolveNonBasicCannonDamage(spec, baseCanonAtk, actor);
    let damageAccepted = false;
    if (damage > 0 && typeof actor.takeDamage === 'function') {
      const result = actor.takeDamage(damage, {
        attacker: `bcu-cat-cannon-${spec.name}`,
        attackEventKey: `bcu-cat-cannon-${spec.name}`,
        timeMs: scene?.timeMs ?? null,
        breaksBarrier: spec.procs.includes('BREAK'),
        damageCalculation: { source: `BCU AttackCanon ${spec.name} cannon-owned damage`, baseDamage: damage, finalDamage: damage, multiplier: 1, applied: true, modifiers: { notes: ['cannon-source-not-unit-proc'] } },
        baseDamage: damage, finalDamage: damage, damageMultiplier: 1
      });
      damageAccepted = !!result?.accepted;
    }
    const appliedProcs = [];
    for (const procName of spec.procs) {
      const status = cannonProcToStatus(procName, spec);
      if (status && typeof actor.applyBcuProc === 'function') {
        const r = actor.applyBcuProc(status, { nowMs: scene?.timeMs ?? 0, tuning });
        if (r?.applied) appliedProcs.push(procName);
      }
    }
    if (spec.procs.includes('KB') && actor.state !== 'knockback' && typeof actor.startKnockback === 'function') {
      actor.startKnockback({
        type: 'proc', reason: 'bcu-cat-cannon-blast', specType: 'CANNON', bcuType: 'INT_KB',
        bcuDistance: spec.kbDistance, bcuTimeFrames: spec.kbTime, nowMs: scene?.timeMs ?? 0, tuning,
        ...(actor.getKnockbackConfig?.(tuning, 'proc') || {})
      });
      appliedProcs.push('KB');
    }
    events.push({ target: actor.instanceId || actor.label || null, damage, damageAccepted, appliedProcs });
  }
  const debug = {
    source: 'BcuCatCannonRuntime.applyBcuNonBasicCannonEffect',
    bcuReference: `Cannon.update id=${spec.id} (${spec.name}): ${spec.geometry}; procs=${spec.procs.join('|')}`,
    cannonId: spec.id, geometry: spec.geometry, hitCount: hits.length, events
  };
  state.lastAttackDebug = debug;
  scene?.pushEvent?.({ type: 'bcuNonBasicCatCannonAttack', ...debug });
  return debug;
}

// Capture enemies for a non-basic cannon at its BCU anchor + spawn its effect trace.
export function fireBcuNonBasicCannon(scene, state, { tuning = {} } = {}) {
  const spec = state.spec;
  // BCU: a target-trait only filters capture when AB_ONLY is set (ground/zombie). Water adds the metal
  // trait WITHOUT AB_ONLY -> it hits all, metal just takes %HP via critCalc (handled in damage resolve).
  const filterTrait = (spec.abilityBits & AB_ONLY) ? spec.targetTrait : null;
  let hits = [];
  if (spec.geometry === 'localized') {
    const anchor = resolveNonBasicCannonAnchor(scene, spec);
    if (spec.id === 6) {
      const rad = Number.isFinite(spec.barrierRange) ? spec.barrierRange : finite(spec.range, 0);
      const newPos = getBreakerSpawnPoint(anchor, rad);
      hits = captureEnemiesInRange(scene, newPos - rad, newPos, filterTrait);
      state.lastAnchorDebug = { anchor, newPos, rad, lo: newPos - rad, hi: newPos };
    } else {
      const rad = finite(spec.radius, finite(spec.range, 0) / 2);
      hits = captureEnemiesInRange(scene, anchor - rad, anchor + rad, filterTrait);
      state.lastAnchorDebug = { anchor, rad, lo: anchor - rad, hi: anchor + rad };
    }
  } else if (spec.geometry === 'waved' || spec.geometry === 'extend') {
    // Status/wave cannons reach across the player-side lane out to NYRAN-defined extent. The exact
    // per-frame traveling/sweep timing mirrors the basic cannon wave; here the captured set is the
    // lane in front of the player base (toward enemy base). Coordinate exactness flagged for review.
    const playerBasePos = getPlayerBasePos(scene);
    const reach = (spec.geometry === 'extend')
      ? finite(spec.extend?.speed, 150) * finite(spec.extend?.repeat, 32)
      : finite(spec.range, 400) * (finite(state.tech?.charge, 10) + 2);
    hits = captureEnemiesInRange(scene, playerBasePos - reach, playerBasePos, filterTrait);
    state.lastAnchorDebug = { playerBasePos, reach, lo: playerBasePos - reach, hi: playerBasePos };
  }
  if (Array.isArray(scene?.effects) && scene.effects.length < (scene?.maxEffects ?? 60)) {
    scene.effects.push(EffectRuntime.createEffect({
      id: `bcu-cat-cannon-${spec.name}-${scene?.logicFrame ?? 0}`,
      type: `cat-cannon-${spec.name}`,
      x: state.lastAnchorDebug?.anchor ?? getPlayerBasePos(scene),
      y: 0,
      source: `bcu-effanim-cat-cannon-${spec.name}`,
      createdAtMs: scene?.timeMs ?? 0,
      durationMs: 600,
      layer: 9,
      debug: { effectKey: `cat-cannon/${spec.name}`, source: 'BcuCatCannonRuntime.fireBcuNonBasicCannon', bcuReference: spec.bcuReference, phase: 'attack', cannonId: spec.id }
    }));
  }
  return applyBcuNonBasicCannonEffect(scene, state, hits, { tuning });
}

export function initializeBcuCatCannon(scene, options = {}) {
  if (!scene) return null;
  const id = Number.isInteger(options.id) ? options.id : BCU_CAT_CANNON_ID_BASIC;
  // Resolve magnification from loader curve data when supplied, else from an explicit override.
  let magnification = options.magnification || null;
  let magnificationDebug = null;
  if (!magnification && options.cannonCurveData) {
    magnificationDebug = resolveBcuCatCannonMagnification(options.cannonCurveData, id, options.cannonLevel ?? null);
    magnification = magnificationDebug.magnification;
  }
  const spec = getBcuCatCannonSpec(id, { magnification: magnification || {} });
  const maxCannon = Math.floor(finite(options.maxCannonFrames, getBcuCatCannonMaxChargeFrames(options)));
  const cannon = Math.max(0, Math.min(maxCannon, Math.floor(finite(options.startChargeFrames, maxCannon))));
  scene.bcuCatCannon = {
    source: 'BCU StageBasis.cannon/maxCannon + Cannon runtime (dedicated cannon source, not unit proc)',
    enabled: options.enabled !== false,
    id,
    spec,
    magnification: magnification || {},
    magnificationDebug,
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
  // Wall cannon (id 2) has a distinct preTime=-1 entity-spawn lifecycle (Cannon.update spawns Unit 339).
  // That entity-spawn path is not yet wired; reject rather than guess its timing/owner.
  if (state.spec?.geometry === 'wall') {
    state.lastFireDebug = { ok: false, reason: 'wall-cannon-entity-spawn-not-implemented', before, bcuReference: 'Cannon.update id==2: spawns Unit 339 wall; preTime=-1 lifecycle' };
    scene?.pushEvent?.({ type: 'bcuCatCannonRejected', ...state.lastFireDebug });
    return false;
  }
  const preFrames = state.id === BCU_CAT_CANNON_ID_BASIC
    ? BCU_CAT_CANNON_BASIC_PRE_FRAMES
    : (Number.isFinite(state.spec?.preTime) && state.spec.preTime > 0 ? state.spec.preTime : BCU_CAT_CANNON_BASIC_PRE_FRAMES);
  state.active = { preFrames, startedFrame: scene?.logicFrame ?? null };
  state.cannon = 0;
  // BCU Cannon.activate() starts the cannon BASE animation at the player base on press; the basic
  // wave (ContWaveCanon band 0) is created preTime (NYPRE[BASE_H]=18) frames later and its first
  // damage lands at the wave's t=2 (a further BCU_CAT_CANNON_WAVE_FIRST_HIT_FRAMES). Scene owns visual.
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

function captureBasicCannonBandTargets(scene, center, range, hitKeys) {
  const half = range / 2;
  const hits = [];
  for (const actor of scene?.actors || []) {
    if (!isEnemyActor(actor)) continue;
    const pos = finite(actor.posBcu, finite(actor.x, NaN));
    if (!Number.isFinite(pos)) continue;
    if (pos < center - half || pos > center + half) continue;
    // BCU AttackWave shares an `incl` set across the whole wave, so a unit straddling two bands
    // is only hit by the first band that reaches it.
    const key = actor.instanceId || actor.label || `actor-${hitKeys.size}`;
    if (hitKeys.has(key)) continue;
    hitKeys.add(key);
    hits.push({ actor, pos, key });
  }
  return hits;
}

function fireBcuCannonBand(scene, state, wave, waveIndex) {
  const center = wave.centers[waveIndex];
  const damage = state.attack;
  const hits = captureBasicCannonBandTargets(scene, center, BCU_CAT_CANNON_BASIC_RANGE, wave.hitKeys);
  // BCU ContWaveCanon draws atks[0].getEAnim(ATK) per band as the traveling wave. Spawn the real
  // ATK eanim via the scene; fall back to a trace effect when the loaded asset is unavailable.
  const waveSpawned = scene?.spawnCatCannonWaveEffect?.(center, waveIndex) === true;
  if (!waveSpawned && Array.isArray(scene?.effects)) {
    scene.effects.push(EffectRuntime.createEffect({
      id: `bcu-cat-cannon-basic-${scene?.logicFrame ?? 0}-w${waveIndex}`,
      type: 'cat-cannon-basic',
      x: center,
      y: scene?.actorGroundY ?? scene?.groundY ?? 560,
      source: 'bcu-effanim-cat-cannon-basic',
      createdAtMs: scene?.timeMs ?? 0,
      durationMs: 800,
      layer: 9,
      debug: {
        effectKey: 'cat-cannon/basic',
        source: 'BcuCatCannonRuntime.fireBcuCannonBand',
        bcuReference: 'ContWaveCanon: each band owns its own wave attack + ATK eanim, W_TIME=3 frames and NYRAN=400 apart (traveling wave)',
        phase: 'attack',
        waveIndex
      }
    }));
  }
  for (const hit of hits) {
    const actor = hit.actor;
    const result = actor.takeDamage?.(damage, {
      attacker: 'bcu-cat-cannon',
      hitIndex: waveIndex,
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
        waveIndex,
        center,
        damage,
        frame: scene?.logicFrame ?? null
      };
    }
  }
  wave.totalHits += hits.length;
  const debug = {
    source: 'BCU Cannon.update basic canon -> AttackCanon + ContWaveCanon (per-band staggered)',
    bcuReference: 'BASE_H: WAVE.lv = tech[LV_CRG] + 2; SNIPER.prob = 1; NYRAN[0] = 400; W_TIME = 3; band lands at wave t = 2',
    attacked: hits.length > 0,
    waveIndex,
    waveAge: wave.age,
    center,
    damage,
    effectSource: 'bcu-effanim-cat-cannon-basic',
    hitCount: hits.length,
    totalHitCount: wave.totalHits,
    bandCount: wave.centers.length,
    hits: hits.map((h) => ({ target: h.key, waveIndex, pos: h.pos }))
  };
  state.lastAttackDebug = debug;
  scene?.pushEvent?.({ type: 'bcuCatCannonBasicAttack', ...debug });
  return debug;
}

export function tickBcuCatCannonAttack(scene, { tuning = {} } = {}) {
  const state = scene?.bcuCatCannon || null;
  if (!state?.enabled || !state.active) return null;

  // Non-basic cannons: count preTime (NYPRE[id]) down, then apply the dedicated cannon effect once.
  if (state.id !== BCU_CAT_CANNON_ID_BASIC) {
    state.active.preFrames -= 1;
    if (state.active.preFrames > 0) return { attacked: false, remainingPreFrames: state.active.preFrames };
    const result = fireBcuNonBasicCannon(scene, state, { tuning });
    state.active = null;
    return result;
  }

  // Pre phase: BCU Cannon.update counts preTime (NYPRE[BASE_H] = 18) down to 0; the basic
  // ContWaveCanon (wave band 0) is created on the frame preTime reaches 0 (no damage yet).
  if (!state.active.wave) {
    state.active.preFrames -= 1;
    if (state.active.preFrames > 0) {
      return { attacked: false, remainingPreFrames: state.active.preFrames };
    }
    const playerBasePos = getPlayerBasePos(scene);
    const centers = getBcuBasicCannonWaveCenters(playerBasePos, { chargeTech: state.tech.charge });
    state.active.wave = { age: 0, centers, playerBasePos, bandsFired: 0, totalHits: 0, hitKeys: new Set() };
    state.lastWaveDebug = {
      source: 'BcuCatCannonRuntime.tickBcuCatCannonAttack wave creation',
      bcuReference: 'BCU Cannon.update preTime==0 -> new ContWaveCanon(AttackWave ...) at ubase.pos',
      playerBasePos,
      bandCount: centers.length
    };
    return { attacked: false, waveStarted: true, waveAge: 0, bandCount: centers.length };
  }

  // Wave phase: BCU ContWaveCanon spawns the next band W_TIME = 3 frames later and NYRAN = 400
  // further out (the wave travels outward). Band k's AttackCanon lands at the wave's t = 2, i.e.
  // BCU_CAT_CANNON_WAVE_FIRST_HIT_FRAMES + k * W_TIME frames after the wave was created.
  const wave = state.active.wave;
  wave.age += 1;
  const offset = wave.age - BCU_CAT_CANNON_WAVE_FIRST_HIT_FRAMES;
  let result = { attacked: false, waveAge: wave.age };
  if (offset >= 0 && offset % BCU_CAT_CANNON_WAVE_TIME === 0) {
    const waveIndex = offset / BCU_CAT_CANNON_WAVE_TIME;
    if (waveIndex < wave.centers.length) {
      result = fireBcuCannonBand(scene, state, wave, waveIndex);
      wave.bandsFired += 1;
    }
  }
  if (wave.bandsFired >= wave.centers.length) state.active = null;
  return result;
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
