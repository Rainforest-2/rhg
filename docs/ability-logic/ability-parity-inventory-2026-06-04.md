# Ability parity inventory 2026-06-04

This inventory was produced while fixing demon shield regeneration timing. It is conservative: `code-complete` requires local BCU source proof, JS parser/runtime evidence, deterministic tests, and ZIP/effect trace evidence where visuals apply. Rows without manual browser inspection but with deterministic visual/effect traces are `human-visual-review-needed`.

## BCU demon shield regeneration specification

- 発火場所: `BCU_java_util_common/.../battle/entity/Entity.java`, `KBManager.updateKB()`.
- 発火条件: `kbType == INT_HB`, `e.health > 0`, and `e.getProc().DEMONSHIELD.hp > 0`.
- 発火tick: `updateKB()` decrements `kbTime`; when `kbTime == 0`, after `anim.setAnim(UType.WALK, true)` and before `preKill()`.
- shield HP復元式: `currentShield = (int)(DEMONSHIELD.hp * DEMONSHIELD.regen * shieldMagnification / 100.0)`.
- 端数処理: Java cast to `int`, equivalent to truncation toward zero for these non-negative values.
- revive animation: same branch calls `anim.getEff(SHIELD_REGEN)`, which maps to `ShieldEff.REGENERATION`.
- draw位置: `AnimManager.drawEff()` draws barrier/shield priority effects at `p.y - 25 * siz`.
- draw scale: `siz * 0.75f`; JS records `bcuScaleMode: ACTOR_PRIORITY_EFFECT`, `scale: 0.75`.
- layer: effect uses the entity current layer (`currentLayer` in BCU, `actor.currentLayer` in JS traces).
- 例外条件: no regen for non-`INT_HB` KB, death/final KB where `health <= 0`, no demon shield holder HP, or actor already dead/removed.
- 参照したBCUファイル/クラス/メソッド: `Entity.damaged`, `Entity.KBManager.updateKB`, `Entity.AnimManager.getEff`, `Entity.AnimManager.drawEff`, `EffAnim.ShieldEff`.

## Ability inventory

