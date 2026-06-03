import { BCU_BATTLE_TIMER_PERIOD_MS } from '../BattleFrameClock.js';

function toFinite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function int(value, fallback = 0) {
  return Math.trunc(toFinite(value, fallback));
}

export function buildBcuDelayVector(payload = {}) {
  if (Array.isArray(payload.delay)) {
    const delay = [int(payload.delay[0], 0), int(payload.delay[1], 0), int(payload.delay[2], 0)];
    const explicitType = Number(payload.type ?? payload.delayType);
    const type = Number.isFinite(explicitType)
      ? Math.max(0, Math.min(2, Math.trunc(explicitType)))
      : Math.max(0, delay.findIndex((value) => value !== 0));
    return { type, strength: delay[type] || 0, delay };
  }
  const type = Math.max(0, Math.min(2, int(payload.type ?? payload.delayType ?? 0, 0)));
  const strength = int(payload.strength ?? payload.mult ?? payload.value ?? 0, 0);
  const delay = [0, 0, 0];
  delay[type] = strength;
  return { type, strength, delay };
}

export function getBcuDelayStrength(current, max, delay = [0, 0, 0]) {
  const cur = Math.max(0, int(current, 0));
  const maxC = Math.max(0, int(max, cur));
  const prog = maxC - cur;
  let inc = 0;
  const d0 = int(delay[0], 0);
  const d1 = int(delay[1], 0);
  const d2 = int(delay[2], 0);
  if (d0 !== 0) {
    let add = Math.min(Math.trunc(prog * Math.min(100, d0) / 100), maxC);
    if (add === 0) add = d0 < 0 ? -1 : 1;
    inc += add;
  }
  if (d1 !== 0) {
    inc += Math.min(d1, cur);
  }
  if (d2 !== 0) {
    let add = Math.min(Math.trunc(maxC * Math.min(100, d2) / 100), maxC);
    if (add === 0) add = d2 < 0 ? -1 : 1;
    inc += add;
  }
  return inc;
}

function cooldownFramesFromUnit(unitDef = {}, fallback = 0) {
  const bcuFrames = toFinite(unitDef?.bcuRespawnFrames, NaN);
  if (Number.isFinite(bcuFrames) && bcuFrames >= 0) return Math.floor(bcuFrames);
  const cooldownMs = toFinite(unitDef?.cooldownMs, NaN);
  if (Number.isFinite(cooldownMs) && cooldownMs >= 0) return Math.ceil(cooldownMs / BCU_BATTLE_TIMER_PERIOD_MS);
  return Math.max(0, int(fallback, 0));
}

function getEconomyCooldownFrames(economy, slotId) {
  if (!economy || !slotId) return 0;
  if (typeof economy.getCooldownFrames === 'function') return Math.max(0, int(economy.getCooldownFrames(slotId), 0));
  if (economy.cooldownFrames instanceof Map) return Math.max(0, int(economy.cooldownFrames.get(slotId), 0));
  const ms = economy.cooldowns instanceof Map ? toFinite(economy.cooldowns.get(slotId), 0) : 0;
  return Math.max(0, Math.ceil(ms / BCU_BATTLE_TIMER_PERIOD_MS));
}

function setEconomyCooldownFrames(economy, slotId, frames) {
  const next = Math.max(0, int(frames, 0));
  if (!economy || !slotId) return false;
  if (!(economy.cooldownFrames instanceof Map)) economy.cooldownFrames = new Map();
  if (!(economy.cooldowns instanceof Map)) economy.cooldowns = new Map();
  if (next <= 0) {
    economy.cooldownFrames.delete(slotId);
    economy.cooldowns.delete(slotId);
  } else {
    economy.cooldownFrames.set(slotId, next);
    economy.cooldowns.set(slotId, next * BCU_BATTLE_TIMER_PERIOD_MS);
  }
  return true;
}

function aggregateDelayItems(items = []) {
  const delay = [0, 0, 0];
  for (const item of items) {
    const vector = buildBcuDelayVector(item?.payload || {});
    for (let i = 0; i < 3; i += 1) delay[i] += int(vector.delay[i], 0);
  }
  return delay;
}

function ensureDelayQueue(scene) {
  if (!scene) return null;
  if (!Array.isArray(scene.__bcuDelayProcQueue)) scene.__bcuDelayProcQueue = [];
  return scene.__bcuDelayProcQueue;
}

function findProductionUnit(scene, slotId) {
  if (!scene || !slotId) return null;
  if (typeof scene.findPlayerProductionUnit === 'function') return scene.findPlayerProductionUnit(slotId) || null;
  return (scene.playerProductionRoster || []).find((u) => u?.slotId === slotId) || null;
}

