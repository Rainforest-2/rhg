# Fact-only ability parity matrix

## 目的

BCU common/Android 参照、現行 JS、ローカル asset、ZIP bundle、builder、loader を照合し、推測なしで次回実装できる能力を最大限 `ready-for-implementation` に分類する。

## 今回のスコープ

- 実装は行わない。解析と `docs/ability-logic/fact-only-ability-parity-matrix.md` の作成のみ。
- `references/bcu/BCU_java_util_common.zip` と `references/bcu/BCU_Android-master.zip` を `/tmp/bcu-ref/common` と `/tmp/bcu-ref/android` に展開して調査した。
- PC 用コードは補助参照に留め、戦闘ロジックは common を主、表示テキストは Android raw JSON を補助として扱った。
- ブラウザ起動は要求しない。検証は terminal で可能な静的検査と ZIP 内容確認に限定する。

## 非ゴール

- 今回は `js/`、`scripts/`、`public/assets/bundles/`、generated manifest/index を変更しない。
- 未確認の CSV index、proc field、倍率、持続、演出名、bundle key、loader 挙動は補完しない。
- partial resistance、combo/orb/treasure の未配線補正、PC 専用 UI 表現は実装判断の根拠にしない。

## 調査した BCU 参照

- common: `/tmp/bcu-ref/common/BCU_java_util_common-ef840238e4700eb4b8eb57b4446633e465f4edd5`
- Android: `/tmp/bcu-ref/android/BCU_Android-master`
- `util/Data.java`: `AB_*`, `P_*`, `TRAIT_*`, `Proc.BSTHUNT`, `PC_CORRES`, `A_*` 定数。
- `battle/data/DataUnit.java`: unit indexes 10, 16-23, 24-43, 46-53, 56, 58-65, 70, 75, 77-84, 86-97, 98-116。特に `ints[105] == 1`, `ints[106]`, `ints[107]`。
- `battle/data/DataEnemy.java`: enemy indexes 10, 13-20, 21-31, 32-49, 52, 64-68, 70-79, 81-89, 93-94, 101-112。
- `battle/entity/Entity.java`: `AnimManager.getEff`, `checkEff`, `damaged`, `processProcs`, `postUpdate`, `updateProc`, `getAbi`, `getProc`。
- `battle/entity/EUnit.java`: `damaged`, `getDamage`, `getResistValue`。`P_BSTHUNT` の被ダメ x0.6 と攻撃無効 branch を確認。
- `battle/entity/EEnemy.java`: `getDamage`, `getResistValue`, `kill`, `postUpdate`。`P_BSTHUNT` の与ダメ x2.5 と `P_BOUNTY` reset を確認。
- `battle/attack/AttackSimple.java`: target capture、damage/proc、wave/surge/blast spawn。
- `battle/attack/AttackWave.java`, `ContWaveDef.java`: wave/mini-wave capture、damage、effect timing。
- `battle/attack/AttackVolcano.java`, `ContVolcano.java`: surge/mini-surge capture、lifetime、damage timing。
- `battle/attack/AttackBlast.java`, `ContBlast.java`: blast zone、10/20/30 frame damage ticks、44 frame lifetime、`A_BLAST`/`A_E_BLAST`。
- `util/pack/EffAnim.java`: `A_IMUATK` -> `./org/battle/s7/skill_attack_invalid`, `A_POISON`, `A_VOLC`, `A_COUNTERSURGE`, `A_BLAST`, `A_E_BLAST`, barrier/demon shield/wave invalid mappings。
- Android `app/src/main/res/raw/proc_jp.json` と common `util/lang/assets/proc_jp.json`: 超獣特効の x2.5 / x0.6 / 確率時間つき攻撃無効の表示文。

## 調査した Markdown

- `references/bcu/キャラクターの特殊性能_全文_リンク削除.md`
- 関連 anchor: `attack_down`, `warp`, `noroi`, `no_damage`, `colossus_killer`, `beast_killer`, `sage_killer`, `villain_killer`, `cc_immune`, `surge_immune`, `explosive_wave_immune`, `poison_immune`, `once_attack`, `Witch_killer`, `Angel_killer`, `castle_barrier`。
- `beast_killer` は超獣への与ダメ 2.5、被ダメ 0.6、超獣から攻撃を受けた際の確率/時間つき攻撃無効を確認。
- `no_damage` は黄色の盾エフェクトと、発動後の対象属性攻撃/妨害/波動/烈波/毒撃無効を確認。
- `cc_immune` は妨害無効時の青い丸いエフェクトを確認。
- `once_attack` は 1 回攻撃に能力アイコンがなく、昇天エフェクトなしで消滅することを確認。

## 調査した現行 JS / scripts

- Core: `js/main.js`, `js/battle/BcuCombatModel.js`, `js/battle/AbilityModel.js`, `js/battle/BattleAttackProfile.js`, `js/battle/BattleAttackResolver.js`, `js/battle/DamageCalculator.js`, `js/battle/DamageAbilityResolver.js`, `js/battle/ProcResolver.js`, `js/battle/BattleScene.js`, `js/battle/BattleActor.js`, `js/battle/BattleBase.js`。
- Runtime patches: `BattleSceneProcApplyPatch.js`, `BattleSceneBcuProcRuntimePatch.js`, `BattleActorProcStatusPatch.js`, `BattleBcuDeathAnimationRuntimePatch.js`, `BcuWarpLifecycleRuntime.js`, `BcuDeathAnimationRuntime.js`, `BattleSceneBcuStatusIconPatch.js`, `BattleSceneBcuStatusEffectRenderPatch.js`, `BattleActorBarrierShieldPatch.js`, `BattleActorZombieRevivePatch.js`, `BattleSoulstrikePatch.js`, `BattleWaveRuntimePatch.js`, `BattleSurgeRuntimePatch.js`, `BattleBaseProjectileProcPatch.js`, `BattleProjectileRuntimeBugfixPatch.js`, `BcuKnockbackRuntimePatch.js`, `BcuKnockbackProcPriorityPatch.js`, `BattleActorStrengthenLethalPatch.js`, `BcuProcImmunityPatch.js`, `BattleProjectileEffectBcuParityPatch.js`, `BattleProjectilePerformanceAndPositionPatch.js`。
- Runtime helpers: `js/battle/bcu-runtime/BcuProcRuntime.js`, `BcuResistRuntime.js`, `BcuStatusSnapshot.js`, `BcuStatusIconResolver.js`, `BcuStatusEffectSpec.js`, `BcuStatusEffectManager.js`, `BcuStatusEffectPositioner.js`。
- Effect/bundle loaders and builders: `BattleWaveEffectLoader.js`, `EffectRuntime.js`, `BcuKbeffLoader.js`, `scripts/build-bcu-status-effect-bundle.mjs`, `scripts/build-bcu-wave-effect-bundle.mjs`, `scripts/build-bcu-effect-bundle.mjs`, `scripts/bcu-semantic-utils.mjs`。

## `js/main.js` import order

1. `FormationEditorPerformancePatch.js`
2. `FormationCatalogVirtualDomPatch.js`
3. `NyankoPresentationPatch.js`
4. `NyankoUiBehaviorPatch.js`
5. `BcuTraceRuntime.js`
6. `BattleBcuStrictConfigPatch.js`
7. `StageDefinitionNegativeSpawnPatch.js`
8. `BattleActorBcuKbTargetPatch.js`
9. `BattleActorProcStatusPatch.js`
10. `BattleActorBarrierShieldPatch.js`
11. `BattleSoulstrikePatch.js`
12. `BattleDeterministicRandomPatch.js`
13. `BattleWaveRuntimePatch.js`
14. `BattleSurgeRuntimePatch.js`
15. `BattleBaseProjectileProcPatch.js`
16. `BattleProjectileRuntimeBugfixPatch.js`
17. `BattleSceneBcuWaveRuntimePatch.js`
18. `BattleSceneBcuSurgeRuntimePatch.js`
19. `BattleSceneBcuStageBasisOrderPatch.js`
20. `BattleSceneStageRuntimeWiring.js`
21. `BattleSceneRendererOrderPatch.js`
22. `BattleSceneUnitLayerPatch.js`
23. `BattleSceneBcuTimerPatch.js`
24. `BattleSceneBcuLineupPatch.js`
25. `BattleSceneBcuStageSpawnPatch.js`
26. `BattleSceneStageSpawnHeaderPatch.js`
27. `BattleSceneBcuAttackPhasePatch.js`
28. `BattleSceneProcApplyPatch.js`
29. `BattleSceneBcuProcRuntimePatch.js`
30. `BattleSceneBcuStatusIconPatch.js`
31. `BattleSceneBcuStatusEffectRenderPatch.js`
32. `BattleSceneBcuTouchPatch.js`
33. `BattleSceneBcuMobileInputPatch.js`
34. `BattleSceneBcuStageBasisTickPatch.js`
35. `BcuKnockbackRuntimePatch.js`
36. `BcuKnockbackProcPriorityPatch.js`
37. `BattleActorStrengthenLethalPatch.js`
38. `BattleActorZombieRevivePatch.js`
39. `BcuKnockbackEffectLayerPatch.js`
40. `BcuKnockbackAnimationPatch.js`
41. `BcuProcImmunityPatch.js`
42. `BattleSceneAttackEffectPatch.js`
43. `BattleProjectileEffectBcuParityPatch.js`
44. `BattleProjectilePerformanceAndPositionPatch.js`
45. `BattleCrowdPerformancePatch.js`
46. `BattleSceneRendererBcuOriginPatch.js`
47. `BattleSceneRendererHudPatch.js`
48. `BattleSceneRendererBcuGlowPatch.js`
49. `BattleSceneRendererEffectGlowPatch.js`
50. `BattleDebugStripPatch.js`
51. `FormationStageNameBcuPatch.js`

