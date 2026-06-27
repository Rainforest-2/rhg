# Current BCU ability parity status

Updated: 2026-06-25.

This document records current non-visual BCU ability/proc/effect parity for `Rainforest-2/rhg`. It is intentionally conservative: a parser field, old note, or one fixture does not prove broad runtime parity.

## Status vocabulary

- `code-complete-candidate`: BCU source evidence, JS runtime ownership, and deterministic checks exist. Browser appearance is not yet accepted.
- `human-visual-review-needed`: logic/effect wiring is supported, but exact browser appearance has not been manually accepted.
- `partial`: one or more of source coverage, loader coverage, runtime coverage, real-data fixtures, or checks remain incomplete.
- `negative-evidence`: BCU source disproves the proposed feature owner; do not implement it under that owner.
- `logic-only-unless-future-visual-proof`: behavior is source-backed, but no battle visual owner/alias is proven.
- `unconfirmed`: the relevant source owner or compatibility format has not yet been established.

Manual browser review is tracked in [`bcu-visual-review-checklist.md`](./bcu-visual-review-checklist.md). The required work order is in [`bcu-parity-codex-workplan.md`](./bcu-parity-codex-workplan.md).

## Current runtime coverage

| Area | Status | Current evidence boundary |
|---|---|---|
| freeze / slow / weaken / knockback | `code-complete-candidate` | Proc catalog, actor status runtime, and deterministic checks exist. |
| curse / seal / toxic | `code-complete-candidate` | Runtime and resistance paths exist; retain edge coverage discipline. |
| warp lifecycle | `code-complete-candidate` | Lifecycle, interruption, targetability, exit position, and replacement/death cases are tested. Exact WaprCont appearance remains manual-review work. |
| P_DELAY | `human-visual-review-needed` | Player cooldown and enemy stage-line owners, same-tick aggregation, effect alias, and coordinate traces are covered. |
| wave / mini-wave / surge / mini-surge / blast | `code-complete-candidate` | Projectile runtime and focused damage/effect checks exist. Real enemy 562 now guards enemy-side and player-side `ContVolcano` lifetime as frame duration. Broad visual acceptance is separate. |
| barrier / demon shield / shield breaker | `human-visual-review-needed` | Gate order, phases, offsets, layer, and shield-regeneration timing are covered by deterministic checks. |
| death soul / death-surge / AB_GLASS | `code-complete-candidate` | Parser, death runtime, fallback cleanup/recovery, and deterministic checks exist. Full death-surge is owned by the demon-soul death runtime and triggers at soul frame 21; the old priority-effect immediate path is guarded against. |
| standard zombie corpse / soulstrike / revive | `human-visual-review-needed` | Deterministic coverage includes corpse targetability, soulstrike, zombie killer suppression, revive HP, phase timing, cleanup, and death-surge single spawn. Real extra/custom revive source coverage remains partial. |
| burrow | `code-complete-candidate` | Count/distance parse, down/underground/up lifecycle, collision/targetability, movement clamp, guards, and cleanup are tested. |
| spirit lifecycle | `human-visual-review-needed` | Spawn lifecycle, once-per-frame cooldown countdown, cooldown-ready emphasize cue (`spiritEmphasizeCount`/`spiritEmphasizeStartTime`), one-spirit-per-summoner, attack-only form bundle registration, semantic ZIP loading, factory path, pre-warp summon origin, BCU side-capacity rejection, boss-shockwave immunity (`bcuIsSpirit`), the `unitRespawnTime` one-frame post-conjure production lock, and the `getBcuSpiritProductionState` ready/cooldown state wired into the production-card render model are tested. Only the on-screen pixels — the conjure-card ready flash and spirit/A_IMUATK appearance — remain for browser acceptance. |
| castle/base guard | `human-visual-review-needed` | Active/hold/break state, base-damage hold, and effect phase trace are tested. Browser appearance remains unaccepted. |
| wallet / worker-cat level / unit deploy cost / respawn | `code-complete-candidate` | BCU ownership/formulas, strict upgrade gate, income, Lv8 handling, action `-1`, default unit deploy cost `DataUnit.price * 1.5` (`StageMap.price=1`), C_DISCOUNT, PCoin cost/CD, and `Treasure.getFinRes(respawn, C_RESP)` production cooldown are wired and tested. |
| wallet and cannon UI bitmaps | `human-visual-review-needed` | BCU `img002` assets, sprite font layout, gauge/flash state, and headless checks are present; on-device/browser acceptance is pending. |
| basic cat cannon | `code-complete-candidate` | Dedicated cannon owner, action `-2`, charge/reset, 18F preTime, traveling wave bands, INT_ASS timing, lifetime, and draw math are tested. |
| non-basic cat cannon | `code-complete-candidate` | SLOW/STOP/WATER/GROUND/BARRIER/CURSE and BASE_WALL have dedicated runtime ownership and checks. Each cannon now loads and spawns its own BCU `NyCastle.aux.atks[id]` BASE/ATK eanim (the ATK eanim doubles as the ContExtend EXT sweep for slow/curse) via the per-id `getBcuCatCannonAnimFiles` / `spawnCatCannonNonBasicEffect` path, with the no-image trace kept only as an observable load-fallback (`check-bcu-non-basic-cat-cannon-anim-parity`). Browser acceptance and exact extend/waved sweep/travel timing remain open. |
| special castle boss-spawn coordinate | `code-complete-candidate` | Source formula, core bundle, StageDefinition enrichment, and StageRuntime consumption are tested. |
| enemy castle / stage “special attack” | `negative-evidence` | Plain `ECastle` has no attack owner. Boss bases use `EEnemy`; threshold/kill-count spawn behavior belongs to stage runtime. |

