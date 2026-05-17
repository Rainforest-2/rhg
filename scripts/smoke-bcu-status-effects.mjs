import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { SemanticAssetProvider } from '../js/bcu/SemanticAssetProvider.js';
import { BcuProcRuntime } from '../js/battle/bcu-runtime/BcuProcRuntime.js';
import { BcuStatusEffectManager } from '../js/battle/bcu-runtime/BcuStatusEffectManager.js';
import { PHASE_A_STATUS_EFFECT_KEYS } from '../js/battle/bcu-runtime/BcuStatusEffectSpec.js';
import { getBcuStatusSnapshot } from '../js/battle/bcu-runtime/BcuStatusSnapshot.js';
import { resolveStatusIcons } from '../js/battle/bcu-runtime/BcuStatusIconResolver.js';
import { getBcuStatusEffectPosition } from '../js/battle/bcu-runtime/BcuStatusEffectPositioner.js';
import { findBySuffix } from './build-bcu-status-effect-bundle.mjs';

function iconKeys(actor) {
  return resolveStatusIcons(actor, { timeMs: 0, logicFrame: 1 }).filter((x) => !x.suppressed).map((x) => x.effectKey);
}

const inventory = JSON.parse(await fs.readFile('public/assets/generated/bcu-status-effect-inventory.json', 'utf8'));
for (const key of PHASE_A_STATUS_EFFECT_KEYS) {
  assert.equal(inventory[key]?.resolved, true, `${key} resolved`);
  assert.equal(inventory[key]?.ambiguous, false, `${key} not ambiguous`);
}

{
  const files = [
    'public/assets/bcu/100000/org/battle/s3/seal/seal.png',
    'public/assets/bcu/000001/org/battle/s3/seal/seal.png'
  ];
  const found = findBySuffix(files, 'org/battle/s3/seal/seal.png');
  assert.equal(found.selected.packId, '000001', 'suffix match selects 000001');
  assert.equal(found.ambiguous, false);
}

{
  const files = [
    'public/assets/bcu/100000/org/battle/s3/seal/seal.png',
    'public/assets/bcu/100001/org/battle/s3/seal/seal.png'
  ];
  const found = findBySuffix(files, 'org/battle/s3/seal/seal.png');
  assert.equal(found.ambiguous, true, 'suffix match reports ambiguous without 000001');
}

const provider = await new SemanticAssetProvider().load();
assert.equal(typeof provider.readTextByBundleRef, 'function');
assert.equal(typeof provider.readBlobByBundleRef, 'function');
const stopText = await provider.readTextByBundleRef({ bundleKey: 'effect:status', bundlePath: 'public/assets/bundles/effect/status-effects.zip' }, 'A_STOP/model.mamodel');
assert.match(stopText, /\[(modelanim:model|mamodel)/);
const stopBlob = await provider.readBlobByBundleRef({ bundleKey: 'effect:status', bundlePath: 'public/assets/bundles/effect/status-effects.zip' }, 'A_STOP/image.png', 'image/png');
assert.equal(stopBlob.type, 'image/png');

{
  const actor = {
    bcuProcStatuses: {
      freeze: { framesRemaining: 2 },
      slow: { untilMs: 100 },
      weaken: { remaining: 1, mult: 50 },
      curse: true,
      seal: true,
      toxic: { time: 1 },
      warp: true
    },
    isBcuProcStatusActive(key) {
      return !!this.bcuProcStatuses[key];
    }
  };
  const snap = getBcuStatusSnapshot(actor, { timeMs: 0 });
  for (const key of ['STOP', 'SLOW', 'WEAK', 'CURSE', 'SEAL', 'POISON', 'WARP']) assert.equal(snap[key].active, true, `${key} active`);
}

assert.deepEqual(iconKeys({ side: 'dog-player', bcuProcStatuses: { freeze: { framesRemaining: 1 } }, isBcuProcStatusActive: (k) => k === 'freeze' }), ['A_STOP'], 'STOP only');
assert.deepEqual(iconKeys({ side: 'dog-player', bcuProcStatuses: { slow: { framesRemaining: 1 } }, isBcuProcStatusActive: (k) => k === 'slow' }), ['A_SLOW'], 'SLOW only');
assert.deepEqual(iconKeys({ side: 'dog-player', bcuProcStatuses: { freeze: { framesRemaining: 1 }, slow: { framesRemaining: 1 } }, isBcuProcStatusActive: (k) => k === 'freeze' || k === 'slow' }), ['A_STOP'], 'STOP suppresses SLOW');
assert.deepEqual(iconKeys({ side: 'dog-player', bcuProcStatuses: { curse: true, seal: true }, isBcuProcStatusActive: (k) => k === 'curse' || k === 'seal' }), ['A_SEAL'], 'SEAL suppresses CURSE');
assert.deepEqual(iconKeys({ state: 'dead', side: 'dog-player', bcuProcStatuses: { freeze: true }, isAlive: () => false, isBcuProcStatusActive: (k) => k === 'freeze' }), [], 'dead suppresses icons');
assert.deepEqual(iconKeys({ side: 'dog-player', bcuProcStatuses: { freeze: true, warp: true }, isBcuProcStatusActive: (k) => k === 'freeze' || k === 'warp' }), [], 'warp suppresses icons');

{
  const actor = { side: 'dog-player', bcuProcStatuses: { freeze: { framesRemaining: 1 } }, isBcuProcStatusActive: (k) => k === 'freeze' };
  const manager = new BcuStatusEffectManager(actor, { timeMs: 0, logicFrame: 1, bcuDb: { semanticProvider: provider } });
  manager.updateStatusSnapshot();
  manager.resolveEffects();
  manager.ensureEffect('A_STOP', 'DEF', 0);
  manager.removeEffect(0);
  manager.updateEffects(1000 / 30);
  assert(manager.getRenderableEffects().length >= 1, 'manager returns renderable status slots');
}

{
  const runtime = new BcuProcRuntime();
  for (const [method, key] of [['applyStop', 'freeze'], ['applySlow', 'slow'], ['applyCurse', 'curse']]) {
    const calls = [];
    const result = runtime[method]({ target: { applyBcuProc: (item) => { calls.push(item); return { applied: true }; } }, proc: { payload: { timeFrames: 30 } } });
    assert.equal(result.applied, true, `${method} applied true`);
    assert.equal(calls[0].key, key);
  }
}

{
  const actor = {
    x: 100,
    y: 500,
    scale: 1,
    sprite: { imgcut: { parts: [{ x: 0, y: 0, w: 40, h: 80 }] } },
    model: { getBattleDrawList: () => [{ index: 0, partIndex: 0, imgcutIndex: 0, opacity: 1, matrix: [1, 0, 0, 1, -20, -80], pivotX: 0, pivotY: 0 }] }
  };
  const renderer = {
    projectBattleX: (scene, x) => x,
    getEntityRenderY: (scene, a, y) => y,
    getEntityRenderScale: () => 1,
    getCameraScale: () => 1,
    getActorGroundAnchorLocalY: () => 0,
    getBattleDrawListLocalBounds(a, drawList) {
      const p = drawList[0];
      return { left: p.matrix[4], top: p.matrix[5], right: p.matrix[4] + 40, bottom: p.matrix[5] + 80, width: 40, height: 80 };
    }
  };
  const pos = getBcuStatusEffectPosition({ renderer, scene: {}, actor, iconIndex: 0 });
  assert.equal(pos.rendered, true);
  assert(Number.isFinite(pos.x) && Number.isFinite(pos.y), 'position finite');
}

console.log('BCU status effect smoke passed');
