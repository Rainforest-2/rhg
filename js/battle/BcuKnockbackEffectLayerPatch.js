import { BattleScene } from './BattleScene.js';
import { BattleActor } from './BattleActor.js';
import { EffectRuntime } from './EffectRuntime.js';
import { BCU_BATTLE_TIMER_PERIOD_MS } from './BattleFrameClock.js';
import { parseImgcut } from '../bcu/BcuImgcutParser.js';
import { parseModel } from '../bcu/BcuModelParser.js';
import { parseAnim } from '../bcu/BcuAnimParser.js';
import { BcuModelInstance } from '../bcu/BcuModelInstance.js';
import { BcuAnimator } from '../bcu/BcuAnimator.js';
import { getBcuAssetDatabase } from '../bcu/BcuAssetDatabase.js';

const SCENE_FLAG = Symbol.for('wanko-battle.bcu-kb-effect-layer-scene.v1');
const ACTOR_FLAG = Symbol.for('wanko-battle.bcu-kb-effect-layer-actor.v1');
const BUNDLE_REF = Object.freeze({ bundleKey: 'effect:kbeff', bundlePath: 'public/assets/bundles/effect/kbeff.zip' });
const KBEFF_ANIM = Object.freeze({ INT_HB: 'kb_hb.maanim', INT_SW: 'kb_sw.maanim', INT_ASS: 'kb_ass.maanim' });
const KBEFF_SOURCE = 'bcu-effanim-kbeff-layer';
const KBEFF_SCALE = 1.0;
const KBEFF_Y_OFFSET = 75;

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image load failed:${url}`));
    img.src = url;
  });
}

async function imageFromBundle(provider, internalPath) {
  const url = await provider.createObjectUrl(BUNDLE_REF, internalPath, 'image/png');
  try {
    const image = await loadImage(url);
    image.bcuObjectUrl = url;
    return image;
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

async function loadKbeffAsset() {
  const provider = getBcuAssetDatabase()?.semanticProvider || globalThis.__BCU_DB__?.semanticProvider || null;
  if (!provider) throw new Error('semantic provider missing for effect:kbeff');
  const [imgcutText, modelText, image] = await Promise.all([
    provider.readTextByBundleRef(BUNDLE_REF, 'imgcut.imgcut'),
    provider.readTextByBundleRef(BUNDLE_REF, 'model.mamodel'),
    imageFromBundle(provider, 'image.png')
  ]);
  const imgcut = parseImgcut(imgcutText);
  const model = parseModel(modelText);
  const defs = {};
  for (const [bcuType, file] of Object.entries(KBEFF_ANIM)) {
    const animText = await provider.readTextByBundleRef(BUNDLE_REF, file);
    const anim = parseAnim(animText);
    defs[bcuType] = {
      bcuType,
      file,
      model,
      anim,
      image,
      imgcut,
      frameCount: Math.max(1, (Number(anim.maxFrame) || 0) + 1),
      maxFrame: Number(anim.maxFrame) || 0,
      source: `effect:kbeff/${file}`
    };
  }
  return { loaded: true, image, imgcut, model, defs, source: 'semantic-bundle:effect:kbeff' };
}

function makeKbeffRuntime(def) {
  const model = new BcuModelInstance(def.model);
  const animator = new BcuAnimator(def.anim);
  animator.setLoop?.(false);
  animator.restart?.();
  return { model, animator, frameCount: def.frameCount, maxFrame: def.maxFrame };
}

function actorEffectLayer(actor) {
  return Number.isFinite(Number(actor?.currentLayer)) ? Number(actor.currentLayer) : 0;
}

function spawnKbeffEffect(scene, actor, bcuType) {
  const asset = scene?.bcuKbeffEffectAsset;
  const def = asset?.defs?.[bcuType];
  if (!scene || !actor || !def || !def.image || !def.imgcut) return null;
  if (actor.__lastBcuKbeffSerial === actor.knockbackSerial) return null;
  const runtime = makeKbeffRuntime(def);
  const effect = EffectRuntime.createEffect({
    id: `bcu-kbeff-${bcuType}-${actor.instanceId || actor.label || 'actor'}-${actor.knockbackSerial || 0}`,
    type: 'kbeff',
    x: actor.x,
    y: 0,
    image: def.image,
    imgcut: def.imgcut,
    model: runtime.model,
    animator: runtime.animator,
    scale: KBEFF_SCALE,
    source: KBEFF_SOURCE,
    createdAtMs: scene.timeMs,
    layer: actorEffectLayer(actor),
    bcuSmokeYOffset: KBEFF_Y_OFFSET,
    debug: {
      source: KBEFF_SOURCE,
      bcuReference: 'BCU Entity.AnimManager.kbAnim selects KBEff.KB/SW/ASS; JS renders same kbeff maanim as layer effect without actor-parent transform',
      actor: actor.instanceId || actor.label || null,
      semanticKey: actor.semanticKey || actor.assetDef?.semanticKey || null,
      bcuType,
      worldX: actor.x,
      layer: actorEffectLayer(actor),
      frameCount: runtime.frameCount,
      maxFrame: runtime.maxFrame,
      assetSource: def.source
    }
  });
  effect.durationMs = runtime.frameCount * BCU_BATTLE_TIMER_PERIOD_MS;
  effect.frameDurationMs = BCU_BATTLE_TIMER_PERIOD_MS;
  effect.elapsedMs = -BCU_BATTLE_TIMER_PERIOD_MS;
  scene.effects.push(effect);
  actor.__lastBcuKbeffSerial = actor.knockbackSerial;
  actor.lastBcuKbeffEffectDebug = effect.effectRuntimeDebug;
  globalThis.__BCU_KBEFF_EFFECT_DEBUG__ = {
    installed: true,
    spawned: true,
    last: effect.effectRuntimeDebug,
    activeKbeffEffects: scene.effects.filter((e) => e?.source === KBEFF_SOURCE && !e.finished).length,
    note: 'KBEff is rendered as an independent BCU EffAnim layer; actor anim paraTo(back) is not yet fully implemented.'
  };
  return effect;
}

if (BattleScene?.prototype && !BattleScene.prototype[SCENE_FLAG]) {
  BattleScene.prototype[SCENE_FLAG] = true;
  const originalInit = BattleScene.prototype.init;
  BattleScene.prototype.init = async function initWithBcuKbeffLayer(...args) {
    const result = await originalInit.apply(this, args);
    try {
      this.bcuKbeffEffectAsset = await loadKbeffAsset();
      this.lastBcuKbeffEffectLoadDebug = {
        loaded: true,
        source: this.bcuKbeffEffectAsset.source,
        defs: Object.fromEntries(Object.entries(this.bcuKbeffEffectAsset.defs || {}).map(([k, d]) => [k, { file: d.file, frameCount: d.frameCount, maxFrame: d.maxFrame }]))
      };
    } catch (error) {
      this.bcuKbeffEffectAsset = null;
      this.lastBcuKbeffEffectLoadDebug = { loaded: false, reason: error?.message || String(error) };
    }
    globalThis.__BCU_KBEFF_EFFECT_LOAD_DEBUG__ = this.lastBcuKbeffEffectLoadDebug;
    return result;
  };
}

if (BattleActor?.prototype && !BattleActor.prototype[ACTOR_FLAG]) {
  BattleActor.prototype[ACTOR_FLAG] = true;
  const originalStartKnockback = BattleActor.prototype.startKnockback;
  BattleActor.prototype.startKnockback = function startKnockbackWithBcuKbeffLayer(knockback = null) {
    const result = originalStartKnockback.call(this, knockback);
    const bcuType = this.kbBcuType || this.bcuKbType || knockback?.bcuType || null;
    if (bcuType === 'INT_HB' || bcuType === 'INT_SW' || bcuType === 'INT_ASS') {
      spawnKbeffEffect(this.scene, this, bcuType);
    }
    return result;
  };
}

globalThis.__BCU_KBEFF_EFFECT_PATCH_DEBUG__ = {
  installed: true,
  source: 'BcuKnockbackEffectLayerPatch',
  supportedTypes: Object.keys(KBEFF_ANIM),
  mode: 'independent-bcu-effanim-layer-not-parent-paraTo'
};
