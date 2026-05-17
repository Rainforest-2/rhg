# AGENTS.md — BCU parity confirmed-fix instructions

Repository: `rhgrive2/game`
Target branch: `main`

## Purpose

Apply only the confirmed, low-risk fixes listed in this file. This repository is the browser game implementation under `rhgrive2/game`. It is not the upstream Battle Cats Ultimate repository.

BCU reference repository note:
When referring to the upstream Battle Cats Ultimate codebase, use the GitHub owner/namespace `battlecatsultimate`. Do not describe `rhgrive2/game` as the BCU upstream repository. Do not imply that BCU is an official PONOS repository.

## Ground rules

- Use current source files in `rhgrive2/game@main` as the implementation target.
- Do not use older txt reports as proof.
- Do not make speculative BCU behavior changes in this batch.
- Do not change unrelated gameplay, renderer, asset, stage, camera, touch, or input systems.
- Keep changes small, explicit, and testable.
- Preserve existing debug/trace output unless a task explicitly says to update a stale check.
- Prefer backward-compatible helpers over changing public data shapes.

## Confirmed current facts

The browser app boots through `index.html` -> `js/main.js`. `js/main.js` dynamically imports battle patch modules in a fixed order before creating `PreviewApp`.

Confirmed facts from the current code:

1. `BattleSceneProcApplyPatch.js` sets `result.procApply` to the return value of `applyDamageProc(...)`.
2. `applyDamageProc(...)` currently returns an array of entries shaped like `{ key, result }`.
3. `BattleSceneBcuProcRuntimePatch.js` currently reads `result?.procApply?.procs`, which does not match that array shape.
4. `BattleSceneProcApplyPatch.js` applies actor procs only when `result?.accepted && targetType === 'actor' && damageResult?.proc`.
5. `BattleSceneBcuProcRuntimePatch.js` performs BCU proc runtime work after `originalQueueAttackDamage(...)` and needs the same accepted actor-hit guard.
6. `BattleActorZombieRevivePatch.js` wraps `BattleActor.prototype.resolvePostDamage`.
7. `BcuKnockbackRuntimePatch.js` and `BcuKnockbackProcPriorityPatch.js` later assign `BattleActor.prototype.resolvePostDamage` again.
8. `js/main.js` currently imports `BattleActorZombieRevivePatch.js` before the later knockback patches, so the zombie revive wrapper can be overwritten by later prototype assignment.
9. `scripts/check-damage-calculator.mjs` still asserts an old “ProcResolver remains no-apply” contract.
10. `scripts/check-battle-scene-stage-runtime-wiring.mjs` still checks older ProcResolver v2/no-apply contract strings.
11. Current `ProcResolver.getProcCatalog()` has implemented runtime procs: `freeze`, `slow`, `weaken`, `knockbackProc`, `curse`, `seal`, and `toxic`.
12. `BcuSpriteSheet.drawPart(...)` supports BCU glow/opacity metadata through `opt.__bcuDrawEntry` or `sprite.__bcuDrawQueue`.
13. Actor rendering has `BattleSceneRendererBcuGlowPatch.js`, which populates `actor.sprite.__bcuDrawQueue` before actor drawing.
14. `BcuStatusEffectManager.js` draws status effect parts directly and does not currently pass `p.glow`, `p.opacity`, or `__bcuDrawEntry` into `BcuSpriteSheet.drawPart(...)`.

---

# Task 1 — Fix `procApply` shape mismatch and prevent duplicate proc application

## Problem

`BattleSceneProcApplyPatch.js` writes:

```js
result.procApply = procApply;
```

where `procApply` is an array returned by `applyDamageProc(...)`.

But `BattleSceneBcuProcRuntimePatch.js` reads:

```js
result?.procApply?.procs
```

That makes the already-applied proc set empty for the current array shape. As a result, a proc already applied by `BattleSceneProcApplyPatch` may be passed to `BcuProcRuntime.performProc(...)` without `alreadyApplied: true`.

## Files

- `js/battle/BattleSceneProcApplyPatch.js`
- `js/battle/BattleSceneBcuProcRuntimePatch.js`

## Required implementation

### 1. Normalize `procApply` entries in `BattleSceneProcApplyPatch.js`

Keep `result.procApply` backward-compatible as an array, but add explicit top-level fields to each entry.

Change each successful/failed output entry from:

```js
out.push({ key: item.key, result });
```

to an entry that includes at least:

```js
out.push({
  key: item.key,
  applied: result?.applied === true,
  result,
  hitIndex: meta.hitIndex ?? item.hitIndex ?? null,
  attackEventKey: meta.key ?? item.attackEventKey ?? null
});
```