## Reference Markdown one-to-one audit

This audit maps `references/bcu/キャラクターの特殊性能_全文_リンク削除.md` headings to current JS ownership. The user-requested exclusion is the `精霊` subheading under `召喚`; the ordinary `召喚` ability remains in scope. `Implemented` below means runtime/data ownership exists; visual rows still require the browser ledger before any visual-complete claim.

### Effects

| Reference heading | Current JS owner | Audit result |
|---|---|---|
| 攻撃力ダウン | `BcuCombatModel` weaken columns, `ProcResolver`, `BattleActorProcStatusPatch`, `DamageCalculator` | Implemented. |
| 動きを止める | `BcuCombatModel` freeze columns, `ProcResolver`, `BattleActorProcStatusPatch` | Implemented. |
| 動きを遅くする | `BcuCombatModel` slow columns, `ProcResolver`, `BattleActorProcStatusPatch` | Implemented. |
| 攻撃ターゲット限定 | `AB_ONLY`, `BcuTraitCompatibility`, `BattleAttackResolver` / `DamageAbilityResolver` | Implemented, including `Trait.targetForms` fixture coverage. |
| めっぽう強い | `AB_GOOD`, `DamageAbilityResolver`, `BcuTreasureModifier`, combo/orb modifiers | Implemented. |
| 打たれ強い | `AB_RESIST`, `DamageAbilityResolver`, `BcuTreasureModifier`, combo/orb modifiers | Implemented. |
| 超打たれ強い | `AB_RESISTS`, `DamageAbilityResolver` | Implemented. |
| 超ダメージ | `AB_MASSIVE`, `DamageAbilityResolver`, combo/orb modifiers | Implemented. |
| 極ダメージ | `AB_MASSIVES`, `DamageAbilityResolver` | Implemented. |
| ふっとばす | `ProcResolver` knockback proc, `BcuKnockbackRuntimePatch` / `KBRuntime` | Implemented. |
| ワープ | `BcuWarpRuntime`, `BcuWarpLifecycleRuntime`, `BattleActorProcStatusPatch` | Implemented. |
| 呪い | `ProcResolver` curse, status suppression in proc/damage/surge paths | Implemented. |
| 攻撃無効 | `BattleActorAttackNullifyPatch` (`IMUATK` / beast-hunter nullify) | Implemented. |
| 古代の呪い | `ProcResolver` seal, `BattleActorProcStatusPatch`, status icon/effect specs | Implemented for source-proven seal/custom/talent paths. |
| 毒撃 | `BcuCombatModel` toxic columns, `ProcResolver`, `BcuDamageGuardRuntime` | Implemented. |
| 遅延 | `BcuDelayRuntimePatch`, `BcuDelayRuntime`, `BcuButtonDelayRuntime` | Runtime implemented; browser appearance remains `human-visual-review-needed`. |

### Abilities

