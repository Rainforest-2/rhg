import { BattleScene } from './BattleScene.js';
import { BattleActor } from './BattleActor.js';
import { parseModel } from '../bcu/BcuModelParser.js';
import { parseAnim } from '../bcu/BcuAnimParser.js';
import { BcuKbeffRuntime } from './BcuKbeffRuntime.js';
import { getBcuAssetDatabase } from '../bcu/BcuAssetDatabase.js';

const SCENE_FLAG = Symbol.for('wanko-battle.bcu-kb-parato-scene.v1');
const ACTOR_FLAG = Symbol.for('wanko-battle.bcu-kb-parato-actor.v1');
const BUNDLE_REF = Object.freeze({ bundleKey: 'effect:kbeff', bundlePath: 'public/assets/bundles/effect/kbeff.zip' });
const KBEFF_ANIM = Object.freeze({ INT_HB: 'kb_hb.maanim', INT_SW: 'kb_sw.maanim', INT_ASS: 'kb_ass.maanim' });

async function loadKbeffParaToAsset() {
  const provider = getBcuAssetDatabase()?.semanticProvider || globalThis.__BCU_DB__?.semanticProvider || null;
  if (!provider) throw new Error('semantic provider missing for effect:kbeff');
  const model = parseModel(await provider.readTextByBundleRef(BUNDLE_REF, 'model.mamodel'));
  const defs = {};
  for (const [bcuType, file] of Object.entries(KBEFF_ANIM)) {
    const anim = parseAnim(await provider.readTextByBundleRef(BUNDLE_REF, file));
    defs[bcuType] = {
      bcuType,
      file,
      model,
      anim,
      frameCount: Math.max(1, (Number(anim.maxFrame) || 0) + 1),
      maxFrame: Number(anim.maxFrame) || 0,
      source: `effect:kbeff/${file}`
    };
  }
  return { loaded: true, defs, source: 'semantic-bundle:effect:kbeff parato runtime' };
}

function attachParaToRuntime(actor, bcuType) {
  const asset = actor?.scene?.bcuKbeffParaToAsset;
  const def = asset?.defs?.[bcuType];
  if (!actor || !def) return false;
  if (actor.__lastBcuKbeffParaToSerial === actor.knockbackSerial) return true;
  const runtime = new BcuKbeffRuntime(def);
  runtime.reset();
  // BCU KBManager.doInterrupt(): kb.anim.kbAnim(); kb.anim.update();
  // AnimManager.kbAnim() advances KBEff once at start for non-warp KB, so mirror it.
  runtime.stepFrame();
  actor.kbeffRuntime = runtime;
  actor.kbeffEnabled = true;
  actor.kbeffType = bcuType;
  actor.kbeffSource = 'BCU EAnimD.paraTo(back.ent[1]) emulation using KBEff part1 graphicsMatrix';
  actor.updateKbeffTransform?.();
  actor.__lastBcuKbeffParaToSerial = actor.knockbackSerial;
  actor.lastBcuKbeffParaToDebug = {
    source: 'BcuKnockbackEffectLayerPatch.attachParaToRuntime',
    mode: 'actor-parent-transform-parato',
    bcuReference: 'EAnimD.paraTo(back): ent[0].setPara(back.ent[1])',
    bcuType,
    frameCount: def.frameCount,
    maxFrame: def.maxFrame,
    parentTransform: actor.kbeffParentTransform || null,
    note: 'No independent effect is spawned; the actor drawList receives parentMatrix like BCU paraTo.'
  };
  globalThis.__BCU_KBEFF_EFFECT_DEBUG__ = {
    installed: true,
    mode: 'actor-parent-transform-parato',
    last: actor.lastBcuKbeffParaToDebug,
    note: 'This replaces the earlier independent layer effect because BCU modifies actor part hierarchy.'
  };
  return true;
}

if (BattleScene?.prototype && !BattleScene.prototype[SCENE_FLAG]) {
  BattleScene.prototype[SCENE_FLAG] = true;
  const originalInit = BattleScene.prototype.init;
  BattleScene.prototype.init = async function initWithBcuKbeffParaTo(...args) {
    const result = await originalInit.apply(this, args);
    try {
      this.bcuKbeffParaToAsset = await loadKbeffParaToAsset();
      this.lastBcuKbeffEffectLoadDebug = {
        loaded: true,
        source: this.bcuKbeffParaToAsset.source,
        defs: Object.fromEntries(Object.entries(this.bcuKbeffParaToAsset.defs || {}).map(([k, d]) => [k, { file: d.file, frameCount: d.frameCount, maxFrame: d.maxFrame }]))
      };
    } catch (error) {
      this.bcuKbeffParaToAsset = null;
      this.lastBcuKbeffEffectLoadDebug = { loaded: false, reason: error?.message || String(error) };
    }
    globalThis.__BCU_KBEFF_EFFECT_LOAD_DEBUG__ = this.lastBcuKbeffEffectLoadDebug;
    return result;
  };
}

if (BattleActor?.prototype && !BattleActor.prototype[ACTOR_FLAG]) {
  BattleActor.prototype[ACTOR_FLAG] = true;
  const originalStartKnockback = BattleActor.prototype.startKnockback;
  BattleActor.prototype.startKnockback = function startKnockbackWithBcuKbeffParaTo(knockback = null) {
    const result = originalStartKnockback.call(this, knockback);
    const bcuType = this.kbBcuType || this.bcuKbType || knockback?.bcuType || null;
    if (bcuType === 'INT_HB' || bcuType === 'INT_SW' || bcuType === 'INT_ASS') {
      attachParaToRuntime(this, bcuType);
    }
    return result;
  };
}

globalThis.__BCU_KBEFF_EFFECT_PATCH_DEBUG__ = {
  installed: true,
  source: 'BcuKnockbackEffectLayerPatch',
  supportedTypes: Object.keys(KBEFF_ANIM),
  mode: 'actor-parent-transform-parato'
};
