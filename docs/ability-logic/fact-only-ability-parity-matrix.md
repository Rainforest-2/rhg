# Fact-only ability parity matrix

## 目的

BCU common/Android 参照、現行 JS、ローカル asset、ZIP bundle、builder、loader を照合し、推測なしで次回実装できる能力を最大限 `fact-complete` に分類する。

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
- Runtime patches: `BattleSceneProcApplyPatch.js`, `BattleSceneBcuProcRuntimePatch.js`, `BattleActorProcStatusPatch.js`, `BattleSceneBcuStatusIconPatch.js`, `BattleSceneBcuStatusEffectRenderPatch.js`, `BattleActorBarrierShieldPatch.js`, `BattleActorZombieRevivePatch.js`, `BattleSoulstrikePatch.js`, `BattleWaveRuntimePatch.js`, `BattleSurgeRuntimePatch.js`, `BattleBaseProjectileProcPatch.js`, `BattleProjectileRuntimeBugfixPatch.js`, `BcuKnockbackRuntimePatch.js`, `BcuKnockbackProcPriorityPatch.js`, `BattleActorStrengthenLethalPatch.js`, `BcuProcImmunityPatch.js`, `BattleProjectileEffectBcuParityPatch.js`, `BattleProjectilePerformanceAndPositionPatch.js`。
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

- `BattleScene.prototype.queueAttackDamage`: base `BattleScene.queueAttackDamage` -> `BattleDeterministicRandomPatch` -> `BattleWaveRuntimePatch` -> `BattleSurgeRuntimePatch` -> `BattleBaseProjectileProcPatch` -> `BattleProjectileRuntimeBugfixPatch` -> `BattleSceneProcApplyPatch` -> `BattleSceneBcuProcRuntimePatch` -> `BattleProjectilePerformanceAndPositionPatch`。`BattleCriticalEffectPatch` と `BattleUnifiedDamageDebugPatch` は wrapper を持つが `js/main.js` からは直接 import されていない。
- `BattleActor.prototype.takeDamage`: base `BattleActor.takeDamage` -> `BattleActorBarrierShieldPatch` -> `BattleSoulstrikePatch`。次回 `P_IMUATK` / `P_BSTHUNT` を入れる場合は、BCU の `EUnit.damaged` と `Entity.damaged` の順序に合わせ、barrier/shield より外側で攻撃無効を判定できる import 位置が必要。
- `BattleActor.prototype.resolvePostDamage`: base -> `BcuKnockbackRuntimePatch` direct replacement -> `BcuKnockbackProcPriorityPatch` direct replacement -> `BattleActorStrengthenLethalPatch` wrapper -> `BattleActorZombieRevivePatch` wrapper。次回 `P_BOUNTY` や `AB_GLASS` を触る場合は、この chain の後段か `BattleScene` 側の kill bookkeeping が必要。
- `BattleAttackResolver.captureTargets`: base method は `AB_ONLY` target filtering を持つが、`BattleSoulstrikePatch` が direct replacement しており target-only filter を再適用していない。Run 2 では soulstrike corpse targetability と `AB_ONLY` filtering を統合する必要がある。
- `BattleActor.applyBcuProc`: `BattleActorProcStatusPatch` が freeze/slow/weaken/curse/seal/toxic/knockbackProc を処理。`P_IMUATK`/`P_BSTHUNT` はこの hook ではなく `takeDamage` pre-damage gate が BCU に近い。

## データフロー

