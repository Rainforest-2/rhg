# BCU ability source evidence

Updated: 2026-06-24.

This is a source-fact inventory for current parity work in `Rainforest-2/rhg`. It records what the inspected BCU sources establish. It is not a completion claim: each row still needs a current JS-owner audit, deterministic checks, and—where visible—manual browser review.

## Source priority

1. Checked-in BCU reference ZIPs under `references/bcu/`.
2. Current rhg code and deterministic tests.
3. Generated semantic ZIP inventory and loader evidence.
4. Historical reports only when current source/code confirms the same claim.

## Evidence inventory

| Area | BCU source owner / holder | Established behavior | Current rhg boundary |
|---|---|---|---|
| P_DELAY | `EUnit/EEnemy.processProcs`, `EUnit/EEnemy.postUpdate`, `ELineUp.delay`, `EStage.delay`, `StageBasis` | Accepted delay accumulates, then player cooldown and enemy stage-row delay flush through their own owners. `A_E_DELAY` starts at proc acceptance. | Runtime/effect/coordinate checks exist; exact browser appearance is unaccepted. |
| Burrow | `DataEnemy`, `Entity.startBurrow/updateBurrow/touchable/updateMove`, `StageBasis.inRange` | `ints[43]` count, `ints[44]/4` distance; negative KB phases govern down/underground/up; touchability changes by phase. | Lifecycle/collision/targetability tests exist; visual acceptance pending. |
| Zombie revive / soulstrike / death surge | `DataEnemy`, `DataUnit`, `Entity.ZombX`, `AttackSimple`, `AtkModelEntity` | Corpse state, show-window targetability, zombie killer, soulstrike cancellation, revive HP/timing, and death-surge timing are entity-owned. | Standard path is tested; real extra/custom revive source/range coverage is partial. |
| Mini-death-surge | `EUnit.processAbilityOrbs`, death animation owner | Proven holder is ORB_DEATH_SURGE; full and mini death-surge rolls are mutually exclusive. | Holder and runtime are tested; browser appearance pending. |
| SUMMON | `Proc.SUMMON`, `AtkModelEntity.setProc/invokeLater`, `AtkModelUnit/Enemy.summon`, `Entity.setSummon`, `EntCont`, `SCDef/SCGroup` | SUMMON is proc-object/custom attack data; attack model owns immediate/deferred spawn and stage allow/group behavior. | Explicit proc-object runtime exists. Normal CSV holder is unproven and automatic real custom-pack loading is incomplete. |
| Spirit | `DataUnit.ints[110]`, `StageBasis`, `LineUp`, `EUnit` | Spirit is production/stage state, not an ordinary proc status. It has cooldown, one-spirit-per-summoner, pre-warp summon origin, side-capacity gating, attack-on-add, damage rejection, and self-removal after attack. | Runtime and attack-only bundle path exist; actor/A_IMUATK visual acceptance pending. |
| Castle/base guard | `StageBasis.activeGuard`, `ECastle.damaged/guardBreak`, `Entity.postUpdate`, `EffAnim` | Guard is scene/base state; it holds base damage and has hold/break effects. | Runtime/checks exist; browser acceptance pending. |
| Plain castle attack | `ECastle` | Plain castles do not own an attack runtime. Boss bases are `EEnemy`; stage triggers are `EStage/StageBasis`. | Negative evidence: do not create a castle-owned attack system. |
| Basic/non-basic cannon | `Cannon`, `StageBasis`, `Treasure`, `CannonLevelCurve`, `Data` | Cannon has its own owner, per-id timing/geometry/targeting, and level curve. BASE_WALL is an entity lifecycle. | Runtime owner and checks exist; per-cannon bitmap aliases and exact visuals remain open. |
| Combo/orb/treasure/talent/PCoin | `BasisLU`, `LineUp`, `Treasure`, `EUnit/EEnemy`, `PCoin`, attack construction | Modifiers originate in basis/lineup/entity construction and can affect stats, damage, proc payloads, resistance, and traits. BCU cat deploy cost starts from `DataUnit.price`, then `Form/EForm.getPrice(sta)` applies `price * (1 + sta * 0.5)`; default `StageMap.price=1` makes ordinary deploy cost 1.5x raw price before internal `ELineUp.price = 100 * ...`. | Core hooks exist; broad real-data and browser acceptance remain partial. |
| `Trait.targetForms` | `Entity.traitCompatible`, `EEnemy.getDamage` | Compatibility depends on target type/form metadata in addition to ordinary shared traits. | Focused runtime fixtures exist; real custom trait/form and capture/proc coverage remains incomplete. |
| Toxic immunity | `DataUnit`, `DataEnemy`, `Entity.damaged` | Unit direct `IMUPOIATK` holder exists. Inspected normal enemy data exposes toxic attack but no enemy toxic-immunity holder. | Do not add enemy CSV toxic-immunity parsing. |
| Bounty/money visual | `Entity.damaged`, `EEnemy.kill`, `EUnit.postUpdate`, effect inventory | Bounty is kill/economy state. No dedicated battle visual owner or stable alias is proven. | Keep logic-only unless future source evidence changes this. |
| Special castle boss spawn | `CastleImg`, `CommonStatic.bossSpawnPoint`, `StageBasis` | Special castle data determines boss/base spawn coordinate. | Formula/bundle/runtime bridge are implemented and tested. |
| Save / lineup compatibility | BCU serialization owner not identified in this audit scope | No BCU schema, import, export, or round-trip claim can be made yet. | rhg uses repository-local browser persistence; treat BCU compatibility as unconfirmed. |

## Audit correction note

The 2026-06-23 audit confirmed that historical README claims about current StageDefinitionLoader defects were stale. Current source evidence should be combined with current code before opening a task:

- historical source facts may remain valid;
- historical statements about rhg implementation state do not remain valid automatically;
- an implemented runtime with incomplete real-data loading must be documented as such, not as “missing runtime.”

## Use before implementation

For each new change, record:

```text
BCU file/class/method -> field or state transition -> current JS owner -> test/fixture -> remaining visual or loader boundary
```

When source proof is insufficient, write `unconfirmed` or `negative-evidence`; do not infer a holder, asset alias, or persistence format from a familiar name.