## Wrapper chain

- `BattleScene.prototype.queueAttackDamage`: base `BattleScene.queueAttackDamage` -> `BattleDeterministicRandomPatch` -> `BattleActorAttackNullifyPatch` -> `BattleWaveRuntimePatch` -> `BattleSurgeRuntimePatch` -> `BattleBlastRuntimePatch` -> `BattleBaseProjectileProcPatch` -> `BattleProjectileRuntimeBugfixPatch` -> `BattleSceneProcApplyPatch` -> `BattleSceneBcuProcRuntimePatch` -> `BattleBountyRuntimePatch` -> `BattleProjectilePerformanceAndPositionPatch` -> `BattleCriticalEffectPatch` -> `BattleProcHitEffectPatch`。Run 2 で追加した wrapper は既存 wrapper を置換せず外側から呼ぶ。
- `BattleActor.prototype.takeDamage`: base `BattleActor.takeDamage` -> `BattleActorBarrierShieldPatch` -> `BattleSoulstrikePatch`。`P_IMUATK` / `P_BSTHUNT` は `BattleActor.takeDamage` を直接置換せず、`BattleActorAttackNullifyPatch` の `queueAttackDamage` pre-gate で、barrier/shield/takeDamage より前に rejection する。
- `BattleActor.prototype.resolvePostDamage`: base -> `BcuKnockbackRuntimePatch` direct replacement -> `BcuKnockbackProcPriorityPatch` direct replacement -> `BattleActorStrengthenLethalPatch` wrapper -> `BattleActorZombieRevivePatch` wrapper。`P_BOUNTY` はこの chain を触らず `BattleScene.runTickPhase('knockback-death')` の後段で scene economy に反映する。
- `BattleScene.prototype.enterAttackWait`: base -> `BattleActorGlassPatch`。`AB_GLASS` は attack-complete かつ finite loop 消費後に normal death effect を出さず `state='dead'`, `removeAfterMs=0` にする。
- `BattleAttackResolver.captureTargets`: `BattleSoulstrikePatch` direct replacement 内で corpse targetability を許可しつつ、`AB_ONLY` 時は `bcuTraitCompatible` を再適用する。
- `BattleActor.applyBcuProc`: `BattleActorProcStatusPatch` が freeze/slow/weaken/curse/seal/toxic/knockbackProc を処理。`P_IMUATK`/`P_BSTHUNT` はこの hook ではなく pre-damage gate で `bcuProcStatuses.attackNullify` / `beastHunterNullify` を設定する。

## データフロー

1. Attack capture: `BattleScene.resolveAttackHitEvent` -> `captureHitTargets` -> `BattleAttackResolver.captureTargets`。BCU `AttackSimple.capture` と同じく range/single、base candidate、`AB_ONLY` filter をここで扱う。
2. Damage calculation: `queueAttackDamage` -> `DamageCalculator.calculate` -> attacker strengthen/weaken -> `DamageAbilityResolver.resolve` -> `ProcResolver.resolve`。
3. Damage gate: actor target は `BattleActorAttackNullifyPatch` が `P_IMUATK`/`P_BSTHUNT` active/roll を判定し、通過した場合だけ `target.takeDamage(damage, meta)` に進む。barrier/shield と soulstrike は既存 takeDamage wrapper chain 側。
4. Proc application: `BattleSceneProcApplyPatch` が accepted actor hit の `damageResult.proc.applied` を `target.applyBcuProc` に渡す。pending runtime は `BattleSceneBcuProcRuntimePatch` と `BcuProcRuntime`。
5. Status: `BattleActorProcStatusPatch` が active status を `actor.bcuProcStatuses` に保持し、`tick` で減算。`BcuStatusSnapshot` が render 用 snapshot を作る。
6. Visual: `BattleSceneBcuStatusEffectRenderPatch` -> `BcuStatusEffectManager` -> `BcuStatusEffectSpec` -> `effect:status` ZIP。projectile/proc-hit は `BattleWaveRuntimePatch` / `BattleSurgeRuntimePatch` / `BattleBlastRuntimePatch` / `BattleProcHitEffectPatch` -> `BattleWaveEffectLoader` -> `effect:wave` ZIP。critical は `BattleCriticalEffectPatch` -> hit-effect/kbeff loader。
7. Post-damage: tick phase `knockback-death` で `KBRuntime.resolvePostDamage`。lethal/strengthen/zombie revive は wrapper chain に入る。`BattleBountyRuntimePatch` は同 phase の後段で `bcuBountyStatus` を death/kill money に反映する。

## Effect / animation / ZIP bundle 調査結果

- `effect:status`: `public/assets/bundles/effect/status-effects.zip`。builder は `scripts/build-bcu-status-effect-bundle.mjs`。Run 2 で `A_IMUATK` を `BcuStatusEffectSpec` / `PHASE_A_STATUS_EFFECT_KEYS` に追加し、ZIP と `public/assets/generated/bcu-status-effect-inventory.json` / manifest を再生成した。内部 path: `A_IMUATK/image.png`, `A_IMUATK/imgcut.imgcut`, `A_IMUATK/model.mamodel`, `A_IMUATK/DEF.maanim`。
- `A_IMUATK`: BCU `Data.java` id 43、`Entity.AnimManager.getEff(P_IMUATK)`、`EffAnim.java` maps to `./org/battle/s7/skill_attack_invalid`。raw source: `public/assets/bcu/000001/org/battle/s7/skill_attack_invalid.{mamodel,maanim}` with `skill007.{png,imgcut}`。Run 2 で actor-anchored status snapshot key `ATTACK_NULLIFY` -> `A_IMUATK` に接続した。
- `effect:wave`: `public/assets/bundles/effect/wave.zip`。builder は `scripts/build-bcu-wave-effect-bundle.mjs`。aliases: `unit-wave`, `enemy-wave`, `unit-mini-wave`, `enemy-mini-wave`, `unit-surge`, `enemy-surge`, `unit-mini-surge`, `enemy-mini-surge`, `unit-blast`, `enemy-blast`, `strong-attack`, `metal-killer`。Run 2 で `A_SATK` と `A_METAL_KILLER/A_E_METAL_KILLER` aliases を追加し ZIP/manifest を再生成した。
- `effect:kbeff`: `public/assets/bundles/effect/kbeff.zip`。builder は `scripts/build-bcu-effect-bundle.mjs`。critical/kb/smoke 系。positive buff/status ではなく hit/KBEFF 系。
- barrier/demon shield raw assets are bundled in `effect:wave` raw tree (`s2`, `s14`) but current actor/base shield renderer lifetime and placement are not wired.
- `A_COUNTERSURGE` maps to `./org/battle/s18/skill_demonsummon`; raw exists in `effect:wave` all-skill-effects, but current counter-surge runtime/visual mapping is not proven `code-complete-candidate`.

## Ability / proc matrix

