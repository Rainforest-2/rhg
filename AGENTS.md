# AGENTS.md

This file defines repository-wide instructions for AI coding agents working on `rhgrive2/game`.

The project is a browser-based Battle Cats Ultimate (BCU) parity / preview runtime. Many battle features are installed through ordered prototype patches from `js/main.js`. Preserve existing behavior first; optimize only when the change is demonstrably safe from code inspection.

## Scope

These instructions apply to the entire repository unless a more specific `AGENTS.md` exists in a subdirectory.

## Core rule

Do not change battle logic, rendering parity, or patch ordering while performing lightweight optimization. Prefer small, local, reviewable changes that reduce debug allocation or redundant diagnostic writes without altering game behavior.

## Reference source policy

When local reference ZIPs are available, treat the non-PC reference sources as the primary logic models:

- `BCU_java_util_common-ef840238e4700eb4b8eb57b4446633e465f4edd5.zip`
- `BCU_Android-master.zip`

These two sources are the logic examples to inspect for battle behavior, data interpretation, entity lifecycle, attack resolution, proc handling, status effects, wave/surge behavior, spawn logic, and other gameplay rules.

Do not use `BCU-java-PC-slow_kotlin.zip` as the primary gameplay-logic source when the non-PC references answer the same question. The PC source may still be useful for PC-specific rendering, tooling, UI, or presentation details, but it is not the first choice for gameplay logic parity.

Player-facing behavior should match the reference game. From a player perspective, this JavaScript implementation is expected to behave like the reference sources, even though the runtime language and performance constraints differ.

Because this repository is JavaScript running in a browser-like environment, do not mechanically port Java/Kotlin code line-for-line. Preserve the reference behavior, not necessarily the reference implementation shape. Avoid translating patterns that would create avoidable JS overhead, such as excessive allocation in hot loops, deep object graphs, broad per-frame scans, unnecessary wrapper churn, or debug object creation in battle/render paths.

When using the reference ZIPs, document which files/classes/methods were inspected and what behavior was derived from them. If the JS implementation intentionally differs for performance reasons, state the invariant that preserves player-visible behavior.

## Codex self-analysis workflow

When a local-file-capable Codex-style agent is asked to optimize or lighten the project, it must first analyze the repository and write its own task-specific design prompt before editing runtime code.

The design prompt is an internal planning artifact for the agent. It should be concrete enough to guide safe implementation, but it must not broaden the requested scope. It should include:

- the user's objective restated in one sentence;
- files inspected and why they matter;
- current data flow and wrapper chain for every touched method;
- import-order constraints from `js/main.js`;
- reference ZIP files/classes/methods inspected, when logic parity is involved;
- explicit non-goals;
- candidate optimizations ranked by safety;
- the exact code paths that must remain behaviorally unchanged;
- expected debug/global output changes, if any;
- static verification steps available in the local environment;
- rollback criteria.

Before changing code, the agent must use local search tools such as `rg`, `find`, and direct file reads to verify all references to the target symbols. At minimum, search for:

- `runTickPhase`
- `queueAttackDamage`
- `drawEffects`
- `drawActor`
- `BcuTraceRuntime.push`
- `pushEvent`
- `globalThis.__BCU_`
- `globalThis.__BATTLE_`
- `globalThis.__FORMATION_`
- `lastRenderDebug`
- `lastModelDrawDebug`
- `lastDrawListDebug`
- `lastHitEffectSpawnDebug`
- `getBattleDrawList`

If the analysis reveals new stable guardrails that should apply to future agents, update `AGENTS.md` in the same branch. Keep such updates factual and repository-specific. Do not add temporary implementation notes, one-off prompts, browser-only test instructions, or speculative claims.

The agent may proceed from analysis to implementation only when the planned change is local, reversible, and does not alter protected runtime contracts. Otherwise, stop after producing the design prompt and risk analysis.

## Protected runtime contracts

Treat the following as high-risk contracts:

- `BattleScene.prototype.runTickPhase`
- `BattleScene.prototype.queueAttackDamage`
- `BattleSceneRenderer.prototype.drawEffects`
- `BattleSceneRenderer.prototype.drawActor`
- actor animation mutation via `animator.apply(...)` and `model.getBattleDrawList(...)`
- wave / surge / projectile container lifetime and positioning
- status effect application, expiration, and visual rendering
- target selection, `canAttack`, and damage resolution order

Do not replace wrapper chains with direct `fn()` calls. If wrapping a method, call the captured original with the same `this` and compatible arguments, for example `originalRunTickPhase.call(this, phase, wrappedFn)`.

Do not assign frozen arrays to `scene.debugEvents` or `scene.tickPhaseTrace`. Existing wrappers may still push into these arrays. If debug storage must be cleared, keep the arrays mutable and truncate them.