| Ability | 状態 | BCU参照 | JS実装箇所 | ロジック一致度 | エフェクト/座標一致度 | 既存テスト | 不足 | 安全に直せるか | 今回修正 |
|---|---|---|---|---|---|---|---|---|---|
| strong / めっぽう強い | `partial` | `AB_GOOD`, `EUnit/EEnemy.getDamage` | `DamageAbilityResolver` | Core multiplier path exists | no separate visual | damage resolver checks | combo/orb/treasure external sources | no | no |
| massive damage / 超ダメージ | `partial` | `AB_MASSIVE` damage family | `DamageAbilityResolver` | Core multiplier path exists | no separate visual | damage resolver checks | external modifiers and targetForms | no | no |
| resistant / 打たれ強い | `partial` | `AB_RESIST` incoming family | `DamageAbilityResolver` | Core multiplier path exists | no separate visual | damage resolver checks | external modifiers and targetForms | no | no |
| insane damage / 極ダメージ | `partial` | `AB_MASSIVES` / related constants | `DamageAbilityResolver` | Core multiplier path exists | no separate visual | damage resolver checks | external modifiers | no | no |
| insane resistant / 超打たれ強い | `partial` | resist family constants | `DamageAbilityResolver` | Core multiplier path exists | no separate visual | damage resolver checks | external modifiers | no | no |
| critical | `human-visual-review-needed` | `P_CRIT`, `Entity.damaged` `A_CRIT` | `ProcResolver`, `BattleCriticalEffectPatch` | proc/damage path present | effect alias traced, manual review missing | safe suite/effect checks | manual visual review | no | no |
| metal | `partial` | `AB_METALIC`, metal trait | `DamageCalculator`/traits | core path exists | no separate visual | resolver checks | exact metal damage edge cases | no | no |
| metal killer | `human-visual-review-needed` | `P_METALKILL`, `Entity.damaged` | `ProcResolver`, `BattleProcHitEffectPatch` | accepted proc path present | effect alias traced, manual review missing | safe suite | manual visual review | no | no |
| savage blow / strongAttack | `human-visual-review-needed` | `P_SATK`, `A_SATK` | `ProcResolver`, `BattleProcHitEffectPatch` | proc multiplier path present | effect alias traced, manual review missing | safe suite | manual visual review | no | no |
| base destroyer | `partial` | `P_ATKBASE` | `DamageAbilityResolver` | core damage path exists | no separate visual | resolver checks | castle/base guard ordering | no | no |
| attack only / target only | `partial` | `AB_ONLY`, trait filters | `BattleSoulstrikePatch`, capture/runtime filters | several paths implemented | no separate visual | soulstrike checks | special targetForms incomplete | no | no |
| multi-hit | `partial` | `AtkModelEntity` hit arrays | `BattleAttackTimeline` | timeline exists | hit smoke path exists | attack interval timing check | broad BCU attack model audit | no | no |
| area/single | `partial` | `AttackSimple.capture` | `BattleAttackResolver` | core capture exists | no separate visual | capture/projectile checks | exact special target forms | no | no |
| long distance / omnistrike | `partial` | attack range fields | `BattleAttackProfile`/resolver | core ranges exist | no separate visual | parser/projectile checks | full target capture edge cases | no | no |
| wave | `human-visual-review-needed` | `AttackWave`, `ContWaveDef` | `BattleWaveRuntimePatch` | raw projectile basis tested | bundle alias and coordinate traces pass | `check-projectile-damage-parity`, `check-effect-coordinate-traces` | manual visual review | no | no |
| mini wave | `human-visual-review-needed` | `MINIWAVE.mult` | `BattleWaveRuntimePatch` | 20% raw basis tested | alias/trace pass | same as wave | manual visual review | no | no |
| wave stopper | `partial` | `AB_WAVES`, `ContWaveDef` stopper | wave runtime/immunity patches | stopper path exists | alias/trace exists | coordinate trace | full coverage incomplete | no | no |
| wave immune / resist | `partial` | `P_IMUWAVE`, `Entity.damaged` | `BcuProcImmunityPatch`, `BcuDamageGuardRuntime` | supported full/partial pieces exist | invalid effect trace exists | proc immunity/effect traces | parser/external fields incomplete | no | no |
| surge / mini surge | `human-visual-review-needed` | `AttackVolcano`, `ContVolcano` | `BattleSurgeRuntimePatch` | raw projectile basis tested | alias/trace pass | projectile/effect checks | manual visual review | no | no |
| surge immune / resist | `partial` | `P_IMUVOLC` | immunity patches | supported pieces exist | invalid effect trace exists | proc immunity checks | parser/source coverage | no | no |
| counter surge | `partial` | `AB_CSUR`, `SurgeSummoner` | `BattleBcuPriorityEffectRuntimePatch` | 50-frame queue exists | alias exists | safe suite coverage indirect | full damage/capture audit | no | no |
| death surge | `partial` | death soul frame 21 trigger | `BcuDeathAnimationRuntime` | trigger tested | demon soul/surge aliases exist | death animation check | full damage/capture and zombie interactions | no | no |
| blast | `human-visual-review-needed` | `AttackBlast`, `ContBlast` | `BattleBlastRuntimePatch` | bands/capture tested | alias/trace pass | projectile/effect checks | manual visual review | no | no |
| blast immune / resist | `partial` | `P_IMUBLAST` | immunity/damage guard | supported pieces exist | invalid effect trace exists | proc immunity checks | exact holder/source coverage | no | no |
| toxic | `partial` | `P_POIATK` | `ProcResolver`, toxic damage guard | direct HP mutation avoided | poison effect path exists | proc immunity checks | exact effect/ordering audit | no | no |
| toxic immune / resist | `partial` | `IMUPOIATK` | `BcuProcImmunityPatch` | unit field supported; enemy field not proven | invalid effect path exists | proc immunity checks | enemy holder proof missing | no | no |
| freeze / P_STOP | `partial` | `P_STOP`, status overwrite | `ProcResolver`, status patches | core runtime exists | status effect alias exists | safe suite | full resistance/external source coverage | no | no |
| slow | `partial` | `P_SLOW` | status patches | core runtime exists | alias exists | safe suite | full resistance/external source coverage | no | no |
| weaken | `partial` | `P_WEAK` | status patches, `DamageCalculator` | core runtime exists | alias exists | safe suite | weak-up positive branch visual audit | no | no |
| curse | `partial` | `P_CURSE`, sealed proc list | `ProcResolver`, seal suppression patches | broad suppression exists | alias exists | safe suite | exact seal/curse split remains partial | no | no |
| knockback proc | `partial` | `P_KB`, `KB_PRI` | `BcuKnockbackRuntimePatch`, priority patch | priority path exists | KBEFF partial | KB checks | all proc/source interactions | no | no |
| warp | `human-visual-review-needed` | `P_WARP`, `WaprCont` | `BcuWarpLifecycleRuntime` | lifecycle tested | entrance/exit trace pass | `check-bcu-warp-lifecycle-parity` | manual visual review | no | no |
| attack down | `partial` | same as `P_WEAK` | same as weaken | core runtime exists | alias exists | safe suite | see weaken | no | no |
| attack nullify | `human-visual-review-needed` | `P_IMUATK`, `A_IMUATK` | `BattleActorAttackNullifyPatch` | pre-gate implemented | status effect alias traced | safe suite | manual visual review | no | no |
| barrier breaker | `human-visual-review-needed` | `P_BREAK`, `BREAK_ABI` | `BattleActorBarrierShieldPatch` | gate order tested | breaker phase scale/layer tested | `check-bcu-barrier-shield-effect-parity` | manual visual review | no | tested only |
| shield pierce | `human-visual-review-needed` | `P_SHIELDBREAK`, `SHIELD_BREAKER` | `BattleActorBarrierShieldPatch` | gate order tested | breaker phase scale/layer tested | barrier/shield parity check | manual visual review | yes | visual/timing tests |
| soulstrike | `partial` | `AB_CKILL` | `BattleSoulstrikePatch` | corpse target path exists | no separate visual | soulstrike checks | zombie corpse full parity | no | no |
| zombie killer | `partial` | `AB_ZKILL` | `BattleActorZombieRevivePatch` | revive suppression exists | no separate visual | revive checks | full corpse lifecycle | no | no |
| zombie revive | `partial` | `P_REVIVE` | `BattleActorZombieRevivePatch` | core schedule exists | no exact visual proven | death/warp docs | corpse/soulstrike/death surge interactions | no | no |
| burrow | `partial` | `P_BURROW` | parser only | not implemented | not implemented | parser checks | lifecycle/collision proof | no | no |
| glass | `human-visual-review-needed` | `AB_GLASS` | `BattleActorGlassPatch` | skip-soul behavior tested | no normal soul | death checks | manual visual review | no | no |
| bounty | `partial` | `P_BOUNTY`, `EEnemy.kill` | `BattleBountyRuntimePatch` | award path exists | money visual not proven | safe suite | bounty visual/money effect | no | no |
| strengthen | `partial` | `P_STRONG` threshold | `BattleActorStrengthenLethalPatch` | core threshold exists | status effect exists | safe suite | external edge cases | no | no |
| survive | `partial` | `P_LETHAL` | `BattleActorStrengthenLethalPatch` | HP=1 path exists | shield status effect exists | safe suite | ordering with revive/death surge | no | no |
| dodge / evasive | `partial` | `P_IMUATK` / dodge proc holders | attack nullify runtime | core nullify exists | status effect exists | safe suite | orb/treasure/source proof | no | no |
| target trait / target only | `partial` | trait compatibility functions | compatibility/resolver modules | many paths exist | no separate visual | parser/resolver checks | special targetForms | no | no |
| immune/resist family | `partial` | `getResistValue`, IMU fields | `BcuResistRuntime`, `BcuProcImmunityPatch` | supported branch centralized | invalid visual partial | `check-proc-immunity-resistance-parity` | broad talent/orb/external sources | no | no |

