# Phase 9 — Challenge Restrictions 実行契約

## 0. Phaseの目的

CustomStage schema v3の`challengeRestrictions`を、editor、candidate selection、challenge formation、battle start validation、production capacity、publication validationへ正しく接続する。

このPhaseは既存formation/stat/production/battle ownerを横断する。**新しい近似stat calculatorや並行capacity runtimeを作らず、現行ownerへ最小接続すること**が最重要。

## 1. 開始条件

- Phase 1 schema v3でrestriction version 1のnormalize/validate/roundtripが存在。
- Phase 5 canonical hashが`challengeRestrictions`をgameplayとして含む。
- Phase 6 detail/play/importがrestrictionを保持する。
- current level/plus/talent/orb/treasure/modification/cost/capacity ownerを再監査済み。
- `communityRestrictions` flagは既定OFF。

## 2. 現行owner map（実装開始時に再確認）

### Schema / local stage

```text
js/custom-stage/CustomStageSchema.js
  CUSTOM_STAGE_SCHEMA_VERSION = 3
  normalizeChallengeRestrictions
  validateChallengeRestrictions

js/custom-stage/CustomStageValidator.js
js/custom-stage/CustomStageStore.js
既存CustomStage adapter/runtime owner
```

Phase 1のschemaを別moduleへ複製しない。必要なら責務を安全に抽出するが、serialization shapeとmigrationを一元化する。

### Formation / levels

```text
js/battle/FormationStore.js
  formation.options.bcuCatUnitLevel
  formation.options.bcuCatUnitLevels
  formation.options.dogUnitMagnifications
  formation.options.bcuTalentLevels
  formation.options.bcuOrbEquipment
  formation.options.characterModifications

js/battle/BattleSceneBcuUnitLevelPatch.js
  resolveProductionCharacter / resolveProductionUnit wrapper
  base level + plus level request
  dog magnification
  combo modifiers
  treasure
  orb
  talent
  character modification attachment
```

現行順序を変更しない。restriction snapshotは通常stat resolutionを再利用しつつ、**comboだけ意図的に除外**する別contextを使う。

### Character modification / final stats

```text
js/character-modification/CharacterModificationResolver.js
js/character-modification/CharacterModificationDerivedModel.js
js/battle/BattleActorFactory.js
```

absolute override後のfinal stat/attack profileを使う。raw source objectをmutationしない。

### Cost / production

```text
js/battle/ProductionRuntime.js
  resolveBcuProductionValues
  applyCharacterModificationToProduction
  applyCustomStageProductionModifiers
  validateRequest
```

現行production orderを利用し、restriction costだけcombo discountを除外する専用context/resultを作る。UIで表示中のpriceを再計算しない。

### Capacity

```text
js/battle/ProductionRuntime.js::validateRequest
  wrapped by:
  BcuPlayerCapacityProductionPatch
  BcuMaxUnitSpawnLifetimePatch
  BcuRarityCapacityProductionPatch

js/battle/bcu-runtime/BcuPlayerCapacityRuntime.js
  getBcuEntityWill
  getBcuPlayerCapacityUsed
  getBcuIncomingCapacityCost
  canDeployBcuPlayerUnit
```

- capacity weightは`will + 1`。
- dead/removal占有解除は既存runtime。
- boot ownerは`js/boot/groups/battleDirectPatches.js`の順序。
-新しいProductionRuntimeやactor count gateを作らない。
- `maxConcurrentCapacity`は既存capacity max解決へ明示的なstage restriction sourceとして注入する。

## 3. 非目標

- 任意式DSL
- fixed/minimum level
- cost range
- target-trait実効damage/耐久
- comboを制限計算へ含めること
- serverが利用者のlevel/plus/talent/orbを保存すること
- normal formationをcommunity challenge用に上書きすること
- client UIだけの制限
- BattleScene内で独自eligibility計算

## 4. Restriction semantics

すべてAND。

判定順:

```text
1 army
2 whitelist / blacklist
3 form
4 rarity
5 effective level OR dog multipliers
6 maxHp
7 nominal attack total
8 cost
```