export function applyBcuPlayerCooldownDelay({ actor, scene = actor?.scene || null, payload = {} } = {}) {
  const economy = scene?.economy || null;
  const slotId = actor?.slotId || actor?.sourceSlotId || null;
  const current = getEconomyCooldownFrames(economy, slotId);
  if (!economy || !slotId) return { applied: false, reason: 'economy-or-slot-missing', target: 'player-cooldown' };
  if (current <= 0) return { applied: false, reason: 'cooldown-not-active', target: 'player-cooldown', slotId, current };
  const unitDef = findProductionUnit(scene, slotId) || actor?.assetDef || {};
  const max = Math.max(current, cooldownFramesFromUnit(unitDef, current));
  const { type, strength, delay } = buildBcuDelayVector(payload);
  const inc = getBcuDelayStrength(current, max, delay);
  const next = Math.max(0, Math.min(max, current + inc));
  setEconomyCooldownFrames(economy, slotId, next);
  const debug = {
    source: 'BcuDelayRuntime.applyBcuPlayerCooldownDelay',
    bcuReference: 'EUnit.postUpdate -> basis.cdDelay[row][col]; StageBasis.update -> ELineUp.delay; ELineUp.delay uses StageBasis.getDelayStrength and clamps to max cooldown',
    target: 'player-cooldown',
    slotId,
    current,
    max,
    type,
    strength,
    delay,
    inc,
    next
  };
  economy.lastBcuDelayDebug = debug;
  actor.lastBcuDelayDebug = debug;
  scene?.pushEvent?.({ ...debug, type: 'bcuDelayCooldownApplied', delayType: type });
  return { applied: inc !== 0 || next !== current, ...debug };
}

