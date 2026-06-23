// Deterministic check: a real BCU custom-pack proc-object FILE is discovered,
// loaded, and threaded end to end into the SUMMON runtime.
//
// BCU facts:
// - battle/data/CustomEntity.java: `AtkDataModel[] atks`, each carrying a `proc`.
// - util/Data.java SUMMON @Order layout (prob/id/form/mult/dis/max_dis/min_layer/
//   max_layer/time/tba/type{anim_type,ignore_limit,fix_buff,same_health,bond_hp,
//   on_hit,on_kill}) and AtkModelEntity#setProc copies SUMMON from the per-hit proc.
// - pack/Identifier.java fields cls/pack/id; DEF pack "000000".
//
// This check loads scripts/fixtures/bcu-custom-pack/summon-proc-object.json from
// disk, runs the exact loader BattleActorFactory.resolveTemplateStats uses
// (attachBcuProcObjectSummonsToAttackHits), proves BattleAttackProfile carries the
// per-hit SUMMON, and drives the immediate + on_hit spawn handoffs to a spawned
// actor. It does NOT invent a CSV holder: the data source is the proc-object file.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { BattleActor } from '../js/battle/BattleActor.js';
import { BattleAttackProfile } from '../js/battle/BattleAttackProfile.js';
import { getBcuSummonStageAllowForScene } from '../js/battle/BattleSceneBcuStageSpawnPatch.js';
import '../js/battle/BattleSceneBcuSummonPatch.js';
import {
  attachBcuProcObjectSummonsToAttackHits,
  normalizeBcuSummonProc,
  queueBcuImmediateSummon,
  queueBcuTargetSummonToken,
  processBcuSummonTokens,
  tickBcuSummonSpawnQueue
} from '../js/battle/bcu-runtime/BcuSummonRuntime.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, 'fixtures', 'bcu-custom-pack', 'summon-proc-object.json');
const procObject = JSON.parse(readFileSync(fixturePath, 'utf8'));

// --- 1. real proc-object file -> loader -> attackHits ------------------------
assert.ok(Array.isArray(procObject.atks) && procObject.atks.length === 2, 'fixture carries CustomEntity.atks[]');
assert.ok(procObject.atks[0]?.proc?.SUMMON, 'fixture atk[0].proc.SUMMON holder is present (no CSV column invented)');

const baseStats = {
  hp: 100,
  damage: 10,
  attackHits: [
    { hitIndex: 0, preFrames: 1, damage: 10 },
    { hitIndex: 1, preFrames: 6, damage: 10 }
  ],
  bcuCombatModel: { kind: 'unit', proc: {}, immunity: {} }
};

const loaded = attachBcuProcObjectSummonsToAttackHits(baseStats, procObject, { attacker: null });
assert.equal(loaded.bcuSummonProcObjectLoader?.applied, true, 'loader records it applied real proc-object SUMMON data');
assert.equal(loaded.attackHits[0].summon?.prob, 100, 'hit 0 receives the loaded SUMMON holder');
assert.equal(loaded.attackHits[0].bcuSummonLoader?.source, 'BCU CustomEntity.atks[].proc.SUMMON', 'loader stamps BCU source per hit');
assert.equal(loaded.attackHits[1].summon?.type?.on_hit, true, 'hit 1 retains BCU on_hit type bit from file');

const summon0 = normalizeBcuSummonProc(loaded.attackHits[0].summon, { attacker: null });
const summon1 = normalizeBcuSummonProc(loaded.attackHits[1].summon, { attacker: null });
assert.equal(summon0.kind, 'unit', 'Identifier cls Unit resolves to a unit summon from file');
assert.equal(summon0.statsId, 7, 'unit summon resolves Identifier id 7 from file');
assert.equal(summon0.dis, 100, 'loaded SUMMON.dis read from file');
assert.equal(summon0.maxDis, 150, 'loaded SUMMON.max_dis read from file');
assert.equal(summon1.kind, 'enemy', 'Identifier cls Enemy resolves to an enemy summon from file');
assert.equal(summon1.statsId, 9, 'enemy summon resolves Identifier id 9 from file');
assert.equal(summon1.type.onHit, true, 'normalized on_hit trigger survives the file load');

// --- 2. loaded stats -> BattleAttackProfile per-hit summon events ------------
function summonUnitDef(slotId, statsType, statsId) {
  return {
    slotId, label: slotId, assetId: slotId, assetDef: { id: slotId },
    statsType, statsId,
    side: statsType === 'unit' ? 'dog-player' : 'cat-enemy',
    direction: statsType === 'unit' ? -1 : 1, facing: statsType === 'unit' ? -1 : 1,
    renderFlipX: false, idleAnimId: 'anim01', moveAnimId: 'anim00',
    attackAnimId: 'anim02', knockbackAnimId: 'anim03', collisionRadius: 44, scale: 1
  };
}

function makeActor(id, { side = 'dog-player', x = 3000, direction = -1, hp = 100, stats = {} } = {}) {
  const actor = new BattleActor({
    assetDef: { id }, sprite: null, model: { parts: [] }, side, x, y: 0, direction, facing: direction,
    stats: {
      hp, damage: 10, speed: 0, detectionRange: 100, range: 100, width: 40,
      bcuCombatModel: { kind: side === 'dog-player' ? 'unit' : 'enemy', proc: {}, immunity: {} }, ...stats
    },
    animations: {
      anim00: { tracks: [], maxFrame: 1 }, anim01: { tracks: [], maxFrame: 1 },
      anim02: { tracks: [], maxFrame: 6 }, anim03: { tracks: [], maxFrame: 3 }
    },
    attackAnimId: 'anim02'
  });
  actor.instanceId = id; actor.slotId = id; actor.currentLayer = 2; actor.spawnLayer = 3; actor.posBcu = x;
  return actor;
}

