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
function isExtraRawActorAnimation(def, animDef) {
  if (def?.allowExtraRawAnimations !== true) return false;
  const id = String(animDef?.id || '');
  if (!/^anim0[4-6]$/.test(id)) return false;
  return asArray(animDef?.file).every((file) => /_e0[4-6]\.maanim$/i.test(String(file || '')));
}

function loadImage(url) {
  counters.imageRequested++;
  if(imageCache.has(url)){ counters.imageCacheHit++; return imageCache.get(url); }
  const p=new Promise((res, rej) => {
    const img = new Image();
    img.onload = async () => { try { if (typeof img.decode === 'function') await img.decode(); } catch(_e) {} res(img); };
    img.onerror = () => rej(new Error(`Image load failed: ${url}`));
    img.src = url;
  });
  imageCache.set(url,p);
  return p;
}

function makeActorDiagnostic({ kind='actor', semanticKey, bundlePath=null, internalPath=null, sourcePack=null, sourceRawPaths=null, role=null, reason, error }) {
  return { kind, semanticKey, role: role || undefined, bundlePath, internalPath, sourcePack: sourcePack || null, sourceRawPaths: sourceRawPaths || [], reason, originalErrorName: error?.name || null, originalErrorMessage: error?.message || (error ? String(error) : null), originalErrorStack: error?.stack || null, message: error?.message || reason || 'actor-bundle-error' };
}

function normalizeModelPartRefs(model, imgcut) {
  const partCount = imgcut?.parts?.length || 0;
  if (!model || !partCount) return model;
  for (const part of model.parts || []) if (Number.isInteger(part.partIndex) && part.partIndex >= partCount) part.partIndex = 0;
  return model;
}

function validateActorCore({ semanticKey, bundlePath, sourcePack, sourceRawPaths, image, imgcut, model }) {
  const failures = [];
  const imageWidth = Number(image?.naturalWidth || image?.width || 0);
  const imageHeight = Number(image?.naturalHeight || image?.height || 0);
  if (!imageWidth || !imageHeight) failures.push({ internalPath: 'image.png', reason: 'invalid-image-dimensions' });
  normalizeModelPartRefs(model, imgcut);
  if (failures.length) {
    const f = failures[0];
    const error = new Error(`Invalid actor bundle ${semanticKey}: ${f.reason}`);
    error.detail = makeActorDiagnostic({ semanticKey, bundlePath, sourcePack, sourceRawPaths, internalPath: f.internalPath, reason: f.reason, error });
    error.invalidEntries = failures.map((x) => x.internalPath);
    throw error;
  }
}

function validateActorAnimation({ semanticKey, bundlePath, sourcePack, sourceRawPaths, role, internalPath, anim, model }) {
  const partCount = model?.parts?.length || 0;
  for (const track of anim?.tracks || []) {
    const partId = Number(track?.partId);
    if (!Number.isInteger(partId) || partId < 0 || partId >= partCount) {
      const error = new Error(`Invalid actor animation ${semanticKey} ${internalPath}: part ${track?.partId} out of range`);
      error.detail = makeActorDiagnostic({ kind: 'actor-animation', semanticKey, bundlePath, sourcePack, sourceRawPaths, role, internalPath, reason: 'animation-part-id-out-of-range', error });
      throw error;
    }
  }
}

async function loadImageFromObjectUrl(provider, bundleRef, internalPath) { return await loadImage(await provider.createObjectUrl(bundleRef, internalPath, 'image/png')); }

