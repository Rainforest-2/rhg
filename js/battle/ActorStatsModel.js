export function normalizePercent(value, fallback = 100) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function scalePositive(value, percent, min = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return Math.max(min, Math.round((n * percent) / 100));
}

// BCU enemy HP and HP-derived proc values use a Java int cast after the full float multiplier.
export function scaleEnemyHp(value, percent, min = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return Math.max(min, Math.trunc((n * percent) / 100));
}

// BCU AtkModelEntity uses Math.round(rawAttack * atkMagnif) for enemy attack values.
export function scaleEnemyAttack(value, percent, min = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return Math.max(min, Math.round((n * percent) / 100));
}

function cloneNested(source, key) {
  const value = source?.[key];
  return value && typeof value === 'object' ? { ...value } : value;
}

function scaleHpDerivedProc(proc, hpPercent) {
  if (!proc || typeof proc !== 'object') return proc;
  const out = { ...proc };
  for (const key of ['barrier', 'BARRIER']) {
    const item = cloneNested(proc, key);
    if (item && Number.isFinite(Number(item.health))) item.health = scaleEnemyHp(item.health, hpPercent, 0);
    out[key] = item;
  }
  for (const key of ['demonShield', 'DEMONSHIELD']) {
    const item = cloneNested(proc, key);
    if (item && Number.isFinite(Number(item.hp))) item.hp = scaleEnemyHp(item.hp, hpPercent, 0);
    out[key] = item;
  }
  for (const key of ['damageCut', 'DMGCUT', 'damageCap', 'DMGCAP']) {
    const item = cloneNested(proc, key);
    if (item && item?.type?.magnif === true && Number.isFinite(Number(item.dmg))) {
      item.dmg = scaleEnemyHp(item.dmg, hpPercent, 0);
    }
    out[key] = item;
  }
  for (const key of ['hpRegen', 'HPREGEN']) {
    const item = cloneNested(proc, key);
    if (item && item.scaleWithBuff === true && Number.isFinite(Number(item.amount))) {
      item.amount = scaleEnemyHp(item.amount, hpPercent, 0);
    }
    out[key] = item;
  }
  return out;
}

function buildScaledCombatOverrides(baseStats, hpPercent) {
  const baseCombatModel = baseStats?.bcuCombatModel;
  const baseProc = baseCombatModel?.proc || baseStats?.bcuProc || baseStats?.abilityModel?.proc || null;
  const scaledProc = scaleHpDerivedProc(baseProc, hpPercent);
  if (!scaledProc) return {};
  const bcuCombatModel = baseCombatModel ? { ...baseCombatModel, proc: scaledProc } : baseCombatModel;
  const abilityModel = baseStats?.abilityModel ? { ...baseStats.abilityModel, proc: scaledProc } : baseStats?.abilityModel;
  const abilities = baseStats?.abilities ? { ...baseStats.abilities, proc: scaledProc } : baseStats?.abilities;
  return { bcuCombatModel, bcuProc: scaledProc, abilityModel, abilities };
}

export class ActorStatsModel {
  static normalizePercent(value, fallback = 100) {
    return normalizePercent(value, fallback);
  }

  static scalePositive(value, percent, min = 0) {
    return scalePositive(value, percent, min);
  }

  static fromBaseStats(baseStats, options = {}) {
    return {
      source: options.source || 'base-stats',
      rawStats: baseStats?.rawValues || null,
      baseStats,
      finalStats: baseStats,
      stageMagnification: null,
      levelMagnification: options.levelMagnification || null,
      warnings: [],
      debug: {
        baseHp: baseStats?.hp ?? null,
        scaledHp: baseStats?.hp ?? null,
        baseDamage: baseStats?.damage ?? null,
        scaledDamage: baseStats?.damage ?? null,
        stageMagnificationApplied: false
      }
    };
  }

