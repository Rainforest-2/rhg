# AGENTS.md

Repository-wide instructions for AI coding agents working on `rhgrive2/game`.

This project is a browser-based Battle Cats Ultimate (BCU) parity / preview runtime. Player-facing battle behavior should match the reference game. The implementation is JavaScript, but the source of truth for battle logic is the local BCU reference material under `references/bcu/`.

## Scope

These instructions apply to the whole repository unless a more specific `AGENTS.md` exists in a subdirectory.

## Current priority: fact-only ability parity

The current task is ability/proc parity. This is not a prompt-writing-only task and not a speculative implementation task.

Codex must:

1. inspect local BCU references first;
2. build a complete fact matrix for every ability/proc currently relevant to the JS runtime;
3. implement only behavior whose holder field, target condition, timing, multiplier, probability, duration, and runtime hook are all confirmed by local references;
4. explicitly defer anything that is not confirmed;
5. keep existing game logic and wrapper chains stable;
6. run local static checks and targeted smoke checks;
7. commit the analysis document and code changes together for each safe slice.

Do not implement guessed behavior. Do not fill in missing CSV indexes, missing proc fields, missing multipliers, or missing timing from intuition, wiki memory, UI labels alone, or similar abilities.

## User-specific rule: no speculation

For every ability or proc, Codex must classify it as one of:

- **fact-complete**: exact BCU source confirms holder field/index, target condition, effect, timing, and JS hook;
- **fact-partial**: some facts are confirmed but at least one required runtime detail is missing;
- **not-implemented**: no safe JS implementation is possible yet without inventing behavior;
- **already-correct**: JS matches the inspected reference;
- **implemented-in-this-pass**: changed by the current commit.

Only `fact-complete` items may be implemented. `fact-partial` items must be documented and deferred.

## Immediate investigation result: 超獣特効 / Beast Hunter

Ultra Beast / Behemoth Hunter has been found in the local BCU references. This ability was previously deferred because the JS code did not expose a confirmed holder bit. The correct source is not an `AB_*` bit. It is a proc item: `P_BSTHUNT` / `Proc.BSTHUNT`.

### Confirmed BCU facts

Inspect these exact local files after extracting `references/bcu/BCU_java_util_common.zip`:

- `util/Data.java`
  - `Proc.BSTHUNT extends ProcItem` has fields:
    - `active`
    - `prob`
    - `time`
  - `P_BSTHUNT = 54`
  - proc type entry for ability id 64 maps to `{ 0, P_BSTHUNT, 2, -1 }`
  - comment says Beast Killer / behemoth hunter.
- `battle/data/DataUnit.java`
  - if `ints[105] == 1`:
    - `proc.BSTHUNT.active = 1`
    - `proc.BSTHUNT.prob = ints[106]`
    - `proc.BSTHUNT.time = ints[107]`
- `battle/entity/EEnemy.java`
  - when the damaged enemy has trait `TRAIT_BEAST` and `atk.getProc().BSTHUNT.active == 1`, outgoing unit damage to that enemy is multiplied by `2.5`.
- `battle/entity/EUnit.java`
  - when the attacker trait contains `TRAIT_BEAST` and the unit has `getProc().BSTHUNT.active > 0`, incoming damage is multiplied by `0.6`.
  - when the attacker trait contains `TRAIT_BEAST`, `getProc().BSTHUNT.prob > 0`, and `atk.dire != dire`, the ability can trigger attack-nullify:
    - if `status[P_BSTHUNT][0] == 0` and `beastDodge.perform(basis.r)` succeeds, set `status[P_BSTHUNT][0] = beastDodge.time`;
    - call `anim.getEff(P_IMUATK)`;
    - while `status[P_BSTHUNT][0] > 0`, add `atk.atk` to damage-taken accounting and return `false` from the damage handling path.
- `battle/entity/Entity.java`
  - `status[P_BSTHUNT][0]` decrements each tick;
  - `A_IMUATK` visual is kept while either `P_IMUATK` or `P_BSTHUNT` status is active, and cleared only when both are zero.
- `util/lang/assets/proc_jp.json` and Android `app/src/main/res/raw/proc_jp.json`
  - display text confirms: `超獣特効` = damage dealt `x2.5`, damage received `x0.6`, and if `prob > 0`, probability-based attack-nullify for `time`.

