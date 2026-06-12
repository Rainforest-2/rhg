# BCU evidence extraction pass 2026-06-04

## Scope

- docs-only evidence extraction.
- no runtime implementation.
- no JS/script/assets changes.
- no ZIP or generated manifest rebuild.

## Source roots inspected

| Source | Path | Status |
|---|---|---|
| BCU common | `/tmp/bcu-ref/common/BCU_java_util_common-ef840238e4700eb4b8eb57b4446633e465f4edd5` | inspected |
| BCU PC | searched as `references/bcu/BCU-java-PC-slow_kotlin.zip`, `BCU-java-PC-slow_kotlin.zip`, and `find . -maxdepth 2 -type f -name '*BCU*zip'` | missing |
| BCU Android | `/tmp/bcu-ref/android/BCU_Android-master` | inspected |
| rhgrive2/game JS | `/workspaces/game/js`, `/workspaces/game/scripts` | inspected |
| effect bundles | `public/assets/bundles/effect/{status-effects,wave,kbeff,soul}.zip` | inspected with `unzip -l` |

## Commands run

```bash
git status --short
git rev-parse HEAD
git log --oneline -20
find docs/ability-logic -type f
rg -n "partial|blocked|parsed-only|human-visual-review-needed|fact-partial|TODO|blocker|unknown|not proven|manual visual" docs/ability-logic
find references/bcu -maxdepth 2 -type f
find . -maxdepth 2 -type f -name '*BCU*zip'
mkdir -p /tmp/bcu-ref
python3 - <<'PY'
import zipfile, pathlib, shutil
candidates = [
    ('references/bcu/BCU_java_util_common.zip', '/tmp/bcu-ref/common'),
    ('references/bcu/BCU_Android-master.zip', '/tmp/bcu-ref/android'),
    ('references/bcu/BCU-java-PC-slow_kotlin.zip', '/tmp/bcu-ref/pc'),
    ('BCU_java_util_common-ef840238e4700eb4b8eb57b4446633e465f4edd5.zip', '/tmp/bcu-ref/common'),
    ('BCU_Android-master.zip', '/tmp/bcu-ref/android'),
    ('BCU-java-PC-slow_kotlin.zip', '/tmp/bcu-ref/pc'),
]
for z, out in candidates:
    p = pathlib.Path(z)
    if not p.exists():
        continue
    o = pathlib.Path(out)
    if o.exists():
        shutil.rmtree(o)
    o.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(p) as f:
        f.extractall(o)
    print('extracted', p, '->', o)
PY
find /tmp/bcu-ref/common -path '*battle/entity/Entity.java' -o -path '*battle/data/DataUnit.java' -o -path '*battle/data/DataEnemy.java' -o -path '*util/Data.java'
find /tmp/bcu-ref/android -path '*proc_jp.json' -o -path '*ability*json' -o -path '*trait*json' -o -path '*status*json'
find /tmp/bcu-ref/common -path '*EffAnim.java' -o -path '*Soul.java' -o -path '*DemonSoul.java'
rg -n "BURROW|REVIVE|ZKILL|CKILL|DEATHSURGE|SPIRIT|SUMMON|activeGuard|targetForms|Orb|Treasure|Combo|AB_SKILL|getResistValue|P_IMU|IMU|GUARD|BARRIER|DEMONSHIELD|SHIELDBREAK|P_DELAY|P_BOUNTY|P_GLASS|AB_GLASS|P_STRONG|P_LETHAL|P_POIATK|P_SATK|P_METALKILL|P_BLAST|P_WAVE|P_VOLC" /tmp/bcu-ref/common/BCU_java_util_common-ef840238e4700eb4b8eb57b4446633e465f4edd5/battle /tmp/bcu-ref/common/BCU_java_util_common-ef840238e4700eb4b8eb57b4446633e465f4edd5/util
rg -n "parseUnit|parseEnemy|parse.*Proc|parse.*Ability|DamageAbilityResolver|DamageCalculator|ProcResolver|queueAttackDamage|takeDamage|resolvePostDamage|applyBcuProc|captureTargets|spawn.*Effect|Bcu.*Runtime|burrow|summon|spirit|guard|targetForms|orb|combo|treasure|resist|immunity" js scripts
rg -n "activeGuard|A_E_GUARD|GUARD_HOLD|guardBreak|guard" /tmp/bcu-ref/common/BCU_java_util_common-ef840238e4700eb4b8eb57b4446633e465f4edd5/battle /tmp/bcu-ref/common/BCU_java_util_common-ef840238e4700eb4b8eb57b4446633e465f4edd5/util
rg -n "spiritCooldown|spiritSummoned|summonerSummoned|SPIRIT_SUMMON|KillMode\\.SPIRIT|isSpirit|SPIRIT" /tmp/bcu-ref/common/BCU_java_util_common-ef840238e4700eb4b8eb57b4446633e465f4edd5/battle /tmp/bcu-ref/common/BCU_java_util_common-ef840238e4700eb4b8eb57b4446633e465f4edd5/util
unzip -l public/assets/bundles/effect/status-effects.zip
unzip -l public/assets/bundles/effect/wave.zip
unzip -l public/assets/bundles/effect/kbeff.zip
unzip -l public/assets/bundles/effect/soul.zip
node scripts/check-bcu-ability-parity-safe-suite.mjs
node scripts/check-bcu-parser-indexes.mjs
node scripts/check-projectile-damage-parity.mjs
node scripts/check-proc-immunity-resistance-parity.mjs
node scripts/check-effect-bundle-aliases.mjs
node scripts/check-effect-coordinate-traces.mjs
node scripts/check-bcu-barrier-shield-effect-parity.mjs
node scripts/check-bcu-demon-shield-regen-timing.mjs
node scripts/check-bcu-death-animation-parity.mjs
node scripts/check-bcu-warp-lifecycle-parity.mjs
node scripts/check-bcu-delay-runtime.mjs
node scripts/check-ability-partial-blockers.mjs
```

## Evidence matrix

