import { parseImgcut } from '../bcu/BcuImgcutParser.js';
import { parseModel } from '../bcu/BcuModelParser.js';
import { parseAnim } from '../bcu/BcuAnimParser.js';

export const BCU_WAVE_EFFECT_BUNDLE_REF = Object.freeze({
  bundleKey: 'effect:wave',
  bundlePath: 'public/assets/bundles/effect/wave.zip'
});

function singleEntry({ key, kind, direction, baseDir, bundleDir, image, imgcut, model, anim }) {
  return { key, kind, direction, baseDir, bundleDir, image, imgcut, model, anim, phases: null };
}

function phasedEntry({ key, kind, direction, baseDir, bundleDir, image, imgcut, model, phases }) {
  return { key, kind, direction, baseDir, bundleDir, image, imgcut, model, anim: null, phases };
}

const WAVE_EFFECT_ENTRIES = Object.freeze({
  unitWave: singleEntry({ key: 'unitWave', kind: 'wave', direction: -1, baseDir: './public/assets/bcu/000001/org/battle/s4/', bundleDir: 'unit-wave', image: 'skill004.png', imgcut: 'skill004.imgcut', model: 'skill_wave_attack.mamodel', anim: 'skill_wave_attack.maanim' }),
  enemyWave: singleEntry({ key: 'enemyWave', kind: 'wave', direction: 1, baseDir: './public/assets/bcu/000001/org/battle/s5/', bundleDir: 'enemy-wave', image: 'skill005.png', imgcut: 'skill005.imgcut', model: 'skill_wave_attack_e.mamodel', anim: 'skill_wave_attack_e.maanim' }),
  unitMiniWave: singleEntry({ key: 'unitMiniWave', kind: 'miniWave', direction: -1, baseDir: './public/assets/bcu/100100/org/battle/s12/', bundleDir: 'unit-mini-wave', image: 'skill012.png', imgcut: 'skill012.imgcut', model: 'skill_smallwave_attack.mamodel', anim: 'skill_smallwave_attack.maanim' }),
  enemyMiniWave: singleEntry({ key: 'enemyMiniWave', kind: 'miniWave', direction: 1, baseDir: './public/assets/bcu/100100/org/battle/s13/', bundleDir: 'enemy-mini-wave', image: 'skill013.png', imgcut: 'skill013.imgcut', model: 'skill_smallwave_attack_e.mamodel', anim: 'skill_smallwave_attack_e.maanim' }),

  unitSurge: phasedEntry({ key: 'unitSurge', kind: 'surge', direction: -1, baseDir: './public/assets/bcu/000001/org/battle/s9/', bundleDir: 'unit-surge', image: 'skill009.png', imgcut: 'skill009.imgcut', model: 'skill_volcano.mamodel', phases: { start: 'skill_volcano00.maanim', during: 'skill_volcano01.maanim', end: 'skill_volcano02.maanim' } }),
  enemySurge: phasedEntry({ key: 'enemySurge', kind: 'surge', direction: 1, baseDir: './public/assets/bcu/000001/org/battle/s10/', bundleDir: 'enemy-surge', image: 'skill010.png', imgcut: 'skill010.imgcut', model: 'skill_volcano.mamodel', phases: { start: 'skill_volcano00.maanim', during: 'skill_volcano01.maanim', end: 'skill_volcano02.maanim' } }),
  unitMiniSurge: phasedEntry({ key: 'unitMiniSurge', kind: 'miniSurge', direction: -1, baseDir: './public/assets/bcu/120300/org/battle/s15/', bundleDir: 'unit-mini-surge', image: 'skill015.png', imgcut: 'skill015.imgcut', model: 'skill_smallvolcano.mamodel', phases: { start: 'skill_smallvolcano00.maanim', during: 'skill_smallvolcano01.maanim', end: 'skill_smallvolcano02.maanim' } }),
  enemyMiniSurge: phasedEntry({ key: 'enemyMiniSurge', kind: 'miniSurge', direction: 1, baseDir: './public/assets/bcu/120300/org/battle/s16/', bundleDir: 'enemy-mini-surge', image: 'skill016.png', imgcut: 'skill016.imgcut', model: 'skill_smallvolcano_e.mamodel', phases: { start: 'skill_smallvolcano_e00.maanim', during: 'skill_smallvolcano_e01.maanim', end: 'skill_smallvolcano_e02.maanim' } }),

  unitBlast: phasedEntry({ key: 'unitBlast', kind: 'blast', direction: -1, baseDir: './public/assets/bcu/130700/org/battle/s21/', bundleDir: 'unit-blast', image: 'skill021.png', imgcut: 'skill021.imgcut', model: 'skill_explosion.mamodel', phases: { start: 'skill_explosion00.maanim', explode: 'skill_explosion01.maanim', dummy: 'skill_explosion02.maanim' } }),
  enemyBlast: phasedEntry({ key: 'enemyBlast', kind: 'blast', direction: 1, baseDir: './public/assets/bcu/130700/org/battle/s22/', bundleDir: 'enemy-blast', image: 'skill022.png', imgcut: 'skill022.imgcut', model: 'skill_explosion_e.mamodel', phases: { start: 'skill_explosion00.maanim', explode: 'skill_explosion01.maanim', dummy: 'skill_explosion02.maanim' } })
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

function parseDefinition(def, { image, imgcutText, modelText, animText = null, phaseTexts = null, source }) {
  const imgcut = parseImgcut(imgcutText);
  const model = parseModel(modelText);
  const phases = phaseTexts
    ? Object.fromEntries(Object.entries(phaseTexts).map(([phase, text]) => [phase, parseAnim(text)]))
    : null;
  const anim = animText ? parseAnim(animText) : (phases?.start || phases?.during || phases?.explode || Object.values(phases || {})[0] || null);
  const maxFrame = Number(anim?.maxFrame) || 0;
  return {
    key: def.key,
    kind: def.kind,
    direction: def.direction,
    image,
    imgcut,
    model,
    anim,
    phases,
    loaded: true,
    source,
    frameCount: Math.max(1, maxFrame + 1),
    maxFrame,
    partCount: imgcut?.parts?.length || 0
  };
}

function phaseBundleName(phase) {
  return `anim-${phase}.maanim`;
}

async function readPhaseTextsFromBundle(provider, bundleRef, base, phases) {
  if (!phases) return null;
  return Object.fromEntries(await Promise.all(Object.keys(phases).map(async (phase) => [
    phase,
    await provider.readTextByBundleRef(bundleRef, `${base}/${phaseBundleName(phase)}`)
  ])));
}

async function readPhaseTextsFromRaw(def) {
  if (!def.phases) return null;
  return Object.fromEntries(await Promise.all(Object.entries(def.phases).map(async ([phase, file]) => [
    phase,
    await fetchText(`${def.baseDir}${file}`)
  ])));
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
    const [image, imgcutText, modelText, animText, phaseTexts] = await Promise.all([
      imageFromBundle(provider, this.bundleRef, `${base}/image.png`),
      provider.readTextByBundleRef(this.bundleRef, `${base}/imgcut.imgcut`),
      provider.readTextByBundleRef(this.bundleRef, `${base}/model.mamodel`),
      def.anim ? provider.readTextByBundleRef(this.bundleRef, `${base}/anim.maanim`) : Promise.resolve(null),
      readPhaseTextsFromBundle(provider, this.bundleRef, base, def.phases)
    ]);
    return parseDefinition(def, { image, imgcutText, modelText, animText, phaseTexts, source: `semantic-bundle:${this.bundleRef.bundleKey}:${base}` });
  }

  async loadDefinitionFromRawForDiagnostics(def) {
    const [image, imgcutText, modelText, animText, phaseTexts] = await Promise.all([
      loadImage(`${def.baseDir}${def.image}`),
      fetchText(`${def.baseDir}${def.imgcut}`),
      fetchText(`${def.baseDir}${def.model}`),
      def.anim ? fetchText(`${def.baseDir}${def.anim}`) : Promise.resolve(null),
      readPhaseTextsFromRaw(def)
    ]);
    return parseDefinition(def, { image, imgcutText, modelText, animText, phaseTexts, source: `raw-diagnostics:${def.baseDir}` });
  }

  async loadAll() {
    const provider = this.getProvider();
    const assets = {};
    const errors = [];
    const mode = provider ? 'semantic-bundle' : 'raw-diagnostics';

    for (const [key, def] of Object.entries(this.entries)) {
      try {
        assets[key] = provider ? await this.loadDefinitionFromBundle(provider, def) : await this.loadDefinitionFromRawForDiagnostics(def);
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
        kind: asset?.kind || null,
        source: asset?.source || null,
        maxFrame: asset?.maxFrame ?? null,
        frameCount: asset?.frameCount ?? null,
        partCount: asset?.partCount ?? null,
        phases: asset?.phases ? Object.keys(asset.phases) : []
      }]))
    };
    globalThis.__BCU_WAVE_EFFECT_LOAD_DEBUG__ = this.lastLoadDebug;
    return assets;
  }
}