function rowIndexOfActor(actor) {
  const candidates = [
    actor?.stageSpawnRowIndex,
    actor?.customStageBattleRowIndex,
    actor?.stageSpawn?.rowIndex,
    actor?.stageSpawn?.row?.rowIndex
  ];
  for (const value of candidates) {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return null;
}

function findStageSpawnRuntimes(scene, actor) {
  const out = [];
  if (scene?.stageSpawnRuntime) out.push({ runtime: scene.stageSpawnRuntime, source: 'scene.stageSpawnRuntime' });
  for (const state of scene?.customStageBattle?.stageStates || []) {
    if (!state?.spawnRuntime) continue;
    if (actor?.side && state.side && actor.side !== state.side) continue;
    if (actor?.customStageBattleStageKey && state.stageKey && actor.customStageBattleStageKey !== state.stageKey) continue;
    out.push({ runtime: state.spawnRuntime, source: 'customStageBattle.spawnRuntime', stageKey: state.stageKey || null });
  }
  return out;
}

function findRowState(runtime, rowIndex) {
  if (!runtime || !Array.isArray(runtime.rows) || !Number.isFinite(rowIndex)) return null;
  return runtime.rows.find((row) => Number(row?.rowIndex) === rowIndex) || null;
}

function rowMaxRespawn(rowState, current) {
  const row = rowState?.row || rowState?.def || {};
  const values = [row.respawnMinFrame, row.respawnMaxFrame, row.respawn_0, row.respawn_1, row.respawnMin, row.respawnMax]
    .map((v) => int(v, NaN))
    .filter((v) => Number.isFinite(v) && v >= 0);
  return Math.max(current, ...values, 0);
}

export function applyBcuStageLineDelay({ actor, scene = actor?.scene || null, payload = {} } = {}) {
  const rowIndex = rowIndexOfActor(actor);
  if (!scene || rowIndex === null) return { applied: false, reason: 'stage-row-missing', target: 'stage-line-delay', rowIndex };
  const { type, strength, delay } = buildBcuDelayVector(payload);
  for (const entry of findStageSpawnRuntimes(scene, actor)) {
    const runtime = entry.runtime;
    const rowState = findRowState(runtime, rowIndex);
    if (!rowState) continue;
    if (rowState.exhausted || rowState.done || rowState.disabled) return { applied: false, reason: 'stage-row-inactive', target: 'stage-line-delay', rowIndex };
    const frame = Math.max(0, int(runtime.lastTickFrame ?? scene.logicFrame ?? 0, 0));
    const current = Math.max(0, int(rowState.nextFrame, frame) - frame);
    if (current <= 0) return { applied: false, reason: 'stage-line-rem-not-active', target: 'stage-line-delay', rowIndex, current };
    const max = rowMaxRespawn(rowState, current);
    const inc = getBcuDelayStrength(current, max, delay);
    const nextRemaining = Math.max(0, current + inc);
    rowState.nextFrame = frame + nextRemaining;
    rowState.nextAtFrame = rowState.nextFrame;
    rowState.lastBcuDelayDebug = {
      source: 'BcuDelayRuntime.applyBcuStageLineDelay',
      bcuReference: 'EEnemy.postUpdate -> basis.lineDelay[line]; StageBasis.update -> EStage.delay; EStage.delay uses StageBasis.getDelayStrength and clamps rem >= 0',
      target: 'stage-line-delay',
      rowIndex,
      current,
      max,
      type,
      strength,
      delay,
      inc,
      nextRemaining,
      nextFrame: rowState.nextFrame,
      runtimeSource: entry.source
    };
    actor.lastBcuDelayDebug = rowState.lastBcuDelayDebug;
    scene.pushEvent?.({ ...rowState.lastBcuDelayDebug, type: 'bcuDelayStageLineApplied', delayType: type });
    return { applied: inc !== 0 || nextRemaining !== current, ...rowState.lastBcuDelayDebug };
  }
  return { applied: false, reason: 'stage-spawn-runtime-missing', target: 'stage-line-delay', rowIndex };
}

export function applyBcuDelayProc(actor, item = {}, meta = {}) {
  if (!actor || item?.key !== 'delay') return { applied: false, reason: 'not-delay' };
  const payload = item.payload || {};
  if (actor.side === 'dog-player') return applyBcuPlayerCooldownDelay({ actor, scene: meta.scene || actor.scene || null, payload });
  if (actor.side === 'cat-enemy') return applyBcuStageLineDelay({ actor, scene: meta.scene || actor.scene || null, payload });
  return { applied: false, reason: 'unsupported-side-for-delay', side: actor.side || null };
}

export function queueBcuDelayProc(actor, item = {}, meta = {}) {
  if (!actor || item?.key !== 'delay') return { applied: false, reason: 'not-delay' };
  const scene = meta.scene || actor.scene || null;
  const queue = ensureDelayQueue(scene);
  if (!queue) return applyBcuDelayProc(actor, item, meta);
  const vector = buildBcuDelayVector(item.payload || {});
  if (!vector.delay.some((value) => value !== 0)) return { applied: false, reason: 'zero-delay-strength', item };
  const entry = {
    actor,
    item: { ...item, payload: { ...(item.payload || {}), delay: vector.delay, type: vector.type, strength: vector.strength } },
    meta,
    frame: int(scene.logicFrame, 0),
    source: 'BcuDelayRuntime.queueBcuDelayProc',
    bcuReference: 'EUnit/EEnemy.processProcs accumulates status[P_DELAY][type]; postUpdate later routes aggregate delay to StageBasis cdDelay/lineDelay'
  };
  queue.push(entry);
  actor.lastBcuDelayQueueDebug = {
    source: entry.source,
    queued: true,
    frame: entry.frame,
    delay: vector.delay,
    queueSize: queue.length,
    bcuReference: entry.bcuReference
  };
  scene.pushEvent?.({
    type: 'bcuDelayQueued',
    source: entry.source,
    target: actor.instanceId || actor.label || null,
    frame: entry.frame,
    delayType: vector.type,
    strength: vector.strength,
    delay: vector.delay,
    queueSize: queue.length
  });
  return { applied: true, queued: true, target: actor.side === 'dog-player' ? 'player-cooldown' : 'stage-line-delay', delay: vector.delay, item: entry.item };
}

export function flushBcuDelayProcQueues(scene, reason = 'proc-resolve') {
  const queue = ensureDelayQueue(scene);
  if (!queue || queue.length === 0) return { processed: 0, applied: 0, skipped: 0, reason, source: 'BcuDelayRuntime.flushBcuDelayProcQueues' };
  const batch = queue.splice(0, queue.length);
  const groups = new Map();
  for (const entry of batch) {
    const actor = entry.actor;
    if (!actor) continue;
    const current = groups.get(actor) || { actor, entries: [] };
    current.entries.push(entry);
    groups.set(actor, current);
  }
  let applied = 0;
  let skipped = 0;
  const results = [];
  for (const group of groups.values()) {
    const delay = aggregateDelayItems(group.entries.map((entry) => entry.item));
    const item = { key: 'delay', payload: { delay, type: Math.max(0, delay.findIndex((value) => value !== 0)), strength: delay.find((value) => value !== 0) || 0 } };
    const result = applyBcuDelayProc(group.actor, item, { ...(group.entries.at(-1)?.meta || {}), scene });
    if (result?.applied) applied += 1;
    else skipped += 1;
    group.actor.lastBcuDelayFlushDebug = {
      source: 'BcuDelayRuntime.flushBcuDelayProcQueues',
      bcuReference: 'StageBasis.update applies accumulated cdDelay/lineDelay once per tick after EUnit/EEnemy.postUpdate',
      reason,
      entryCount: group.entries.length,
      delay,
      result
    };
    results.push({ target: group.actor.instanceId || group.actor.label || null, entryCount: group.entries.length, delay, result });
  }
  scene.pushEvent?.({
    type: 'bcuDelayQueueFlushed',
    source: 'BcuDelayRuntime.flushBcuDelayProcQueues',
    bcuReference: 'StageBasis.update cdDelay/lineDelay aggregate flush',
    reason,
    processed: batch.length,
    groups: groups.size,
    applied,
    skipped,
    results
  });
  return { processed: batch.length, groups: groups.size, applied, skipped, results, reason, source: 'BcuDelayRuntime.flushBcuDelayProcQueues' };
}
