# BCU stage difficulty evidence

> **Status (2026-07-02): difficulty-label surface is out-of-scope.**
> The live UI filters and launches by Map_option crown stars
> (`js/battle/bcu-runtime/BcuStageCrownRuntime.js` + `js/ui/FormationStageDifficultyPatch.js`,
> locked by `scripts/check-bcu-stage-crown-parity.mjs`); raw `Difficulty.txt` ★1..★12
> labels are not rendered anywhere. The former label parser
> `js/bcu/BcuStageDifficultyRuntime.js` and its check
> `scripts/check-bcu-stage-difficulty-parity.mjs` had zero runtime consumers
> (import-graph audit) and were deleted. The BCU evidence below is retained for
> reference should a difficulty-label UI ever be wired in.

## BCU evidence

### common Java data fallback

`util/stage/MapColc.java` reads `./org/data/difficulty_level.tsv`. Each row starts with a map id. Column `i` after the first value is applied to stage index `i - 1`:

```java
qs = VFile.readLine("./org/data/difficulty_level.tsv");
...
int mapID = CommonStatic.safeParseInt(difficultyData[0]);
StageMap sm = getMap(mapID);
...
for (int i = 1; i < difficultyData.length; i++) {
    Stage st = sm.list.get(i - 1);
    if (st == null || st.info == null)
        continue;
    ((DefStageInfo) st.info).diff = (int) CommonStatic.safeParseFloat(difficultyData[i]);
}
```

`DefStageInfo.diff` defaults to `-1`.

### Android lang override

`LangLoader.readStageLang` reads external `lang/Difficulty.txt`. Its format is:

```text
mapCollection-map-stage<TAB>difficulty
```

It parses the first column into three ids, resolves `MapColc -> StageMap -> Stage`, and assigns `DefStageInfo.diff = num.toInt()`.

`GetStrings.getDifficulty(diff)` displays:

```kotlin
if (diff < 0) none else "★$diff"
```

## JS mapping

- `js/bcu/BcuStageDifficultyRuntime.js`
  - parses `public/assets/bcu/lang/Difficulty.txt`
  - canonicalizes `000-000-000` to `stage:0-0-0`
  - maps catalog numeric addresses such as mapColcId / mapNo / stageNo to canonical stage keys
  - maps `stageRN###_## -> stage:0-###-##`
  - maps `stageRNA###_## -> stage:13-###-##` when no catalog numeric address is available; BCU `MapColc.DefMapColc.read` maps collection code `A` to id `13`
  - maps `stageEX###_## -> stage:4-###-##`
  - formats difficulty as `★N`, and missing difficulty as `---`
  - records fallback reason as `stage-address-unresolved` or `difficulty-key-not-found-in-source-table` when displaying `---`

- `js/ui/FormationStageDifficultyPatch.js`
  - preserves the existing category -> map -> stage navigation
  - category root remains category-only
  - map-list level now filters by BCU stage-crown availability from `public/assets/generated/bcu-stage-crown-index.json`, not by raw `Difficulty.txt`'s 1..12 display values
  - the selector exposes four crown stages (`★1`..`★4`), defaults to `★1`, and treats maps absent from the crown index as single-crown `★1` maps
  - stage-list level still shows every stage in the opened map; the selected crown applies to the whole map at battle launch through `crownMagnificationPercent` / `crownStarIndex`
  - map name search remains scoped to the currently opened category, e.g. イベントステージ

## Tests

`scripts/check-bcu-stage-difficulty-parity.mjs` locks:

- Difficulty.txt parsing
- leading-zero triplet normalization
- `★N` formatting
- missing difficulty formatting
- stageRN / stageRNA / stageEX stage id mapping
- catalog numeric address mapping
- runtime difficulty resolution
- real `public/assets/bcu/lang/Difficulty.txt` representative stages: `stage:0-0-0 -> ★1`, `stage:13-0-0 -> ★10`, `stage:1-0-0 -> ★2`
- current category/map scoped filter candidates without all-stage leakage

`scripts/check-bcu-stage-crown-parity.mjs` separately locks the four-stage crown selector contract:

- Map_option-derived crown data is `★1`..`★4`, not raw 1..12 `Difficulty.txt`
- absent/single-crown maps match only `★1`
- selector source uses `data-stage-crown-star`, DOM fallback uses `data-stage-crown-stars`, and virtual map rendering checks `crownDataHasStar`