### Confirmed current JS gap

Inspect `js/battle/BcuCombatModel.js`:

- `BCU_TRAITS.beast` exists and enemy trait column `101` maps to `beast`.
- `parseUnitProc(rawValues)` currently does not expose `BSTHUNT` from unit CSV indexes `105`, `106`, and `107`.
- `DamageAbilityResolver` currently lists beast killer as omitted because no confirmed holder ability bit was parsed. That statement is now obsolete: the holder is confirmed as `proc.BSTHUNT.active`, not `BCU_ABI`.

### Required Beast Hunter implementation constraints

Implement Beast Hunter only using these facts:

- add a `beastHunter` or `bsthunt` proc object to `parseUnitProc(rawValues)`:
  - `active: enabled(rawValues, 105) ? 1 : 0`
  - `prob: enabled(rawValues, 105) ? n(rawValues, 106, 0) : 0`
  - `time: enabled(rawValues, 105) ? n(rawValues, 107, 0) : 0`
- do not invent an `AB_BSTHUNT` bit;
- damage dealt to `BCU_TRAITS.beast` uses `attacker.proc.BSTHUNT.active == 1` and multiplier `2.5`;
- damage received from `BCU_TRAITS.beast` uses `target.proc.BSTHUNT.active > 0` and multiplier `0.6`;
- attack-nullify from Beast Hunter must be implemented only if the current JS damage/nullify/status pipeline has a safe hook equivalent to BCU `EUnit` handling. If not, implement only damage multipliers and defer nullify with exact source notes;
- Beast Hunter uses the `P_IMUATK` visual family in BCU. If adding visuals, reuse the existing attack-nullify/status visual path; do not invent a new visual location.

## Required analysis artifact before ability runtime changes

Before editing runtime code for ability parity, create or update a document under:

- `docs/ability-logic/`

For this task, create or update:

- `docs/ability-logic/fact-only-ability-parity-matrix.md`

The document must include:

- objective in one sentence;
- exact user-requested scope;
- explicit non-goals;
- local reference files/classes/methods inspected;
- Markdown reference sections inspected;
- current JS files inspected;
- current import order from `js/main.js` for touched patches;
- wrapper chain for every touched method;
- data flow for attack capture, damage calculation, proc resolution, proc application, status visualization, and post-damage resolution;
- complete ability/proc matrix with one row per ability/proc;
- for each row: BCU field/index, JS parse location, JS runtime location, status as fact-complete/fact-partial/etc., implementation decision, and verification plan;
- list of abilities explicitly deferred and exact missing fact/hook;
- current observed JS behavior;
- reference behavior;
- selected implementation plan;
- rejected implementation ideas and why they are risky;
- gameplay invariants that must remain true;
- static verification steps;
- executable local checks and their results;
- validation limits;
- rollback plan.

Do not proceed to code until this matrix exists. After the matrix exists, implement the fact-complete items in small safe slices. Do not wait for another user confirmation unless a required reference is missing or the only possible implementation would be speculative.

## Reference source policy

Codex-style agents cannot see ChatGPT attachments. Use local repository files only.

Before changing ability or battle logic, inspect the local references under:

- `references/bcu/BCU_java_util_common.zip`
- `references/bcu/BCU_Android-master.zip`
- every relevant `*.md` file under `references/bcu/`

Use `BCU_java_util_common.zip` and `BCU_Android-master.zip` as the primary gameplay references. Do not use PC-only Kotlin sources as the first gameplay source when the non-PC references answer the same question. PC code may still be useful for UI/search/filter display details, but gameplay logic must come from common/Android references whenever available.

Treat Markdown as high-level gameplay explanation. Treat Java/Kotlin reference ZIPs as the primary source for exact control flow, field names, timing, and state transitions.

Useful local commands:

```bash
mkdir -p /tmp/bcu-ref
python3 - <<'PY'
import zipfile, pathlib
pairs = [
    ('references/bcu/BCU_java_util_common.zip', '/tmp/bcu-ref/common'),
    ('references/bcu/BCU_Android-master.zip', '/tmp/bcu-ref/android'),
]
for z, out in pairs:
    p = pathlib.Path(z)
    if not p.exists():
        print('MISSING', p)
        continue
    pathlib.Path(out).mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(p) as f:
        f.extractall(out)
    print('extracted', p, '->', out)
PY
rg -n "P_BSTHUNT|BSTHUNT|TRAIT_BEAST|超獣特効|AB_BAKILL|AB_SKILL|AB_VKILL|P_IMUATK|P_BOUNTY|P_BLAST|P_IMU|DataUnit|DataEnemy|EEnemy|getDamage|EUnit|damaged|AttackSimple|AttackWave|AttackVolcano" /tmp/bcu-ref references/bcu js
```