## Import-order sensitivity

`js/main.js` imports many runtime patches in sequence. Later patches may intentionally wrap or replace methods installed by earlier patches. Before changing any patch file, inspect both:

- the relevant file itself;
- its import position in `js/main.js`.

Current high-risk ordering facts:

- `BattleSceneAttackEffectPatch.js` is imported before `BattleSceneRendererEffectGlowPatch.js`.
- `BattleSceneRendererEffectGlowPatch.js` can be the effective final `drawEffects` implementation.
- `BattleDebugStripPatch.js` is imported late and must preserve prior `runTickPhase` wrappers.

## Safe first-pass optimization targets

Prefer these before touching logic-heavy code:

1. `js/battle/BattleSceneBcuStatusEffectRenderPatch.js`
   - Remove or guard diagnostic trace allocation only.
   - Keep `manager.updateEffects(dt, scene)`.
   - Keep `getBcuStatusEffectPosition(...)`.
   - Keep `effect.runtime.draw(ctx, ...)` when `effect.runtime && pos.rendered`.
   - Do not break status icon/effect rendering.

2. `js/battle/BattleSceneRendererEffectGlowPatch.js`
   - Remove or guard render diagnostic allocation only.
   - Safe candidates include per-frame `debug` objects passed only for diagnostics, `effect.lastModelDrawDebug`, `effect.lastRenderDebug`, `globalThis.__BATTLE_EFFECT_RENDER_DEBUG__`, `errors`, and `examples`.
   - Keep `drawBcuImagePart`, opacity, glow, transform, scale, layer, sort, and position calculations unchanged.

3. `js/battle/BattleSceneAttackEffectPatch.js`
   - Prefer reducing `spawnHitEffect` diagnostic objects and no-op `pushEvent` payload allocation.
   - Do not change `EffectRuntime.createHitEffect`, `effects.push`, `durationMs`, `frameDurationMs`, layer, `worldX`, or y-offset behavior.
   - Renderer-side changes here may have limited runtime effect because a later renderer patch can replace `drawEffects`.

4. `js/ui/FormationCatalogVirtualDomPatch.js`
   - Removing `globalThis.__FORMATION_VDOM_DIFF_DEBUG__` is acceptable.
   - Do not change diffing behavior, image preservation, spacer logic, or `replaceChildren` flow.

5. `js/battle/BattleProjectilePerformanceAndPositionPatch.js`
   - Only remove or guard redundant trace suppression diagnostics.
   - Do not change `WAVE_SCREEN_OFFSET = -28`.
   - Do not change `normalizeProjectileEffect` semantics.
   - Do not change projectile hit-smoke suppression.

## Do not include in first-pass optimization

Avoid these unless explicitly requested and separately reviewed:

- draw-list caching;
- target-search indexing;
- status-icon dirty caching;
- background offscreen caching;
- projectile runtime consolidation;
- wrapper-chain refactoring;
- changes to wave/surge container tick frequency;
- changes to attack capture/excuse separation;
- changes to knockback, death, zombie revive, barrier, shield, curse, seal, or immunity behavior.

These areas can improve performance but can easily break BCU parity or existing regressions.

## Debug and trace policy

`BcuTraceRuntime` may be disabled/no-op in production-like runs. Removing diagnostic object allocation is acceptable when all of the following are true:

- the object is used only for `globalThis.__...DEBUG__`, `globalThis.__...TRACE__`, `BcuTraceRuntime.push(...)`, or `scene.pushEvent(...)`;
- no gameplay state depends on the object;
- rendering calls are preserved;
- the change is local and easy to review.

Do not claim a change has zero impact if it removes public console/debug globals. State it as: game behavior should be unchanged; debug/global inspection output may change.

## Agent verification limits

Do not ask AI coding agents to perform browser/manual gameplay checks unless the execution environment explicitly supports them. Browser runtime validation is out of scope for agents that only have repository and shell access.

For Codex-style agents, use static and local checks instead:

- inspect all changed files and adjacent wrapper files;
- inspect `js/main.js` import order for affected patches;
- search for references to removed globals, debug fields, and helper functions;
- verify no protected method wrapper was bypassed or replaced with a direct callback call;
- verify no rendering call was removed while deleting diagnostic objects;
- verify no wave/surge position, layer, lifetime, or hit-smoke suppression constant changed;
- verify no status effect update/draw path was skipped;
- run available non-browser checks only if the repository provides them;
- if no executable checks are available, state that validation is code-review-only.

## Change style

- Keep commits small.
- Prefer one risk category per commit.
- Do not mix debug allocation cleanup with logic refactoring.
- Do not change formatting broadly.
- Do not rename files or symbols unless required.
- If behavior parity is uncertain, stop at analysis and document the risk instead of changing code.