| Area | BCU holder source | BCU runtime owner | Timing/order | Formula | Visual/effect | JS current state | Existing tests | Missing tests | Implementation readiness | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| damage families: strong/massive/resistant/insane/base destroyer/metal/killer family | `DataUnit` indexes 23/29/30/34/43/52/53/77/80/81/97/111/112; `DataEnemy` traits and base flag; `EUnit.getAbi` combo `C_VKILL` | `EEnemy.getDamage`, `EUnit.getDamage`, `Entity.critCalc`, `Entity.damaged` | after raw attack and strengthen/weaken, before final damage storage and proc application | Java `(int)` truncation after each family; fruit/treasure/combo/orb/talent slots are in `BasisLU`, `Treasure`, `EUnit.OrbHandler`, `AtkModelUnit`, `PCoin` | critical, strongAttack, metalKiller have `EAnimCont(..., -75f)`; most damage families have no separate visual | `DamageAbilityResolver` covers core CSV and fixed killer paths but explicitly omits orbs, combos, full targetForms, barrier/shield, sage status-resistance scope | safe suite, projectile, proc immunity checks OK | exact combo/orb/treasure/talent fixture tests for every affected family; AB_VKILL holder tests | needs-test-first | Existing resolver is not enough to mark external modifier rows code-complete. |
| attack capture: multi-hit/area/single/LD/omni/target only/base/corpse | `DataUnit/DataEnemy` raw attack arrays, `AB_ONLY`, `AB_CKILL`; `AtkModelEntity.inRange`; `AttackSimple.capture` | `AttackSimple.capture`, `AttackSimple.excuse`, `BattleAttackResolver.captureTargets` equivalent | capture before damage/proc; single chooses front candidate; `AB_CKILL` expands touch to `TCH_CORPSE` | range uses BCU entity position and BCU point intervals; LD/omni use short/long points | hit smoke only | `BattleAttackTimeline`, `BattleAttackResolver`, `BattleSoulstrikePatch`, and `BattleActorBcuBurrowPatch` exist | parser/projectile/soulstrike/burrow checks OK | BCU fixtures for multi-hit attack arrays, base fallback, targetForms | needs-test-first | Burrow underground and zombie corpse targetability are now covered; broad capture parity still needs multi-hit/base/targetForms fixtures. |
| projectiles: wave/mini-wave/surge/mini-surge/blast/counter/death surge | `P_WAVE`, `MINIWAVE`, `VOLC`, `MINIVOLC`, `P_BLAST`, `AB_CSUR`, `DEATHSURGE`, `MINIDEATHSURGE` holders | `AttackSimple.excuse`, `AttackWave`, `AttackVolcano`, `AttackBlast`, `ContWaveDef`, `ContVolcano`, `ContBlast`, `SurgeSummoner`, `AtkModelEntity.getDeathSurge` | spawned after accepted hit; projectile object captures and damages later; death surge from soul frame 21 | mini-wave/mini-surge 20%; blast 100/70/40 bands; surge/death surge random start range; Java truncation in target damage | `EffAnim` wave/surge/blast/counter-surge mappings; ZIP aliases present | wave/surge/blast runtime and traces exist; counter-surge queue exists; death surge trigger exists | projectile/effect/death checks OK | full counter-surge damage/capture test; full death-surge zombie corpse cleanup and mini-death-surge split test | needs-test-first | Direct projectile families are human-visual-review-needed; death/counter interactions remain partial. |
| status/proc/immunity/resistance | `DataUnit` full IMU indexes 46/48/49/50/51/75/79/90/91/116; `DataEnemy` 37/39/40/41/42/70/85/105/109; `Proc.IMUAD` custom holders; `EUnit.processAbilityOrbs`; combo `C_IMUWAVE/C_IMUVOLC` | `Entity.processProcs`, `EUnit.getResistValue`, `EEnemy.getResistValue`, `BcuProcImmunityPatch` equivalent | after damage accepted and guard path; full immunity produces invalid effect; partial resistance adjusts duration/distance/percent | `1 - procResist / 100`; sage enemy adds 70% unless attacker has `AB_SKILL`; unit `AB_SKILL` vs sage source multiplies by 0.3; fruit modifies duration and distance | invalid uses `anim.getEff(INV)` / `anim.getEff(P_WAVE)`; status icons use `AnimManager.getEff/checkEff/drawEff` | `BcuResistRuntime` centralizes supported field/sage math; talent/orb sources are unsupportedSources; status icons exist for core rows | proc immunity and coordinate checks OK | orb/talent/PCoin resistance holder tests; invalid visual timing tests for every full immunity family | needs-test-first | `IMUPOIATK` enemy CSV holder negative evidence remains: no direct `DataEnemy` full-immunity column found. |
| guard/lifecycle: barrier/demon shield/base guard | `DataEnemy` barrier 64, demon shield 87/88; `DataUnit` breaker 70/95; base guard in `StageBasis.activeGuard` and `ECastle.guard` | `Entity.damaged`, `Entity.postUpdate`, `KBManager.updateKB`, `StageBasis.update/checkGuard`, `ECastle.damaged/updateAnimation/guardBreak` | barrier/shield gates before HP damage/procs; base guard blocks base damage in postUpdate while `activeGuard == 1`; guard breaks after boss condition clears | demon shield regen `(int)(maxShield * regen * shieldMagnification / 100.0)`; base guard has no HP reduction while active | barrier/demon shield aliases present; base guard alias `enemy-wave-guard/*` present | barrier/demon shield actor runtime tested; base/castle guard state and damage gate now implemented | barrier/shield/guard tests OK | manual visual review for exact guard appearance | human-visual-review-needed | Base guard is `BattleBase`/`BattleScene` stage state, not actor proc status. |
| zombie corpse/soulstrike/zombie killer/revive/death soul | `DataEnemy` revive 45/46/47, death soul 54, death surge 89-92; `DataUnit` `AB_ZKILL` 52, `AB_CKILL` 98 | `Entity.ZombX`, `Entity.touchable`, `Entity.getTouch`, `preKill`, `updateRevive`, `AtkModelEntity.getDeathSurge` | `postUpdate` calls `zx.postUpdate`; last-breathe calls `zx.prekill`; corpse touch after `REVIVE_SHOW_TIME`; soulstrike touch includes `TCH_CORPSE`; death surge at demon soul frame 21 | revive HP `maxH * health / 100`; revive time min across applicable revivers plus zombie revive anim; zombie killer blocks unless `imu_zkill` | `A_ZOMBIE/A_U_ZOMBIE`, `effect:soul`, demon soul; revive visual not fully traced | corpse targetability window, soulstrike cancellation, ZK suppression, revive HP, and death-surge single-spawn now implemented | death/warp/zombie checks OK | revive visual trace; mini-death-surge split; extra reviver timer/range fixtures | partial | BCU `REVIVE_SHOW_TIME` split is now deterministic; remaining gaps are visual and custom/mini holder coverage. |
| burrow | `DataEnemy` indexes 43 count and 44 `/4` distance; custom summon `anim_type == 3` can initialize burrow state | `Entity.update/update2`, `startBurrow`, `updateBurrow`, `touchable`, `updateMove` | starts in `update2` only when touching, not frozen, not spawned burrow skip, base still ahead; `kbTime -2/-3/-4` for down/move/up | count decremented on start; `bdist = BURROW.dis`; underground moves by normal move until distance consumed or base reached; distance is BCU units `/4` | entity animation `BURROW_DOWN/MOVE/UP`; no ZIP micro-effect proven | `BcuBurrowLifecycleRuntime`, `BattleActorBcuBurrowPatch`, and capture targetability hook implemented | burrow lifecycle check OK | exact human/browser actor animation review if desired | code-complete-candidate | `ProcResolver` still has no burrow row because BCU owner is entity lifecycle, not attack proc catalog. |
| summon | no direct normal unit/enemy CSV holder; `Proc.SUMMON` proc-object/custom attack holder in `AtkModelEntity` and `CustomEnemy`; `IMUSUMMON` target proc | `AtkModelEntity.setProc/invokeLater`, `AtkModelUnit.summon`, `AtkModelEnemy.summon`, `Entity.setSummon`, `EntCont` | immediate summon for non-hit/kill config; deferred token after hit/kill in `Entity.postUpdate`; can be resisted by `IMUSUMMON` | random distance inclusive `dis..max_dis`; unit-level and enemy-magnification inheritance; level/magnification scaled by `(100-resist)/100`; layer fallback to current/spawn layer; optional same_health/bond_hp | counter-surge/summon-adjacent source paths in `wave.zip`; no stable summon runtime alias | explicit proc-object runtime implemented in `BcuSummonRuntime`; normal CSV parser remains unchanged | `check-bcu-summon-runtime-parity.mjs` | automatic BCU custom/proc-object loader, source-backed stage allow/group semantics, exact `anim_type` appearance review | partial | Not safe to implement from BC CSV parser alone. |
| spirit | `DataUnit` index 110 `SPIRIT.id`; `LineUp` builds spirit form; no enemy holder | `StageBasis.act_spawn`, `StageBasis.update`, `StageBasis` flags `spiritCooldown/summonerSummoned/spiritSummoned`, `EUnit.isSpirit`, `EUnit.damaged/added/update` | normal summoner spawn sets cooldown 15; manual spawn after cooldown creates one spirit per living summoner; spirit starts attack on added and self-kills when attack ends | spawn position `max(ebase.pos + range, min(summoner.pos + 150, ubase.pos))`; damage rejected and `P_IMUATK` effect shown | uses normal unit animation plus `A_IMUATK`; no separate spirit ZIP alias proven | parser and production/spirit lifecycle runtime implemented | spirit lifecycle check OK | manual visual review of exact actor/A_IMUATK appearance | human-visual-review-needed | Owner is `StageBasis`/production, not proc status. |
| combo/orb/treasure/talent/PCoin | `LineUp`, `BasisLU.getInc`, `ELineUp`, `Treasure`, `EUnit.OrbHandler`, `PCoin`, `AtkModelUnit` | battle basis and entity construction, not per-hit parser only | attack construction and getDamage/getResistValue | combo/talent applied before or inside `getDamage`; orb attack adds flat percent of raw attack; orb resistance modifies incoming damage; ability orbs mutate proc IMU fields at spawn | no general visual | JS resolver omits or approximates these sources | partial blocker check asserts omissions | deterministic source loaders and fixtures per family | needs-holder-source-confirmation | This is the main blocker for damage family code-complete. |
| status/effect visual ordering | `Entity.AnimManager.getEff/checkEff/drawEff`; `EffAnim` mappings | actor anim manager and `basis.lea` effect list | status effect set at proc acceptance; `checkEff` removes when status counter hits 0; priority effects draw at actor layer/offset | y offsets: proc-hit `-75f`, delay `-50f`, barrier/shield actor priority y `-25*siz`; status branch chooses buff/debuff variants | ZIP aliases proven for status/wave/kbeff/soul; no loose runtime fallback | status manager/positioner/effect traces exist for covered rows | effect bundle/coordinate checks OK | positive weaken/strengthen branch, bounty money, zombie revive, knockback smoke visual parity tests | needs-test-first | Appearance still human-visual-review-needed where deterministic traces pass. |

