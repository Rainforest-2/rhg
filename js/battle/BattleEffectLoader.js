import { parseImgcut } from '../bcu/BcuImgcutParser.js';

const HIT_EFFECT_BUNDLE_REF = Object.freeze({
  bundleKey: 'effect:kbeff',
  bundlePath: 'public/assets/bundles/effect/kbeff.zip'
});

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
    return {
      image,
      parts,
      loaded: true,
      reason: '',
      source: 'semantic-bundle:effect:kbeff',
      bundleRef: this.bundleRef,
      imgcutPartCount: imgcut.parts?.length || 0
    };
  }

  async loadHitEffectFromRawForDiagnostics() {
    const image = await loadImage(`${this.rawBaseDir}000_a.png`);
    const imgcut = parseImgcut(await fetchText(`${this.rawBaseDir}000_a.imgcut`));
    const parts = selectBcuHitExplosionParts(imgcut);
    if (!parts.length) throw new Error('hit effect parts missing in raw BCU asset');
    return {
      image,
      parts,
      loaded: true,
      reason: '',
      source: 'raw-diagnostics:public/assets/bcu/000001/org/battle/a',
      bundleRef: null,
      imgcutPartCount: imgcut.parts?.length || 0
    };
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
          imgcutPartCount: asset.imgcutPartCount
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
        imgcutPartCount: asset.imgcutPartCount
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