async function tryLoadSemanticActor(def) {
  if (!def?.semanticKey) return null;
  let db = null;
  try { db = getBcuAssetDatabase(); } catch { return null; }
  const provider = db?.semanticProvider;
  if (!provider) return null;
  try {
    const entry = provider.getActorEntry(def.semanticKey);
    if (!entry?.bundleRef || !provider.hasBundleForKey(def.semanticKey)) {
      if (entry?.status === 'rawOnly' && def.allowRawOnly === true) return null;
      throw new Error(`Missing full actor bundle for semantic key ${def.semanticKey}`);
    }
    const bundleRef = entry.bundleRef;
    let bundleJson = {};
    try { bundleJson = JSON.parse(await provider.readTextByBundleRef(bundleRef, 'bundle.json')); } catch {}
    const r = { loaded: [], missing: [], errors: [], status: { image: 'missing', imgcut: 'missing', model: 'missing' }, imageFile: null, imgcutFile: null, modelFile: null, renderMode: def.renderMode || 'model', modelRequired: def.model != null && (def.renderMode || 'model') !== 'static-imgcut', animationRequired: (def.renderMode || 'model') === 'model' && (def.animations?.length || 0) > 0, semantic: { key: def.semanticKey, bundleRef, source: 'semantic-bundle', sourcePack: bundleJson.sourcePack || entry.selected?.sourcePack || null, sourceRawPaths: bundleJson.sourceRawPaths || entry.diagnostics?.sourceRawPaths || [] } };
    try { r.image = await loadImageFromObjectUrl(provider, bundleRef, 'image.png'); r.imageFile = 'image.png'; r.loaded.push('image.png'); r.status.image = 'loaded'; } catch { r.missing.push('image.png'); }
    try { r.imgcut = parseImgcut(await provider.readTextByBundleRef(bundleRef, 'imgcut.imgcut')); r.imgcutFile = 'imgcut.imgcut'; r.loaded.push('imgcut.imgcut'); r.status.imgcut = 'loaded'; } catch (e) { r.errors.push(`semantic imgcut: ${e.message}`); }
    try { r.model = parseModel(await provider.readTextByBundleRef(bundleRef, 'model.mamodel')); r.modelFile = 'model.mamodel'; r.loaded.push('model.mamodel'); r.status.model = 'loaded'; } catch (e) { if (r.modelRequired) r.errors.push(`semantic model: ${e.message}`); else r.status.model = 'skipped'; }
    if (r.errors.length || r.missing.length) {
      const missingEntries = [...r.missing];
      const error = new Error(`Incomplete actor bundle for ${def.semanticKey}: ${[...r.errors, ...missingEntries].join(', ')}`);
      error.missingEntries = missingEntries;
      error.invalidEntries = [];
      throw error;
    }
    validateActorCore({ semanticKey: def.semanticKey, bundlePath: bundleRef.bundlePath, sourcePack: r.semantic.sourcePack, sourceRawPaths: r.semantic.sourceRawPaths, image: r.image, imgcut: r.imgcut, model: r.model });
    return r;
  } catch (error) {
    if (provider.allowRawFallback) { provider.recordRawFallback('actor-bundle-load-failed', { actorKey: def.semanticKey, message: error?.message || String(error) }); return null; }
    const entry = provider.getActorEntry(def.semanticKey);
    provider.diagnostics.bundleErrors.push(error?.detail || makeActorDiagnostic({ semanticKey: def.semanticKey, bundlePath: entry?.bundleRef?.bundlePath || null, sourcePack: entry?.selected?.sourcePack || null, sourceRawPaths: entry?.diagnostics?.sourceRawPaths || [], reason: 'actor-bundle-load-failed', error }));
    throw error;
  }
}

function deriveActorSemanticKey(def) {
  if (def?.semanticKey) return def.semanticKey;
  const id = String(def?.id || '');
  let m = id.match(/^enemy-(\d{3,})$/);
  if (m) return `enemy:${Number(m[1])}`;
  m = id.match(/^unit-(\d{3,})-([fcsu])$/);
  if (m) return `unit:${Number(m[1])}:${m[2]}`;
  return null;
}

function assertRawAllowed(def) {
  const semanticKey = deriveActorSemanticKey(def);
  let provider = null;
  try { provider = getBcuAssetDatabase()?.semanticProvider; } catch {}
  if (!provider || !semanticKey) return;
  const rawPath = def?.baseDir || def?.imagePath || null;
  provider.assertNoRawForBundledKey(semanticKey, rawPath);
  const entry = provider.getActorEntry(semanticKey);
  if (entry && entry.status !== 'rawOnly' && def.allowRawOnly !== true) throw new Error(`Raw actor access requires explicit rawOnly entry: ${semanticKey}`);
}