## Detailed evidence by area

### Damage / modifier families

#### 1. BCU holder

- `DataUnit.java`: unit CSV indexes map `AB_GOOD` 23, `AB_RESIST` 29, `AB_MASSIVE` 30, `P_ATKBASE` 34, `AB_METALIC` 43, `AB_ZKILL` 52, `AB_WKILL` 53, `AB_EKILL` 77, `AB_RESISTS` 80, `AB_MASSIVES` 81, `AB_BAKILL` 97, `AB_CKILL` 98, `AB_CSUR` 109, `SPIRIT.id` 110, `AB_SKILL` 111, `P_METALKILL` 112, `P_BLAST` 113-115, `P_IMUBLAST` 116.
- `DataEnemy.java`: enemy trait columns include metal 15, witch 48, base 49, eva 71, relic 72, demon 93, baron 94, beast 101, sage 104, villain 110. Enemy direct holders include `P_ATKBASE` 26, `P_SATK` 75/76, `P_POIATK` 79/80, `P_BLAST` 106-108.
- `EUnit.getAbi` adds `AB_VKILL` from combo `C_VKILL`, not from the inspected `DataUnit` CSV constructor. This supersedes older wording that treated `AB_VKILL` as a direct unit parser row.
- `AtkModelUnit` applies PCoin/talent attack multiplication and combo `C_ATK` during attack model construction.
- `EUnit.processAbilityOrbs` mutates resistance and special proc holders from orbs at unit construction.

#### 2. BCU runtime owner

- Outgoing unit-to-enemy damage: `EEnemy.getDamage`.
- Incoming enemy-to-unit damage: `EUnit.getDamage`.
- Critical/metal/strongAttack order: `Entity.critCalc`.
- Metal killer add-damage and proc-hit visuals: `Entity.damaged`.
- Combo/treasure/orb access: `BasisLU.getInc`, `Treasure`, `EUnit.OrbHandler`, `PCoin`, `LineUp`.

#### 3. BCU ordering

- `AttackSimple` carries raw attack and proc data.
- Damage family math occurs in `getDamage` before `Entity.damaged` stores `damage += dmg`.
- `Entity.damaged` applies projectile damage guards, attack-nullify/dodge, damage cut/cap, barrier, metal killer, demon shield, then stores damage and calls `processProcs` only if proc is still allowed.
- `postUpdate` subtracts accumulated damage, then checks strengthen, lethal, self-destruct glass, zombie revive, and kill counting.

