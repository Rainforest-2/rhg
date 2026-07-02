#!/usr/bin/env node
import assert from 'node:assert/strict';
import { isActorShockwaveTouchable } from '../js/battle/BattleBossShockwaveRuntimePatch.js';

function actor(extra = {}) {
  return {
    state: 'alive',
    side: 'dog-player',
    hp: 100,
    isAlive: () => true,
    ...extra
  };
}

assert.equal(isActorShockwaveTouchable(actor({ rawStats: { speed: 0 } })), false, 'move speed 0 actors must not be boss-shockwave knocked back');
assert.equal(isActorShockwaveTouchable(actor({ stats: { moveSpeed: 0 } })), false, 'moveSpeed 0 actors must not be boss-shockwave knocked back');
assert.equal(isActorShockwaveTouchable(actor({ moveSpeed: 4 })), true, 'moving actors remain boss-shockwave touchable');

console.log('check-bcu-boss-shockwave-runtime-parity: OK');
