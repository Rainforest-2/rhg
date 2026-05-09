import { BATTLE_CONFIG } from './BattleConfig.js';
import { BattleAttackResolver } from './BattleAttackResolver.js';
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

  static waitLine(actor, label = 'actor') {
    if (!actor) return `${label} wait: -`;
    const now = Number.isFinite(actor.debugNowMs) ? actor.debugNowMs : 0;
    const readyAt = Number.isFinite(actor.attackWaitReadyAtMs)
      ? actor.attackWaitReadyAtMs
      : Number.isFinite(actor.attackCooldownUntilMs)
        ? actor.attackCooldownUntilMs
        : 0;
    const remaining = Math.max(0, readyAt - now);
    const ready = remaining <= 0;
    return `${label} wait state:${actor.state || '-'} remain:${this.fmt(remaining)}ms ready:${ready ? 'true' : 'false'} readyAt:${this.fmt(readyAt)} setCount:${this.fmt(actor.attackWaitSetCount || 0)} src:${actor.lastAttackWaitDebug?.source || '-'}`;
  }

  static actorLine(actor, label = 'actor') {
    if (!actor) return `${label}: -`;
    const side = actor.side || '-';
    const id = actor.id || actor.slotId || actor.label || '-';
    return `${label} ${side} ${id} x:${this.fmt(actor.x)} posBcu:${this.fmt(actor.posBcu)} rBcu:${this.fmt(actor.detectionRangeBcu)} wBcu:${this.fmt(actor.attackWidthBcu)} rPx:${this.fmt(actor.detectionRangePx)} wPx:${this.fmt(actor.attackWidthPx)}`;
  }

  static intervalLine(diag, label = 'atk') {
    if (!diag) return `${label}: -`;
    const b = diag.bcu || {};
    const bi = b.interval || {};
    const p = diag.px || {};
    const pi = p.interval || {};
    return `${label} bcu:${this.fmt(bi.leftBcu)}..${this.fmt(bi.rightBcu)} target:${this.fmt(b.targetPosBcu)} in:${b.inRange === true ? 'true' : 'false'} px:${this.fmt(pi.left)}..${this.fmt(pi.right)} target:${this.fmt(p.targetX)} in:${p.inRange === true ? 'true' : 'false'}`;
  }

  static timingLine(timing, label = 'cycle') {
    if (!timing) return `${label}: -`;
    return `${label} interval:${this.fmt(timing.bcuAttackIntervalMs)}ms/${this.fmt(timing.bcuAttackIntervalFrames, 1)}f anim:${this.fmt(timing.animationMs)}ms longPre:${this.fmt(timing.longPreMs)}ms tba:${this.fmt(timing.waitMs)}ms readyAt:${this.fmt(timing.readyAtMs)} remain:${this.fmt(timing.remainingMs)}ms src:${timing.source || '-'}`;
  }

  static castleLine(castle = {}) {
    const g = castle.geometry || {};
    return `castle geom visual:${this.fmt(g.visualWidth)}x${this.fmt(g.visualHeight)} body:${this.fmt(g.bodyLeft)}..${this.fmt(g.bodyRight)} front:${this.fmt(g.frontX)} src:${g.bodySource || '-'}`;
  }

  static shouldShowDomPanel() {
    if (typeof window === 'undefined') return false;
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('debugBattle') === '1' && params.get('debugBattleDom') === '1';
    } catch {
      return false;
    }
  }

  static removeDomPanelIfDisabled() {
    if (typeof document === 'undefined') return;
    if (this.shouldShowDomPanel()) return;
    const el = document.getElementById('debug-battle-dom-panel');
    if (el) el.remove();
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
        maxWidth: '760px',
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
    if (!this.shouldShowDomPanel()) {
      this.removeDomPanelIfDisabled();
      return;
    }
    const el = this.getDomPanel();
    if (!el) return;
    const cc = info?.combatCoordinates || {};
    const dist = cc.firstOpposingDistance || {};
    const actors = Array.isArray(cc.actors) ? cc.actors : [];
    const player = actors.find((a) => a?.side === 'dog-player') || actors[0] || null;
    const enemy = actors.find((a) => a?.side === 'cat-enemy') || actors.find((a) => a && a !== player) || actors[1] || null;
    const waitActors = info?.attackWait?.actors || {};
    const timings = info?.attackTiming?.actors || {};
    const intervals = info?.attackIntervals || {};
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
      this.intervalLine(intervals.playerVsEnemy, 'dog atk'),
      this.intervalLine(intervals.enemyVsPlayer, 'cat atk'),
      this.timingLine(timings.player, 'dog cycle'),
      this.timingLine(timings.enemy, 'cat cycle'),
      `dog wait state:${waitActors.player?.state || '-'} remain:${this.fmt(waitActors.player?.remainingMs)}ms ready:${waitActors.player?.ready === true ? 'true' : 'false'} setCount:${this.fmt(waitActors.player?.setCount)} src:${waitActors.player?.source || '-'}`,
      `cat wait state:${waitActors.enemy?.state || '-'} remain:${this.fmt(waitActors.enemy?.remainingMs)}ms ready:${waitActors.enemy?.ready === true ? 'true' : 'false'} setCount:${this.fmt(waitActors.enemy?.setCount)} src:${waitActors.enemy?.source || '-'}`,
      `bases dog posBcu:${this.fmt(cc.bases?.player?.posBcu)} front:${this.fmt(cc.bases?.player?.frontX)} enemy posBcu:${this.fmt(cc.bases?.enemy?.posBcu)} front:${this.fmt(cc.bases?.enemy?.frontX)}`,
      `castle resolved:${castle.resolvedCastleId ?? '-'} imgcut:${castle.imgcutParser || '-'} path:${castle.imagePath || '-'}`,
      this.castleLine(castle),
      `camera pos:${this.fmt(camera.pos)} zoom:${this.fmt(camera.zoom, 2)} stageLen:${this.fmt(camera.stageLen)} pxPerWorld:${this.fmt(camera.pixelsPerWorldUnit, 3)}`,
      `bg resolved:${bg.resolvedBgId ?? '-'} fallback:${bg.fallbackReason ?? '-'}`,
      `note: castle body uses resolved castle crop as base combat body. combat remains screen-combat-point unless bcu-pos is explicitly enabled.`
    ];
    el.textContent = lines.join('\n');
  }

  static collect(scene) {
    const tuning = scene?.tuning || BATTLE_CONFIG.tuning || {};
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
    const enemyBaseBox = BattleSpawnResolver.getBaseCombatBox(enemyBase);
    const bgSource = scene?.stage?.background?.source || {};
    const templates = [...(scene?.actorFactory?.templates?.values?.() || [])];
    const stageScaledTemplates = templates.filter((tpl) => tpl?.stats?.source?.stageMagnificationApplied).length;
    const actorsAll = scene?.actors || [];
    const stageScaledActors = actorsAll.filter((a) => a?.stageMagnification || a?.statScalingDebug?.stageMagnification).length;
    const nowMs = scene?.timeMs || 0;
    for (const actor of actorsAll) actor.debugNowMs = nowMs;
    const coordinateActors = actorsAll.slice(0, 8).map((actor) => BattleCombatCoordinateRuntime.describeActor(actor)).filter(Boolean);
    const firstAliveBySide = {
      player: actorsAll.find((a) => a?.isAlive?.() && a.side === 'dog-player') || null,
      enemy: actorsAll.find((a) => a?.isAlive?.() && a.side === 'cat-enemy') || null
    };
    const getFirstAttackEvent = (actor) => actor?.attackProfile?.events?.[0] || actor?.getAttackProfile?.()?.events?.[0] || null;
    const playerVsEnemy = firstAliveBySide.player && firstAliveBySide.enemy
      ? BattleAttackResolver.getCaptureCoordinateDiagnostics(firstAliveBySide.player, firstAliveBySide.enemy, getFirstAttackEvent(firstAliveBySide.player))
      : null;
    const enemyVsPlayer = firstAliveBySide.enemy && firstAliveBySide.player
      ? BattleAttackResolver.getCaptureCoordinateDiagnostics(firstAliveBySide.enemy, firstAliveBySide.player, getFirstAttackEvent(firstAliveBySide.enemy))
      : null;
    const describeWait = (actor) => {
      if (!actor) return null;
      const readyAt = Number.isFinite(actor.attackWaitReadyAtMs)
        ? actor.attackWaitReadyAtMs
        : Number.isFinite(actor.attackCooldownUntilMs)
          ? actor.attackCooldownUntilMs
          : 0;
      const remainingMs = Math.max(0, readyAt - nowMs);
      return {
        id: actor.instanceId || actor.slotId || actor.label || null,
        side: actor.side || null,
        state: actor.state || null,
        readyAtMs: readyAt,
        remainingMs,
        ready: remainingMs <= 0,
        active: actor.attackWaitActive === true && remainingMs > 0,
        setCount: actor.attackWaitSetCount || 0,
        intervalSetCount: actor.attackIntervalSetCount || 0,
        source: actor.lastAttackWaitDebug?.source || null,
        reason: actor.attackWaitReason || null
      };
    };
    const describeTiming = (actor) => {
      if (!actor) return null;
      const profile = actor.getAttackProfile?.() || actor.attackProfile || null;
      const timing = profile?.bcuTiming || actor.lastAttackTimelineDebug?.bcuTiming || actor.lastAttackWaitDebug?.bcuTiming || null;
      const readyAt = Number.isFinite(actor.attackWaitReadyAtMs)
        ? actor.attackWaitReadyAtMs
        : Number.isFinite(actor.attackCooldownUntilMs)
          ? actor.attackCooldownUntilMs
          : null;
      const remainingMs = Number.isFinite(readyAt) ? Math.max(0, readyAt - nowMs) : null;
      return {
        ...(timing || {}),
        source: timing?.source || actor.lastAttackTimelineDebug?.cooldownSource || actor.lastAttackWaitDebug?.source || null,
        readyAtMs: readyAt,
        remainingMs,
        attackStartedAtMs: Number.isFinite(actor.attackStartedAtMs) ? actor.attackStartedAtMs : null,
        state: actor.state || null
      };
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
        enemyBaseCombatBox: enemyBaseBox ?? null,
        lastSpawnResolveDebug: scene?.lastSpawnResolveDebug ?? null,
        groundY: scene?.groundY ?? null,
        scrollMinX: 0,
        scrollMaxX: Number.isFinite(stageRt.stageLen) ? stageRt.stageLen : null
      },
      combatCoordinates: {
        activeMode: tuning?.combatPositionMode || null,
        contractMode: tuning?.coordinateContract?.mode || null,
        bcuPosEnabled: tuning?.coordinateContract?.bcuPosEnabled === true,
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
      attackIntervals: { playerVsEnemy, enemyVsPlayer },
      attackTiming: {
        actors: {
          player: describeTiming(firstAliveBySide.player),
          enemy: describeTiming(firstAliveBySide.enemy)
        }
      },
      attackWait: {
        actors: {
          player: describeWait(firstAliveBySide.player),
          enemy: describeWait(firstAliveBySide.enemy)
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
        maxSlotBlockedCount,
        killCounters: scene?.stageSpawnKillCounterByRowIndex || null,
        groupPolicy: scene?.lastStageSpawnTickContext?.groupPolicySource === 'scene.isStageSpawnGroupAllowed'
          ? 'scene-hook'
          : (scene?.lastStageSpawnTickContext?.groupPolicySource ? 'default-allow' : 'not-wired'),
        rowsWithWarnings: rows
          .filter((r) => Array.isArray(r?.warnings) && r.warnings.length > 0)
          .map((r) => ({ rowIndex: r.rowIndex, warnings: r.warnings, lastBlockedReason: r.lastBlockedReason })),
        blockedByKillCount: rows.filter((r) => r?.lastBlockedReason === 'kill-count-trigger').length,
        blockedByGroup: rows.filter((r) => r?.lastBlockedReason === 'group-gating').length
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
          imgcutParser: enemyBase?.castleAsset?.crop?.parser ?? enemyBase?.castleAsset?.visualBounds?.parser ?? null,
          usedFallback: enemyBase?.debug?.enemyCastleUsedFallback ?? false,
          fallbackReason: enemyBase?.debug?.enemyCastleFallbackReason ?? enemyBase?.castleFallbackReason ?? null,
          geometry: {
            visualWidth: enemyBase?.castleGeometry?.visualBounds?.width ?? null,
            visualHeight: enemyBase?.castleGeometry?.visualBounds?.height ?? null,
            bodyLeft: enemyBaseBox?.left ?? null,
            bodyRight: enemyBaseBox?.right ?? null,
            bodyTop: enemyBaseBox?.top ?? null,
            bodyBottom: enemyBaseBox?.bottom ?? null,
            bodyWidth: enemyBaseBox?.width ?? null,
            frontX: BattleSpawnResolver.getBaseFrontX(enemyBase, 'cat-enemy') ?? null,
            bodySource: enemyBase?.combatBodySource ?? enemyBaseBox?.source ?? null
          }
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
