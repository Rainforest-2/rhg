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

### High priority

| Area | Current conclusion | What must happen next |
|---|---|---|
| SUMMON source loading | Runtime works for explicit proc objects, but automatic discovery/loading of real custom-pack proc-object `SUMMON` data is not demonstrated. A normal unit/enemy CSV holder is still unproven. | Add real custom-pack loader fixtures. Do not invent a normal CSV holder. |
| Save / lineup compatibility | Browser persistence is repository-local `localStorage` JSON. BCU save/lineup import-export compatibility is unconfirmed. Current load/save paths also need explicit failure surfacing instead of silently falling back. | Identify the BCU serialization owner before claiming import/export support; add visible/logged storage failure handling. |

### Medium priority

| Area | Current conclusion | What must happen next |
|---|---|---|
| `Trait.targetForms` | Focused runtime fixtures exist, but broad real custom trait/form data and capture/proc edge coverage do not. | Add loader-backed real-data fixtures and a cross-path regression matrix. |
| Combo / orb / treasure / talent / PCoin | Main hooks exist, but broad real-data acceptance and in-battle visual acceptance remain partial. | Sweep real fixtures before broadening the completion claim. |
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