| Reference heading | Current JS owner | Audit result |
|---|---|---|
| 攻撃力アップ | `BcuCombatModel` strengthen columns, `BattleActorStrengthenLethalPatch`, `DamageCalculator` | Implemented. |
| 生き残る | `BcuCombatModel` lethal columns, `BattleActorStrengthenLethalPatch` | Implemented. |
| 城破壊が得意 | `P_ATKBASE`, `DamageAbilityResolver`, `BattleBase` damage path | Implemented. |
| クリティカル | `BcuCombatModel` critical proc, `DamageAbilityResolver` | Implemented. |
| メタルキラー | `BcuCombatModel` `METALKILL`, `DamageAbilityResolver` | Implemented. |
| ゾンビキラー | `AB_ZKILL`, `BattleActorZombieRevivePatch` | Implemented. |
| 魂攻撃 | `AB_CKILL`, `BattleSoulstrikePatch` | Implemented. |
| バリアブレイカー | `ProcResolver` barrierBreaker, `BattleActorBarrierShieldPatch` | Implemented; visual review pending. |
| シールドブレイカー | `ProcResolver` shieldPierce, `BattleActorBarrierShieldPatch` | Implemented; visual review pending. |
| 渾身の一撃 | `strongAttack` / `SATK`, `DamageAbilityResolver` | Implemented. |
| 撃破時お金アップ | `P_BOUNTY`, `BattleBountyRuntimePatch` | Economy implemented; no dedicated battle visual owner is proven. |
| メタル | `AB_METALIC` / metal trait, `DamageAbilityResolver` | Implemented. |
| 波動 | `BattleWaveRuntimePatch`, `BcuAttackWaveRuntime`, `BattleBaseProjectileProcPatch` | Implemented. |
| 小波動 | `miniWave`, `BattleMiniProcParityPatch`, `BattleWaveRuntimePatch` | Implemented. |
| 烈波 | `BattleSurgeRuntimePatch`, `BcuAttackVolcanoRuntime` | Implemented. |
| 小烈波 | `miniVolcano`, `BattleMiniProcParityPatch`, `BattleSurgeRuntimePatch` | Implemented. |
| 波動ストッパー | `AB_WAVES`, `BcuWaveStopperRuntime` / wave invalid path | Implemented. |
| デス烈波 | `deathSurge`, `BcuDeathAnimationRuntime` | Runtime implemented; demon-soul visual acceptance pending. |
| 烈波カウンター | `AB_CSUR`, `BattleSurgeRuntimePatch` | Implemented. |
| 召喚 | `BcuSummonRuntime`, `BattleSceneBcuSummonPatch`, proc-object loader | Runtime and real proc-object loading implemented; entry appearance pending. |
| 爆波 | `blast`, `BattleBlastRuntimePatch` | Implemented. |
| バリア | `BcuBarrierRuntime`, `BattleActorBarrierShieldPatch` | Implemented; visual review pending. |
| 悪魔シールド | `BcuDemonShieldRuntime`, `BattleActorBarrierShieldPatch` | Implemented; visual review pending. |
| 地中移動 | `BcuBurrowLifecycleRuntime`, `BattleActorBcuBurrowPatch` | Implemented. |
| 蘇生 | `BcuZombieReviveRuntime`, `BattleActorZombieRevivePatch` | Implemented; corpse/revive visual review pending. |
| 遠方攻撃 | `BattleStatsLoader` LD fields, `BattleAttackProfile`, `BattleAttackResolver` | Implemented. |
| 全方位攻撃 | `BattleStatsLoader` LD/omni fields, `BattleAttackResolver` | Implemented. |
| 超生命体特効 | `AB_BAKILL`, `DamageAbilityResolver` | Implemented. |
| 超獣特効 | `P_BSTHUNT`, `DamageAbilityResolver`, `BattleActorAttackNullifyPatch` | Implemented. |
| 超賢者特効 | `AB_SKILL`, `DamageAbilityResolver`, `BcuResistRuntime` | Implemented, including sage status-resistance bypass/reduction. |
| 怪人特効 | `C_VKILL` combo increment -> `AB_VKILL`, `DamageAbilityResolver` | Implemented in this batch. |
| 各種妨害無効 | `BcuProcImmunityPatch`, `BcuResistRuntime`, parsed `IMU*` fields | Implemented for source-proven holders. |
| 波動無効 | `IMUWAVE`, `BcuDamageGuardRuntime` | Implemented. |
| 烈波無効 | `IMUVOLC`, `BcuDamageGuardRuntime` | Implemented. |
| 爆波無効 | `IMUBLAST`, `BcuDamageGuardRuntime` | Implemented. |
| 毒撃無効 | `IMUPOIATK`, `BcuDamageGuardRuntime` | Implemented for unit holder; enemy toxic-immunity CSV holder remains negative evidence. |
| 1回攻撃 | `AB_GLASS`, `BattleActorGlassPatch`, `BcuDeathAnimationRuntime` | Implemented. |
| 連続攻撃 | `BcuStatsSchema`, `BattleStatsLoader`, `BattleAttackProfile` per-hit `abi` | Implemented. |
| 魔女キラー | `AB_WKILL`, `C_WKILL`, `DamageAbilityResolver` | Implemented; BCU multiplier depends on active combo increment. |
| 使徒キラー | `AB_EKILL`, `C_EKILL`, `DamageAbilityResolver` | Implemented; BCU multiplier depends on active combo increment. |