## Effect and icon inventory

| Effect/icon | 状態 | BCU参照 | JS実装箇所 | Trace/test | 不足 | 今回修正 |
|---|---|---|---|---|---|---|
| critical effect | `human-visual-review-needed` | `A_CRIT`, `EAnimCont(..., -75f)` | `BattleCriticalEffectPatch` | safe suite/effect alias | manual visual review | no |
| strong attack effect | `human-visual-review-needed` | `A_SATK` | `BattleProcHitEffectPatch` | alias checks | manual visual review | no |
| metal killer effect | `human-visual-review-needed` | `A_METAL_KILLER/A_E_METAL_KILLER` | `BattleProcHitEffectPatch` | alias checks | manual visual review | no |
| barrier effect | `human-visual-review-needed` | `A_B/A_E_B`, `drawEff` y -25, scale .75 | `BcuBarrierShieldEffectRuntime` | barrier/shield parity check | manual visual review | scale/layer/y/flip tests |
| demon shield effect | `human-visual-review-needed` | `A_DEMON_SHIELD/A_E_DEMON_SHIELD`, `ShieldEff` phases | `BcuBarrierShieldEffectRuntime`, priority patch | barrier/shield parity and regen timing checks | manual visual review | delayed revive timing and scale tests |
| wave invalid icon | `partial` | `A_EFF_INV`/`P_WAVE` invalid | wave invalid runtime | coordinate trace | full holder coverage | no |
| wave stop icon | `partial` | `A_WAVE_STOP` | stopper runtime | coordinate trace | full stopper coverage | no |
| warp entrance/exit | `human-visual-review-needed` | `WaprCont`, `A_W`, `A_W_C` | warp lifecycle/effect runtime | warp lifecycle and coordinate trace | manual visual review | no |
| warp character/hole offset | `human-visual-review-needed` | `BattleBox` WaprCont offsets | priority effect runtime | coordinate trace | manual visual review | no |
| delay icon | `human-visual-review-needed` | `A_E_DELAY` | `BcuDelayRuntimePatch` | delay/effect checks | manual visual review | no |
| status icons | `partial` | `AnimManager.drawEff` | status icon/effect runtime | coordinate trace subset | full icon inventory and overwrite rules | no |
| death soul | `human-visual-review-needed` | `Soul`, `DemonSoul` | death animation runtime | death animation checks | manual visual review | no |
| death surge soul | `partial` | demon soul frame 21 | death animation runtime | death surge trigger check | full damage/capture audit | no |
| knockback smoke | `partial` | `A_KB` / KBEff | KBEFF patches | KB checks | visual parity incomplete | no |
| attack hit smoke | `human-visual-review-needed` | attack smoke | `BattleSceneAttackEffectPatch` | coordinate trace | manual visual review | no |
| proc hit effect | `human-visual-review-needed` | proc effect EAnimCont offsets | `BattleProcHitEffectPatch` | alias checks | manual visual review | no |
| bounty/money effect | `partial` | `P_BOUNTY` kill money | `BattleBountyRuntimePatch` | bounty runtime check | visual money effect not proven | no |
| zombie revive effect | `partial` | `ZombieEff.REVIVE`/corpse | `BattleActorZombieRevivePatch` | death checks | exact revive visual and corpse timing | no |

