# rhg

Browser-based Battle Cats Ultimate (BCU) battle preview/runtime project.

This repository aims to reproduce BCU battle behavior from local reference sources without treating a parser field, an old note, or a visual approximation as proof of parity.

## Current status — 2026-06-23

The current baseline is `semantic-strict`:

- generated semantic ZIP bundles are the authoritative runtime asset path;
- loose `public/assets/bcu/**` files are source material, not an implicit runtime fallback;
- BCU behavior claims require source evidence, JS owner/wiring, deterministic checks, and—when visible behavior matters—manual browser review.

The old long ZIP-analysis README was historical. It described code that has since changed and must not be used as the current defect list.

## Current audit result

A 2026-06-23 comparison of `Rainforest-2/rhg` against the BCU references found no confirmed `Critical` defect in the inspected scope. The principal remaining parity risks are evidence coverage and acceptance coverage, not the already-corrected historical Stage/Spawn parser issues.

### Loader-proven (non-visual complete)

| Area | Current conclusion | Evidence |
|---|---|---|
| SUMMON source loading | A real `CustomEntity.atks[].proc.SUMMON` file is loaded from disk and driven end to end (no normal CSV holder is invented; BCU stores SUMMON only on proc objects). | `check-bcu-summon-procobject-loader-parity` |
| `Trait.targetForms` | A real `Trait` file (targetType/targetForms) drives the single `bcuTraitCompatible` gate across the proc and Target-Only cross-paths. | `check-bcu-trait-targetforms-loader-parity` |
| Combo / orb / treasure / talent / PCoin | Real 150300 combo + talent/PCoin data plus treasure/orb constants compose in BCU order; equipped orbs fold through the resolver. In-battle appearance is a separate review item. | `check-bcu-modifier-realdata-sweep-parity` |
| Extra/custom zombie revive | A real `REVIVE` proc-object drives the BCU `ZombX.updateRevive` source/range/zombie/warp filter. | `check-bcu-zombie-extra-revive-source-range-parity` |
| Repository-local persistence | `FormationStore`/`StageRegistry` round-trip their own state and surface read/write failures instead of a silent catch. Self-persistence only — not a BCU save claim. | `check-formation-storage-failure-visibility` |

### Remaining (visual / out of scope)

| Area | Current conclusion | What must happen next |
|---|---|---|
| BCU save / lineup import-export | rhg ships no such feature and no BCU serialization owner exists in this checkout — out of scope, not a defect. | Only if added: find the BCU owner and add round-trip fixtures first. |
| Non-basic cat cannons | Gameplay runtime is present, including BASE_WALL. Per-cannon ATK/EXT bitmap aliases and exact extend/waved visual timing remain open. | Add aliases, then perform frame-by-frame browser comparison. |
| Visible effects and UI | Several deterministic paths remain unreviewed in a browser: P_DELAY, shield families, spirit, castle guard, summon, zombie revive, cannon effects. | Use the visual checklist; record `accepted`, `mismatch`, or `blocked` with a fixed fixture. |

## Important non-claims

- Plain BCU castles do not own a generic attack runtime. Boss enemy bases attack through the ordinary enemy owner; HP-threshold and kill-count spawns belong to stage spawn logic.
- A runtime being present does not prove that every real custom pack can feed it.
- Deterministic checks do not replace manual visual acceptance.
- Repository-local persistence does not imply BCU save compatibility.

## Documentation map

| Purpose | Current document |
|---|---|
| High-level migration state and audit summary | [`docs/bcu-migration-status.md`](docs/bcu-migration-status.md) |
| Ability/proc/effect status | [`docs/ability-logic/current-ability-parity-status.md`](docs/ability-logic/current-ability-parity-status.md) |
| Open evidence and compatibility blockers | [`docs/ability-logic/bcu-unresolved-evidence-blockers.md`](docs/ability-logic/bcu-unresolved-evidence-blockers.md) |
| Manual browser-review ledger | [`docs/ability-logic/bcu-visual-review-checklist.md`](docs/ability-logic/bcu-visual-review-checklist.md) |
| Death and warp lifecycle status | [`docs/ability-logic/death-warp-current-status.md`](docs/ability-logic/death-warp-current-status.md) |
| BCU source evidence inventory | [`docs/ability-logic/bcu-ability-source-evidence.md`](docs/ability-logic/bcu-ability-source-evidence.md) |
| Implementation order | [`docs/ability-logic/bcu-parity-codex-workplan.md`](docs/ability-logic/bcu-parity-codex-workplan.md) |
| Agent entrypoint | [`AGENTS.md`](AGENTS.md) |

## Source and verification rule

For every behavior change:

```text
BCU source fact -> current JS owner audit -> minimal change -> deterministic check -> focused docs update
```

References in `references/bcu/` are the primary behavior source. Do not substitute historical README claims for current source and runtime evidence.

## Checks

Use only checks relevant to a touched subsystem. Common commands include:

```bash
node scripts/check-bcu-parser-indexes.mjs
node scripts/check-projectile-damage-parity.mjs
node scripts/check-proc-immunity-resistance-parity.mjs
node scripts/check-bcu-summon-runtime-parity.mjs
node scripts/check-bcu-spirit-bundle-manifest-parity.mjs
node scripts/check-bcu-castle-guard-parity.mjs
node scripts/check-bcu-wallet-runtime-parity.mjs
node scripts/check-bcu-non-basic-cat-cannon-runtime-parity.mjs
node scripts/check-ability-partial-blockers.mjs
```

For visual claims, a passing script is necessary but not sufficient. Use `docs/ability-logic/bcu-visual-review-checklist.md` to record the browser comparison.