容量は単体eligibilityではなく、battle中のproduction aggregate gate。

Conflict:

- 同一characterがwhitelistとblacklist両方ならwhitelistがその直接conflictだけに優先。
- whitelist許可でもform/rarity/level/stats/cost制限は受ける。
- violationは最初の1件で停止せず全件返す。

## 5. Canonical candidate identity

Snapshot inputは名前・画像・ID範囲から推測しない。

```js
{
  characterId,
  side,                // canonical cat/dog source
  form,
  rarity,
  baseLevel,
  plusLevel,
  hpMultiplier,
  attackMultiplier,
  sourceRevision,
  modificationHash
}
```

- canonical character/form ID ownerを再利用。
- unknown side/form/rarity/IDはpublication structural validationで拒否。
- existenceしないformはallowedFormsとの比較対象から外すが、全allowedForms OFFはschema error。

## 6. Restriction stats resolver

推奨module境界:

```text
js/community/restrictions/
├─ CommunityRestrictionStatsResolver.js
├─ CommunityRestrictionEligibility.js
├─ CommunityRestrictionDiagnostics.js
└─ CommunityRestrictionFormationAdapter.js
```

Schema/normalizerをPhase 1 ownerから不必要に複製しない。

### 6.1 解決順

```text
1 canonical character/form
2 base level
3 plus level
4 talents
5 orbs
6 treasures
7 combos = disabled
8 normal BCU stat calculation
9 character modification absolute override
10 stage-specific final modifier
11 immutable restriction snapshot
```

existing ownerがこの順を1回で提供できない場合、通常pipelineへ`restrictionEvaluation` contextを追加する。normal battle pathを別式で再実装しない。

### 6.2 Effective level

```text
effectiveLevel = baseLevel + plusLevel
```

Boundary:

```text
banAtOrAbove = 50
Lv30+19 = 49 -> allowed
Lv30+20 = 50 -> banned
Lv50+0  = 50 -> banned
```

- thresholdちょうど禁止。
- plus値をdisplayとdiagnosticへ含める。
- plusをHP/attack normal statにも反映。

### 6.3 Dog multipliers

Dogはcat level ruleを使わない。

- current configured HP multiplier
- current configured attack multiplier
- each threshold exact boundary banned
- stage/enemy magnificationのsourceを取り違えない

### 6.4 maxHp

含む:

- level + plus
- talents
- orbs
- treasures
- character modification
- stage-specific final modifier

含まない:

- combos
- barrier/shield
- revive HP
- resistant/tough等のeffective durability
- target-dependent/runtime status

判定対象はbattle開始時のpure final maxHp。

### 6.5 nominalAttackTotal

```text
sum(all hit nominal damage in one attack action)
```

含む:

- level + plus
- talents/orbs/treasures
- character modification
- final hit structure

含まない:

- combos
- critical/massive/strong/target trait
- metal processing
- proc damage
- strengthen/status-dependent multiplier
- wave/surge/blast secondary damage unlessそのhit自体がattack profileのnominal direct hit契約に含まれると既存ownerで明示

multi-hit mapと`damage`の二重加算を避け、`BattleAttackProfile`/derived modelの正規hit listを使う。

### 6.6 Cost

Required order:

```text
BCU normal price resolution
-> combo discount disabled
-> character modification absolute cost override
-> custom stage globalCostMultiplier
-> floor
```

- current `resolveBcuProductionValues`のbaseDeployCostとdiscounted deployCostを区別。
- restriction contextではdiscountPercent=0相当を明示し、normal battle costを壊さない。
- modification override後にstage multiplier。
- threshold exact boundary banned。
- `ban-at-or-above`と`ban-at-or-below`のみ。

### 6.7 Capacity weight

```text
capacityWeight = getBcuEntityWill(unitDef) + 1
```

候補cardへ表示可能。eligibility単体ではbanしない。

## 7. Snapshot contract

Resolver output:

```js
{
  characterId,
  side,
  form,
  rarity,
  baseLevel,
  plusLevel,
  effectiveLevel,
  hpMultiplier,
  attackMultiplier,
  maxHp,
  nominalAttackTotal,
  productionCost,
  capacityWeight,
  sourceRevision,
  modificationHash,
  sources: {
    level,
    stats,
    attack,
    cost,
    capacity
  }
}
```

- plain immutable object。
- source object mutation禁止。
- expensive debug全量をproduction hot pathで恒常生成しない。
- cache identityへlevel/plus/talent/orb/treasure/modification/stage modifier/source revisionを含める。
- same inputsはdeterministic output。
- stale cacheでgame update/formation changeを見逃さない。

## 8. Eligibility output

```js
{
  eligible: boolean,
  violations: [
    {
      code,
      field,
      actual,
      threshold,
      messageKey,
      source
    }
  ],
  snapshot
}
```

- UI用日本語messageをlogicへ直書きしすぎず、stable code + safe formatter。
- actual/thresholdは有限・表示可能な値。
- colorだけに依存しない。
- unknown/unresolvable statsをallowed扱いにsilent fallbackしない。

## 9. Challenge formation

Owner:

```text
CommunityChallengeFormationStore
```

Rules:

- normal FormationStoreと別key/store。
- 初回のみnormal formationをcopy。
- 以後、全community stagesで最後のchallenge formationを共有。
- normal formationをmutationしない。
- stage選択後その場で編集可能。
- candidate list表示前に全candidateをeligibility評価。
- disabled cardでも理由panelを開ける。
- ineligible unitをslotへ追加不可。
- existing slotがgame update/level changeでineligibleになれば開始不可表示。
- battle start直前に全10slot再validate。
- empty slot policyは既存formation/battle requirementへ合わせる。
- storage corruption/version mismatchは明示error/安全なmigration。normal formationへfallbackして上書きしない。

## 10. UI/editor

### Restriction editor（CustomStage）

- enabled/disabled (`null` only represents no restriction)
- army
- whitelist/blacklist
- forms
- cat rarities
- cat effective-level threshold
- dog HP/attack multiplier thresholds
- maxHp / attackTotal thresholds
- cost mode/value
- maxConcurrentCapacity

Requirements:

- draft/save/cancel/reset。
- invalid shapeをsaveしない。
- whitelist enabled empty / forms empty / zero eligible structural caseを即時表示。
- threshold exact semanticsをlabelで明示（「N以上は禁止」）。
- 320px/phone landscape/iPad/software keyboard/safe area。
- focus return/ESC/back/reduced motion。
- nested modalを無秩序に増やさずexisting CustomStage modal hostを尊重。

### Candidate UI

Ineligible card:

- dim
- prohibition icon + `使用不可`
- clickable reason panel
- all violations
- actual and threshold
- add action disabled

## 11. Capacity integration

### Injection

`challengeRestrictions.maxConcurrentCapacity`を、selected community/custom stageのnormalized runtime definitionへ渡す。

既存`getBcuPlayerCapacityMax(scene)`のcandidate sourceに、明示的なrestriction fieldを追加するか、existing stage runtime fieldへadapterで設定する。意味の異なる`maxUnitSpawn`（lifetime/count limit）と混同しない。

### Production gate

- `ProductionRuntime.validateRequest` wrapper chainを維持。
- `BcuPlayerCapacityProductionPatch`の`canDeployBcuPlayerUnit`を再利用。
- stage hard limit / deploy limit / capacity reason priorityを既存契約と調整。
- refusal reasonへcapacity used/max/incomingを含める。
- spirit/summon等のlegacy consumersと同期ownerを壊さない。
- actor death/removalのcapacity releaseを再実装しない。

### Required tests

- will=0 -> weight1
- will=1 -> weight2
- used + incoming == max allowed
- used + incoming > max rejected
- dead but not removable occupancy follows existing rule
- normal stage default capacity unchanged
- restriction capacity absent unchanged
- maxUnitSpawn/deployLimit/capacity simultaneous reason/behavior
- boot wrapper order check

