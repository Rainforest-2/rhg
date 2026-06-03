import { BCU_DAMAGE_GUARD_FIELDS } from '../BcuCombatModel.js';
import { directionForActor, spawnWaveBundleEffect } from '../BcuWaveBundleEffectSpawner.js';

export const BCU_WAVE_INVALID_ICON_Y_OFFSET = 25;

function combatModel(actor) {
  return actor?.bcuCombatModel || actor?.rawStats?.bcuCombatModel || actor?.stats?.bcuCombatModel || null;
}

function procModel(actor) {
  return combatModel(actor)?.proc || actor?.bcuProc || actor?.rawStats?.bcuProc || actor?.abilityModel?.bcuProc || {};
}

function clampPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.trunc(n)));
}

export function getBcuWaveInvalidKind(meta = {}) {
  if (meta?.bcuWave === 'miniWave') return 'miniWave';
  if (meta?.bcuWave) return 'wave';
  if (meta?.bcuSurge === 'miniSurge') return 'miniSurge';
  if (meta?.bcuSurge) return 'surge';
  if (meta?.bcuBlast) return 'blast';
  return null;
}

export function getBcuWaveInvalidField(kind) {
  return BCU_DAMAGE_GUARD_FIELDS?.[kind] || null;
}

export function getBcuWaveInvalidPercent(target, kind) {
  const field = getBcuWaveInvalidField(kind);
  if (!field) return 0;
  const cm = combatModel(target);
  const proc = procModel(target);
  const direct = cm?.immunity?.[kind]?.mult;
  return clampPercent(Number.isFinite(Number(direct)) ? direct : (proc?.[field]?.mult ?? proc?.[field]?.block ?? 0));
}

export function resolveBcuWaveInvalid({ target = null, targetType = 'actor', meta = {} } = {}) {
  const kind = getBcuWaveInvalidKind(meta);
  const field = getBcuWaveInvalidField(kind);
  if (!kind || !field || targetType !== 'actor' || !target) {
    return { applies: false, kind, field, percent: 0, full: false, partial: false, reason: kind ? 'unsupported-target' : 'not-bcu-projectile' };
  }
  const percent = getBcuWaveInvalidPercent(target, kind);
  return {
    applies: percent > 0,
    kind,
    field,
    percent,
    full: percent >= 100,
    partial: percent > 0 && percent < 100,
    scale: Math.max(0, (100 - percent) / 100),
    bcuReference: 'BCU Entity.damaged: wave/mini uses IMUWAVE, volcano/mini-volcano uses IMUVOLC, blast uses IMUBLAST. Non-zero value displays P_WAVE icon; 100 stops the projectile hit; partial scales the final hit value.'
  };
}

export function applyBcuWaveInvalidValue(value, invalid) {
  const before = Math.max(0, Math.trunc(Number(value) || 0));
  if (!invalid?.applies) return { accepted: true, before, after: before, invalid };
  if (invalid.full) return { accepted: false, before, after: 0, invalid };
  const after = Math.max(0, Math.trunc(before * (100 - invalid.percent) / 100));
  return { accepted: after > 0, before, after, invalid };
}

export function waveInvalidEffectKeyForActor(actor) {
  return directionForActor(actor) === 1 ? 'enemyWaveInvalid' : 'unitWaveInvalid';
}

export function spawnBcuWaveInvalidIcon(scene, target, invalid, extra = {}) {
  if (!scene || !target || !invalid?.applies) return null;
  const key = waveInvalidEffectKeyForActor(target);
  const effect = spawnWaveBundleEffect(scene, {
    key,
    actor: target,
    type: 'waveInvalid',
    source: 'bcu-effanim-wave-invalid-projectile',
    bcuSmokeYOffset: BCU_WAVE_INVALID_ICON_Y_OFFSET,
    debug: {
      bcuReference: 'BCU Entity.AnimManager.getEff(P_WAVE): direction selects A_WAVE_INVALID/A_E_WAVE_INVALID and status[P_WAVE][0] holds animation length; drawEff places status effects at p.y - 25*siz and scale 0.75.',
      invalidKind: invalid.kind,
      field: invalid.field,
      percent: invalid.percent,
      full: invalid.full,
      partial: invalid.partial,
      effectKey: key,
      bcuSmokeYOffset: BCU_WAVE_INVALID_ICON_Y_OFFSET,
      ...extra
    }
  });
  target.lastBcuWaveInvalidEffectDebug = {
    source: 'BcuWaveInvalidRuntime.spawnBcuWaveInvalidIcon',
    effectId: effect?.id || null,
    effectKey: key,
    invalid,
    bcuSmokeYOffset: BCU_WAVE_INVALID_ICON_Y_OFFSET,
    spawned: !!effect
  };
  return effect;
}