| Ability / proc | Holder source | Target / timing / numeric rule | JS parse location | JS runtime hook | Visual / asset / bundle | Status |
|---|---|---|---|---|---|---|
| めっぽう強い `AB_GOOD` | `Data.java AB_GOOD`; unit index 23 | shared target trait; damage multiplier and received-damage reduction in `EEnemy.getDamage`/`EUnit.getDamage`; pre-proc damage calc | `BcuCombatModel.parseUnitAbility` | `DamageAbilityResolver.resolve` | no separate BCU status visual found | `already-correct` |
| 打たれ強い `AB_RESIST` | `Data.java AB_RESIST`; unit index 29 | shared target trait; received damage reduction | `parseUnitAbility` | `DamageAbilityResolver.resolve` | no separate visual | `already-correct` |
| 超打たれ強い `AB_RESISTS` | `Data.java AB_RESISTS`; unit index 80 | shared target trait; stronger received damage reduction | `parseUnitAbility` | `DamageAbilityResolver.resolve` | no separate visual | `already-correct` |
| 超ダメージ `AB_MASSIVE` | `Data.java AB_MASSIVE`; unit index 30 | shared target trait; outgoing damage multiplier | `parseUnitAbility` | `DamageAbilityResolver.resolve` | no separate visual | `already-correct` |
| 極ダメージ `AB_MASSIVES` | `Data.java AB_MASSIVES`; unit index 81 | shared target trait; stronger outgoing damage multiplier | `parseUnitAbility` | `DamageAbilityResolver.resolve` | no separate visual | `already-correct` |
| ターゲット限定 `AB_ONLY` | `Data.java AB_ONLY`; unit index 32 | capture gate; actor only if trait-compatible; base can still be captured when no actor candidate per BCU | `parseUnitAbility`; event semantic via attack profile | `BattleSoulstrikePatch` now reapplies `bcuTraitCompatible` while allowing soulstrike corpse targetability | no visual | `implemented-in-this-pass` |
| メタル `AB_METALIC` | `Data.java AB_METALIC`; unit index 43; enemy trait metal column | damage gate caps non-crit damage to 1 | `parseUnitAbility`; enemy/unit traits | `DamageAbilityResolver.resolve` | no separate visual | `already-correct` |
| クリティカル `P_CRIT` | `Data.java P_CRIT`; unit index 31, enemy index 25 | damage gate; probability, metal bypass, damage multiplier | `parseUnitProc`, `parseEnemyProc` | `ProcResolver` + `DamageAbilityResolver` + `BattleCriticalEffectPatch` import | critical KBEFF in `effect:kbeff`; `BattleSceneAttackEffectPatch` is imported before critical patch | `implemented-in-this-pass` for visual import/wiring |
| メタルキラー `P_METALKILL` | `P_METALKILL`; unit index 112 | metal target; percent/max-hp style kill calculation in `Entity.damaged` | `parseUnitProc` | `DamageAbilityResolver.resolve` + `BattleProcHitEffectPatch` | BCU `s20/skill_metal_strong`; bundle alias `effect:wave` `metal-killer/*` | `implemented-in-this-pass` |
| 渾身の一撃 `P_SATK` | `P_SATK`; unit 82/83, enemy 75/76 | damage multiplier proc before final damage | `parseUnitProc`, `parseEnemyProc` as `strongAttack` | `DamageAbilityResolver.resolve` + `BattleProcHitEffectPatch` | BCU `A_SATK` `s6/strong_attack`; bundle alias `effect:wave` `strong-attack/*` | `implemented-in-this-pass` |
| 城破壊 `P_ATKBASE` | `P_ATKBASE`; unit 34, enemy 26 | base target only; damage multiplier | `parseUnitProc`, `parseEnemyProc` | `DamageAbilityResolver.resolve` | no separate visual found | `already-correct` |
| 超生命体特効 `AB_BAKILL` | `AB_BAKILL`; unit index 97; enemy trait 94 baron | baron target; outgoing x1.6, incoming x0.7 | `parseUnitAbility`; enemy trait parse | `DamageAbilityResolver.resolve` | no separate visual | `already-correct` |
| 超獣特効 `P_BSTHUNT` damage | `Proc.BSTHUNT`; `P_BSTHUNT=54`; unit 105/106/107; enemy trait 101 beast | beast target; outgoing x2.5 in `EEnemy.getDamage`, incoming x0.6 in `EUnit.getDamage` | `parseUnitProc` exposes `beastHunter` / `bsthunt` / `BSTHUNT` from indexes 105/106/107 | `DamageAbilityResolver.resolve` applies both directions using `BCU_TRAITS.beast` | no separate damage visual | `implemented-in-this-pass` |
| 超獣特効 `P_BSTHUNT` attack-nullify branch | same as above | pre-damage; when attacker has beast trait and defender `BSTHUNT.active>0`, probability `prob`, duration `time`; status `status[P_BSTHUNT][0]` decrements each tick; rejects damage while active | `parseUnitProc` exposes probability/time | `BattleActorAttackNullifyPatch` pre-gates `queueAttackDamage`; status tick via `BattleActorProcStatusPatch`/snapshot alias `beastHunterNullify` | BCU uses `A_IMUATK`; bundled as `effect:status` `A_IMUATK/*`; actor-anchored `ATTACK_NULLIFY` status icon/effect | `implemented-in-this-pass` |
| 超賢者特効 `AB_SKILL` damage | `AB_SKILL`; unit index 111; enemy trait 104 sage | sage target; outgoing and incoming fixed hunter multipliers | `parseUnitAbility`; enemy trait parse | `DamageAbilityResolver.resolve` | no separate visual | `already-correct` for damage only |
| 超賢者特効 status resistance | `EEnemy.getResistValue`, `EUnit.getResistValue`; `SUPER_SAGE_RESIST_TYPE` | proc duration/distance/percent resistance; enemy sage 70% resist unless attacker has `AB_SKILL`; unit `AB_SKILL` reduces sage-source status by 70% | `parseUnitAbility` has `AB_SKILL`; enemy trait 104 sage parsed | `BcuResistRuntime.getBcuResistValue` / `resolveBcuProcResistance`; `BcuProcImmunityPatch` delegates partial math there and records `breakdown.sageResistance` / `bypassedBySkill` | no separate visual | `code-complete` for supported sage branch; verified by `node scripts/check-proc-immunity-resistance-parity.mjs`; broader holder sources remain in partial resistances row |
| 怪人特効 `AB_VKILL` | `AB_VKILL`; common ability bit; enemy trait 110 villain | villain target; outgoing x2.5, incoming x0.4 per Markdown and BCU constants | unit parser lacks direct source; combo/orb holder not parsed | `DamageAbilityResolver` supports if flag exists | no separate visual | `fact-partial`; local holder path for playable actors is combo/orb, not safely parsed |
| 魔女キラー `AB_WKILL` | `AB_WKILL`; unit index 53; enemy trait 48 witch | witch target; outgoing/incoming killer multipliers | `parseUnitAbility`; enemy trait parse | `DamageAbilityResolver.resolve` | no separate visual | `already-correct` |
| 使徒キラー `AB_EKILL` | `AB_EKILL`; unit index 77; enemy trait 71 eva | eva target; outgoing/incoming killer multipliers | `parseUnitAbility`; enemy trait parse | `DamageAbilityResolver.resolve` | no separate visual | `already-correct` |
| ふっとばす `P_KB` | `P_KB`; unit 24, enemy 20 | proc application; probability; knockback interrupt priority after damage gate | `parseUnitProc`, `parseEnemyProc` | `ProcResolver`, `BcuProcRuntime`, `BcuKnockback*` | KBEFF bundle for KB; no status visual | `already-correct` for current full proc path |
| 止める `P_STOP` | `P_STOP`; unit 25/26, enemy 21/22 | post-damage proc; duration; movement and attack timeline gate | `parseUnitProc`, `parseEnemyProc` | `ProcResolver`, `BcuProcRuntime`, `BattleActorProcStatusPatch`, `BattleScene.moveActorBcu` | `A_STOP`/`A_E_STOP` in `effect:status`; builder available | `already-correct` |
| 遅くする `P_SLOW` | `P_SLOW`; unit 27/28, enemy 23/24 | post-damage proc; duration; movement slow | `parseUnitProc`, `parseEnemyProc` | same proc/status runtime | `A_SLOW`/`A_E_SLOW` in `effect:status` | `already-correct` |
| 攻撃力ダウン `P_WEAK` | `P_WEAK`; unit 37/38/39, enemy 29/30/31 | post-damage proc; duration and percent; attack damage token | `parseUnitProc`, `parseEnemyProc` | `ProcResolver`, status patch, `DamageCalculator` weaken path | `A_DOWN`/`A_E_DOWN`; positive weak-up asset found but not needed for normal weaken | `already-correct` for normal weaken |
| 呪い `P_CURSE` | `P_CURSE`; unit 92/93, enemy 73/74 | post-damage proc; disables effect procs via sealed `getProc` equivalent | `parseUnitProc`, `parseEnemyProc` | `ProcResolver`, status patch | `A_CURSE`/`A_E_CURSE` in `effect:status` | `already-correct` for visible status; seal completeness still below |
| ワープ `P_WARP` | `P_WARP`; enemy 65/66/67/68; `INT_WARP`; `WaprCont`; `A_W` / `A_W_C` | post-damage proc; BCU sets `status[P_WARP][0]=proc+A_W.enter+A_W.exit`, spawns ENTER WaprCont, hides base actor, moves at EXIT transition when `kbTime + 1 == A_W.exit`, then keeps base actor hidden through exit (`kbTime -= 11`) | `parseEnemyProc`; IMUWARP parser fields already exposed | `BattleActorProcStatusPatch` delegates to `BcuWarpLifecycleRuntime`; actor is hidden/untargetable/untouchable through enter/hidden/exit, moves only when exit starts, and clears lifecycle after exit; `BcuWarpRuntime` traces lifecycle state | `effect:wave` stable aliases `warp/*` and `warp-chara/*`; `check-effect-bundle-aliases` and `check-effect-coordinate-traces` cover entrance/exit hole/chara traces | `human-visual-review-needed`; deterministic lifecycle/effect/coordinate checks pass, manual browser visual review not run |
| 毒撃 `P_POIATK` | `P_POIATK`; enemy 79/80; `Entity.processProcs` adds `effas().A_POISON.getEAnim(DefEff.DEF)` at `pos,currentLayer` | post-damage proc; max HP percent extra damage; poison effect spawn | `parseEnemyProc` as `toxic` | `ProcResolver`, `BattleActorProcStatusPatch.spawnBcuToxicHitEffect`; `BattleWaveEffectLoader` key `toxic` | existing `effect:wave` entries `all-skill-effects/000001/org/battle/s8/skill008.png`, `skill008.imgcut`, `skill_percentage_attack.mamodel`, `skill_percentage_attack.maanim`; loader alias `toxic` | `human-visual-review-needed` for exact manual appearance; code/effect shape covered by `check-bcu-toxic-effect-parity.mjs` |
| 攻撃無効 `P_IMUATK` | `P_IMUATK`; unit 84/85, enemy 77/78 | pre-damage branch in `Entity.damaged`; probability/time; rejects damage and procs while active; status decrements each tick | `parseUnitProc`, `parseEnemyProc` expose `attackNullify` / `IMUATK` | `BattleActorAttackNullifyPatch` pre-gates `queueAttackDamage`; active status alias `attackNullify` | BCU `A_IMUATK`; bundled as `effect:status` `A_IMUATK/*` and rendered actor-anchored | `implemented-in-this-pass` |
| 攻撃力アップ `P_STRONG` | `P_STRONG`; unit 40/41, enemy 32/33 | post-damage/HP threshold; attack multiplier while active | `parseUnitProc`, `parseEnemyProc` | `BattleActorStrengthenLethalPatch`, `DamageCalculator` | `A_UP`/`A_E_UP` in `effect:status`; actor anchored | `already-correct` |
| 生き残る `P_LETHAL` | `P_LETHAL`; unit 42, enemy 34 | post-damage death gate; probability once; HP set to 1 | `parseUnitProc`, `parseEnemyProc` | `BattleActorStrengthenLethalPatch` | `A_SHIELD`/`A_E_SHIELD` in `effect:status` | `already-correct` |
| 撃破時お金アップ `P_BOUNTY` | `P_BOUNTY`; unit index 33; `EEnemy.kill` checks status `P_BOUNTY` | death/kill money; BCU doubles earned money once and resets if enemy survives | `parseUnitProc` exposes `bounty` | `BattleBountyRuntimePatch` records accepted bounty hit and awards in `knockback-death`; clears if target survives | no separate visual found | `implemented-in-this-pass` |
| 1回攻撃 `AB_GLASS` | `AB_GLASS`; unit index 58==2, enemy index 52==2 | after attack, disappear without normal death effect | `parseUnitAbility`, `parseEnemyAbility`; `BattleAttackTimeline.hasGlassAbility` | `BattleAttackTimeline` finite loop + `BattleActorGlassPatch` post-attack cleanup | Markdown says no ability icon and no ascension effect | `implemented-in-this-pass` |
| 死亡時 Soul animation | `DataUnit.ints[67]`; `DataEnemy.ints[54]`; enemy fallback `ints[54] == -1 && ints[63] == 1 -> Soul 9`; `Entity.AnimManager.kill/draw/update`; `Soul`; `DemonSoul` | normal death uses `data.getDeathAnim()`, sets `dead=soul.len()`, draws soul at `p.y - 100*siz`, hides base actor, and cleanup occurs when soul finishes; `AB_GLASS` sets `dead=0` without soul | `BcuCombatModel.deathAnimation` records raw/fallback source | `BattleBcuDeathAnimationRuntimePatch` starts `BcuDeathAnimationRuntime` from `enterDeadState`, hides base actor via render override, uses soul frameCount for cleanup, and skips soul for AB_GLASS | new `effect:soul` ZIP (`soul-000..012`, `demon-soul-enemy`, `demon-soul-unit`); `BcuSoulEffectLoader`; traces in `check-effect-coordinate-traces`; runtime checks in `check-bcu-death-animation-parity` | `human-visual-review-needed`; parser/runtime/bundle/cleanup deterministic checks pass, manual browser visual review not run |
| 波動 `P_WAVE` | `P_WAVE`; unit 35/36, enemy 27/28; `AttackSimple.excuse` -> `ContWaveDef(new AttackWave(...))`; `AttackWave.excuse` resets `atk=rawAtk` then applies current strengthen/weaken | projectile after captured hit; normal wave level/timing; target-specific damage resolved from raw projectile base, not first target final damage | `parseUnitProc`, `parseEnemyProc`; `DamageCalculator.bcuProjectileBaseDamage` | `BattleWaveRuntimePatch` queues raw projectile base and calls `queueAttackDamage` per target with non-recursive projectile metadata; runtime-level spy verifies `event.damage` | `effect:wave` `unit-wave`/`enemy-wave`; ZIP entries verified by `check-effect-bundle-aliases`; real spawn path coordinate/scale trace verified by `check-effect-coordinate-traces` with `bcuScaleMode: stage-projectile` | `human-visual-review-needed`; logic/effect/coordinate deterministic checks pass, manual browser visual review not run |
| 小波動 `P_MINIWAVE` | mini flag unit 94 / enemy 86; `EUnit/EEnemy.getDamage` applies `MINIWAVE.multi` | mini wave; 20% damage once before target-specific modifiers | `parseUnitProc`, `parseEnemyProc`; `DamageCalculator.bcuProjectileBaseDamage` | `BattleWaveRuntimePatch` scales raw projectile base by mini-wave `mult` exactly once; runtime-level spy verifies `event.damage` | `effect:wave` `unit-mini-wave`/`enemy-mini-wave`; ZIP entries verified by `check-effect-bundle-aliases`; real spawn path coordinate/scale trace verified by `check-effect-coordinate-traces` with `bcuScaleMode: stage-projectile` | `human-visual-review-needed`; logic/effect/coordinate deterministic checks pass, manual browser visual review not run |
| 波動無効 / 波動ストッパー | `P_IMUWAVE`, `AB_WAVES`; `DataUnit.ints[46]/[47]`, `DataEnemy.ints[37]/[38]` (`ints == 1 -> mult 100`); `Entity.damaged` `anim.getEff(P_WAVE)`; `Entity.AnimManager.drawEff` first loop draws `A_WAVE_INVALID`/`A_WAVE_STOP` at `p.y + 0`, scale `siz * 0.75` | wave damage/proc immunity; stopper visual `A_WAVE_STOP`; immunity visual `A_WAVE_INVALID` | `parseUnitProc`/`parseEnemyProc` populate `IMUWAVE` via `fullImu`; `AB_WAVES` parsed as `waveBlocker` | `BcuWaveInvalidRuntime` resolves full/partial immunity at `queueAttackDamage`; `BcuWaveStopperRuntime` stopper path; icons spawn with `bcuScaleMode: entity-status` (drawEff first-loop baseline) | `effect:wave` ZIP `unit-wave-invalid`/`enemy-wave-invalid`/`unit-wave-stop`/`enemy-wave-stop` verified by `check-effect-bundle-aliases`; placement verified by `check-effect-coordinate-traces`/`check-bcu-wave-invalid-parity` | `human-visual-review-needed`; parser/runtime/bundle/coordinate deterministic checks pass, manual browser visual review not run |
| 烈波 `P_VOLC` | `P_VOLC`; unit 86-89, enemy 81-84; `AttackSimple.excuse` -> `ContVolcano(new AttackVolcano(...))`; `AttackVolcano.excuse` resets `atk=rawAtk` then applies current strengthen/weaken | surge projectile; probability, level, random distance; target-specific damage resolved from raw projectile base | `parseUnitProc`, `parseEnemyProc`; `DamageCalculator.bcuProjectileBaseDamage` | `BattleSurgeRuntimePatch` queues raw projectile base and calls `queueAttackDamage` per target with non-recursive projectile metadata; runtime-level spy verifies `event.damage` and recursion suppression | `effect:wave` `unit-surge`/`enemy-surge`; ZIP entries verified by `check-effect-bundle-aliases`; real spawn path start/during/end coordinate/scale trace verified by `check-effect-coordinate-traces` with `bcuScaleMode: stage-projectile` | `human-visual-review-needed`; logic/effect/coordinate deterministic checks pass, manual browser visual review not run |
| 小烈波 `P_MINIVOLC` | mini flag unit 108 / enemy 102; `EUnit/EEnemy.getDamage` applies `MINIVOLC.mult` | mini surge; same source with mini flag; 20% damage once before target-specific modifiers | `parseUnitProc`, `parseEnemyProc`; `DamageCalculator.bcuProjectileBaseDamage` | `BattleSurgeRuntimePatch` scales raw projectile base by mini-surge `mult` exactly once; runtime-level spy verifies `event.damage` | `effect:wave` `unit-mini-surge`/`enemy-mini-surge`; ZIP entries verified by `check-effect-bundle-aliases`; real spawn path start/during/end coordinate/scale trace verified by `check-effect-coordinate-traces` with `bcuScaleMode: stage-projectile` | `human-visual-review-needed`; logic/effect/coordinate deterministic checks pass, manual browser visual review not run |
| 烈波無効 | `P_IMUVOLC`; `DataUnit.ints[91] == 1 -> mult 100`, `DataEnemy.ints[85] == 1 -> mult 100`; `Entity.damaged` `WT_VOLC\|WT_MIVC` guard calls `anim.getEff(P_WAVE)` | surge damage/proc immunity; blocked hit shows `A_WAVE_INVALID` | `parseUnitProc`/`parseEnemyProc` populate `IMUVOLC` via `fullImu` | `BcuWaveInvalidRuntime.resolveBcuWaveInvalid` guards surge/miniSurge at `queueAttackDamage` (full block + partial multiplier); invalid icon spawns with `bcuScaleMode: entity-status` | shares `unit-wave-invalid`/`enemy-wave-invalid` aliases (BCU uses the same `getEff(P_WAVE)` icon); verified by `check-bcu-wave-invalid-parity` partial-IMUVOLC case | `human-visual-review-needed`; parser/runtime deterministic checks pass, manual browser visual review not run |
| 死亡時烈波 | `P_DEATHSURGE`; enemy 89/90/91/92; `Entity.AnimManager.kill/update` deathSurge branch | death trigger rolls in kill, uses demon soul, and calls death surge at soul frame 21 (`soul.len()-dead == 21`) | `parseEnemyProc` | `BcuDeathAnimationRuntime` rolls deathSurge at death, uses demon soul, and enqueues surge at frame 21 via `enqueueBcuSurgeFromPayload`; old immediate scan is bypassed for managed actors | `effect:soul` demon soul aliases; `effect:wave` surge aliases available | `partial`; deterministic death-surge trigger check exists, but full death-surge damage/capture ordering and mini-death-surge split are not fully audited |
| 烈波カウンター `AB_CSUR` | `AB_CSUR`; unit 109, enemy 103 | when hit by surge, counter-surge spawn; BCU `A_COUNTERSURGE` | parsed as `counterSurge` | no full current counter runtime proven | raw `s18/skill_demonsummon` in `effect:wave` | `fact-partial` |
| 爆波 `P_BLAST` | `P_BLAST`; unit 113/114/115, enemy 106/107/108; `AttackSimple.excuse` -> `ContBlast(new AttackBlast(...))`; `ContBlast.draw`; `AttackBlast.capture/excuse` | after captured hit; `ContBlast` attacks from frame 10, level bands reset at 10/20/30; target-specific damage resolved from raw projectile base with 100/70/40 falloff once; capture uses BCU point-position ranges, not target half-width expansion; visual offset is friendly `+100*psiz`, enemy `-30*psiz`, explode phase at frame 11 | `parseUnitProc`, `parseEnemyProc`; `AbilityModel`/`ProcResolver` semantic added; `DamageCalculator.bcuProjectileBaseDamage` | `BattleBlastRuntimePatch` queues ContBlast-like runtime from raw projectile base, uses non-recursive blast event, BCU point capture, and records `blastVisualOffsetX/Y`, `phase`, `level`, `band` | `effect:wave` `unit-blast`/`enemy-blast`; ZIP entries verified by `check-effect-bundle-aliases`; real spawn path start/explode coordinate/scale trace verified by `check-effect-coordinate-traces` with `bcuScaleMode: stage-projectile` | `human-visual-review-needed`; logic/effect/coordinate deterministic checks pass, manual browser visual review not run |
| 爆波無効 `P_IMUBLAST` | `P_IMUBLAST`; `DataUnit.ints[116] != 0 -> mult 100`, `DataEnemy.ints[109] != 0 -> mult 100` (note: BCU gates IMUBLAST with `!= 0`, unlike the `== 1` IMU columns); `Entity.damaged` `WT_BLST` guard calls `anim.getEff(P_WAVE)` | blast damage/proc immunity; blocked hit shows `A_WAVE_INVALID` | `parseUnitProc`/`parseEnemyProc` populate `IMUBLAST` via `fullImuNonZero` | `BcuWaveInvalidRuntime.resolveBcuWaveInvalid` guards blast at `queueAttackDamage`; invalid icon spawns with `bcuScaleMode: entity-status` | shares `unit-wave-invalid`/`enemy-wave-invalid` aliases; verified by `check-bcu-wave-invalid-parity` partial-IMUBLAST case | `human-visual-review-needed`; parser/runtime deterministic checks pass, manual browser visual review not run |
| バリア | `P_BARRIER`; enemy index 64; `Entity.damaged` barrier branch; `AnimManager.getEff(BREAK_NON/BREAK_ABI/BREAK_ATK)` | pre-damage shield gate; insufficient damage blocks HP/proc, breaker passes, damage break cancels current hit/procs | `parseEnemyProc` | `BattleActorBarrierShieldPatch`; `BattleActorBarrierShieldVisualPatch`; `BcuBarrierShieldEffectRuntime` | `effect:wave` `unitBarrier`/`enemyBarrier`; phases `none`/`breaker`/`destruction`; actor priority y offset 25, scale 0.75, layer trace | `human-visual-review-needed`; deterministic logic/effect/scale/layer tests pass, manual browser visual review not run |
| バリアブレイカー | `P_BREAK`; unit 70; `Entity.damaged` checks `atk.getProc().BREAK.prob > 0` before damage break | barrier gate breaker probability; body damage can continue after breaker | `parseUnitProc` | `ProcResolver` pending + barrier patch consumes | `effect:wave` barrier `breaker` phase; unit-side flip preserved | `human-visual-review-needed`; deterministic tests pass, manual browser visual review not run |
| 悪魔シールド | `P_DEMONSHIELD`; enemy 87/88; `Entity.damaged` shield branch; `KBManager.updateKB` `kbTime == 0` live `INT_HB` regen | shield HP absorption; normal break blocks current hit/procs; pierce passes damage; HP restores at KB end using trunc(maxShield * regen / 100) | `parseEnemyProc` | `BattleActorBarrierShieldPatch`; `BattleBcuPriorityEffectRuntimePatch` queues pending regen and consumes it in `stepKnockbackFrame` at KB completion | `effect:wave` `demonShield`; phases `full`/`half`/`destruction`/`breaker`/`revive`; actor priority y offset 25, scale 0.75, layer trace | `human-visual-review-needed`; deterministic logic/effect/timing/scale/layer tests pass, manual browser visual review not run |
| シールドブレイカー | `P_SHIELDBREAK`; unit 95; `Entity.damaged` checks `atk.getProc().SHIELDBREAK.prob > 0` before shield damage compare | demon shield pierce probability; clears shield and allows body damage/procs to continue | `parseUnitProc` | `ProcResolver` pending + shield patch consumes | `effect:wave` `demonShield` `breaker` phase | `human-visual-review-needed`; deterministic tests pass, manual browser visual review not run |
| ゾンビキラー `AB_ZKILL` | `AB_ZKILL`; unit index 52 | kill gate; suppress zombie revive | `parseUnitAbility` | `BattleActorZombieRevivePatch`, `BcuZombieCorpseRuntime` | no separate visual required by BCU source found | `code-complete-candidate` for revive suppression; broader corpse/death-surge row remains partial |
| 魂攻撃 `AB_CKILL` | `AB_CKILL`; unit index 98 | corpse target condition after `REVIVE_SHOW_TIME`; cancels zombie revive | `parseUnitAbility` | `BattleSoulstrikePatch` capture/takeDamage path plus `BcuZombieCorpseRuntime` | no separate visual required by inspected source | `code-complete-candidate` for corpse targetability/cancel; broader corpse/death-surge row remains partial |
| 蘇生 | `P_REVIVE`; enemy 45/46/47; `ZombX.doRevive` sets `status[P_REVIVE][1] = REVIVE.time + A_ZOMBIE.REVIVE.len()`; `ZombX.update` corpse anim DOWN -> REVIVE at `[1] == REVIVE.len() - 2` -> cleared at 0; `AnimManager.draw` hides base actor while `[1] >= REVIVE_SHOW_TIME`; `EffAnim.read` A_ZOMBIE = `org/battle/e1/set_enemy001_zombie` (`_down`/`_revive`/`_back`), A_U_ZOMBIE same asset `rev = true` | death/post-damage; corpse state and revive after time with HP percent; corpse anim replaces base actor | `parseEnemyProc` | `BattleActorZombieRevivePatch` (+ render override wrapper), `BcuZombieCorpseRuntime`, `BcuZombieReviveVisualRuntime` (DOWN hold -> REVIVE swap at len-2, base actor visible again under `REVIVE_SHOW_TIME`, countdown extended by REVIVE anim length) | `effect:soul` ZIP `zombie-corpse/*` (image/imgcut/model + `anim-down`/`anim-revive`; raw `_back.maanim` not present locally so BACK kb-pose stays unbundled) | `human-visual-review-needed`; logic/window/HP/visual lifecycle deterministic checks pass (`check-bcu-zombie-corpse-soulstrike-parity`), manual browser visual review not run |
| 地中移動 | `P_BURROW`; enemy 43/44 | movement/capture state; disappear and reappear by distance/count | `parseEnemyProc` | `BcuBurrowLifecycleRuntime`, `BattleActorBcuBurrowPatch`, `BattleAttackResolver.captureTargets` | actor animations `BURROW_DOWN/MOVE/UP`; no ZIP micro-effect proven | `code-complete-candidate`; exact actor animation appearance not human-reviewed |
| 召喚 | `Proc.SUMMON` proc-object/custom attack holder; normal `DataUnit`/`DataEnemy` CSV holder still not proven | explicit proc object spawns auxiliary actor; immediate non-hit/kill path, deferred `on_hit` / `on_kill`, `EntCont`-style delay, `IMUSUMMON`, same_health, bond_hp, layer fallback, and side limit are implemented for supplied proc objects | not parsed from normal CSV; `BattleAttackProfile` carries per-hit `SUMMON` objects when loader/input supplies them | `BcuSummonRuntime`; `BattleSceneBcuSummonPatch`; `BcuCombatModel` maps `summon -> IMUSUMMON` | normal actor ZIP bundles only; no stable summon-specific runtime effect alias | `partial`; explicit proc-object runtime tested, automatic BCU custom/proc-object loader and exact entry animation review remain missing |
| 精霊 / spirit | `P_SPIRIT`; unit index 110 | `StageBasis` production lifecycle; `EUnit.damaged` spirit sets `P_IMUATK` max and visual; shockwave immunity noted in Markdown | `parseUnitProc().spirit` | `BcuSpiritLifecycleRuntime`, `BattleSceneBcuSpiritPatch` | uses `A_IMUATK`; no separate spirit ZIP alias proven | `human-visual-review-needed`; lifecycle/logic tests pass, exact appearance not human-reviewed |
| freeze/slow/weaken/kb/warp/curse/toxic immunities | `P_IMUKB`, `P_IMUSTOP`, `P_IMUSLOW`, `P_IMUWEAK`, `P_IMUWARP`, `P_IMUCURSE`, `P_IMUPOIATK`; `DataUnit.ints[48..51]/[75]/[79]/[90]`, `DataEnemy.ints[39..42]/[70]/[105]` (no enemy IMUPOIATK column in `DataEnemy.fillData`); `Entity.processProcs` blocked proc -> `anim.getEff(INV)` (`A_EFF_INV`), blocked WARP -> `anim.getEff(INVWARP)` (`A_FARATTACK`/`A_E_FARATTACK`); `getResistValue` partial scaling | proc application gate; full immunity shows invalid status icon; partial resistance scales time/distance/percent | `parseUnitProc`/`parseEnemyProc` populate all IMU* via `fullImu`; `buildImmunity` exposes per-proc mult/full/partial | `BcuProcImmunityPatch` blocks full immunity and scales partial (`BcuResistRuntime`); `BcuProcImmunityVisualPatch` spawns `procInvalid` (A_EFF_INV) for blocked procs and direction-dependent `unitWarpInvalid`/`enemyWarpInvalid` (A_FARATTACK) for blocked warp, both `bcuScaleMode: entity-status` | `effect:wave` ZIP `proc-invalid`, `unit-warp-invalid`, `enemy-warp-invalid` (from raw `s0/skill_effect_invalid`, `s0/farattack/skill_farattack(_e)`); verified by `check-effect-bundle-aliases`/`check-effect-coordinate-traces` | `human-visual-review-needed`; parser/runtime/visual deterministic checks pass, manual browser visual review not run |
| partial resistances | BCU `getResistValue`, sage hunter, talent/orb fields | supported proc duration/distance/percent reduction uses BCU `1 - procResist/100`; full immunity, partial field resistance, sage resistance, and future talent/orb source are separated in `breakdown`; broad talent/orb/other holder sources still require proof | full/partial IMU fields parsed where current combat model exposes them; broader external sources not safely parsed | `BcuResistRuntime` centralizes supported math and `BcuProcImmunityPatch` delegates to it while exposing `resistance.breakdown` and `unsupportedSources` | no distinct visual | `partial`; supported IMU/sage branch is `code-complete`, broader holder source coverage remains missing and is not silently applied |

