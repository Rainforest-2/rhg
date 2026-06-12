import assert from 'node:assert/strict';
import { BattleActor } from '../js/battle/BattleActor.js';
import { BattleAttackProfile } from '../js/battle/BattleAttackProfile.js';
import '../js/battle/BcuProcImmunityPatch.js';
import '../js/battle/BattleSceneBcuSummonPatch.js';
import {
  linkBcuSummonBond,
  normalizeBcuSummonProc,
  processBcuSummonTokens,
  queueBcuImmediateSummon,
  queueBcuTargetSummonToken,
  tickBcuSummonSpawnQueue
} from '../js/battle/bcu-runtime/BcuSummonRuntime.js';

function makeActor(id, { side = 'dog-player', x = 3000, direction = -1, hp = 100, proc = {}, stats = {} } = {}) {
  const actor = new BattleActor({
    assetDef: { id },
    sprite: null,
    model: { parts: [] },
    side,
    x,
    y: 0,
    direction,
    facing: direction,
    stats: {
      hp,
      damage: 10,
      speed: 0,
      detectionRange: 100,
      range: 100,
      width: 40,
      bcuCombatModel: { kind: side === 'dog-player' ? 'unit' : 'enemy', proc, immunity: {} },
      ...stats
    },
    animations: {
      anim00: { tracks: [], maxFrame: 1 },
      anim01: { tracks: [], maxFrame: 1 },
      anim02: { tracks: [], maxFrame: 6 },
      anim03: { tracks: [], maxFrame: 3 }
    },
    attackAnimId: 'anim02'
  });
  actor.instanceId = id;
  actor.slotId = id;
  actor.currentLayer = 2;
  actor.spawnLayer = 3;
  actor.posBcu = x;
  return actor;
}

function summonUnitDef(slotId, statsType = 'unit', statsId = 7) {
  return {
    slotId,
    label: slotId,
    assetId: slotId,
    assetDef: { id: slotId },
    statsType,
    statsId,
    side: statsType === 'unit' ? 'dog-player' : 'cat-enemy',
    direction: statsType === 'unit' ? -1 : 1,
    facing: statsType === 'unit' ? -1 : 1,
    renderFlipX: false,
    idleAnimId: 'anim01',
    moveAnimId: 'anim00',
    attackAnimId: 'anim02',
    knockbackAnimId: 'anim03',
    collisionRadius: 44,
    scale: 1
  };
}

function makeScene(seed = 0.5) {
  const scene = {
    logicFrame: 10,
    timeMs: 333,
    actors: [],
    bases: [{ side: 'dog-player' }, { side: 'cat-enemy' }],
    stage: { runtime: { stageLen: 4000 } },
    actorGroundY: 0,
    debugEvents: [],
    actorSerial: 0,
    getBcuRandom() { return () => seed; },
    getEffectiveEnemyMaxCount() { return this.enemyMax ?? 15; },
    actorFactory: {
      templates: new Map(),
      preloadTemplate(unitDef) {
        this.templates.set(unitDef.slotId, { unitDef, loadingLevel: 'spawn-ready' });
        return Promise.resolve(this.templates.get(unitDef.slotId));
      }
    },
    spawnActor(unitDef, side, isPlayerProduced, options = {}) {
      if (!this.actorFactory.templates.has(unitDef.slotId)) return null;
      const actor = makeActor(`${unitDef.slotId}-${++this.actorSerial}`, {
        side,
        x: options.x,
        direction: unitDef.direction ?? (side === 'dog-player' ? -1 : 1),
        hp: 120,
        stats: { hp: 120, damage: 5, bcuCombatModel: { kind: unitDef.statsType, proc: {}, immunity: {} } }
      });
      actor.slotId = unitDef.slotId;
      actor.currentLayer = options.currentLayer ?? 0;
      this.actors.push(actor);
      return actor;
    },
    pushEvent(event) { this.debugEvents.push(event); }
  };
  return scene;
}

