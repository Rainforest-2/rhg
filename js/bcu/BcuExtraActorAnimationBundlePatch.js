import { BcuAssetLoader } from './BcuAssetLoader.js';
import { getBcuAssetDatabase } from './BcuAssetDatabase.js';
import { fetchBcuText } from './BcuText.js';
import { parseAnim } from './BcuAnimParser.js';

const PATCH_FLAG = Symbol.for('wanko-bcu.extra-actor-animation-bundle-loader.v1');

function asArray(v) {
  return v == null ? [] : (Array.isArray(v) ? v : [v]);
}

function semanticKeyOf(def) {
  if (def?.semanticKey) return def.semanticKey;
  const id = String(def?.id || '');
  const enemy = id.match(/^enemy-(\d{3,})$/);
  if (enemy) return `enemy:${Number(enemy[1])}`;
  return null;
}

function isBcuZombieBurrowExtraAnimation(def, animDef) {
  if (def?.allowExtraRawAnimations !== true) return false;
  const id = String(animDef?.id || '');
  if (!/^anim0[4-6]$/.test(id)) return false;
  return asArray(animDef?.file).every((file) => /_e_zombie0[0-2]\.maanim$/i.test(String(file || '')));
}

export function installBcuExtraActorAnimationBundlePatch() {
  const proto = BcuAssetLoader?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;
  const original = proto.loadAnimation;

  proto.loadAnimation = async function loadAnimationWithBcuExtraActorBundle(def, animDef) {
    if (!isBcuZombieBurrowExtraAnimation(def, animDef)) return original.call(this, def, animDef);
    const semanticKey = semanticKeyOf(def);
    const files = asArray(animDef.file);
    let provider = null;
    try { provider = getBcuAssetDatabase()?.semanticProvider || null; } catch {}
    if (provider && semanticKey) {
      const entry = provider.getActorEntry?.(semanticKey);
      if (entry?.bundleRef && provider.hasBundleForKey?.(semanticKey)) {
        for (const file of files) {
          try {
            const anim = parseAnim(await provider.readTextByBundleRef(entry.bundleRef, file));
            return { loaded: [file], missing: [], errors: [], file, anim, status: 'loaded', semantic: { key: semanticKey, source: 'semantic-bundle-extra-actor-animation' } };
          } catch {}
        }
      }
    }
    // Temporary compatibility path until actor bundles are regenerated with
    // *_e_zombie00/01/02.maanim. This reads the exact BCU raw animation file,
    // not a substitute animation. Once bundles are rebuilt, this branch should
    // stop being used and can be removed.
    for (const file of files) {
      try {
        const anim = parseAnim(await fetchBcuText(`${def.baseDir}${file}`));
        return { loaded: [file], missing: [], errors: [], file, anim, status: 'loaded', source: 'raw-extra-actor-animation-compat' };
      } catch (error) {
        if (!String(error?.message || error).includes('HTTP 404')) return { loaded: [], missing: [], errors: [`${file}: ${error.message}`], file, anim: null, status: 'error' };
      }
    }
    return { loaded: [], missing: files, errors: [], file: files[0], anim: null, status: 'missing' };
  };
}

installBcuExtraActorAnimationBundlePatch();
