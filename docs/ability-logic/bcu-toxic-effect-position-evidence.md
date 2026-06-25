# BCU toxic hit effect position evidence

This note records the exact BCU facts used for the `POIATK` / `A_POISON` visual alignment fix.

## 1. POIATK spawns `A_POISON` as an `EAnimCont` on the target position/layer

From `battle/entity/Entity.java` in the BCU common source:

```java
if (atkProc.POIATK.mult > 0) {
    int rst = getProc().IMUPOIATK.mult;

    if (rst == 100) {
        anim.getEff(INV);
    } else {
        float poiDmg = atkProc.POIATK.mult * (100 - rst) / 10000f;

        if (this.dire == -1 && basis.canon.deco == DECO_BASE_BARRIER)
            poiDmg *= basis.b.t().getDecorationMagnification(basis.canon.deco, Data.DECO_TOXIC);

        damage = (long) (damage + maxH * poiDmg);

        basis.lea.add(new EAnimCont(pos, currentLayer, effas().A_POISON.getEAnim(DefEff.DEF)));
        basis.leaSort = true;

        CommonStatic.setSE(SE_POISON);
    }
}
```

Important facts:

- The effect position is the target entity `pos`.
- The effect layer is the target entity `currentLayer`.
- The constructor used is the 3-argument `EAnimCont(pos, currentLayer, eanim)` form.
- No explicit vertical offset is passed at the spawn site.

## 2. Three-argument `EAnimCont` means `offsetY = 0`

From `battle/entity/EAnimCont.java`:

```java
public EAnimCont(float p, int lay, EAnimD<?> ead) {
    pos = p;
    layer = lay;
    anim = ead;
    offsetY = 0f;
}

public EAnimCont(float p, int lay, EAnimD<?> ead, float offsetY) {
    pos = p;
    layer = lay;
    anim = ead;
    this.offsetY = offsetY;
}

public void draw(FakeGraphics gra, P p, float psiz) {
    p.y += offsetY * psiz;
    anim.draw(gra, p, psiz);
}
```

Important facts:

- `A_POISON` uses `offsetY = 0f` because BCU uses the 3-argument constructor.
- If an offset exists, BCU applies it as `p.y += offsetY * psiz`, not as the attack-smoke `75 * siz` road adjustment.

## 3. `StageBasis.lea` effects are drawn on the BCU layer baseline with `psiz`

From `page/battle/BattleBox.java`:

```java
float psiz = bf.sb.siz * sprite;
...
for(int i = 0; i < sb.lea.size(); i++) {
    EAnimCont eac = sb.lea.get(i);

    int dep = eac.layer * DEP;

    gra.setTransform(at);
    float p = getX(eac.pos);
    float y = midh - (road_h - dep) * bf.sb.siz;

    if (eac instanceof WaprCont) {
        float dx = ((WaprCont) eac).dire == -1 ? -27 * bf.sb.siz : -24 * bf.sb.siz;
        eac.draw(gra, setP(p + dx, y - 24 * bf.sb.siz), psiz);
    } else {
        eac.draw(gra, setP(p, y), psiz);
    }
}
```

Important facts:

- Normal `EAnimCont` effects use the BCU layer baseline: `midh - (road_h - layer * DEP) * siz`.
- They are drawn with `psiz = siz * sprite`.
- Only `WaprCont` has a special extra offset here. `A_POISON` is not a `WaprCont`.

## Implementation consequence

`A_POISON` must be rendered as an actor-priority `EAnimCont`, not as attack smoke. Its render formula is:

```text
screenX = BCU projectX(pos)
screenY = BCU layer baseline + offsetY * psiz
psiz    = siz * sprite * effectScale
```

For `A_POISON`, `offsetY = 0`, so the visual anchor is exactly the BCU layer baseline.

## SE timing (SE_POISON)

BCU `Entity.damaged` plays `SE_POISON` on the same line it adds the `A_POISON`
`EAnimCont`, and only when `POIATK.mult > 0` and the target's `IMUPOIATK` resist
`rst != 100` (full immunity shows `INV` and is silent). The hit is processed on an
`Entity`, so the base/castle never reaches this path.

rhg therefore drives `SE_POISON` from the actual effect application
(`bcuProcApplied` proc entries with `applied === true`, emitted only for
`targetType === 'actor'` and gated by `BcuProcImmunityPatch`), not from the proc
roll. A poison proc that whiffs on the base/castle or a fully poison-immune target
produces no `applied === true` entry and so plays nothing. See
`BattleSoundEventPatch.playAppliedProcSe`. `SE_WARP_ENTER` follows the same
application-driven rule (`Entity.getEff(P_WARP)` setSE).
