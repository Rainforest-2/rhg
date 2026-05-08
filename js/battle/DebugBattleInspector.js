import { BattleCombatCoordinateRuntime } from './BattleCombatCoordinateRuntime.js';
import { BattleSpawnResolver } from './BattleSpawnResolver.js';

export class DebugBattleInspector {
  static enabled(scene) {
    if (scene?.debugBattleEnabled) return true;
    if (typeof window === 'undefined') return false;
    try {
      return new URLSearchParams(window.location.search).get('debugBattle') === '1';
    } catch {
      return false;
    }
  }

  static fmt(value, digits = 0) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '-';
    return digits > 0 ? n.toFixed(digits) : String(Math.round(n));
  }

  static actorLine(actor, label = 'actor') {
    if (!actor) return `${label}: -`;
    const side = actor.side || '-';
    const id = actor.id || actor.slotId || actor.label || '-';
    return `${label} ${side} ${id} x:${this.fmt(actor.x)} posBcu:${this.fmt(actor.posBcu)} rBcu:${this.fmt(actor.detectionRangeBcu)} wBcu:${this.fmt(actor.attackWidthBcu)} rPx:${this.fmt(actor.detectionRangePx)} wPx:${this.fmt(actor.attackWidthPx)}`;
  }

  static shouldShowDomPanel() {
    if (typeof window === 'undefined') return false;
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('debugBattle') === '1' && params.get('debugBattleDom') !== '0';
    } catch {
      return false;
    }
  }

  static getDomPanel() {
    if (typeof document === 'undefined') return null;
    let el = document.getElementById('debug-battle-dom-panel');
    if (!el) {
      el = document.createElement('pre');
      el.id = 'debug-battle-dom-panel';
      Object.assign(el.style, {
        position: 'fixed',
        right: '12px',
        top: '88px',
        zIndex: '2147483647',
        maxWidth: '560px',
        maxHeight: '52vh',
        overflow: 'auto',
        margin: '0',
        padding: '10px 12px',
        border: '1px solid #38bdf8',
        borderRadius: '6px',
        background: 'rgba(2, 6, 23, 0.86)',
        color: '#e0f2fe',
        font: '12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        lineHeight: '1.35',
        whiteSpace: 'pre-wrap',
        pointerEvents: 'none'
      });
      document.body.appendChild(el);
    }
    return el;
  }

  static updateDomOverlay(scene, info) {
    if (!this.shouldShowDomPanel()) return;
    const el = this.getDomPanel();
    if (!el) return;
    const cc = info?.combatCoordinates || {};
    const dist = cc.firstOpposingDistance || {};
    const actors = Array.isArray(cc.actors) ? cc.actors : [];
    const player = actors.find((a) => a?.side === 'dog-player') || actors[0] || null;
    const enemy = actors.find((a) => a?.side === 'cat-enemy') || actors.find((a) => a && a !== player) || actors[1] || null;
    const stage = info?.stage || {};
    const spawn = info?.spawn || {};
    const camera = info?.camera || {};
    const bg = info?.assets?.background || {};
    const castle = info?.assets?.castle || {};
    const lines = [
      `debugBattle DOM panel source:${scene?.debugBattleSource || '-'}`,
      `frame:${this.fmt(info?.frame)} time:${this.fmt(info?.timeMs)}ms`,
      `stage runtime len:${this.fmt(stage.stageLen)} bg:${stage.bgId ?? '-'} castle:${stage.castleId ?? '-'} enemyBaseHp:${this.fmt(stage.enemyBaseHp)} maxEnemy:${this.fmt(stage.maxEnemyCount)}`,
      `spawn rows:${this.fmt(spawn.rowCount)} active:${this.fmt(spawn.activeRows)} pending:${this.fmt(spawn.pendingSpawnCount)} previewUnmapped is HUD-only mapping, not runtime spawn failure`,
      `coord active:${cc.activeMode || '-'} contract:${cc.contractMode || '-'} bcuPosEnabled:${cc.bcuPosEnabled === true ? 'true' : 'false'}`,
      `first distanceBcu:${this.fmt(dist.distanceBcu)} attacker:${this.fmt(dist.attackerPosBcu)} target:${this.fmt(dist.targetPosBcu)}`,
      this.actorLine(player, 'dog'),
      this.actorLine(enemy, 'cat'),
      `bases dog posBcu:${this.fmt(cc.bases?.player?.posBcu)} front:${this.fmt(cc.bases?.player?.frontX)} enemy posBcu:${this.fmt(cc.bases?.enemy?.posBcu)} front:${this.fmt(cc.bases?.enemy?.frontX)}`,
      `camera pos:${this.fmt(camera.pos)} zoom:${this.fmt(camera.zoom, 2)} stageLen:${this.fmt(camera.stageLen)} pxPerWorld:${this.fmt(camera.pixelsPerWorldUnit, 3)}`,
      `castle resolved:${castle.resolvedCastleId ?? '-'} fallback:${castle.fallbackReason ?? '-'}`,
      `bg resolved:${bg.resolvedBgId ?? '-'} fallback:${bg.fallbackReason ?? '-'}`,
      `note: combat is still screen-combat-point; BCU coordinates are diagnostic until bcu-pos is explicitly enabled.`
    ];
    el.textContent = lines.join('\n');
  }

  static collect(scene) {
    const stageDef = scene?.stage?.definition?.runtime || scene?.stage?.definition || {};
    const stageRt = scene?.stage?.runtime || {};
    const spawnRuntime = scene?.stageSpawnRuntime;
    const rows = spawnRuntime?.rows || [];
    const activeRows = rows.filter((r) => !r.done && !r.disabled).length;
    const doneRows = rows.filter((r) => r.done).length;
    const deferredCount = rows.filter((r) => r.waitingForMaxEnemySlot || r.loadingDeferred).length;
    const waitingForSpawnCommitCount = rows.filter((r) => r.waitingForSpawnCommit).length;
    const pendingSpawnCount = rows.filter((r) => !!r.pendingSpawnEvent).length;
    const baseHpBlockedCount = rows.filter((r) => r.lastBlockedReason === 'base-hp-trigger').length;
    const maxSlotBlockedCount = rows.filter((r) => r.lastBlockedReason === 'max-enemy-count').length;
    const nextFrameMin = rows.reduce((m, r) => Math.min(m, Number.isFinite(r.nextAtFrame) ? r.nextAtFrame : Infinity), Infinity);
    const playerBase = (scene?.bases || []).find((b) => b.side === 'dog-player');
    const enemyBase = (scene?.bases || []).find((b) => b.side === 'cat-enemy');
    const bgSource = scene?.stage?.background?.source || {};
    const templates = [...(scene?.actorFactory?.templates?.values?.() || [])];
    const stageScaledTemplates = templates.filter((tpl) => tpl?.stats?.source?.stageMagnificationApplied).length;
    const actorsAll = scene?.actors || [];
    const stageScaledActors = actorsAll.filter((a) => a?.stageMagnification || a?.statScalingDebug?.stageMagnification).length;
    const coordinateActors = actorsAll.slice(0, 8).map((actor) => BattleCombatCoordinateRuntime.describeActor(actor)).filter(Boolean);
    const firstAliveBySide = {
      player: actorsAll.find((a) => a?.isAlive?.() && a.side === 'dog-player') || null,
      enemy: actorsAll.find((a) => a?.isAlive?.() && a.side === 'cat-enemy') || null
    };
    const examples = [];
    for (const tpl of templates) {
      if (examples.length >= 5) break;
      const mag = tpl?.stats?.stageMagnification;
      if (!mag) continue;
      examples.push({ slotId: tpl?.unitDef?.slotId ?? null, rowIndex: mag?.rowIndex ?? null, enemyId: mag?.enemyId ?? tpl?.unitDef?.statsId ?? null, baseHp: tpl?.baseStats?.hp ?? null, scaledHp: tpl?.stats?.hp ?? null, baseDamage: tpl?.baseStats?.damage ?? null, scaledDamage: tpl?.stats?.damage ?? null, hpMagnification: mag?.hpMagnification ?? null, attackMagnification: mag?.attackMagnification ?? null });
    }
    const info = {
      frame: scene?.logicFrame ?? Math.floor((scene?.timeMs || 0) / (1000 / 30)),
      timeMs: scene?.timeMs || 0,
      stage: {
        castleId: stageRt.castleId ?? stageDef.castleId ?? null,
        animBaseId: stageRt.animBaseId ?? stageDef.animBaseId ?? null,
        cannonId: stageRt.cannonId ?? stageDef.cannonId ?? null,
        bgId: stageRt.bgId ?? stageDef.bgId ?? null,
        stageLen: stageRt.stageLen ?? stageDef.stageLen ?? null,
        enemyBaseHp: stageRt.enemyBaseHp ?? stageDef.enemyBaseHp ?? null,
        maxEnemyCount: stageRt.maxEnemyCount ?? stageRt.effectiveMaxEnemyCount ?? stageDef.maxEnemyCount ?? null,
        enemyRowsCount: (stageRt.enemyRows || stageDef.enemyRows || []).length,
        warnings: [...(stageDef.warnings || []), ...(stageRt.warnings || [])]
      },
      runtime: {
        playerBaseWorldX: stageRt.playerBaseWorldX ?? playerBase?.x ?? null,
        playerBaseFrontX: BattleSpawnResolver.getBaseFrontX(playerBase, 'dog-player') ?? null,
        playerBaseHp: playerBase?.hp ?? null,
        enemyBaseWorldX: stageRt.enemyBaseWorldX ?? enemyBase?.x ?? null,
        enemyBaseFrontX: BattleSpawnResolver.getBaseFrontX(enemyBase, 'cat-enemy') ?? null,
        enemyBaseHp: enemyBase?.hp ?? null,
        playerBaseCombatBox: BattleSpawnResolver.getBaseCombatBox(playerBase) ?? null,
        enemyBaseCombatBox: BattleSpawnResolver.getBaseCombatBox(enemyBase) ?? null,
        lastSpawnResolveDebug: scene?.lastSpawnResolveDebug ?? null,
        groundY: scene?.groundY ?? null,
        scrollMinX: 0,
        scrollMaxX: Number.isFinite(stageRt.stageLen) ? stageRt.stageLen : null
      },
      combatCoordinates: {
        activeMode: scene?.tuning?.combatPositionMode || null,
        contractMode: scene?.tuning?.coordinateContract?.mode || null,
        bcuPosEnabled: scene?.tuning?.coordinateContract?.bcuPosEnabled === true,
        note: 'debug-only: actor.x remains current combat coordinate unless combatPositionMode is later switched to bcu-pos',
        actors: coordinateActors,
        firstOpposingDistance: firstAliveBySide.player && firstAliveBySide.enemy
          ? BattleCombatCoordinateRuntime.describeDistance(firstAliveBySide.player, firstAliveBySide.enemy)
          : null,
        bases: {
          player: playerBase ? { x: playerBase.x ?? null, posBcu: BattleCombatCoordinateRuntime.getEntityPosBcu(playerBase), frontX: BattleSpawnResolver.getBaseFrontX(playerBase, 'dog-player') ?? null } : null,
          enemy: enemyBase ? { x: enemyBase.x ?? null, posBcu: BattleCombatCoordinateRuntime.getEntityPosBcu(enemyBase), frontX: BattleSpawnResolver.getBaseFrontX(enemyBase, 'cat-enemy') ?? null } : null
        }
      },
      camera: (() => {
        const cam = scene?.camera;
        const camState = cam?.getState?.() || null;
        const clamp = camState?.clamp || cam?.getClampRange?.() || null;
        return {
          x: cam?.pos ?? null,
          pos: cam?.pos ?? null,
          offsetX: cam?.originX ?? 0,
          zoom: cam?.zoom ?? cam?.siz ?? 1,
          siz: cam?.siz ?? cam?.zoom ?? 1,
          logicalW: cam?.logicalW ?? null,
          stageLen: camState?.stageLen ?? cam?.stageLen ?? null,
          visibleWorldWidth: camState?.visibleWorldWidth ?? cam?.visibleWorldWidth ?? null,
          stagePixelWidth: camState?.stagePixelWidth ?? cam?.stagePixelWidth ?? null,
          pixelsPerWorldUnit: camState?.pixelsPerWorldUnit ?? cam?.pixelsPerWorldUnit ?? null,
          clamp,
          visibleWorldRange: cam?.getVisibleWorldRange?.() || null,
          contract: 'world-x-to-logical-screen-x'
        };
      })(),
      cameraStageLenMatchesRuntime: Number.isFinite(scene?.camera?.stageLen) && Number.isFinite(stageRt?.stageLen)
        ? Math.abs(scene.camera.stageLen - stageRt.stageLen) <= 1e-6
        : null,
      spawn: {
        rowCount: rows.length,
        activeRows,
        doneRows,
        nextFrameMin: Number.isFinite(nextFrameMin) ? nextFrameMin : null,
        deferredCount,
        waitingForSpawnCommitCount,
        pendingSpawnCount,
        baseHpBlockedCount,
        maxSlotBlockedCount
      },
      actors: {
        playerAlive: actorsAll.filter((a) => a?.isAlive?.() && a.side === 'dog-player').length,
        enemyAlive: actorsAll.filter((a) => a?.isAlive?.() && a.side === 'cat-enemy').length,
        dead: actorsAll.filter((a) => !a?.isAlive?.()).length,
        knockback: actorsAll.filter((a) => a?.state === 'knockback').length
      },
      assets: {
        castle: {
          requestedCastleId: enemyBase?.debug?.requestedCastleId ?? enemyBase?.requestedCastleId ?? null,
          resolvedCastleId: enemyBase?.debug?.resolvedCastleId ?? enemyBase?.castleId ?? null,
          requestedAnimBaseId: enemyBase?.debug?.requestedAnimBaseId ?? enemyBase?.requestedAnimBaseId ?? null,
          resolvedAnimBaseId: enemyBase?.debug?.resolvedAnimBaseId ?? enemyBase?.animBaseId ?? null,
          requestedCannonId: enemyBase?.debug?.requestedCannonId ?? null,
          imagePath: enemyBase?.debug?.castleImagePath ?? enemyBase?.castleAsset?.imagePath ?? null,
          imgcutPath: enemyBase?.debug?.castleImgcutPath ?? enemyBase?.castleAsset?.imgcutPath ?? null,
          usedFallback: enemyBase?.debug?.enemyCastleUsedFallback ?? false,
          fallbackReason: enemyBase?.debug?.enemyCastleFallbackReason ?? enemyBase?.castleFallbackReason ?? null
        },
        background: {
          requestedBgId: bgSource.requestedBgId ?? null,
          resolvedBgId: bgSource.resolvedBgId ?? null,
          imagePath: bgSource.imagePath ?? null,
          imgcutPath: bgSource.imgcutPath ?? null,
          csvPath: bgSource.csvPath ?? null,
          usedFallback: bgSource.bgUsedFallback ?? false,
          fallbackReason: bgSource.bgFallbackReason ?? null,
          imgcutId: bgSource.imgcutId ?? null,
          showUpper: bgSource.showUpper ?? null
        }
      },
      statsScaling: { stageScaledActors, stageScaledTemplates, examples },
      warnings: [...(scene?.debugWarnings || [])]
    };
    this.updateDomOverlay(scene, info);
    return info;
  }
}
