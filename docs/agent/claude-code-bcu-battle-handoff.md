# Claude Code Handoff: BCU Battle Parity Completion

Last updated: 2026-06-14

This file is the single handoff artifact for continuing BCU battle parity work in `rhgrive2/game`.
It has two purposes:

1. Preserve the current fact-backed implementation state.
2. Provide a ready-to-paste execution prompt for Claude Code to finish the remaining runtime work.

This file is intentionally operational. It does not claim completion beyond what is proven in current repo code and docs.

## Objective

Complete the remaining BCU-parity battle features requested for:

- ally cat cannon
- enemy castle attack / retaliation / special attack
- enemy special castle / stage special attack
- stage spawning of enemy special castles / special objects
- battle wallet level-up

with minimal changes, no regression to existing battle results/rendering/UI/save behavior, and no guessed behavior where BCU source is not proven.

## Required reading before editing

Read these first and treat them as the current source of truth:

- `AGENTS.md`
- `docs/ability-logic/current-ability-parity-status.md`
- `docs/ability-logic/bcu-unresolved-evidence-blockers.md`
- `docs/ability-logic/bcu-parity-codex-workplan.md`
- `docs/ability-logic/bcu-fact-first-update-procedure.md`
- `docs/agent/bcu-parity-rules.md`
- `docs/agent/checks-and-verification.md`
- `docs/agent/report-format.md`

Follow the repo rule:

```txt
fact -> existing JS audit -> minimal update -> deterministic check -> docs/status update
```

Do not infer gameplay from field names.

## Current confirmed status

### Already implemented and source-backed

1. Battle wallet / worker-cat level
   - JS owner: `js/battle/BattleEconomy.js`
   - Wiring: `js/battle/BattleConfig.js`, `js/battle/ProductionRuntime.js`, `js/ui/PlayerProductionBar.js`
   - Current state:
     - wallet enabled for battle economy
     - BCU-like worker/wallet formulas wired
     - internal money uses visual money x100
     - upgrade gate is strict `money > upgradeCost`, not `>=`
     - Lv8 max handling exists
     - bottom-left UI button exists and is wired to BCU action `-1`
   - Existing deterministic check:
     - `scripts/check-bcu-wallet-runtime-parity.mjs`

2. Basic cat cannon only
   - JS owner:
     - `js/battle/bcu-runtime/BcuCatCannonRuntime.js`
     - `js/battle/BattleSceneBcuCatCannonPatch.js`
   - Wiring:
     - `js/boot/battle/installBattleScenePatches.js`
     - `js/ui/PlayerProductionBar.js`
     - `js/battle/BattleConfig.js`
   - Current state:
     - dedicated runtime exists and is intentionally separate from unit proc damage wrappers
     - bottom-right UI button exists and is wired to BCU action `-2`
     - charge / fire request / reset / 18F preTime are implemented
     - default charge is 1500F
     - basic cannon wave-band damage is implemented
     - assist knockback is applied post-damage as stage/cannon-owned behavior
     - current visual is trace-level `bcu-effanim-cat-cannon-basic`, not proven final bitmap parity
   - Existing deterministic check:
     - `scripts/check-bcu-cat-cannon-runtime-parity.mjs`

### Still partial and not safe to claim complete

1. Non-basic cat cannon IDs
   - Remaining families explicitly called out in current status docs:
     - `BASE_SLOW`
     - `BASE_WALL`
     - `BASE_STOP`
     - `BASE_WATER`
     - `BASE_GROUND`
     - `BASE_BARRIER`
     - `BASE_CURSE`
   - Do not route these through ordinary unit proc wrappers.

2. Enemy castle attack / retaliation / special attack
   - Current inspected BCU evidence in repo only proved base hit / guard paths strongly enough for implementation.
   - Special attack ownership, timing, and fixtures are still incomplete.

3. Stage/castle-derived special attacks
   - Examples explicitly called out by the user:
     - wave
     - surge
     - curse
     - dojo one-shot castle
   - These must stay stage/castle-owned at runtime.
   - Do not mix them into unit attack proc flows.

4. Stage spawning of special castles / special objects
   - Castle rows and normal castle metadata parsing exist.
   - Loader-backed fixture proof for special stage/castle object spawn definitions is still missing.

## BCU references already inspected

These were already inspected during the latest implementation batch and should be reused first:

### `references/bcu/BCU_java_util_common.zip`

- `battle/StageBasis.java`
  - `work_lv`
  - `money`
  - `maxMoney`
  - `upgradeCost`
  - `act_mon`
  - `act_can`
  - cannon charge/update/reset flow