1. Attack capture: `BattleScene.resolveAttackHitEvent` -> `captureHitTargets` -> `BattleAttackResolver.captureTargets`。BCU `AttackSimple.capture` と同じく range/single、base candidate、`AB_ONLY` filter をここで扱う。
2. Damage calculation: `queueAttackDamage` -> `DamageCalculator.calculate` -> attacker strengthen/weaken -> `DamageAbilityResolver.resolve` -> `ProcResolver.resolve`。
3. Damage gate: actor target は `target.takeDamage(damage, meta)`。barrier/shield、soulstrike、次回の `P_IMUATK`/`P_BSTHUNT` pre-damage rejection はここ。
4. Proc application: `BattleSceneProcApplyPatch` が accepted actor hit の `damageResult.proc.applied` を `target.applyBcuProc` に渡す。pending runtime は `BattleSceneBcuProcRuntimePatch` と `BcuProcRuntime`。
5. Status: `BattleActorProcStatusPatch` が active status を `actor.bcuProcStatuses` に保持し、`tick` で減算。`BcuStatusSnapshot` が render 用 snapshot を作る。
6. Visual: `BattleSceneBcuStatusEffectRenderPatch` -> `BcuStatusEffectManager` -> `BcuStatusEffectSpec` -> `effect:status` ZIP。projectile は `BattleWaveRuntimePatch` / `BattleSurgeRuntimePatch` -> `BattleWaveEffectLoader` -> `effect:wave` ZIP。
7. Post-damage: tick phase `knockback-death` で `KBRuntime.resolvePostDamage`。lethal/strengthen/zombie revive は wrapper chain に入る。kill money/bounty hook は未実装。

## Effect / animation / ZIP bundle 調査結果

- `effect:status`: `public/assets/bundles/effect/status-effects.zip`。builder は `scripts/build-bcu-status-effect-bundle.mjs`。現行 entries は `A_DOWN`, `A_E_DOWN`, `A_UP`, `A_E_UP`, `A_SLOW`, `A_E_SLOW`, `A_STOP`, `A_E_STOP`, `A_SHIELD`, `A_E_SHIELD`, `A_CURSE`, `A_E_CURSE`, `A_SEAL`, `A_E_SEAL`, `A_POISON`。`A_IMUATK` は未登録。
- `A_IMUATK`: BCU `Data.java` id 43、`Entity.AnimManager.getEff(P_IMUATK)`、`EffAnim.java` maps to `./org/battle/s7/skill_attack_invalid`。raw exists at `public/assets/bcu/000001/org/battle/s7/skill_attack_invalid.{mamodel,maanim}` with `skill007.{png,imgcut}`。`effect:wave` already contains raw entries under `all-skill-effects/000001/org/battle/s7/`, but actor-anchored status renderer cannot resolve a short status key until `BcuStatusEffectSpec`/status bundle or a status loader alias is extended.
- `effect:wave`: `public/assets/bundles/effect/wave.zip`。builder は `scripts/build-bcu-wave-effect-bundle.mjs`。aliases: `unit-wave`, `enemy-wave`, `unit-mini-wave`, `enemy-mini-wave`, `unit-surge`, `enemy-surge`, `unit-mini-surge`, `enemy-mini-surge`, `unit-blast`, `enemy-blast`。raw all-skill-effects also include barrier, warp, poison, curse, attack invalid, demon shield, summon, guard, metal strong, blast, recast。
- `effect:kbeff`: `public/assets/bundles/effect/kbeff.zip`。builder は `scripts/build-bcu-effect-bundle.mjs`。critical/kb/smoke 系。positive buff/status ではなく hit/KBEFF 系。
- barrier/demon shield raw assets are bundled in `effect:wave` raw tree (`s2`, `s14`) but current actor/base shield renderer lifetime and placement are not wired.
- `A_COUNTERSURGE` maps to `./org/battle/s18/skill_demonsummon`; raw exists in `effect:wave` all-skill-effects, but current counter-surge runtime/visual mapping is not proven complete.

## Ability / proc matrix