  static applyStageEnemyMagnification(baseStats, modifiers = {}) {
    const model = this.fromBaseStats(baseStats, { source: modifiers.source || 'bcu-stage-csv-row' });
    if (!baseStats || typeof baseStats !== 'object') {
      model.warnings.push('missing-base-stats');
      model.debug.warnings = [...model.warnings];
      return model;
    }

    const hpMagRaw = modifiers.hpMagnification ?? modifiers.magnification;
    const atkMagRaw = modifiers.attackMagnification ?? modifiers.magnification;
    if (!Number.isFinite(Number(hpMagRaw)) && hpMagRaw !== undefined) model.warnings.push('invalid-hp-magnification');
    if (!Number.isFinite(Number(atkMagRaw)) && atkMagRaw !== undefined) model.warnings.push('invalid-attack-magnification');

    const hpMag = normalizePercent(hpMagRaw, 100);
    const atkMag = normalizePercent(atkMagRaw, 100);
    const magnification = normalizePercent(modifiers.magnification, 100);

    const stageMagnification = {
      source: modifiers.source || 'bcu-stage-csv-row',
      rowIndex: modifiers.rowIndex ?? null,
      rawEnemyId: modifiers.rawEnemyId ?? null,
      sourceEnemyId: modifiers.sourceEnemyId ?? null,
      enemyId: modifiers.enemyId ?? baseStats?.source?.enemyId ?? null,
      magnification,
      hpMagnification: hpMag,
      attackMagnification: atkMag,
      hpMagnificationFactor: hpMag / 100,
      attackMagnificationFactor: atkMag / 100,
      crownMagnificationPercent: modifiers.crownMagnificationPercent ?? null,
      conversion: {
        hp: 'Math.trunc(baseHp * hpMagnification / 100)',
        attack: 'Math.round(baseAttack * attackMagnification / 100)'
      }
    };

    const scaledHits = Array.isArray(baseStats.attackHits)
      ? baseStats.attackHits.map((hit, index) => {
        const baseDamage = Number.isFinite(hit?.baseDamage) ? hit.baseDamage : (Number.isFinite(hit?.damage) ? hit.damage : null);
        const scaledDamage = scaleEnemyAttack(hit?.damage, atkMag, 0);
        return {
          ...hit,
          baseDamage,
          damage: scaledDamage,
          stageAttackMagnification: atkMag,
          hitIndex: Number.isFinite(hit?.hitIndex) ? hit.hitIndex : index
        };
      })
      : baseStats.attackHits;

    const scaledHp = scaleEnemyHp(baseStats.hp, hpMag, 1);
    const scaledDamage = scaleEnemyAttack(baseStats.damage, atkMag, 0);
    const scaledCombatOverrides = buildScaledCombatOverrides(baseStats, hpMag);

    const source = {
      ...(baseStats.source || {}),
      stageMagnificationApplied: true,
      stageMagnification: {
        rowIndex: stageMagnification.rowIndex,
        magnification: stageMagnification.magnification,
        hpMagnification: stageMagnification.hpMagnification,
        attackMagnification: stageMagnification.attackMagnification,
        hpMagnificationFactor: stageMagnification.hpMagnificationFactor,
        attackMagnificationFactor: stageMagnification.attackMagnificationFactor
      },
      baseHp: baseStats.hp,
      baseDamage: baseStats.damage
    };

    const debug = {
      source: stageMagnification.source,
      rowIndex: stageMagnification.rowIndex,
      rawEnemyId: stageMagnification.rawEnemyId,
      sourceEnemyId: stageMagnification.sourceEnemyId,
      enemyId: stageMagnification.enemyId,
      baseHp: baseStats.hp ?? null,
      scaledHp,
      baseDamage: baseStats.damage ?? null,
      scaledDamage,
      magnification: stageMagnification.magnification,
      hpMagnification: stageMagnification.hpMagnification,
      attackMagnification: stageMagnification.attackMagnification,
      hpConversion: stageMagnification.conversion.hp,
      attackConversion: stageMagnification.conversion.attack,
      attackHits: Array.isArray(scaledHits)
        ? scaledHits.map((hit, index) => ({
          hitIndex: Number.isFinite(hit?.hitIndex) ? hit.hitIndex : index,
          baseDamage: Number.isFinite(hit?.baseDamage) ? hit.baseDamage : null,
          scaledDamage: Number.isFinite(hit?.damage) ? hit.damage : null,
          stageAttackMagnification: hit?.stageAttackMagnification ?? atkMag
        }))
        : [],
      warnings: [...model.warnings]
    };

    const finalStats = {
      ...baseStats,
      ...scaledCombatOverrides,
      baseHp: baseStats.hp,
      baseDamage: baseStats.damage,
      hp: scaledHp,
      damage: scaledDamage,
      attackHits: scaledHits,
      stageMagnification,
      source,
      statsModelDebug: debug
    };

    model.baseStats = baseStats;
    model.finalStats = finalStats;
    model.stageMagnification = stageMagnification;
    model.debug = {
      ...model.debug,
      ...debug,
      stageMagnificationApplied: true
    };
    model.finalStats.actorStatsModel = model;
    return model;
  }

  static toStatsObject(model) {
    return model?.finalStats;
  }

  static describe(model) {
    if (!model) return null;
    const debug = model.debug || model.finalStats?.statsModelDebug || {};
    return {
      source: debug.source || model.source || null,
      rowIndex: debug.rowIndex ?? null,
      rawEnemyId: debug.rawEnemyId ?? null,
      sourceEnemyId: debug.sourceEnemyId ?? null,
      enemyId: debug.enemyId ?? null,
      baseHp: debug.baseHp ?? model.baseStats?.hp ?? null,
      scaledHp: debug.scaledHp ?? model.finalStats?.hp ?? null,
      baseDamage: debug.baseDamage ?? model.baseStats?.damage ?? null,
      scaledDamage: debug.scaledDamage ?? model.finalStats?.damage ?? null,
      magnification: debug.magnification ?? model.stageMagnification?.magnification ?? null,
      hpMagnification: debug.hpMagnification ?? model.stageMagnification?.hpMagnification ?? null,
      attackMagnification: debug.attackMagnification ?? model.stageMagnification?.attackMagnification ?? null,
      attackHits: Array.isArray(debug.attackHits) ? debug.attackHits : [],
      stageMagnification: model.stageMagnification || null,
      warnings: Array.isArray(model.warnings) ? model.warnings : []
    };
  }
}
