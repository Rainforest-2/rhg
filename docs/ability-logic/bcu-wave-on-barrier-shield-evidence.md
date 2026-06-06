# BCU wave behavior when barrier/shield blocks damage

## Conclusion

BCU generates WAVE / MINIWAVE when a direct attack captures at least one target, even if `Entity.damaged(atk)` returns `false` because a barrier or demon shield blocked the damage.

Therefore JS must not gate initial WAVE / MINIWAVE creation only on `result.accepted === true` from `takeDamage()`. A barrier/shield blocked hit is still a captured hit for BCU wave creation.

## BCU evidence

Source: `BCU_java_util_common/battle/attack/AttackSimple.java`

`AttackSimple.excuse()` processes every captured entity first:

```java
for (AbEntity e : capt) {
    boolean damaged = e.damaged(this);
    attacked.add(e);
    if (e instanceof Entity && damaged)
        ((Entity) e).lastHitBy.add(this);
}
```

Then WAVE creation checks `!capt.isEmpty()` rather than checking `damaged`:

```java
if (!capt.isEmpty() && proc.WAVE.exists()) {
    ...
    ContWaveDef wave = new ContWaveDef(new AttackWave(attacker, this, p0, wid, WT_WAVE), p0, layer, -3);
    if(attacker != null) {
        attacker.summoned.add(wave);
    }
}
```

MINIWAVE uses the same gate:

```java
if(!capt.isEmpty() && proc.MINIWAVE.exists()) {
    ...
    ContWaveDef wave = new ContWaveDef(new AttackWave(attacker, this, p0, wid, WT_MINI), p0, layer, -1);
    if(attacker != null) {
        attacker.summoned.add(wave);
    }
}
```

Source: `BCU_java_util_common/battle/entity/Entity.java`

Barrier can block the current damage and make `damaged()` return `false`:

```java
boolean barrierContinue = status[P_BARRIER][0] == 0;
...
if (!barrierContinue) {
    if (atk.getProc().BREAK.prob > 0) {
        barrier.breakBarrier(true);
        barrierContinue = true;
    } else if (dmg >= status[P_BARRIER][0]) {
        barrier.breakBarrier(false);
        cancelAllProc();
    } else {
        anim.getEff(BREAK_NON);
        cancelAllProc();
    }
}
...
if (!barrierContinue)
    return false;
```

Demon shield can also block and return `false`:

```java
boolean shieldContinue = currentShield == 0;
...
if (!shieldContinue) {
    if (atk.getProc().SHIELDBREAK.prob > 0) {
        currentShield = 0;
        anim.getEff(SHIELD_BREAKER);
        shieldContinue = true;
    } else if (dmg >= currentShield) {
        currentShield = 0;
        anim.getEff(SHIELD_BROKEN);
    } else {
        currentShield -= dmg;
        ...
        anim.getEff(SHIELD_HIT);
    }
}
...
if (!shieldContinue)
    return false;
```

The important ordering is:

1. `AttackSimple.excuse()` captures targets into `capt`.
2. `Entity.damaged(atk)` may return `false` for barrier/shield blocks.
3. `AttackSimple.excuse()` still checks only `!capt.isEmpty()` for WAVE/MINIWAVE creation.

## JS implementation requirement

For direct non-wave/non-surge/non-blast attacks, if `queueAttackDamage()` returns `{ accepted:false, blocked:true, blockedBy:'barrier'|'shield' }`, JS should still create initial WAVE/MINIWAVE containers when the original damage calculation contains `wave` or `miniWave` proc items.

This is implemented by `js/battle/BattleSceneBcuWaveOnBlockedHitPatch.js` and fixed by `scripts/check-bcu-wave-on-barrier-shield-block-parity.mjs`.
