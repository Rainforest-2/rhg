# Death soul and warp lifecycle current status

This note records the current implementation state for the dedicated BCU death animation and warp lifecycle task.

## Scope

This file supersedes older wording in `docs/ability-logic/fact-only-ability-parity-matrix.md` that described an earlier analysis-only pass. The repository now contains runtime implementation and deterministic checks for the death-soul and warp-lifecycle work.

Browser/manual visual inspection remains outside Codex hard requirements. Status below is non-visual: source reading, JS runtime wiring, ZIP/loader evidence, and deterministic test coverage.

## Death soul animation

Status: `code-complete-candidate`; `human-visual-review-needed` for exact appearance.

Implemented evidence:

- `BcuCombatModel.parseDeathAnimation` reads unit `DataUnit.ints[67]` and enemy `DataEnemy.ints[54]`.
- Enemy fallback `rawSoulId == -1 && ints[63] == 1` maps to Soul 9.
- `BattleBcuDeathAnimationRuntimePatch` wires `BattleActor.enterDeadState` and dead-state ticking to `BcuDeathAnimationRuntime`.
- `BcuDeathAnimationRuntime` hides the base actor while death soul is active.
- `BcuSoulEffectLoader` loads death soul entries from `public/assets/bundles/effect/soul.zip`.
- `BCU_DEATH_SOUL_FALLBACK_FRAMES` is a JS safety fallback only, not a claimed BCU visual frame value. It prevents permanent actor retention when a soul asset is missing or not loaded.
- `scripts/check-bcu-death-animation-parity.mjs` covers parser indexes, normal soul death, missing-asset fallback cleanup, AB_GLASS skip-soul behavior, death-surge trigger frame, and the current zombie-corpse partial marker.

Known remaining partials:

- Zombie corpse / soulstrike interaction remains partial.
- Death surge has deterministic 21-frame trigger coverage, but full interaction with zombie revive/corpse cleanup remains partial.

## Warp lifecycle

Status: `code-complete-candidate`; `human-visual-review-needed` for exact appearance.

Implemented evidence:

- `BcuWarpLifecycleRuntime` models warp as a lifecycle rather than a simple countdown.
- Entrance `WaprCont` equivalent spawns warp hole and warp chara effects at start.
- The base actor is hidden, untargetable, and untouchable while warp lifecycle is active.
- Actor movement occurs at the exit transition, not at proc start.
- Exit `WaprCont` equivalent spawns on the same tick as the move.
- The base actor remains hidden through exit animation and becomes renderable/targetable/touchable only after lifecycle completion.
- `IMUWARP` blocks warp lifecycle creation.
- Stale warp state is cleared if the actor dies during warp.
- `scripts/check-bcu-warp-lifecycle-parity.mjs` covers normal lifecycle, move timing, exit hidden behavior, IMUWARP, stale-dead cleanup, replacement warp lifecycle, and death during exit.

Known remaining partials:

- Exact pixel-perfect WaprCont appearance is not browser-verified.
- If future BCU source reading proves a different overlap/priority rule for multiple warp procs, update `BcuWarpLifecycleRuntime` and the replacement-lifecycle test.

## Required verification

Run these commands after edits touching death or warp behavior:

```bash
node --check js/battle/bcu-runtime/BcuDeathAnimationRuntime.js
node --check js/battle/bcu-runtime/BcuWarpLifecycleRuntime.js
node --check scripts/check-bcu-death-animation-parity.mjs
node --check scripts/check-bcu-warp-lifecycle-parity.mjs
node scripts/check-bcu-death-animation-parity.mjs
node scripts/check-bcu-warp-lifecycle-parity.mjs
```

If bundle content changes, also run:

```bash
unzip -l public/assets/bundles/effect/soul.zip
unzip -l public/assets/bundles/effect/wave.zip
```