- `battle/Treasure.java`
  - `getLvCost`
  - `getMaxMon`
  - `getMonInc`
  - `CanonTime`
  - `getCanonAtk`
- `util/Data.java`
  - `MLV`
  - `MT`
  - `LV_WORK`
  - `LV_WALT`
  - `LV_RECH`
  - `LV_CATK`
  - `LV_CRG`
  - `T_WORK`
  - `T_WALT`
  - `T_RECH`
  - `T_CATK`
  - `NYPRE`
  - `NYRAN`
- `battle/entity/Cannon.java`
  - `activate`
  - `update`
  - `BASE_H`
  - default preTime
  - default range band logic
  - sniper/assist proc ownership
- `battle/attack/AttackCanon.java`
- `battle/attack/ContWaveCanon.java`
- `battle/attack/AttackVolcano.java`
- `battle/entity/Entity.java`
  - cannon-owned `SNIPER -> interrupt(INT_ASS, KB_DIS[INT_ASS])`
- `battle/entity/ECastle.java`
  - only base hit/guard-related evidence was confidently reused so far

### `references/bcu/BCU_Android-master.zip`

- `androidutil/battle/BBCtrl.java`
  - bottom-left action `-1`
  - bottom-right action `-2`
- `androidutil/battle/BattleBox.java`
  - bottom UI draw behavior
  - wallet/cannon control placement
  - cannon gauge layout
  - FIRE button presentation

## Key repo touchpoints

These are the existing runtime/UI connection points that matter for completion:

- `js/battle/BattleEconomy.js`
- `js/battle/BattleConfig.js`
- `js/battle/ProductionRuntime.js`
- `js/ui/PlayerProductionBar.js`
- `js/battle/BattleSceneBcuCatCannonPatch.js`
- `js/battle/bcu-runtime/BcuCatCannonRuntime.js`
- `js/boot/battle/installBattleScenePatches.js`
- `js/battle/BattleSceneBcuCastleGuardPatch.js`
- `js/battle/StageDefinitionLoader.js`
- `js/battle/BattleSceneStageRuntimeWiring.js`
- `js/battle/StageRuntimeSceneAdapter.js`
- `js/battle/BattleSceneRenderer.js`

## Hard constraints

1. Do not conflate unit attack procs with stage/castle/cannon-owned attacks.
2. Do not regress existing wave/surge/curse/zombie/summon/runtime wiring.
3. Do not ship UI-only work with missing runtime.
4. Do not ship runtime-only work with missing UI/button/visual wiring where BCU shows a control or effect.
5. Do not invent missing CSV indexes or effect aliases.
6. Do not add broad try/catch to hide uncertainty.
7. Prefer minimal changes in the existing runtime ownership boundaries.
8. If exact BCU source/fixture proof is missing, stop and document the blocker instead of guessing.

## Known unresolved blockers

Current docs already record these unresolved blockers:

1. Non-basic cat cannon / stage-castle special runtime still needs source-backed fixtures and asset alias proof.
2. Enemy special castle / stage object spawning and attacks still need loader-backed fixture stages proving coordinates, collision, and source ownership.
3. Browser/manual appearance is not the main blocker right now; source ownership and fixture proof are.

Read:

- `docs/ability-logic/current-ability-parity-status.md`
- `docs/ability-logic/bcu-unresolved-evidence-blockers.md`

before extending any special attack family.

## Recommended implementation order

1. Audit the current `main` code paths around cat cannon, castle guard, and stage runtime spawn wiring.
2. Re-open the BCU source above and identify concrete owner classes and trigger conditions for:
   - non-basic cat cannon families
   - enemy castle attack / retaliation / special attack
   - special castle / stage object spawn and attack ownership
3. Add or extend dedicated runtime owners for castle/stage attacks instead of passing through unit proc wrappers.
4. Connect rendering/effects/UI only after runtime ownership is source-backed.
5. Update status docs only after the implementation and deterministic checks are real.

## Files changed in the latest batch

These files were modified or added in the most recent implementation batch and are relevant starting points:

- `css/bcu-battle-ui-fix.css`
- `docs/ability-logic/bcu-unresolved-evidence-blockers.md`
- `docs/ability-logic/current-ability-parity-status.md`
- `js/battle/BattleConfig.js`
- `js/battle/BattleEconomy.js`
- `js/battle/ProductionRuntime.js`
- `js/boot/battle/installBattleScenePatches.js`
- `js/ui/PlayerProductionBar.js`
- `js/battle/BattleSceneBcuCatCannonPatch.js`
- `js/battle/bcu-runtime/BcuCatCannonRuntime.js`
- `scripts/check-bcu-cat-cannon-runtime-parity.mjs`
- `scripts/check-bcu-wallet-runtime-parity.mjs`