const bitfield = 3 | (1 << 2) | (1 << 6);
const normalized = normalizeBcuSummonProc({
  prob: 100,
  id: { id: 7, cls: 'Unit' },
  form: 2,
  mult: 50,
  dis: 10,
  max_dis: 12,
  min_layer: -1,
  max_layer: -1,
  time: 1,
  tba: -1,
  type: bitfield
}, { attacker: makeActor('normalizer') });
assert.equal(normalized.kind, 'unit', 'Identifier cls Unit maps to unit summon');
assert.equal(normalized.formRow, 1, 'BCU form is 1-based and JS formRow is 0-based');
assert.equal(normalized.type.animType, 3, 'SUMMON.TYPE lower two bits carry anim_type');
assert.equal(normalized.type.ignoreLimit, true, 'SUMMON.TYPE bit 2 carries ignore_limit');
assert.equal(normalized.type.onHit, true, 'SUMMON.TYPE bit 6 carries on_hit');
const defaultEnemyKind = normalizeBcuSummonProc({ prob: 100, mult: 100 }, { attacker: makeActor('enemy-default', { side: 'dog-player', stats: { bcuCombatModel: { kind: 'enemy', proc: {}, immunity: {} } } }) });
assert.equal(defaultEnemyKind.kind, 'enemy', 'SUMMON with null id defaults to attacker BCU data kind, not display side');

{
  const scene = makeScene(0.5);
  const attacker = makeActor('attacker', { x: 3000, direction: -1 });
  scene.actors.push(attacker);
  const def = summonUnitDef('summon-unit-007', 'unit', 7);
  scene.actorFactory.templates.set(def.slotId, { unitDef: def, loadingLevel: 'spawn-ready' });
  const event = { key: 'hit-0', hitIndex: 0, summon: { prob: 100, unitDef: def, kind: 'unit', mult: 40, dis: 10, maxDis: 12, minLayer: -1, maxLayer: -1, time: 1, type: { ignoreLimit: true } } };
  const queued = queueBcuImmediateSummon(scene, attacker, event, { key: 'hit-0', hitIndex: 0 });
  assert.equal(queued.queued, true, 'non on_hit/on_kill SUMMON queues immediately before target capture');
  assert.equal(scene.bcuSummonSpawnQueue[0].x, 2989, 'summon position uses anchor.pos + attacker.dire * random inclusive distance');
  assert.equal(scene.bcuSummonSpawnQueue[0].layer, 2, 'min=max=-1 falls back to summoner currentLayer');
  const ticked = tickBcuSummonSpawnQueue(scene);
  assert.equal(ticked.spawned, 1, 'time=1 summon spawns on next actor-state-update pass');
  assert.equal(scene.actors.at(-1).bcuIsSummoned, true, 'spawned actor is marked as BCU summoned');
}

{
  const scene = makeScene(0);
  const attacker = makeActor('hit-attacker', { x: 3000, direction: -1 });
  const target = makeActor('target', { side: 'cat-enemy', direction: 1, x: 2500, proc: { IMUSUMMON: { mult: 50, block: 50 } } });
  scene.actors.push(attacker, target);
  const def = summonUnitDef('summon-enemy-009', 'enemy', 9);
  scene.actorFactory.templates.set(def.slotId, { unitDef: def, loadingLevel: 'spawn-ready' });
  const event = { key: 'hit-1', hitIndex: 1, summon: { prob: 100, unitDef: def, kind: 'enemy', mult: 200, dis: 20, maxDis: 20, minLayer: -1, maxLayer: -1, time: 2, type: { onHit: true, ignoreLimit: true } } };
  const token = queueBcuTargetSummonToken(scene, attacker, target, event, { accepted: false, bcuAttackNullified: true }, { key: 'hit-1', hitIndex: 1 });
  assert.equal(token.queued, true, 'on_hit SUMMON token survives attack-nullify result');
  const processed = processBcuSummonTokens(scene);
  assert.equal(processed.spawned, 1, 'on_hit token enqueues spawn after post-damage phase');
  assert.equal(scene.bcuSummonSpawnQueue[0].proc.scaledMult, 100, 'partial IMUSUMMON scales SUMMON.mult by (100-resist)/100');
  assert.equal(scene.bcuSummonSpawnQueue[0].x, 2480, 'on_hit summon anchors on hit target position');
}