## Implemented in Run 2

- `P_BSTHUNT` parse and damage: unit indexes 105/106/107 now expose `beastHunter` / `bsthunt` / `BSTHUNT`; `DamageAbilityResolver` applies x2.5 outgoing vs beast and x0.6 incoming from beast.
- `P_BSTHUNT` attack-nullify branch: `BattleActorAttackNullifyPatch` rolls active beast-hunter nullify against beast attackers and stores `beastHunterNullify` status; `ATTACK_NULLIFY` snapshot renders `A_IMUATK`.
- `P_IMUATK`: unit 84/85 and enemy 77/78 parse as `attackNullify` / `IMUATK`; the same pre-damage gate rejects damage while active.
- `AB_ONLY` + `AB_CKILL`: `BattleSoulstrikePatch` keeps soulstrike corpse targetability and reapplies `AB_ONLY` trait filtering.
- `P_BOUNTY`: `BattleBountyRuntimePatch` records accepted bounty hits, awards scene economy money at death, and clears the status if the target survives.
- `AB_GLASS`: `BattleActorGlassPatch` removes one-attack actors after attack completion without entering normal death/KB effect flow.
- `P_BLAST`: `BattleBlastRuntimePatch` creates a ContBlast-style runtime object, attacks levels at BCU frames, and uses `effect:wave` `unit-blast` / `enemy-blast`.
- `P_METALKILL`, `P_SATK`, `P_CRIT` visuals: critical patch is imported; `strong-attack` and `metal-killer` aliases were added to `effect:wave` and are spawned by `BattleProcHitEffectPatch`.

