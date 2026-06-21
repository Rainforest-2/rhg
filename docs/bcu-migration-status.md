# BCU migration status

## Last updated

- date: 2026-06-20 (UTC)
- commit: local Codex parity implementation batch
- scope: current BCU ZIP/runtime/ability parity status, battle audio/full sound-id catalog, plus attack-only spirit form actor bundle manifest registration and spawn-ready semantic ZIP loading.

This file is the current high-level status page. Older migration task logs were intentionally collapsed so this page reflects the current state instead of preserving stale intermediate claims.

## Current runtime baseline

- Default runtime mode remains `semantic-strict`.
- BCU runtime data is expected to come from generated semantic ZIP bundles rather than direct `public/assets/bcu/**` reads for bundled families.
- Raw source assets under `public/assets/bcu/` are retained as source material; the runtime should not silently fall back to raw paths for generated bundle keys.
- Formation and production icons should resolve through `SemanticAssetProvider.getActorUiIconUrl()` and aggregate icon ZIPs, not actor bundle image fallbacks.
- Core DB boot path remains `public/assets/bundles/core/core-db.zip` through `BcuBootLoader` / `SemanticAssetProvider`.
- Stage, background, castle, actor, icon, core, language, and effect bundle families are treated as generated assets.
- Battle BGM and all BCU sound ids `0..190` are resolved from the vendored `public/assets/music/<id>.m4a` files. Stage BGM comes from sibling map data, including CH main-story `stageNN -> stageNormal0.csv` rows (for example 日本編 西表島 `stage47` resolves music id `4`, not catalog default `0`). `CH/stageNormal` map-data rows are filtered out of selectable battle stages, and ambiguous short CH ids such as `stage47` resolve to the canonical `000001/CH/stage` layout. The sortie path warms only the selected stage BGM plus `BATTLE_HOT_SE_IDS`; every other sound id is accepted by the battle SE bridge and lazy-warms through the in-memory HTMLAudio blob cache on first play.

## Current focused docs

| Area | Current doc |
|---|---|
| Ability/proc/effect parity status | `docs/ability-logic/current-ability-parity-status.md` |
| Manual visual review tracking | `docs/ability-logic/bcu-visual-review-checklist.md` |
| Evidence that still blocks broader claims | `docs/ability-logic/bcu-unresolved-evidence-blockers.md` |
| Death / warp lifecycle notes | `docs/ability-logic/death-warp-current-status.md` |
| Source evidence inventory | `docs/ability-logic/bcu-ability-source-evidence.md` |

## Current ability/proc/effect status summary

The detailed source of truth is `docs/ability-logic/current-ability-parity-status.md`.

### Code-complete candidates / deterministic runtime coverage

These areas have meaningful JS runtime wiring and focused checks, but may still need manual visual review before any `fully-complete` wording:

- freeze / slow / weaken / knockback proc
- curse / seal / toxic runtime paths
- warp lifecycle
- wave / mini-wave
- surge / mini-surge
- blast
- death soul core
- AB_GLASS skip-soul behavior
- burrow lifecycle
- spirit lifecycle and attack-only spirit form semantic ZIP loading
- standard zombie corpse / soulstrike / revive visual trace path
- special castle boss-spawn coordinate via `core-db.zip:boss-spawns.json` and `StageRuntime.bossSpawnWorldX`
- BASE_WALL cat cannon (id 2) wall-entity spawn lifecycle (Form 339 spawn at anchor+100, alive-time SELF_DESTRUCT, single-wall replacement)
- battle BGM/full BCU sound id catalog `0..190` with CH stage music rows, CH `stageNormal` map-data selection filtering, hot SE preload, BCU `SE_CANNON`/wallet/charge-ready SE timing, per-id `CommonStatic.setSE` frame dedupe, and lazy raw-id playback from `public/assets/music` (`scripts/check-battle-music-and-zombie-killer.mjs`)

### Human visual review still needed

These have deterministic runtime/effect evidence, but exact browser appearance has not been accepted by manual visual review:

- `P_DELAY` runtime/effect
- barrier / demon shield / shield breaker
- spirit lifecycle exact actor / A_IMUATK appearance
- castle/base guard hold/break appearance
- standard zombie corpse DOWN/REVIVE appearance
- summon entry appearance

Manual tracking lives in `docs/ability-logic/bcu-visual-review-checklist.md`.

### Still partial or fixture-blocked

Do not mark these as fully complete without more evidence or loaders:

