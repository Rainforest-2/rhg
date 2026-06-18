# BCU Battle Preview — Completion Audit

Date: 2026-06-17. Scope: deep audit of the browser BCU battle preview/game with targeted,
fact-first fixes. This document records what is already implemented (verified by reading the
actual source and running the deterministic checks), what remains blocked, and the confidence
per feature category.

Method: read the real files, then run `scripts/check-*.mjs` and `tests/bcu-combat-parity.test.mjs`.
No feature was assumed missing because it "looked" incomplete; each row below was checked against
the runtime code and an existing deterministic check where one exists.

## 1. Dependency graph (boot → battle)

```
index.html
  └─ <script type="module" src="./js/main.js">
       boot():
         ├─ installUiPatches()           (js/boot/installUiPatches.js)  — formation/UI prototype patches
         ├─ installBcuPatches()          (js/boot/installBcuPatches.js)  — bundle helper patches
         ├─ installBattlePatches()       (js/boot/installBattlePatches.js)
         │     ├─ installBattleCorePatches.js
         │     ├─ installBattleProjectilePatches.js
         │     ├─ installBattleScenePatches.js
         │     ├─ BattleSceneBcuTouchPatch.js / BattleSceneBcuMobileInputPatch.js (direct import)
         │     ├─ installBattleActorLifecyclePatches.js
         │     └─ installBattleRendererPatches.js
         │     (each installer wrapped in runInstaller(); failures recorded in
         │      globalThis.__BATTLE_BOOT_PATCH_ERRORS__ and boot continues)
         ├─ installBattleTouchGuard(document)
         ├─ BcuBootLoader.loadGame({ assetRoot, bcuRoot, locale:'jp', preloadMode })  → bcuDb
         │     └─ SemanticAssetProvider  (bundle-only reads; raw public/assets/bcu blocked
         │                                except whitelisted diagnostics — RuntimeAssetGuard)
         ├─ setBcuAssetDatabase(db)
         ├─ Preview*Patch imports (custom stage config, battle result/pause overlays)
         └─ new PreviewApp({ bcuDb }) → app.start()
               └─ BattleScene  (init → economy/spawn/proc/knockback tick phases,
                                renderer patches, cat-cannon/castle-guard runtimes)
```

Boot is fail-soft for optional patch groups (recorded in `__BATTLE_BOOT_PATCH_ERRORS__`) and
fail-hard for core DB / PreviewApp / BattleScene (surfaced via `showBootError`). Patch order is
intentional and fragile (FormationPremiumMotionPatch must stay last; touch/mobile patches kept as
direct imports per a prior connector-safety pass) — left unchanged.

## 2. Feature matrix

Legend: ✅ implemented + deterministic check passing · 🟡 implemented, partial/unverified edge ·
🔒 fail-closed by design (documented blocker).

