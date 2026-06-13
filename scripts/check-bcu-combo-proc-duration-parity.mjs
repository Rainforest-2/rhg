// Deterministic parity check for combo proc-duration / knockback-distance buffs.
//
// Fact-first source (references/bcu/BCU_java_util_common.zip):
//   - battle/attack/AtkModelUnit.java:36-43  buffed[i].STOP.time = (time * (100 + getInc(C_STOP, u))) / 100
//                                            buffed[i].SLOW.time = (time * (100 + getInc(C_SLOW, u))) / 100
//                                            buffed[i].WEAK.time = (time * (100 + getInc(C_WEAK, u))) / 100
//                                            CRIT.prob += getInc(C_CRIT, u) when CRIT.prob > 0
//   - battle/attack/AtkModelUnit.java:127-128 proc.KB.dis = proc.KB.dis * (100 + getInc(C_KB, u)) / 100
//
// BCU has NO Nyanko combo type for curse/seal/warp/toxic/delay, so those proc
// payloads must never be buffed. Enemy attackers (AtkModelEnemy) get no combo
// buff, so an attacker without combo modifiers must be a strict no-op.

import assert from 'node:assert/strict';
import {
  buffProcPayloadWithCombos,
  computeUnitComboIncrements
} from '../js/battle/bcu-runtime/BcuComboStatModifier.js';
import { COMBO_TYPE, C_TOT } from '../js/battle/BcuComboData.js';
import { ProcResolver } from '../js/battle/ProcResolver.js';

function unitWithCombos(increments) {
  return { rawStats: { bcuComboModifiers: { applied: false, increments } } };
}

// --- direct helper parity (STOP/SLOW/WEAK time + KB distance) ---------------
{
  const attacker = unitWithCombos({ freezeTime: 50, slowTime: 100, weakenTime: 33, knockbackDist: 50 });

  const freeze = buffProcPayloadWithCombos('freeze', { prob: 100, time: 100, timeFrames: 100 }, attacker);
  assert.equal(freeze.time, 150, 'C_STOP scales freeze time by (100 + inc) / 100');
  assert.equal(freeze.timeFrames, 150, 'C_STOP scales freeze timeFrames identically');
  assert.equal(freeze.bcuComboProcBuff.type, 'freezeTime', 'freeze buff is traceable');

  const slow = buffProcPayloadWithCombos('slow', { prob: 100, time: 90, timeFrames: 90 }, attacker);
  assert.equal(slow.time, 180, 'C_SLOW scales slow time');

  const weaken = buffProcPayloadWithCombos('weaken', { prob: 100, time: 100, timeFrames: 100, mult: 50 }, attacker);
  assert.equal(weaken.time, 133, 'C_WEAK scales weaken time with BCU integer truncation (100*133/100)');
  assert.equal(weaken.mult, 50, 'weaken multiplier is untouched by the time buff');

  const kb = buffProcPayloadWithCombos('knockbackProc', { prob: 100, dis: 300, time: 0, timeFrames: 0 }, attacker);
  assert.equal(kb.dis, 450, 'C_KB scales knockback distance by (100 + inc) / 100');
  assert.equal(kb.bcuComboProcBuff.type, 'knockbackDist', 'kb distance buff is traceable');
}

// --- integer truncation parity (Java integer division) ----------------------
{
  const attacker = unitWithCombos({ weakenTime: 33 });
  const weaken = buffProcPayloadWithCombos('weaken', { prob: 100, time: 7, timeFrames: 7 }, attacker);
  assert.equal(weaken.time, 9, 'truncates 7 * 133 / 100 = 9.31 -> 9 like Java integer division');
}

// --- negative evidence: no combo type for curse/warp/seal/toxic -------------
{
  const attacker = unitWithCombos({ freezeTime: 99, slowTime: 99, weakenTime: 99, knockbackDist: 99 });
  for (const key of ['curse', 'warp', 'seal', 'toxic']) {
    const payload = { prob: 100, time: 100, timeFrames: 100 };
    const out = buffProcPayloadWithCombos(key, payload, attacker);
    assert.equal(out, payload, `${key} has no Nyanko combo and must be returned unchanged (identity)`);
  }
}

// --- enemy / no-combo attacker is a strict no-op ----------------------------
{
  const payload = { prob: 100, time: 100, timeFrames: 100 };
  assert.equal(buffProcPayloadWithCombos('freeze', payload, {}), payload, 'attacker without combo modifiers is a no-op');
  assert.equal(buffProcPayloadWithCombos('freeze', payload, null), payload, 'missing attacker is a no-op');
}

// --- increment exposure: new keys come from the real combo value table ------
{
  const values = Array.from({ length: C_TOT }, () => [0, 0]);
  values[COMBO_TYPE.C_STOP] = [40, 80];
  values[COMBO_TYPE.C_KB] = [25, 60];
  // Each combo has a single type + level index; getInc reads values[type][lv].
  const active = [
    { type: COMBO_TYPE.C_STOP, lv: 0, charaGroupId: -1 },
    { type: COMBO_TYPE.C_KB, lv: 0, charaGroupId: -1 }
  ];
  const inc = computeUnitComboIncrements(active, values);
  assert.equal(inc.freezeTime, 40, 'computeUnitComboIncrements exposes C_STOP as freezeTime');
  assert.equal(inc.knockbackDist, 25, 'computeUnitComboIncrements exposes C_KB as knockbackDist');
}

// --- end-to-end through ProcResolver runtime read path ----------------------
{
  const attacker = {
    instanceId: 'combo-attacker',
    rawStats: {
      bcuComboModifiers: { applied: false, increments: { freezeTime: 50, knockbackDist: 100 } },
      bcuCombatModel: {
        kind: 'unit',
        traits: { list: ['red'], flags: { red: true } },
        targetTraits: { list: ['red'], flags: { red: true } },
        ability: { abi: 0, flags: {} },
        proc: {
          freeze: { prob: 100, time: 60 },
          knockback: { prob: 100, dis: 200, time: 0 }
        }
      }
    }
  };
  const target = {
    instanceId: 'combo-target',
    rawStats: {
      bcuCombatModel: {
        kind: 'enemy',
        traits: { list: ['red'], flags: { red: true } },
        ability: { abi: 0, flags: {} },
        proc: {}
      }
    }
  };
  const result = ProcResolver.resolve({
    attacker,
    target,
    targetType: 'actor',
    event: { hitIndex: 0 },
    context: { random: () => 0 }
  });
  const freeze = result.pending.find((p) => p.key === 'freeze');
  const kb = result.pending.find((p) => p.key === 'knockbackProc');
  assert.ok(freeze, 'freeze proc rolls into pending');
  assert.equal(freeze.payload.time, 90, 'ProcResolver applies C_STOP combo buff (60 * 150 / 100 = 90)');
  assert.ok(kb, 'knockback proc rolls into pending');
  assert.equal(kb.payload.dis, 400, 'ProcResolver applies C_KB combo buff (200 * 200 / 100 = 400)');
}

console.log('check-bcu-combo-proc-duration-parity: OK');
