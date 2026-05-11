import { fetchBcuText } from './BcuText.js';
import { parseImgcut } from './BcuImgcutParser.js';
import { parseModel } from './BcuModelParser.js';
import { parseAnim } from './BcuAnimParser.js';
import { getBcuAssetDatabase } from './BcuAssetDatabase.js';

const cache = new Map();
const counters={assetSetRequested:0,assetSetCacheHit:0,imageRequested:0,imageCacheHit:0,animationRequested:0,animationCacheHit:0};
const animationCache=new Map();
const imageCache=new Map();

function asArray(v) { return v == null ? [] : (Array.isArray(v) ? v : [v]); }
function join(base, file) { return `${base}${file}`; }

function isNotFoundError(e) { return String(e.message || '').includes('HTTP 404'); }

function loadImage(url) {
  counters.imageRequested++;
  if(imageCache.has(url)){ counters.imageCacheHit++; return imageCache.get(url); }
  const p=new Promise((res, rej) => {
    const img = new Image();
    img.onload = async () => { try { if (typeof img.decode === "function") await img.decode(); } catch(_e) {} res(img); };
    img.onerror = () => rej(new Error(`Image load failed: ${url}`));
    img.src = url;
  });
  imageCache.set(url,p);
  return p;
}

async function loadImageFromObjectUrl(provider, bundleRef, internalPath) {
  return await loadImage(await provider.createObjectUrl(bundleRef, internalPath, 'image/png'));
}

async function tryLoadSemanticActor(def) {
  if (!def?.semanticKey) return null;
  let db = null;
  try { db = getBcuAssetDatabase(); } catch { return null; }
  const provider = db?.semanticProvider;
  if (!provider) return null;
  try {
    const entry = provider.getActorEntry(def.semanticKey);
    if (!entry?.bundleRef) return null;
    const bundleRef = entry.bundleRef;
    const r = { loaded: [], missing: [], errors: [], status: { image: 'missing', imgcut: 'missing', model: 'missing' }, imageFile: null, imgcutFile: null, modelFile: null, renderMode: def.renderMode || 'model', modelRequired: def.model != null && (def.renderMode || 'model') !== 'static-imgcut', animationRequired: (def.renderMode || 'model') === 'model' && (def.animations?.length || 0) > 0, semantic: { key: def.semanticKey, bundleRef, source: 'semantic-bundle' } };
    try { r.image = await loadImageFromObjectUrl(provider, bundleRef, 'image.png'); r.imageFile = 'image.png'; r.loaded.push('image.png'); r.status.image = 'loaded'; } catch { r.missing.push('image.png'); }
    try { r.imgcut = parseImgcut(await provider.readTextByBundleRef(bundleRef, 'imgcut.imgcut')); r.imgcutFile = 'imgcut.imgcut'; r.loaded.push('imgcut.imgcut'); r.status.imgcut = 'loaded'; } catch (e) { r.errors.push(`semantic imgcut: ${e.message}`); }
    try { r.model = parseModel(await provider.readTextByBundleRef(bundleRef, 'model.mamodel')); r.modelFile = 'model.mamodel'; r.loaded.push('model.mamodel'); r.status.model = 'loaded'; } catch (e) { if (r.modelRequired) r.errors.push(`semantic model: ${e.message}`); else r.status.model = 'skipped'; }
    return r;
  } catch (error) {
    if (provider.allowRawFallback) {
      provider.recordRawFallback('actor-bundle-load-failed', { actorKey: def.semanticKey, message: error?.message || String(error) });
      return null;
    }
    throw error;
  }
}

async function tryLoadText(baseDir, candidates, parser, field) {
  const tried = [];
  for (const file of asArray(candidates)) {
    const url = join(baseDir, file);
    tried.push(file);
    try {
      const parsed = parser(await fetchBcuText(url));
      return { ok: true, file, parsed, tried };
    } catch (e) {
      if (!isNotFoundError(e)) return { ok: false, file, error: `${field} parse error ${file}: ${e.message}`, tried };
    }
  }
  return { ok: false, missing: true, tried };
}

async function tryLoadImage(baseDir, candidates) {
  const tried = [];
  for (const file of asArray(candidates)) {
    tried.push(file);
    try { return { ok: true, file, image: await loadImage(join(baseDir, file)), tried }; } catch (_e) {}
  }
  return { ok: false, missing: true, tried };
}

export class BcuAssetLoader {
  async loadAssetSet(def) {
    counters.assetSetRequested++;
    if (cache.has(def.id)) { counters.assetSetCacheHit++; return await cache.get(def.id); }
    const p=this.loadAssetSetUncached(def);
    cache.set(def.id,p);
    try{return await p;}catch(e){cache.delete(def.id); throw e;}
  }

