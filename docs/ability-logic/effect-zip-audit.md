# Effect ZIP audit

Date: 2026-05-25.

Latest docs-only verification: 2026-06-04. No bundle, builder, manifest, generated asset, or loose asset file was changed in the 2026-06-04 evidence extraction pass.

This file records only entries proven by `unzip -l` against the current checkout. Builder definitions, raw files under `public/assets/bcu`, and older docs are not treated as bundle evidence.

## Commands

```bash
unzip -l public/assets/bundles/effect/status-effects.zip
unzip -l public/assets/bundles/effect/wave.zip
unzip -l public/assets/bundles/effect/kbeff.zip
unzip -l public/assets/bundles/effect/soul.zip
```

2026-06-04 result: all four commands completed and the entries listed below were present in the current checkout. This audit still treats loose `public/assets/bcu/**` files as build-time inputs only, not production runtime evidence.

## `effect/status-effects.zip`

Stable runtime aliases proven present:

| Topic | ZIP entries | Runtime alias status |
|---|---|---|
| weaken / attack down | `A_DOWN/image.png`, `A_DOWN/imgcut.imgcut`, `A_DOWN/model.mamodel`, `A_DOWN/DEF.maanim`; `A_E_DOWN/image.png`, `A_E_DOWN/imgcut.imgcut`, `A_E_DOWN/model.mamodel`, `A_E_DOWN/DEF.maanim` | stable actor status aliases |
| strengthen / attack up | `A_UP/image.png`, `A_UP/imgcut.imgcut`, `A_UP/model.mamodel`, `A_UP/DEF.maanim`; `A_E_UP/image.png`, `A_E_UP/imgcut.imgcut`, `A_E_UP/model.mamodel`, `A_E_UP/DEF.maanim` | stable actor status aliases |
| slow | `A_SLOW/image.png`, `A_SLOW/imgcut.imgcut`, `A_SLOW/model.mamodel`, `A_SLOW/DEF.maanim`; `A_E_SLOW/image.png`, `A_E_SLOW/imgcut.imgcut`, `A_E_SLOW/model.mamodel`, `A_E_SLOW/DEF.maanim` | stable actor status aliases |
| stop | `A_STOP/image.png`, `A_STOP/imgcut.imgcut`, `A_STOP/model.mamodel`, `A_STOP/DEF.maanim`; `A_E_STOP/image.png`, `A_E_STOP/imgcut.imgcut`, `A_E_STOP/model.mamodel`, `A_E_STOP/DEF.maanim` | stable actor status aliases |
| survive | `A_SHIELD/image.png`, `A_SHIELD/imgcut.imgcut`, `A_SHIELD/model.mamodel`, `A_SHIELD/DEF.maanim`; `A_E_SHIELD/image.png`, `A_E_SHIELD/imgcut.imgcut`, `A_E_SHIELD/model.mamodel`, `A_E_SHIELD/DEF.maanim` | stable actor status aliases |
| attack-nullify | `A_IMUATK/image.png`, `A_IMUATK/imgcut.imgcut`, `A_IMUATK/model.mamodel`, `A_IMUATK/DEF.maanim` | stable actor status alias |
| curse | `A_CURSE/image.png`, `A_CURSE/imgcut.imgcut`, `A_CURSE/model.mamodel`, `A_CURSE/DEF.maanim`; `A_E_CURSE/image.png`, `A_E_CURSE/imgcut.imgcut`, `A_E_CURSE/model.mamodel`, `A_E_CURSE/DEF.maanim` | stable actor status aliases |
| seal | `A_SEAL/image.png`, `A_SEAL/imgcut.imgcut`, `A_SEAL/model.mamodel`, `A_SEAL/DEF.maanim`; `A_E_SEAL/image.png`, `A_E_SEAL/imgcut.imgcut`, `A_E_SEAL/model.mamodel`, `A_E_SEAL/DEF.maanim` | stable actor status aliases |
| poison / toxic | `A_POISON/image.png`, `A_POISON/imgcut.imgcut`, `A_POISON/model.mamodel`, `A_POISON/DEF.maanim` | stable actor status alias |

No barrier, demon shield, warp, wave invalid, wave stop, wave guard, counter surge, summon, metal killer, surge, or blast stable entries are present in this ZIP.