## Ability/proc matrix checklist

Codex must inspect and classify all of these. Add rows for any additional `P_*`, `AB_*`, or trait-related ability found in references.

### Damage and target-trait abilities

- めっぽう強い / `AB_GOOD`
- 打たれ強い / `AB_RESIST`
- 超打たれ強い / `AB_RESISTS`
- 超ダメージ / `AB_MASSIVE`
- 極ダメージ / `AB_MASSIVES`
- ターゲット限定 / `AB_ONLY`
- メタル / `AB_METALIC`
- クリティカル / `P_CRIT`
- メタルキラー / `P_METALKILL`
- 渾身の一撃 / `P_SATK`
- 城破壊 / `P_ATKBASE`
- 超生命体特効 / `AB_BAKILL`
- 超獣特効 / `P_BSTHUNT`
- 超賢者特効 / `AB_SKILL`
- 怪人特効 / `AB_VKILL`
- 魔女キラー / `AB_WKILL`
- 使徒キラー / `AB_EKILL`

### Proc/status abilities

- ふっとばす / `P_KB`
- 止める / `P_STOP`
- 遅くする / `P_SLOW`
- 攻撃力ダウン / `P_WEAK`
- 呪い / `P_CURSE`
- ワープ / `P_WARP`
- 毒撃 / `P_POIATK`
- 攻撃無効 / `P_IMUATK`
- 超獣特効の攻撃無効 / `P_BSTHUNT` status branch
- 攻撃力アップ / `P_STRONG`
- 生き残る / `P_LETHAL`
- 撃破時お金アップ / `P_BOUNTY`
- 1回攻撃 / `AB_GLASS`

### Projectile/area abilities

- 波動 / `P_WAVE`
- 小波動 / `P_MINIWAVE`
- 波動無効 / `P_IMUWAVE` or equivalent ability bit/status in references
- 烈波 / `P_VOLC`
- 小烈波 / `P_MINIVOLC`
- 烈波無効 / `P_IMUVOLC`
- 死亡時烈波 / `P_DEATHSURGE`
- 烈波カウンター / `AB_CSUR`
- 爆波 / `P_BLAST`
- 爆波無効 / `P_IMUBLAST`

### Barrier, shield, corpse, summon, movement

- バリア / `P_BARRIER`
- バリアブレイカー / `P_BREAK`
- 悪魔シールド / `P_DEMONSHIELD`
- シールドブレイカー / `P_SHIELDBREAK`
- ゾンビキラー / `AB_ZKILL`
- 魂攻撃 / `AB_CKILL`
- 蘇生 / `P_REVIVE`
- 地中移動 / `P_BURROW`
- 召喚 / `P_SPIRIT`
- 精霊 or spirit unit behavior if locally referenced

### Immunity and resistance abilities

- freeze/slow/weaken/kb/wave/surge/warp/curse/toxic/blast immunities;
- partial resistances where BCU exposes a `mult`, `prob`, or duration rule;
- sage status-resistance and sage-resistance bypass, only if exact BCU control flow is confirmed.

## Existing implementation facts to re-check before edits

Current JS files that must be inspected before relevant changes:

- `js/main.js`
- `js/battle/BcuCombatModel.js`
- `js/battle/AbilityModel.js`
- `js/battle/BattleAttackProfile.js`
- `js/battle/BattleAttackResolver.js`
- `js/battle/DamageCalculator.js`
- `js/battle/DamageAbilityResolver.js`
- `js/battle/ProcResolver.js`
- `js/battle/BattleSceneProcApplyPatch.js`
- `js/battle/BattleSceneBcuProcRuntimePatch.js`
- `js/battle/bcu-runtime/BcuProcRuntime.js`
- `js/battle/bcu-runtime/BcuResistRuntime.js`
- `js/battle/BattleActorProcStatusPatch.js`
- `js/battle/BattleSceneBcuStatusEffectRenderPatch.js`
- `js/battle/BcuProcImmunityPatch.js`
- `js/battle/BattleActorBarrierShieldPatch.js`
- `js/battle/BattleActorZombieRevivePatch.js`
- `js/battle/BattleSoulstrikePatch.js`
- `js/battle/BattleWaveRuntimePatch.js`
- `js/battle/BattleSurgeRuntimePatch.js`
- `js/battle/BattleBaseProjectileProcPatch.js`
- `js/battle/BcuKnockbackRuntimePatch.js`
- `js/battle/BcuKnockbackProcPriorityPatch.js`
- ability/status effect asset loaders and bundle builder scripts.

