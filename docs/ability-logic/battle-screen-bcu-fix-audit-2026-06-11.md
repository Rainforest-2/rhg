# Battle screen BCU fix audit (2026-06-11)

Scope: five reported battle-screen defects. BCU references are
`/tmp/bcu-ref/common` = `references/bcu/BCU_java_util_common.zip` (extracted).

## 1. Unit card rail shifted right (fixed)

- Root cause: `css/ui-polish.css` applied the shared `gameUiEnter` entrance
  animation (`animation-fill-mode: both`) to `.prod-ui .cards`. Its 100%
  keyframe transform `translateY(0) scale(1)` permanently replaced the base
  centering transform `translateX(-50%)` from `css/style.css`
  (`.prod-ui .cards{left:50%;transform:translateX(-50%)}`), shifting the rail
  right by half its own width.
- Fix: `.prod-ui .cards` now uses dedicated `battleCardsEnter` keyframes whose
  every frame preserves `translateX(-50%)`. No DOM, selector, or input-handler
  changes.
- Verification: Playwright (1180x820 iPad-landscape viewport) measured
  `cards.center.x === canvas-panel.center.x` (delta 0px), computed transform
  `matrix(1,0,0,1,-302,0)` for a 604px rail, `animationName: battleCardsEnter`.
  Safe-area padding (`env(safe-area-inset-bottom)`) untouched.
- Guard: `scripts/check-battle-card-rail-centering.mjs`.

## 2. Toxic (P_POIATK) effect invisible (fixed — same root cause as 5)

- Split test: the toxic *logic and effect spawn* both live in
  `js/battle/BattleActorProcStatusPatch.js` (`applyToxic` →
  `spawnBcuToxicHitEffect`, A_POISON from `waveEffectAssets.toxic`). The proc
  never fired because that module was not loaded in production (see 5), so
  neither damage nor visual happened.
- After restoring the boot import, in-browser apply of
  `{key:'toxic', payload:{mult:20}}` on a live enemy produced
  `damage = trunc(maxHp*20/100) = 3000` through
  `takeDamage -> resolvePostDamage` (BCU `Entity.processProcs` POIATK:
  `maxH * mult * (100-rst)/10000`, immediate damage, no status slot) and
  spawned effect `bcu-toxic-A_POISON-*` at the target's `posBcu`,
  `currentLayer`, lifetime = anim frame count × 33ms. Screenshot
  `tmp/verify-shots/toxic-visual.png` shows the purple A_POISON splash on the
  target.
- BCU reference: `Entity.processProcs` POIATK branch adds
  `EAnimCont(pos, currentLayer, effas().A_POISON.getEAnim(DEF))`, offsetY=0 —
  matches `BCU_TOXIC_EFFECT_OFFSET_Y = 0`, `BCU_SCALE_MODE.ACTOR_PRIORITY_EFFECT`.

## 3. Zombie burrow (verified working; data + runtime chain intact)

- Only enemies with `DataEnemy` ints[43] (count) / ints[44]/4 (distance) get
  `bcuCombatModel.proc.burrow` (19 such enemies in core-db, e.g. 284 ゾンビワン
  count=1 dis=500, 303 墓手花子 count=-1). Non-burrow zombies never dig —
  already enforced by `burrowSpec()` returning null.
- Trigger point parity (BCU `Entity.update2`):
  `status[P_BURROW][0] != 0 && !skipSpawnBurrow && (base.pos - pos)*dire > touchBase`
  at contact. JS hook: `BattleActorBcuBurrowPatch` wraps
  `BattleScene.startActorAttack`; `canStartBcuBurrow` rejects with
  `base-not-ahead` when the opposing base is within `touchBase` — confirmed
  live (distance 316 < touchBase 320 → attack base, no burrow: BCU-correct).
- Live verification (enemy 284, real attack/tick pipeline): contact with a unit
  mid-field → `bcuBurrowStarted`, phases `down(anim04) → move(anim05,
  untargetable, distanceRemaining 500→0, 0.5×speed per frame) → up(anim06,
  targetable)`, then normal move/attack; burrow count exhausted (1→0), no
  re-burrow. Screenshots `tmp/verify-shots/enc-burrow-*.png`.