## `effect/wave.zip`

Stable runtime aliases proven present:

| Topic | ZIP entries | Runtime alias status |
|---|---|---|
| unit wave | `unit-wave/image.png`, `unit-wave/imgcut.imgcut`, `unit-wave/model.mamodel`, `unit-wave/anim.maanim` | stable runtime alias |
| enemy wave | `enemy-wave/image.png`, `enemy-wave/imgcut.imgcut`, `enemy-wave/model.mamodel`, `enemy-wave/anim.maanim` | stable runtime alias |
| unit mini-wave | `unit-mini-wave/image.png`, `unit-mini-wave/imgcut.imgcut`, `unit-mini-wave/model.mamodel`, `unit-mini-wave/anim.maanim` | stable runtime alias |
| enemy mini-wave | `enemy-mini-wave/image.png`, `enemy-mini-wave/imgcut.imgcut`, `enemy-mini-wave/model.mamodel`, `enemy-mini-wave/anim.maanim` | stable runtime alias |
| unit surge | `unit-surge/image.png`, `unit-surge/imgcut.imgcut`, `unit-surge/model.mamodel`, `unit-surge/anim-start.maanim`, `unit-surge/anim-during.maanim`, `unit-surge/anim-end.maanim` | stable runtime alias |
| enemy surge | `enemy-surge/image.png`, `enemy-surge/imgcut.imgcut`, `enemy-surge/model.mamodel`, `enemy-surge/anim-start.maanim`, `enemy-surge/anim-during.maanim`, `enemy-surge/anim-end.maanim` | stable runtime alias |
| unit mini-surge | `unit-mini-surge/image.png`, `unit-mini-surge/imgcut.imgcut`, `unit-mini-surge/model.mamodel`, `unit-mini-surge/anim-start.maanim`, `unit-mini-surge/anim-during.maanim`, `unit-mini-surge/anim-end.maanim` | stable runtime alias |
| enemy mini-surge | `enemy-mini-surge/image.png`, `enemy-mini-surge/imgcut.imgcut`, `enemy-mini-surge/model.mamodel`, `enemy-mini-surge/anim-start.maanim`, `enemy-mini-surge/anim-during.maanim`, `enemy-mini-surge/anim-end.maanim` | stable runtime alias |
| unit blast | `unit-blast/image.png`, `unit-blast/imgcut.imgcut`, `unit-blast/model.mamodel`, `unit-blast/anim-start.maanim`, `unit-blast/anim-explode.maanim`, `unit-blast/anim-dummy.maanim` | stable runtime alias |
| enemy blast | `enemy-blast/image.png`, `enemy-blast/imgcut.imgcut`, `enemy-blast/model.mamodel`, `enemy-blast/anim-start.maanim`, `enemy-blast/anim-explode.maanim`, `enemy-blast/anim-dummy.maanim` | stable runtime alias |
| strong attack | `strong-attack/image.png`, `strong-attack/imgcut.imgcut`, `strong-attack/model.mamodel`, `strong-attack/anim.maanim` | stable runtime alias |
| metal killer | `metal-killer/image.png`, `metal-killer/imgcut.imgcut`, `metal-killer/model.mamodel`, `metal-killer/anim.maanim` | stable runtime alias |

Source-style copied paths proven present but not stable runtime aliases at audit time:

| Topic | ZIP entries | Runtime alias status |
|---|---|---|
| wave invalid / generic invalid | `all-skill-effects/000001/org/battle/s0/skill_effect_invalid.maanim`, `all-skill-effects/000001/org/battle/s0/skill_effect_invalid.mamodel`, `all-skill-effects/000001/org/battle/s0/skill_effectdef.maanim`, `all-skill-effects/000001/org/battle/s0/skill_effectdef.mamodel`, `all-skill-effects/000001/org/battle/s0/skill000.imgcut`, `all-skill-effects/000001/org/battle/s0/skill000.png` | copied source-style paths only |
| barrier / barrier breaker / warp | `all-skill-effects/000001/org/battle/s2/skill_barrier_breaker.maanim`, `all-skill-effects/000001/org/battle/s2/skill_barrier_destruction.maanim`, `all-skill-effects/000001/org/battle/s2/skill_barrier_during.maanim`, `all-skill-effects/000001/org/battle/s2/skill_barrier_e_breaker.maanim`, `all-skill-effects/000001/org/battle/s2/skill_barrier_e_destruction.maanim`, `all-skill-effects/000001/org/battle/s2/skill_barrier_e.maanim`, `all-skill-effects/000001/org/battle/s2/skill_barrier_e.mamodel`, `all-skill-effects/000001/org/battle/s2/skill_barrier_end.maanim`, `all-skill-effects/000001/org/battle/s2/skill_barrier_start.maanim`, `all-skill-effects/000001/org/battle/s2/skill_barrier.mamodel`, `all-skill-effects/000001/org/battle/s2/skill_warp_chara_entrance.maanim`, `all-skill-effects/000001/org/battle/s2/skill_warp_chara_exit.maanim`, `all-skill-effects/000001/org/battle/s2/skill_warp_chara.mamodel`, `all-skill-effects/000001/org/battle/s2/skill_warp_entrance.maanim`, `all-skill-effects/000001/org/battle/s2/skill_warp_exit.maanim`, `all-skill-effects/000001/org/battle/s2/skill_warp.mamodel`, `all-skill-effects/000001/org/battle/s2/skill002.imgcut`, `all-skill-effects/000001/org/battle/s2/skill002.png` | copied source-style paths only |
| enemy barrier side variant | `all-skill-effects/100104/org/battle/s2/skill_barrier_e_breaker.maanim`, `all-skill-effects/100104/org/battle/s2/skill_barrier_e_destruction.maanim`, `all-skill-effects/100104/org/battle/s2/skill_barrier_e.maanim`, `all-skill-effects/100104/org/battle/s2/skill_barrier_e.mamodel` | copied source-style paths only |
| demon shield / shield breaker | `all-skill-effects/100800/org/battle/s14/skill_demonshield_breaker.maanim`, `all-skill-effects/100800/org/battle/s14/skill_demonshield_destruction.maanim`, `all-skill-effects/100800/org/battle/s14/skill_demonshield_revive.maanim`, `all-skill-effects/100800/org/battle/s14/skill_demonshield.mamodel`, `all-skill-effects/100800/org/battle/s14/skill_demonshield00.maanim`, `all-skill-effects/100800/org/battle/s14/skill_demonshield01.maanim`, `all-skill-effects/100800/org/battle/s14/skill014.imgcut`, `all-skill-effects/100800/org/battle/s14/skill014.png` | copied source-style paths only |
| counter surge / summon | `all-skill-effects/130000/org/battle/s18/skill_demonsummon.maanim`, `all-skill-effects/130000/org/battle/s18/skill_demonsummon.mamodel`, `all-skill-effects/130000/org/battle/s18/skill018.imgcut`, `all-skill-effects/130000/org/battle/s18/skill018.png`; summon-adjacent entries `all-skill-effects/120400/org/battle/s17/skill_demonsummon.maanim`, `all-skill-effects/120400/org/battle/s17/skill_demonsummon.mamodel`, `all-skill-effects/120400/org/battle/s17/skill017.imgcut`, `all-skill-effects/120400/org/battle/s17/skill017.png`, `all-skill-effects/130000/org/battle/s17/skill_demonsummon_e.maanim`, `all-skill-effects/130000/org/battle/s17/skill_demonsummon_e.mamodel` | copied source-style paths only |
| wave guard | `all-skill-effects/130200/org/battle/s19/skill_guard_e_breaker.maanim`, `all-skill-effects/130200/org/battle/s19/skill_guard_e.maanim`, `all-skill-effects/130200/org/battle/s19/skill_guard_e.mamodel`, `all-skill-effects/130200/org/battle/s19/skill019.imgcut`, `all-skill-effects/130200/org/battle/s19/skill019.png` | copied source-style paths only |
| curse source-style copies | `all-skill-effects/000001/org/battle/s3/skill_curse.maanim`, `all-skill-effects/000001/org/battle/s3/skill_curse.mamodel`, `all-skill-effects/000001/org/battle/s3/skill003.imgcut`, `all-skill-effects/000001/org/battle/s3/skill003.png`, `all-skill-effects/000001/org/battle/s11/skill_curse_e.maanim`, `all-skill-effects/000001/org/battle/s11/skill_curse_e.mamodel`, `all-skill-effects/000001/org/battle/s11/skill011.imgcut`, `all-skill-effects/000001/org/battle/s11/skill011.png` | copied source-style paths only; status ZIP has stable aliases |
| poison / toxic source-style copies | `all-skill-effects/000001/org/battle/s3/poison.png`, `all-skill-effects/000001/org/battle/s8/skill_percentage_attack.maanim`, `all-skill-effects/000001/org/battle/s8/skill_percentage_attack.mamodel`, `all-skill-effects/000001/org/battle/s8/skill008.imgcut`, `all-skill-effects/000001/org/battle/s8/skill008.png`, `all-skill-effects/100804/org/battle/s3/poison.png` | copied source-style paths only; status ZIP has stable `A_POISON` alias |
| attack-nullify source-style copy | `all-skill-effects/000001/org/battle/s7/skill_attack_invalid.maanim`, `all-skill-effects/000001/org/battle/s7/skill_attack_invalid.mamodel`, `all-skill-effects/000001/org/battle/s7/skill007.imgcut`, `all-skill-effects/000001/org/battle/s7/skill007.png` | copied source-style paths only; status ZIP has stable `A_IMUATK` alias |

