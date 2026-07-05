// Deterministic guard for the BCU speed-up battle control:
//  - BattleSimulationClock honors the speed multiplier in bcu-no-catchup mode
//    (1x stays single-step / no wall-clock catch-up; 2x/3x/4x/8x advance faster).
//  - BattleSpeedControl always exposes 1x->2x->3x->4x and uses the persisted flag
//    only to unlock the navy-blue 8x step.
import { BattleSimulationClock } from '../js/preview/BattleSimulationClock.js';
import fs from 'node:fs';

const checks = [];
const check = (name, cond, detail) => { checks.push({ name, ok: !!cond, detail }); };

// ---- clock: multiplier=1 keeps BCU no-catchup (single step, drop remainder) ----
{
  const clock = new BattleSimulationClock();
  const dts = [];
  clock.resume(0);
  const r = clock.step(5000, 1, (dt) => dts.push(dt));
  check('1x: single 33ms step on huge dt', dts.length === 1 && dts[0] === 33, dts);
  check('1x: drops remainder (no catch-up)', r.dropped === true && r.accumulatorMs === 0 && r.maxSteps === 1, r);
}

// ---- clock: higher multipliers advance the sim faster at a fixed display fps ----
function simSteps(mult, frames = 60, fps = 60) {
  const clock = new BattleSimulationClock();
  clock.resume(0);
  let t = 0; let steps = 0;
  for (let i = 0; i < frames; i++) { t += 1000 / fps; clock.step(t, mult, () => { steps += 1; }); }
  return steps;
}
const s1 = simSteps(1); const s2 = simSteps(2); const s3 = simSteps(3); const s4 = simSteps(4); const s8 = simSteps(8);
check('1x ~= 30 steps/sec', Math.abs(s1 - 30) <= 2, s1);
check('2x ~= 2x of 1x', s2 >= s1 * 1.8, { s1, s2 });
check('3x > 2x', s3 > s2, { s2, s3 });
check('4x ~= 4x of 1x', s4 >= s1 * 3.5, { s1, s4 });
check('8x > 4x', s8 > s4, { s4, s8 });

// ---- clock: 8x keeps fast-forward on healthy frames, but caps late-frame spikes ----
{
  const clock = new BattleSimulationClock();
  const dts = [];
  clock.resume(0);
  const r = clock.step(100, 8, (dt) => dts.push(dt));
  check('8x: late frame caps burst to 4 ticks', dts.length === 4 && dts.every((dt) => dt === 33), { dts, r });
  check('8x: late-frame remainder is dropped instead of queued', r.dropped === true && r.maxSteps === 4 && r.burstStepCap === 4 && r.accumulatorMs === 0, r);
}

// ---- PreviewApp: 8x avoids rendering/UI work on every RAF while sim still steps ----
{
  const previewSrc = fs.readFileSync('js/preview/PreviewApp.js', 'utf8');
  check('PreviewApp has high-speed render cadence guard', previewSrc.includes('getHighSpeedBattleRenderIntervalMs') && previewSrc.includes('shouldRenderBattleFrame'), null);
  check('PreviewApp renders 60fps at 1x, caps 30fps at 2x+', /if \(speed >= 2\) return 1000 \/ 30;/.test(previewSrc) && /return 1000 \/ 60;/.test(previewSrc), null);
}

// ---- BattleSpeedControl feature flag + cycle/colors ----
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k)
};
const { BattleSpeedControl } = await import('../js/ui/BattleSpeedControl.js');
check('8x disabled by default', BattleSpeedControl.isFeatureEnabled() === false);
BattleSpeedControl.setFeatureEnabled(false);
check('8x flag persists off', store.get(BattleSpeedControl.SETTING_KEY) === '0' && BattleSpeedControl.isFeatureEnabled() === false);

// headless cycle/colors (no document -> el is null, state logic still runs)
const seen = [];
const ctrl = new BattleSpeedControl({ onChange: (m) => seen.push(m) });
check('control starts at 1x', ctrl.multiplier === 1);
const cycle = [ctrl.multiplier];
for (let i = 0; i < 4; i++) cycle.push(ctrl.cycle());
check('default cycle is 1->2->3->4->1', JSON.stringify(cycle) === JSON.stringify([1, 2, 3, 4, 1]), cycle);
BattleSpeedControl.setFeatureEnabled(true);
check('8x flag persists on', BattleSpeedControl.isFeatureEnabled() === true);
ctrl.reset();
const cycle8 = [ctrl.multiplier];
for (let i = 0; i < 5; i++) cycle8.push(ctrl.cycle());
check('8x-enabled cycle is 1->2->3->4->8->1', JSON.stringify(cycle8) === JSON.stringify([1, 2, 3, 4, 8, 1]), cycle8);
ctrl.stepIndex = 4;
ctrl._render();
check('manual 8x state is reachable when enabled', ctrl.multiplier === 8, ctrl.multiplier);
BattleSpeedControl.setFeatureEnabled(false);
ctrl._render();
check('turning 8x off clamps current speed to 4x', ctrl.multiplier === 4, ctrl.multiplier);
ctrl.cycle(); ctrl.reset();
check('reset returns to 1x', ctrl.multiplier === 1);

const failed = checks.filter((c) => !c.ok);
for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'} ${c.name}${c.ok ? '' : ' :: ' + JSON.stringify(c.detail)}`);
if (failed.length) { console.error(`check-battle-speed-control: ${failed.length} failed`); process.exit(1); }
console.log('check-battle-speed-control: OK');