| Ability / proc | Holder source | Target / timing / numeric rule | JS parse location | JS runtime hook | Visual / asset / bundle | Status |
|---|---|---|---|---|---|---|
| めっぽう強い `AB_GOOD` | `Data.java AB_GOOD`; unit index 23 | shared target trait; damage multiplier and received-damage reduction in `EEnemy.getDamage`/`EUnit.getDamage`; pre-proc damage calc | `BcuCombatModel.parseUnitAbility` | `DamageAbilityResolver.resolve` | no separate BCU status visual found | `already-correct` |
| 打たれ強い `AB_RESIST` | `Data.java AB_RESIST`; unit index 29 | shared target trait; received damage reduction | `parseUnitAbility` | `DamageAbilityResolver.resolve` | no separate visual | `already-correct` |
| 超打たれ強い `AB_RESISTS` | `Data.java AB_RESISTS`; unit index 80 | shared target trait; stronger received damage reduction | `parseUnitAbility` | `DamageAbilityResolver.resolve` | no separate visual | `already-correct` |
| 超ダメージ `AB_MASSIVE` | `Data.java AB_MASSIVE`; unit index 30 | shared target trait; outgoing damage multiplier | `parseUnitAbility` | `DamageAbilityResolver.resolve` | no separate visual | `already-correct` |
| 極ダメージ `AB_MASSIVES` | `Data.java AB_MASSIVES`; unit index 81 | shared target trait; stronger outgoing damage multiplier | `parseUnitAbility` | `DamageAbilityResolver.resolve` | no separate visual | `already-correct` |
| ターゲット限定 `AB_ONLY` | `Data.java AB_ONLY`; unit index 32 | capture gate; actor only if trait-compatible; base can still be captured when no actor candidate per BCU | `parseUnitAbility`; event semantic via attack profile | base `BattleAttackResolver.captureTargets` has filter | no visual | `fact-complete`; current soulstrike direct replacement drops filter, needs Run 2 fix |
| メタル `AB_METALIC` | `Data.java AB_METALIC`; unit index 43; enemy trait metal column | damage gate caps non-crit damage to 1 | `parseUnitAbility`; enemy/unit traits | `DamageAbilityResolver.resolve` | no separate visual | `already-correct` |
| クリティカル `P_CRIT` | `Data.java P_CRIT`; unit index 31, enemy index 25 | damage gate; probability, metal bypass, damage multiplier | `parseUnitProc`, `parseEnemyProc` | `ProcResolver` + `DamageAbilityResolver` | critical KBEFF in `effect:kbeff`; current critical visual patch not imported in `main.js` | `fact-complete`; logic present, visual import/order still to verify before calling already-correct |
| メタルキラー `P_METALKILL` | `P_METALKILL`; unit index 112 | metal target; percent/max-hp style kill calculation in `Entity.damaged` | `parseUnitProc` | `DamageAbilityResolver.resolve` | BCU `s20/skill_metal_strong` exists in `effect:wave` raw tree; runtime visual not wired | `fact-complete`; logic hook present, visual alias needed if BCU shows it |
| 渾身の一撃 `P_SATK` | `P_SATK`; unit 82/83, enemy 75/76 | damage multiplier proc before final damage | `parseUnitProc`, `parseEnemyProc` as `strongAttack` | `DamageAbilityResolver.resolve` | BCU `A_STRONG` via `s6/strong_attack` in `effect:wave` raw tree; no runtime visual alias | `fact-complete`; logic present, visual alias pending |
| 城破壊 `P_ATKBASE` | `P_ATKBASE`; unit 34, enemy 26 | base target only; damage multiplier | `parseUnitProc`, `parseEnemyProc` | `DamageAbilityResolver.resolve` | no separate visual found | `already-correct` |
| 超生命体特効 `AB_BAKILL` | `AB_BAKILL`; unit index 97; enemy trait 94 baron | baron target; outgoing x1.6, incoming x0.7 | `parseUnitAbility`; enemy trait parse | `DamageAbilityResolver.resolve` | no separate visual | `already-correct` |
| 超獣特効 `P_BSTHUNT` damage | `Proc.BSTHUNT`; `P_BSTHUNT=54`; unit 105/106/107; enemy trait 101 beast | beast target; outgoing x2.5 in `EEnemy.getDamage`, incoming x0.6 in `EUnit.getDamage` | missing in `parseUnitProc`; `BCU_TRAITS.beast` exists | `DamageAbilityResolver.resolve` can apply both directions | no separate damage visual | `fact-complete` |
| 超獣特効 `P_BSTHUNT` attack-nullify branch | same as above | pre-damage; when attacker has beast trait and defender `BSTHUNT.active>0`, probability `prob`, duration `time`; status `status[P_BSTHUNT][0]` decrements each tick; rejects damage while active | missing in `parseUnitProc` | `BattleActor.takeDamage` outer pre-damage gate; status tick via `BattleActorProcStatusPatch`/snapshot | BCU uses `A_IMUATK`; raw `public/assets/bcu/000001/org/battle/s7/skill_attack_invalid.*`; bundle plan: extend `effect:status` or status loader alias from existing `effect:wave` raw copy, then rebuild `status-effects.zip` and manifest | `fact-complete` |
| 超賢者特効 `AB_SKILL` damage | `AB_SKILL`; unit index 111; enemy trait 104 sage | sage target; outgoing and incoming fixed hunter multipliers | `parseUnitAbility`; enemy trait parse | `DamageAbilityResolver.resolve` | no separate visual | `already-correct` for damage only |
| 超賢者特効 status resistance | `EEnemy.getResistValue`, `EUnit.getResistValue`; `SUPER_SAGE_RESIST_TYPE` | proc duration/prob resistance and bypass; timing during proc application | `parseUnitAbility` has flag | `BcuResistRuntime` exists but returns unresolved/implemented false | no separate visual | `fact-partial`; exact control flow known, JS resistance field mapping/runtime unresolved |
| 怪人特効 `AB_VKILL` | `AB_VKILL`; common ability bit; enemy trait 110 villain | villain target; outgoing x2.5, incoming x0.4 per Markdown and BCU constants | unit parser lacks direct source; combo/orb holder not parsed | `DamageAbilityResolver` supports if flag exists | no separate visual | `fact-partial`; local holder path for playable actors is combo/orb, not safely parsed |
| 魔女キラー `AB_WKILL` | `AB_WKILL`; unit index 53; enemy trait 48 witch | witch target; outgoing/incoming killer multipliers | `parseUnitAbility`; enemy trait parse | `DamageAbilityResolver.resolve` | no separate visual | `already-correct` |
| 使徒キラー `AB_EKILL` | `AB_EKILL`; unit index 77; enemy trait 71 eva | eva target; outgoing/incoming killer multipliers | `parseUnitAbility`; enemy trait parse | `DamageAbilityResolver.resolve` | no separate visual | `already-correct` |
| ふっとばす `P_KB` | `P_KB`; unit 24, enemy 20 | proc application; probability; knockback interrupt priority after damage gate | `parseUnitProc`, `parseEnemyProc` | `ProcResolver`, `BcuProcRuntime`, `BcuKnockback*` | KBEFF bundle for KB; no status visual | `already-correct` for current full proc path |
| 止める `P_STOP` | `P_STOP`; unit 25/26, enemy 21/22 | post-damage proc; duration; movement and attack timeline gate | `parseUnitProc`, `parseEnemyProc` | `ProcResolver`, `BcuProcRuntime`, `BattleActorProcStatusPatch`, `BattleScene.moveActorBcu` | `A_STOP`/`A_E_STOP` in `effect:status`; builder available | `already-correct` |
| 遅くする `P_SLOW` | `P_SLOW`; unit 27/28, enemy 23/24 | post-damage proc; duration; movement slow | `parseUnitProc`, `parseEnemyProc` | same proc/status runtime | `A_SLOW`/`A_E_SLOW` in `effect:status` | `already-correct` |
| 攻撃力ダウン `P_WEAK` | `P_WEAK`; unit 37/38/39, enemy 29/30/31 | post-damage proc; duration and percent; attack damage token | `parseUnitProc`, `parseEnemyProc` | `ProcResolver`, status patch, `DamageCalculator` weaken path | `A_DOWN`/`A_E_DOWN`; positive weak-up asset found but not needed for normal weaken | `already-correct` for normal weaken |
| 呪い `P_CURSE` | `P_CURSE`; unit 92/93, enemy 73/74 | post-damage proc; disables effect procs via sealed `getProc` equivalent | `parseUnitProc`, `parseEnemyProc` | `ProcResolver`, status patch | `A_CURSE`/`A_E_CURSE` in `effect:status` | `already-correct` for visible status; seal completeness still below |
| ワープ `P_WARP` | `P_WARP`; enemy 65/66/67/68 | post-damage proc; only if hit did not KB; remove from field, reappear at distance/time | `parseEnemyProc` | `ProcResolver` has pending only; `BcuProcRuntime` key exists; no full warp actor state | raw `s2/skill_warp*` in `effect:wave`; loader alias not wired | `fact-partial`; KB-gated warp state/lifetime not implemented |
| 毒撃 `P_POIATK` | `P_POIATK`; enemy 79/80 | post-damage proc; max HP percent extra damage; poison effect spawn | `parseEnemyProc` as `toxic` | `ProcResolver`, `BattleActorProcStatusPatch` | `A_POISON` in `effect:status`; raw `s8/skill_percentage_attack` in `effect:wave` | `already-correct` for current toxic path |
| 攻撃無効 `P_IMUATK` | `P_IMUATK`; unit 84/85, enemy 77/78 | pre-damage branch in `Entity.damaged`; probability/time; rejects damage and procs while active; status decrements each tick | missing in unit/enemy proc parser | `BattleActor.takeDamage` outer pre-damage gate; status snapshot/renderer | BCU `A_IMUATK`; raw `s7/skill_attack_invalid`; bundle plan as above | `fact-complete` |
| 攻撃力アップ `P_STRONG` | `P_STRONG`; unit 40/41, enemy 32/33 | post-damage/HP threshold; attack multiplier while active | `parseUnitProc`, `parseEnemyProc` | `BattleActorStrengthenLethalPatch`, `DamageCalculator` | `A_UP`/`A_E_UP` in `effect:status`; actor anchored | `already-correct` |
| 生き残る `P_LETHAL` | `P_LETHAL`; unit 42, enemy 34 | post-damage death gate; probability once; HP set to 1 | `parseUnitProc`, `parseEnemyProc` | `BattleActorStrengthenLethalPatch` | `A_SHIELD`/`A_E_SHIELD` in `effect:status` | `already-correct` |
| 撃破時お金アップ `P_BOUNTY` | `P_BOUNTY`; unit index 33; `EEnemy.kill` checks status `P_BOUNTY` | death/kill money; BCU doubles earned money once and resets if enemy survives | `parseUnitProc` exposes `bounty` | no dedicated reward patch, but `BattleActor.resolvePostDamage` stores `lastKilledBy` and `BattleScene` `knockback-death` phase has scene economy; enemy reward/drop exists | no separate visual found | `fact-complete`; safe hook is death bookkeeping + `BattleEconomy`, implementation still absent |
| 1回攻撃 `AB_GLASS` | `AB_GLASS`; unit index 58==2, enemy index 52==2 | after attack, disappear without normal death effect | `parseUnitAbility`, `parseEnemyAbility`; `BattleAttackTimeline.hasGlassAbility` | attack timeline finite-loop support; disappearance/post-attack hook needs explicit cleanup | Markdown says no ability icon and no ascension effect | `fact-complete`; current full disappearance behavior needs Run 2 audit/fix |
| 波動 `P_WAVE` | `P_WAVE`; unit 35/36, enemy 27/28 | projectile after captured hit; normal wave level and timing | `parseUnitProc`, `parseEnemyProc` | `BattleWaveRuntimePatch` | `effect:wave` `unit-wave`/`enemy-wave`; builder wired | `already-correct` |
| 小波動 `P_MINIWAVE` | mini flag unit 94 / enemy 86 | mini wave; 20% damage in BCU; shorter timing | `parseUnitProc`, `parseEnemyProc` | `BattleWaveRuntimePatch` | `effect:wave` `unit-mini-wave`/`enemy-mini-wave` | `already-correct` |
| 波動無効 / 波動ストッパー | `P_IMUWAVE`, `AB_WAVES`; unit 46/47, enemy 37/38 | wave damage/proc immunity; stopper visual `A_WAVE_STOP`; immunity visual `A_WAVE_INVALID` | `AB_WAVES` parsed; `P_IMUWAVE` parser incomplete for uppercase immunity runtime | `BcuProcImmunityPatch` expects fields; wave runtime stopper path present but full immunity parse/visual incomplete | raw `s0/wave_invalid`, `s0/wave_stop`; not in status bundle aliases | `fact-partial`; full immunity asset found but parser/runtime/visual mapping incomplete |
| 烈波 `P_VOLC` | `P_VOLC`; unit 86-89, enemy 81-84 | surge projectile; probability, level, random distance | `parseUnitProc`, `parseEnemyProc` | `BattleSurgeRuntimePatch` | `effect:wave` `unit-surge`/`enemy-surge` | `already-correct` |
| 小烈波 `P_MINIVOLC` | mini flag unit 108 / enemy 102 | mini surge; same source with mini flag | `parseUnitProc`, `parseEnemyProc` | `BattleSurgeRuntimePatch` | `effect:wave` `unit-mini-surge`/`enemy-mini-surge` | `already-correct` |
| 烈波無効 | `P_IMUVOLC`; unit 91, enemy 85 | surge damage/proc immunity | parser incomplete | `BcuProcImmunityPatch` / surge runtime has shape but no confirmed parser-to-runtime field | no separate visible effect confirmed beyond immunity effect search | `fact-partial` |
| 死亡時烈波 | `P_DEATHSURGE`; enemy 89/90/91/92 | death trigger; surge spawn | `parseEnemyProc` | no complete death-surge hook found in current runtime | `effect:wave` surge aliases available | `fact-partial`; death timing/hook not complete |
| 烈波カウンター `AB_CSUR` | `AB_CSUR`; unit 109, enemy 103 | when hit by surge, counter-surge spawn; BCU `A_COUNTERSURGE` | parsed as `counterSurge` | no full current counter runtime proven | raw `s18/skill_demonsummon` in `effect:wave` | `fact-partial` |
| 爆波 `P_BLAST` | `P_BLAST`; unit 113/114/115, enemy 106/107/108 | after captured hit; `ContBlast` at frames 10/20/30; damage 100/70/40%, lifetime 44 | `parseUnitProc`, `parseEnemyProc` | no blast runtime patch found; `EffectRuntime` marks blast unimplemented | `effect:wave` `unit-blast`/`enemy-blast`; builder wired | `fact-complete`; source/assets/hooks known, runtime to add |
| 爆波無効 `P_IMUBLAST` | `P_IMUBLAST`; unit 116, enemy 109 | blast damage/proc immunity | parser missing | no blast runtime yet; immunity depends on blast object meta | no separate visible effect confirmed | `fact-partial` |
| バリア | `P_BARRIER`; enemy index 64 | pre-damage shield gate; blocks until broken | `parseEnemyProc` | `BattleActorBarrierShieldPatch` | BCU `A_B`/`A_E_B`; raw `s2/barrier`; in `effect:wave` raw tree, not actor shield renderer | `fact-partial`; logic present, visual/lifetime placement incomplete |
| バリアブレイカー | `P_BREAK`; unit 70 | barrier gate breaker probability | `parseUnitProc` | `ProcResolver` pending + barrier patch consumes | barrier break raw in `s2`; visual not wired | `fact-partial`; visual incomplete |
| 悪魔シールド | `P_DEMONSHIELD`; enemy 87/88 | shield HP/regeneration; damage absorption | `parseEnemyProc` | `BattleActorBarrierShieldPatch` | raw `s14/skill_demonshield*` in `effect:wave` raw tree | `fact-partial`; logic present, visual/regen timing audit needed |
| シールドブレイカー | `P_SHIELDBREAK`; unit 95 | demon shield pierce probability | `parseUnitProc` | `ProcResolver` pending + shield patch consumes | demon shield breaker raw exists | `fact-partial`; visual incomplete |
| ゾンビキラー `AB_ZKILL` | `AB_ZKILL`; unit index 52 | kill gate; suppress zombie revive | `parseUnitAbility` | `BattleActorZombieRevivePatch` | no separate visual required by BCU source found | `already-correct` |
| 魂攻撃 `AB_CKILL` | `AB_CKILL`; unit index 98 | corpse target condition; cancels zombie revive | `parseUnitAbility` | `BattleSoulstrikePatch` takeDamage; capture override has target-only regression | no separate visual required by inspected source | `fact-complete`; behavior hook present, capture integration needs Run 2 fix |
| 蘇生 | `P_REVIVE`; enemy 45/46/47 | death/post-damage; corpse state and revive after time with HP percent | `parseEnemyProc` | `BattleActorZombieRevivePatch` | no separate visual confirmed in current source pass | `already-correct` for current revive path |
| 地中移動 | `P_BURROW`; enemy 43/44 | movement/capture state; disappear and reappear by distance/count | `parseEnemyProc` | no complete burrow movement state found | raw zombie movement assets not fully mapped | `fact-partial` |
| 召喚 | summon-related common effects and Markdown | spawn auxiliary actor/effect; exact holder/data path not proven in local JS | not parsed | no runtime hook | raw `s17/s18/skill_demonsummon*` in `effect:wave` raw tree | `fact-partial` |
| 精霊 / spirit | `P_SPIRIT`; unit index 110 | `EUnit.damaged` spirit sets `P_IMUATK` max and visual; shockwave immunity noted in Markdown | parser missing | no actor role/runtime hook | uses `A_IMUATK`; raw found | `fact-partial`; holder/runtime identity not enough |
| freeze/slow/weaken/kb/warp/curse/toxic immunities | `P_IMUKB`, `P_IMUSTOP`, `P_IMUSLOW`, `P_IMUWEAK`, `P_IMUWARP`, `P_IMUCURSE`, `P_IMUPOIATK`; unit/enemy indexes listed above | proc application gate; full immunity shows invalid effect | parser incomplete/inconsistent uppercase fields | `BcuProcImmunityPatch` full-only path exists but lacks parser coverage and visual | Markdown says blue round effect; BCU `A_EFF_INV`/invalid effects need exact local mapping | `fact-partial` |
| partial resistances | BCU `getResistValue`, sage hunter, talent/orb fields | duration/prob reduction; additive/multiplicative rules depend on source | not safely parsed | `BcuResistRuntime` explicitly unresolved | no distinct visual | `fact-partial` |