- normal CSV summon holder: still not proven; current summon runtime consumes explicit proc-object data.
- BCU custom/proc-object summon loader: proc-object `SUMMON` handoff is fixture-backed, but broad automatic real custom-pack discovery is still needed.
- summon `anim_type` entry visuals; stage `allow` / group semantics are fixture-backed for `SCDef.smap` / `sdef` / `SCGroup` limits.
- full real-data `Trait.targetForms` loader fixtures; focused runtime fixtures now cover `targetType` / `targetForms` compatibility.
- combo / orb / treasure / talent / PCoin damage modifiers: combo speed (C_SPE), crit (C_CRIT), combo proc-duration/knockback payload buffs, and PCoin direct PC_P proc payloads are now wired (`check-bcu-combo-speed-crit-parity`, `check-bcu-combo-proc-duration-parity`, `check-bcu-talent-modifier`); broad real-data PCoin acceptance remains partial until fixture sweeps and visual acceptance are recorded.
- broader AB_SKILL status resistance holder sources.
- enemy toxic immunity: treated as nonexistent for supported enemy data; do not add an enemy `IMUPOIATK` CSV or loader holder.
- bounty/money battle visual: no stable visual owner/effect alias proven; treat as logic/economy unless future evidence proves visuals.
- mini-death-surge holder browser visual acceptance and broad extra/custom zombie revive source/range interactions.
- PC-only draw-side source evidence unless a PC source ZIP is added.

## Important corrected stale claims

The following older claims are no longer current:

- Castle/base guard JS owner is **not** missing anymore. `BcuCastleGuardRuntime` / `BattleSceneBcuCastleGuardPatch` implement the `StageBasis.activeGuard`-equivalent state and `scripts/check-bcu-castle-guard-parity.mjs` covers active/hold/break behavior. Remaining blocker: manual browser appearance.
- Zombie corpse / soulstrike is no longer just an unproven visual note. `scripts/check-bcu-zombie-corpse-soulstrike-parity.mjs` covers revive indexes, corpse targetability, soulstrike cancellation, zombie-killer suppression, death-surge single spawn, DOWN/REVIVE phase timing, render override hide/show, cleanup, and HP restoration. Remaining blockers: manual browser acceptance, mini-death-surge holder proof, and extra/custom revive fixtures.
- Summon runtime exists for explicit proc-object data, but normal unit/enemy CSV summon holder remains unproven. Keep those facts separate in future status updates.
- Spirit lifecycle code is not runtime-missing: attack-only spirit forms referenced by `DataUnit.ints[110]` are manifest-backed partial actor bundles and `scripts/check-bcu-spirit-bundle-manifest-parity.mjs` covers ZIP entries, manifest registration, semantic provider lookup, and `BattleActorFactory` spawn-ready loading. Remaining blocker: manual browser appearance.

## Required safe checks before parity status upgrades

```bash
node scripts/check-bcu-parser-indexes.mjs
node scripts/check-bcu-delay-runtime.mjs
node scripts/check-projectile-damage-parity.mjs
node scripts/check-proc-immunity-resistance-parity.mjs
node scripts/check-effect-bundle-aliases.mjs
node scripts/check-effect-coordinate-traces.mjs
node scripts/check-bcu-death-animation-parity.mjs
node scripts/check-bcu-warp-lifecycle-parity.mjs
node scripts/check-bcu-warp-interrupt-scene-parity.mjs
node scripts/check-bcu-zombie-corpse-soulstrike-parity.mjs
node scripts/check-bcu-barrier-shield-effect-parity.mjs
node scripts/check-bcu-demon-shield-regen-timing.mjs
node scripts/check-bcu-summon-runtime-parity.mjs
node scripts/check-bcu-spirit-bundle-manifest-parity.mjs
node scripts/check-bcu-castle-guard-parity.mjs
node scripts/check-ability-partial-blockers.mjs
node scripts/check-battle-music-and-zombie-killer.mjs
```

The GitHub Actions workflow `.github/workflows/bcu-parity-safe-suite.yml` runs the safe ability parity suite on push and pull request.

## Manual browser verification focus

Manual browser checks should prioritize visible behavior that deterministic checks cannot certify by themselves:

- compare BCU delay effect placement/timing against reference behavior.
- verify barrier / demon shield / shield breaker phases, offsets, scale, layer, and regen appearance.
- inspect burrow DOWN / underground / UP visual transitions.
- inspect spirit spawn, attack, A_IMUATK appearance, and cleanup.
- inspect castle guard hold/break phases and base damage hold feedback.
- inspect zombie corpse DOWN/REVIVE phase appearance and base actor hide/show timing.
- inspect summon entry `anim_type` behavior and spawned actor placement/layer.

## Rule for future docs updates

When implementation catches up, update the focused docs first:

1. `current-ability-parity-status.md`
2. `bcu-unresolved-evidence-blockers.md`
3. `bcu-visual-review-checklist.md`, only after actual manual browser review
4. this high-level `bcu-migration-status.md`

Do not leave a blocker doc saying a runtime is missing after a runtime check has been added.