#### 4. BCU formula

- Java casts each family result to `int`, so JS tests must assert truncation at each step.
- `AB_GOOD` and `AB_MASSIVE` use fruit/treasure and combo/orb values; JS currently passes comboInc `0`.
- `AB_SKILL` damage constants are applied in `EEnemy.getDamage` / `EUnit.getDamage`; status resistance is in `getResistValue`.
- `AB_VKILL` is added by `EUnit.getAbi` from combo state and uses `VILLAIN_KILLER_ATTACK` / `VILLAIN_KILLER_RESIST`.

#### 5. BCU visual/effect

- Most damage families do not have a standalone effect.
- `P_CRIT`, `P_SATK`, and `P_METALKILL` spawn `EAnimCont(pos, currentLayer, ..., -75f)` from `Entity.damaged` or base damage.
- ZIP evidence: `kbeff.zip` has `critical.*`; `wave.zip` has `strong-attack/*` and `metal-killer/*`.

#### 6. JS implementation

- Parser: `BcuCombatModel.parseUnitAbilities`, `parseUnitProc`, `parseEnemyProc`.
- Model/runtime: `DamageAbilityResolver`, `DamageCalculator`, `ProcResolver`, `BattleCriticalEffectPatch`, `BattleProcHitEffectPatch`.
- Mismatch: `DamageAbilityResolver.implementationStatus.omittedRuntimeState` lists `orbs`, `combos`, `barrier/shield gating`, `wave/surge/volcano object damage class dispatch`, `full Trait targetForms special cases`, and `sage status resistance`.

#### 7. Readiness

- ready-for-implementation: external modifier fixtures and source loaders, not a broad resolver rewrite.
- exact implementation hook: `DamageAbilityResolver` plus unit spawn/model construction data source for combo/orb/talent/PCoin.
- tests to add: `check-bcu-external-damage-modifiers.mjs` with strong/massive/resistant/insane/AB_SKILL/AB_VKILL/metal killer cases.

### Attack model / capture

#### 1. BCU holder

- Multi-hit and LD/omni values come from raw attack arrays and `AtkModelEntity.inRange`.
- `AB_ONLY` is unit index 32 and `AB_CKILL` is unit index 98.
- `DataUnit` sets `touch |= TCH_CORPSE` when `AB_CKILL` is present.

#### 2. BCU runtime owner

- `AttackSimple.capture` owns capture.
- `Entity.traitCompatible` handles target trait and special `Trait.targetForms` branches.
- `Entity.getTouch` adds `TCH_CORPSE` when `AB_CKILL` is active.
- `Entity.touchable` reports normal, corpse, underground, KB, soul, enter, and warp/burrow states.

#### 3. BCU ordering

- Capture happens before damage.
- Corpse targetability requires attacker touch mask to include `TCH_CORPSE`.
- Burrow states `kbTime == -2/-3/-4` return `TCH_UG` variations; hidden underground capture must not be treated as normal alive targetability.

#### 4. BCU formula

- Normal interval uses `pos + range * dire` and `pos - width * dire`.
- LD/omni uses short and long points.
- Single target selection is frontmost candidate after capture.

#### 5. BCU visual/effect

- No capture visual.
- Hit smoke is later in `Entity.damaged`.

#### 6. JS implementation

- `BattleAttackResolver` has BCU interval helpers.
- `BattleSoulstrikePatch` overrides corpse targetability and re-applies `targetOnly`.
- Missing: burrow/warp/corpse targetability fixture coverage across all capture modes.

#### 7. Readiness

- ready-for-implementation: needs-test-first.
- exact implementation hook: `BattleAttackResolver.captureTargets`, `BattleActor.isTargetable/isTouchable`, future burrow runtime.
- tests to add: capture table for normal/corpse/soulstrike/burrow/warp/base fallback.

### Projectile families

#### 1. BCU holder

- `DataUnit`: wave 35/36 or mini-wave flag 94; surge 86-89 or mini-surge flag 108; `AB_CSUR` 109; blast 113-115.
- `DataEnemy`: wave 27/28 or mini-wave flag 86; surge 81-84 or mini-surge flag 102; `AB_CSUR` 103; death surge 89-92; blast 106-108.

#### 2. BCU runtime owner

- `AttackSimple.excuse` spawns `ContWaveDef`, `ContVolcano`, or `ContBlast`.
- `AttackWave`, `AttackVolcano`, and `AttackBlast` perform their own target capture and damage.
- `AtkModelEntity.getDeathSurge` builds normal or mini death surge and calls `ContVolcano`.
- `SurgeSummoner` handles counter-surge delay and spawn.

#### 3. BCU ordering

- Projectile spawn is after accepted direct hit proc roll.
- Projectile damage is a new attack object and must resolve per target.
- Death surge is tied to death/demon-soul animation timing, not normal direct-hit proc timing.

#### 4. BCU formula

- Mini-wave and mini-surge use 20% multiplier.
- Blast uses `ContBlast` level bands at 10/20/30 frame windows and falloff.
- Death surge random start uses `dis_0 + random * (dis_1 - dis_0)`.

#### 5. BCU visual/effect

- `EffAnim`: `A_WAVE`, `A_E_WAVE`, `A_MINIWAVE`, `A_E_MINIWAVE`, `A_VOLC`, `A_E_VOLC`, `A_MINIVOLC`, `A_E_MINIVOLC`, `A_BLAST`, `A_E_BLAST`, `A_COUNTERSURGE`, `A_E_COUNTERSURGE`.
- ZIP evidence: `wave.zip` stable aliases for unit/enemy wave, mini-wave, surge, mini-surge, blast, counter-surge.

#### 6. JS implementation

- Runtime hooks: `BattleWaveRuntimePatch`, `BattleSurgeRuntimePatch`, `BattleBlastRuntimePatch`, `BattleBcuPriorityEffectRuntimePatch`, `BcuDeathAnimationRuntime`.
- Tests pass for projectile raw damage and coordinate traces.
- Missing: full counter-surge hit/capture regression and full death-surge zombie interaction regression.

#### 7. Readiness

- ready-for-implementation: counter-surge/death-surge tests first.
- exact implementation hook: counter-surge in `BattleBcuPriorityEffectRuntimePatch`; death surge in `BcuDeathAnimationRuntime` and surge queue path.
- tests to add: `check-bcu-counter-surge-capture-parity.mjs`, `check-bcu-death-surge-zombie-corpse-parity.mjs`.

