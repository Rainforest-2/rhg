import { BattleWaveEffectLoader, BCU_WAVE_EFFECT_BUNDLE_REF } from './BattleWaveEffectLoader.js';
import { parseImgcut } from '../bcu/BcuImgcutParser.js';
import { parseModel } from '../bcu/BcuModelParser.js';
import { parseAnim } from '../bcu/BcuAnimParser.js';

const PATCH_FLAG = Symbol.for('wanko-battle.toxic-effect-asset-loader.v1');
const TOXIC_EFFECT_KEY = 'toxic';
const TOXIC_BUNDLE_BASE = 'all-skill-effects/000001/org/battle/s8';
const TOXIC_INTERNAL = Object.freeze({
  image: `${TOXIC_BUNDLE_BASE}/skill008.png`,
  imgcut: `${TOXIC_BUNDLE_BASE}/skill008.imgcut`,
  model: `${TOXIC_BUNDLE_BASE}/skill_percentage_attack.mamodel`,
  anim: `${TOXIC_BUNDLE_BASE}/skill_percentage_attack.maanim`
});

function providerForLoader(loader) {
  return loader?.getProvider?.() || globalThis.__BCU_DB__?.semanticProvider || globalThis.__APP__?.bcuDb?.semanticProvider || globalThis.app?.bcuDb?.semanticProvider || null;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Image load failed: ${src}`));
    image.src = src;
  });
}

async function imageFromBundle(provider, bundleRef, internalPath) {
  const url = await provider.createObjectUrl(bundleRef, internalPath, 'image/png');
  try {
    const image = await loadImage(url);
    image.bcuObjectUrl = url;
    return image;
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

async function loadBcuToxicEffectDefinition(provider, bundleRef = BCU_WAVE_EFFECT_BUNDLE_REF) {
  const [image, imgcutText, modelText, animText] = await Promise.all([
    imageFromBundle(provider, bundleRef, TOXIC_INTERNAL.image),
    provider.readTextByBundleRef(bundleRef, TOXIC_INTERNAL.imgcut),
    provider.readTextByBundleRef(bundleRef, TOXIC_INTERNAL.model),
    provider.readTextByBundleRef(bundleRef, TOXIC_INTERNAL.anim)
  ]);
  const anim = parseAnim(animText);
  const maxFrame = Number(anim?.maxFrame) || 0;
  return {
    key: TOXIC_EFFECT_KEY,
    kind: 'toxic',
    direction: 1,
    image,
    imgcut: parseImgcut(imgcutText),
    model: parseModel(modelText),
    anim,
    phases: null,
    loaded: true,
    source: `semantic-bundle:${bundleRef.bundleKey}:${TOXIC_BUNDLE_BASE}`,
    frameCount: Math.max(1, maxFrame + 1),
    maxFrame,
    bcuReference: 'EffAnim.java: A_POISON = new EffAnim("./org/battle/s8/skill_percentage_attack", skill008.png, skill008.imgcut, DefEff.values())'
  };
}

export function installBattleToxicEffectAssetPatch() {
  const proto = BattleWaveEffectLoader?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;
  const originalLoadAll = proto.loadAll;

  proto.loadAll = async function loadAllWithBcuToxicEffect() {
    const assets = await originalLoadAll.call(this);
    if (assets?.[TOXIC_EFFECT_KEY]?.loaded) return assets;
    const provider = providerForLoader(this);
    if (!provider) {
      assets[TOXIC_EFFECT_KEY] = { key: TOXIC_EFFECT_KEY, kind: 'toxic', loaded: false, reason: 'missing-semantic-provider' };
      return assets;
    }
    try {
      assets[TOXIC_EFFECT_KEY] = await loadBcuToxicEffectDefinition(provider, this.bundleRef || BCU_WAVE_EFFECT_BUNDLE_REF);
    } catch (error) {
      assets[TOXIC_EFFECT_KEY] = { key: TOXIC_EFFECT_KEY, kind: 'toxic', loaded: false, reason: String(error?.message || error), internal: TOXIC_INTERNAL };
    }
    if (this.lastLoadDebug) {
      this.lastLoadDebug.assets ||= {};
      this.lastLoadDebug.assets[TOXIC_EFFECT_KEY] = {
        loaded: assets[TOXIC_EFFECT_KEY]?.loaded === true,
        reason: assets[TOXIC_EFFECT_KEY]?.reason || null,
        kind: 'toxic',
        source: assets[TOXIC_EFFECT_KEY]?.source || null,
        maxFrame: assets[TOXIC_EFFECT_KEY]?.maxFrame ?? null,
        frameCount: assets[TOXIC_EFFECT_KEY]?.frameCount ?? null
      };
    }
    return assets;
  };
}

installBattleToxicEffectAssetPatch();
