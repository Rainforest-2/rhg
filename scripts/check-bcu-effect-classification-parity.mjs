import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BCU_EFFECT_CLASS, BCU_SCALE_MODE, classifyBcuEffect, describeBcuEffectYFormula } from '../js/battle/bcu-runtime/BcuEffectTraceRuntime.js';
import { resolveBcuEffectScale } from '../js/battle/BattleSceneRendererEffectGlowPatch.js';

assert.equal(classifyBcuEffect({ bcuScaleMode: BCU_SCALE_MODE.ENTITY_STATUS }), BCU_EFFECT_CLASS.ENTITY_STATUS);
assert.equal(classifyBcuEffect({ bcuScaleMode: BCU_SCALE_MODE.STAGE_PROJECTILE }), BCU_EFFECT_CLASS.STAGE_PROJECTILE);
assert.equal(classifyBcuEffect({ bcuScaleMode: BCU_SCALE_MODE.LEGACY, leaEAnimCont: true }), BCU_EFFECT_CLASS.STAGE_BASIS_LEA_EANIMCONT);
assert.equal(describeBcuEffectYFormula({ bcuScaleMode: BCU_SCALE_MODE.ENTITY_STATUS }), 'baseY, actor drawEff/entity status baseline, no smoke offset');

const statusScale = resolveBcuEffectScale({ effect: { bcuScaleMode: BCU_SCALE_MODE.ENTITY_STATUS, scale: 0.75 }, cameraScale: 2, spriteScale: 0.8 });
assert.equal(statusScale.finalScale, 1.5);
assert.equal(statusScale.spriteScaleUsed, 0);
assert.equal(statusScale.bcuEffectClass, BCU_EFFECT_CLASS.ENTITY_STATUS);

const leaScale = resolveBcuEffectScale({ effect: { source: 'bcu-effanim-A_CRIT', scale: 1 }, cameraScale: 2, spriteScale: 0.8 });
assert.equal(leaScale.finalScale, 1.6);
assert.equal(leaScale.spriteScaleUsed, 0.8);
assert.equal(leaScale.bcuEffectClass, BCU_EFFECT_CLASS.STAGE_BASIS_LEA_EANIMCONT);

const spawner = fs.readFileSync('js/battle/BcuWaveBundleEffectSpawner.js', 'utf8');
for (const token of ['barrier', 'demonShield', 'waveInvalid', 'waveStop', 'delay', 'procInvalid']) {
  assert.ok(spawner.includes(token), `spawner knows actor-bound status type ${token}`);
}
assert.ok(spawner.includes('BCU_SCALE_MODE.ENTITY_STATUS'), 'actor-bound status visuals resolve to ENTITY_STATUS');
assert.ok(spawner.includes('statusOffsetY = mode === BCU_SCALE_MODE.ENTITY_STATUS ? 0'), 'ENTITY_STATUS forces zero y offset');
assert.ok(spawner.includes('effect.bcuEntityStatusEffect = true'), 'ENTITY_STATUS effects are marked for actor-pass renderer');
assert.ok(spawner.includes('effect.bcuTargetActorId = actorId'), 'ENTITY_STATUS effects retain their actor target id');

const proc = fs.readFileSync('js/battle/BcuProcImmunityVisualPatch.js', 'utf8');
assert.ok(proc.includes('bcuScaleMode: BCU_SCALE_MODE.ENTITY_STATUS'), 'procInvalid uses ENTITY_STATUS');
assert.ok(proc.includes('bcuSmokeYOffset: 0'), 'procInvalid y offset is zero');
assert.ok(proc.includes('scale: 0.75'), 'procInvalid default scale is 0.75');
assert.ok(proc.includes('BCU_EFFECT_CLASS.ENTITY_STATUS'), 'procInvalid debug exposes entity-status class');

const renderer = fs.readFileSync('js/battle/BattleSceneRendererEffectGlowPatch.js', 'utf8');
assert.ok(renderer.includes('isBcuEntityStatusEffect'), 'renderer classifies entity status effects');
assert.ok(renderer.includes('drawEntityStatusEffectsForActor'), 'renderer draws entity status effects during actor draw pass');
assert.ok(renderer.includes('!isBcuStageLayeredEffect(effect) && !isBcuEntityStatusEffect(effect)'), 'drawEffects skips entity status effects after actor-pass draw');
assert.ok(renderer.includes('actorPassDraw'), 'renderer debug marks actor-pass entity status draws');

console.log('check-bcu-effect-classification-parity: OK');
