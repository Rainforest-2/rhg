# AGENTS.md — BCU parity safe-fix instructions for Codex

Repository: `rhgrive2/game`
Target branch: `main`
Purpose: make only fact-backed, low-risk changes that move the current browser battle runtime closer to Battle Cats Ultimate (BCU) behavior.

## 0. Source-of-truth rules

1. The target repository is `rhgrive2/game`.
2. The upstream BCU repository owner is `battlecatsultimate`. Do not describe `rhgrive2/game` as the BCU upstream.
3. When comparing with BCU, use source files from the `battlecatsultimate` BCU codebase or the local BCU source zips made available to the task. Do not use old `.txt` analysis files as authority.
4. Do not invent BCU behavior. If a change requires reading BCU Java and the source is unavailable, leave the code unchanged and document the unresolved point.
5. This repository is a browser ES-module app loaded from `index.html` and `js/main.js`. Do not assume an npm project, build step, or package scripts unless a real `package.json` is present in the checkout.
6. Preserve the current patch-layer architecture. Do not rewrite `BattleScene`, `BattleActor`, proc runtime, or renderer wholesale.

## 1. Confirmed current architecture

The app boots through `index.html`, which loads `js/debug/InstallBattleDebugHud.js` and `js/main.js` as modules.

`js/main.js` imports many battle parity patches before creating `PreviewApp`, including:

- `BattleActorProcStatusPatch.js`
- `BattleActorBarrierShieldPatch.js`
- `BattleActorZombieRevivePatch.js`
- `BattleDeterministicRandomPatch.js`
- `BattleWaveRuntimePatch.js`
- `BattleSurgeRuntimePatch.js`
- `BattleSceneBcuStageBasisOrderPatch.js`
- `BattleSceneStageRuntimeWiring.js`
- `BattleSceneBcuTimerPatch.js`
- `BattleSceneBcuLineupPatch.js`
- `BattleSceneBcuStageSpawnPatch.js`
- `BattleSceneBcuAttackPhasePatch.js`
- `BattleSceneProcApplyPatch.js`
- `BattleSceneBcuProcRuntimePatch.js`
- `BcuKnockbackRuntimePatch.js`
- `BcuProcImmunityPatch.js`

The runtime already has BCU-oriented systems for:

- fixed 33ms battle timing via `BattleFrameClock.js`
- StageBasis-like phase order via `BattleSceneBcuStageBasisTickPatch.js`
- BCU-style attack capture/excuse separation via `BattleSceneBcuAttackPhasePatch.js`
- BCU-coordinate attack capture via `BattleAttackResolver.js`
- pending damage and post-damage KB/death via `BattleActor.js` and `KBRuntime.js`
- BCU proc rolling via `ProcResolver.js`
- proc application via `BattleSceneProcApplyPatch.js` and `BcuProcRuntime.js`
- freeze/slow/weaken/curse/seal/toxic/KB status handling via `BattleActorProcStatusPatch.js`
- barrier/shield gating via `BattleActorBarrierShieldPatch.js`
- zombie revive scheduling via `BattleActorZombieRevivePatch.js`
- wave/surge container runtimes via `BattleWaveRuntimePatch.js` and `BattleSurgeRuntimePatch.js`

Do not duplicate these systems. Patch them minimally.

## 2. Safe fix A — zombie killer must be checked before pending hits are cleared

### Fact

`BattleActor.resolvePostDamage()` clears `pendingDamage` and `pendingHits` before returning.

`BattleActorZombieRevivePatch.resolvePostDamageWithZombieRevive()` currently calls the original `resolvePostDamage()` first, then calls `killedByZombieKiller(this)`, which reads `actor.pendingHits`.

Therefore, zombie-killer detection can observe an already-cleared hit list. This is a real code-order bug, not a speculative BCU rule.

### Required change

Modify `js/battle/BattleActorZombieRevivePatch.js` only as needed:

1. Before calling `originalResolvePostDamage`, snapshot the current pending hits:

```js
const pendingHitsBeforeResolve = Array.isArray(this.pendingHits) ? this.pendingHits.slice() : [];
```

2. Replace the post-call `killedByZombieKiller(this)` check with a helper that accepts the snapshot:

```js
function killedByZombieKillerHits(hits = []) {
  return hits.some(hitHasZombieKiller);
}
```

3. Use:

```js
const zk = killedByZombieKillerHits(pendingHitsBeforeResolve);
```

4. Do not change revive count, revive timer, revive HP, corpse rendering, or `isAlive()` behavior in this fix.

### Required companion hardening

`hitHasZombieKiller()` currently checks:

```js
calc?.abilityDebug?.eventAbilitySemantic || hit?.event?.abilities || {}
```

But `BattleActor.takeDamage()` stores `damageCalculation` in `pendingHits`; it does not store the original attack event object. To make the existing check reliable without changing the hit schema, add `eventAbilitySemantic` to `DamageCalculator.calculate()` under `abilityDebug`.

In `js/battle/DamageCalculator.js`, add:

```js
const eventAbilitySemantic = event?.abilities || event?.ability?.semantic || {};
```

and include it in the returned `abilityDebug`:

```js
abilityDebug: {
  eventAbilitySemantic,
  ...existingFields
}
```

Do not remove existing debug fields.

### Acceptance criteria

- `BattleActorZombieRevivePatch.js` snapshots pending hits before `originalResolvePostDamage.call(...)`.
- `killedByZombieKiller` no longer depends on `this.pendingHits` after the original resolver returns.
- `DamageCalculator.calculate()` exposes `abilityDebug.eventAbilitySemantic`.
- Existing proc-based zombie killer detection through `calc.proc.pending` / `calc.proc.applied` remains intact.

