# AGENTS.md

Repository-wide instructions for AI coding agents working on `rhgrive2/game`.

This project is a browser-based Battle Cats Ultimate (BCU) parity / preview runtime. Player-facing battle behavior should match the reference game. The implementation is JavaScript, but the source of truth for battle logic, timing, visual effects, and assets is the local BCU reference material under `references/bcu/` plus the local asset bundles/build scripts.

## Scope

These instructions apply to the whole repository unless a more specific `AGENTS.md` exists in a subdirectory.

## Current priority: fact-only ability parity

The current task is ability/proc parity. Codex must analyze first, document the plan, then implement every locally proven item. Do not stop after an analysis document unless a required local reference, safe JS hook, or local asset is genuinely missing and the blocker is documented.

Codex must maximize the set of abilities classified as `fact-complete`. Do not defer an ability just because the first obvious hook or first searched asset path is missing. Search BCU references, Markdown references, JS runtime hooks, existing effect/status bundles, generated indexes, ZIP contents, and bundle builders before declaring a blocker.

Do not implement guessed behavior. Do not invent CSV indexes, proc fields, multipliers, status durations, visual names, animation timing, effect paths, or loader behavior.

## Definition of `fact-complete`

For every ability/proc, classify it as one of:

- `fact-complete`: exact BCU source and local JS/assets confirm enough to implement the full player-visible behavior safely;
- `fact-partial`: some facts are known but at least one required logic, timing, hook, visual, asset, or bundle detail is missing;
- `not-implemented`: no safe implementation is possible yet without inventing behavior;
- `already-correct`: current JS matches the inspected reference;
- `implemented-in-this-pass`: changed by the current commit.

`fact-complete` requires more than numeric logic. If BCU shows an effect, status animation, icon, projectile, or visible state for that ability, then the row is complete only when the visual/effect path is also found and a bundle/loader plan exists. If BCU has no separate visual for the ability, document that exact reference fact.

Each matrix row must include:

- BCU holder source: CSV index, `AB_*`, `P_*`, proc field, status field, combo/orb field, or other exact source;
- target condition: trait, side, base/castle, corpse, shield/barrier, direction, capture, or range condition;
- timing: capture, pre-damage, damage gate, damage multiplier, post-damage, death, knockback, tick, status expiration, or visual spawn;
- numerical rule: probability, duration, multiplier, level, HP threshold, distance, or additive rule;
- JS parse location;
- JS runtime hook;
- visual/effect behavior, if any;
- asset source path or bundle internal path, if any;
- bundle builder and rebuild command, if any;
- verification command and result.

Only `fact-complete` rows may be implemented. `fact-partial` rows must be deferred, but only after documenting the missing fact/hook/asset and the exact searches performed.

## Two-run workflow

### Run 1: complete the facts

Create or update:

- `docs/ability-logic/fact-only-ability-parity-matrix.md`

Run 1 should focus on turning as many rows as possible into `fact-complete` by inspecting references, assets, JS hooks, generated indexes, and bundle contents. Runtime code changes are not the goal of Run 1.

The document must include:

- objective in one sentence;
- exact user-requested scope;
- explicit non-goals;
- all local reference files/classes/methods inspected;
- all Markdown reference sections inspected;
- current JS files inspected;
- current import order from `js/main.js` for touched patches;
- wrapper chain for every touched method;
- data flow for attack capture, damage calculation, proc resolution, proc application, status visualization, visual spawning, bundle loading, and post-damage resolution;
- complete ability/proc matrix;
- all visual/effect asset searches;
- exact bundle paths and internal paths found;
- list of deferred rows and exact blocker;
- implementation plan for all `fact-complete` rows;
- static/local checks to run in Run 2;
- validation limits and rollback plan.

### Run 2: implement every complete row

Run 2 must implement all rows marked `fact-complete` in the matrix, including visuals/effects and ZIP bundle wiring where applicable. If Run 2 discovers new facts, update the matrix and implement the newly complete rows. Do not implement rows that remain `fact-partial`.

Commits must include related code, scripts, rebuilt ZIP bundles, generated manifest/index changes, and matrix updates together.

## Visual/effect and ZIP bundle requirements

Effects and animations are part of ability parity. If an ability has a BCU visual and the asset exists locally, Codex must bundle and wire it instead of leaving logic-only behavior.

Required workflow for any visual/status/effect:

1. locate the BCU visual/status/effect identifier in the reference code;
2. locate the local raw asset or existing ZIP entry;
3. inspect existing status/effect bundle builder scripts;
4. extend an existing builder instead of editing ZIP files by hand;
5. rebuild the affected ZIP and generated manifest/index files;
6. update runtime loader/renderer only if the existing loader cannot read the entry;
7. document exact bundle key, bundle path, internal path, and runtime mapping;
8. verify the ZIP contains the entry and the loader can resolve it.

Do not create a second competing status/effect bundle unless the matrix proves the existing architecture cannot support the entries. Do not hardcode loose raw paths in normal runtime behavior when a bundle entry can be used.

Before declaring a visual asset missing, run searches equivalent to:

```bash
find public assets references/bcu -type f | sort | rg -i "eff|effect|proc|status|ability|weak|stop|slow|curse|seal|barrier|shield|wave|volcano|surge|blast|imu|dodge|bounty|strong|lethal|beast|bsthunt|A_|P_"
rg -n "A_IMUATK|P_IMUATK|P_BSTHUNT|A_UP|A_SHIELD|A_WEAK|A_STOP|A_SLOW|effect|eff|kbeff|status" js scripts references/bcu public assets
```