## Implemented in this pass

- Effect ZIP audit: created `docs/ability-logic/effect-zip-audit.md` from current `unzip -l` output before runtime edits, then updated it after rebuilding `effect:wave`.
- `effect:wave` aliases added by `scripts/build-bcu-wave-effect-bundle.mjs` and loaded by `BattleWaveEffectLoader`: `unit-barrier`, `enemy-barrier`, `demon-shield`, `warp`, `warp-chara`, `unit-wave-invalid`, `enemy-wave-invalid`, `unit-wave-stop`, `enemy-wave-stop`, `enemy-wave-guard`, `unit-counter-surge`, `enemy-counter-surge`.
- Barrier / barrier breaker: BCU references used: `DataEnemy` index 64 -> `proc.BARRIER.health`; `DataUnit` index 70 -> `P_BREAK`; `Entity.damaged` barrier gate; `Entity.Barrier.breakBarrier`; `EffAnim.A_B/A_E_B`. Runtime keeps barrier before demon shield, consumes `barrierBreaker`, blocks insufficient damage/procs, and spawns `unit-barrier` / `enemy-barrier` `none`, `breaker`, or `destruction` phases from `BattleBcuPriorityEffectRuntimePatch`.
- Demon shield / shield breaker: BCU references used: `DataEnemy` indexes 87/88 -> `DEMONSHIELD.hp/regen`; `DataUnit` index 95 -> `P_SHIELDBREAK`; `Entity.damaged` shield branch; `KBManager.updateKB` shield regeneration at `kbTime == 0`; `EffAnim.A_DEMON_SHIELD/A_E_DEMON_SHIELD`. Runtime blocks normal shield-breaking damage, only allows body damage through on `shieldPierce`, queues regen after live HP `INT_HB`, restores HP at KB completion using `Math.trunc(maxShield * regen / 100)`, and spawns `demon-shield` `full`, `half`, `destruction`, `breaker`, and delayed `revive`.
- Warp: BCU references used: `DataEnemy` indexes 65-68; `Entity.processProcs` `P_WARP`; `Entity.AnimManager.kbAnim`; `Entity.KBManager.updateKB`; `WaprCont`; `EffAnim.A_W/A_W_C`; Android `BattleBox` WaprCont offsets. Runtime now uses `BcuWarpLifecycleRuntime` for enter/hidden/exit/done, hides/untargetables/untouchables actor through the whole lifecycle, moves at the BCU exit transition, and spawns `warp`/`warp-chara` WaprCont effects from the lifecycle.
- Wave invalid / wave stopper: BCU references used: `DataUnit` index 46 / `DataEnemy` index 37 for `IMUWAVE`, `DataUnit` index 47 / `DataEnemy` index 38 for `AB_WAVES`, `Entity.damaged` `anim.getEff(P_WAVE)`, `ContWaveDef.update` stopper branch, and `EffAnim.A_WAVE_INVALID/A_E_WAVE_INVALID/A_WAVE_STOP/A_E_WAVE_STOP`. Runtime damage guard rejects wave/mini-wave at `queueAttackDamage`; stopper detection now reads parsed `AB_WAVES`; visuals spawn from `unit-wave-invalid` / `enemy-wave-invalid` and `unit-wave-stop` / `enemy-wave-stop`.
- Surge and blast immunity: BCU references used: `DataUnit` index 91 / `DataEnemy` index 85 for `IMUVOLC`, `DataUnit` index 116 / `DataEnemy` index 109 for `IMUBLAST`, and `Entity.damaged` `WT_VOLC|WT_MIVC|WT_BLST` guards. Existing `BattleSceneBcuProcRuntimePatch` damage guard now has stable invalid-effect visuals for blocked surge/blast hits.
- Death soul/death surge: BCU references used: `DataUnit.ints[67]`, `DataEnemy.ints[54]`, enemy fallback `ints[54] == -1 && ints[63] == 1 -> Soul 9`, `Entity.AnimManager.kill/draw/update`, `PackData.loadSoul`, `Soul`, `DemonSoul`, and `Entity.KBManager.updateKB` AB_GLASS branch. Runtime parses death animation source, spawns `effect:soul` soul effects, hides base actor during soul, uses soul frameCount for cleanup, skips AB_GLASS soul, and triggers managed death surge at the BCU 21-frame soul timing. Full death-surge damage ordering remains partial.
- Counter surge: BCU references used: `DataUnit` index 109 / `DataEnemy` index 103 `AB_CSUR`, `Entity.damaged` `AttackVolcano` counter branch, and `SurgeSummoner` `COUNTER_SURGE_FORESWING=50`. Runtime detects accepted incoming surge hits, spawns `unit-counter-surge` / `enemy-counter-surge`, delays 50 frames, and enqueues a non-looping counter surge with `bcuCounterSurge` metadata.
- Curse/seal suppression: BCU references used: `AtkModelEntity.sealed` blank proc except `MOVEWAVE`, `AtkModelEnemy.cursed` cleared proc list, and `ContVolcano.updateProc` seal/curse proc-group update. Runtime broadens seal suppression for proc/projectile generation and suppresses sealed `P_ATKBASE` / `P_METALKILL` damage additions.
- Toxic direct damage guard: BCU references used: `DataEnemy` indexes 79/80 `P_POIATK`, `DataUnit` index 90 `IMUPOIATK`, `Entity.damaged` poison immunity guard. Runtime no longer writes toxic damage directly into `pendingDamage`; it goes through `takeDamage` after `BcuProcImmunityPatch` has the opportunity to block toxic.

