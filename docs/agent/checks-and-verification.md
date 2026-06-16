# Checks And Verification

Prefer small deterministic Node scripts under `scripts/check-*.mjs`. Each script must exit nonzero on failure.

Use relevant checks from the current workplan and status docs. Common checks include:

- `scripts/check-bcu-parser-indexes.mjs`
- `scripts/check-projectile-damage-parity.mjs`
- `scripts/check-proc-immunity-resistance-parity.mjs`
- `scripts/check-effect-bundle-aliases.mjs`
- `scripts/check-effect-coordinate-traces.mjs`
- `scripts/check-bcu-delay-runtime.mjs`
- `scripts/check-bcu-burrow-lifecycle-parity.mjs`
- `scripts/check-bcu-zombie-corpse-soulstrike-parity.mjs`
- `scripts/check-bcu-summon-runtime-parity.mjs`
- `scripts/check-bcu-castle-guard-parity.mjs`
- `scripts/check-ability-partial-blockers.mjs`

Run `node --check` on every touched JS/MJS file. Do not assume `package.json` exists.

For effect work, also run:

```bash
unzip -l public/assets/bundles/effect/status-effects.zip
unzip -l public/assets/bundles/effect/wave.zip
unzip -l public/assets/bundles/effect/kbeff.zip
```

Update `../ability-logic/effect-zip-audit.md` with exact entries when effect bundles change.

For Markdown-only maintenance, run at minimum:

```bash
git diff --check
find . -maxdepth 3 \( -name "AGENTS.md" -o -name "CLAUDE.md" -o -path "./docs/*.md" -o -path "./docs/*/*.md" -o -path "./docs/*/*/*.md" \) -print | sort
test -L CLAUDE.md
readlink CLAUDE.md
```