## `fact-complete` rows to implement in Run 2

- `P_BSTHUNT` parse and damage: unit indexes 105/106/107, beast trait 101, x2.5 outgoing, x0.6 incoming.
- `P_BSTHUNT` attack-nullify branch: same status lifetime as `status[P_BSTHUNT][0]`; `A_IMUATK` visual remains while `P_IMUATK` or `P_BSTHUNT` status active.
- `P_IMUATK`: parse unit 84/85 and enemy 77/78; implement pre-damage attack-nullify gate and actor-anchored `A_IMUATK`.
- `AB_ONLY` capture regression under `BattleSoulstrikePatch`: preserve base target-only filtering while allowing soulstrike corpse targets.
- `P_BOUNTY`: award kill money using existing `BattleEconomy` and enemy `reward/dropAmount`, with BCU reset semantics if target survives.
- `AB_GLASS`: audit/finish post-attack disappearance without normal death effect.
- `P_BLAST`: runtime object using existing `P_BLAST` parser, BCU timing, and existing `effect:wave` blast aliases.
- `P_METALKILL`, `P_SATK`, `P_CRIT` visuals: logic is present enough; visual parity requires importing/wiring existing raw or bundle aliases where BCU visibly spawns an effect.
- `AB_CKILL`: fix target capture integration together with `AB_ONLY`.