### Status / proc / immunity / partial resistance

#### 1. BCU holder

- Full unit IMU holders: wave 46, KB 48, stop 49, slow 50, weak 51, warp 75, curse 79, toxic 90, surge 91, blast 116.
- Full enemy IMU holders: wave 37, KB 39, stop 40, slow 41, weak 42, warp 70, surge 85, curse 105, blast 109.
- Negative evidence: `DataEnemy.fillData` has attack toxic `P_POIATK` 79/80 but no direct enemy `IMUPOIATK` CSV holder in inspected constructor; JS correctly records `IMUPOIATK` enemy holder as unconfirmed.
- Partial/custom holders use `Proc.IMU*` / `Proc.IMUAD` fields and may come from custom/proc-object/talent/orb sources.

#### 2. BCU runtime owner

- `Entity.processProcs` applies STOP/SLOW/WEAK/CURSE/KB/WARP/SEAL/POISON/SPEED/LETHARGY and uses `getResistValue`.
- `EEnemy.getResistValue` adds cannon and enemy sage resistance.
- `EUnit.getResistValue` applies `AB_SKILL` status resistance against sage attackers.
- `EUnit.processAbilityOrbs` mutates proc IMU fields from orb grades.

#### 3. BCU ordering

- `Entity.damaged` full projectile damage guard happens before normal damage storage.
- `Entity.processProcs` runs after accepted damage unless barrier/shield/damage guards suppress procs.
- Full immunity calls invalid visual and does not apply status.
- Partial resistance adjusts duration/distance/percent before status mutation.

#### 4. BCU formula

- base resistance factor: `1f - procResist / 100f`.
- enemy sage factor: extra 70% resistance unless attacker has `AB_SKILL`.
- unit sage-hunter status resistance: `ans *= (1f - SUPER_SAGE_HUNTER_RESIST)`, currently 0.3.
- duration truncates by Java `(int)`.
- KB distance uses `atkProc.KB.dis * dist * rst` with fruit distance factor.

#### 5. BCU visual/effect

- Full proc immunity uses `INV`.
- Wave/surge/blast damage invalid uses `P_WAVE` invalid effect.
- Status icons are set in `AnimManager.getEff` and cleared in `checkEff`.
- ZIP evidence: status aliases exist for stop/slow/weaken/strengthen/survive/attack-nullify/curse/seal/poison; wave invalid aliases exist in `wave.zip`.

#### 6. JS implementation

- `BcuResistRuntime` returns `implemented: true` for supported field and sage branches.
- `BcuProcImmunityPatch` delegates partial math to `BcuResistRuntime`.
- Missing: source loaders for talent/orb/custom partial resistance and full invalid visual ordering tests for every family.

#### 7. Readiness

- ready-for-implementation: needs-test-first.
- exact implementation hook: `BcuResistRuntime.getTalentOrbResistance`, unit spawn model, `BcuProcImmunityPatch`.
- tests to add: field/orb/talent resistance fixture matrix for duration, distance, toxic percent, wave/surge/blast damage cut.

### Guard / lifecycle

#### Barrier and demon shield

- BCU holder: `DataEnemy` barrier index 64, demon shield hp/regen 87/88; `DataUnit` barrier breaker 70, shield breaker 95.
- BCU runtime: `Entity.damaged` barrier then metal killer then demon shield; `KBManager.updateKB` shield regen at KB end.
- JS current: `BattleActorBarrierShieldPatch`, `BattleActorBarrierShieldVisualPatch`, `BcuBarrierShieldEffectRuntime`, `BattleBcuPriorityEffectRuntimePatch`.
- Tests: `check-bcu-barrier-shield-effect-parity.mjs` and `check-bcu-demon-shield-regen-timing.mjs` OK.
- Readiness: manual-visual-review-only for current actor shield rows; no implementation needed unless human visual review finds a mismatch.

#### Castle/base guard

- BCU holder: `StageBasis.activeGuard`, initialized from stage/enemy guard state; no actor proc holder.
- BCU runtime: `StageBasis.update` sets `activeGuard = 1` when `activeGuard == 0 && est.hasBoss(true, false)`; `Entity.postUpdate` blocks base damage and calls `anim.getEff(GUARD_HOLD)` while active; `StageBasis.checkGuard` clears to 0 and calls `ECastle.guardBreak` after boss disappears.
- BCU visual: `EffAnim.A_E_GUARD` maps `./org/battle/s19/skill_guard_e`; `ECastle.guard` uses `GuardEff.NONE` and `GuardEff.BREAK`.
- JS current: `BcuCastleGuardRuntime` and `BattleSceneBcuCastleGuardPatch` keep `activeGuard` as scene/base state, block base damage while active, and use `enemy-wave-guard/*` hold/break phases.
- Status: `human-visual-review-needed`; deterministic state/damage/effect trace passes, but exact browser appearance is not manually reviewed.
- Test: `scripts/check-bcu-castle-guard-parity.mjs`.

### Burrow

#### 1. BCU holder

- `DataEnemy.fillData`: `ints[43] -> BURROW.count`, `ints[44] / 4 -> BURROW.dis`.
- `Entity.setSummon`: summon animation type 3 also initializes burrow-like state for summoned entities.
- Negative evidence: no `DataUnit` normal CSV burrow holder found in inspected `DataUnit` constructor.

#### 2. BCU runtime owner

- `Entity.update`: after `updateProc` and barrier update, calls `updateBurrow` when `kbTime < -1` and not stopped.
- `Entity.update2`: when touching and not frozen, starts burrow if `status[P_BURROW][0] != 0`, not `skipSpawnBurrow`, and base is still beyond touch range.
- `startBurrow`: decrements remaining count, sets BURROW_DOWN animation, `kbTime = -2`.
- `updateBurrow`: `-2` burrow down, `-3` underground movement, `-4` burrow up.
- `touchable`: `kbTime == -2 || -4` returns normal/underground, `kbTime == -3` returns underground only.

#### 3. BCU ordering

- Start trigger is reaction phase `update2`, after movement phase and collision check.
- Movement suppression is through `kbTime < -1` branch.
- Freeze blocks `updateBurrow`.
- Underground movement uses normal move and decrements `bdist` by actual moved distance.
- Base proximity ends underground movement and starts BURROW_UP.

#### 4. BCU formula

- Distance column is `/4`.
- Count decrements at start, not at completion.
- `bdist < 0` causes immediate up animation.
- Final position is movement-integrated and base-clamped by base proximity condition.

#### 5. BCU visual/effect

