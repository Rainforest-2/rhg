# BCU visual review checklist

This checklist records manual browser visual review for BCU parity areas that already have runtime wiring and deterministic checks, but still should not be marked fully complete until their visible behavior has been inspected.

## Review rules

- Compare the browser preview against the corresponding BCU behavior or captured BCU reference.
- Record the stage/unit/enemy setup used for the review.
- Do not mark an item as visually accepted if only parser/runtime tests were run.
- If the behavior is logic-correct but visually different, keep the main parity row at `human-visual-review-needed` or lower.

## Checklist

| Area | Current parity status | What to review | Result | Notes |
|---|---|---|---|---|
| P_DELAY runtime/effect | `human-visual-review-needed` | Enemy delay effect appearance, placement, timing, and cooldown/stage-row delay visual impact | `not-reviewed` | Runtime/effect/coordinate checks exist; visual confirmation still required. |
| barrier / demon shield / shield breaker | `human-visual-review-needed` | Barrier/shield break phases, y offset, scale, layer, shield regen timing appearance | `not-reviewed` | Deterministic checks cover gate order and effect metadata. |
| burrow | `code-complete-candidate` | BURROW_DOWN, underground move, BURROW_UP actor appearance and renderability transitions | `not-reviewed` | Runtime lifecycle checks exist; visual review is optional before fully-complete claims. |
| spirit lifecycle | `human-visual-review-needed` | Spirit actor spawn, attack animation, A_IMUATK appearance, cleanup after attack | `not-reviewed` | Runtime lifecycle checks exist. |
| castle/base guard | `human-visual-review-needed` | Guard hold/break appearance and enemy-base damage hold visual feedback | `not-reviewed` | Runtime checks cover activeGuard equivalent and base damage hold. |
| summon | `partial` | Summon entry appearance, anim_type behavior, spawned actor placement/layer, same_health/bond_hp visible consequences | `not-reviewed` | Runtime checks exist; loader/stage allow/group semantics remain separate blockers. |
| zombie revive visual | `partial` | Corpse phase, revive phase, targetability transition, revive completion appearance | `not-reviewed` | Corpse/soulstrike logic checks exist; full revive visual is still incomplete. |

## Status values

- `not-reviewed`: no manual visual result recorded.
- `accepted`: visually matches the BCU reference closely enough for the current parity claim.
- `mismatch`: inspected and found a visible parity difference.
- `blocked`: cannot be reviewed because the required fixture, asset, or loader path is missing.
