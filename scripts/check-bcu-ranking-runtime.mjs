import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BattleScene } from '../js/battle/BattleScene.js';
import {
  BCU_FRAMES_PER_MINUTE,
  BcuRankingRuntime,
  calculateBcuRankingEnemyScore
} from '../js/battle/BcuRankingRuntime.js';
import '../js/battle/BattleSceneBcuRankingRuntimePatch.js';

function bases() {
  return [
    { side: 'dog-player', hp: 1000, maxHp: 1000, destroyed: false },
    { side: 'cat-enemy', hp: 1000, maxHp: 1000, destroyed: false }
  ];
}

const row = { rowIndex: 0, score: 1000 };
const normalDeadEnemy = (id = 'enemy-1') => ({
  instanceId: id,
  side: 'cat-enemy',
  hp: 0,
  isAliveFlag: false,
  deathPending: true,
  stageSpawnRowIndex: 0,
  rawStats: { rewardRaw: 100 },
  lastKilledBy: [{ amount: 100, meta: { damageCalculation: { source: 'DamageCalculator.v7-bcu-projectile-raw-attack-basis' } } }]
});

assert.equal(BCU_FRAMES_PER_MINUTE, 1800);
assert.equal(calculateBcuRankingEnemyScore({
  actor: normalDeadEnemy(),
  row,
  elapsedFrames: 900,
  timeLimitFrames: 1800
}), 1501, 'BCU formula keeps drop/100 + time-weighted row score until the final int cast');

// Pure runtime: normal death scores once; explicit non-normal modes and overtime do not.
{
  const runtime = new BcuRankingRuntime({ trail: true, timeLimit: 1 });
  const scene = { bases: bases(), stage: { runtime: { enemyRows: [row] } } };
  runtime.updateClock(900);
  const first = runtime.scoreEnemyDeath(scene, normalDeadEnemy('normal'));
  assert.equal(first.delta, 1501);
  assert.equal(runtime.score, 1501);
  assert.equal(runtime.scoreEnemyDeath(scene, normalDeadEnemy('normal')), null, 'same actor scores only once');

  const self = normalDeadEnemy('self');
  self.bcuKillMode = 'SELF_DESTRUCT';
  assert.equal(runtime.scoreEnemyDeath(scene, self), null);
  assert.equal(runtime.score, 1501);

  runtime.updateClock(1800);
  assert.equal(runtime.overtime, false, 'BCU overtime is strict timeLimitFrames - time < 0');
  runtime.updateClock(1801);
  assert.equal(runtime.overtime, true);
  assert.equal(runtime.scoreEnemyDeath(scene, normalDeadEnemy('late')), null);
}

// Score-limit loss is applied only after overtime and only when the parsed limit is unmet.
{
  const runtime = new BcuRankingRuntime({ trail: true, timeLimit: 1, scoreLimit: 5000 });
  const scene = { bases: bases() };
  runtime.updateClock(1801);
  assert.equal(runtime.enforceOvertimeLoss(scene), true);
  assert.equal(scene.bases[0].hp, 0);
  assert.equal(scene.bases[0].destroyed, true);
  assert.equal(runtime.failedScoreLimit, true);
}

// Non-trail stages are unchanged.
{
  const runtime = new BcuRankingRuntime({ trail: false, timeLimit: 1 });
  const scene = { bases: bases(), stage: { runtime: { enemyRows: [row] } } };
  runtime.updateClock(999999);
  assert.equal(runtime.overtime, false);
  assert.equal(runtime.scoreEnemyDeath(scene, normalDeadEnemy('non-trail')), null);
  assert.equal(runtime.enforceOvertimeLoss(scene), false);
}

// Installed production path: phased clock/death hooks update score and the spawn wrapper stops at overtime.
{
  const scene = new BattleScene(() => {}, {});
  scene.stage.runtime = { sourcePath: 'ranking.csv', trail: true, timeLimit: 1, enemyRows: [row] };
  scene.bases = bases();
  scene.actors = [normalDeadEnemy('installed')];
  scene.logicFrame = 900;
  scene.runTickPhase('advance-clock', () => {});
  scene.runTickPhase('knockback-death', () => {});
  assert.equal(scene.getBcuRankingRuntime().score, 1501);
  assert.equal(scene.getBcuRankingRuntimeDebug().lastScoreEvent.actorId, 'installed');

  let spawnCalls = 0;
  const protoSpawn = BattleScene.prototype.tickStageEnemySpawn;
  scene.logicFrame = 1801;
  scene.getBcuRankingRuntime().updateClock(scene.logicFrame);
  scene.tickStageEnemySpawn = protoSpawn.bind({
    ...scene,
    stage: scene.stage,
    bases: scene.bases,
    logicFrame: scene.logicFrame,
    bcuRankingRuntime: scene.bcuRankingRuntime,
    bcuRankingRuntimeStageIdentity: scene.bcuRankingRuntimeStageIdentity,
    pushEvent: () => {},
    stageSpawnRuntime: { tick: () => { spawnCalls += 1; return []; } }
  });
  scene.tickStageEnemySpawn();
  assert.equal(spawnCalls, 0, 'overtime blocks enemy spawn before any runtime/RNG work');
}

const bootGroup = readFileSync('js/boot/groups/battleScenePatches.js', 'utf8');
assert.ok(bootGroup.includes('BattleSceneBcuRankingRuntimePatch.js'));

console.log('check-bcu-ranking-runtime: OK');
