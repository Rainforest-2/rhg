import { BCU_BATTLE_TIMER_PERIOD_MS } from '../BattleFrameClock.js';
import { TEMPLATE_LOAD_LEVEL } from '../BattleActorFactory.js';

export const SPIRIT_SUMMON_DELAY = 15;
export const SPIRIT_SUMMON_RANGE = 150;

// BCU StageBasis spawns the conjured spirit through the same EUnit factory as any
// lineup form, so its render template must be loaded before spawnActor can place
// it. In live play nothing else preloads a conjurer's spirit form, which is why
// scene.spawnActor returned null and the spirit never appeared. These helpers
// resolve and warm the spirit template so the manual second-tap summon can fire.
function spiritTemplateReady(scene, slotId) {
  const tpl = scene?.actorFactory?.templates?.get?.(slotId);
  return !!tpl && (tpl.loadingLevel === TEMPLATE_LOAD_LEVEL.SPAWN_READY || tpl.loadingLevel === TEMPLATE_LOAD_LEVEL.FULL_VISUAL);
}

function warmSpiritTemplate(scene, unitDef) {
  const factory = scene?.actorFactory;
  if (!factory || typeof factory.preloadTemplate !== 'function' || !unitDef?.slotId) return false;
  if (spiritTemplateReady(scene, unitDef.slotId)) return true;
  factory.preloadTemplate(unitDef, { level: TEMPLATE_LOAD_LEVEL.SPAWN_READY }).catch(() => {});
  return false;
}

function combatModel(actorOrDef) {
  return actorOrDef?.bcuCombatModel || actorOrDef?.rawStats?.bcuCombatModel || actorOrDef?.stats?.bcuCombatModel || actorOrDef?.stats?.bcuCombatModel || null;
}

export function getBcuSpiritSpec(actorOrDef) {
  const proc = combatModel(actorOrDef)?.proc || actorOrDef?.bcuProc || actorOrDef?.stats?.bcuProc || {};
  const sp = proc?.spirit || {};
  if (sp.exists === true && Number.isFinite(Number(sp.id))) return { id: Math.trunc(Number(sp.id)), source: sp.source || 'DataUnit.ints[110]' };
  return null;
}

function ensureState(scene) {
  if (!scene.bcuSpiritState) scene.bcuSpiritState = new Map();
  return scene.bcuSpiritState;
}

function slotKey(slotIdOrActor, fallback = null) {
  if (typeof slotIdOrActor === 'string') return slotIdOrActor;
  return slotIdOrActor?.bcuSummonerSlotId || slotIdOrActor?.slotId || fallback || null;
}

function stateFor(scene, slotId) {
  const state = ensureState(scene);
  if (!state.has(slotId)) {
    state.set(slotId, {
      slotId,
      cooldownFrames: 0,
      summonerSummoned: false,
      spiritSummoned: false,
      source: 'BCU StageBasis spiritCooldown/summonerSummoned/spiritSummoned'
    });
  }
  return state.get(slotId);
}

export function markBcuSummonerSpawned(scene, actor, { slotId = null } = {}) {
  const spec = getBcuSpiritSpec(actor);
  if (!scene || !actor || !spec) return { marked: false, reason: 'no-spirit-spec' };
  const key = slotKey(slotId || actor);
  const st = stateFor(scene, key);
  actor.bcuSummonerSlotId = key;
  actor.bcuSpiritSpec = spec;
  st.summonerSummoned = true;
  st.cooldownFrames = SPIRIT_SUMMON_DELAY;
  st.spiritId = spec.id;
  st.lastSummoner = actor;
  // Resolve and start loading the spirit form now, while the summon cooldown runs,
  // so the spirit template is ready by the time the player taps to conjure it.
  const spiritUnitDef = resolveBcuSpiritUnitDef(scene, key, actor);
  if (spiritUnitDef) {
    st.spiritUnitDef = spiritUnitDef;
    warmSpiritTemplate(scene, spiritUnitDef);
  }
  scene.pushEvent?.({ type: 'bcuSummonerSpawned', slotId: key, spiritId: spec.id, cooldownFrames: SPIRIT_SUMMON_DELAY });
  return { marked: true, state: st };
}