For missing `applyBcuProc`, include the same fields:

```js
out.push({
  key: item.key,
  applied: false,
  reason: 'target-applyBcuProc-missing',
  hitIndex: meta.hitIndex ?? item.hitIndex ?? null,
  attackEventKey: meta.key ?? item.attackEventKey ?? null
});
```

### 2. Read both historical and current shapes in `BattleSceneBcuProcRuntimePatch.js`

Add helpers:

```js
function getProcApplyEntries(result) {
  if (Array.isArray(result?.procApply)) return result.procApply;
  if (Array.isArray(result?.procApply?.procs)) return result.procApply.procs;
  return [];
}

function procApplyDedupeKey(item) {
  const key = item?.key || '';
  return `${key}:${item?.hitIndex ?? ''}:${item?.attackEventKey ?? ''}`;
}
```

Replace the current `appliedKeys` calculation with a set over normalized entries:

```js
const appliedKeys = new Set(
  getProcApplyEntries(result)
    .filter((p) => p?.applied === true || p?.result?.applied === true)
    .map(procApplyDedupeKey)
);
```

When iterating `calc.proc.pending` and `calc.proc.applied`, compute the same dedupe key:

```js
const dedupeKey = `${key}:${proc?.hitIndex ?? ''}:${proc?.attackEventKey ?? ''}`;
const alreadyApplied = appliedKeys.has(dedupeKey);
runtime.performProc({
  attacker,
  target,
  attack: event,
  proc: alreadyApplied
    ? { ...proc, alreadyApplied: true, handledBy: 'BattleSceneProcApplyPatch' }
    : proc
});
```

## Acceptance criteria

- `result.procApply` may be either an array or an object with `.procs`; both are accepted.
- Entries shaped `{ key, result: { applied: true } }` are treated as already applied.
- Entries shaped `{ key, applied: true }` are treated as already applied.
- `freeze`, `slow`, `weaken`, `curse`, `seal`, `toxic`, and `knockbackProc` are not applied twice for the same hit.
- Existing trace/event behavior remains in place.

---

# Task 2 — Guard `BattleSceneBcuProcRuntimePatch` by accepted actor hit

## Problem

`BattleSceneProcApplyPatch.js` applies actor procs only when all of this is true:

```js
result?.accepted && targetType === 'actor' && damageResult?.proc
```

But `BattleSceneBcuProcRuntimePatch.js` currently calls `BcuProcRuntime.performProc(...)` after `originalQueueAttackDamage(...)` without the same accepted/actor guard.

That allows the patch to inspect stale `target.lastIncomingDamageCalculation` or `attacker.lastDamageCalculation` after a rejected/non-actor hit. It should not run runtime proc handling for a rejected hit or a base hit.

## File

- `js/battle/BattleSceneBcuProcRuntimePatch.js`

## Required implementation

After:

```js
const result = originalQueueAttackDamage.call(this, attacker, target, targetType, event, meta);
```

add:

```js
if (!result?.accepted || targetType !== 'actor') return result;
```

Then continue with proc trace/runtime handling. This guard should be applied in addition to the `procApply` shape fix.

## Acceptance criteria

- Rejected hits do not call `BcuProcRuntime.performProc(...)`.
- Base hits do not call actor proc runtime.
- Accepted actor hits still call proc runtime.
- Existing `guardBcuDamage(...)` call before original damage queue remains unchanged.

---

# Task 3 — Ensure zombie revive wraps the final `resolvePostDamage`

## Problem

`BattleActorZombieRevivePatch.js` wraps `BattleActor.prototype.resolvePostDamage`.

But `js/main.js` imports it before:

```js
await import('./battle/BcuKnockbackRuntimePatch.js');
await import('./battle/BcuKnockbackProcPriorityPatch.js');
```

Both knockback patches assign `BattleActor.prototype.resolvePostDamage` later. Therefore, the zombie revive wrapper can be overwritten by later patches.

## File

- `js/main.js`

## Required implementation

Move the import of `BattleActorZombieRevivePatch.js` so it runs after the final knockback `resolvePostDamage` patch.

Current early import must be removed from the early actor patch block:

```js
await import('./battle/BattleActorZombieRevivePatch.js');
```

Add it after:

```js
await import('./battle/BcuKnockbackProcPriorityPatch.js');
```

Recommended order:

```js
await import('./battle/BcuKnockbackRuntimePatch.js');
await import('./battle/BcuKnockbackProcPriorityPatch.js');
await import('./battle/BattleActorZombieRevivePatch.js');
await import('./battle/BcuKnockbackEffectLayerPatch.js');
await import('./battle/BcuKnockbackAnimationPatch.js');
await import('./battle/BcuProcImmunityPatch.js');
```