## Deferred / `fact-partial` rows and blockers

- `AB_SKILL` status resistance and sage bypass: BCU control flow is known, but `BcuResistRuntime` field mapping and current JS proc duration/prob interaction are unresolved.
- `AB_VKILL`: BCU bit/trait/damage rule known, but playable holder source appears combo/orb-based locally; no safe parser path found.
- `P_WARP`: exact BCU behavior known, raw warp assets found, but JS lacks full actor removed-from-field/reappearance state and KB-gated application.
- Full proc/wave/surge/blast immunities: local flags and visuals are found in BCU, but parser names, invalid-effect mapping, and runtime meta are incomplete.
- Barrier/demon shield and breakers: logic gates exist, raw assets are bundled, but actor/base-attached visual lifetime/placement and shield regeneration visual parity are not wired.
- Death surge and counter surge: BCU source/assets are present, but JS death/counter trigger hooks are not fully proven.
- Burrow, summon, spirit: holder/runtime identity and movement/spawn state are not sufficiently mapped.
- Partial resistances: exact source fields beyond sage hunter and current runtime integration remain unresolved.

## Run 2 で変更すべきファイル

- `js/battle/BcuCombatModel.js`: parse `P_BSTHUNT`, `P_IMUATK`, missing immunity flags, and any exact complete fields.
- `js/battle/AbilityModel.js`: expose semantic labels for beast hunter, attack nullify, and complete blast/status keys.
- `js/battle/DamageAbilityResolver.js`: apply `P_BSTHUNT` x2.5/x0.6 using `BCU_TRAITS.beast`; remove stale omission note.
- `js/battle/BattleActorAttackNullifyPatch.js` or equivalent new focused patch: pre-damage `P_IMUATK`/`P_BSTHUNT` gate, status lifetime, active damage rejection.
- `js/battle/BattleActorProcStatusPatch.js`, `BcuStatusSnapshot.js`, `BcuStatusIconResolver.js`, `BcuStatusEffectSpec.js`: status storage/snapshot/render keys for attack nullify.
- `scripts/build-bcu-status-effect-bundle.mjs` and generated `public/assets/bundles/effect/status-effects.zip` / generated manifest or inventory: add `A_IMUATK` if using the actor-anchored status bundle.
- `js/battle/BattleSoulstrikePatch.js`: preserve `AB_ONLY` trait filtering in capture.
- `js/battle/BattleBountyRuntimePatch.js` or existing post-damage scene hook: implement `P_BOUNTY`.
- `js/battle/BattleBlastRuntimePatch.js` plus `js/main.js`: add blast runtime import only after the wrapper order is documented.

