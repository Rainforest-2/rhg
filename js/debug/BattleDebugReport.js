function last(list = []) {
  return Array.isArray(list) && list.length ? list[list.length - 1] : null;
}

function compactActor(actor) {
  if (!actor) return null;
  const dmg = actor.lastDamageCalculation || actor.lastIncomingDamageCalculation || null;
  return {
    id: actor.instanceId || actor.label || null,
    slotId: actor.slotId || null,
    side: actor.side || null,
    state: actor.state || null,
    hp: actor.hp ?? null,
    maxHp: actor.maxHp ?? null,
    x: Number.isFinite(actor.x) ? Math.round(actor.x) : null,
    traits: actor.traits || actor.abilityModel?.traits?.list || [],
    abi: actor.abilityModel?.bcuAbi ?? actor.rawStats?.abilityModel?.bcuAbi ?? null,
    procStatus: actor.bcuProcStatuses || null,
    lastDamage: dmg ? {
      source: dmg.source || null,
      baseDamage: dmg.baseDamage ?? null,
      rawBaseDamage: dmg.rawBaseDamage ?? null,
      finalDamage: dmg.finalDamage ?? null,
      multiplier: dmg.multiplier ?? null,
      applied: dmg.applied || null,
      notes: dmg.modifiers?.notes || dmg.notes || [],
      abilityApplied: dmg.abilityResolver?.applied || null,
      abilityDetails: dmg.abilityResolver?.appliedDetails || [],
      proc: dmg.proc ? {
        applied: dmg.proc.applied || [],
        pending: dmg.proc.pending || [],
        skipped: dmg.proc.skipped || []
      } : null,
      debug: dmg.abilityResolver?.debug || dmg.abilityDebug || null
    } : null,
    lastHitQueueDebug: actor.lastHitQueueDebug || null,
    lastIncomingDamageCalculation: actor.lastIncomingDamageCalculation ? {
      source: actor.lastIncomingDamageCalculation.source || null,
      baseDamage: actor.lastIncomingDamageCalculation.baseDamage ?? null,
      finalDamage: actor.lastIncomingDamageCalculation.finalDamage ?? null,
      applied: actor.lastIncomingDamageCalculation.applied || null,
      abilityApplied: actor.lastIncomingDamageCalculation.abilityResolver?.applied || null,
      abilityDetails: actor.lastIncomingDamageCalculation.abilityResolver?.appliedDetails || []
    } : null,
    capture: actor.lastCaptureDebug || null,
    attackWait: actor.lastAttackWaitDebug || actor.lastStageBasisAttackWaitDebug || null,
    barrierShield: actor.lastBcuBarrierShieldDebug || null,
    zombie: actor.lastBcuZombieReviveDebug || actor.lastBcuZombieCorpseDebug || null,
    soulstrike: actor.lastBcuSoulstrikeDebug || null,
    slowMove: actor.lastBcuSlowMoveDebug || null,
    toxic: actor.lastBcuToxicDebug || null
  };
}

function pickEvents(events = []) {
  const interesting = new Set([
    'attackTimelineHitDue', 'attackTargetsCaptured', 'attackDamageResolved', 'damageQueued', 'baseDamageQueued',
    'procResolved', 'bcuProcApplied', 'bcuWaveQueued', 'bcuWaveResolved', 'bcuSurgeQueued', 'bcuSurgeResolved',
    'kbRuntimePostDamage', 'attackStart', 'attackComplete', 'enemySpawned', 'stageEnemySpawned', 'playerSpawned'
  ]);
  return (Array.isArray(events) ? events : [])
    .filter((e) => interesting.has(e?.type))
    .slice(-12)
    .map((e) => ({
      timeMs: e.timeMs ?? null,
      type: e.type,
      actor: e.actor ?? null,
      target: e.target ?? null,
      targetType: e.targetType ?? null,
      damage: e.damage ?? null,
      baseDamage: e.baseDamage ?? null,
      finalDamage: e.finalDamage ?? null,
      damageApplied: e.damageApplied ?? null,
      abilityResolver: e.abilityResolver ?? null,
      procApplied: e.procApplied ?? e.appliedCount ?? null,
      procSkipped: e.procSkipped ?? e.skippedCount ?? null,
      reason: e.reason ?? null,
      source: e.source ?? null
    }));
}

function latestDamageEvent(events = []) {
  const e = [...(Array.isArray(events) ? events : [])].reverse().find((ev) => ev?.type === 'damageQueued' || ev?.type === 'baseDamageQueued');
  if (!e) return null;
  return {
    timeMs: e.timeMs ?? null,
    actor: e.actor ?? null,
    target: e.target ?? null,
    targetType: e.targetType ?? null,
    damage: e.damage ?? null,
    baseDamage: e.baseDamage ?? null,
    finalDamage: e.finalDamage ?? null,
    multiplier: e.damageMultiplier ?? null,
    applied: e.damageApplied || null,
    notes: e.damageNotes || [],
    abilityResolver: e.abilityResolver || null,
    rawAbi: e.rawAbi ?? null,
    abilityMappingStatus: e.abilityMappingStatus || null
  };
}

export function buildBattleDebugReport(scene) {
  if (!scene) return { ready: false, reason: 'scene-missing' };
  const actors = Array.isArray(scene.actors) ? scene.actors : [];
  const playerActors = actors.filter((a) => a?.side === 'dog-player');
  const enemyActors = actors.filter((a) => a?.side !== 'dog-player');
  const focusedActor = [...actors].reverse().find((a) => a?.lastDamageCalculation || a?.lastIncomingDamageCalculation || a?.lastHitQueueDebug) || last(actors);
  const latestDamage = latestDamageEvent(scene.debugEvents || []);
  return {
    ready: true,
    version: 'BattleDebugReport.v1-unified-always-on',
    timeMs: scene.timeMs ?? 0,
    logicFrame: scene.logicFrame ?? 0,
    battleState: scene.battleState || null,
    tickPhase: scene.currentTickPhase || scene.lastTickPhase || null,
    rng: scene.lastBcuRandomDebug || null,
    counts: {
      actors: actors.length,
      playerActors: playerActors.length,
      enemyActors: enemyActors.length,
      effects: scene.effects?.length || 0,
      debugEvents: scene.debugEvents?.length || 0
    },
    economy: scene.economy ? {
      money: scene.economy.money ?? null,
      maxMoney: scene.economy.maxMoney ?? null,
      walletLevel: scene.economy.walletLevel ?? scene.economy.workerLevel ?? null,
      debug: scene.economy.lastDebug || scene.economy.lastTickDebug || null
    } : null,
    latestDamage,
    focus: compactActor(focusedActor),
    actors: actors.slice(-8).map(compactActor),
    events: pickEvents(scene.debugEvents || []),
    queues: {
      wave: Array.isArray(scene.__bcuWaveQueue) ? scene.__bcuWaveQueue.length : 0,
      surge: Array.isArray(scene.__bcuSurgeQueue) ? scene.__bcuSurgeQueue.length : 0,
      worldAttack: Array.isArray(scene.__bcuWorldAttackQueue) ? scene.__bcuWorldAttackQueue.length : 0
    },
    stage: {
      selectedStageId: scene.stage?.selectedStageId || null,
      stageKey: scene.stage?.stageKey || null,
      spawnRuntime: scene.stageSpawnRuntime?.debug || scene.stage?.runtime || null
    }
  };
}
