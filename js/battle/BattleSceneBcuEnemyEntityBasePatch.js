import { BattleScene } from './BattleScene.js';
import { TEMPLATE_LOAD_LEVEL } from './BattleActorFactory.js';
import { BattleSceneRenderer } from './BattleSceneRenderer.js';

const SCENE_PATCH_FLAG = Symbol.for('wanko-battle.bcu-enemy-entity-base.v1');
const RENDER_PATCH_FLAG = Symbol.for('wanko-battle.bcu-enemy-entity-base-render.v1');

function getEnemyEntityBaseRow(scene) {
  const row = scene?.stage?.runtime?.enemyBaseRow || null;
  return row?.baseEnemy === true || row?.isBcuEnemyEntityBase === true ? row : null;
}

function getEnemyEntityBaseActor(scene) {
  const direct = scene?.bcuEnemyEntityBaseActor || null;
  if (direct && (scene?.actors || []).includes(direct)) return direct;
  return (scene?.actors || []).find((actor) => actor?.isBcuEnemyEntityBase === true) || direct;
}

function getEnemyEntityBaseDef(scene) {
  const row = getEnemyEntityBaseRow(scene);
  if (!row) return null;
  const rowIndex = row.rowIndex;
  return (scene?.stageEnemyUnitDefs || []).find((def) => def?.stageSpawn?.baseEnemy === true || def?.stageSpawn?.rowIndex === rowIndex) || null;
}

function getCatBase(scene) {
  return (scene?.bases || []).find((base) => base?.side === 'cat-enemy') || null;
}

function getActorHpPercent(actor) {
  const hp = Number(actor?.hp);
  const maxHp = Number(actor?.maxHp);
  if (!Number.isFinite(hp) || !Number.isFinite(maxHp) || maxHp <= 0) return null;
  return Math.max(0, Math.min(100, (hp / maxHp) * 100));
}

function syncEnemyEntityBasePlaceholder(scene, actor = getEnemyEntityBaseActor(scene)) {
  const base = getCatBase(scene);
  if (!base || !scene?.stage?.runtime?.hasEnemyBaseEntity) return;
  base.isBcuEnemyEntityBasePlaceholder = true;
  base.visualSuppressed = true;
  base.attackable = false;
  base.debug = {
    ...(base.debug || {}),
    bcuEnemyEntityBasePlaceholder: true,
    source: 'BCU EStage.base() / StageBasis ebase=EEnemy'
  };
  if (actor) {
    base.hp = Number.isFinite(actor.hp) ? Math.max(0, actor.hp) : base.hp;
    base.maxHp = Number.isFinite(actor.maxHp) && actor.maxHp > 0 ? actor.maxHp : base.maxHp;
    base.destroyed = !(actor.isAlive?.() === true || actor.isRenderable?.() === true);
    base.bcuEnemyEntityBaseActorId = actor.instanceId || actor.label || null;
  }
}

function resolveEnemyEntityBaseSpawnX(scene, row) {
  const runtime = scene?.stage?.runtime || {};
  if (typeof runtime.getSpawnWorldX === 'function') {
    const resolved = runtime.getSpawnWorldX('cat-enemy', { baseEnemy: true, bossFlag: true, row });
    if (Number.isFinite(resolved?.worldX)) return resolved.worldX;
  }
  if (Number.isFinite(runtime.enemyBaseEntitySpawnWorldX)) return runtime.enemyBaseEntitySpawnWorldX;
  if (Number.isFinite(runtime.bossSpawnWorldX)) return runtime.bossSpawnWorldX;
  return Number.isFinite(runtime.enemySpawnWorldX) ? runtime.enemySpawnWorldX : 700;
}

async function ensureEnemyEntityBase(scene) {
  const row = getEnemyEntityBaseRow(scene);
  if (!row) return null;
  const existing = getEnemyEntityBaseActor(scene);
  if (existing) {
    syncEnemyEntityBasePlaceholder(scene, existing);
    return existing;
  }

  const unitDef = getEnemyEntityBaseDef(scene);
  if (!unitDef || unitDef.unavailable) {
    scene.pushEvent?.({
      type: 'bcuEnemyEntityBaseUnavailable',
      rowIndex: row.rowIndex ?? null,
      enemyId: row.enemyId ?? null,
      reason: unitDef?.unavailable ? 'enemy-asset-missing' : 'unit-def-missing'
    });
    syncEnemyEntityBasePlaceholder(scene, null);
    return null;
  }

  await scene.actorFactory?.preloadTemplate?.(unitDef, {
    level: TEMPLATE_LOAD_LEVEL.SPAWN_READY,
    animIds: [unitDef.idleAnimId, unitDef.moveAnimId, unitDef.attackAnimId].filter(Boolean)
  });

  const spawnRow = { ...row, baseEnemy: true, isBcuEnemyEntityBase: true, bossFlag: true };
  const actor = scene.spawnActor?.(unitDef, 'cat-enemy', false, {
    x: resolveEnemyEntityBaseSpawnX(scene, spawnRow),
    row: spawnRow,
    currentLayer: Number.isFinite(row.layerMin) ? row.layerMin : Number.isFinite(row.frontLayer) ? row.frontLayer : 0,
    bcuRenderLayerSource: 'bcu-enemy-entity-base-row'
  });

  if (!actor) {
    scene.pushEvent?.({
      type: 'bcuEnemyEntityBaseSpawnRejected',
      rowIndex: row.rowIndex ?? null,
      enemyId: row.enemyId ?? null,
      reason: 'spawnActor-returned-null'
    });
    syncEnemyEntityBasePlaceholder(scene, null);
    return null;
  }

  actor.isBcuEnemyEntityBase = true;
  actor.bcuEnemyEntityBaseSource = 'BCU EStage.base() / StageBasis ebase=EEnemy';
  actor.bcuStageRowIndex = row.rowIndex ?? null;
  actor.stageSpawnRowIndex = row.rowIndex ?? null;
  actor.stageSpawn = spawnRow;
  actor.currentLayer = Number.isFinite(actor.currentLayer) ? actor.currentLayer : (Number.isFinite(row.layerMin) ? row.layerMin : 0);
  scene.bcuEnemyEntityBaseActor = actor;
  syncEnemyEntityBasePlaceholder(scene, actor);
  scene.pushEvent?.({
    type: 'bcuEnemyEntityBaseSpawned',
    actor: actor.instanceId || actor.label || null,
    rowIndex: row.rowIndex ?? null,
    enemyId: row.enemyId ?? null,
    x: actor.x,
    hp: actor.hp,
    maxHp: actor.maxHp
  });
  return actor;
}

