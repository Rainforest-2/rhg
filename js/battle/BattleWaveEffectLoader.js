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
  enemyBlast: phasedEntry({ key: 'enemyBlast', kind: 'blast', direction: 1, baseDir: './public/assets/bcu/130700/org/battle/s22/', bundleDir: 'enemy-blast', image: 'skill022.png', imgcut: 'skill022.imgcut', model: 'skill_explosion_e.mamodel', phases: { start: 'skill_explosion00.maanim', explode: 'skill_explosion01.maanim', dummy: 'skill_explosion02.maanim' } }),

  strongAttack: singleEntry({ key: 'strongAttack', kind: 'strongAttack', direction: -1, baseDir: './public/assets/bcu/000001/org/battle/s6/', bundleDir: 'strong-attack', image: 'skill006.png', imgcut: 'skill006.imgcut', model: 'strong_attack.mamodel', anim: 'strong_attack.maanim' }),
  toxic: singleEntry({ key: 'toxic', kind: 'toxic', direction: 1, baseDir: './public/assets/bcu/000001/org/battle/s8/', bundleDir: 'all-skill-effects/000001/org/battle/s8', image: 'skill008.png', imgcut: 'skill008.imgcut', model: 'skill_percentage_attack.mamodel', anim: 'skill_percentage_attack.maanim' }),
  metalKiller: singleEntry({ key: 'metalKiller', kind: 'metalKiller', direction: -1, baseDir: './public/assets/bcu/130300/org/battle/s20/', bundleDir: 'metal-killer', image: 'skill020.png', imgcut: 'skill020.imgcut', model: 'skill_metal_strong.mamodel', anim: 'skill_metal_strong.maanim' }),

  unitBarrier: phasedEntry({ key: 'unitBarrier', kind: 'barrier', direction: -1, baseDir: './public/assets/bcu/000001/org/battle/s2/', bundleDir: 'unit-barrier', image: 'skill002.png', imgcut: 'skill002.imgcut', model: 'skill_barrier_e.mamodel', phases: { none: 'skill_barrier_e.maanim', breaker: 'skill_barrier_e_breaker.maanim', destruction: 'skill_barrier_e_destruction.maanim' } }),
  enemyBarrier: phasedEntry({ key: 'enemyBarrier', kind: 'barrier', direction: 1, baseDir: './public/assets/bcu/000001/org/battle/s2/', bundleDir: 'enemy-barrier', image: 'skill002.png', imgcut: 'skill002.imgcut', model: 'skill_barrier_e.mamodel', phases: { none: 'skill_barrier_e.maanim', breaker: 'skill_barrier_e_breaker.maanim', destruction: 'skill_barrier_e_destruction.maanim' } }),
  demonShield: phasedEntry({ key: 'demonShield', kind: 'demonShield', direction: 1, baseDir: './public/assets/bcu/100800/org/battle/s14/', bundleDir: 'demon-shield', image: 'skill014.png', imgcut: 'skill014.imgcut', model: 'skill_demonshield.mamodel', phases: { full: 'skill_demonshield00.maanim', half: 'skill_demonshield01.maanim', destruction: 'skill_demonshield_destruction.maanim', breaker: 'skill_demonshield_breaker.maanim', revive: 'skill_demonshield_revive.maanim' } }),
  warp: phasedEntry({ key: 'warp', kind: 'warp', direction: 1, baseDir: './public/assets/bcu/000001/org/battle/s2/', bundleDir: 'warp', image: 'skill002.png', imgcut: 'skill002.imgcut', model: 'skill_warp.mamodel', phases: { entrance: 'skill_warp_entrance.maanim', exit: 'skill_warp_exit.maanim' } }),
  warpChara: phasedEntry({ key: 'warpChara', kind: 'warp', direction: 1, baseDir: './public/assets/bcu/000001/org/battle/s2/', bundleDir: 'warp-chara', image: 'skill002.png', imgcut: 'skill002.imgcut', model: 'skill_warp_chara.mamodel', phases: { entrance: 'skill_warp_chara_entrance.maanim', exit: 'skill_warp_chara_exit.maanim' } }),
  unitWaveInvalid: singleEntry({ key: 'unitWaveInvalid', kind: 'waveInvalid', direction: -1, baseDir: './public/assets/bcu/000001/org/battle/s0/wave_invalid/', bundleDir: 'unit-wave-invalid', image: '../skill000.png', imgcut: '../skill000.imgcut', model: 'skill_wave_invalid.mamodel', anim: 'skill_wave_invalid.maanim' }),
  enemyWaveInvalid: singleEntry({ key: 'enemyWaveInvalid', kind: 'waveInvalid', direction: 1, baseDir: './public/assets/bcu/000001/org/battle/s0/wave_invalid/', bundleDir: 'enemy-wave-invalid', image: '../skill000.png', imgcut: '../skill000.imgcut', model: 'skill_wave_invalid_e.mamodel', anim: 'skill_wave_invalid_e.maanim' }),
  procInvalid: singleEntry({ key: 'procInvalid', kind: 'procInvalid', direction: 1, baseDir: './public/assets/bcu/000001/org/battle/s0/', bundleDir: 'proc-invalid', image: 'skill000.png', imgcut: 'skill000.imgcut', model: 'skill_effect_invalid.mamodel', anim: 'skill_effect_invalid.maanim' }),
  unitWaveStop: singleEntry({ key: 'unitWaveStop', kind: 'waveStop', direction: -1, baseDir: './public/assets/bcu/000001/org/battle/s0/wave_stop/', bundleDir: 'unit-wave-stop', image: '../skill000.png', imgcut: '../skill000.imgcut', model: 'skill_wave_stop.mamodel', anim: 'skill_wave_stop.maanim' }),
  enemyWaveStop: singleEntry({ key: 'enemyWaveStop', kind: 'waveStop', direction: 1, baseDir: './public/assets/bcu/000001/org/battle/s0/wave_stop/', bundleDir: 'enemy-wave-stop', image: '../skill000.png', imgcut: '../skill000.imgcut', model: 'skill_wave_stop_e.mamodel', anim: 'skill_wave_stop_e.maanim' }),
  enemyWaveGuard: phasedEntry({ key: 'enemyWaveGuard', kind: 'waveGuard', direction: 1, baseDir: './public/assets/bcu/130200/org/battle/s19/', bundleDir: 'enemy-wave-guard', image: 'skill019.png', imgcut: 'skill019.imgcut', model: 'skill_guard_e.mamodel', phases: { none: 'skill_guard_e.maanim', breaker: 'skill_guard_e_breaker.maanim' } }),
  unitCounterSurge: singleEntry({ key: 'unitCounterSurge', kind: 'counterSurge', direction: -1, baseDir: './public/assets/bcu/130000/org/battle/s18/', bundleDir: 'unit-counter-surge', image: 'skill018.png', imgcut: 'skill018.imgcut', model: 'skill_demonsummon.mamodel', anim: 'skill_demonsummon.maanim' }),
  enemyCounterSurge: singleEntry({ key: 'enemyCounterSurge', kind: 'counterSurge', direction: 1, baseDir: './public/assets/bcu/130000/org/battle/s17/', bundleDir: 'enemy-counter-surge', image: '../../../../120400/org/battle/s17/skill017.png', imgcut: '../../../../120400/org/battle/s17/skill017.imgcut', model: 'skill_demonsummon_e.mamodel', anim: 'skill_demonsummon_e.maanim' }),
  enemyDelay: singleEntry({ key: 'enemyDelay', kind: 'delay', direction: 1, baseDir: './public/assets/bcu/150300/org/battle/s23/', bundleDir: 'enemy-delay', image: 'skill023.png', imgcut: 'skill023.imgcut', model: 'skill_recast_decrease_e.mamodel', anim: 'skill_recast_decrease_e.maanim' })
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

