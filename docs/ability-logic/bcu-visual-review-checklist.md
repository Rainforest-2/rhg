# BCU visual review checklist

Updated: 2026-06-24.

This ledger records **manual browser** acceptance for parity areas whose runtime and deterministic checks already exist. It is not a parser/checklist substitute.

## Review rules

1. Compare rhg against a BCU capture or a reproducible BCU reference behavior.
2. Record the stage, unit/enemy/cannon, levels/modifiers, browser/device scale, and capture frame range.
3. Review timing, position, scale, layer, visibility, and cleanup—not only whether an effect appears.
4. Mark `accepted` only when the chosen fixture matches closely enough for the documented claim.
5. A headless check or deterministic trace alone never changes `not-reviewed` to `accepted`.
6. Use `blocked` when the required real-data fixture or asset alias does not exist; record the precise blocker.

## Checklist

| Area | Current parity status | Minimum review fixture | What to inspect | Result | Notes |
|---|---|---|---|---|---|
| P_DELAY | `human-visual-review-needed` | Player cooldown delay and enemy stage-row delay | effect placement, actor layer, timing, cooldown/row delay feedback | `not-reviewed` | Runtime/effect/coordinate checks exist. |
| Barrier / demon shield / shield breaker | `human-visual-review-needed` | Barrier break, demon shield break, regen | phase order, y offset, scale, layer, regen timing | `not-reviewed` | Deterministic gate/metadata checks exist. |
| Burrow | `code-complete-candidate` | One normal burrow enemy and one `TCH_UG` interaction | DOWN, underground move, UP, targetability/renderability transition | `not-reviewed` | Lifecycle is tested; appearance remains unaccepted. |
| Spirit | `human-visual-review-needed` | Conjurer plus attack-only spirit form | spawn, attack animation, A_IMUATK, cleanup after attack, conjure-card ready flash | `not-reviewed` | Semantic ZIP/factory path exists; pre-warp origin, capacity gating, once-per-frame cooldown, cooldown-ready emphasize cue, the one-frame post-conjure production lock, the production-card ready-state wiring, and boss-shockwave immunity are deterministic-test covered. The ready/cooldown data reaches the card render model (`PlayerProductionBar` `bcuSpirit`); only drawing that flash and the spirit/A_IMUATK appearance still need browser acceptance. |
| Castle/base guard | `human-visual-review-needed` | Guarded boss stage | hold appearance, held base-damage feedback, break timing/cleanup | `not-reviewed` | State and effect trace are tested. |
| SUMMON entry | `partial` | Loader-backed real custom proc-object summon fixture | `anim_type`, entry phase, placement, layer, same_health/bond_hp visible consequences | `blocked` | Automatic real custom-pack discovery/loading remains incomplete. |
| Zombie revive | `human-visual-review-needed` for standard path | Standard revive zombie with/without zombie killer | corpse DOWN, show-window targetability, REVIVE, hide/show, completion | `not-reviewed` | Extra/custom revive sources remain separate partial work. |
| Mini-death-surge | `human-visual-review-needed` | ORB_DEATH_SURGE fixture | demon soul, surge start frame, WT_MIVC appearance, cleanup | `not-reviewed` | Holder/runtime are deterministic-test covered. |
| Wallet button | `human-visual-review-needed` | unaffordable, affordable flash, Lv8 max | bitmap frame, BCU sprite text, bottom-left anchoring, flash cadence | `not-reviewed` | Headless UI checks exist. |
| Basic cat cannon button/firing | `human-visual-review-needed` | partial charge, full-flash, fire | button/gauge/FIRE frames, base firing animation, 18F preTime, traveling wave | `not-reviewed` | Logic/draw math are tested. |
| Non-basic cannon: SLOW/STOP/WATER/GROUND/BARRIER/CURSE | `code-complete-candidate` runtime | one fixture per cannon id | source animation availability, target range, sweep/travel timing, hit/effect placement | `not-reviewed` | Per-cannon ATK/EXT bitmap aliases are now wired (`getBcuCatCannonAnimFiles` + `spawnCatCannonNonBasicEffect`, `check-bcu-non-basic-cat-cannon-anim-parity`); exact sweep/travel timing still needs browser acceptance. |
| BASE_WALL cannon | `code-complete-candidate` runtime | Form 339 wall spawn with enemy front and no-enemy fallback | entry, idle, spawn position, anchor+100, early death, self-destruct | `not-reviewed` | Runtime lifecycle is tested; visual assets/placement need acceptance. |

## Result values

- `not-reviewed`: no human browser comparison has been recorded.
- `accepted`: documented fixture visually matches the BCU reference closely enough.
- `mismatch`: a visible difference was found; include a short issue description and frame/position evidence.
- `blocked`: fixture, source loader, capture, or asset alias is unavailable.

## Required note format

When changing a result, replace the Notes cell with:

```text
fixture: <stage / unit / enemy / cannon / modifiers>
reference: <BCU capture or reproducible BCU setup>
reviewed: <date, browser/device, scale>
result: <what matched or differed>
```

Do not change implementation status in this file. Update `current-ability-parity-status.md` and `bcu-unresolved-evidence-blockers.md` separately when evidence or runtime coverage changes.