- Uses entity animations `BURROW_DOWN`, `BURROW_MOVE`, `BURROW_UP`.
- Gouge/resurface extra attack callbacks can fire at animation `pre` frames.
- No ZIP micro-effect is proven; this is actor animation lifecycle.

#### 6. JS implementation

- Parser: `BcuCombatModel.parseEnemyProc().burrow`.
- Runtime: `BcuBurrowLifecycleRuntime` and `BattleActorBcuBurrowPatch` implement start gating, phase transitions, movement distance, base clamp, targetability/touchability, renderability, and death cleanup. `BattleAttackResolver.captureTargets` delegates to `isBcuTargetableForEvent`.
- Test: `check-bcu-burrow-lifecycle-parity.mjs`; `check-ability-partial-blockers.mjs` still asserts no `ProcResolver` catalog row because BCU burrow is entity lifecycle, not attack proc runtime.

#### 7. Readiness

- Status: `code-complete-candidate`.
- Remaining: exact human/browser review of actor `BURROW_DOWN/MOVE/UP` appearance if visual sign-off is needed.

### Zombie corpse / soulstrike / zombie killer / revive / death surge

#### 1. BCU holder

- `DataEnemy`: `REVIVE.count/time/health` indexes 45/46/47; `DEATHSURGE.prob/dis0/dis1/time` 89/90/91/92.
- `DataUnit`: `AB_ZKILL` index 52; `AB_CKILL` index 98.
- Death soul: unit `ints[67]`; enemy `ints[54]`, fallback Soul 9 when `ints[54] == -1 && ints[63] == 1`.

#### 2. BCU runtime owner

- `Entity.ZombX`: `damaged`, `prekill`, `doRevive`, `updateRevive`.
- `Entity.touchable`: corpse state after revive show threshold.
- `Entity.getTouch`: adds `TCH_CORPSE` when attacker has `AB_CKILL`.
- `AtkModelEntity.getDeathSurge`: creates death surge or mini-death-surge `ContVolcano`.

#### 3. BCU ordering

- `Entity.damaged` records zombie killer in `zx.damaged`.
- `Entity.postUpdate` calls `zx.postUpdate` and later last-breathe handling.
- `preKill` calls `zx.prekill`; revive suppresses normal kill and clears STOP/SLOW/WEAK/CURSE/SEAL/STRONG/LETHAL/POISON.
- Corpse animation switches from DOWN to REVIVE based on `status[P_REVIVE][1]` and zombie effect length.
- Soulstrike targetability is a touch mask/capture effect, not a normal alive target.

#### 4. BCU formula

- Revive HP: `maxH * maxRevHealth / 100`.
- Revive timer: min own/extra reviver time plus `ZombieEff.REVIVE` length.
- Death surge spawn: `dis_0 + random * (dis_1 - dis_0)`; mini-death-surge branch exists through `MINIDEATHSURGE`.

#### 5. BCU visual/effect

- `A_ZOMBIE` / `A_U_ZOMBIE` for corpse/revive animation.
- `effect:soul` has `soul-000..012` and `demon-soul-*` aliases.
- No stable zombie revive ZIP alias beyond actor zombie effect path is documented in JS.

#### 6. JS implementation

- Parser and runtime: `BcuCombatModel`, `BcuZombieCorpseRuntime`, `BattleActorZombieRevivePatch`, `BattleSoulstrikePatch`, `BcuDeathAnimationRuntime`.
- Test: `check-bcu-zombie-corpse-soulstrike-parity.mjs` covers revive indexes, `AB_ZKILL`, `AB_CKILL`, BCU `REVIVE_SHOW_TIME` targetability, non-soulstrike exclusion, soulstrike cancellation, zombie killer suppression, revive HP, death-surge frame 21, and no double spawn.
- Remaining mismatch: `ZombieEff.REVIVE` visual transition and mini-death-surge split are still not proven in JS.

#### 7. Readiness

- Status: `partial`.
- Remaining tests/work: revive visual trace, extra-reviver timer/range fixtures, and mini-death-surge holder/runtime split after source-backed loader evidence.

### Summon

#### 1. BCU holder

- `Data.Proc.SUMMON` is a proc-object/custom attack holder.
- `AtkModelEntity.setProc` copies `SUMMON` into current attack proc if probability passes.
- `AtkModelEntity.invokeLater` handles on-hit/on-kill summon after target damage.
- `CustomEnemy` scans `rep.proc.SUMMON` and attack model `SUMMON` for dependent enemy IDs.
- Negative evidence: no direct normal `DataUnit` or `DataEnemy` CSV summon column was found in inspected constructors.

#### 2. BCU runtime owner

- `AtkModelUnit.summon` and `AtkModelEnemy.summon`.
- `Entity.setSummon` applies spawn animation behavior and optional bond HP linkage.
- `StageBasis.tempe` receives `EntCont` for delayed entity insertion.
- `Entity.SummonManager` propagates damage/procs to bonded children.

#### 3. BCU ordering

- Non-hit/kill summon fires during attack proc construction.
- `on_hit` and `on_kill` summon fires from `invokeLater` token after `Entity.postUpdate` token processing.
- `IMUSUMMON` resistance can reject and shows invalid visual on full resistance.

#### 4. BCU formula

- Position: `ent.pos + dire * random(dis..max_dis)`.
- Unit level and enemy magnification scale by `(100 - resist) / 100`.
- Layer fallback: current layer for unit attacker, spawn layer for enemy attacker where configured `-1`.
- Enemy spawn clamps between width and `stage.len - 800`.

#### 5. BCU visual/effect

- `Entity.setSummon` config 1 uses warp exit animation; config 2/3 uses special actor animation if available, with 3 burrow-like.
- `wave.zip` has summon-adjacent source-style paths and counter-surge stable aliases, but no completed summon runtime alias evidence.

#### 6. JS implementation

- Parser: none for `Proc.SUMMON`.
- Runtime: none.
- Visual loader: no stable summon-specific runtime hook.

#### 7. Readiness

- blocked.
- exact blocker: local JS lacks proc-object attack source loader and actor creation contract.
- next source to inspect: custom stage/entity import path that maps BCU proc-object data into JS attack models.

### Spirit

#### 1. BCU holder

- `DataUnit.java`: `ints[110] != -1` maps to `proc.SPIRIT.id`.
- `LineUp.java` builds `spirits[i][j]` from summoner's `SPIRIT.id`.

#### 2. BCU runtime owner

- `StageBasis.act_spawn` owns both summoner spawn and manual spirit spawn.
- `StageBasis.update` decrements `spiritCooldown`.
- `EUnit.isSpirit` changes damage and lifecycle behavior.
- `StageBasis` cleanup resets summoner/spirit flags when summoner dies.

