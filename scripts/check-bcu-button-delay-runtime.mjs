// BCU manual-deploy button delay parity (StageBasis.act_spawn / StageBasis.update).
//
// BCU battle/StageBasis.java:
//   act_spawn(i, j, manual):
//     if (buttonDelay > 0 || ubase.health == 0) return false;          // press dropped while counting
//     if (buttonDelayOn && manual && selectedUnit[0] == -1) {
//       if (elu.price[i][j] != -1 || b.lu.fs[i][j] == null) {
//         if (lineupChanging) return false;
//         buttonDelay = 6; selectedUnit = {i, j}; return true;          // queue, no spawn/cost yet
//       }
//     }
//   update(): if (buttonDelay > 0 && --buttonDelay == 0) act_spawn(selectedUnit, true);

import assert from 'node:assert/strict';
import {
  BCU_BUTTON_DELAY_FRAMES,
  createBcuButtonDelayState,
  requestBcuButtonDelaySpawn,
  tickBcuButtonDelay
} from '../js/battle/bcu-runtime/BcuButtonDelayRuntime.js';

assert.equal(BCU_BUTTON_DELAY_FRAMES, 6, 'BCU StageBasis sets buttonDelay = 6 frames');

// disabled -> passthrough (caller deploys immediately, no delay state touched)
{
  const s = createBcuButtonDelayState();
  const d = requestBcuButtonDelaySpawn(s, { slotId: 'a' }, { enabled: false });
  assert.equal(d.action, 'passthrough');
  assert.equal(s.frames, 0);
  assert.equal(s.queued, null);
}

// first press queues + starts the 6-frame delay, does NOT spawn now
{
  const s = createBcuButtonDelayState();
  const d = requestBcuButtonDelaySpawn(s, { slotId: 'a', row: 0, col: 1 }, { enabled: true, frames: 6 });
  assert.equal(d.action, 'queued');
  assert.equal(d.frames, 6);
  assert.equal(s.frames, 6);
  assert.deepEqual(s.queued, { slotId: 'a', row: 0, col: 1 });

  // a second press while counting down is dropped (no re-queue)
  const d2 = requestBcuButtonDelaySpawn(s, { slotId: 'b' }, { enabled: true, frames: 6 });
  assert.equal(d2.action, 'blocked');
  assert.equal(d2.reason, 'button-delay-active');
  assert.deepEqual(s.queued, { slotId: 'a', row: 0, col: 1 }, 'queued unit is preserved');
}

// lineup swap blocks the press WITHOUT starting a delay (StageBasis 507)
{
  const s = createBcuButtonDelayState();
  const d = requestBcuButtonDelaySpawn(s, { slotId: 'a' }, { enabled: true, lineupChanging: true });
  assert.equal(d.action, 'blocked');
  assert.equal(d.reason, 'lineup-changing');
  assert.equal(s.frames, 0);
  assert.equal(s.queued, null);
}

// countdown fires the queued deploy on exactly the 6th frame, never before
{
  const s = createBcuButtonDelayState();
  requestBcuButtonDelaySpawn(s, { slotId: 'a', row: 1, col: 2 }, { enabled: true, frames: 6 });
  const fires = [];
  for (let frame = 1; frame <= 6; frame += 1) {
    const r = tickBcuButtonDelay(s);
    if (r.fire) fires.push({ frame, fire: r.fire });
  }
  assert.equal(fires.length, 1, 'exactly one deploy fires');
  assert.equal(fires[0].frame, 6, 'it fires on the 6th frame after the press');
  assert.deepEqual(fires[0].fire, { slotId: 'a', row: 1, col: 2 });
  assert.equal(s.frames, 0, 'delay cleared after fire');
  assert.equal(s.queued, null, 'queue cleared after fire');

  // idle ticks afterward do nothing
  assert.equal(tickBcuButtonDelay(s).fire, null);
}

console.log('check-bcu-button-delay-runtime: OK');
