import { parseImgcut } from '../bcu/BcuImgcutParser.js';
import { parseModel } from '../bcu/BcuModelParser.js';
import { parseAnim } from '../bcu/BcuAnimParser.js';

const HIT_EFFECT_BUNDLE_REF = Object.freeze({
  bundleKey: 'effect:kbeff',
  bundlePath: 'public/assets/bundles/effect/kbeff.zip'
});

const EMBEDDED_ATTACK_SMOKE_MODEL = `[mamodel]\n3\n2\n-1,-1,0,0,0,0,0,0,1000,1000,0,1000,0,default\n0,0,8,0,0,0,28,24,2000,2000,0,1000,0,default\n1000,3600,1000\n1\n0,0,0,0,0,0,default`;
const EMBEDDED_ATTACK_SMOKE_ANIM = `[maanim]\n1\n1\n1,2,1,0,0,\n6\n0,8,1,0,\n2,9,1,0,\n4,10,1,0,\n6,11,1,0,\n8,12,1,0,\n10,0,0,0,`;
const EMBEDDED_WHITE_SMOKE_MODEL = EMBEDDED_ATTACK_SMOKE_MODEL;
const EMBEDDED_WHITE_SMOKE_ANIM = EMBEDDED_ATTACK_SMOKE_ANIM;

async function fetchText(path){const r=await fetch(path); if(!r.ok) throw new Error(path); return await r.text();}
async function loadImage(path){return await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=path;});}

function getGlobalSemanticProvider() {
  return globalThis.__BCU_DB__?.semanticProvider || globalThis.app?.bcuDb?.semanticProvider || globalThis.__APP__?.bcuDb?.semanticProvider || null;
}

function selectBcuHitExplosionParts(imgcut) {
  return (imgcut?.parts || [])
    .filter((p) => String(p?.name || '').includes('ヒットエフェクト') && String(p?.name || '').includes('爆発'))
    .sort((a, b) => (Number(a?.index) || 0) - (Number(b?.index) || 0));
}

