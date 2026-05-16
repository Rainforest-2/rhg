import { StageDefinitionLoader } from './StageDefinitionLoader.js';

const PATCH_FLAG = Symbol.for('wanko-battle.stage-definition-negative-spawn.v1');
const FRAME_MUL = 2;
const COL_E = 0;
const COL_S0 = 2;
const COL_S1 = 10;

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function patchRow(row) {
  if (!row || !Array.isArray(row.raw)) return;
  const rawFirst0 = num(row.raw[COL_S0], 0);
  let rawFirst1 = num(row.raw[COL_S1], rawFirst0);
  if (rawFirst1 === 0) rawFirst1 = rawFirst0;
  const firstMin = rawFirst0 * FRAME_MUL;
  const firstMax = rawFirst1 * FRAME_MUL;
  row.firstFrameMin = firstMin;
  row.firstFrameMax = firstMax;
  row.firstFrame = firstMin;
  row.firstMs = firstMin * 33;
  row.negativeFirstDelayFrames = firstMin < 0 ? Math.abs(firstMin) : 0;
  row.bcuNegativeFirstSpawn = firstMin < 0;
  row.bcuFirstSpawnPatchDebug = {
    source: 'BCU EStage.assign keeps initial rem value from spawn_0',
    rawEnemyId: num(row.raw[COL_E], null),
    rawFirst0,
    rawFirst1,
    firstFrameMin: firstMin,
    firstFrameMax: firstMax
  };
  if (row.scdef) {
    row.scdef.firstFrameMin = firstMin;
    row.scdef.firstFrameMax = firstMax;
  }
}

function patchDefinition(def) {
  const seen = new Set();
  for (const list of [def?.enemyRows, def?.activeEnemies, def?.enemies, def?.runtime?.enemyRows, def?.runtime?.sourceEnemyRows]) {
    if (!Array.isArray(list)) continue;
    for (const row of list) {
      if (!row || seen.has(row)) continue;
      seen.add(row);
      patchRow(row);
    }
  }
  if (def?.runtime) {
    def.runtime.negativeFirstSpawnSource = 'BCU EStage rem parity';
  }
  if (def) {
    def.negativeFirstSpawnSource = 'BCU EStage rem parity';
  }
  return def;
}

export function installStageDefinitionNegativeSpawnPatch() {
  const proto = StageDefinitionLoader?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;
  const originalParse = proto.parse;
  if (typeof originalParse !== 'function') {
    throw new Error('StageDefinitionLoader.parse is missing');
  }
  proto.parse = function parseWithNegativeFirstSpawn(...args) {
    return patchDefinition(originalParse.apply(this, args));
  };
}

installStageDefinitionNegativeSpawnPatch();