const profileActor = makeActor('profile-summoner', { stats: { ...baseStats, attackHits: loaded.attackHits, isRange: false, attackCount: 2 } });
const profile = BattleAttackProfile.fromActor(profileActor);
assert.equal(profile.events[0].summon?.prob, 100, 'BattleAttackProfile carries loaded SUMMON into hit-0 event');
assert.equal(profile.events[1].summon?.type?.on_hit, true, 'BattleAttackProfile carries on_hit SUMMON into hit-1 event');

// --- 3. file-loaded summons drive the spawn handoff -------------------------
function makeScene(seed = 0) {
  const scene = {
    logicFrame: 10, timeMs: 333, actors: [], bases: [{ side: 'dog-player' }, { side: 'cat-enemy' }],
    stage: { runtime: { stageLen: 4000 } }, actorGroundY: 0, debugEvents: [], actorSerial: 0,
    bcuSummonUnitDefs: new Map(), bcuSummonEnemyDefs: new Map(),
    getBcuRandom() { return () => seed; },
    getEffectiveEnemyMaxCount() { return 15; },
    actorFactory: {
      templates: new Map(),
      preloadTemplate(unitDef) { this.templates.set(unitDef.slotId, { unitDef, loadingLevel: 'spawn-ready' }); return Promise.resolve(this.templates.get(unitDef.slotId)); }
    },
    spawnActor(unitDef, side, _isPlayerProduced, options = {}) {
      if (!this.actorFactory.templates.has(unitDef.slotId)) return null;
      const actor = makeActor(`${unitDef.slotId}-${++this.actorSerial}`, { side, x: options.x, direction: unitDef.direction, hp: 120 });
      actor.slotId = unitDef.slotId; actor.currentLayer = options.currentLayer ?? 0; this.actors.push(actor);
      return actor;
    },
    pushEvent(event) { this.debugEvents.push(event); },
    getBcuSummonStageAllow(args) { return getBcuSummonStageAllowForScene(this, args); }
  };
  return scene;
}

function registerSummonTarget(scene, unitDef) {
  const kind = unitDef.statsType;
  const map = kind === 'unit' ? scene.bcuSummonUnitDefs : scene.bcuSummonEnemyDefs;
  map.set(`${kind}:${unitDef.statsId}:f`, unitDef);
  map.set(`${kind}:${unitDef.statsId}`, unitDef);
  scene.actorFactory.templates.set(unitDef.slotId, { unitDef, loadingLevel: 'spawn-ready' });
}

{
  const scene = makeScene(0);
  const attacker = makeActor('file-summoner', { x: 3000, direction: -1 });
  scene.actors.push(attacker);
  registerSummonTarget(scene, summonUnitDef('file-summon-unit-007', 'unit', 7));
  const event0 = { ...profile.events[0], key: 'hit-0', hitIndex: 0 };
  const immediate = queueBcuImmediateSummon(scene, attacker, event0, { key: 'hit-0', hitIndex: 0 });
  assert.equal(immediate.queued, true, 'file-loaded immediate (ignore_limit) SUMMON queues a unit spawn');
  const ticked = tickBcuSummonSpawnQueue(scene);
  assert.equal(ticked.spawned, 1, 'file-loaded immediate SUMMON spawns after its time delay');
  assert.equal(scene.actors.at(-1).bcuIsSummoned, true, 'spawned actor from file-loaded SUMMON is marked summoned');
  assert.equal(scene.actors.at(-1).side, 'dog-player', 'Unit-Identifier file summon spawns on the unit side');
}

{
  const scene = makeScene(0);
  const attacker = makeActor('file-hit-summoner', { x: 3000, direction: -1 });
  const target = makeActor('file-hit-target', { side: 'cat-enemy', direction: 1, x: 2500 });
  scene.actors.push(attacker, target);
  registerSummonTarget(scene, summonUnitDef('file-summon-enemy-009', 'enemy', 9));
  const event1 = { ...profile.events[1], key: 'hit-1', hitIndex: 1 };
  const token = queueBcuTargetSummonToken(scene, attacker, target, event1, { accepted: true }, { key: 'hit-1', hitIndex: 1 });
  assert.equal(token.queued, true, 'file-loaded on_hit SUMMON queues an invokeLater token');
  const processed = processBcuSummonTokens(scene);
  assert.equal(processed.spawned, 1, 'file-loaded on_hit token enqueues a spawn after the post-damage phase');
  // SUMMON.time=2 from the file means the spawn lands two actor-state-update ticks later.
  tickBcuSummonSpawnQueue(scene);
  tickBcuSummonSpawnQueue(scene);
  assert.equal(scene.actors.some((a) => a.bcuIsSummoned && a.side === 'cat-enemy'), true, 'Enemy-Identifier file summon spawns on the enemy side anchored on the hit target');
}

console.log('check-bcu-summon-procobject-loader-parity: OK');