Search before editing:

```bash
rg -n "queueAttackDamage|takeDamage|resolvePostDamage|applyBcuProc|DamageCalculator\.calculate|ProcResolver\.resolve|captureTargets|runTickPhase|isTargetable|isAlive|bcuProcStatuses|bcuBarrier|bcuDemonShield|bcuZombie|bcuWave|bcuSurge|deathSurge|miniWave|miniSurge|blast|targetOnly|lethal|strengthen|bounty|counterSurge|burrow|warp|curse|seal|weaken|freeze|slow|toxic|bcuStatus|beast|BSTHUNT|beastHunter" js scripts references/bcu
```

## Protected runtime contracts

Treat these as high-risk contracts:

- `BattleScene.prototype.queueAttackDamage`
- `BattleScene.prototype.runTickPhase`
- `BattleActor.prototype.takeDamage`
- `BattleActor.prototype.resolvePostDamage`
- `BattleActor.prototype.tick`
- `BattleAttackResolver.captureTargets`
- `DamageCalculator.calculate`
- `DamageAbilityResolver.resolve`
- `ProcResolver.resolve`
- `BattleActor.applyBcuProc`
- status-effect rendering and actor attachment positions;
- wave/surge container lifetime and damage timing;
- zombie revive / corpse / soulstrike state;
- barrier and demon shield gate order;
- knockback state transitions;
- status expiration and movement/attack suppression.

Do not replace wrapper chains with direct calls. If wrapping, capture the current method and call it with the same `this` and compatible arguments.

Do not reorder imports in `js/main.js` unless the analysis document proves the existing order is wrong. Later patches may intentionally wrap earlier patches.

## Positive buff/status visual requirement

Attack-up / strengthen, survive / lethal-survive, attack-nullify, and Beast Hunter attack-nullify must use existing actor-anchored status/effect rendering when visuals are required and the asset exists.

Buffs applied to friendly actors and debuffs applied to enemy actors may share the same rendering infrastructure, but the affected actor must be the anchor. Do not attach friendly buffs to the enemy side.

Before implementing any ability visual:

1. locate the existing status/effect bundle that contains weaken / attack-down or attack-nullify effects;
2. extend the existing bundle builder, not the ZIP by hand;
3. rebuild the bundle and generated manifests;
4. document exact internal bundle paths used by runtime code.

## Implementation order recommendation

Use small commits. Suggested order:

1. analysis matrix only;
2. data parse fixes that expose confirmed reference fields without changing runtime behavior;
3. damage-only fact-complete abilities, including Beast Hunter damage multipliers;
4. status/proc fact-complete abilities with no new renderer;
5. projectile/immunity gates that reuse existing runtime safely;
6. visuals/assets only after logic is confirmed.

For Beast Hunter specifically, prefer this order:

1. parse `proc.BSTHUNT` from unit indexes 105/106/107;
2. implement damage dealt `x2.5` and damage received `x0.6` using `proc.BSTHUNT.active` and `BCU_TRAITS.beast`;
3. add tests/smoke checks for Beast target and non-Beast target;
4. implement attack-nullify only after identifying the exact JS hook equivalent to BCU `EUnit.damaged` return-false behavior and status/effect lifetime.

## Required checks

At minimum run:

```bash
node --check js/battle/BcuCombatModel.js
node --check js/battle/DamageAbilityResolver.js
node --check js/battle/ProcResolver.js
node --check js/main.js
node --check scripts/diagnose-production-card-icon-quality.mjs || true
```

Run additional checks for every touched file. If a test or browser run is not possible in the local environment, state that explicitly in the analysis document and provide the exact command the user should run.