#### 3. BCU ordering

- Spawning a summoner sets `summonerSummoned[i][j] = true` and `spiritCooldown = 15`.
- Manual spawn while a living summoner exists and cooldown is 0 creates one spirit per living summoner.
- Spirit starts attack in `EUnit.added`.
- Spirit self-kills with `KillMode.SPIRIT` when attack time returns to 0.

#### 4. BCU formula

- Spirit spawn position: `max(ebase.pos + su.data.getRange(), min(summoner.pos + SPIRIT_SUMMON_RANGE, ubase.pos))`.
- `SPIRIT_SUMMON_RANGE = 150`; `SPIRIT_SUMMON_DELAY = 15`.
- Spirit damage intake: `EUnit.damaged` sets `P_IMUATK` max and returns false.

#### 5. BCU visual/effect

- Attack-nullify visual uses `P_IMUATK` / `A_IMUATK`.
- No separate spirit ZIP alias was proven.

#### 6. JS implementation

- Parser: `BcuCombatModel.parseUnitProc().spirit` reads unit index 110.
- Runtime: `BcuSpiritLifecycleRuntime` and `BattleSceneBcuSpiritPatch` implement summoner cooldown, manual spirit spawn, one spirit per living summoner, spawn clamp, damage rejection, self-kill, and cleanup flags.
- Visual: damage rejection routes through existing `P_IMUATK` / `A_IMUATK` status path; no separate spirit ZIP alias is proven.

#### 7. Readiness

- Status: `human-visual-review-needed`.
- Test: `scripts/check-bcu-spirit-lifecycle-parity.mjs`.
- Remaining: manual browser review of exact spirit actor animation and attack-nullify effect appearance.

### Castle/base guard

#### 1. BCU holder

- `StageBasis.activeGuard` is the state holder.
- `ECastle.guard` is the effect holder.
- Negative evidence: no actor proc holder; adding actor-level guard flags would not match BCU.

#### 2. BCU runtime owner

- `StageBasis.update` activates guard when boss condition appears.
- `Entity.postUpdate` and `ECastle.damaged` block base HP damage while `activeGuard == 1`.
- `StageBasis.checkGuard` breaks guard when boss condition is gone and no marked boss enemy remains.

#### 3. BCU ordering

- Guard hold blocks base damage after damage accumulation check and before base health subtraction.
- Guard break runs from stage guard check, not from attacker proc.

#### 4. BCU formula

- No damage reduction formula: active guard blocks base HP damage entirely.
- Guard animation lifetime is effect animation driven.

#### 5. BCU visual/effect

- `EffAnim.A_E_GUARD` maps `./org/battle/s19/skill_guard_e`.
- `ECastle.guard` uses `GuardEff.NONE`; break uses `GuardEff.BREAK`.
- ZIP evidence: `wave.zip` has `enemy-wave-guard/image.png`, `imgcut.imgcut`, `model.mamodel`, `anim-none.maanim`, `anim-breaker.maanim`.

#### 6. JS implementation

- `BcuCastleGuardRuntime` stores `activeGuard` equivalent in stage/base runtime state.
- `BattleSceneBcuCastleGuardPatch` wires boss activation, base damage hold, guard break, and guard effect phases without actor proc status.
- `BattleWaveEffectLoader` `enemyWaveGuard` alias is used for hold and break traces.

#### 7. Readiness

- Status: `human-visual-review-needed`.
- Test: `check-bcu-castle-guard-parity.mjs`.
- Remaining: manual browser review of exact guard appearance.

## Evidence not found after exhaustive search

### BCU PC source

- Searched BCU common:
  - command: `find references/bcu -maxdepth 2 -type f`
  - files inspected: `BCU_java_util_common.zip`, Android zip, Markdown reference.
- Searched BCU PC:
  - command: `find . -maxdepth 2 -type f -name '*BCU*zip'`
  - keywords: `BCU-java-PC-slow_kotlin.zip`, `BCU_java_util_common-ef840238e4700eb4b8eb57b4446633e465f4edd5.zip`, `BCU_Android-master.zip`
  - files inspected: none; no PC zip found in this checkout.
- Searched BCU Android:
  - command: `find /tmp/bcu-ref/android -path '*proc_jp.json' -o -path '*ability*json' -o -path '*trait*json' -o -path '*status*json'`
  - files inspected: `/tmp/bcu-ref/android/BCU_Android-master/app/src/main/res/raw/proc_jp.json`
- Searched rhgrive2/game JS:
  - command: `rg -n "BattleBox|ViewBox|AnimBox|drawEff|WaprCont|guard|summon|spirit" js scripts`
  - files inspected: JS runtime and builder files listed in the command output.
- Negative evidence:
  - PC zip is not present under `references/bcu` or repo root depth 2.
- Most likely owner candidates:
  - candidate: common source for battle logic; Android raw JSON for labels.
  - reason: common source directly contains the battle owner methods needed for this pass.
  - what must be proven next: if exact draw-side pixel offsets beyond common `AnimManager` are needed, add PC zip to references or record that visual review must be human-only.

### Enemy `IMUPOIATK` direct CSV holder

- Searched BCU common:
  - command: `rg -n "IMUPOIATK|POIATK|IMUPOI" /tmp/bcu-ref/common/BCU_java_util_common-ef840238e4700eb4b8eb57b4446633e465f4edd5/battle /tmp/bcu-ref/common/BCU_java_util_common-ef840238e4700eb4b8eb57b4446633e465f4edd5/util`
  - files inspected: `DataUnit.java`, `DataEnemy.java`, `Entity.java`, `EUnit.java`, `EEnemy.java`, `Data.java`.
- Searched BCU PC:
  - command: `find . -maxdepth 2 -type f -name '*BCU*zip'`
  - files inspected: none; PC zip missing.
- Searched BCU Android:
  - command: `rg -n "毒撃|毒|無効|POI|poison" /tmp/bcu-ref/android/BCU_Android-master/app/src/main/res/raw/proc_jp.json`
  - files inspected: `proc_jp.json`.
- Searched rhgrive2/game JS:
  - command: `rg -n "IMUPOIATK|toxic|POIATK" js scripts`
  - files inspected: `BcuCombatModel.js`, `BcuProcImmunityPatch.js`, `BcuResistRuntime.js`, checks.
- Negative evidence:
  - `DataUnit` maps unit index 90 to `proc.IMUPOIATK.mult = 100`.
  - `DataEnemy` maps enemy indexes 79/80 to `proc.POIATK`, but no inspected `DataEnemy.fillData` branch maps an enemy raw index to `IMUPOIATK`.