- Burrow animations come from actor bundle `extraActorAnimations`
  (`*_e_zombie00/01/02.maanim` → anim04/05/06, BCU `AnimUD` TYPE7
  BURROW_DOWN/MOVE/UP); spawn defers while they preload and the stage spawn
  runtime retries (`retryDelayFrame: 1`).
- Note: a burrow zombie that never touches a unit before reaching the base
  never digs — that is BCU behavior, not a defect.

## 4. Zombie death → corpse → revive (verified BCU-conformant)

- Live run (enemy 284, killed via real attack pipeline):
  - death → `BattleActorZombieRevivePatch.resolvePostDamage` schedules revive:
    `readyAt = now + (revive.time 240 + REVIVE anim len) frames` (BCU
    `ZombX.doRevive`: `status[P_REVIVE][1] = time + A_ZOMBIE.REVIVE len`).
  - corpse visual `down` (A_ZOMBIE DOWN held pose) with base actor hidden
    (`bcuRenderOverride.hideBaseActor=true`; BCU `AnimManager.draw` returns
    before base draw while `status[P_REVIVE][1] >= REVIVE_SHOW_TIME`).
  - switch to `revive` phase at remainingFrames 39 ≈ REVIVE.len()-2 (BCU
    `ZombX.update`), base actor redraws below REVIVE_SHOW_TIME
    (hideBase=false at remaining 13).
  - revival exactly at readyAt with hp = trunc(maxHp×50/100) = 7500/15000,
    state `move`, corpse effect removed.
  - Screenshots `tmp/verify-shots/rev-corpse-down.png`, `rev-revived.png`.
- Zombie-killer blocking and soulstrike corpse targeting unchanged; covered by
  `scripts/check-bcu-zombie-corpse-soulstrike-parity.mjs` (PASS).

## 5. Only knockback worked on enemies (fixed — boot regression)

- Root cause: commit `9e52882d5` ("Load regression fixes for tuning UI after
  stage filters") dropped `await import('./battle/BattleActorProcStatusPatch.js')`
  from `js/main.js`, and the later split into `js/boot/battle/*` groups never
  re-added it. That module defines `BattleActor.prototype.applyBcuProc`,
  `isBcuProcStatusActive`, the P_SLOW move override, the P_WEAK damage
  multiplier, warp targetability, and the status tick. Without it,
  `BcuProcImmunityPatch` wrapped an undefined `previousApply`, so every status
  proc returned `{applied:false, reason:'previous-applyBcuProc-missing'}` in
  production. Knockback still *looked* functional because damage knockback
  (HP-threshold KB via `KBRuntime`/`startKnockback`) does not go through
  `applyBcuProc`.
- Why tests stayed green: `tests/bcu-combat-parity.test.mjs` and the check
  scripts import `BattleActorProcStatusPatch.js` directly.
- Fix: re-import it in `js/boot/battle/installBattleCorePatches.js` at the
  pre-regression position (after `BattleActorBcuKbTargetPatch`, before
  `BattleToxicEffectAssetPatch`, and before the lifecycle group installs
  `BcuProcImmunityPatch`), preserving the original wrapper order.
- Live verification on a real enemy actor (through the immunity wrapper):
  freeze/slow/weaken/curse/seal all `applied:true` with frame countdowns
  (`framesRemaining: 90`, BCU status overwrite semantics), toxic as in 2.
  Immunity/resistance paths unchanged
  (`scripts/check-proc-immunity-resistance-parity.mjs` PASS).
- Guard: `scripts/check-battle-boot-proc-patches.mjs` executes the real boot
  installer groups and asserts the chain end-to-end (fails if the import is
  removed again — negative-tested).

## Diagnostics note

`BattleDebugStripPatch` deletes `__BCU_*` debug globals and disables
`pushEvent` at battle init; production debugging must probe
`BattleActor.prototype` / actor instances, not the stripped globals.
