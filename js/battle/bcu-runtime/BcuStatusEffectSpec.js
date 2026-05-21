export const STATUS_EFFECT_BUNDLE_REF = Object.freeze({
  bundleKey: 'effect:status',
  bundlePath: 'public/assets/bundles/effect/status-effects.zip'
});

export const PHASE_A_STATUS_EFFECT_KEYS = Object.freeze([
  'A_STOP',
  'A_E_STOP',
  'A_SLOW',
  'A_E_SLOW',
  'A_DOWN',
  'A_E_DOWN',
  'A_UP',
  'A_E_UP',
  'A_SHIELD',
  'A_E_SHIELD',
  'A_IMUATK',
  'A_CURSE',
  'A_E_CURSE',
  'A_SEAL',
  'A_E_SEAL'
]);

export const BCU_STATUS_EFFECT_SPECS = Object.freeze({
  A_DOWN: {
    phase: 'A',
    image: 'org/battle/s0/skill000.png',
    imgcut: 'org/battle/s0/skill000.imgcut',
    model: 'org/battle/s0/down/skill_down.mamodel',
    variants: { DEF: 'org/battle/s0/down/skill_down.maanim' }
  },
  A_E_DOWN: {
    phase: 'A',
    image: 'org/battle/s0/skill000.png',
    imgcut: 'org/battle/s0/skill000.imgcut',
    model: 'org/battle/s0/down/skill_down_e.mamodel',
    variants: { DEF: 'org/battle/s0/down/skill_down_e.maanim' }
  },
  A_UP: {
    phase: 'A',
    image: 'org/battle/s0/skill000.png',
    imgcut: 'org/battle/s0/skill000.imgcut',
    model: 'org/battle/s0/up/skill_up.mamodel',
    variants: { DEF: 'org/battle/s0/up/skill_up.maanim' }
  },
  A_E_UP: {
    phase: 'A',
    image: 'org/battle/s0/skill000.png',
    imgcut: 'org/battle/s0/skill000.imgcut',
    model: 'org/battle/s0/up/skill_up_e.mamodel',
    variants: { DEF: 'org/battle/s0/up/skill_up_e.maanim' }
  },
  A_SLOW: {
    phase: 'A',
    image: 'org/battle/s0/skill000.png',
    imgcut: 'org/battle/s0/skill000.imgcut',
    model: 'org/battle/s0/slow/skill_slow.mamodel',
    variants: { DEF: 'org/battle/s0/slow/skill_slow.maanim' }
  },
  A_E_SLOW: {
    phase: 'A',
    image: 'org/battle/s0/skill000.png',
    imgcut: 'org/battle/s0/skill000.imgcut',
    model: 'org/battle/s0/slow/skill_slow_e.mamodel',
    variants: { DEF: 'org/battle/s0/slow/skill_slow_e.maanim' }
  },
  A_STOP: {
    phase: 'A',
    image: 'org/battle/s0/skill000.png',
    imgcut: 'org/battle/s0/skill000.imgcut',
    model: 'org/battle/s0/stop/skill_stop.mamodel',
    variants: { DEF: 'org/battle/s0/stop/skill_stop.maanim' }
  },
  A_E_STOP: {
    phase: 'A',
    image: 'org/battle/s0/skill000.png',
    imgcut: 'org/battle/s0/skill000.imgcut',
    model: 'org/battle/s0/stop/skill_stop_e.mamodel',
    variants: { DEF: 'org/battle/s0/stop/skill_stop_e.maanim' }
  },
  A_SHIELD: {
    phase: 'A',
    image: 'org/battle/s0/skill000.png',
    imgcut: 'org/battle/s0/skill000.imgcut',
    model: 'org/battle/s0/shield/skill_shield.mamodel',
    variants: { DEF: 'org/battle/s0/shield/skill_shield.maanim' }
  },
  A_E_SHIELD: {
    phase: 'A',
    image: 'org/battle/s0/skill000.png',
    imgcut: 'org/battle/s0/skill000.imgcut',
    model: 'org/battle/s0/shield/skill_shield_e.mamodel',
    variants: { DEF: 'org/battle/s0/shield/skill_shield_e.maanim' }
  },
  A_IMUATK: {
    phase: 'A',
    image: 'org/battle/s7/skill007.png',
    imgcut: 'org/battle/s7/skill007.imgcut',
    model: 'org/battle/s7/skill_attack_invalid.mamodel',
    variants: { DEF: 'org/battle/s7/skill_attack_invalid.maanim' }
  },
  A_CURSE: {
    phase: 'A',
    image: 'org/battle/s3/skill003.png',
    imgcut: 'org/battle/s3/skill003.imgcut',
    model: 'org/battle/s3/skill_curse.mamodel',
    variants: { DEF: 'org/battle/s3/skill_curse.maanim' }
  },
  A_E_CURSE: {
    phase: 'A',
    image: 'org/battle/s11/skill011.png',
    imgcut: 'org/battle/s11/skill011.imgcut',
    model: 'org/battle/s11/skill_curse_e.mamodel',
    variants: { DEF: 'org/battle/s11/skill_curse_e.maanim' }
  },
  A_SEAL: {
    phase: 'A',
    image: 'org/battle/s3/seal/seal.png',
    imgcut: 'org/battle/s3/seal/seal.imgcut',
    model: 'org/battle/s3/seal/seal.mamodel',
    variants: { DEF: 'org/battle/s3/seal/seal.maanim' }
  },
  A_E_SEAL: {
    phase: 'A',
    image: 'org/battle/s3/seal_e/seal_e.png',
    imgcut: 'org/battle/s3/seal_e/seal_e.imgcut',
    model: 'org/battle/s3/seal_e/seal_e.mamodel',
    variants: { DEF: 'org/battle/s3/seal_e/seal_e.maanim' }
  },
  A_POISON: {
    phase: 'B',
    image: 'org/battle/s3/poison.png',
    imgcut: 'org/battle/s3/poison/poison.imgcut',
    model: 'org/battle/s3/poison/poison.mamodel',
    variants: { DEF: 'org/battle/s3/poison/poison.maanim' }
  }
});

export function getStatusEffectKey(statusKey, actor) {
  const enemy = actor?.side === 'cat-enemy';
  if (statusKey === 'STOP') return enemy ? 'A_E_STOP' : 'A_STOP';
  if (statusKey === 'SLOW') return enemy ? 'A_E_SLOW' : 'A_SLOW';
  if (statusKey === 'WEAK') return enemy ? 'A_E_DOWN' : 'A_DOWN';
  if (statusKey === 'STRONG') return enemy ? 'A_E_UP' : 'A_UP';
  if (statusKey === 'LETHAL') return enemy ? 'A_E_SHIELD' : 'A_SHIELD';
  if (statusKey === 'ATTACK_NULLIFY') return 'A_IMUATK';
  if (statusKey === 'CURSE') return enemy ? 'A_E_CURSE' : 'A_CURSE';
  if (statusKey === 'SEAL') return enemy ? 'A_E_SEAL' : 'A_SEAL';
  if (statusKey === 'POISON') return 'A_POISON';
  if (statusKey === 'WARP') return 'A_W';
  return null;
}
