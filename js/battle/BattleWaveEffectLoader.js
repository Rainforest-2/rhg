import { parseImgcut } from '../bcu/BcuImgcutParser.js';
import { parseModel } from '../bcu/BcuModelParser.js';
import { parseAnim } from '../bcu/BcuAnimParser.js';

export const BCU_WAVE_EFFECT_BUNDLE_REF = Object.freeze({
  bundleKey: 'effect:wave',
  bundlePath: 'public/assets/bundles/effect/wave.zip'
});

const WAVE_EFFECT_ENTRIES = Object.freeze({
  unitWave: {
    key: 'unitWave',
    kind: 'wave',
    direction: -1,
    baseDir: './public/assets/bcu/000001/org/battle/s4/',
    bundleDir: 'unit-wave',
    image: 'skill004.png',
    imgcut: 'skill004.imgcut',
    model: 'skill_wave_attack.mamodel',
    anim: 'skill_wave_attack.maanim'
  },
  enemyWave: {
    key: 'enemyWave',
    kind: 'wave',
    direction: 1,
    baseDir: './public/assets/bcu/000001/org/battle/s5/',
    bundleDir: 'enemy-wave',
    image: 'skill005.png',
    imgcut: 'skill005.imgcut',
    model: 'skill_wave_attack_e.mamodel',
    anim: 'skill_wave_attack_e.maanim'
  },
  unitMiniWave: {
    key: 'unitMiniWave',
    kind: 'miniWave',
    direction: -1,
    baseDir: './public/assets/bcu/100100/org/battle/s12/',
    bundleDir: 'unit-mini-wave',
    image: 'skill012.png',
    imgcut: 'skill012.imgcut',
    model: 'skill_smallwave_attack.mamodel',
    anim: 'skill_smallwave_attack.maanim'
  },
  enemyMiniWave: {
    key: 'enemyMiniWave',
    kind: 'miniWave',
    direction: 1,
    baseDir: './public/assets/bcu/100100/org/battle/s13/',
    bundleDir: 'enemy-mini-wave',
    image: 'skill013.png',
    imgcut: 'skill013.imgcut',
    model: 'skill_smallwave_attack_e.mamodel',
    anim: 'skill_smallwave_attack_e.maanim'
  }
});

async function fetchText(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${path}`);
  return await response.text();
}

async function loadImage(path) {
  return await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Image load failed: ${path}`));
    image.src = path;
  });
}

function getGlobalSemanticProvider() {
  return globalThis.__BCU_DB__?.semanticProvider || globalThis.app?.bcuDb?.semanticProvider || globalThis.__APP__?.bcuDb?.semanticProvider || null;
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

function parseDefinition(def, { image, imgcutText, modelText, animText, source }) {
  const imgcut = parseImgcut(imgcutText);
  const model = parseModel(modelText);
  const anim = parseAnim(animText);
  return {
    key: def.key,
    kind: def.kind,
    direction: def.direction,
    image,
    imgcut,
    model,
    anim,
    loaded: true,
    source,
    frameCount: Math.max(1, (Number(anim?.maxFrame) || 0) + 1),
    maxFrame: Number(anim?.maxFrame) || 0,
    partCount: imgcut?.parts?.length || 0
  };
}

export class BattleWaveEffectLoader {
  constructor(options = {}) {
    this.provider = options.semanticProvider || null;
    this.bundleRef = options.bundleRef || BCU_WAVE_EFFECT_BUNDLE_REF;
    this.entries = options.entries || WAVE_EFFECT_ENTRIES;
    this.lastLoadDebug = null;
  }

  getProvider() {
    return this.provider || getGlobalSemanticProvider();
  }

  async loadDefinitionFromBundle(provider, def) {
    const base = def.bundleDir;
    const [image, imgcutText, modelText, animText] = await Promise.all([
      imageFromBundle(provider, this.bundleRef, `${base}/image.png`),
      provider.readTextByBundleRef(this.bundleRef, `${base}/imgcut.imgcut`),
      provider.readTextByBundleRef(this.bundleRef, `${base}/model.mamodel`),
      provider.readTextByBundleRef(this.bundleRef, `${base}/anim.maanim`)
    ]);
    return parseDefinition(def, { image, imgcutText, modelText, animText, source: `semantic-bundle:${this.bundleRef.bundleKey}:${base}` });
  }

  async loadDefinitionFromRawForDiagnostics(def) {
    const [image, imgcutText, modelText, animText] = await Promise.all([
      loadImage(`${def.baseDir}${def.image}`),
      fetchText(`${def.baseDir}${def.imgcut}`),
      fetchText(`${def.baseDir}${def.model}`),
      fetchText(`${def.baseDir}${def.anim}`)
    ]);
    return parseDefinition(def, { image, imgcutText, modelText, animText, source: `raw-diagnostics:${def.baseDir}` });
  }

  async loadAll() {
    const provider = this.getProvider();
    const assets = {};
    const errors = [];
    const mode = provider ? 'semantic-bundle' : 'raw-diagnostics';

    for (const [key, def] of Object.entries(this.entries)) {
      try {
        assets[key] = provider
          ? await this.loadDefinitionFromBundle(provider, def)
          : await this.loadDefinitionFromRawForDiagnostics(def);
      } catch (error) {
        assets[key] = { ...def, loaded: false, reason: String(error?.message || error) };
        errors.push({ key, message: String(error?.message || error) });
      }
    }

    this.lastLoadDebug = {
      source: 'BattleWaveEffectLoader.loadAll',
      mode,
      bundlePath: provider ? this.bundleRef.bundlePath : null,
      bundleKey: provider ? this.bundleRef.bundleKey : null,
      loaded: Object.values(assets).filter((asset) => asset?.loaded).length,
      total: Object.keys(this.entries).length,
      errors,
      assets: Object.fromEntries(Object.entries(assets).map(([key, asset]) => [key, {
        loaded: asset?.loaded === true,
        reason: asset?.reason || null,
        source: asset?.source || null,
        maxFrame: asset?.maxFrame ?? null,
        frameCount: asset?.frameCount ?? null,
        partCount: asset?.partCount ?? null
      }]))
    };
    globalThis.__BCU_WAVE_EFFECT_LOAD_DEBUG__ = this.lastLoadDebug;
    return assets;
  }
}
