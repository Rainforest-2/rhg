# BCU stage difficulty evidence

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
  - maps `stageRNA###_## -> stage:1-###-##`
  - maps `stageEX###_## -> stage:4-###-##`
  - formats difficulty as `★N`, and missing difficulty as `---`

- `js/ui/FormationStageDifficultyPatch.js`
  - preserves the existing category -> map -> stage navigation
  - category root remains category-only
  - map-list level filters only maps inside the currently opened category, e.g. イベントステージ
  - stage-list level filters only stages inside the currently opened map
  - adds difficulty badges to map cards and stage cards

## Tests

`scripts/check-bcu-stage-difficulty-parity.mjs` locks:

- Difficulty.txt parsing
- leading-zero triplet normalization
- `★N` formatting
- missing difficulty formatting
- stageRN / stageRNA / stageEX stage id mapping
- catalog numeric address mapping
- runtime difficulty resolution