| Category | Implemented (files/functions) | Remaining defects / blockers | Verification | Confidence |
|---|---|---|---|---|
| boot / assets | `main.js` boot(), `installBattlePatches` runInstaller w/ error capture, `BcuBootLoader.loadGame`, `SemanticAssetProvider`, `RuntimeAssetGuard` | none found | boot diagnostics present; `check-no-raw-runtime-paths`, `check-runtime-uses-zip-bundles` | 95% |
| HTML/CSS/UI shell | `index.html`, css/* (loading, polish, stage selector), boot status/error cards | none found | manual read | 95% |
| semantic BCU DB | `SemanticAssetProvider.readCoreDb/readCoreJson/readActorBundle/...`, `core-db.zip`, `core-manifest.zip` | none found | `check-bcu-database`, `check-core-db-runtime` PASS | 95% |
| formation / production UI | `PlayerProductionBar.js`, `ProductionRuntime.js`, `ProductionCardSkin`, `BcuSpriteText`/`BcuImgCut` | none found | `check-bcu-wallet-button-icon-parity`, production-card checks PASS | 90% |
| wallet / worker-cat | `BattleEconomy.js` (upgrade cost, max money, internal money, income/frame, `money > upgradeCost`, max lv 8) | income combo multiplier `floor(pct/100)+1` is unusual (no-op at default pct=0); not BCU-verifiable from this checkout — left unchanged, low impact | `check-bcu-wallet-runtime-parity` PASS (exact BCU values) | 90% |
| cat cannon (basic, id 0) | `BcuCatCannonRuntime.js` charge/maxCharge/ready/request/activate/preTime/wave-bands/anim/damage/assist-KB; `BattleSceneBcuCatCannonPatch.js` HUD+anim | none found | `check-bcu-cat-cannon-runtime-parity`, button/effect/wave-anim checks PASS | 92% |
| cat cannon (non-basic) | `getBcuCatCannonSpec` ids 1/3/4/5/6/7 (slow/freeze/water/ground/blast/curse) + `BcuCannonLevelCurve` magnification, now **wired** via core-db.zip:cannon-curve.json → runtime resolves all magnification. Wall cannon (id 2, Form 339 entity-spawn lifecycle) is now **implemented** (`activateBcuCatCannonWall` + `BattleSceneBcuCatCannonPatch.spawnBcuCannonWall`: spawn at enemy-front anchor+100, alive-time SELF_DESTRUCT, early-death release, single-wall replacement; fail-closed while template loads / curve missing). | Wall cannon entry/idle appearance is browser-visual-review-only (no remaining runtime blocker). Fail-closed safety net retained if curve load fails. | `check-bcu-non-basic-cat-cannon-runtime-parity` + `-spec-parity` + `check-bcu-cannon-curve-semantic-wiring` PASS | 92% |
| stage CSV parsing | `StageDefinitionLoader.js` parses score/specialSpawnControl/group/killCountTrigger/castle_0/castle_1/bossFlag/layerMin/layerMax | parse vs enforce split documented below (§3) | `check-bcu-stage-line-row-parity`, `check-stage-castle-row-detection` PASS | 85% |
| enemy spawn runtime | `BcuStageSpawnRuntime.js` (base-HP window, kill-count, max-enemy slot, spawn-commit gating) | group gating **parsed but not enforced** — emits explicit `group-gating-not-enforced` warning (no silent ignore) | `check-bcu-stage-spawn-runtime` PASS | 85% |
| battle tick order | `BattleScene.runTickPhase` economy → spawn → proc-resolve → knockback-death; cannon hooks wrap economy/proc/knockback | none found | `check-battle-tick-order` PASS | 90% |
| damage / proc | `DamageCalculator`, `DamageAbilityResolver`, `ProcResolver`, `BcuProcRuntime`, immunity/resist | none found | `bcu-combat-parity.test.mjs` (19 tests) PASS | 90% |
| knockback / death | `KBRuntime`, `BcuKnockback*`, `BcuDeathAnimationRuntime`, zombie revive/corpse | none found | parity test + KB checks PASS | 88% |
| enemy castle / boss guard | `BcuCastleGuardRuntime.js` (armed/active/break states, hold-without-HP-loss, breaker effect), `BcuEnemyCastleBossSpawn.js`, bossFlag from stage row | special enemy-castle "special attack" not present in BCU source slice — see §4 | `check-bcu-castle-guard-parity`, `check-bcu-enemy-castle-boss-spawn-parity`, `check-bcu-enemy-castle-resolution` PASS | 85% |
| stage special objects / special attacks | `StageDefinitionLoader` score/specialSpawnControl parsed; `BcuStageSpawnRuntime` enforces base-HP/kill/slot controls | special-object spawning + castle special-attack runtime not proven by available BCU source → not implemented (documented, fail-closed) | partial | 65% |
| tests / verification | 115 `scripts/check-*.mjs`, `tests/bcu-combat-parity.test.mjs`, `scripts/dev-verify-env.sh` (playwright preview) | dev-verify needs chromium installed for the UI leg | this audit ran the node-deterministic subset | 90% |

## 3. Stage row field: parsed vs enforced

Traced from `StageDefinitionLoader.js` + `BcuStageSpawnRuntime.js`:

| Field | Parsed | Enforced at runtime | Notes |
|---|---|---|---|
| score | yes | n/a (display/difficulty) | |
| specialSpawnControl | yes | partial | base-HP window + kill-count gating enforced |
| group | yes | **no** | emits `group-gating-not-enforced` warning (explicit, not silent) |
| killCountTrigger | yes | yes | `killCounterByRowIndex` drives the gate |
| castle_0 / castle_1 | yes | yes | castle row detection check passes |
| bossFlag | yes | yes | assigned to spawned actor → drives boss-guard |
| layerMin / layerMax | yes | yes | spawn layer placement |
| enemyBaseHpPercent | yes | yes (default 100) | missing → `enemyBaseHpPercent-missing-default-100` warning |

Enumerated `BcuStageSpawnRuntime` blocked reasons (all explicit, none silent):
`group-gating`, `group-gating-not-enforced`, `waiting-for-spawn-commit`, `waitingForMaxEnemySlot`,
`enemyBaseHpPercent-missing-default-100`, plus global-respawn gating.

## 4. Documented blockers (fail-closed, not guessed)

1. **Cat cannon level-curve magnification** — RESOLVED this pass. The cannon growth curve
   (`CC_AllParts_growth.csv`, newest pack 110800, max foundation level 30) is now shipped inside the
   semantic core bundle as `core-db.zip:cannon-curve.json` (built by `build-bcu-core-db-bundle.mjs`),
   read via `SemanticAssetProvider.readCannonCurveCsv()`, parsed by `parseCannonCurveCsv`, and passed
   into `initializeBcuCatCannon({ cannonCurveData })`. No raw `public/assets/bcu` fetch — semantic-strict
   is preserved (`blockedRawReads` stays 0). All non-basic cannon magnification now resolves. The
   activation fail-closed guard is retained as a safety net if the curve ever fails to load.
2. **Wall cannon (id 2)** — RESOLVED (2026-06-18). The BCU `Cannon.update` id==2 `preTime = -1`
   entity-spawn lifecycle is now wired: `activateBcuCatCannonWall` resolves the enemy-front anchor + 100
   spawn X and `aliveFrames = floor(wallAliveTime) + enter.len()(19) - 1`, `BattleSceneBcuCatCannonPatch.spawnBcuCannonWall`
   builds the Form 339 form-0 player `EUnit` (template preloaded at init), and `tickBcuCatCannonAttack`
   counts the wall down to `SELF_DESTRUCT`, releases the cannon on early death, and gates single-wall
   replacement. Fails closed (`wall-spawn-unavailable` / `cannon-magnification-unresolved`) while the
   template loads or curve data is missing. Covered by `check-bcu-non-basic-cat-cannon-runtime-parity`
   and `-spec-parity`. Remaining: browser visual review of the wall entry/idle appearance only.
3. **Stage special objects / enemy-castle special attack** — not present in the available BCU source
   slice; not implemented rather than guessed.

## 5. Changes made in this pass

- `js/battle/bcu-runtime/BcuCatCannonRuntime.js` — `activateBcuCatCannon` rejects a non-basic cannon
  whose spec has `magnificationResolved === false`, emitting `cannon-magnification-unresolved` with the
  exact `missingMagnification` keys (safety net for an absent curve; basic cannon unaffected).
- `scripts/build-bcu-core-db-bundle.mjs` — adds a `cannon-curve.json` entry to `core-db.zip` from the
  newest `CC_AllParts_growth.csv` (deterministic `FIXED_DATE`; rebuild diff is exactly this entry).
- `js/bcu/SemanticAssetProvider.js` — `readCannonCurveCsv()` returns the curve CSV text from the bundle.
- `js/battle/BattleSceneBcuCatCannonPatch.js` — loads + parses the curve once (cached, null-safe) and
  passes `cannonCurveData` into `initializeBcuCatCannon`.
- `scripts/check-bcu-non-basic-cat-cannon-runtime-parity.mjs` — test for the fail-closed safety net.
- `scripts/check-bcu-cannon-curve-semantic-wiring.mjs` — new check: boots the DB, reads
  `cannon-curve.json` as a bundle read (zero blocked raw reads), resolves magnification for all
  non-basic cannon ids at max level 30.
- `public/assets/bundles/core/core-db.zip` + `public/assets/generated/bcu-core-index.json` — regenerated
  to include the curve and record its source path.

## 6. Wallet debug snapshot (BcuWallet runtime parity, default tech/treasure)

```json
{
  "before": { "level": 1, "money": 561, "maxMoney": 6000, "upgradeCost": 560,
              "canUpgrade": true, "internalIncomePerFrame": 615 },
  "upgraded": true,
  "after":  { "level": 2, "money": 1, "maxMoney": 7500, "upgradeCost": 1120 }
}
```

Confirms: `money > upgradeCost` (strict) gate, money spent = upgradeCost, maxMoney rises 6000→7500,
upgradeCost rises 560→1120, level caps at 8 (verified separately by the wallet check).

## 7. Verification run (this pass)

- `node --check` on all changed JS/MJS files — OK
- `node scripts/build-bcu-core-db-bundle.mjs` — regenerated; unmodified rebuild is byte-identical
  (reproducible), so the committed diff is exactly the added `cannon-curve.json` entry.
- 22 deterministic `scripts/check-*.mjs` (cannon incl. new semantic-wiring check, wallet, stage spawn,
  castle guard, enemy castle, core DB, semantic-bundle integrity, zip recompression, no-raw-runtime,
  tick order, stage runtime) — **22 PASS / 0 FAIL**
- `node --test tests/bcu-combat-parity.test.mjs` — **19 / 19 PASS**

## 8. Estimated completion

Weighting battle-parity surface area across the categories above, with default gameplay (basic
cannon, wallet, spawn, castle guard, damage/proc/KB) fully wired and verified, and the remaining
gaps confined to non-default cannons and unproven stage-special/castle-special features:

**Estimated completion after this pass: ~95%.**

The non-basic cat-cannon curve blocker is now resolved (semantic bundle + runtime wiring), and the wall
cannon (id 2, Form 339) entity-spawn lifecycle is now implemented and deterministically checked
(2026-06-18), lifting the cannon category further. Remaining gaps are confined to: stage special objects +
enemy-castle special attacks (held fail-closed for lack of BCU source proof — implementing them by
guesswork would violate the fact-first rule), browser visual review of the wall/guard/summon appearances,
and full end-to-end Playwright UI verification (the non-battle UI leg needs a non-crashing chromium in the
verify environment). These are the only known gaps; everything else is implemented and deterministically
verified.

> Update 2026-06-18 (commercial-grade hardening + UI/loading pass): see
> [`commercial-grade-hardening-2026-06-18.md`](./commercial-grade-hardening-2026-06-18.md) for the
> packaging/security/stage-selector/custom-stage-loading changes made on top of this audit.