{
  const scene = makeScene(0);
  const attacker = makeActor('kill-attacker');
  const target = makeActor('kill-target', { side: 'cat-enemy', direction: 1, x: 2400 });
  scene.actors.push(attacker, target);
  const def = summonUnitDef('summon-enemy-010', 'enemy', 10);
  scene.actorFactory.templates.set(def.slotId, { unitDef: def, loadingLevel: 'spawn-ready' });
  const event = { key: 'kill-0', hitIndex: 0, summon: { prob: 100, unitDef: def, kind: 'enemy', mult: 100, dis: 0, maxDis: 0, time: 1, type: { onKill: true, ignoreLimit: true } } };
  queueBcuTargetSummonToken(scene, attacker, target, event, { accepted: true }, { key: 'kill-0' });
  assert.equal(processBcuSummonTokens(scene).skipped, 1, 'on_kill SUMMON waits until target HP is dead');
  target.hp = 0;
  target.deathPending = true;
  const event2 = { ...event, key: 'kill-1' };
  queueBcuTargetSummonToken(scene, attacker, target, event2, { accepted: true }, { key: 'kill-1' });
  assert.equal(processBcuSummonTokens(scene).spawned, 1, 'on_kill SUMMON enqueues when post-damage target HP is zero');
}

{
  const scene = makeScene(0);
  const attacker = makeActor('full-attacker');
  const target = makeActor('full-target', { side: 'cat-enemy', direction: 1, x: 2300, proc: { IMUSUMMON: { mult: 100, block: 100 } } });
  scene.actors.push(attacker, target);
  const def = summonUnitDef('summon-enemy-011', 'enemy', 11);
  const event = { key: 'full-0', hitIndex: 0, summon: { prob: 100, unitDef: def, kind: 'enemy', mult: 100, dis: 0, maxDis: 0, time: 1, type: { onHit: true } } };
  queueBcuTargetSummonToken(scene, attacker, target, event, { accepted: true }, { key: 'full-0' });
  const processed = processBcuSummonTokens(scene);
  assert.equal(processed.skipped, 1, 'full IMUSUMMON blocks summon');
  assert.equal(scene.bcuSummonSpawnQueue?.length || 0, 0, 'full IMUSUMMON creates no spawn entry');
  assert.equal(target.lastBcuProcImmunityDebug?.result?.field, 'IMUSUMMON', 'full summon immunity is routed through proc immunity trace');
}

{
  const scene = makeScene(0);
  const attacker = makeActor('same-health-attacker');
  const target = makeActor('same-health-target', { side: 'cat-enemy', direction: 1, x: 2200, hp: 37 });
  target.hp = 37;
  scene.actors.push(attacker, target);
  const def = summonUnitDef('summon-enemy-012', 'enemy', 12);
  scene.actorFactory.templates.set(def.slotId, { unitDef: def, loadingLevel: 'spawn-ready' });
  const event = { key: 'same-0', hitIndex: 0, summon: { prob: 100, unitDef: def, kind: 'enemy', mult: 100, dis: 0, maxDis: 0, time: 1, type: { onHit: true, sameHealth: true, ignoreLimit: true } } };
  queueBcuTargetSummonToken(scene, attacker, target, event, { accepted: true }, { key: 'same-0' });
  processBcuSummonTokens(scene);
  tickBcuSummonSpawnQueue(scene);
  assert.equal(scene.actors.at(-1).hp, 37, 'same_health copies anchor HP to spawned summon');
}

{
  const parent = makeActor('bond-parent');
  const child = makeActor('bond-child');
  linkBcuSummonBond(parent, child);
  const result = parent.takeDamage(9, { timeMs: 1 });
  assert.equal(result.accepted, true, 'bond parent accepts direct damage');
  assert.equal(child.pendingDamage, 9, 'bond_hp propagates damage to linked summon child');
}

