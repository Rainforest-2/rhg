# BCU cat unit level evidence and JS mapping

## Conclusion

BCU ally/unit level is not a simple fixed multiplier. It is determined by:

1. `CommonStatic.Config.prefLevel` defaulting to 50.
2. `Unit.getPrefLvs()` converting that preferred level into normal level and plus level.
3. `Level` clamping normal level to `[1, Unit.max]` and plus level to `[0, Unit.maxp]`.
4. `UnitLevel.getMult(level + plusLevel)` using the 20-column `unitlevel.csv` curve.
5. `EForm.getEntity()` passing that multiplier into battle entity construction.
6. `Entity` / `AtkModelUnit` applying it to HP and attack damage. Some proc numeric fields are also magnified in BCU when their proc type indicates magnification.

## BCU evidence

### Preferred level default

Source: `common/CommonStatic.java`

```java
public int prefLevel = 50;
```

### Preferred level -> normal level / plus level

Source: `common/util/unit/Unit.java`

```java
public Level getPrefLvs() {
    Level l = new Level(this);
    int lv = CommonStatic.getConfig().prefLevel;
    l.setLevel(Math.min(lv, max));
    l.setPlusLevel(Math.min(rarity < 2 && maxp > 0 ? (int) ((lv - 1) / 49.0 * maxp) : 0, maxp));
    return l;
}
```

### Level clamp

Source: `common/util/unit/Level.java`

```java
public void setLevel(int lv) {
    this.lv = Math.max(1, Math.min(lv, unit.max));
}

public void setPlusLevel(int lv) {
    plusLv = Math.max(0, Math.min(lv, unit.maxp));
}
```

### Unit level curve multiplier

Source: `common/util/unit/UnitLevel.java`

```java
public float getMult(int lv) {
    int dec = lv;
    float d = 1f - lvs[0] * 0.01f;
    for (int mul : lvs) {
        if (dec >= 10) {
            d += mul * 0.1f;
            dec -= 10;
        } else {
            d += mul * dec * 0.01f;
            break;
        }
    }
    return d;
}
```

### Battle entity creation

Source: `common/util/unit/EForm.java`

```java
float d = f.unit.lv.getMult(level.getLv() + level.getPlusLv());
return new EUnit(..., d, ...);
```

### HP and attack scaling

Source: `battle/entity/Entity.java`

```java
maxH = (int) Math.round(de.getHp() * lvMagnif);
```

Source: `battle/attack/AtkModelEntity.java`

Unit attack construction uses `lvMagnif` for `AtkModelUnit`; the equivalent JS rule is:

```text
scaledDamage = trunc(round(rawAttack) * lvMagnif)
```

### Source CSV metadata

Source: `io/PackData.java`

BCU reads unit metadata from `org/data/unitbuy.csv` and unit level curve rows from `org/data/unitlevel.csv`:

```java
u.rarity = Integer.parseInt(strs[13]);
u.max = strs.length > 50 ? Identifier.parseInt(strs[50]) : 20;
u.maxp = strs.length > 51 ? Identifier.parseInt(strs[51]) : 0;
...
u.lv = new UnitLevel(data);
```

## JS implementation

### Core DB bundle

`scripts/build-bcu-core-db-bundle.mjs` now reads:

- `public/assets/bcu/000001/org/data/unitbuy.csv`
- `public/assets/bcu/000001/org/data/unitlevel.csv`

and stores per-unit metadata under `units.json`:

- `rarity`
- `maxLevel`
- `maxPlusLevel`
- `levelCurve.lvs[20]`
- source/debug metadata

### Repository layer

`js/bcu/BcuUnitRepository.js` preserves `levelMeta` on unit records and `stats.bcuUnitLevelMeta`.

### Runtime multiplier

`js/battle/bcu-runtime/BcuUnitLevelRuntime.js` implements:

- `getBcuUnitLevelMultiplier(level, lvs)` = BCU `UnitLevel.getMult`
- `getBcuPreferredPlusLevel(...)` = BCU `Unit.getPrefLvs` plus-level formula
- `resolveBcuUnitLevelConfig(...)`
- `applyBcuUnitLevelToStats(...)`

### Production roster wiring

`js/battle/BattleSceneBcuUnitLevelPatch.js` attaches the formation preferred level to BCU unit production entries before templates are loaded. This means the stats loader sees the requested BCU cat level before `BattleActorFactory` constructs actors.

### UI

`js/ui/FormationEditorBcuUnitLevelPatch.js` adds a `にゃんこ Lv` input to the formation screen. Default is 50, matching BCU `CommonStatic.Config.prefLevel`.

## Test

`scripts/check-bcu-unit-level-runtime-parity.mjs` fixes:

- default preferred level = 50
- `UnitLevel.getMult` curve behavior
- `getPrefLvs` plus-level formula
- clamping
- HP scaling
- attack hit scaling
- demon shield HP scaling
- non-magnified barrier health staying unchanged