## Safe fixes applied in this pass

- Demon shield regen no longer restores HP in `resolvePostDamage`; it queues pending regen and consumes it when `stepKnockbackFrame()` reaches the BCU `kbTime == 0` equivalent.
- `SHIELD_REGEN` / `revive` visual now follows that delayed event and records scale, layer, lifetime, y offset, phase, and BCU reference in deterministic debug.
- Barrier/shield effect tests now assert `scale === 0.75` and `scale !== 0` for default actor-priority effects, covering the previous `BcuWaveBundleEffectSpawner.js` scale regression.
- `check-bcu-stage-line-row-parity.mjs` expectation was corrected to BCU `StageBasis.getDelayStrength`: type-0 delay adds `(max - current) * percent / 100`, so a row with remaining 60 and max 100 receives +20, not +30.

## Remaining partial risks

- No broad damage pipeline rewrite was attempted; projectile, immunity, and external modifier rows remain limited to existing proven tests.
- Burrow, summon, spirit, base/castle guard, zombie corpse/soulstrike/death-surge interactions, and combo/orb/treasure modifiers remain `partial` because local BCU holder fields, runtime owners, or deterministic tests are incomplete.
- Rows marked `human-visual-review-needed` have deterministic code/effect/coordinate evidence but no human browser visual review record, so they are not `fully-complete`.