function livingSummoners(scene, slotId) {
  return (scene?.actors || []).filter((actor) => {
    if (actor?.bcuIsSpirit) return false;
    if ((actor?.bcuSummonerSlotId || actor?.slotId) !== slotId) return false;
    if (!getBcuSpiritSpec(actor)) return false;
    if (typeof actor.isAlive === 'function') return actor.isAlive();
    return actor.hp > 0 && actor.state !== 'dead';
  });
}

function livingSpirits(scene, slotId) {
  return (scene?.actors || []).filter((actor) => actor?.bcuIsSpirit && actor?.bcuSummonerSlotId === slotId && (typeof actor.isAlive !== 'function' || actor.isAlive()));
}

function basePos(scene, side) {
  const base = (scene?.bases || []).find((b) => b?.side === side);
  const pos = Number.isFinite(base?.getBattlePosBcu?.()) ? base.getBattlePosBcu() : (Number.isFinite(base?.posBcu) ? base.posBcu : base?.x);
  return Number.isFinite(pos) ? pos : null;
}

export function resolveBcuSpiritSpawnX(scene, summoner, spiritUnitDef = null) {
  const enemyBasePos = basePos(scene, 'cat-enemy');
  const unitBasePos = basePos(scene, summoner?.side || 'dog-player');
  const range = Number(spiritUnitDef?.range ?? spiritUnitDef?.stats?.range ?? spiritUnitDef?.detectionRangeBcu ?? summoner?.detectionRangeBcu ?? 0) || 0;
  const sPos = Number.isFinite(summoner?.x) ? summoner.x : 0;
  if (!Number.isFinite(enemyBasePos) || !Number.isFinite(unitBasePos)) return sPos + SPIRIT_SUMMON_RANGE;
  return Math.max(enemyBasePos + range, Math.min(sPos + SPIRIT_SUMMON_RANGE, unitBasePos));
}

export function resolveBcuSpiritUnitDef(scene, slotId, summoner = null) {
  const explicit = scene?.bcuSpiritUnitDefs?.get?.(slotId) || summoner?.bcuSpiritUnitDef || null;
  if (explicit) return explicit;
  const spec = getBcuSpiritSpec(summoner);
  if (!spec) return null;
  const id = spec.id;
  const pad = String(id).padStart(3, '0');
  const assetDef = scene?.bcuDb?.assets?.resolveUnitAsset?.(id, 'f') || {
    id: `unit-${pad}-f`,
    kind: 'unit',
    semanticKey: `unit:${id}:f`,
    renderMode: 'animated-unit',
    image: 'image.png',
    imgcut: 'imgcut.imgcut',
    model: 'model.mamodel',
    animations: ['move', 'idle', 'attack', 'kb'].map((role, index) => ({ id: `anim0${index}`, file: `${role}.maanim` }))
  };
  return {
    slotId: `bcu-spirit-unit-${id}-f`,
    assetId: `unit-${pad}-f`,
    label: `spirit:${id}`,
    assetDef,
    statsType: 'unit',
    statsId: id,
    formRow: 0,
    side: summoner?.side || 'dog-player',
    direction: summoner?.direction ?? -1,
    facing: summoner?.facing ?? -1,
    renderFlipX: summoner?.renderFlipX === true,
    moveAnimId: 'anim00',
    idleAnimId: 'anim01',
    attackAnimId: 'anim02',
    knockbackAnimId: 'anim03',
    scale: summoner?.scale || 1
  };
}