async function tryLoadText(baseDir, candidates, parser, field) {
  const tried = [];
  for (const file of asArray(candidates)) {
    const url = join(baseDir, file);
    tried.push(file);
    try { return { ok: true, file, parsed: parser(await fetchBcuText(url)), tried }; }
    catch (e) { if (!isNotFoundError(e)) return { ok: false, file, error: `${field} parse error ${file}: ${e.message}`, tried }; }
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
    if (!def.semanticKey) { const derived = deriveActorSemanticKey(def); if (derived) def = { ...def, semanticKey: derived }; }
    const semantic = await tryLoadSemanticActor(def);
    if (semantic && (semantic.image || semantic.imgcut || semantic.model)) return semantic;
    assertRawAllowed(def);
    const r = { loaded: [], missing: [], errors: [], status: { image: 'missing', imgcut: 'missing', model: 'missing' }, imageFile: null, imgcutFile: null, modelFile: null, renderMode: def.renderMode || 'model', modelRequired: def.model != null && (def.renderMode || 'model') !== 'static-imgcut', animationRequired: (def.renderMode || 'model') === 'model' && (def.animations?.length || 0) > 0 };
    const [img,ic,md] = await Promise.allSettled([tryLoadImage(def.baseDir, def.image), tryLoadText(def.baseDir, def.imgcut, parseImgcut, 'imgcut'), def.model == null ? Promise.resolve({skip:true}) : tryLoadText(def.baseDir, def.model, parseModel, 'model')]);
    const imgv=img.status==='fulfilled'?img.value:{ok:false,tried:[]};
    const icv=ic.status==='fulfilled'?ic.value:{ok:false,error:String(ic.reason),tried:[]};
    const mdv=md.status==='fulfilled'?md.value:{ok:false,error:String(md.reason),tried:[]};
    if (imgv.ok) { r.image = imgv.image; r.imageFile = imgv.file; r.loaded.push(imgv.file); r.status.image = 'loaded'; } else { r.missing.push(...imgv.tried); r.status.image = 'missing'; }
    if (icv.ok) { r.imgcut = icv.parsed; r.imgcutFile = icv.file; r.loaded.push(icv.file); r.status.imgcut = 'loaded'; } else if (icv.error) { r.errors.push(icv.error); r.status.imgcut = 'error'; } else { r.missing.push(...icv.tried); r.status.imgcut = 'missing'; }
    if (def.model == null) r.status.model = 'skipped';
    else if (mdv.ok) { r.model = mdv.parsed; r.modelFile = mdv.file; r.loaded.push(mdv.file); r.status.model = 'loaded'; }
    else if (mdv.error) { r.errors.push(mdv.error); r.status.model = 'error'; }
    else { r.status.model = 'missing'; if (r.modelRequired) r.missing.push(...mdv.tried); }
    return r;
  }
  async loadAnimation(def, animDef) {
    if (!animDef) return { loaded: [], missing: [], errors: [], file: null, anim: null, status: 'skipped' };
    counters.animationRequested++;
    const files = asArray(animDef.file);
    if (!def.semanticKey) { const derived = deriveActorSemanticKey(def); if (derived) def = { ...def, semanticKey: derived }; }
    if (def?.semanticKey) {
      let provider = null;
      try { provider = getBcuAssetDatabase()?.semanticProvider; } catch {}
      const role = animDef.id === 'anim00' ? 'move' : animDef.id === 'anim01' ? 'idle' : animDef.id === 'anim02' ? 'attack' : animDef.id === 'anim03' ? 'kb' : null;
      if (provider && role) {
        try {
          const entry = provider.getActorEntry(def.semanticKey);
          if (!entry?.bundleRef || !provider.hasBundleForKey(def.semanticKey)) throw new Error(`Missing full actor bundle for semantic key ${def.semanticKey}`);
          const anim = parseAnim(await provider.readTextByBundleRef(entry.bundleRef, `${role}.maanim`));
          let model = null;
          try { model = parseModel(await provider.readTextByBundleRef(entry.bundleRef, 'model.mamodel')); } catch {}
          if (model) validateActorAnimation({ semanticKey: def.semanticKey, bundlePath: entry.bundleRef.bundlePath, sourcePack: entry.selected?.sourcePack || null, sourceRawPaths: entry.diagnostics?.sourceRawPaths || [], role, internalPath: `${role}.maanim`, anim, model });
          return { loaded: [`${role}.maanim`], missing: [], errors: [], file: `${role}.maanim`, anim, status: 'loaded', semantic: { key: def.semanticKey } };
        } catch (error) {
          if (!provider.allowRawFallback) {
            const entry = provider.getActorEntry(def.semanticKey);
            provider.diagnostics.bundleErrors.push(error?.detail || makeActorDiagnostic({ kind: 'actor-animation', semanticKey: def.semanticKey, role, bundlePath: entry?.bundleRef?.bundlePath || null, internalPath: `${role}.maanim`, sourcePack: entry?.selected?.sourcePack || null, sourceRawPaths: entry?.diagnostics?.sourceRawPaths || [], reason: 'actor-animation-load-failed', error }));
            return { loaded: [], missing: [`${role}.maanim`], errors: [error.message], file: `${role}.maanim`, anim: null, status: 'error' };
          }
          provider.recordRawFallback('actor-animation-bundle-load-failed', { actorKey: def.semanticKey, role, message: error?.message || String(error) });
        }
      }
    }
    if (!isExtraRawActorAnimation(def, animDef)) assertRawAllowed(def);
    else {
      try { getBcuAssetDatabase()?.semanticProvider?.recordRawFallback?.('extra-actor-animation-raw-load', { actorKey: def.semanticKey || deriveActorSemanticKey(def), animId: animDef.id, files }); } catch {}
    }
    for (const file of files) {
      const key=`${def.id}:${file}`;
      if(animationCache.has(key)){ counters.animationCacheHit++; return await animationCache.get(key); }
      const p=(async()=>{
        try { const anim = parseAnim(await fetchBcuText(`${def.baseDir}${file}`)); return { loaded: [file], missing: [], errors: [], file, anim, status: 'loaded' }; }
        catch (e) { if (isNotFoundError(e)) return null; throw e; }
      })();
      animationCache.set(key,p);
      try{ const r=await p; if(r) return r; animationCache.delete(key);}catch(e){animationCache.delete(key); return { loaded: [], missing: [], errors: [`${file}: ${e.message}`], file, anim: null, status: 'error' }; }
    }
    return { loaded: [], missing: files, errors: [], file: files[0], anim: null, status: 'missing' };
  }
}
export function __getBcuAssetCaches(){return {assetSetCacheSize:cache.size,animationCacheSize:animationCache.size,imageCacheSize:imageCache.size,counters,cache,animationCache,imageCache};}
