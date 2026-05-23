import { StageDefinitionLoader } from './StageDefinitionLoader.js';
import { BCU_BATTLE_TIMER_PERIOD_MS } from './BattleFrameClock.js';

const PATCH_FLAG = Symbol.for('wanko-battle.stage-definition-negative-spawn.v2');
const FRAME_MUL = 2;
const COL_E = 0;
const COL_S0 = 2;
const COL_NEGATIVE_SPAWN_FLAG = 12;

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function isIntegerText(value) {
  return /^[-+]?\d+$/.test(String(value ?? '').trim());
}

function patchRow(row) {
  if (!row || !Array.isArray(row.raw)) return;
  const rawFirst0 = num(row.raw[COL_S0], 0);
  const negativeSpawnFlag = isIntegerText(row.raw[COL_NEGATIVE_SPAWN_FLAG]) && Number.parseInt(row.raw[COL_NEGATIVE_SPAWN_FLAG], 10) === 1;
  const firstMin = (negativeSpawnFlag ? -rawFirst0 : rawFirst0) * FRAME_MUL;
  const firstMax = Number.isFinite(row.scdef?.spawn_1) ? row.scdef.spawn_1 : 0;
  row.firstFrameMin = firstMin;
  row.firstFrameMax = firstMax;
  row.firstFrame = firstMin;
  row.firstMs = Math.round(firstMin * BCU_BATTLE_TIMER_PERIOD_MS);
  row.negativeFirstDelayFrames = firstMin < 0 ? Math.abs(firstMin) : 0;
  row.bcuNegativeFirstSpawn = firstMin < 0;
  row.bcuFirstSpawnPatchDebug = {
    source: 'BCU Stage.java ss[12]==1 negates SCDef.S0; EStage.assign keeps rem from spawn_0',
    rawEnemyId: num(row.raw[COL_E], null),
    rawFirst0,
    negativeSpawnFlag,
    firstFrameMin: firstMin,
    firstFrameMax: firstMax
  };
  if (row.scdef) {
    row.scdef.firstFrameMin = firstMin;
    row.scdef.firstFrameMax = firstMax;
    row.scdef.spawn_0 = firstMin;
    row.scdef.spawn_1 = firstMax;
    row.scdef.negativeSpawnFlag = negativeSpawnFlag ? 1 : 0;
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
    def.runtime.negativeFirstSpawnSource = 'BCU Stage.java ss[12] negative spawn parity';
  }
  if (def) {
    def.negativeFirstSpawnSource = 'BCU Stage.java ss[12] negative spawn parity';
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