If the BCU visual exists but no local asset exists, document the reference visual name, all search commands, why the asset is unavailable, which logic remains implementable, and whether a placeholder is forbidden. Default: do not add placeholders unless explicitly requested.

## Immediate confirmed result: 超獣特効

超獣特効 is not an `AB_*` bit. It is `P_BSTHUNT` / `Proc.BSTHUNT`.

After extracting `references/bcu/BCU_java_util_common.zip`, inspect:

- `util/Data.java`
  - `Proc.BSTHUNT extends ProcItem` with `active`, `prob`, `time`;
  - `P_BSTHUNT = 54`;
  - proc type entry for ability id 64 maps to `{ 0, P_BSTHUNT, 2, -1 }`.
- `battle/data/DataUnit.java`
  - `ints[105] == 1` sets `proc.BSTHUNT.active = 1`;
  - `proc.BSTHUNT.prob = ints[106]`;
  - `proc.BSTHUNT.time = ints[107]`.
- `battle/entity/EEnemy.java`
  - if target has `TRAIT_BEAST` and attacker proc `BSTHUNT.active == 1`, outgoing damage is multiplied by `2.5`.
- `battle/entity/EUnit.java`
  - if attacker trait contains `TRAIT_BEAST` and defender proc `BSTHUNT.active > 0`, incoming damage is multiplied by `0.6`;
  - if the probability/time branch succeeds, BCU stores the status in `status[P_BSTHUNT][0]` and uses the same visible effect family as normal attack-nullify.
- `battle/entity/Entity.java`
  - `status[P_BSTHUNT][0]` decrements each tick;
  - the attack-nullify visual remains while either normal attack-nullify or Beast Hunter status is active.
- `util/lang/assets/proc_jp.json` and Android `app/src/main/res/raw/proc_jp.json`
  - display text confirms damage dealt `x2.5`, damage received `x0.6`, and probability/time-based attack-nullify when probability is nonzero.

Current JS facts to verify:

- `js/battle/BcuCombatModel.js` has `BCU_TRAITS.beast` and enemy trait column `101` mapped to `beast`;
- `parseUnitProc(rawValues)` must expose the unit indexes `105`, `106`, `107` as a proc object such as `beastHunter` / `bsthunt`;
- do not add an invented `AB_BSTHUNT` bit.

Implementation order for this ability:

1. parse `BSTHUNT` from unit indexes `105/106/107`;
2. implement damage dealt `x2.5` and damage received `x0.6` using proc active state and `BCU_TRAITS.beast`;
3. locate and bundle the attack-nullify visual if present;
4. implement the probability/time status branch only after finding the exact safe JS hook equivalent to BCU's damage rejection/status behavior;
5. attach the visual to the affected actor using the existing actor-anchored status/effect system.

## Ability/proc matrix checklist

Codex must inspect and classify all of these. Add rows for any additional `P_*`, `AB_*`, status, effect, or trait-related ability found in references.

Damage and target-trait abilities:

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

Proc/status abilities:

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

Projectile/area abilities:

- 波動 / `P_WAVE`
- 小波動 / `P_MINIWAVE`
- 波動無効
- 烈波 / `P_VOLC`
- 小烈波 / `P_MINIVOLC`
- 烈波無効
- 死亡時烈波
- 烈波カウンター / `AB_CSUR`
- 爆波
- 爆波無効

Barrier, shield, corpse, summon, movement:

- バリア
- バリアブレイカー
- 悪魔シールド
- シールドブレイカー
- ゾンビキラー / `AB_ZKILL`
- 魂攻撃 / `AB_CKILL`
- 蘇生
- 地中移動
- 召喚
- 精霊 / spirit behavior if locally referenced

Immunity and resistance:

- freeze/slow/weaken/kb/wave/surge/warp/curse/toxic/blast immunities;
- partial resistances where BCU exposes a multiplier, probability, or duration rule;
- sage status-resistance and sage-resistance bypass only when exact BCU control flow is confirmed.

## Reference source policy

Codex-style agents cannot see ChatGPT attachments. Use local repository files only.

Before changing ability or battle logic, inspect:

- `references/bcu/BCU_java_util_common.zip`
- `references/bcu/BCU_Android-master.zip`
- every relevant `*.md` file under `references/bcu/`

Use common/Android references as primary gameplay sources. PC code may help with UI/rendering but is not the first gameplay source when common/Android answer the question.

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
rg -n "P_BSTHUNT|BSTHUNT|TRAIT_BEAST|超獣特効|AB_BAKILL|AB_SKILL|AB_VKILL|P_IMUATK|P_BOUNTY|P_BLAST|DataUnit|DataEnemy|EEnemy|getDamage|EUnit|damaged|AttackSimple|AttackWave|AttackVolcano" /tmp/bcu-ref references/bcu js
```

## Core files to inspect before edits

At minimum inspect these before relevant changes:

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

## Implementation order recommendation

Use small commits:

1. analysis matrix with asset/effect search results;
2. parse fixes that expose confirmed fields without changing behavior;
3. damage/proc logic for complete rows;
4. status/proc runtime for complete rows;
5. visual/effect bundle updates for complete rows;
6. loader/runtime visual connections;
7. final matrix update with checks.

## Required checks

At minimum run:

```bash
node --check js/battle/BcuCombatModel.js
node --check js/battle/DamageAbilityResolver.js
node --check js/battle/ProcResolver.js
node --check js/main.js
```

Run additional checks for every touched file. For bundle work, run the exact bundle builder and integrity checker for the affected ZIP. If a browser run is not possible in the local environment, state that explicitly in the analysis document and provide the exact command the user should run.
