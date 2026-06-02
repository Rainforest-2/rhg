import { parseImgcut } from '../bcu/BcuImgcutParser.js';
import { parseModel } from '../bcu/BcuModelParser.js';
import { parseAnim } from '../bcu/BcuAnimParser.js';

export const BCU_SOUL_EFFECT_BUNDLE_REF = Object.freeze({
  bundleKey: 'effect:soul',
  bundlePath: 'public/assets/bundles/effect/soul.zip'
});

function soulEntry(id) {
  const id3 = String(Math.max(0, Math.trunc(Number(id) || 0))).padStart(3, '0');
  return { key: `soul-${id3}`, kind: 'deathSoul', soulId: Number(id3), bundleDir: `soul-${id3}` };
}

const SOUL_EFFECT_ENTRIES = Object.freeze({
  ...Object.fromEntries(Array.from({ length: 13 }, (_, id) => {
    const entry = soulEntry(id);
    return [entry.key, entry];
  })),
  demonSoulEnemy: { key: 'demonSoulEnemy', kind: 'demonSoul', soulId: 'demon-enemy', bundleDir: 'demon-soul-enemy' },
  demonSoulUnit: { key: 'demonSoulUnit', kind: 'demonSoul', soulId: 'demon-unit', bundleDir: 'demon-soul-unit' }
});

function getGlobalSemanticProvider() {
  return globalThis.__BCU_DB__?.semanticProvider || globalThis.app?.bcuDb?.semanticProvider || globalThis.__APP__?.bcuDb?.semanticProvider || null;
}

async function loadImageFromBundle(provider, bundleRef, internalPath) {
  const url = await provider.createObjectUrl(bundleRef, internalPath, 'image/png');
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Image load failed: ${internalPath}`));
      img.src = url;
    });
    image.bcuObjectUrl = url;
    return image;
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

function parseSoulDefinition(def, { image, imgcutText, modelText, animText, source }) {
  const anim = parseAnim(animText);
  const maxFrame = Number(anim?.maxFrame) || 0;
  return {
    key: def.key,
    kind: def.kind,
    soulId: def.soulId,
    image,
    imgcut: parseImgcut(imgcutText),
    model: parseModel(modelText),
    anim,
    loaded: true,
    source,
    maxFrame,
    frameCount: Math.max(1, maxFrame + 1)
  };
}

export class BcuSoulEffectLoader {
  constructor(options = {}) {
    this.provider = options.semanticProvider || null;
    this.bundleRef = options.bundleRef || BCU_SOUL_EFFECT_BUNDLE_REF;
    this.entries = options.entries || SOUL_EFFECT_ENTRIES;
    this.lastLoadDebug = null;
  }

  getProvider() {
    return this.provider || getGlobalSemanticProvider();
  }

  async loadDefinitionFromBundle(provider, def) {
    const base = def.bundleDir;
    const [image, imgcutText, modelText, animText] = await Promise.all([
      loadImageFromBundle(provider, this.bundleRef, `${base}/image.png`),
      provider.readTextByBundleRef(this.bundleRef, `${base}/imgcut.imgcut`),
      provider.readTextByBundleRef(this.bundleRef, `${base}/model.mamodel`),
      provider.readTextByBundleRef(this.bundleRef, `${base}/anim.maanim`)
    ]);
    return parseSoulDefinition(def, { image, imgcutText, modelText, animText, source: `semantic-bundle:${this.bundleRef.bundleKey}:${base}` });
  }

  async loadAll() {
    const provider = this.getProvider();
    const assets = {};
    const errors = [];
    const mode = provider ? 'semantic-bundle' : 'semantic-bundle-missing-provider';
    for (const [key, def] of Object.entries(this.entries)) {
      try {
        if (!provider) throw new Error(`Missing semantic provider for effect bundle ${this.bundleRef.bundleKey}`);
        assets[key] = await this.loadDefinitionFromBundle(provider, def);
      } catch (error) {
        assets[key] = { ...def, loaded: false, reason: String(error?.message || error) };
        errors.push({ key, message: String(error?.message || error) });
      }
    }
    this.lastLoadDebug = {
      source: 'BcuSoulEffectLoader.loadAll',
      mode,
      bundlePath: this.bundleRef.bundlePath,
      bundleKey: this.bundleRef.bundleKey,
      loaded: Object.values(assets).filter((asset) => asset?.loaded).length,
      total: Object.keys(this.entries).length,
      errors,
      assets: Object.fromEntries(Object.entries(assets).map(([key, asset]) => [key, {
        loaded: asset?.loaded === true,
        reason: asset?.reason || null,
        kind: asset?.kind || null,
        source: asset?.source || null,
        maxFrame: asset?.maxFrame ?? null,
        frameCount: asset?.frameCount ?? null
      }]))
    };
    globalThis.__BCU_SOUL_EFFECT_LOAD_DEBUG__ = this.lastLoadDebug;
    return assets;
  }
}