## 12. Publication validation

Two layers:

### Server structural

- schema shape/version
- army/forms/rarity/ID validity
- whitelist enabled nonempty
- canonical universe theoretical eligible count >0
- threshold/cost/capacity bounds
- no unknown IDs

Serverは利用者level/plus/talents/orbsを保存しない。

### Client current-state

投稿者current local stateで:

- base + plus
- talents/orbs/treasures
- modifications
- stage cost multiplier
- actual eligible count

0体ならpublishを止める。

別利用者では0体になり得る。detail/formation UIで現在状態0体を明示し、start不可。

Client validation結果をserver structural proofとして信用しない。両方必要。

## 13. Cache / invalidation

Invalidate on:

- selected form/change
- base/plus level
- talents
- orbs
- treasure config/revision
- character modification/hash
- stage modifiers/restrictions
- asset/source revision
- game data update

cache keyにobject identityだけを使わない。normal battle template cacheとrestriction snapshot cacheを混同しない。

## 14. Test matrix

### Logic

- any/cat-only/dog-only/mixed
- whitelist direct priority + other restrictions remain
- blacklist
- form 1-4 / nonexistent form
- rarity null/subset/unknown
- Lv30+19 / Lv30+20 / Lv50+0
- plus reflected in HP/attack
- dog HP/attack multiplier exact boundary
- maxHp exact boundary/exclusions
- multi-hit sum/no double count
- combo disabled for level/HP/attack/cost
- modification absolute stats/cost
- stage cost multiplier + floor
- cost above/below exact boundary
- all violations deterministic order
- unknown/unresolvable fail closed
- cache invalidation

### Formation/UI

- pre-selection disable
- reason panel all reasons
- normal formation unchanged
- challenge first-copy then independent persistence
- existing slot invalidation
- start-time 10-slot revalidation
- current-state zero eligible
- responsive/focus/keyboard/orientation

### Capacity

- will+1 boundaries
- concurrent units
- death/removal semantics
- normal default unchanged
- wrapper/import order
- stage maxUnitSpawn/deployLimit interaction

### Publish/import

- restriction roundtrip/hash difference
- server structural zero eligible
- client actual zero eligible
- imported restriction retained
- game update invalidates previous selection

## 15. 完了条件

- restriction statsはexisting resolver pipelineから取得し、近似式なし。
- effectiveLevel=base+plus、plusがHP/attackへ反映。
- comboが全restriction stat/costから除外。
- multi-hit nominal totalが正しい。
- cost orderが通常BCU→no combo→mod override→stage multiplier→floor。
- pre-selection disable + all reasons + start revalidation。
- challenge formationがnormal formationと独立。
- `maxConcurrentCapacity`がexisting will+1 ownerへ接続。
- structural/client zero eligible publication guard。
- flag OFF/normal stage/local existing behaviorに回帰なし。
- full focused/browser/runtime/boot-order testsが結果付き。

## 16. Terra用プロンプト

```text
Phase 9 restrictionsだけを実装してください。

本Phase文書、共通ガイド、7/23中核参照、current CustomStage schema、FormationStore、BattleSceneBcuUnitLevelPatch、CharacterModification resolver/derived model、ProductionRuntime、BcuPlayerCapacity runtime/patch chainを最初に再監査してください。

restriction editor、stats snapshot resolver、eligibility、pre-selection disable/all reasons、challenge formation、start revalidation、will+1 capacity既存owner接続、publication validationを対象にします。新しい近似stat calculator、並行capacity runtime、normal formation mutation、boot/wrapper順変更は禁止です。

effectiveLevel=base+plus、plusのHP/attack反映、combo全除外、multi-hit total、cost順、capacity boundaryを先にdeterministic testsで固定してください。

focused logic/runtime/boot-order/browser/publish-import tests、full available checks、build、cache invalidation確認、git diff自己レビューまで実行してください。owner/順序が現行コードと矛盾する場合は推測で進めず停止・報告してください。問題があれば修正・再検証し、共通報告形式で返してください。
```