function usesSourceNamedBundleFiles(def) {
  return String(def?.bundleDir || '').startsWith('all-skill-effects/');
}

function bundleAssetPath(def, kind) {
  const base = def.bundleDir;
  if (usesSourceNamedBundleFiles(def)) {
    if (kind === 'image') return `${base}/${def.image}`;
    if (kind === 'imgcut') return `${base}/${def.imgcut}`;
    if (kind === 'model') return `${base}/${def.model}`;
    if (kind === 'anim') return `${base}/${def.anim}`;
  }
  if (kind === 'image') return `${base}/image.png`;
  if (kind === 'imgcut') return `${base}/imgcut.imgcut`;
  if (kind === 'model') return `${base}/model.mamodel`;
  if (kind === 'anim') return `${base}/anim.maanim`;
  return `${base}/${kind}`;
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
    this.allowRawFallback = options.allowRawFallback === true;
    this.lastLoadDebug = null;
  }

  getProvider() {
    return this.provider || getGlobalSemanticProvider();
  }

  async loadDefinitionFromBundle(provider, def) {
    const [image, imgcutText, modelText, animText, phaseTexts] = await Promise.all([
      imageFromBundle(provider, this.bundleRef, bundleAssetPath(def, 'image')),
      provider.readTextByBundleRef(this.bundleRef, bundleAssetPath(def, 'imgcut')),
      provider.readTextByBundleRef(this.bundleRef, bundleAssetPath(def, 'model')),
      def.anim ? provider.readTextByBundleRef(this.bundleRef, bundleAssetPath(def, 'anim')) : Promise.resolve(null),
      readPhaseTextsFromBundle(provider, this.bundleRef, def.bundleDir, def.phases)
    ]);
    return parseDefinition(def, { image, imgcutText, modelText, animText, phaseTexts, source: `semantic-bundle:${this.bundleRef.bundleKey}:${def.bundleDir}` });
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
    const bundleOnly = !this.allowRawFallback;
    const mode = provider ? 'semantic-bundle' : (bundleOnly ? 'semantic-bundle-missing-provider' : 'raw-diagnostics');

    for (const [key, def] of Object.entries(this.entries)) {
      try {
        if (provider) assets[key] = await this.loadDefinitionFromBundle(provider, def);
        else if (bundleOnly) throw new Error(`Missing semantic provider for effect bundle ${this.bundleRef.bundleKey}`);
        else assets[key] = await this.loadDefinitionFromRawForDiagnostics(def);
      } catch (error) {
        assets[key] = { ...def, loaded: false, reason: String(error?.message || error) };
        errors.push({ key, message: String(error?.message || error) });
      }
    }

    this.lastLoadDebug = {
      source: 'BattleWaveEffectLoader.loadAll',
      mode,
      bundlePath: provider || bundleOnly ? this.bundleRef.bundlePath : null,
      bundleKey: provider || bundleOnly ? this.bundleRef.bundleKey : null,
      rawFallbackAllowed: this.allowRawFallback,
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