async function imageFromBundle(provider, bundleRef, internalPath = 'image.png') {
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

async function readOptionalBundleText(provider, bundleRef, internalPath) {
  try { return await provider.readTextByBundleRef(bundleRef, internalPath); } catch { return null; }
}

async function readOptionalRawText(path) {
  try { return await fetchText(path); } catch { return null; }
}

function parseEffectDefinition({ modelText, animText, source }) {
  const model = parseModel(modelText);
  const anim = parseAnim(animText);
  return {
    source,
    model,
    anim,
    frameCount: Math.max(1, (Number(anim.maxFrame) || 0) + 1),
    maxFrame: Number(anim.maxFrame) || 0
  };
}

function maybeParseEffectDefinition({ modelText, animText, source }) {
  if (!modelText || !animText) return null;
  return parseEffectDefinition({ modelText, animText, source });
}

function attachCompatibilityDefinitions(asset, attackDef, whiteDef, criticalDef, criticalMissingReason = null, bossShockwaveDef = null, bossShockwaveMissingReason = null) {
  const effectDefinitions = { attack: attackDef, white: whiteDef };
  if (criticalDef) effectDefinitions.critical = criticalDef;
  if (bossShockwaveDef) effectDefinitions.bossShockwave = bossShockwaveDef;
  return {
    ...asset,
    effectDefinitions,
    smokeDefinitions: { attack: attackDef, white: whiteDef },
    criticalEffectDefinition: criticalDef || null,
    criticalEffectMissingReason: criticalDef ? null : criticalMissingReason,
    bossShockwaveEffectDefinition: bossShockwaveDef || null,
    bossShockwaveEffectMissingReason: bossShockwaveDef ? null : bossShockwaveMissingReason
  };
}

export class BattleEffectLoader {
  constructor(options = {}) {
    this.provider = options.semanticProvider || null;
    this.bundleRef = options.bundleRef || HIT_EFFECT_BUNDLE_REF;
    this.rawBaseDir = options.rawBaseDir || './public/assets/bcu/000001/org/battle/a/';
    this.lastLoadDebug = null;
  }

  getProvider() {
    return this.provider || getGlobalSemanticProvider();
  }

  async loadHitEffectFromBundle(provider) {
    const imgcutText = await provider.readTextByBundleRef(this.bundleRef, 'imgcut.imgcut');
    const imgcut = parseImgcut(imgcutText);
    const parts = selectBcuHitExplosionParts(imgcut);
    if (!parts.length) throw new Error('hit effect parts missing in semantic effect bundle');
    const image = await imageFromBundle(provider, this.bundleRef, 'image.png');
    const attackModelText = await readOptionalBundleText(provider, this.bundleRef, 'attack_smoke.mamodel') || EMBEDDED_ATTACK_SMOKE_MODEL;
    const attackAnimText = await readOptionalBundleText(provider, this.bundleRef, 'attack_smoke.maanim') || EMBEDDED_ATTACK_SMOKE_ANIM;
    const whiteModelText = await readOptionalBundleText(provider, this.bundleRef, 'white_smoke.mamodel') || EMBEDDED_WHITE_SMOKE_MODEL;
    const whiteAnimText = await readOptionalBundleText(provider, this.bundleRef, 'white_smoke.maanim') || EMBEDDED_WHITE_SMOKE_ANIM;
    const criticalModelText = await readOptionalBundleText(provider, this.bundleRef, 'critical.mamodel');
    const criticalAnimText = await readOptionalBundleText(provider, this.bundleRef, 'critical.maanim');
    const bossModelText = await readOptionalBundleText(provider, this.bundleRef, 'boss_welcome.mamodel');
    const bossAnimText = await readOptionalBundleText(provider, this.bundleRef, 'boss_welcome.maanim');
    const attackDef = parseEffectDefinition({ modelText: attackModelText, animText: attackAnimText, source: attackModelText === EMBEDDED_ATTACK_SMOKE_MODEL ? 'embedded-bcu-attack_smoke' : 'bundle:attack_smoke' });
    const whiteDef = parseEffectDefinition({ modelText: whiteModelText, animText: whiteAnimText, source: whiteModelText === EMBEDDED_WHITE_SMOKE_MODEL ? 'embedded-bcu-white_smoke' : 'bundle:white_smoke' });
    const criticalDef = maybeParseEffectDefinition({ modelText: criticalModelText, animText: criticalAnimText, source: 'bundle:critical' });
    const bossShockwaveDef = maybeParseEffectDefinition({ modelText: bossModelText, animText: bossAnimText, source: 'bundle:boss_welcome' });
    return attachCompatibilityDefinitions({
      image,
      imgcut,
      parts,
      model: parseModel(attackModelText),
      anim: parseAnim(attackAnimText),
      loaded: true,
      reason: '',
      source: 'semantic-bundle:effect:kbeff',
      bundleRef: this.bundleRef,
      imgcutPartCount: imgcut.parts?.length || 0
    }, attackDef, whiteDef, criticalDef, criticalDef ? null : 'effect:kbeff bundle has no critical.mamodel/critical.maanim', bossShockwaveDef, bossShockwaveDef ? null : 'effect:kbeff bundle has no boss_welcome.mamodel/boss_welcome.maanim');
  }

  async loadHitEffectFromRawForDiagnostics() {
    const image = await loadImage(`${this.rawBaseDir}000_a.png`);
    const imgcut = parseImgcut(await fetchText(`${this.rawBaseDir}000_a.imgcut`));
    const parts = selectBcuHitExplosionParts(imgcut);
    if (!parts.length) throw new Error('hit effect parts missing in raw BCU asset');
    const attackModelText = await readOptionalRawText(`${this.rawBaseDir}attack_smoke.mamodel`) || EMBEDDED_ATTACK_SMOKE_MODEL;
    const attackAnimText = await readOptionalRawText(`${this.rawBaseDir}attack_smoke.maanim`) || EMBEDDED_ATTACK_SMOKE_ANIM;
    const whiteModelText = await readOptionalRawText(`${this.rawBaseDir}white_smoke.mamodel`) || EMBEDDED_WHITE_SMOKE_MODEL;
    const whiteAnimText = await readOptionalRawText(`${this.rawBaseDir}white_smoke.maanim`) || EMBEDDED_WHITE_SMOKE_ANIM;
    const criticalModelText = await readOptionalRawText(`${this.rawBaseDir}critical.mamodel`);
    const criticalAnimText = await readOptionalRawText(`${this.rawBaseDir}critical.maanim`);
    const bossModelText = await readOptionalRawText(`${this.rawBaseDir}boss_welcome.mamodel`);
    const bossAnimText = await readOptionalRawText(`${this.rawBaseDir}boss_welcome.maanim`);
    const attackDef = parseEffectDefinition({ modelText: attackModelText, animText: attackAnimText, source: 'raw-or-embedded:attack_smoke' });
    const whiteDef = parseEffectDefinition({ modelText: whiteModelText, animText: whiteAnimText, source: 'raw-or-embedded:white_smoke' });
    const criticalDef = maybeParseEffectDefinition({ modelText: criticalModelText, animText: criticalAnimText, source: 'raw:critical' });
    const bossShockwaveDef = maybeParseEffectDefinition({ modelText: bossModelText, animText: bossAnimText, source: 'raw:boss_welcome' });
    return attachCompatibilityDefinitions({
      image,
      imgcut,
      parts,
      model: parseModel(attackModelText),
      anim: parseAnim(attackAnimText),
      loaded: true,
      reason: '',
      source: 'raw-diagnostics:public/assets/bcu/000001/org/battle/a',
      bundleRef: null,
      imgcutPartCount: imgcut.parts?.length || 0
    }, attackDef, whiteDef, criticalDef, criticalDef ? null : 'raw critical.mamodel/critical.maanim missing', bossShockwaveDef, bossShockwaveDef ? null : 'raw boss_welcome.mamodel/boss_welcome.maanim missing');
  }

  async loadHitEffect(){
    const provider = this.getProvider();
    try {
      if (provider) {
        const asset = await this.loadHitEffectFromBundle(provider);
        this.lastLoadDebug = {
          source: 'BattleEffectLoader.loadHitEffect',
          mode: 'semantic-bundle',
          loaded: true,
          bundlePath: this.bundleRef.bundlePath,
          partCount: asset.parts.length,
          partNames: asset.parts.map((p) => p.name),
          imgcutPartCount: asset.imgcutPartCount,
          effectDefinitions: Object.fromEntries(Object.entries(asset.effectDefinitions || {}).map(([key, def]) => [key, { source: def.source, maxFrame: def.maxFrame, frameCount: def.frameCount }])),
          criticalEffectMissingReason: asset.criticalEffectMissingReason || null,
          bossShockwaveEffectMissingReason: asset.bossShockwaveEffectMissingReason || null
        };
        globalThis.__BATTLE_HIT_EFFECT_LOADER_DEBUG__ = this.lastLoadDebug;
        return asset;
      }

      const asset = await this.loadHitEffectFromRawForDiagnostics();
      this.lastLoadDebug = {
        source: 'BattleEffectLoader.loadHitEffect',
        mode: 'raw-diagnostics',
        loaded: true,
        partCount: asset.parts.length,
        partNames: asset.parts.map((p) => p.name),
        imgcutPartCount: asset.imgcutPartCount,
        effectDefinitions: Object.fromEntries(Object.entries(asset.effectDefinitions || {}).map(([key, def]) => [key, { source: def.source, maxFrame: def.maxFrame, frameCount: def.frameCount }])),
        criticalEffectMissingReason: asset.criticalEffectMissingReason || null,
        bossShockwaveEffectMissingReason: asset.bossShockwaveEffectMissingReason || null
      };
      globalThis.__BATTLE_HIT_EFFECT_LOADER_DEBUG__ = this.lastLoadDebug;
      return asset;
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      console.warn('[BattleEffectLoader] hit effect disabled:', reason);
      this.lastLoadDebug = {
        source: 'BattleEffectLoader.loadHitEffect',
        mode: provider ? 'semantic-bundle' : 'raw-diagnostics',
        loaded: false,
        image: false,
        partCount: 0,
        bundlePath: provider ? this.bundleRef.bundlePath : null,
        reason
      };
      globalThis.__BATTLE_HIT_EFFECT_LOADER_DEBUG__ = this.lastLoadDebug;
      return { image: null, parts: [], loaded: false, reason, source: provider ? 'semantic-bundle-failed' : 'raw-diagnostics-failed', bundleRef: provider ? this.bundleRef : null };
    }
  }
}