## 3. Safe fix B — remove undefined variable in knockback fallback

### Fact

`BattleActor.resolveKnockbackDistancePx()` has this fallback branch:

```js
return { distancePx: this.knockbackPositionDistance, source: 'fallback-knockbackPositionDistance', scale };
```

`scale` is not defined in that scope.

### Required change

In `js/battle/BattleActor.js`, change only the fallback object:

```js
return {
  distancePx: this.knockbackPositionDistance,
  source: 'fallback-knockbackPositionDistance',
  scale: null
};
```

Do not alter the BCU knockback constants, `BcuKnockbackSpec.js`, or `startKnockback()` behavior in this fix.

### Acceptance criteria

- No reference to undefined `scale` remains in `BattleActor.resolveKnockbackDistancePx()`.
- The explicit-distance and BCU-distance branches remain unchanged.

## 4. Safe fix C — align `toxic` proc catalog with existing runtime support

### Fact

`BattleActorProcStatusPatch.js` supports `toxic` through `applyToxic()` and `applyBcuProc()`.

`BcuProcRuntime.js` includes `toxic` in its `runtimeKeys` and also exposes `applyPoison()` as `toxic`.

`ProcResolver.js` currently marks `toxic` as:

```js
implemented: false
```

This makes the catalog inconsistent with the runtime path already present in the code.

### Required change

In `js/battle/ProcResolver.js`, update only the `toxic` catalog entry:

```js
toxic: {
  key: 'toxic',
  category: 'state',
  implemented: true,
  pendingSupported: true,
  pendingType: 'state',
  target: 'actor'
}
```

Do not change `warp`, `barrierBreaker`, `shieldPierce`, `zombieKiller`, `soulstrike`, `wave`, `miniWave`, `surge`, or `miniSurge` in this pass.

### Why only `toxic`

`toxic` has an existing `BattleActor.applyBcuProc()` implementation path. The other listed procs are either handled through specialized patches, not handled by `applyBcuProc()`, or still require BCU-source verification.

### Acceptance criteria

- `ProcResolver.getProcCatalog().toxic.implemented === true`.
- No behavior is added for unsupported `warp`.
- No attempt is made to force barrier/shield/zombie/wave/surge through `BattleActor.applyBcuProc()`.

## 5. Do-not-change list for this pass

Do not change these unless a separate task explicitly asks for them and BCU Java has been read:

1. `BcuResistRuntime.getBcuResistValue()` mapping.
   - It explicitly says the current JS actor schema mapping is not proven.
   - Do not guess EUnit/EEnemy resist fields.

2. `warp` runtime behavior.
   - `BcuProcRuntime` routes `warp`, but `BattleActorProcStatusPatch.applyProc()` does not implement warp movement/status.
   - Do not mark `warp` implemented until BCU `Entity` warp behavior is ported.

3. `barrierBreaker` / `shieldPierce` catalog semantics.
   - Barrier and shield are currently consumed by `BattleActorBarrierShieldPatch.js` from `calc.proc.pending/applied`.
   - Do not reroute them through generic `applyBcuProc()` without a dedicated design.

4. wave/surge container timing.
   - `BattleWaveRuntimePatch.js` and `BattleSurgeRuntimePatch.js` already implement BCU-oriented container state machines.
   - Do not rewrite them in this pass.

5. Stage spawn scheduling.
   - `StageDefinitionNegativeSpawnPatch.js`, `BcuStageSpawnRuntime.js`, and `BattleSceneBcuStageSpawnPatch.js` already contain BCU-oriented logic.
   - Do not change spawn timing here.

6. Renderer/status icon work.
   - The existing root `AGENTS.md` may contain a broader status-icon plan, but this pass is for battle-runtime correctness only.
   - Do not add CSS/text/emoji placeholders.

## 6. Validation commands

Run syntax checks at minimum:

```bash
node --check js/battle/BattleActor.js
node --check js/battle/BattleActorZombieRevivePatch.js
node --check js/battle/DamageCalculator.js
node --check js/battle/ProcResolver.js
```

If no package scripts exist, do not invent `npm test` as a required gate.

Optional browser smoke test:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/index.html?debugBattle=1&debugUi=1
```

Manual smoke expectations:

- App boots without module syntax errors.
- Starting a battle still creates `BattleScene`.
- A normal damage hit still queues pending damage and resolves KB/death.
- Zombie revive behavior is unchanged except that zombie-killer hits can now block revive using the pre-clear hit snapshot.
- Toxic proc catalog now reports runtime support and still applies through existing `applyBcuProc` / `BcuProcRuntime` flow.

## 7. Commit discipline

Keep the patch small. Expected files:

```text
js/battle/BattleActor.js
js/battle/BattleActorZombieRevivePatch.js
js/battle/DamageCalculator.js
js/battle/ProcResolver.js
```

Do not touch unrelated renderer, asset, stage, wave, surge, or UI files.

Recommended commit title:

```text
Fix confirmed BCU parity runtime mismatches
```

Recommended PR summary:

```text
- Snapshot pending hits before post-damage cleanup so zombie killer can block zombie revive reliably.
- Expose event ability semantics in DamageCalculator debug data for hit-level consumers.
- Remove an undefined `scale` reference from BattleActor knockback fallback.
- Mark toxic proc as implemented in ProcResolver because the current runtime already supports toxic through applyBcuProc/BcuProcRuntime.
```
