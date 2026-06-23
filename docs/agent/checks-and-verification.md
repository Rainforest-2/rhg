# Checks and Verification

Use small deterministic Node scripts under `scripts/check-*.mjs`. A check must exit nonzero when the behavior it owns regresses.

## Verification rule

Run the checks relevant to changed files. A passing script proves only its own asserted behavior; it does not prove real custom-data coverage, browser appearance, or BCU save compatibility unless it tests those exact boundaries.

Common parity checks:

```bash
node scripts/check-bcu-parser-indexes.mjs
node scripts/check-projectile-damage-parity.mjs
node scripts/check-proc-immunity-resistance-parity.mjs
node scripts/check-effect-bundle-aliases.mjs
node scripts/check-effect-coordinate-traces.mjs
node scripts/check-bcu-delay-runtime.mjs
node scripts/check-bcu-burrow-lifecycle-parity.mjs
node scripts/check-bcu-death-animation-parity.mjs
node scripts/check-bcu-warp-lifecycle-parity.mjs
node scripts/check-bcu-warp-interrupt-scene-parity.mjs
node scripts/check-bcu-zombie-corpse-soulstrike-parity.mjs
node scripts/check-bcu-summon-runtime-parity.mjs
node scripts/check-bcu-spirit-bundle-manifest-parity.mjs
node scripts/check-bcu-castle-guard-parity.mjs
node scripts/check-bcu-wallet-runtime-parity.mjs
node scripts/check-bcu-non-basic-cat-cannon-runtime-parity.mjs
node scripts/check-ability-partial-blockers.mjs
```

## Required checks by change type

| Change | Minimum verification |
|---|---|
| JS/MJS runtime | `node --check` on each touched file plus focused parity scripts |
| Loader / custom data fixture | positive + negative loader fixtures; target source data must be real or explicitly marked synthetic |
| Effect/bundle | relevant parity scripts, `unzip -l` for altered bundles, and `effect-zip-audit.md` update |
| Persistence | blocked/quota/invalid JSON handling plus reload continuity; no BCU compatibility claim without BCU serialization fixtures |
| Browser visual acceptance | deterministic trace plus human browser result recorded in `bcu-visual-review-checklist.md` |
| Markdown-only | link/path review and changed-doc consistency; no runtime suite is required solely for prose edits |

## Effect bundle inspection

For effect work, inspect the touched bundles:

```bash
unzip -l public/assets/bundles/effect/status-effects.zip
unzip -l public/assets/bundles/effect/wave.zip
unzip -l public/assets/bundles/effect/kbeff.zip
```

Update `../ability-logic/effect-zip-audit.md` with exact entries when a bundle changes. Never add a loose raw-asset runtime fallback to avoid bundle work.

## Markdown-only maintenance

For documentation-only changes:

```bash
git diff --check
find . -maxdepth 3 \( -name "AGENTS.md" -o -name "CLAUDE.md" -o -path "./docs/*.md" -o -path "./docs/*/*.md" -o -path "./docs/*/*/*.md" \) -print | sort
test -L CLAUDE.md
readlink CLAUDE.md
```

Also confirm that current-status, blocker, visual-review, migration, README, and agent-entrypoint language agree on:

- runtime vs loader vs visual vs schema boundary;
- the current SUMMON constraint;
- the lack of a generic castle-owned attack owner;
- the distinction between browser-local persistence and BCU save compatibility.