## Handoff prompt for Claude Code

Paste the following as-is to Claude Code:

```md
Repo: rhgrive2/game

You are continuing BCU battle parity implementation in an existing JS battle runtime. Do not start from assumptions. Use current repo code plus local BCU references as the source of truth.

Required first reads:

- AGENTS.md
- docs/ability-logic/current-ability-parity-status.md
- docs/ability-logic/bcu-unresolved-evidence-blockers.md
- docs/ability-logic/bcu-parity-codex-workplan.md
- docs/ability-logic/bcu-fact-first-update-procedure.md
- docs/agent/bcu-parity-rules.md
- docs/agent/checks-and-verification.md
- docs/agent/report-format.md

Current known implementation state:

1. Battle wallet / worker-cat level is already implemented in:
   - js/battle/BattleEconomy.js
   - js/battle/BattleConfig.js
   - js/battle/ProductionRuntime.js
   - js/ui/PlayerProductionBar.js
   and documented as `code-complete-candidate`.

2. Only the basic cat cannon is implemented so far, with dedicated source-separated runtime in:
   - js/battle/bcu-runtime/BcuCatCannonRuntime.js
   - js/battle/BattleSceneBcuCatCannonPatch.js
   - js/ui/PlayerProductionBar.js
   - js/boot/battle/installBattleScenePatches.js
   This separation from unit proc wrappers is intentional and must be preserved.

3. Remaining target work is:
   - non-basic cat cannon types
   - enemy castle attack / retaliation / special attack
   - stage/castle-derived special attacks
   - spawning of special castles / special objects from stage definitions

BCU references already known to matter:

- references/bcu/BCU_java_util_common.zip
  - battle/StageBasis.java
  - battle/Treasure.java
  - util/Data.java
  - battle/entity/Cannon.java
  - battle/attack/AttackCanon.java
  - battle/attack/ContWaveCanon.java
  - battle/attack/AttackVolcano.java
  - battle/entity/Entity.java
  - battle/entity/ECastle.java
- references/bcu/BCU_Android-master.zip
  - androidutil/battle/BBCtrl.java
  - androidutil/battle/BattleBox.java

Non-negotiable constraints:

- Do not conflate unit attack proc runtime with stage/castle/cannon-owned attack runtime.
- Do not guess missing CSV indexes, effect aliases, or stage object schemas.
- Do not regress existing wave/surge/curse/zombie/summon/runtime behavior.
- Do not leave runtime unconnected to UI where BCU clearly exposes a battle control.
- Do not leave UI connected to placeholder logic.
- Prefer minimal changes that follow current ownership boundaries.

Required work:

1. Search current code for all relevant runtime owners, placeholder branches, and unconnected paths.
2. Inspect the BCU source and extract fact-backed behavior for:
   - each remaining cannon family
   - enemy castle attack/special behavior
   - special stage/castle object spawn and attack ownership
3. Implement the missing runtime with dedicated stage/castle/cannon owners.
4. Connect rendering/effects/UI only where the BCU owner is proven.
5. Add deterministic checks and run the repo-required verification suite.
6. Update docs/status only after the implementation is verified.

Existing files likely to be central:

- js/battle/BattleEconomy.js
- js/battle/BattleConfig.js
- js/battle/ProductionRuntime.js
- js/ui/PlayerProductionBar.js
- js/battle/BattleSceneBcuCatCannonPatch.js
- js/battle/bcu-runtime/BcuCatCannonRuntime.js
- js/boot/battle/installBattleScenePatches.js
- js/battle/BattleSceneBcuCastleGuardPatch.js
- js/battle/StageDefinitionLoader.js
- js/battle/BattleSceneStageRuntimeWiring.js
- js/battle/StageRuntimeSceneAdapter.js
- js/battle/BattleSceneRenderer.js

Important current blocker to respect:

- docs/ability-logic/bcu-unresolved-evidence-blockers.md explicitly says non-basic cat cannon and special stage/castle attacks still need source-backed fixtures and asset alias proof. If you cannot prove a family from current local BCU references and fixtures, stop and document the exact blocker instead of inventing behavior.

Final report format must exactly follow:

## Summary
- Rows moved to code-complete:
- Rows moved to human-visual-review-needed:
- Rows still partial:

## BCU references inspected
- files/classes/methods:

## Changed files
- code:
- tests:
- docs:
- generated assets:

## Verification
- command: result

## Remaining risks
- risk:
- reason:
- next action:
```

## Notes for the human handoff

- This file was created as a handoff artifact only.
- No new implementation or test execution was performed in this handoff-only step.