Do not import `BattleActorZombieRevivePatch.js` twice. Its patch flag prevents rewrapping once installed.

## Acceptance criteria

- `BattleActorZombieRevivePatch.js` is imported exactly once.
- It is imported after `BcuKnockbackProcPriorityPatch.js`.
- A non-zombie actor death still uses current knockback/death behavior.
- A zombie actor with revive spec and no zombie-killer hit schedules revive.
- A zombie actor killed by zombie-killer does not schedule revive.

---

# Task 4 — Add a guard against future `resolvePostDamage` wrapper loss

## Problem

The repo uses many prototype patch modules. The current bug exists because later assignments replace earlier wrappers silently.

## Files

- `js/battle/BattleActorZombieRevivePatch.js`
- optionally `js/main.js`

## Required implementation

Add a lightweight final-install marker when the zombie wrapper is installed.

Inside `BattleActorZombieRevivePatch.js`, after capturing `originalResolvePostDamage`, set debug metadata on the prototype:

```js
proto.__bcuZombieReviveResolvePostDamageWrapped = true;
proto.__bcuZombieReviveWrappedResolvePostDamageName = originalResolvePostDamage?.name || null;
```

Inside `resolvePostDamageWithZombieRevive`, set:

```js
this.lastBcuZombieReviveWrapperDebug = {
  source: 'BattleActorZombieRevivePatch.resolvePostDamageWithZombieRevive',
  wrapped: true,
  wrappedFunctionName: proto.__bcuZombieReviveWrappedResolvePostDamageName
};
```

If adding boot-time debug state in `main.js`, do not throw during normal boot. Use debug state only.

## Acceptance criteria

- Runtime debug can confirm that zombie revive wrapper ran after the final knockback patch.
- No boot-time exception is introduced.
- No gameplay behavior changes except preserving zombie revive after knockback patches.

---

# Task 5 — Pass status-effect draw metadata to `BcuSpriteSheet.drawPart`

## Problem

`BcuSpriteSheet.drawPart(...)` supports BCU glow/opacity metadata through either:

```js
opt.__bcuDrawEntry
```

or a queued draw entry consumed from:

```js
sprite.__bcuDrawQueue
```

It computes glow like this:

```js
const queued = opt.__bcuDrawEntry || consumeQueuedDrawPart(this, partIndex);
const glow = Number(opt.glow ?? queued?.glow ?? 0);
```

Actor rendering has `BattleSceneRendererBcuGlowPatch.js`, which populates `actor.sprite.__bcuDrawQueue` before drawing actors.

However `BcuStatusEffectManager.js` draws status effect parts directly and calls:

```js
this.sprite.drawPart(ctx, partIndex, -pivotX, -pivotY, { scaleX: 1, scaleY: 1 });
```

That means status effect rendering does not pass `p.glow`, `p.opacity`, or `__bcuDrawEntry` into the sprite renderer. Any status-effect model part glow metadata is ignored.

## File

- `js/battle/bcu-runtime/BcuStatusEffectManager.js`

## Required implementation

Inside `BcuEntityEffectIconRuntime.draw(...)`, replace the current `drawPart` call with one that passes the draw entry:

```js
this.sprite.drawPart(ctx, partIndex, -pivotX, -pivotY, {
  scaleX: 1,
  scaleY: 1,
  __bcuDrawEntry: p,
  glow: Number.isFinite(Number(p.glow)) ? Number(p.glow) : 0,
  opacity
});
```

Keep the existing `ctx.globalAlpha = opacity` line. This makes normal drawing behavior unchanged while allowing glow path to use the same metadata contract as actor rendering.

## Acceptance criteria

- Status effect normal rendering remains unchanged.
- If a status-effect draw entry contains glow mode `1`, `2`, `3`, or `-1`, `BcuSpriteSheet.drawPart` receives it.
- `BcuSpriteSheet.__bcuSpriteDrawDebug` can report glow-composite path for status effects when applicable.
- No fallback image/CSS/emoji rendering is introduced.

---

# Task 6 — Update stale `check-damage-calculator.mjs`

## Problem

`scripts/check-damage-calculator.mjs` still asserts an old contract:

```js
ok('ProcResolver remains no-apply', procText.includes('applied: []') && !procText.includes('target.hp ='));
```

Current `ProcResolver.getProcCatalog()` has implemented procs, including:

```js
freeze
slow
weaken
knockbackProc
curse
seal
toxic
```

