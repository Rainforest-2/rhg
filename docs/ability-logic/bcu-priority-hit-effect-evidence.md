# BCU priority hit effect evidence: critical, strong attack, metal killer

This note records the BCU facts used to validate and align the critical, strong-attack, and metal-killer hit visuals.

## 1. Entity hit effects

From `battle/entity/Entity.java` in the BCU common source:

```java
//75.0 is guessed value compared from BC
if (atk.getProc().CRIT.mult > 0) {
    basis.lea.add(new EAnimCont(pos, currentLayer, effas().A_CRIT.getEAnim(DefEff.DEF), -75f));
    basis.leaSort = true;

    CommonStatic.setSE(SE_CRIT);
}

//75.0 is guessed value compared from BC
if (atk.getProc().SATK.mult > 0) {
    basis.lea.add(new EAnimCont(pos, currentLayer, effas().A_SATK.getEAnim(DefEff.DEF), -75f));
    basis.leaSort = true;

    CommonStatic.setSE(SE_SATK);
}

if (metalKillerActivate) {
    basis.lea.add(new EAnimCont(pos, currentLayer, (dire == 1 ? effas().A_E_METAL_KILLER : effas().A_METAL_KILLER).getEAnim(DefEff.DEF), -75f));
    basis.leaSort = true;
}
```

Important facts:

- All three visuals are `StageBasis.lea` / `EAnimCont` effects, not attack-smoke effects.
- Position is the damaged entity `pos`.
- Layer is the damaged entity `currentLayer`.
- Vertical offset is `-75f`.
- Critical plays `SE_CRIT`; strong attack plays `SE_SATK`.
- Metal killer chooses the mirrored enemy variant `A_E_METAL_KILLER` when the damaged entity `dire == 1`.

## 2. Castle/base hit effects

From `battle/entity/ECastle.java`:

```java
int satk = atk.getProc().SATK.mult;
if (satk > 0) {
    ans *= (100 + satk) * 0.01;
    sb.lea.add(new EAnimCont(pos, 9, effas().A_SATK.getEAnim(DefEff.DEF), -75f));
    sb.leaSort = true;
    CommonStatic.setSE(SE_SATK);
}
if (atk.getProc().CRIT.mult > 0) {
    ans *= 0.01 * atk.getProc().CRIT.mult;
    sb.lea.add(new EAnimCont(pos, 9, effas().A_CRIT.getEAnim(DefEff.DEF), -75f));
    sb.leaSort = true;
    CommonStatic.setSE(SE_CRIT);
}
```

Important facts:

- Base/castle critical and strong-attack visuals use layer `9`.
- The same `-75f` offset is used.

## 3. Effect asset mapping

From `util/pack/EffAnim.java`:

```java
effas.A_CRIT = new EffAnim<>(stra + "critical", va, ica, DefEff.values());
...
effas.A_SATK = new EffAnim<>("./org/battle/s6/strong_attack", vsatk, icsatk, DefEff.values());
...
effas.A_METAL_KILLER = new EffAnim<>("./org/battle/s20/skill_metal_strong", vmk, icmk, DefEff.values());
effas.A_E_METAL_KILLER = new EffAnim<>("./org/battle/s20/skill_metal_strong", vmk, icmk, DefEff.values());
effas.A_E_METAL_KILLER.rev = true;
```

Important facts:

- Critical comes from the hit-effect bundle critical model/animation.
- Strong attack uses `org/battle/s6/strong_attack` with `skill006` image/imgcut.
- Metal killer uses `org/battle/s20/skill_metal_strong` with `skill020` image/imgcut.
- The enemy metal-killer variant is a reversed version of the same animation.

## 4. Render formula

From `page/battle/BattleBox.java` StageBasis.lea drawing:

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

And from `battle/entity/EAnimCont.java`:

```java
public void draw(FakeGraphics gra, P p, float psiz) {
    p.y += offsetY * psiz;
    anim.draw(gra, p, psiz);
}
```

Implementation consequence:

```text
screenX = BCU projectX(pos)
screenY = BCU layer baseline + (-75) * psiz
psiz    = siz * sprite * effectScale
```

For these three visuals, `effectScale` should be `1`. Attack-smoke's separate `1.2` multiplier and `+75` road adjustment must not be reused.