  async loadAssetSetUncached(def) {
    const semantic = await tryLoadSemanticActor(def);
    if (semantic && (semantic.image || semantic.imgcut || semantic.model)) return semantic;
    const r = { loaded: [], missing: [], errors: [], status: { image: 'missing', imgcut: 'missing', model: 'missing' }, imageFile: null, imgcutFile: null, modelFile: null, renderMode: def.renderMode || 'model', modelRequired: def.model != null && (def.renderMode || 'model') !== 'static-imgcut', animationRequired: (def.renderMode || 'model') === 'model' && (def.animations?.length || 0) > 0 };

    const [img,ic,md] = await Promise.allSettled([
      tryLoadImage(def.baseDir, def.image),
      tryLoadText(def.baseDir, def.imgcut, parseImgcut, "imgcut"),
      def.model == null ? Promise.resolve({skip:true}) : tryLoadText(def.baseDir, def.model, parseModel, "model")
    ]);
    const imgv=img.status==='fulfilled'?img.value:{ok:false,tried:[]};
    const icv=ic.status==='fulfilled'?ic.value:{ok:false,error:String(ic.reason),tried:[]};
    const mdv=md.status==='fulfilled'?md.value:{ok:false,error:String(md.reason),tried:[]};

    const imgRes = imgv;
    if (imgRes.ok) { r.image = imgRes.image; r.imageFile = imgRes.file; r.loaded.push(imgRes.file); r.status.image = 'loaded'; }
    else { r.missing.push(...imgRes.tried); r.status.image = 'missing'; }

    const icRes = icv;
    if (icRes.ok) { r.imgcut = icRes.parsed; r.imgcutFile = icRes.file; r.loaded.push(icRes.file); r.status.imgcut = 'loaded'; }
    else if (icRes.error) { r.errors.push(icRes.error); r.status.imgcut = 'error'; } else { r.missing.push(...icRes.tried); r.status.imgcut = 'missing'; }

    if (def.model == null) {
      r.status.model = 'skipped';
    } else {
      const mdRes = mdv;
      if (mdRes.ok) { r.model = mdRes.parsed; r.modelFile = mdRes.file; r.loaded.push(mdRes.file); r.status.model = 'loaded'; }
      else if (mdRes.error) { r.errors.push(mdRes.error); r.status.model = 'error'; }
      else {
        r.status.model = 'missing';
        if (r.modelRequired) r.missing.push(...mdRes.tried);
      }
    }

    return r;
  }

  async loadAnimation(def, animDef) {
    if (!animDef) return { loaded: [], missing: [], errors: [], file: null, anim: null, status: 'skipped' };
    counters.animationRequested++;
    const files = asArray(animDef.file);
    if (def?.semanticKey) {
      let provider = null;
      try { provider = getBcuAssetDatabase()?.semanticProvider; } catch {}
      const role = animDef.id === 'anim00' ? 'move' : animDef.id === 'anim01' ? 'idle' : animDef.id === 'anim02' ? 'attack' : animDef.id === 'anim03' ? 'kb' : null;
      if (provider && role) {
        try {
          const entry = provider.getActorEntry(def.semanticKey);
          const anim = parseAnim(await provider.readTextByBundleRef(entry.bundleRef, `${role}.maanim`));
          return { loaded: [`${role}.maanim`], missing: [], errors: [], file: `${role}.maanim`, anim, status: 'loaded', semantic: { key: def.semanticKey } };
        } catch (error) {
          if (!provider.allowRawFallback) return { loaded: [], missing: [`${role}.maanim`], errors: [error.message], file: `${role}.maanim`, anim: null, status: 'error' };
          provider.recordRawFallback('actor-animation-bundle-load-failed', { actorKey: def.semanticKey, role, message: error?.message || String(error) });
        }
      }
    }
    for (const file of files) {
      const key=`${def.id}:${file}`;
      if(animationCache.has(key)){ counters.animationCacheHit++; return await animationCache.get(key); }
      const p=(async()=>{
        try {
          const anim = parseAnim(await fetchBcuText(`${def.baseDir}${file}`));
          return { loaded: [file], missing: [], errors: [], file, anim, status: 'loaded' };
        } catch (e) {
          if (isNotFoundError(e)) return null;
          throw e;
        }
      })();
      animationCache.set(key,p);
      try{ const r=await p; if(r) return r; animationCache.delete(key);}catch(e){animationCache.delete(key); return { loaded: [], missing: [], errors: [`${file}: ${e.message}`], file, anim: null, status: 'error' }; }
    }
    return { loaded: [], missing: files, errors: [], file: files[0], anim: null, status: 'missing' };
  }
}
export function __getBcuAssetCaches(){return {assetSetCacheSize:cache.size,animationCacheSize:animationCache.size,imageCacheSize:imageCache.size,counters,cache,animationCache,imageCache};}
