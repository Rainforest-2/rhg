import assert from 'node:assert/strict';
import { BattleScene } from '../js/battle/BattleScene.js';

const calc = {
  bcuProjectileBaseDamage: 1000,
  rawAttackDamage: 1000,
  proc: {
    pending: [{ key: 'wave', payload: { level: 2 }, hitIndex: 0, attackEventKey: 'hit' }],
    applied: [],
    skipped: [],
    notes: []
  }
};

BattleScene.prototype.queueAttackDamage = function fakeQueueAttackDamage(attacker, target, targetType, event, meta = {}) {
  attacker.lastDamageCalculation = event.calc;
  target.lastIncomingDamageCalculation = event.calc;
  return { accepted: false, blocked: true, blockedBy: event.blockedBy, reason: `${event.blockedBy}-blocked` };
};

await import('../js/battle/BattleWaveRuntimePatch.js');
await import('../js/battle/BattleSceneBcuWaveOnBlockedHitPatch.js');

function makeScene() {
  const events = [];
  return Object.assign(Object.create(BattleScene.prototype), {
    logicFrame: 10,
    timeMs: 330,
    __bcuWaveContainers: [],
    pushEvent(event) { events.push(event); },
    events
  });
}

function makeAttacker() {
  return { instanceId: 'atk', side: 'dog-player', direction: -1, x: 1000, posBcu: 1000, currentLayer: 4, damage: 1000 };
}

function makeTarget() {
  return { instanceId: 'target', side: 'cat-enemy', x: 750, posBcu: 750, currentLayer: 3 };
}

for (const blockedBy of ['barrier', 'shield']) {
  const scene = makeScene();
  const attacker = makeAttacker();
  const target = makeTarget();
  const result = scene.queueAttackDamage(attacker, target, 'actor', { damage: 1000, calc, blockedBy }, { key: `hit-${blockedBy}`, hitIndex: 0 });
  assert.equal(result.accepted, false, `${blockedBy} fixture blocks damage`);
  assert.equal(scene.__bcuWaveContainers.length, 1, `${blockedBy} blocked hit still creates a wave`);
  const wave = scene.__bcuWaveContainers[0];
  assert.equal(wave.kind, 'wave', `${blockedBy} creates WAVE item`);
  assert.equal(wave.remainingLevel, 1, `${blockedBy} preserves wave level chain`);
  assert.equal(wave.layer, 4, `${blockedBy} wave layer comes from attacker/model layer`);
  assert.equal(scene.events.some((e) => e.type === 'bcuWaveCreatedFromBlockedHit' && e.bcuReference.includes('AttackSimple.excuse')), true, `${blockedBy} emits BCU evidence trace`);
}

console.log('check-bcu-wave-on-barrier-shield-block-parity: OK');