## Implemented in W0-W2 Codex pass

- W0 proof harness: added deterministic checks `scripts/check-bcu-parser-indexes.mjs`, `scripts/check-projectile-damage-parity.mjs`, `scripts/check-proc-immunity-resistance-parity.mjs`, `scripts/check-effect-bundle-aliases.mjs`, `scripts/check-effect-coordinate-traces.mjs`, and `scripts/check-debug-allocation-guards.mjs` (the latter retired when the BCU trace-channel instrumentation was removed from runtime). Follow-up pass replaced fake effect debug payload checks with real runtime spawn helper fixtures.
- W1 projectile damage basis: BCU references used: `AttackAb.rawAtk`, `AttackSimple.excuse`, `AttackWave.excuse`, `AttackVolcano.excuse`, `AttackBlast.excuse`, and `EUnit/EEnemy.getDamage` mini-wave/mini-surge branches. `DamageCalculator` now exposes `rawAttackDamage` / `bcuProjectileBaseDamage`; wave, surge, and blast runtime containers store that raw base instead of the first direct target's `finalDamage`. Mini-wave/mini-surge and blast falloff are applied once to the projectile raw base before target-specific damage resolution; runtime-level spies verify `queueAttackDamage` payloads and non-recursive metadata.
- W2 resistance runtime: BCU references used: `EEnemy.getResistValue`, `EUnit.getResistValue`, `Data.SUPER_SAGE_RESIST`, `Data.SUPER_SAGE_RESIST_TYPE`, and `Data.SUPER_SAGE_HUNTER_RESIST`. `BcuResistRuntime` returns `implemented: true` for supported proc resistance fields, centralizes duration, distance, and percent reductions used by `BcuProcImmunityPatch`, and records `breakdown.fieldImmunity`, `partialResistance`, `sageResistance`, and future `talentOrbResistance` unsupported source state.
- W5/W6 effect evidence follow-up: `EffectRuntime.createEffect` preserves `bcuScaleMode`; `BattleSceneRendererEffectGlowPatch.resolveBcuEffectScale` branches stage projectile / actor priority / warp / hit smoke / legacy formulas with scale trace fields. `check-effect-coordinate-traces` now verifies real wave, mini-wave, surge start/during/end, mini-surge start/during/end, blast start/explode, barrier, demon shield, warp entrance/exit, wave invalid, wave stop, and counter-surge spawn paths.
- ZIP/effect evidence: `check-effect-bundle-aliases` verifies every `BattleWaveEffectLoader` alias against `public/assets/bundles/effect/wave.zip`, required status aliases from `BcuStatusEffectSpec`, and critical/hit smoke/boss/kb entries against `status-effects.zip` and `kbeff.zip`.

