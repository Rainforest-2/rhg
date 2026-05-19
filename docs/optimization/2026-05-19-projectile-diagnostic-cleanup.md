# Projectile Diagnostic Cleanup Review

Date: 2026-05-19

## Objective

Remove remaining write-only projectile diagnostic allocations from `BattleProjectilePerformanceAndPositionPatch.js` without changing projectile behavior, damage queuing, wave/surge positioning, hit-smoke suppression, trace filtering semantics, or wrapper forwarding.

## Inspected files

- `js/battle/BattleProjectilePerformanceAndPositionPatch.js`
  - Contains the only remaining projectile suppression diagnostic write sites targeted by this pass.
  - Also contains protected behavior: `WAVE_SCREEN_OFFSET = -28`, `normalizeProjectileEffect(...)`, `queueAttackDamage` hit-smoke suppression, `pushEvent` filtering, and `BcuTraceRuntime.push` filtering.
- `docs/optimization/2026-05-19-diagnostic-allocation-review.md`
  - Prior analysis selected projectile trace suppression diagnostics as the safest next implementation candidate.
- `js/main.js`
  - Confirms this patch is imported after wave/surge/projectile runtime patches and before `BattleDebugStripPatch.js`.
- `AGENTS.md`
  - Confirms optimization analysis artifact and protected runtime contracts.

## Reference source inspection

No new reference ZIP inspection was needed for this pass. The previous analysis already inspected `references/bcu/BCU_java_util_common.zip` for `Entity.java`, wave, and surge classes. This change removes only diagnostic object writes; it does not alter behavior derived from those references.

## Current data flow

`BattleProjectilePerformanceAndPositionPatch.js` currently:

1. Wraps `EffectRuntime.createEffect` and normalizes wave/surge projectile effect rendering metadata.
2. Wraps `BattleScene.prototype.queueAttackDamage` and temporarily disables `spawnHitEffect` for projectile wave/surge damage, restoring it in `finally`.
3. Wraps `BattleScene.prototype.pushEvent` to drop verbose `bcuWaveTrace` / `bcuSurgeTrace` events while forwarding important events.
4. Wraps `BcuTraceRuntime.push` to drop verbose `wave` / `surge` trace entries while forwarding important entries.
5. Writes install metadata to `globalThis.__BCU_PROJECTILE_PERF_POSITION_PATCH__`.

## Candidate changes

Selected for implementation:

- Remove `this.lastProjectileHitSmokeSuppressDebug = {...}` in the `queueAttackDamage` wrapper `finally` block.
- Remove `this.lastProjectileTraceSuppressedDebug = {...}` in the dropped verbose scene-event branch.
- Remove `globalThis.__BCU_PROJECTILE_TRACE_SUPPRESS_DEBUG__ = {...}` in the dropped verbose BcuTraceRuntime branch.

## Why these are safe

- These values are diagnostic-only write sites.
- Search found no non-debug consumers depending on them.
- Removing them does not change branch predicates or return values.
- `spawnHitEffect` is still restored in `finally`.
- Important events still forward to `originalPushEvent.call(this, event)`.
- Important trace entries still forward to `originalPush.call(this, channel, entry)`.
- `globalThis.__BCU_PROJECTILE_PERF_POSITION_PATCH__` remains available as patch metadata.

## Rejected changes

- Do not remove or modify the temporary `this.spawnHitEffect = () => null` bracket.
- Do not change `shouldSuppressHitSmoke(...)`.
- Do not change `shouldKeepProjectileTrace(...)` or `IMPORTANT_TRACE_EVENTS`.
- Do not change `WAVE_SCREEN_OFFSET`, source sets, y-offsets, layer metadata, or effect normalization.
- Do not remove `BcuTraceRuntime.push` wrapping in this pass; only remove the diagnostic allocation inside the suppressed branch.

## Behavior invariants

- Wave screen offset remains `-28`.
- Wave/surge projectile effects still get `bcuProjectileStageObject = true` and `bcuSmokeYOffset = 0`.
- Projectile wave/surge damage still suppresses extra hit smoke.
- `queueAttackDamage` still calls the captured original with the same arguments and `this`.
- Dropped verbose trace/event branches remain dropped.
- Important trace/event branches remain forwarded.

## Expected debug/global output changes

- `scene.lastProjectileHitSmokeSuppressDebug` will no longer be updated.
- `scene.lastProjectileTraceSuppressedDebug` will no longer be updated.
- `globalThis.__BCU_PROJECTILE_TRACE_SUPPRESS_DEBUG__` will no longer be updated.
- `globalThis.__BCU_PROJECTILE_PERF_POSITION_PATCH__` remains unchanged.
- Game behavior should be unchanged; debug/global inspection output changes.

## Static verification

Required searches after implementation:

- `rg -n "lastProjectileHitSmokeSuppressDebug|lastProjectileTraceSuppressedDebug|__BCU_PROJECTILE_TRACE_SUPPRESS_DEBUG__" js docs`
- `rg -n "WAVE_SCREEN_OFFSET|normalizeProjectileEffect|queueAttackDamageSuppressProjectileHitSmoke|originalQueueAttackDamage|originalPushEvent|originalPush" js/battle/BattleProjectilePerformanceAndPositionPatch.js`

Check the diff confirms only diagnostic assignments were removed.

## Executable non-browser checks

Run if available and assets permit:

- `node scripts/check-battle-tick-order.mjs`
- `node scripts/check-battle-renderer-projection.mjs`
- `node scripts/check-renderer-coordinate-paths.mjs`

If these cannot run in the agent environment, validation is code-review-only.

## AGENTS.md update decision

No `AGENTS.md` update is needed. The existing instructions already require analysis artifacts, preserve protected runtime contracts, and allow diagnostic allocation cleanup when gameplay state and rendering calls are unaffected.

## Rollback plan

Revert only the projectile diagnostic cleanup commit. Restoring the three diagnostic assignments should be sufficient; no wrapper order or projectile behavior should need rollback.
