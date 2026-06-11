// Regression guard for the production boot patch chain.
//
// Commit 9e52882d5 dropped js/battle/BattleActorProcStatusPatch.js from the
// boot imports. That file defines BattleActor.prototype.applyBcuProc (BCU
// Entity.processProcs parity: P_STOP/P_SLOW/P_WEAK/P_CURSE/P_SEAL/P_WARP/
// P_POIATK status application + the A_POISON hit effect spawn). Without it,
// BcuProcImmunityPatch wraps an undefined previousApply and every status proc
// fails with "previous-applyBcuProc-missing" in the real game even though the
// node test suite (which imports the patch directly) stays green.
//
// This check executes the real boot installer groups in the same order as
// js/boot/installBattlePatches.js and asserts the proc status runtime is
// actually reachable through BattleActor.prototype afterwards.
import assert from 'node:assert/strict';

const { installBattleCorePatches } = await import('../js/boot/battle/installBattleCorePatches.js');
await installBattleCorePatches();
const { installBattleActorLifecyclePatches } = await import('../js/boot/battle/installBattleActorLifecyclePatches.js');
await installBattleActorLifecyclePatches();

const { BattleActor } = await import('../js/battle/BattleActor.js');

assert.equal(typeof BattleActor.prototype.applyBcuProc, 'function', 'BattleActor.prototype.applyBcuProc must be installed by the boot chain');
assert.equal(typeof BattleActor.prototype.isBcuProcStatusActive, 'function', 'isBcuProcStatusActive must be installed by the boot chain');
assert.equal(typeof BattleActor.prototype.getBcuMoveDistanceForDt, 'function', 'getBcuMoveDistanceForDt (P_SLOW move parity) must be installed by the boot chain');
assert.equal(typeof BattleActor.prototype.getBcuWeakenDamageMultiplier, 'function', 'getBcuWeakenDamageMultiplier (P_WEAK parity) must be installed by the boot chain');

// End-to-end through the immunity wrapper: a freeze proc on a non-immune actor
// must reach the status runtime instead of failing on a missing wrap target.
const actor = new BattleActor({ assetDef: {}, sprite: null, model: null, side: 'cat-enemy', x: 0, y: 0, stats: { hp: 1000, damage: 10 }, animations: {} });
actor.lastSceneTimeMs = 0;
const result = actor.applyBcuProc({ key: 'freeze', payload: { time: 90, timeFrames: 90 } }, { nowMs: 0 });
assert.equal(result?.applied, true, `freeze proc must apply through the boot-installed chain (got: ${JSON.stringify(result)})`);
assert.notEqual(result?.reason, 'previous-applyBcuProc-missing', 'BcuProcImmunityPatch must wrap the real applyBcuProc');
assert.equal(actor.isBcuProcStatusActive('freeze', 0), true, 'freeze status must be active after apply');

console.log('check-battle-boot-proc-patches: PASS');