Initial audit note: before this implementation pass, no stable barrier, demon shield, warp, wave invalid, wave stop, wave guard, counter surge, or summon runtime aliases were present in `wave.zip`. Wave, mini-wave, surge, mini-surge, blast, strong attack, and metal killer did have stable runtime aliases.

Post-builder audit additions proven by `unzip -l public/assets/bundles/effect/wave.zip` after running `node scripts/build-bcu-wave-effect-bundle.mjs`:

| Topic | ZIP entries | Runtime alias status |
|---|---|---|
| barrier | `unit-barrier/image.png`, `unit-barrier/imgcut.imgcut`, `unit-barrier/model.mamodel`, `unit-barrier/anim-none.maanim`, `unit-barrier/anim-breaker.maanim`, `unit-barrier/anim-destruction.maanim`; `enemy-barrier/image.png`, `enemy-barrier/imgcut.imgcut`, `enemy-barrier/model.mamodel`, `enemy-barrier/anim-none.maanim`, `enemy-barrier/anim-breaker.maanim`, `enemy-barrier/anim-destruction.maanim` | stable runtime aliases |
| demon shield | `demon-shield/image.png`, `demon-shield/imgcut.imgcut`, `demon-shield/model.mamodel`, `demon-shield/anim-full.maanim`, `demon-shield/anim-half.maanim`, `demon-shield/anim-destruction.maanim`, `demon-shield/anim-breaker.maanim`, `demon-shield/anim-revive.maanim` | stable runtime alias |
| warp | `warp/image.png`, `warp/imgcut.imgcut`, `warp/model.mamodel`, `warp/anim-entrance.maanim`, `warp/anim-exit.maanim`; `warp-chara/image.png`, `warp-chara/imgcut.imgcut`, `warp-chara/model.mamodel`, `warp-chara/anim-entrance.maanim`, `warp-chara/anim-exit.maanim` | stable runtime aliases |
| wave invalid | `unit-wave-invalid/image.png`, `unit-wave-invalid/imgcut.imgcut`, `unit-wave-invalid/model.mamodel`, `unit-wave-invalid/anim.maanim`; `enemy-wave-invalid/image.png`, `enemy-wave-invalid/imgcut.imgcut`, `enemy-wave-invalid/model.mamodel`, `enemy-wave-invalid/anim.maanim` | stable runtime aliases |
| wave stop | `unit-wave-stop/image.png`, `unit-wave-stop/imgcut.imgcut`, `unit-wave-stop/model.mamodel`, `unit-wave-stop/anim.maanim`; `enemy-wave-stop/image.png`, `enemy-wave-stop/imgcut.imgcut`, `enemy-wave-stop/model.mamodel`, `enemy-wave-stop/anim.maanim` | stable runtime aliases |
| wave guard | `enemy-wave-guard/image.png`, `enemy-wave-guard/imgcut.imgcut`, `enemy-wave-guard/model.mamodel`, `enemy-wave-guard/anim-none.maanim`, `enemy-wave-guard/anim-breaker.maanim` | stable runtime alias; base/castle guard hook is not completed in this pass |
| counter surge | `unit-counter-surge/image.png`, `unit-counter-surge/imgcut.imgcut`, `unit-counter-surge/model.mamodel`, `unit-counter-surge/anim.maanim`; `enemy-counter-surge/image.png`, `enemy-counter-surge/imgcut.imgcut`, `enemy-counter-surge/model.mamodel`, `enemy-counter-surge/anim.maanim` | stable runtime aliases |
| delay `A_E_DELAY` | `enemy-delay/image.png`, `enemy-delay/imgcut.imgcut`, `enemy-delay/model.mamodel`, `enemy-delay/anim.maanim`; source copy `all-skill-effects/150300/org/battle/s23/skill023.png`, `all-skill-effects/150300/org/battle/s23/skill023.imgcut`, `all-skill-effects/150300/org/battle/s23/skill_recast_decrease_e.mamodel`, `all-skill-effects/150300/org/battle/s23/skill_recast_decrease_e.maanim` | stable runtime alias for `P_DELAY` proc acceptance effect; verified by `check-effect-bundle-aliases` and `check-effect-coordinate-traces` |

