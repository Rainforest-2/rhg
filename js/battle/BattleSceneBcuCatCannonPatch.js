import { BattleScene } from './BattleScene.js';
import { BATTLE_CONFIG } from './BattleConfig.js';
import {
  getBcuCatCannonDrawOffsets,
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
// BCU util/pack/NyCastle.java: for cannon t, BASE = *_0<t>_01.mamodel/.maanim, ATK = *_0<t>_00.mamodel/.maanim,
// both sharing sprite/imgcut *_0<t>_00.png/.imgcut. (basic cannon t=0)
const CAT_CANNON_ANIM_FILES = Object.freeze({
  model: 'nyankoCastle_001_00_01.mamodel',
  anim: 'nyankoCastle_001_00_01.maanim',
  atkModel: 'nyankoCastle_001_00_00.mamodel',
  atkAnim: 'nyankoCastle_001_00_00.maanim',
  imgcut: 'nyankoCastle_001_00_00.imgcut',
  png: 'nyankoCastle_001_00_00.png'
});
const CAT_CANNON_ANIM_SOURCE = 'bcu-effanim-cat-cannon-base:nyankoCastle:001/nyankoCastle_001_00_01';
const CAT_CANNON_WAVE_ANIM_SOURCE = 'bcu-effanim-cat-cannon-wave:nyankoCastle:001/nyankoCastle_001_00_00';

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
  const [modelText, animText, atkModelText, atkAnimText, imgcutText] = await Promise.all([
    provider.readTextByBundleRef(ref, CAT_CANNON_ANIM_FILES.model),
    provider.readTextByBundleRef(ref, CAT_CANNON_ANIM_FILES.anim),
    provider.readTextByBundleRef(ref, CAT_CANNON_ANIM_FILES.atkModel),
    provider.readTextByBundleRef(ref, CAT_CANNON_ANIM_FILES.atkAnim),
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
    // ATK eanim = ContWaveCanon traveling wave (Cannon basic uses atks[0].getEAnim(ATK)).
    atkModel: parseModel(atkModelText),
    atkAnim: parseAnim(atkAnimText),
    source: CAT_CANNON_ANIM_SOURCE,
    waveSource: CAT_CANNON_WAVE_ANIM_SOURCE,
    bcuReference: 'NyCastle.read aux.atks[0]; Cannon.activate anim = atks[0].getEAnim(BASE); ContWaveCanon anim = atks[0].getEAnim(ATK)'
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
    const cannonId = Number.isInteger(this.bcuCatCannon?.id) ? this.bcuCatCannon.id : 0;
    const { offsetX, offsetY } = getBcuCatCannonDrawOffsets(cannonId);
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
      // Draw-order only; the BCU draw Y uses the base ground line (layer 0) + cany offset explicitly.
      layer: 9,
      // BCU canon.drawBase X offset: getX(ubase.pos) + canx[id]*siz. The renderer applies
      // x = projectBattleX(worldX) + bcuScreenOffsetX * cameraScale, which matches canx*siz exactly.
      bcuScreenOffsetX: offsetX,
      debug: {
        source: 'BattleSceneBcuCatCannonPatch.spawnCatCannonFireEffect',
        bcuReference: `${asset.bcuReference}; BattleBox.drawBtm canon.drawBase setP(getX(ubase.pos)+canx[${cannonId}]*siz, midh+(cany[${cannonId}]-road_h)*siz) psiz=siz*sprite`,
        effectKey: 'cat-cannon/base-anim',
        phase: 'activate',
        worldX,
        cannonId,
        offsetX,
        offsetY
      }
    });
    // BCU canon.drawBase Y: midh + (cany[id] - road_h)*siz = getBcuLayerScreenY(layer 0) + cany[id]*siz,
    // drawn at psiz = siz*sprite. The renderer honors bcuCannonBaseAnim to apply this exact formula
    // instead of the generic layer/smoke-offset path (which sank the anim into the ground).
    effect.bcuCannonBaseAnim = true;
    effect.bcuCannonOffsetY = offsetY;
    // Play the full BASE animation once (BCU Cannon.update keeps anim until anim.done()). The default
    // BattleEffect lifetime (225ms ≈ 7 frames) cut the firing animation off after a few frames.
    const stepMs = this.frameClock?.fixedStepMs || (1000 / 30);
    effect.durationMs = animator.getFrameCount?.() ? animator.getFrameCount() * stepMs : effect.durationMs;
    effect.frameDurationMs = stepMs;
    this.effects.push(effect);
    this.lastCatCannonFireEffect = { source: 'BattleSceneBcuCatCannonPatch.spawnCatCannonFireEffect', worldX, cannonId, offsetX, offsetY, durationMs: effect.durationMs, animSource: asset.source, effectId: effect.id };
    return true;
  };

  // BCU ContWaveCanon traveling wave: draws atks[id].getEAnim(ATK) per band at the band center.
  // Position/scale from BattleBox.drawEff + ContWaveCanon.draw (basic cannon canid=0):
  //   x = getX(pos) - wave(28)*siz - 9*siz ; y = getBcuLayerScreenY(layer 9) - 40*siz ; scale = siz*sprite*2.5
  // (pus*(-psiz) collapses to *siz because sprite*1.25 == 1.0). The renderer honors bcuCannonWaveAnim.
  proto.spawnCatCannonWaveEffect = function spawnCatCannonWaveEffect(center, waveIndex = 0) {
    const asset = this.bcuCatCannonAnim;
    if (!asset?.ok || !asset.atkModel || !asset.atkAnim || !asset.image || !asset.imgcut?.parts?.length) {
      if (!this._bcuCatCannonAnimPromise) this.ensureCatCannonAnimLoading?.();
      return false;
    }
    if (!Array.isArray(this.effects)) return false;
    if (this.effects.length >= (BATTLE_CONFIG.tuning?.maxEffects ?? 40)) return false;
    const model = new BcuModelInstance(asset.atkModel);
    const animator = new BcuAnimator(asset.atkAnim);
    animator.setLoop?.(false);
    animator.restart?.();
    const worldX = Number.isFinite(center) ? center : getCatCannonBasePosBcu(this);
    const stepMs = this.frameClock?.fixedStepMs || (1000 / 30);
    const effect = EffectRuntime.createHitEffect({
      id: `bcu-cat-cannon-wave-${this.logicFrame || 0}-w${waveIndex}-${this.effects.length}`,
      type: 'cat-cannon-wave',
      x: worldX,
      y: 0,
      image: asset.image,
      imgcut: asset.imgcut,
      model,
      animator,
      scale: 1,
      source: CAT_CANNON_WAVE_ANIM_SOURCE,
      createdAtMs: this.timeMs,
      layer: 9,
      // x = getX(pos) - 37*siz : -wave(28) - pus.x(9). Applied as bcuScreenOffsetX * cameraScale.
      bcuScreenOffsetX: -37,
      debug: { source: 'BattleSceneBcuCatCannonPatch.spawnCatCannonWaveEffect', bcuReference: 'ContWaveCanon.draw atks[0].getEAnim(ATK)', effectKey: 'cat-cannon/wave', phase: 'attack', worldX, waveIndex }
    });
    effect.bcuCannonWaveAnim = true;
    effect.bcuCannonWaveLayer = 9;
    effect.bcuCannonWaveOffsetY = -40; // pus.y(40)*(-psiz) -> -40*siz
    effect.bcuCannonWaveScale = 2.5;   // psiz*2 with psiz*=1.25 -> siz*sprite*2.5
    effect.durationMs = animator.getFrameCount?.() ? animator.getFrameCount() * stepMs : effect.durationMs;
    effect.frameDurationMs = stepMs;
    this.effects.push(effect);
    this.lastCatCannonWaveEffect = { source: 'BattleSceneBcuCatCannonPatch.spawnCatCannonWaveEffect', worldX, waveIndex, durationMs: effect.durationMs, animSource: asset.waveSource, effectId: effect.id };
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
        tickBcuCatCannonAttack(this, { tuning: BATTLE_CONFIG.tuning || {} });
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