## Implemented in 2026-06-03 P_DELAY pass

- P_DELAY source evidence: `DataEnemy.fillData` maps `ints[111]` / `ints[112]` to `Proc.DELAY.prob` / `strength`; `Proc.DELAY.type` is a proc-object/editor field; no direct `DataUnit` or `DataEnemy` CSV holder for `IMUDELAY` was found in inspected constructors.
- P_DELAY runtime owner: `EUnit.processProcs` and `EEnemy.processProcs` accumulate accepted delay into `status[P_DELAY][type]`; `EUnit.postUpdate` adds into `basis.cdDelay`; `EEnemy.postUpdate` writes `basis.lineDelay`; `StageBasis.update` flushes those arrays once per tick through `ELineUp.delay` / `EStage.delay`.
- JS runtime update: `BcuDelayRuntime` now queues same-tick delay procs and `BcuDelayRuntimePatch` flushes the aggregate in `proc-resolve`, matching BCU's status-to-basis handoff instead of applying each accepted hit immediately.
- A_E_DELAY visual evidence: `EffAnim.A_E_DELAY` maps to `./org/battle/s23/skill_recast_decrease_e`; BCU spawns `EAnimCont(pos, currentLayer, A_E_DELAY DEF, -50f)` on nonzero accepted delay. `effect:wave` now has the stable alias `enemy-delay/image.png`, `enemy-delay/imgcut.imgcut`, `enemy-delay/model.mamodel`, and `enemy-delay/anim.maanim`.
- Tests: `scripts/check-bcu-delay-runtime.mjs` covers exact `getDelayStrength`, full `IMUDELAY`, partial `IMUDELAY`, same-tick multi-delay aggregation, player cooldown, enemy stage line, and no-op paths. `scripts/check-effect-bundle-aliases.mjs` and `scripts/check-effect-coordinate-traces.mjs` cover the `A_E_DELAY` bundle and coordinate/effect trace.
- Status: `P_DELAY` is `human-visual-review-needed`; code/effect/coordinate evidence passes, but exact browser appearance has not been manually reviewed.

## 2026-06-04 docs-only evidence extraction pass

This pass added source evidence only. It did not change `js/`, `scripts/`, `public/assets/`, ZIP bundles, generated manifests, or runtime behavior. Detailed notes are in `docs/ability-logic/bcu-evidence-extraction-pass-2026-06-04.md`; unresolved evidence-only blockers are in `docs/ability-logic/bcu-unresolved-evidence-blockers.md`.

| Area | Holder source | Runtime owner | Numeric rule | JS hook | Visual / bundle | Status | Blocker | Next test |
|---|---|---|---|---|---|---|---|---|
| Burrow | `DataEnemy.ints[43] -> BURROW.count`, `ints[44] / 4 -> BURROW.dis`; no normal `DataUnit` holder found | `Entity.update`, `update2`, `startBurrow`, `updateBurrow`, `touchable`; summon `anim_type == 3` can initialize burrow state | count decrements at start; `kbTime -2/-3/-4`; underground `bdist` decrements by actual movement; base proximity forces up animation | `BcuCombatModel.parseEnemyProc().burrow`; `BcuBurrowLifecycleRuntime`; `BattleActorBcuBurrowPatch`; no `ProcResolver` catalog entry because owner is entity lifecycle | actor animations `BURROW_DOWN/MOVE/UP`; no ZIP micro-effect proven | `code-complete-candidate` | exact human/browser actor animation review remains | `check-bcu-burrow-lifecycle-parity.mjs` |
| Castle/base guard | `StageBasis.activeGuard`; `ECastle.guard`; no actor proc holder | `StageBasis.update`, `StageBasis.checkGuard`, `Entity.postUpdate`, `ECastle.damaged/updateAnimation/guardBreak` | active guard blocks base HP damage entirely; break after boss condition clears | `BcuCastleGuardRuntime`; `BattleSceneBcuCastleGuardPatch`; stage/base runtime state and base damage gate | `EffAnim.A_E_GUARD`; existing `wave.zip` `enemy-wave-guard/image.png`, `imgcut.imgcut`, `model.mamodel`, `anim-none.maanim`, `anim-breaker.maanim` | `human-visual-review-needed` | exact manual visual review remains | `check-bcu-castle-guard-parity.mjs` |
| Spirit | `DataUnit.ints[110] -> SPIRIT.id`; `LineUp` builds spirit form | `StageBasis.act_spawn/update`, `spiritCooldown`, `summonerSummoned`, `spiritSummoned`, `EUnit.isSpirit` | cooldown 15; range 150; one spirit per living summoner; spirit rejects damage and self-kills after attack | `parseUnitProc().spirit`; `BcuSpiritLifecycleRuntime`; `BattleSceneBcuSpiritPatch` | uses normal unit animation plus `A_IMUATK`; no separate spirit ZIP alias proven | `human-visual-review-needed` | exact manual visual review remains | `check-bcu-spirit-lifecycle-parity.mjs` |
| Summon | `Proc.SUMMON` proc-object/custom attack holder; normal `DataUnit`/`DataEnemy` CSV holder not found | `AtkModelEntity.setProc/invokeLater`, `AtkModelUnit.summon`, `AtkModelEnemy.summon`, `Entity.setSummon`, `EntCont`, bond tree | random `dis..max_dis`; unit attacker level adds to unit summon unless `fix_buff`; enemy attacker magnification carries to enemy summon unless `fix_buff`; `IMUSUMMON` scales by `(100-resist)/100`; layer fallback; `same_health`; `bond_hp`; `ignore_limit`; immediate and hit/kill deferred trigger split | no normal CSV parser; `BattleAttackProfile` carries supplied per-hit `SUMMON` object | `BcuSummonRuntime`; `BattleSceneBcuSummonPatch`; `BcuProcImmunityPatch` / `BcuCombatModel` for `IMUSUMMON` | normal actor ZIP bundles only; source-style summon paths remain in `wave.zip` but no stable summon-specific alias is used | `partial` | automatic BCU custom/proc-object source loading, stage `allow` group source model, and exact `anim_type` entry appearance remain | `check-bcu-summon-runtime-parity.mjs` |
| Combo/orb/treasure/talent/PCoin modifiers | `BasisLU.getInc`, `LineUp`, `Treasure`, `EUnit.OrbHandler`, `PCoin`, `AtkModelUnit` | entity construction and `getDamage`, not parser-only | Java truncation after family steps; orbs can add attack, modify ability multipliers, resist damage, or mutate IMU fields | `DamageAbilityResolver` explicitly omits these sources | no general visual | `partial` | data loaders and exact fixtures missing | `check-bcu-external-damage-modifiers.mjs` |
| `AB_VKILL` | `EUnit.getAbi` adds `AB_VKILL` from combo `C_VKILL`; enemy villain trait is `DataEnemy.ints[110]` | `EEnemy.getDamage`, `EUnit.getDamage` | villain attack/resist constants apply after trait match | resolver supports flag if present; direct playable holder path not parsed | no separate visual | `partial` | combo/orb holder path not loaded into JS actors | include in external modifier check |
| TargetForms / special trait compatibility | BCU `Trait.targetForms` branch in `EEnemy.getDamage`; `Entity.traitCompatible` handles targetOnly/base | damage and capture compatibility owners | targetForms can add compatibility even without ordinary shared traits | `BcuTraitCompatibility`, `BattleAttackResolver`, `DamageAbilityResolver` partial | no visual | `partial` | no fixture data for special targetForms | targetForms fixture check |
| Enemy `IMUPOIATK` / toxic immunity | negative evidence: `DataEnemy` has `P_POIATK` 79/80 but no enemy toxic-immunity holder; `DataUnit` index 90 exists | `Entity.processProcs` can consume target `getProc().IMUPOIATK` when a proven holder supplies it | full immunity blocks toxic, partial cuts toxic percent | JS must not populate enemy `IMUPOIATK`; enemy toxic immunity is treated as nonexistent for supported enemy data | invalid effect on full immunity for proven non-enemy holders | `negative-evidence` | no enemy toxic-immunity source exists in supported enemy data | keep enemy loader unchanged |
| Zombie corpse / soulstrike / death surge | `DataEnemy` revive 45/46/47, death surge 89-92; `DataUnit` `AB_ZKILL` 52, `AB_CKILL` 98 | `Entity.ZombX`, `Entity.touchable`, `Entity.getTouch`, `AtkModelEntity.getDeathSurge` | revive HP `maxH * health / 100`; `REVIVE_SHOW_TIME`; revive timer plus zombie effect length; death/mini-death surge random range; death surge at demon soul frame 21 | `BcuZombieCorpseRuntime`; `BattleActorZombieRevivePatch`; `BcuZombieReviveVisualRuntime`; `BattleSoulstrikePatch`; `BcuDeathAnimationRuntime` | `effect:soul` `zombie-corpse/*` aliases (A_ZOMBIE/A_U_ZOMBIE DOWN/REVIVE; raw `_back.maanim` missing locally) | `human-visual-review-needed` for corpse visual; `partial` for mini-death-surge | mini-death-surge split and BACK kb-pose remain; revive visual lifecycle now deterministic-checked | `check-bcu-zombie-corpse-soulstrike-parity.mjs` |
| Bounty/money visual | `EEnemy.kill` uses treasure drop, combo `C_MEAR`, bounty proc, and bounty orb grade | kill/economy owner | `basis.money += (int)(mul * drop)` | `BattleBountyRuntimePatch` has award path | no stable money/bounty visual ZIP alias proven | `partial` | visual owner missing; logic should not imply visual parity | bounty visual source check |
| Status/effect visual ordering | `Entity.AnimManager.getEff/checkEff/drawEff`; `EffAnim` mappings | actor animation manager and `basis.lea` | status clear when counters hit 0; offsets include `-75f`, `-50f`, actor-priority `-25*siz` | status manager/positioner and effect traces exist for covered rows | `status-effects.zip`, `wave.zip`, `kbeff.zip`, `soul.zip` verified by `unzip -l` | `partial` for uncovered icons | positive weaken/strengthen, bounty money, zombie revive, knockback smoke incomplete | extend `check-effect-coordinate-traces.mjs` fixtures |