Summon-specific aliases are still not marked `code-complete-candidate`. The source-style summon paths remain present under `all-skill-effects/120400/org/battle/s17/*` and `all-skill-effects/130000/org/battle/s17/*`, but no summon runtime hook was implemented in that pass.

2026-06-04 docs-only guard note: `enemy-wave-guard/*` is a proven stable bundle alias for BCU `A_E_GUARD`, but castle/base guard remains a runtime partial because JS does not yet prove `StageBasis.activeGuard` / `ECastle.guard` equivalent state. Summon remains blocked: source-style summon-adjacent paths are present, but no stable summon-specific runtime alias or JS summon hook is proven.

## `effect/kbeff.zip`

Stable hit/knockback entries proven present:

| Topic | ZIP entries | Runtime alias status |
|---|---|---|
| knockback / hit effect shared assets | `image.png`, `imgcut.imgcut`, `model.mamodel`, `kb.mamodel`, `kb_hb.maanim`, `kb_sw.maanim`, `kb_ass.maanim`, `critical.mamodel`, `critical.maanim`, `boss_welcome.mamodel`, `boss_welcome.maanim` | stable kbeff bundle entries |
| raw copies | `raw/000_a.imgcut`, `raw/000_a.png`, `raw/kb.mamodel`, `raw/kb_hb.maanim`, `raw/kb_sw.maanim`, `raw/kb_ass.maanim`, `raw/critical.mamodel`, `raw/critical.maanim`, `raw/boss_welcome.mamodel`, `raw/boss_welcome.maanim` | copied raw paths inside kbeff bundle |

No status, wave, surge, blast, barrier, demon shield, warp, wave invalid, wave stop, wave guard, counter, summon, poison, curse, seal, metal killer, or attack-nullify entries are present here beyond kbeff/critical/hit assets.

## `effect/soul.zip`

Stable death animation entries proven present after running `node scripts/build-bcu-soul-effect-bundle.mjs`:

| Topic | ZIP entries | Runtime alias status |
|---|---|---|
| normal death souls | `soul-000/image.png`, `soul-000/imgcut.imgcut`, `soul-000/model.mamodel`, `soul-000/anim.maanim`; same structure for `soul-001` through `soul-012` | stable runtime aliases used by `BcuSoulEffectLoader` from `BcuCombatModel.deathAnimation.soulId` |
| demon/death-surge soul | `demon-soul-enemy/image.png`, `demon-soul-enemy/imgcut.imgcut`, `demon-soul-enemy/model.mamodel`, `demon-soul-enemy/anim.maanim`; `demon-soul-unit/image.png`, `demon-soul-unit/imgcut.imgcut`, `demon-soul-unit/model.mamodel`, `demon-soul-unit/anim.maanim` | stable runtime aliases for BCU `DemonSoul`; used by death-surge soul branch |

The runtime uses `effect:soul` through the semantic provider only. Loose `public/assets/bcu/**/org/battle/soul/*` files remain build-time inputs for `scripts/build-bcu-soul-effect-bundle.mjs`.