{
  const scene = makeScene(0);
  scene.enemyMax = 1;
  const attacker = makeActor('limit-attacker');
  const existing = makeActor('existing-enemy', { side: 'cat-enemy', direction: 1, x: 2000 });
  scene.actors.push(attacker, existing);
  const def = summonUnitDef('summon-enemy-013', 'enemy', 13);
  scene.actorFactory.templates.set(def.slotId, { unitDef: def, loadingLevel: 'spawn-ready' });
  const event = { key: 'limit-0', hitIndex: 0, summon: { prob: 100, unitDef: def, kind: 'enemy', mult: 100, dis: 0, maxDis: 0, time: 1, type: { ignoreLimit: false } } };
  const queued = queueBcuImmediateSummon(scene, attacker, event, { key: 'limit-0' });
  assert.equal(queued.result.reason, 'summon-side-limit-reached', 'summon respects side max unless ignore_limit is set');
}

{
  const scene = makeScene(0);
  const attacker = makeActor('enemy-summoner', { side: 'cat-enemy', direction: 1, x: 1800 });
  scene.actors.push(attacker);
  const def = summonUnitDef('summon-unit-014', 'unit', 14);
  scene.actorFactory.templates.set(def.slotId, { unitDef: def, loadingLevel: 'spawn-ready' });
  const event = { key: 'enemy-unit-0', hitIndex: 0, summon: { prob: 100, unitDef: def, kind: 'unit', mult: 30, dis: 0, maxDis: 0, time: 1, type: { ignoreLimit: true } } };
  queueBcuImmediateSummon(scene, attacker, event, { key: 'enemy-unit-0' });
  assert.equal(scene.bcuSummonSpawnQueue[0].side, 'dog-player', 'BCU Unit summons spawn on player/unit side even when the summoner is an enemy');
}

{
  const scene = makeScene(0);
  const attacker = makeActor('unit-level-summoner', { x: 3000, stats: { bcuUnitLevel: { effectiveLevel: 5 } } });
  attacker.rawStats.bcuUnitLevel = { effectiveLevel: 5 };
  scene.actors.push(attacker);
  const def = summonUnitDef('summon-unit-015', 'unit', 15);
  scene.actorFactory.templates.set(def.slotId, { unitDef: def, loadingLevel: 'spawn-ready' });
  const event = { key: 'unit-level-0', hitIndex: 0, summon: { prob: 100, unitDef: def, kind: 'unit', mult: 10, dis: 0, maxDis: 0, time: 1, type: { ignoreLimit: true } } };
  queueBcuImmediateSummon(scene, attacker, event, { key: 'unit-level-0' });
  assert.equal(scene.bcuSummonSpawnQueue[0].proc.scaledMult, 15, 'unit summoner adds its BCU level to SUMMON.mult unless fix_buff is set');
}

{
  const scene = makeScene(0);
  const attacker = makeActor('enemy-magnification-summoner', { side: 'cat-enemy', direction: 1, x: 1800 });
  attacker.rawStats.stageMagnification = { hpMagnification: 200, attackMagnification: 150, magnification: 175 };
  scene.actors.push(attacker);
  const def = summonUnitDef('summon-enemy-016', 'enemy', 16);
  scene.actorFactory.templates.set(def.slotId, { unitDef: def, loadingLevel: 'spawn-ready' });
  const event = { key: 'enemy-mag-0', hitIndex: 0, summon: { prob: 100, unitDef: def, kind: 'enemy', mult: 100, dis: 0, maxDis: 0, time: 1, type: { ignoreLimit: true } } };
  queueBcuImmediateSummon(scene, attacker, event, { key: 'enemy-mag-0' });
  assert.equal(scene.bcuSummonSpawnQueue[0].proc.scaledHpMult, 200, 'enemy summoner passes HP magnification to enemy summon when fix_buff is false');
  assert.equal(scene.bcuSummonSpawnQueue[0].proc.scaledAttackMult, 150, 'enemy summoner passes attack magnification to enemy summon when fix_buff is false');
}

{
  const actor = makeActor('profile-actor', {
    stats: {
      attackHits: [{ hitIndex: 0, preFrames: 1, damage: 1, summon: { prob: 100, mult: 10 } }],
      isRange: false,
      detectionRange: 100,
      width: 0,
      attackCount: 1
    }
  });
  const profile = BattleAttackProfile.fromActor(actor);
  assert.equal(profile.events[0].summon.prob, 100, 'BattleAttackProfile carries per-hit SUMMON object into attack event');
}

console.log('check-bcu-summon-runtime-parity: OK');