Therefore the check is stale.

## File

- `scripts/check-damage-calculator.mjs`

## Required implementation

Remove the old `ProcResolver remains no-apply` assertion.

Prefer direct import over string matching:

```js
import { ProcResolver } from '../js/battle/ProcResolver.js';

const catalog = ProcResolver.getProcCatalog();

for (const key of ['freeze', 'slow', 'weaken', 'knockbackProc', 'curse', 'seal', 'toxic']) {
  assert.equal(catalog[key]?.implemented, true, `${key} must be implemented`);
  assert.equal(catalog[key]?.pendingSupported, true, `${key} must support pending contract`);
}

for (const key of ['warp', 'barrierBreaker', 'shieldPierce', 'zombieKiller', 'soulstrike']) {
  assert.equal(catalog[key]?.pendingSupported, true, `${key} must remain pending-supported`);
}
```

## Acceptance criteria

- `node scripts/check-damage-calculator.mjs` passes.
- The script verifies that core runtime procs are implemented.
- The script no longer asserts that ProcResolver is no-apply.
- No production code changes are required for this task.

---

# Task 7 — Update stale ProcResolver checks in `check-battle-scene-stage-runtime-wiring.mjs`

## Problem

`scripts/check-battle-scene-stage-runtime-wiring.mjs` still checks older ProcResolver contract strings, including:

```js
ProcResolver.v2-pending-contract
semantic-pending-no-apply
```

Current `ProcResolver.js` returns:

```js
source: 'ProcResolver.v3-bcu-proc-roll-contract'
mode: 'bcu-proc-roll-pending-apply-contract'
```

and current catalog marks several procs as implemented. The script is now stale.

## File

- `scripts/check-battle-scene-stage-runtime-wiring.mjs`

## Required implementation

Replace string assertions tied to the old v2/no-apply contract with direct catalog inspection.

Add:

```js
const { ProcResolver } = await import('../js/battle/ProcResolver.js');
const catalog = ProcResolver.getProcCatalog();

for (const key of ['freeze', 'slow', 'weaken', 'knockbackProc', 'curse', 'seal', 'toxic']) {
  assert.equal(catalog[key]?.implemented, true, `${key} must be implemented`);
  assert.equal(catalog[key]?.pendingSupported, true, `${key} must support pending contract`);
}

for (const key of ['wave', 'miniWave', 'surge', 'miniSurge', 'warp', 'barrierBreaker', 'shieldPierce', 'zombieKiller', 'soulstrike']) {
  assert.equal(catalog[key]?.pendingSupported, true, `${key} must remain pending-supported`);
}
```

Update source/mode checks to current strings if the script still wants string coverage:

```js
assert.ok(procResolverSrc.includes('ProcResolver.v3-bcu-proc-roll-contract'));
assert.ok(procResolverSrc.includes('bcu-proc-roll-pending-apply-contract'));
```

Remove or replace checks for:

```js
ProcResolver.v2-pending-contract
semantic-pending-no-apply
ProcResolver remains no-apply
```

## Acceptance criteria

- `node scripts/check-battle-scene-stage-runtime-wiring.mjs` no longer expects old ProcResolver v2/no-apply strings.
- The script verifies the current implemented core proc contract.
- The script still verifies pending support for unported or externally-handled procs.
- No production code changes are required for this task.

---

# Required checks after all tasks

Run at least:

```bash
node scripts/check-damage-calculator.mjs
node scripts/check-battle-scene-stage-runtime-wiring.mjs
```

Then boot the browser app and verify one battle can start.

Manual runtime checks:

1. Trigger or inspect a proc hit with `freeze`, `slow`, `weaken`, `curse`, `seal`, `toxic`, or `knockbackProc`.
2. Confirm `BattleSceneProcApplyPatch` applies it once.
3. Confirm `BcuProcRuntime` receives `alreadyApplied: true` for the same proc/hit and does not apply it again.
4. Confirm rejected hits and base hits do not invoke actor proc runtime.
5. Kill a zombie actor with revive data using a non-zombie-killer hit. Confirm revive is scheduled.
6. Kill a zombie actor with zombie-killer. Confirm revive is blocked.
7. Confirm status effect icons still render.
8. If status effect draw entries contain glow metadata, confirm `BcuSpriteSheet` receives that metadata.

## Explicit non-goals

Do not change these in this batch:

- wave/surge hit timing
- barrier/shield damage semantics
- warp runtime semantics
- BCU resist field mapping
- renderer draw order outside status-effect draw metadata forwarding
- stage spawn timing
- asset bundle structure
- touch/mobile input behavior
- camera projection behavior