- Most likely owner candidates:
  - candidate: custom/proc-object `Proc.IMUPOIATK` or future enemy format not present in this common constructor.
  - reason: `Entity.processProcs` supports target `getProc().IMUPOIATK`, so holder may exist outside standard enemy CSV.
  - what must be proven next: inspect custom entity/proc-object import path before adding any enemy CSV parser index.

### Normal CSV summon holder

- Searched BCU common:
  - command: `rg -n "SUMMON|IMUSUMMON|AtkModelEntity|CustomEnemy" /tmp/bcu-ref/common/BCU_java_util_common-ef840238e4700eb4b8eb57b4446633e465f4edd5/battle /tmp/bcu-ref/common/BCU_java_util_common-ef840238e4700eb4b8eb57b4446633e465f4edd5/util`
  - files inspected: `AtkModelEntity.java`, `AtkModelUnit.java`, `AtkModelEnemy.java`, `CustomEnemy.java`, `DataUnit.java`, `DataEnemy.java`, `Data.java`.
- Searched BCU PC:
  - command: `find . -maxdepth 2 -type f -name '*BCU*zip'`
  - files inspected: none; PC zip missing.
- Searched BCU Android:
  - command: `rg -n "SUMMON|summon|召喚" /tmp/bcu-ref/android/BCU_Android-master/app/src/main/res/raw/proc_jp.json`
  - files inspected: `proc_jp.json`.
- Searched rhgrive2/game JS:
  - command: `rg -n "summon|SUMMON|IMUSUMMON|EntCont" js scripts`
  - files inspected: no JS runtime owner found.
- Negative evidence:
  - `DataUnit` and `DataEnemy` inspected constructors do not assign `proc.SUMMON` from normal BC CSV indexes.
- Most likely owner candidates:
  - candidate: custom/proc-object attack model loader.
  - reason: `AtkModelEntity.setProc` and `invokeLater` prove summon is an attack proc, but holder is not standard unit/enemy CSV.
  - what must be proven next: map BCU custom/proc-object data to JS before implementing.

## Ready / completed pass 2 implementation

| Item | Reason | Target JS hook | Tests to add first |
|---|---|---|---|
| Burrow lifecycle | BCU holder, owner, states, targetability, movement, and formulas are now source-backed and implemented | `BcuBurrowLifecycleRuntime`, `BattleActorBcuBurrowPatch`, `BattleAttackResolver.captureTargets` | `check-bcu-burrow-lifecycle-parity.mjs` |
| Castle/base guard | BCU owner is `StageBasis.activeGuard`/`ECastle.guard`, ZIP alias exists, and stage/base state is implemented | `BcuCastleGuardRuntime`, `BattleSceneBcuCastleGuardPatch`, `BattleBase` damage gate | `check-bcu-castle-guard-parity.mjs` |
| Spirit | BCU holder and production owner are source-backed and implemented | `BcuCombatModel`, `BcuSpiritLifecycleRuntime`, `BattleSceneBcuSpiritPatch` | `check-bcu-spirit-lifecycle-parity.mjs` |
| External modifiers | BCU source paths for combo/orb/treasure/talent/PCoin are identified | data loaders plus `DamageAbilityResolver` | `check-bcu-external-damage-modifiers.mjs` |
| Zombie corpse/death surge interaction | Owner and ordering are identified; core corpse/soulstrike/ZK/death-surge interaction is implemented, while visual/mini split remains partial | `BcuZombieCorpseRuntime`, `BattleActorZombieRevivePatch`, `BattleSoulstrikePatch`, `BcuDeathAnimationRuntime` | `check-bcu-zombie-corpse-soulstrike-parity.mjs` |

## Still blocked / partial

| Item | Exact missing evidence | Searches performed | Next source to inspect |
|---|---|---|---|
| Summon | JS explicit proc-object runtime exists; automatic BCU custom/proc-object source loader and normal CSV holder are still missing | common/Android/JS summon searches listed above plus `scripts/check-bcu-summon-runtime-parity.mjs` | JS BCU custom entity/proc-object import path; BCU `CustomEntity` serialization |
| Enemy `IMUPOIATK` direct CSV | standard `DataEnemy.fillData` does not expose a direct raw index | common/Android/JS toxic immunity searches listed above | custom/proc-object holder path |
| Full targetForms compatibility | BCU `Trait.targetForms` branch is identified, but JS fixture coverage is missing | `EEnemy.getDamage`, `Entity.traitCompatible`, JS `BcuTraitCompatibility` | targetForms data source and minimal unit/enemy fixtures |
| Bounty/money visual | BCU economy formula is known, but visual money effect owner is not proven in source pass | `EEnemy.kill`, JS bounty runtime, ZIP audits | BCU draw/economy visual owner, likely PC/draw-side source if available |
| Zombie revive visual exactness | `ZombieEff` source owner is known, but JS stable loader/trace is not proven | `Entity.ZombX.updateRevive`, soul ZIP, wave/status/kbeff ZIP | bundle/build path for zombie effects or record human-visual-review-needed only after deterministic trace |

## Verification results

```bash
node scripts/check-bcu-ability-parity-safe-suite.mjs
# result: OK; all listed node --check and runtime checks passed.
node scripts/check-bcu-parser-indexes.mjs
# result: check-bcu-parser-indexes: OK
node scripts/check-projectile-damage-parity.mjs
# result: check-projectile-damage-parity: OK
node scripts/check-proc-immunity-resistance-parity.mjs
# result: check-proc-immunity-resistance-parity: OK
node scripts/check-effect-bundle-aliases.mjs
# result: check-effect-bundle-aliases: OK
node scripts/check-effect-coordinate-traces.mjs
# result: check-effect-coordinate-traces: OK
node scripts/check-bcu-barrier-shield-effect-parity.mjs
# result: check-bcu-barrier-shield-effect-parity: OK
node scripts/check-bcu-demon-shield-regen-timing.mjs
# result: check-bcu-demon-shield-regen-timing: OK
node scripts/check-bcu-death-animation-parity.mjs
# result: check-bcu-death-animation-parity: OK
node scripts/check-bcu-warp-lifecycle-parity.mjs
# result: check-bcu-warp-lifecycle-parity: OK
node scripts/check-bcu-delay-runtime.mjs
# result: check-bcu-delay-runtime: OK
node scripts/check-ability-partial-blockers.mjs
# result: check-ability-partial-blockers: OK
```