export function requestBcuSpiritSpawn(scene, slotIdOrActor) {
  const slotId = slotKey(slotIdOrActor);
  const st = slotId ? stateFor(scene, slotId) : null;
  if (!scene || !slotId || !st?.summonerSummoned) return { ok: false, spiritAttempt: false, reason: 'summoner-not-spawned' };
  const summoners = livingSummoners(scene, slotId);
  if (!summoners.length) return { ok: false, spiritAttempt: false, reason: 'no-living-summoner' };
  // From here the tap is a spirit-conjure attempt (BCU StageBasis 527): it must not
  // fall through to deploying a second summoner, even when it cannot spawn yet.
  if (st.spiritSummoned || livingSpirits(scene, slotId).length) return { ok: false, spiritAttempt: true, reason: 'spirit-already-summoned' };
  if (st.cooldownFrames > 0) return { ok: false, spiritAttempt: true, reason: 'cooldown-active', cooldownFrames: st.cooldownFrames };
  const spawned = [];
  for (const summoner of summoners) {
    const unitDef = st.spiritUnitDef || resolveBcuSpiritUnitDef(scene, slotId, summoner);
    if (!unitDef) return { ok: false, spiritAttempt: true, reason: 'spirit-unit-def-missing' };
    // Only gate on the template when this scene actually has a loading factory
    // (live battle). Spawn-time mocks without preloadTemplate spawn directly.
    if (scene.actorFactory && typeof scene.actorFactory.preloadTemplate === 'function' && !spiritTemplateReady(scene, unitDef.slotId)) {
      warmSpiritTemplate(scene, unitDef);
      return { ok: false, spiritAttempt: true, reason: 'spirit-template-loading', slotId: unitDef.slotId };
    }
    const x = resolveBcuSpiritSpawnX(scene, summoner, unitDef);
    const spirit = scene.spawnActor?.(unitDef, summoner.side || unitDef.side || 'dog-player', false, { x, bcuSpirit: true, summoner, slotId });
    if (!spirit) return { ok: false, spiritAttempt: true, reason: 'spawnActor-returned-null' };
    markBcuSpiritActor(scene, spirit, summoner, slotId);
    spawned.push(spirit);
  }
  st.spiritSummoned = true;
  scene.pushEvent?.({ type: 'bcuSpiritSpawned', slotId, count: spawned.length });
  return { ok: true, spiritAttempt: true, spawned, state: st };
}

export function markBcuSpiritActor(scene, spirit, summoner, slotId) {
  spirit.bcuIsSpirit = true;
  spirit.bcuSummonerSlotId = slotId;
  spirit.bcuSpiritSummonerId = summoner?.instanceId || summoner?.label || null;
  spirit.bcuSpiritAttackStartedOnAdd = true;
  spirit.scene = scene;
  spirit.setState?.('attack');
  spirit.attackStartedAtMs = scene?.timeMs || 0;
  spirit.attackElapsedMs = 0;
  spirit.hasHitInCurrentAttack = false;
  spirit.lastBcuSpiritDebug = {
    source: 'BcuSpiritLifecycleRuntime.markBcuSpiritActor',
    bcuReference: 'EUnit.added: if isSpirit atkm.startAttack()'
  };
  return spirit;
}

export function rejectBcuSpiritDamage(actor, meta = {}) {
  if (!actor?.bcuIsSpirit) return { rejected: false };
  if (!actor.bcuProcStatuses) actor.bcuProcStatuses = {};
  actor.bcuProcStatuses.attackNullify = {
    key: 'attackNullify',
    framesRemaining: Number.MAX_SAFE_INTEGER,
    appliedAtMs: meta?.timeMs ?? actor.lastSceneTimeMs ?? null,
    source: 'BCU EUnit.damaged isSpirit -> status[P_IMUATK][0]=Integer.MAX_VALUE; anim.getEff(P_IMUATK)'
  };
  actor.lastBcuSpiritDamageDebug = {
    source: 'BcuSpiritLifecycleRuntime.rejectBcuSpiritDamage',
    bcuReference: 'EUnit.damaged: if isSpirit set P_IMUATK and return false'
  };
  return { rejected: true, accepted: false, bcuSpiritDamageRejected: true, reason: 'bcu-spirit-damage-rejected' };
}

export function tickBcuSpiritState(scene) {
  if (!scene?.bcuSpiritState) return { active: false };
  for (const st of scene.bcuSpiritState.values()) {
    if (st.cooldownFrames > 0) st.cooldownFrames -= 1;
    const summoners = livingSummoners(scene, st.slotId);
    const spirits = livingSpirits(scene, st.slotId);
    if (!summoners.length) {
      st.summonerSummoned = false;
      st.spiritSummoned = false;
    } else {
      st.spiritSummoned = spirits.length > 0;
    }
  }
  for (const actor of scene.actors || []) {
    if (!actor?.bcuIsSpirit) continue;
    if (actor.state === 'attack-wait' || actor.state === 'move') {
      actor.enterDeadState?.(scene.timeMs || 0);
      actor.lastBcuSpiritDebug = {
        ...(actor.lastBcuSpiritDebug || {}),
        selfKilled: true,
        bcuReference: 'EUnit.update: if isSpirit && atkm.atkTime == 0 kill(KillMode.SPIRIT)'
      };
    }
  }
  return { active: true };
}
