# Death soul and warp lifecycle current status

Updated: 2026-06-23.

This note is the current source of truth for the dedicated BCU death, zombie-revive, mini-death-surge, and warp lifecycle work in `Rainforest-2/rhg`.

## Status boundary

- `code-complete-candidate` means source evidence, runtime wiring, and deterministic checks exist.
- `human-visual-review-needed` means browser appearance has not been manually accepted.
- `partial` is reserved for broad source/loader/fixture gaps, not for a runtime that is already present.

## Death soul and standard zombie lifecycle

**Status:** `code-complete-candidate` for death-soul runtime; `human-visual-review-needed` for exact death/zombie appearance; `partial` only for broad extra/custom revive source coverage.

### Current evidence

- `BcuCombatModel.parseDeathAnimation` reads unit `DataUnit.ints[67]` and enemy `DataEnemy.ints[54]`.
- Enemy fallback `rawSoulId == -1 && ints[63] == 1` resolves Soul 9.
- `BattleBcuDeathAnimationRuntimePatch` wires `BattleActor.enterDeadState` and dead-state ticking to `BcuDeathAnimationRuntime`.
- `BcuSoulEffectLoader` reads death-soul assets from `public/assets/bundles/effect/soul.zip`.
- The missing-asset lifetime fallback is a JS safety guard only; it is not a claimed BCU frame value.
- `check-bcu-death-animation-parity.mjs` covers parser indexes, normal death soul, missing-asset cleanup, AB_GLASS skip-soul behavior, and death-surge trigger timing.
- `check-bcu-zombie-corpse-soulstrike-parity.mjs` covers revive indexes, corpse show-window targetability, AB_ZKILL/AB_CKILL behavior, soulstrike cancellation, zombie-killer suppression, revive HP, DOWN/REVIVE state timing, render override, cleanup, and no double death-surge spawn.

### Remaining boundaries

- Standard zombie corpse/revive behavior is no longer a blanket runtime-missing or parsed-only row. The remaining standard-path gap is browser acceptance of DOWN/REVIVE appearance.
- Extra/custom revive sources are fixture-backed only. Real source discovery, range filtering, and broader interaction coverage remain `partial`.
- Mini-death-surge has a proven ORB_DEATH_SURGE holder and deterministic selection/runtime coverage. Its remaining gap is browser appearance, not holder ownership.

## Warp lifecycle

**Status:** `code-complete-candidate`; `human-visual-review-needed` for exact WaprCont appearance.

### Current evidence

- `BcuWarpLifecycleRuntime` models entrance, hidden interval, exit movement, exit animation, and completion rather than a simple countdown.
- The actor is hidden, untargetable, and untouchable during warp.
- Position changes at the exit transition; no normal walk drift is allowed while warp is active.
- Scene-tick stages skip walking, retargeting, attack start, and attack timeline progression during the lifecycle.
- Warp start cancels in-progress attack and holds idle; warp completion resumes walking.
- `IMUWARP` prevents lifecycle creation; stale state clears on death; replacement lifecycle behavior is tested.
- `check-bcu-warp-lifecycle-parity.mjs` and `check-bcu-warp-interrupt-scene-parity.mjs` cover normal/replacement/death paths, forward/backward exit, attack cancellation, and walk resumption.

### Remaining boundaries

- Exact WaprCont pixels, overlap ordering for multiple warps if future BCU reading changes the rule, and browser-level effect acceptance remain open.

## 2026-06-23 audit rule

The current audit found no confirmed death/warp runtime regression in the inspected scope. Do not restore old wording that calls standard zombie or mini-death-surge runtime “unimplemented” or “parsed-only” without a current code and test failure.

## Required verification

```bash
node --check js/battle/bcu-runtime/BcuDeathAnimationRuntime.js
node --check js/battle/bcu-runtime/BcuWarpLifecycleRuntime.js
node scripts/check-bcu-death-animation-parity.mjs
node scripts/check-bcu-zombie-corpse-soulstrike-parity.mjs
node scripts/check-bcu-mini-death-surge-parity.mjs
node scripts/check-bcu-warp-lifecycle-parity.mjs
node scripts/check-bcu-warp-interrupt-scene-parity.mjs
```

If effect bundles change, also inspect `soul.zip` and `wave.zip` entries. Record visual results only in `bcu-visual-review-checklist.md`.