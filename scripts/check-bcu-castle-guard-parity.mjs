import assert from 'node:assert/strict';
import { BattleBase } from '../js/battle/BattleBase.js';
import '../js/battle/BattleSceneBcuCastleGuardPatch.js';
import {
  BCU_CASTLE_GUARD_ACTIVE,
  BCU_CASTLE_GUARD_ARMED,
  initializeBcuCastleGuard,
  tickBcuCastleGuard
} from '../js/battle/bcu-runtime/BcuCastleGuardRuntime.js';

function base() {
  return new BattleBase({ id: 'enemy-base', side: 'cat-enemy', label: 'Enemy Base', x: 800, y: 0, maxHp: 1000 });
}

const enemyBase = base();
const scene = {
  logicFrame: 0,
  timeMs: 0,
  stage: { runtime: { bossGuard: 1 } },
  bases: [enemyBase],
  actors: [],
  effects: [],
  waveEffectAssets: {
    enemyWaveGuard: {
      loaded: true,
      image: {},
      imgcut: { parts: [] },
      model: { parts: [] },
      phases: {
        none: { tracks: [], maxFrame: 3 },
        breaker: { tracks: [], maxFrame: 4 }
      },
      kind: 'waveGuard',
      source: 'test:enemy-wave-guard'
    }
  },
  pushEvent(event) { (this.events ||= []).push(event); },
  ensureWaveEffectLoading() {}
};

initializeBcuCastleGuard(scene);
assert.equal(scene.bcuCastleGuard.activeGuard, BCU_CASTLE_GUARD_ARMED, 'bossGuard initializes StageBasis.activeGuard equivalent to armed');

scene.actors.push({ side: 'cat-enemy', bossFlag: 1, hp: 100, state: 'move', isAlive: () => true, isTargetable: () => true, anim: { dead: -1 } });
tickBcuCastleGuard(scene);
assert.equal(scene.bcuCastleGuard.activeGuard, BCU_CASTLE_GUARD_ACTIVE, 'guarded boss activates activeGuard');
assert.equal(enemyBase.bcuCastleGuardState, undefined, 'guard state is not an actor proc status');

const held = enemyBase.takeDamage(250, { scene, timeMs: 0 });
assert.equal(held.accepted, false, 'active guard rejects base damage');
assert.equal(held.blockedBy, 'castleGuard', 'damage hold reports castleGuard block');
assert.equal(enemyBase.hp, 1000, 'base HP does not decrease while guard active');
assert.equal(scene.effects.at(-1).effectRuntimeDebug.effectKey, 'enemyWaveGuard', 'hold visual uses enemy-wave-guard alias');
assert.equal(scene.effects.at(-1).effectRuntimeDebug.phase, 'none', 'hold visual uses A_E_GUARD NONE phase');

scene.actors = [];
tickBcuCastleGuard(scene);
assert.equal(scene.bcuCastleGuard.activeGuard, BCU_CASTLE_GUARD_ARMED, 'boss disappearance breaks guard back to armed state');
assert.equal(scene.effects.at(-1).effectRuntimeDebug.phase, 'breaker', 'break visual uses A_E_GUARD BREAK phase');

const damaged = enemyBase.takeDamage(250, { scene, timeMs: 33 });
assert.equal(damaged.accepted !== false, true, 'damage passes after guard break');
assert.equal(enemyBase.hp, 750, 'base HP decreases after guard break');

console.log('check-bcu-castle-guard-parity: OK');
