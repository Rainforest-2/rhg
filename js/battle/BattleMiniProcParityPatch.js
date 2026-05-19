import { ProcResolver } from './ProcResolver.js';

const PATCH_FLAG = Symbol.for('wanko-battle.mini-proc-parity-patch.v1');
const DEFAULT_MINI_MULT = 20;

function finiteNonZero(value) {
  const n = Number(value);
  return Number.isFinite(n) && n !== 0 ? n : null;
}

function normalizeMiniWavePayload(payload = {}) {
  const mult = finiteNonZero(payload.mult ?? payload.multi ?? payload.damageMultiplier) ?? DEFAULT_MINI_MULT;
  payload.mult = mult;
  payload.damageMultiplier = mult;
  payload.bcuReference = payload.bcuReference || 'BCU MINIWAVE defaults multi to 20 when unset or zero';
  return payload;
}

function normalizeMiniSurgePayload(payload = {}) {
  const source = payload.miniVolcano || payload.miniVolc || payload;
  const mult = finiteNonZero(source?.mult ?? source?.multi ?? payload.mult ?? payload.damageMultiplier) ?? DEFAULT_MINI_MULT;
  const miniVolcano = { ...(source || {}), mult };
  payload.miniVolcano = miniVolcano;
  payload.mult = mult;
  payload.damageMultiplier = mult;
  payload.bcuReference = payload.bcuReference || 'BCU MINIVOLC defaults mult to 20 when unset or zero';
  return payload;
}

function normalizeItem(item) {
  if (!item?.payload) return item;
  if (item.key === 'miniWave') normalizeMiniWavePayload(item.payload);
  else if (item.key === 'miniSurge') normalizeMiniSurgePayload(item.payload);
  return item;
}

export function installBattleMiniProcParityPatch() {
  if (!ProcResolver || ProcResolver[PATCH_FLAG]) return;
  ProcResolver[PATCH_FLAG] = true;
  const originalResolve = ProcResolver.resolve;
  if (typeof originalResolve !== 'function') return;
  ProcResolver.resolve = function resolveWithMiniProcParity(...args) {
    const result = originalResolve.apply(this, args);
    for (const item of result?.pending || []) normalizeItem(item);
    for (const item of result?.applied || []) normalizeItem(item);
    for (const item of result?.skipped || []) normalizeItem(item);
    return result;
  };
}

installBattleMiniProcParityPatch();
