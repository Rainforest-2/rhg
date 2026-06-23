# BCU migration status

## Last updated

- date: 2026-06-23 (UTC)
- repository: `Rainforest-2/rhg`
- scope: current BCU ZIP/runtime/ability parity, rendering/UI acceptance, data loading, and persistence compatibility.
- audit basis: current rhg code plus the checked-in BCU reference ZIPs under `references/bcu/`.

This is the high-level source of truth. It supersedes historical README/ZIP-analysis claims where current code and focused status docs disagree.

## Current runtime baseline

- Default runtime mode: `semantic-strict`.
- Generated semantic ZIP bundles are the authoritative runtime asset source for bundled families.
- Loose `public/assets/bcu/**` files remain source material and must not become a silent runtime fallback.
- Core boot remains `public/assets/bundles/core/core-db.zip` through `BcuBootLoader` / `SemanticAssetProvider`.
- Formation and production icons resolve through semantic UI assets, not actor-image fallbacks.
- BCU sound ids `0..190` resolve from vendored music assets with stage-map BGM lookup and lazy sound-cache warming.

## Current focused documents

| Area | Current document |
|---|---|
| Ability/proc/effect parity | `docs/ability-logic/current-ability-parity-status.md` |
| Evidence and compatibility blockers | `docs/ability-logic/bcu-unresolved-evidence-blockers.md` |
| Browser visual review | `docs/ability-logic/bcu-visual-review-checklist.md` |
| Death and warp lifecycle | `docs/ability-logic/death-warp-current-status.md` |
| BCU source evidence | `docs/ability-logic/bcu-ability-source-evidence.md` |
| Implementation order | `docs/ability-logic/bcu-parity-codex-workplan.md` |

## 2026-06-23 audit summary

No confirmed `Critical` parity defect was found in the inspected scope. The dominant remaining risks are source-loading completeness, proof coverage, manual visual acceptance, and persistence scope.

### High priority

| Area | Current status | Risk / required next action |
|---|---|---|
| SUMMON source loading | `partial` | `BcuSummonRuntime` consumes explicit proc-object data, but automatic discovery/loading of real custom-pack proc objects is not demonstrated. Normal unit/enemy CSV `SUMMON` remains unproven. Add real custom-pack loader fixtures; do not invent a CSV holder. |
| Save / lineup compatibility | `unconfirmed` | `FormationStore` and `StageRegistry` persist repository-local JSON in browser `localStorage`. BCU save/lineup import-export is not proven. Identify the BCU serialization owner before adding or claiming BCU compatibility. Surface storage read/write failures instead of silently falling back. |

### Medium priority

| Area | Current status | Risk / required next action |
|---|---|---|
| `Trait.targetForms` / special traits | `partial` | Focused runtime fixtures pass, but broad real custom trait/form loader fixtures and capture/proc edge coverage are missing. |
| Combo / orb / treasure / talent / PCoin | `partial` | Main construction/resolver hooks exist. Broad real-data acceptance and in-battle visual acceptance remain incomplete. |
| Non-basic cat cannon visuals | `code-complete-candidate` for runtime | Per-cannon ATK/EXT bitmap aliases and exact extend/waved traveling/sweep timing remain unaccepted. |
| Visible-effect / UI acceptance | `human-visual-review-needed` or `partial` | P_DELAY, shield families, spirit, castle guard, summon, zombie revive, cat cannon, and BASE_WALL require fixture-backed browser review before visual-complete claims. |

## Corrected historical claims

Do not reopen these as present defects without a current code comparison:

- Historical StageDefinitionLoader findings (`rowIndex`, castle `noContinue`, `-1` enemy-castle resolution, and `bossGuard` source row) were corrected in current code and are not the principal current risk.
- Castle/base guard JS ownership is implemented. Its remaining gap is browser appearance, not a missing runtime owner.
- Standard zombie corpse/soulstrike/revive runtime is deterministically covered. Broader extra/custom revive source coverage and browser appearance remain open.
- Basic and non-basic cat cannon runtime are present; visual asset aliases and browser acceptance are separate work.
- Plain castles do not own a generic attack runtime. Boss bases use the ordinary `EEnemy` owner; stage HP/kill triggers belong to stage spawn logic.

## Persistence boundary

The project currently guarantees only repository-local persistence schema continuity where its own migrations support it. It does **not** claim:

- import of BCU saves or lineups;
- export consumable by BCU;
- lossless persistence when browser storage is blocked, full, or unavailable.

Any future BCU import/export work must first name the BCU save owner, serialization format, version rules, and round-trip fixtures.

## Required checks before status upgrades

```bash
node scripts/check-bcu-parser-indexes.mjs
node scripts/check-projectile-damage-parity.mjs
node scripts/check-proc-immunity-resistance-parity.mjs
node scripts/check-bcu-delay-runtime.mjs
node scripts/check-bcu-summon-runtime-parity.mjs
node scripts/check-bcu-spirit-bundle-manifest-parity.mjs
node scripts/check-bcu-castle-guard-parity.mjs
node scripts/check-bcu-wallet-runtime-parity.mjs
node scripts/check-bcu-non-basic-cat-cannon-runtime-parity.mjs
node scripts/check-ability-partial-blockers.mjs
```

Use only checks relevant to a touched subsystem. A passing check proves only the behavior it asserts.

## Manual browser verification focus

Use the visual checklist to record a fixed stage/unit/enemy fixture and a result of `accepted`, `mismatch`, or `blocked` for:

- P_DELAY and shield-family effects;
- burrow down/underground/up transitions;
- spirit actor and A_IMUATK;
- castle guard hold/break;
- summon `anim_type` entry and placement;
- zombie corpse DOWN/REVIVE;
- basic/non-basic cannon firing, traveling sweep, and BASE_WALL entry/idle.

## Documentation update rule

After a parity change, update focused documents in this order:

1. `current-ability-parity-status.md`
2. `bcu-unresolved-evidence-blockers.md`
3. `bcu-visual-review-checklist.md` only after an actual browser review
4. this file
5. `README.md` and `AGENTS.md` when the public summary or agent workflow changes

Never preserve a historical implementation gap as a current blocker after current code and checks prove it resolved.