export function installBattleSceneBcuEnemyEntityBasePatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[SCENE_PATCH_FLAG]) return;
  proto[SCENE_PATCH_FLAG] = true;

  const originalInit = proto.init;
  if (typeof originalInit === 'function') {
    proto.init = async function initWithBcuEnemyEntityBase(...args) {
      const result = await originalInit.apply(this, args);
      await ensureEnemyEntityBase(this);
      return result;
    };
  }

  const originalGetEnemyBaseHpPercent = proto.getEnemyBaseHpPercent;
  proto.getEnemyBaseHpPercent = function getEnemyBaseHpPercentWithBcuEnemyEntityBase(...args) {
    if (this?.stage?.runtime?.hasEnemyBaseEntity) {
      const actor = getEnemyEntityBaseActor(this);
      const percent = getActorHpPercent(actor);
      if (Number.isFinite(percent)) return percent;
      if (actor && actor.isAlive?.() === false) return 0;
    }
    return typeof originalGetEnemyBaseHpPercent === 'function' ? originalGetEnemyBaseHpPercent.apply(this, args) : 100;
  };

  const originalFindEnemyBase = proto.findEnemyBase;
  if (typeof originalFindEnemyBase === 'function') {
    proto.findEnemyBase = function findEnemyBaseWithBcuEnemyEntityBase(actor, ...rest) {
      if (actor?.side === 'dog-player' && this?.stage?.runtime?.hasEnemyBaseEntity) {
        const baseActor = getEnemyEntityBaseActor(this);
        if (baseActor?.isTargetable?.() === true || baseActor?.isAlive?.() === true) return null;
      }
      return originalFindEnemyBase.call(this, actor, ...rest);
    };
  }

  const originalUpdateBattleState = proto.updateBattleState;
  if (typeof originalUpdateBattleState === 'function') {
    proto.updateBattleState = function updateBattleStateWithBcuEnemyEntityBase(...args) {
      if (this?.stage?.runtime?.hasEnemyBaseEntity) {
        const dog = (this.bases || []).find((base) => base?.side === 'dog-player');
        const actor = getEnemyEntityBaseActor(this);
        syncEnemyEntityBasePlaceholder(this, actor);
        if (dog?.destroyed) this.battleState = 'cat-win';
        else if (actor && actor.isAlive?.() !== true && actor.isRenderable?.() !== true) this.battleState = 'dog-win';
        else this.battleState = 'running';
        return;
      }
      return originalUpdateBattleState.apply(this, args);
    };
  }
}

export function installBattleSceneBcuEnemyEntityBaseRenderPatch() {
  const proto = BattleSceneRenderer?.prototype;
  if (!proto || proto[RENDER_PATCH_FLAG]) return;
  proto[RENDER_PATCH_FLAG] = true;

  const originalDrawBase = proto.drawBase;
  if (typeof originalDrawBase === 'function') {
    proto.drawBase = function drawBaseSkippingBcuEnemyEntityPlaceholder(ctx, base, ...rest) {
      if (base?.visualSuppressed === true || base?.isBcuEnemyEntityBasePlaceholder === true) return;
      return originalDrawBase.call(this, ctx, base, ...rest);
    };
  }

  const originalDrawBaseHpBar = proto.drawBaseHpBar;
  if (typeof originalDrawBaseHpBar === 'function') {
    proto.drawBaseHpBar = function drawBaseHpBarSkippingBcuEnemyEntityPlaceholder(ctx, base, ...rest) {
      if (base?.visualSuppressed === true || base?.isBcuEnemyEntityBasePlaceholder === true) return;
      return originalDrawBaseHpBar.call(this, ctx, base, ...rest);
    };
  }
}

installBattleSceneBcuEnemyEntityBasePatch();
installBattleSceneBcuEnemyEntityBaseRenderPatch();
