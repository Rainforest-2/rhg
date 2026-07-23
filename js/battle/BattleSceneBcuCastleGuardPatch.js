import { BattleBase } from './BattleBase.js';
import { BattleScene } from './BattleScene.js';
import { holdCastleGuardDamage, initializeBcuCastleGuard, isEnemyCastleGuardTarget, tickBcuCastleGuard } from './bcu-runtime/BcuCastleGuardRuntime.js';

const BASE_PATCH_FLAG = Symbol.for('wanko-battle.base-castle-guard.v1');
const SCENE_PATCH_FLAG = Symbol.for('wanko-battle.scene-castle-guard.v1');

export function installBattleSceneBcuCastleGuardPatch() {
  const baseProto = BattleBase?.prototype;
  if (baseProto && !baseProto[BASE_PATCH_FLAG]) {
    baseProto[BASE_PATCH_FLAG] = true;
    const originalTakeDamage = baseProto.takeDamage;
    baseProto.takeDamage = function takeDamageWithBcuCastleGuard(amount, meta = {}) {
      const held = holdCastleGuardDamage(meta?.scene || this.scene || globalThis.__APP__?.scene || null, this, amount, meta);
      if (held.held) return held;
      return originalTakeDamage.call(this, amount, meta);
    };
  }

  const sceneProto = BattleScene?.prototype;
  if (sceneProto && !sceneProto[SCENE_PATCH_FLAG]) {
    sceneProto[SCENE_PATCH_FLAG] = true;

    const originalBuildStageRuntime = sceneProto.buildStageRuntime;
    sceneProto.buildStageRuntime = function buildStageRuntimeWithBossGuard() {
      const runtime = originalBuildStageRuntime.call(this);
      const bossGuard = this.stage?.definition?.bossGuard ?? this.stage?.runtime?.bossGuard ?? runtime?.bossGuard ?? null;
      runtime.bossGuard = Number.isFinite(Number(bossGuard)) ? Number(bossGuard) : bossGuard;
      return runtime;
    };

    const originalSpawnStageEnemy = sceneProto.spawnStageEnemy;
    sceneProto.spawnStageEnemy = function spawnStageEnemyWithBossFlag(unitDef, row) {
      const before = this.actors.length;
      const ok = originalSpawnStageEnemy.call(this, unitDef, row);
      if (ok) {
        const actor = this.actors.slice(before).find((a) => a?.slotId === unitDef?.slotId) || this.actors[this.actors.length - 1];
        if (actor) {
          actor.bossFlag = Number(row?.bossFlag || 0) || 0;
          actor.stageSpawnRow = row || null;
          actor.lastBcuCastleGuardBossDebug = {
            source: 'BattleSceneBcuCastleGuardPatch.spawnStageEnemy',
            bossFlag: actor.bossFlag,
            bcuReference: 'StageBasis.checkGuard tests EEnemy.mark >= 1 and anim.dead == -1'
          };
        }
      }
      return ok;
    };

    const originalQueueAttackDamage = sceneProto.queueAttackDamage;
    sceneProto.queueAttackDamage = function queueAttackDamageWithCastleGuard(attacker, target, targetType, event, meta = {}) {
      if (targetType === 'base' || isEnemyCastleGuardTarget(target)) {
        initializeBcuCastleGuard(this);
        const damage = Number(event?.damage ?? 0);
        const held = holdCastleGuardDamage(this, target, damage, { ...meta, timeMs: this.timeMs });
        if (held.held) return held;
      }
      return originalQueueAttackDamage.call(this, attacker, target, targetType, event, meta);
    };

    const originalRunTickPhase = sceneProto.runTickPhase;
    sceneProto.runTickPhase = function runTickPhaseWithCastleGuard(phase, fn = () => {}) {
      if (phase === 'enemy-spawn') {
        initializeBcuCastleGuard(this);
        tickBcuCastleGuard(this);
      }
      const result = originalRunTickPhase.call(this, phase, fn);
      if (phase === 'cleanup' || phase === 'base-post-update') tickBcuCastleGuard(this);
      return result;
    };
  }
}

installBattleSceneBcuCastleGuardPatch();
