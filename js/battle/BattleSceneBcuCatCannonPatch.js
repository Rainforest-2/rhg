import { BattleScene } from './BattleScene.js';
import { BATTLE_CONFIG } from './BattleConfig.js';
import {
  getBcuCatCannonStatus,
  initializeBcuCatCannon,
  requestBcuCatCannonFire,
  resolveBcuCatCannonAssistKnockback,
  tickBcuCatCannonAttack,
  tickBcuCatCannonCharge
} from './bcu-runtime/BcuCatCannonRuntime.js';
import { EffectRuntime } from './EffectRuntime.js';
import { getBcuAssetDatabase } from '../bcu/BcuAssetDatabase.js';
import { parseModel } from '../bcu/BcuModelParser.js';
import { parseAnim } from '../bcu/BcuAnimParser.js';
import { parseImgcut } from '../bcu/BcuImgcutParser.js';
import { BcuModelInstance } from '../bcu/BcuModelInstance.js';
import { BcuAnimator } from '../bcu/BcuAnimator.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-cat-cannon-runtime.v1');

// Basic cat-cannon (BASE_H, id 0) firing animation.
// BCU NyCastle.read loads aux.atks[0] from org/castle/001/nyankoCastle_001_00_*; Cannon.activate
// sets anim = atks[id].getEAnim(NyType.BASE), i.e. model/anim *_01 with sprite/imgcut *_00.
const CAT_CANNON_ANIM_BUNDLE_REF = Object.freeze({ bundleKey: 'nyankoCastle:001', bundlePath: 'public/assets/bundles/castle/nyanko/001.zip' });
const CAT_CANNON_ANIM_FILES = Object.freeze({
  model: 'nyankoCastle_001_00_01.mamodel',
  anim: 'nyankoCastle_001_00_01.maanim',
  imgcut: 'nyankoCastle_001_00_00.imgcut',
  png: 'nyankoCastle_001_00_00.png'
});
const CAT_CANNON_ANIM_SOURCE = 'bcu-effanim-cat-cannon-base:nyankoCastle:001/nyankoCastle_001_00_01';

const loadCannonImage = (src) => new Promise((res, rej) => {
  if (typeof Image === 'undefined') { rej(new Error('no Image')); return; }
  const i = new Image();
  i.onload = () => res(i);
  i.onerror = () => rej(new Error(`cannon anim image load failed:${src}`));
  i.src = src;
});

async function loadBcuCatCannonBaseAnim() {
  const provider = getBcuAssetDatabase()?.semanticProvider || null;
  if (!provider) return { ok: false, reason: 'missing-semantic-provider' };
  const ref = CAT_CANNON_ANIM_BUNDLE_REF;
  const [modelText, animText, imgcutText] = await Promise.all([
    provider.readTextByBundleRef(ref, CAT_CANNON_ANIM_FILES.model),
    provider.readTextByBundleRef(ref, CAT_CANNON_ANIM_FILES.anim),
    provider.readTextByBundleRef(ref, CAT_CANNON_ANIM_FILES.imgcut)
  ]);
  const url = await provider.createObjectUrl(ref, CAT_CANNON_ANIM_FILES.png, 'image/png');
  const image = await loadCannonImage(url);
  return {
    ok: true,
    image,
    imgcut: parseImgcut(imgcutText),
    model: parseModel(modelText),
    anim: parseAnim(animText),
    source: CAT_CANNON_ANIM_SOURCE,
    bcuReference: 'NyCastle.read aux.atks[0]; Cannon.activate anim = atks[0].getEAnim(BASE)'
  };
}

function getCatCannonBasePosBcu(scene) {
  const base = scene?.bases?.find?.((b) => b?.side === 'dog-player');
  const pos = base?.getBattlePosBcu?.();
  if (Number.isFinite(pos)) return pos;
  const fallback = Number(scene?.stage?.runtime?.playerBasePosBcu);
  return Number.isFinite(fallback) ? fallback : 4000;
}

export function installBattleSceneBcuCatCannonPatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalInit = proto.init;
  proto.init = async function initWithBcuCatCannon(...args) {
    const result = await originalInit.apply(this, args);
    initializeBcuCatCannon(this, BATTLE_CONFIG.cannon?.catCannon || {});
    this.ensureCatCannonAnimLoading?.();
    return result;
  };

  proto.ensureCatCannonAnimLoading = function ensureCatCannonAnimLoading() {
    if (this._bcuCatCannonAnimPromise) return this._bcuCatCannonAnimPromise;
    this._bcuCatCannonAnimPromise = loadBcuCatCannonBaseAnim()
      .then((asset) => {
        this.bcuCatCannonAnim = asset?.ok ? asset : null;
        this.lastCatCannonAnimLoad = { source: 'BattleSceneBcuCatCannonPatch.ensureCatCannonAnimLoading', ok: !!this.bcuCatCannonAnim, reason: asset?.reason || null, animSource: this.bcuCatCannonAnim?.source || null };
        return this.bcuCatCannonAnim;
      })
      .catch((error) => {
        this.bcuCatCannonAnim = null;
        this._bcuCatCannonAnimPromise = null;
        this.lastCatCannonAnimLoad = { source: 'BattleSceneBcuCatCannonPatch.ensureCatCannonAnimLoading', ok: false, reason: String(error?.message || error) };
        return null;
      });
    return this._bcuCatCannonAnimPromise;
  };

  // BCU Cannon.activate() immediately starts the cannon BASE animation at the player base;
  // damage lands NYPRE[0] = 18 frames later. This spawns that animation as a model effanim.
  proto.spawnCatCannonFireEffect = function spawnCatCannonFireEffect() {
    const asset = this.bcuCatCannonAnim;
    if (!asset?.ok || !asset.model || !asset.anim || !asset.image || !asset.imgcut?.parts?.length) {
      if (!this._bcuCatCannonAnimPromise) this.ensureCatCannonAnimLoading?.();
      return false;
    }
    if (!Array.isArray(this.effects)) return false;
    if (this.effects.length >= (BATTLE_CONFIG.tuning?.maxEffects ?? 40)) return false;
    const model = new BcuModelInstance(asset.model);
    const animator = new BcuAnimator(asset.anim);
    animator.setLoop?.(false);
    animator.restart?.();
    const worldX = getCatCannonBasePosBcu(this);
    const effect = EffectRuntime.createHitEffect({
      id: `bcu-cat-cannon-base-${this.logicFrame || 0}-${this.effects.length}`,
      x: worldX,
      y: 0,
      image: asset.image,
      imgcut: asset.imgcut,
      model,
      animator,
      scale: 1,
      source: CAT_CANNON_ANIM_SOURCE,
      createdAtMs: this.timeMs,
      layer: 9,
      debug: {
        source: 'BattleSceneBcuCatCannonPatch.spawnCatCannonFireEffect',
        bcuReference: asset.bcuReference,
        effectKey: 'cat-cannon/base-anim',
        phase: 'activate',
        worldX
      }
    });
    this.effects.push(effect);
    this.lastCatCannonFireEffect = { source: 'BattleSceneBcuCatCannonPatch.spawnCatCannonFireEffect', worldX, animSource: asset.source, effectId: effect.id };
    return true;
  };

  proto.requestCatCannonFire = function requestCatCannonFire() {
    return requestBcuCatCannonFire(this);
  };

  proto.getCatCannonStatus = function getCatCannonStatus() {
    return getBcuCatCannonStatus(this);
  };

  const originalRunTickPhase = proto.runTickPhase;
  if (typeof originalRunTickPhase !== 'function') return;

  proto.runTickPhase = function runTickPhaseWithBcuCatCannon(phase, fn = () => {}) {
    if (phase === 'economy') {
      return originalRunTickPhase.call(this, phase, () => {
        const result = fn();
        tickBcuCatCannonCharge(this, this.frameClock?.fixedStepMs || 1000 / 30);
        return result;
      });
    }
    if (phase === 'proc-resolve') {
      return originalRunTickPhase.call(this, phase, () => {
        const result = fn();
        tickBcuCatCannonAttack(this);
        return result;
      });
    }
    if (phase === 'knockback-death') {
      return originalRunTickPhase.call(this, phase, () => {
        const result = fn();
        resolveBcuCatCannonAssistKnockback(this, BATTLE_CONFIG.tuning || {});
        return result;
      });
    }
    return originalRunTickPhase.call(this, phase, fn);
  };
}

installBattleSceneBcuCatCannonPatch();
