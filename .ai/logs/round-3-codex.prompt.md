# Codex Fix Prompt

You are the implementation owner for this repository.

Implement only the `Next Codex Task` from `.ai/review.md`. Do not implement other review findings unless they are strictly required to complete that task.

Constraints:
- Do not make huge changes.
- Do not make unrequested specification changes.
- Preserve existing runtime behavior unless the task explicitly requires changing it.
- If facts are missing or the requested behavior cannot be proven, record the uncertainty in `.ai/state.md` under an `Unresolved` heading.
- Update `.ai/state.md` when the `Next Codex Task` includes audit bookkeeping. Keep `## Audited Areas` and `## Unaudited Major Areas` current; remove an unaudited area only after it was actually inspected.
- Add or update focused tests when the change needs test coverage.
- Append a concise summary of your changes and verification notes to `.ai/changelog.md`.
- Do not commit.
- Do not push.

Before finishing, run the verification commands that are relevant to the files you changed when they are available in this environment.


# Runtime Context
Round: 3 of 10
Repository: /workspaces/rhg

## Claude Review
Confirmed definitively:
- `js/battle/bcu-runtime/BcuEntityEffectIconRuntime.js` has **zero importers**, and it is the **only** importer of the entire `js/bcu-render/` chain → the whole `js/bcu-render/` directory is orphaned (reachable only through a file nothing imports).
- The live status-icon path uses a **same-named inline class** `BcuEntityEffectIconRuntime` inside `BcuStatusEffectManager.js`.
- `isDone()`/`done()` and `removeEffect()` are not consumed anywhere (the lone `.done(` hit is a comment), so the "never sets `finished=true`" surface is dead, not a live defect.
- Previous patch (`installBattlePatches.js` `runDirectImports`) is correct and consistent with sibling error-record sites — no regression.

The freshly audited live render path (`BcuModelInstance`, `BcuSpriteSheet`, `BcuCanvasComposite`, `BcuStatusEffectManager`, `BcuStatusIconResolver`) is consistent and clean. No runtime defect found; the concrete discovery is the orphaned `js/bcu-render` chain + duplicate class name.

# Review

## Critical
None

## High
None

## Medium
- **`js/bcu-render/*` is an orphaned module chain with a duplicate live class name.** Verified by import-path grep: nothing imports `js/battle/bcu-runtime/BcuEntityEffectIconRuntime.js`, and that file is the *sole* importer of the `js/bcu-render` chain (`BcuEffAnimRuntime.js` → `BcuEPartTransformRuntime.js`). `BcuBlendRuntime.js` and `BcuFakeGraphicsCanvas2D.js` have zero importers as well. Meanwhile the *live* status-icon path (`BcuStatusEffectManager.js:178`) drives a different, same-named inline class `BcuEntityEffectIconRuntime` (`BcuStatusEffectManager.js:109`) and the live render math (`BcuModelInstance`, `BcuSpriteSheet`, `BcuCanvasComposite`). The duplicate name is a real latent hazard (a future edit to "the icon runtime" could touch the dead file or the wrong class). This round's action is to **record** this (audit bookkeeping + Unresolved decision), **not** to delete code — removal of orphaned scaffold needs an evidence-based decision per the repo guardrails (it may be intentional parity scaffolding; `scripts/check-bcu-renderer-patch.mjs` exists and the glow-value set is still unconfirmed).