## Run 2 implementation order

1. Parser-only changes for `P_BSTHUNT`, `P_IMUATK`, and exact complete fields; run `node --check`.
2. `P_BSTHUNT` damage multipliers in `DamageAbilityResolver`; add focused static/unit checks.
3. Attack-nullify status gate and `A_IMUATK` actor visual; extend status bundle builder and rebuild ZIP/manifest.
4. Fix `BattleSoulstrikePatch` capture to preserve `AB_ONLY`; verify corpse targeting and target-only cases.
5. Implement `P_BOUNTY` kill money after post-damage death bookkeeping.
6. Implement/verify `AB_GLASS` post-attack disappearance.
7. Implement `P_BLAST` runtime using existing `effect:wave` aliases.
8. Update this matrix with implemented rows and all command results.

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

## Run 1 verification commands

These are terminal-only checks; no browser test is required for this analysis pass.

```bash
node --check js/battle/BcuCombatModel.js
node --check js/battle/DamageAbilityResolver.js
node --check js/battle/ProcResolver.js
node --check js/main.js
node --check scripts/build-bcu-status-effect-bundle.mjs
node --check scripts/build-bcu-wave-effect-bundle.mjs
node --check scripts/build-bcu-effect-bundle.mjs
unzip -l public/assets/bundles/effect/status-effects.zip
unzip -l public/assets/bundles/effect/wave.zip
```