## Deferred / `fact-partial` rows and blockers

- `AB_VKILL`: BCU damage rule and enemy villain trait are known, and the 2026-06-04 pass proved `EUnit.getAbi` adds the bit from combo `C_VKILL`; playable holder source still requires combo/orb runtime state before it is safe to parse/apply broadly.
- Wave guard / castle guard: 2026-06-04 source pass proved `StageBasis.activeGuard` and `ECastle.guard` as runtime owners. Stage/base guard state and base damage gate are now implemented; exact manual visual review remains.
- Warp no-KB suppression: lifecycle timing is implemented and tested, but broader proc-vs-HP-KB cancellation ordering is only covered through existing proc application ordering and remains a residual audit item.
- Burrow and spirit: holder/runtime identity and owner methods are source-backed; burrow is implemented to `code-complete-candidate`, while spirit is `human-visual-review-needed` pending manual appearance review.
- Summon: runtime owner is source-backed, but normal CSV holder remains negative evidence and JS custom/proc-object loader is missing; row stays blocked.
- Partial resistances: supported IMU/sage math is centralized in `BcuResistRuntime`, but exact source fields beyond current combat model IMU fields and sage hunter remain unresolved.

## Run 2 changed files

- Parser/model/runtime: `js/battle/BcuCombatModel.js`, `js/battle/AbilityModel.js`, `js/battle/DamageAbilityResolver.js`, `js/battle/ProcResolver.js`, `js/battle/EffectRuntime.js`, `js/main.js`.
- New focused runtime patches: `js/battle/BattleActorAttackNullifyPatch.js`, `js/battle/BattleBountyRuntimePatch.js`, `js/battle/BattleActorGlassPatch.js`, `js/battle/BattleBlastRuntimePatch.js`, `js/battle/BattleProcHitEffectPatch.js`.
- Existing runtime fixes: `js/battle/BattleSoulstrikePatch.js`, `js/battle/BattleWaveRuntimePatch.js`, `js/battle/BattleWaveEffectLoader.js`.
- Status/effect wiring: `js/battle/bcu-runtime/BcuStatusSnapshot.js`, `js/battle/bcu-runtime/BcuStatusIconResolver.js`, `js/battle/bcu-runtime/BcuStatusEffectSpec.js`, `scripts/build-bcu-wave-effect-bundle.mjs`.
- Rebuilt/generated assets: `public/assets/bundles/effect/status-effects.zip`, `public/assets/bundles/effect/wave.zip`, `public/assets/generated/bcu-bundle-manifest.json`, `public/assets/generated/bcu-status-effect-inventory.json`.

## Next implementation order

1. Keep `fact-partial` rows deferred until exact parser/runtime/visual blockers are closed.
2. Next highest-value candidates are full proc immunities and barrier/demon shield visuals because raw assets exist but parser/runtime mapping is incomplete.
3. Do not expand summon, mini-death-surge, counter-surge, zombie revive visual, or remaining external partial resistance sources until their blockers above are resolved in this matrix. `P_WARP` lifecycle is implemented to human-visual-review-needed evidence level; broader proc-vs-HP-KB cancellation ordering remains an audit item.

## 検索・確認コマンド

```bash
mkdir -p /tmp/bcu-ref
python3 - <<'PY'
import zipfile, pathlib, shutil
pairs = [
    ('references/bcu/BCU_java_util_common.zip', '/tmp/bcu-ref/common'),
    ('references/bcu/BCU_Android-master.zip', '/tmp/bcu-ref/android'),
]
for z, out in pairs:
    p = pathlib.Path(z)
    o = pathlib.Path(out)
    if o.exists():
        shutil.rmtree(o)
    o.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(p) as f:
        f.extractall(o)
    print('extracted', p, '->', o)
PY
rg -n "P_BSTHUNT|BSTHUNT|TRAIT_BEAST|AB_BAKILL|AB_SKILL|AB_VKILL|P_IMUATK|P_BOUNTY|P_BLAST|DataUnit|DataEnemy|EEnemy|getDamage|EUnit|damaged|AttackSimple|AttackWave|AttackVolcano|ContBlast" /tmp/bcu-ref references/bcu js
find public references/bcu -type f | sort | rg -i "eff|effect|proc|status|ability|weak|stop|slow|curse|seal|barrier|shield|wave|volcano|surge|blast|imu|dodge|bounty|strong|lethal|beast|bsthunt|A_|P_"
rg -n "A_IMUATK|P_IMUATK|P_BSTHUNT|A_UP|A_SHIELD|A_WEAK|A_STOP|A_SLOW|effect|eff|kbeff|status" js scripts references/bcu public/assets/generated public/assets/bcu
unzip -l public/assets/bundles/effect/status-effects.zip
unzip -l public/assets/bundles/effect/wave.zip
```

## Run 2 verification commands

These are terminal-only checks; no browser test is required for this analysis pass.

```bash
node --check js/battle/BcuCombatModel.js
node --check js/battle/DamageAbilityResolver.js
node --check js/battle/ProcResolver.js
node --check js/main.js
node --check js/battle/AbilityModel.js
node --check js/battle/BattleActorAttackNullifyPatch.js
node --check js/battle/BattleBlastRuntimePatch.js
node --check js/battle/BattleBountyRuntimePatch.js
node --check js/battle/BattleActorGlassPatch.js
node --check js/battle/BattleProcHitEffectPatch.js
node --check js/battle/BattleSoulstrikePatch.js
node --check js/battle/BattleWaveEffectLoader.js
node --check js/battle/BattleWaveRuntimePatch.js
node --check js/battle/EffectRuntime.js
node --check js/battle/bcu-runtime/BcuStatusSnapshot.js
node --check js/battle/bcu-runtime/BcuStatusIconResolver.js
node --check js/battle/bcu-runtime/BcuStatusEffectSpec.js
node --check scripts/build-bcu-wave-effect-bundle.mjs
node scripts/build-bcu-status-effect-bundle.mjs
node scripts/build-bcu-wave-effect-bundle.mjs
unzip -l public/assets/bundles/effect/status-effects.zip | rg 'A_IMUATK/(image|imgcut|model|DEF)'
unzip -l public/assets/bundles/effect/wave.zip | rg '^(.*)(strong-attack|metal-killer|unit-blast|enemy-blast)/(image|imgcut|model|anim)'
```

Run 2 result:

- `node --check js/battle/BcuCombatModel.js`: pass.
- `node --check js/battle/DamageAbilityResolver.js`: pass.
- `node --check js/battle/ProcResolver.js`: pass.
- `node --check js/main.js`: pass.
- `node --check js/battle/AbilityModel.js`: pass.
- `node --check js/battle/BattleActorAttackNullifyPatch.js`: pass.
- `node --check js/battle/BattleBlastRuntimePatch.js`: pass.
- `node --check js/battle/BattleBountyRuntimePatch.js`: pass.
- `node --check js/battle/BattleActorGlassPatch.js`: pass.
- `node --check js/battle/BattleProcHitEffectPatch.js`: pass.
- `node --check js/battle/BattleSoulstrikePatch.js`: pass.
- `node --check js/battle/BattleWaveEffectLoader.js`: pass.
- `node --check js/battle/BattleWaveRuntimePatch.js`: pass.
- `node --check js/battle/EffectRuntime.js`: pass.
- `node --check js/battle/bcu-runtime/BcuStatusSnapshot.js`: pass.
- `node --check js/battle/bcu-runtime/BcuStatusIconResolver.js`: pass.
- `node --check js/battle/bcu-runtime/BcuStatusEffectSpec.js`: pass.
- `node --check scripts/build-bcu-wave-effect-bundle.mjs`: pass.
- `node scripts/build-bcu-status-effect-bundle.mjs`: pass; rebuilt `status-effects.zip` and inventory.
- `node scripts/build-bcu-wave-effect-bundle.mjs`: pass; rebuilt `wave.zip` and manifest.
- `unzip -l public/assets/bundles/effect/status-effects.zip | rg 'A_IMUATK/(image|imgcut|model|DEF)'`: pass; all four entries present.
- `unzip -l public/assets/bundles/effect/wave.zip | rg '^(.*)(strong-attack|metal-killer|unit-blast|enemy-blast)/(image|imgcut|model|anim)'`: pass; blast, strong attack, and metal killer aliases present.
- focused Node import check for `P_BSTHUNT` parser/damage: pass; parse `{active:1,prob:40,time:120}`, outgoing damage `250`, incoming damage `60`.

## Validation limits

- BCU extraction and source search were local only; no external source was used.
- Browser rendering was not run by request. The document only claims terminal-verified loader/bundle evidence from code and ZIP entries, not visual pixel validation.
- `already-correct` means current JS matches the inspected local BCU behavior for the scoped logic and required visible effect found in this pass. Rows marked `implemented-in-this-pass` were changed by this commit.

## Rollback plan

- Run 2 rollback: revert this commit to restore parser, runtime, bundle ZIPs, generated manifest/inventory, and matrix together. Do not hand-edit ZIP files; always restore/rebuild them through the builder scripts.