## Low
- **`BcuStatusEffectManager.js` dead surface.** The inline `BcuEntityEffectIconRuntime.isDone()` (line 138) and `removeEffect()` (line 227) are never called (effect lifetime is governed by the `wanted`-set delete in `updateEffects`, matching the documented "removed by status expiry, not anim-loop completion" comment at lines 118-121). `finished` is never set to `true`, which is consistent with that design. Not a defect; record as an observation only.
- **`js/bcu-render/BcuBlendRuntime.js:14`** computes `const compositeBefore = ctx.globalCompositeOperation;` but never uses it (dead variable). Cosmetic; do not fix this round (orphaned file; touching it isn't warranted while a removal decision is pending).
- **`js/battle/StageRegistry.js` + `js/data/bcuStageManifest.js` verified as by-design, not a defect.** The default stage `stageRNA001_00` resolves to a `BCU_STAGE_MANIFEST` entry whose `stageCsvPath` points at `./public/assets/bcu/...`; this is the intended curated RNA demo-stage path (distinct from the semantic ZIP pack stages), not an implicit raw-asset fallback. Recorded so a later round does not "fix" it into a regression.

## Next Codex Task
No runtime code change this round (no live defect exists in the freshly audited area; deleting orphaned scaffold is deferred pending an evidence-based decision). Record the `js/bcu-render` fresh audit in `.ai/state.md`:

1. **Audited Areas** — add:
   `js/bcu-render` — full read-through of `BcuBlendRuntime.js`, `BcuEPartTransformRuntime.js`, `BcuEffAnimRuntime.js`, `BcuFakeGraphicsCanvas2D.js`. Verified the whole `js/bcu-render` chain is currently **orphaned**: its only battle bridge `js/battle/bcu-runtime/BcuEntityEffectIconRuntime.js` has zero importers, and the live status-icon runtime is the same-named inline class in `js/battle/bcu-runtime/BcuStatusEffectManager.js`. Also read the live status/render path (`BcuStatusEffectManager.js`, `BcuModelInstance.js`, `BcuSpriteSheet.js`, `BcuCanvasComposite.js`, `BcuStatusIconResolver.js`) and `StageRegistry.js` and found them consistent; confirmed the previous round's `installBattlePatches.js` `runDirectImports` fix has no regression.

2. **Unaudited Major Areas** — remove `js/bcu-render`, leaving `js/battle`, `js/bcu`, `js/data`, `js/preview`, `js/ui`, `scripts`, `tests`. (Do **not** remove `js/battle`, `js/bcu`, `js/data`, or `js/preview`: only individual files were read this round, not the full areas.)

3. **Discovered Issues / Current Task** — record: "Audited `js/bcu-render`; the chain is orphaned (no importer of `BcuEntityEffectIconRuntime.js`) and its class name collides with the live inline `BcuEntityEffectIconRuntime` in `BcuStatusEffectManager.js`. Recorded as a decision item; no code removed."

4. **Unresolved** — add:
   - `js/bcu-render` chain (`BcuBlendRuntime`/`BcuEPartTransformRuntime`/`BcuEffAnimRuntime`/`BcuFakeGraphicsCanvas2D`) + the dead bridge `js/battle/bcu-runtime/BcuEntityEffectIconRuntime.js` are orphaned and duplicate the live `BcuEntityEffectIconRuntime` class name; decide whether to remove the dead scaffold or wire it in, with evidence, before claiming `js/bcu-render` clean. Keep the existing `isBcuBlendGlow` glow-value uncertainty (`glow === 1|2|3|-1` unconfirmed vs BCU `EPart`/glow source).
   - Note that `BcuEffAnimRuntime.done()` and the inline `BcuEntityEffectIconRuntime.isDone()` never set `finished = true`; this appears intentional (status icons removed by expiry, not anim-loop completion) but is unconfirmed against BCU and currently has no consumer.

5. Append a concise summary to `.ai/changelog.md`. Do not add new status files, do not delete or modify any `js/` runtime code, and do not change the glow-value set.

## Verification Commands
- `node scripts/check-bcu-renderer-patch.mjs`
- `node scripts/check-battle-speed-control.mjs`
- `npm run check`
- `npm test`
- `npm run build`

## Stop Condition
Not satisfied. This is round 3 of at least 5; `## Unaudited Major Areas` still lists seven areas (`js/battle`, `js/bcu`, `js/data`, `js/preview`, `js/ui`, `scripts`, `tests`) after this task lands; and verification has not yet run for this round. Continue the loop.


## Latest Verification Output
No verification output for this round yet.