### Other

| Reference heading | Current JS owner | Audit result |
|---|---|---|
| 衝撃波無効 | `AB_IMUSW`, `BattleBossShockwaveRuntimePatch` | Implemented in this batch; `INT_SW` boss shockwave skips immune actors. |
| わんこ城バリア | `BcuCastleGuardRuntime`, `BattleSceneBcuCastleGuardPatch` | Runtime implemented; browser appearance pending. |

## Loader-backed code-complete areas (non-visual)

These rows graduated from `partial` once a real BCU-format data source was loaded from a fixture file and threaded through the existing runtime by a deterministic check. The only remaining work is the manual browser appearance, tracked separately.

| Area | Status | Current evidence boundary |
|---|---|---|
| SUMMON | `code-complete-candidate` | Explicit proc-object runtime, delay, triggers, inheritance, limits, same_health, bond_hp, and `SCDef` allow/group behavior exist. A real BCU `CustomEntity.atks[].proc.SUMMON` file is now loaded from disk and driven end to end (loader → `BattleAttackProfile` → immediate/on_hit spawn) by `check-bcu-summon-procobject-loader-parity`. No normal CSV holder is added (BCU stores SUMMON only on proc objects). Summon-entry appearance is the only open item (see visual review). |
| `Trait.targetForms` / special traits | `code-complete-candidate` | A real BCU `Trait` file (name/id/targetType/targetForms) loads and drives the single `bcuTraitCompatible` gate across the proc (`ProcResolver`) and Target-Only cross-paths in `check-bcu-trait-targetforms-loader-parity`. The damage resolver still reports its own narrow capture-edge caveat as omitted runtime state. |
| combo / orb / treasure / talent / PCoin | `code-complete-candidate` | Real 150300 combo (`NyancomboData`/`NyancomboParam`) and talent/PCoin (`SkillAcquisition`) data plus treasure/orb constants compose multiplicatively in BCU's level→combo→treasure→talent order with BCU truncation, and equipped orbs fold through `DamageAbilityResolver`, swept in `check-bcu-modifier-realdata-sweep-parity`. PCoin `PC2_COST`/`PC2_CD` now mutate `DataUnit.price`/`DataUnit.respawn` equivalents before production values, and production cards use `ELineUp`-style C_DISCOUNT plus `Treasure.getFinRes(respawn, C_RESP)` (`check-bcu-talent-info-loader`, `check-battle-scene-stage-runtime-wiring`). Treasure (お宝) is maxed by design: unit `getAtkMulti`/`getDefMulti` default to ×2.5 (T_ATK/T_DEF=300), production research uses LV_RES=30/T_RES=300, and GOOD/MASSIVE/RESIST use `DEFAULT_MAX_FRUIT=3`. The `Entity.getFruit` disruption-time/distance treasure bonus (player-unit→enemy, `time*(1+f*0.2/3)` cannon-excluded, `dist*(1+f*0.1)`) is now applied identically on both proc-apply routes through the shared `resolveBcuProcRuntimePayload` (`resolveBcuProcFruit` + `check-bcu-treasure-proc-fruit-parity`). In-battle visual acceptance remains a separate review item. |
| extra/custom zombie revive | `code-complete-candidate` | A real BCU `REVIVE` proc-object file (`revive_others` + dis window + `imu_zkill`/`revive_non_zombie`) drives the BCU `ZombX.updateRevive` source/range/zombie/warp filter (`check-bcu-zombie-extra-revive-source-range-parity`). CSV/explicit sources without `dis` keep BCU's unbounded behavior. Corpse DOWN/REVIVE appearance remains visual review. |
| AB_SKILL / status resistance extensions | `code-complete-candidate` for proven sources | Sage, resist orb, and combo immunity sources are covered; speculative talent/custom resistance loaders are not. Add only source-proven PCoin/custom holders. |
| repository-local persistence | `code-complete-candidate` | `FormationStore`/`StageRegistry` round-trip their own state and now surface read/write failures (quota/security) through `BcuStorageDiagnostics` instead of a silent catch (`check-formation-storage-failure-visibility`). This is a repository-local self-persistence claim only — **not** a BCU save/lineup compatibility claim. |