Run 1 result:

- `node --check js/battle/BcuCombatModel.js`: pass.
- `node --check js/battle/DamageAbilityResolver.js`: pass.
- `node --check js/battle/ProcResolver.js`: pass.
- `node --check js/main.js`: pass.
- `node --check scripts/build-bcu-status-effect-bundle.mjs`: pass.
- `node --check scripts/build-bcu-wave-effect-bundle.mjs`: pass.
- `node --check scripts/build-bcu-effect-bundle.mjs`: pass.
- `unzip -l public/assets/bundles/effect/status-effects.zip`: pass; 60 files; no `A_IMUATK/*` entries.
- `unzip -l public/assets/bundles/effect/wave.zip`: pass; 203 files; includes `all-skill-effects/000001/org/battle/s7/skill_attack_invalid.*`, `unit-blast/*`, and `enemy-blast/*`.

## Validation limits

- BCU extraction and source search were local only; no external source was used.
- Browser rendering was not run by request. The document only claims loader/bundle evidence from code and ZIP entries, not visual pixel validation.
- `already-correct` means current JS matches the inspected local BCU behavior for the scoped logic and required visible effect found in this pass. Rows marked `fact-complete` are implementable in Run 2 but not yet current runtime parity.

## Rollback plan

- Run 1 rollback: revert only `docs/ability-logic/fact-only-ability-parity-matrix.md`.
- Run 2 rollback: keep parser, runtime, bundle, generated manifest, and matrix updates in one commit; if any complete row fails verification, revert that commit or split by ability before merge. Do not hand-edit ZIP files; always restore/rebuild them through the builder scripts.