## Remaining non-complete areas

| Area | Status | Current boundary | Safe next step |
|---|---|---|---|
| summon entry appearance | `human-visual-review-needed` | Loader is proven; `Entity.setSummon(anim_type)` appearance, placement, and layer are not manually accepted. | Review in browser using a loader-backed summon fixture. |
| death-surge demon-soul appearance | `human-visual-review-needed` | Full death-surge timing, single-spawn ownership, and loader-recovery are deterministic-test covered; exact browser demon-soul appearance has not been manually accepted. | Review a full `DEATHSURGE` fixture in browser and compare demon soul + WT_VOLC start frame. |
| mini-death-surge | `human-visual-review-needed` | Proven ORB_DEATH_SURGE holder and mutually-exclusive full/mini roll runtime are tested. | Review mini demon-soul and WT_MIVC browser appearance. |
| bounty/money visual | `logic-only-unless-future-visual-proof` | Economy behavior is source-backed; BCU shows no dedicated battle visual owner or stable effect alias (negative evidence on the visual side). | Keep it logic/economy only; there is nothing to visually accept unless new BCU source proves an owner. |
| BCU save / lineup import-export compatibility | `out-of-scope` | rhg ships no BCU save import/export feature and no BCU serialization owner exists in this checkout. This is not an ability-parity defect. | Only if an import/export feature is ever added: identify the BCU serialization owner and add round-trip fixtures first. |

## Audit consistency rules

The 2026-06-23 audit found that several old Stage/Spawn findings were already fixed in current code. Do not copy historical claims into this table without a current code comparison.

In particular, current status must distinguish:

1. **runtime exists and a real data source is now loader-proven** — SUMMON proc-object, special `Trait.targetForms`, combo/orb/treasure/talent/PCoin, and extra/custom revive each load real BCU-format data from a fixture file through the existing runtime;
2. **runtime and checks exist but appearance is unaccepted** — P_DELAY, shield families, spirit, guard, zombie corpse/revive visuals, summon entry, and cannon visuals;
3. **source owner is disproven** — a generic castle-owned attack runtime;
4. **compatibility scope is out of scope** — BCU save/lineup import/export (no in-product feature; repository-local persistence is self-round-trip only).

## Required checks before status upgrades

```bash
node scripts/check-bcu-parser-indexes.mjs
node scripts/check-projectile-damage-parity.mjs
node scripts/check-proc-immunity-resistance-parity.mjs
node scripts/check-bcu-delay-runtime.mjs
node scripts/check-bcu-burrow-lifecycle-parity.mjs
node scripts/check-bcu-death-animation-parity.mjs
node scripts/check-bcu-warp-lifecycle-parity.mjs
node scripts/check-bcu-warp-interrupt-scene-parity.mjs
node scripts/check-bcu-zombie-corpse-soulstrike-parity.mjs
node scripts/check-bcu-barrier-shield-effect-parity.mjs
node scripts/check-bcu-summon-runtime-parity.mjs
node scripts/check-bcu-summon-procobject-loader-parity.mjs
node scripts/check-bcu-trait-targetforms-loader-parity.mjs
node scripts/check-bcu-modifier-realdata-sweep-parity.mjs
node scripts/check-bcu-zombie-extra-revive-source-range-parity.mjs
node scripts/check-formation-storage-failure-visibility.mjs
node scripts/check-bcu-spirit-bundle-manifest-parity.mjs
node scripts/check-bcu-castle-guard-parity.mjs
node scripts/check-bcu-wallet-runtime-parity.mjs
node scripts/check-bcu-non-basic-cat-cannon-runtime-parity.mjs
node scripts/check-ability-partial-blockers.mjs
```

A deterministic check only supports the exact claim it asserts. No row becomes `fully-complete` until the required manual visual review is recorded.
