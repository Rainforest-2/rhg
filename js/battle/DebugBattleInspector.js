import { BATTLE_CONFIG } from './BattleConfig.js';
import { BattleAttackResolver } from './BattleAttackResolver.js';
import { BattleCombatCoordinateRuntime } from './BattleCombatCoordinateRuntime.js';
import { BattleSpawnResolver } from './BattleSpawnResolver.js';
import { BattleAttackTimeline } from './BattleAttackTimeline.js';
import { AbilityModel } from './AbilityModel.js';
import { KBRuntime } from './KBRuntime.js';
import { EffectRuntime } from './EffectRuntime.js';
import { AnimationRuntime } from '../bcu/AnimationRuntime.js';
import { ProductionRuntime } from './ProductionRuntime.js';
import { FormationStore } from './FormationStore.js';

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
      `atk timeline dog hits:${this.fmt(info?.attackTimeline?.actors?.player?.resolvedHitCount)}/${this.fmt(info?.attackTimeline?.actors?.player?.totalHitCount)} due:${this.fmt(info?.attackTimeline?.actors?.player?.dueHitCount)} state:${info?.attackTimeline?.actors?.player?.state || '-'}`,
      `atk timeline cat hits:${this.fmt(info?.attackTimeline?.actors?.enemy?.resolvedHitCount)}/${this.fmt(info?.attackTimeline?.actors?.enemy?.totalHitCount)} due:${this.fmt(info?.attackTimeline?.actors?.enemy?.dueHitCount)} state:${info?.attackTimeline?.actors?.enemy?.state || '-'}`,
      `bases dog posBcu:${this.fmt(cc.bases?.player?.posBcu)} front:${this.fmt(cc.bases?.player?.frontX)} enemy posBcu:${this.fmt(cc.bases?.enemy?.posBcu)} front:${this.fmt(cc.bases?.enemy?.frontX)}`,
      `castle req/res:${castle.requestedCastleId ?? '-'}=>${castle.resolvedCastleId ?? '-'} group:${castle.castleGroupName || '-'} local:${castle.localCastleId ?? '-'} fallback:${castle.fallbackReason ?? '-'}`,
      `castle path:${castle.imagePath || '-'} src:${castle.source || '-'} kind:${castle.assetKind || '-'}`,
      this.castleLine(castle),
      `camera pos:${this.fmt(camera.pos)} zoom:${this.fmt(camera.zoom, 2)} stageLen:${this.fmt(camera.stageLen)} pxPerWorld:${this.fmt(camera.pixelsPerWorldUnit, 3)}`,
      `cam invariant stageLenMatch:${info?.cameraInvariants?.stageLenMatchesRuntime === true ? 'true' : (info?.cameraInvariants?.stageLenMatchesRuntime === false ? 'false' : '-')} roundTrip:${info?.cameraInvariants?.projectionRoundTripOk === true ? 'true' : (info?.cameraInvariants?.projectionRoundTripOk === false ? 'false' : '-')} vis:${this.fmt(info?.cameraInvariants?.visibleWorldRange?.left)}..${this.fmt(info?.cameraInvariants?.visibleWorldRange?.right)}`,
      `tick phases enemyBeforeActor:${info?.tickOrder?.enemySpawnBeforeActorUpdate === true ? 'true' : (info?.tickOrder?.enemySpawnBeforeActorUpdate === false ? 'false' : '-')} current:${info?.tickOrder?.currentTickPhase || '-'} trace:${this.fmt(info?.tickOrder?.traceLength)}`,
      `damage/proc ability rawOnly:${this.fmt(info?.damageAndProc?.abilityStatusSummary?.rawOnly || 0)} partial:${this.fmt(info?.damageAndProc?.abilityStatusSummary?.partial || 0)} procSkipped:${this.fmt(info?.damageAndProc?.abilityStatusSummary?.procSkipped || 0)}`,
      `kb active:${this.fmt(info?.kbRuntime?.activeKnockbacks || 0)} dead:${this.fmt(info?.kbRuntime?.dyingOrDead || 0)} removable:${this.fmt(info?.kbRuntime?.removable || 0)}`,
      `effects active:${this.fmt(info?.effectRuntime?.activeCount || 0)} finished:${this.fmt(info?.effectRuntime?.finishedCount || 0)}`,
      `anim actors:${this.fmt(info?.animationRuntime?.actors?.length || 0)} frame:${this.fmt(info?.animationRuntime?.examples?.[0]?.frame)} tracks:${this.fmt(info?.animationRuntime?.examples?.[0]?.appliedTrackCount || 0)}/${this.fmt(info?.animationRuntime?.examples?.[0]?.failedTrackCount || 0)} parts:${this.fmt(info?.animationRuntime?.examples?.[0]?.modelPartCount || 0)}`,
      `bg req/res:${bg.requestedBgId ?? '-'}=>${bg.resolvedBgId ?? '-'} fallback:${bg.fallbackReason ?? '-'}`,
      `bg path:${bg.imagePath || '-'} kind:${bg.assetKind || '-'} csvKind:${bg.backgroundCsvKind || '-'}`,
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
    const expectedPhaseOrder = ['advance-clock','player-production-requests','enemy-spawn','economy','lineup-change','actor-state-update','movement','target-search','attack-start','attack-timeline','hit-target-capture','damage-resolve','proc-resolve','knockback-death','base-post-update','effect-spawn','effect-tick','cleanup','camera-update'];
    const lastFramePhaseOrder = scene?.getLastTickPhaseOrder?.() || (Array.isArray(scene?.tickPhaseTrace) ? scene.tickPhaseTrace.filter((p) => p?.frame === scene?.logicFrame).map((p) => p.phase) : []);
    const enemyIdx = lastFramePhaseOrder.indexOf('enemy-spawn');
    const actorIdx = lastFramePhaseOrder.indexOf('actor-state-update');
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
    for (const actor of actorsAll) {
      if (examples.length >= 5) break;
      const dbg = actor?.actorStatsModelDebug || actor?.statScalingDebug;
      if (!dbg) continue;
      examples.push({ slotId: actor?.slotId ?? null, actorId: actor?.id ?? actor?.instanceId ?? null, rowIndex: dbg?.rowIndex ?? dbg?.stageMagnification?.rowIndex ?? null, enemyId: dbg?.enemyId ?? dbg?.stageMagnification?.enemyId ?? null, rawEnemyId: dbg?.rawEnemyId ?? dbg?.stageMagnification?.rawEnemyId ?? null, sourceEnemyId: dbg?.sourceEnemyId ?? dbg?.stageMagnification?.sourceEnemyId ?? null, baseHp: dbg?.baseHp ?? null, scaledHp: dbg?.scaledHp ?? null, baseDamage: dbg?.baseDamage ?? null, scaledDamage: dbg?.scaledDamage ?? null, magnification: dbg?.magnification ?? dbg?.stageMagnification?.magnification ?? null, hpMagnification: dbg?.hpMagnification ?? dbg?.stageMagnification?.hpMagnification ?? null, attackMagnification: dbg?.attackMagnification ?? dbg?.stageMagnification?.attackMagnification ?? null, attackHits: Array.isArray(dbg?.attackHits) ? dbg.attackHits : [] });
    }
    if (examples.length === 0) {
      for (const tpl of templates) {
        if (examples.length >= 5) break;
        const dbg = tpl?.statsModelDebug || tpl?.stats?.statsModelDebug;
        const mag = tpl?.stats?.stageMagnification;
        if (!dbg && !mag) continue;
        examples.push({ slotId: tpl?.unitDef?.slotId ?? null, actorId: null, rowIndex: dbg?.rowIndex ?? mag?.rowIndex ?? null, enemyId: dbg?.enemyId ?? mag?.enemyId ?? tpl?.unitDef?.statsId ?? null, rawEnemyId: dbg?.rawEnemyId ?? mag?.rawEnemyId ?? null, sourceEnemyId: dbg?.sourceEnemyId ?? mag?.sourceEnemyId ?? null, baseHp: dbg?.baseHp ?? tpl?.baseStats?.hp ?? null, scaledHp: dbg?.scaledHp ?? tpl?.stats?.hp ?? null, baseDamage: dbg?.baseDamage ?? tpl?.baseStats?.damage ?? null, scaledDamage: dbg?.scaledDamage ?? tpl?.stats?.damage ?? null, magnification: dbg?.magnification ?? mag?.magnification ?? null, hpMagnification: dbg?.hpMagnification ?? mag?.hpMagnification ?? null, attackMagnification: dbg?.attackMagnification ?? mag?.attackMagnification ?? null, attackHits: Array.isArray(dbg?.attackHits) ? dbg.attackHits : [] });
      }
    }
    const kbActors = actorsAll.map((a) => KBRuntime.describeActor(a)).filter(Boolean);
    const kbRecent = (scene?.debugEvents || []).filter((e) => String(e?.type || '').startsWith('kbRuntime')).slice(-10);
    const effectSummary = EffectRuntime.describeEffects(scene?.effects || []);
    const effectRecent = (scene?.debugEvents || []).filter((e) => String(e?.type || '').startsWith('effectRuntime')).slice(-10);

    const productionRoster = scene?.getPlayerProductionRoster?.() || [];
    const productionRecentEvents = (scene?.debugEvents || []).filter((e) => ['playerSpawnRejected','playerSpawned','productionLineupChanged','productionRuntimeRequest'].includes(e?.type)).slice(-10);
    const formationSummary = FormationStore?.getFormationSummary ? FormationStore.getFormationSummary(FormationStore.load()) : ProductionRuntime.describeFormation(FormationStore.load());
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
      attackTimeline: {
        actors: {
          player: firstAliveBySide.player ? {
            id: firstAliveBySide.player.instanceId || firstAliveBySide.player.slotId || firstAliveBySide.player.label || null,
            side: firstAliveBySide.player.side || null,
            ...BattleAttackTimeline.describe(firstAliveBySide.player, nowMs),
            events: (firstAliveBySide.player.attackProfile?.events || []).map((e, i) => ({ key: e?.key || `hit-${i}`, hitIndex: e?.hitIndex ?? i, atMs: e?.atMs ?? null, damage: e?.damage ?? null, targetMode: e?.targetMode || null, attackKind: e?.attackKind || null, abilityMappingStatus: e?.abilityMappingStatus || null }))
          } : null,
          enemy: firstAliveBySide.enemy ? {
            id: firstAliveBySide.enemy.instanceId || firstAliveBySide.enemy.slotId || firstAliveBySide.enemy.label || null,
            side: firstAliveBySide.enemy.side || null,
            ...BattleAttackTimeline.describe(firstAliveBySide.enemy, nowMs),
            events: (firstAliveBySide.enemy.attackProfile?.events || []).map((e, i) => ({ key: e?.key || `hit-${i}`, hitIndex: e?.hitIndex ?? i, atMs: e?.atMs ?? null, damage: e?.damage ?? null, targetMode: e?.targetMode || null, attackKind: e?.attackKind || null, abilityMappingStatus: e?.abilityMappingStatus || null }))
          } : null
        },
        recentEvents: (scene?.debugEvents || []).filter((e) => String(e?.type || '').startsWith('attackTimeline') || String(e?.type || '').startsWith('attackTargets')).slice(-8)
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
      cameraInvariants: (() => {
        const cam = scene?.camera;
        const stageLenRuntime = Number.isFinite(stageRt?.stageLen) ? stageRt.stageLen : null;
        const stageLenCamera = Number.isFinite(cam?.stageLen) ? cam.stageLen : null;
        const stageLenMatchesRuntime = Number.isFinite(stageLenRuntime) && Number.isFinite(stageLenCamera)
          ? Math.abs(stageLenRuntime - stageLenCamera) <= 1e-6
          : null;
        const projectionSampleWorldX = Number.isFinite(stageRt?.enemySpawnWorldX)
          ? stageRt.enemySpawnWorldX
          : (Number.isFinite(stageRt?.enemyBaseWorldX) ? stageRt.enemyBaseWorldX : 0);
        const projectionSampleScreenX = cam?.worldToScreenX?.(projectionSampleWorldX) ?? null;
        const projectionRoundTripWorldX = cam?.screenToWorldX?.(projectionSampleScreenX) ?? null;
        const projectionRoundTripOk = Number.isFinite(projectionSampleWorldX) && Number.isFinite(projectionRoundTripWorldX)
          ? Math.abs(projectionSampleWorldX - projectionRoundTripWorldX) <= 0.001
          : null;
        return {
          stageLenRuntime,
          stageLenCamera,
          stageLenMatchesRuntime,
          playerBaseWorldX: stageRt?.playerBaseWorldX ?? playerBase?.x ?? null,
          enemyBaseWorldX: stageRt?.enemyBaseWorldX ?? enemyBase?.x ?? null,
          lastSpawnWorldX: scene?.lastSpawnResolveDebug?.worldX ?? null,
          lastSpawnWorldXSource: scene?.lastSpawnResolveDebug?.source ?? null,
          visibleWorldRange: cam?.getVisibleWorldRange?.() ?? null,
          clamp: cam?.getState?.()?.clamp ?? cam?.getClampRange?.() ?? null,
          projectionRoundTripOk,
          projectionSampleWorldX,
          projectionSampleScreenX,
          projectionRoundTripWorldX,
          inputDebug: scene?.cameraInputController?.lastInputDebug ?? null
        };
      })(),
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
      assets: (() => {
        const castleAsset = enemyBase?.castleAsset || {};
        const castleBaseDebug = castleAsset?.baseDebug || {};
        const castleDebug = enemyBase?.debug || {};
        const castleSource = {
          ...castleAsset,
          ...castleDebug,
          ...castleBaseDebug
        };
        return {
          castle: {
            requestedCastleId: castleSource.requestedCastleId ?? enemyBase?.requestedCastleId ?? null,
            resolvedCastleId: castleSource.resolvedCastleId ?? enemyBase?.castleId ?? null,
            requestedAnimBaseId: castleSource.requestedAnimBaseId ?? enemyBase?.requestedAnimBaseId ?? null,
            resolvedAnimBaseId: castleSource.resolvedAnimBaseId ?? enemyBase?.animBaseId ?? null,
            requestedCannonId: castleSource.requestedCannonId ?? null,
            castleGroupName: castleSource.castleGroupName ?? castleSource.groupName ?? null,
            castleGroupIndex: castleSource.castleGroupIndex ?? castleSource.groupIndex ?? null,
            localCastleId: castleSource.localCastleId ?? null,
            imagePath: castleSource.castleImagePath ?? castleSource.imagePath ?? null,
            imgcutPath: castleSource.castleImgcutPath ?? castleSource.imgcutPath ?? null,
            imgcutParser: castleAsset?.crop?.parser ?? castleAsset?.visualBounds?.parser ?? null,
            assetKind: castleSource.assetKind ?? null,
            source: castleSource.castleAssetSource ?? castleSource.source ?? null,
            usedFallback: castleSource.enemyCastleUsedFallback ?? castleSource.usedFallback ?? false,
            fallbackReason: castleSource.enemyCastleFallbackReason ?? castleSource.fallbackReason ?? enemyBase?.castleFallbackReason ?? null,
            candidateReport: castleSource.castleCandidateReport ?? castleSource.candidateReport ?? castleAsset?.candidateReport ?? null,
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
            assetKind: bgSource.assetKind ?? null,
            backgroundCsvKind: bgSource.backgroundCsvKind ?? null,
            usedFallback: bgSource.bgUsedFallback ?? false,
            fallbackReason: bgSource.bgFallbackReason ?? null,
            imgcutId: bgSource.imgcutId ?? null,
            showUpper: bgSource.showUpper ?? null,
            candidateReport: bgSource.candidateReport ?? null
          }
        };
      })(),
      tickOrder: {
        currentTickPhase: scene?.currentTickPhase ?? null,
        lastTickPhase: scene?.lastTickPhase ?? null,
        lastFramePhaseOrder,
        expectedPhaseOrder,
        enemySpawnBeforeActorUpdate: enemyIdx !== -1 && actorIdx !== -1 ? enemyIdx < actorIdx : null,
        renderOutsideSimulation: true,
        traceLength: Array.isArray(scene?.tickPhaseTrace) ? scene.tickPhaseTrace.length : 0
      },
      statsScaling: { contract: 'ActorStatsModel', stageScaledActors, stageScaledTemplates, examples, warnings: examples.flatMap((e) => Array.isArray(e?.warnings) ? e.warnings : []) },

      damageAndProc: (() => {
        const damageEvents = (scene?.debugEvents || []).filter((e) => ['damageApplied', 'damageResolved', 'attackTimelineHitResolved'].includes(e?.type)).slice(-8);
        const procEvents = (scene?.debugEvents || []).filter((e) => e?.type === 'procResolved').slice(-8);
        const abilityStatusExamples = actorsAll.filter((a) => a?.abilityModel).slice(0, 3).map((a) => ({ actor: a?.instanceId || a?.slotId || a?.label || null, status: AbilityModel.describeImplementationStatus(a.abilityModel) }));
        const sample = damageEvents.find((e) => e?.damageResult?.abilityResolver || e?.damageResult?.proc) || null;
        const abilitySummary = abilityStatusExamples.reduce((acc, item) => {
          const st = item?.status || {};
          acc.rawOnly += (st.rawOnlyUnverified || []).length;
          acc.partial += (st.partial || []).length;
          return acc;
        }, { rawOnly: 0, partial: 0 });
        return {
          resolver: {
            damageCalculator: 'DamageCalculator',
            damageAbilityResolver: {
              source: sample?.damageResult?.abilityResolver?.source || 'DamageAbilityResolver.v1-debug-opt-in',
              mode: sample?.damageResult?.abilityResolver?.implementationStatus?.mode || 'disabled',
              partialAbilities: sample?.damageResult?.abilityResolver?.implementationStatus?.partialAbilities || ['critical', 'baseDestroyer', 'metal']
            },
            procResolver: {
              source: sample?.damageResult?.proc?.source || 'ProcResolver.v1-noop-contract',
              mode: sample?.damageResult?.proc?.mode || 'noop'
            }
          },
          recentDamageEvents: damageEvents,
          recentProcEvents: procEvents,
          abilityStatusExamples,
          abilityStatusSummary: {
            rawOnly: abilitySummary.rawOnly,
            partial: abilitySummary.partial,
            procSkipped: procEvents.reduce((n, e) => n + (e?.skippedCount || 0), 0)
          }
        };
      })(),

      kbRuntime: { actors: kbActors, activeKnockbacks: kbActors.filter((a) => a?.state === 'knockback').length, dyingOrDead: kbActors.filter((a) => a?.state === 'dead' || a?.deathPending || a?.deathAfterKnockback).length, removable: kbActors.filter((a) => a?.isRemovable).length, recentEvents: kbRecent },
      effectRuntime: { ...effectSummary, recentEvents: effectRecent },
      animationRuntime: (() => {
        const actors = (actorsAll || []).map((actor) => {
          const desc = AnimationRuntime.describeActor(actor);
          return {
            id: actor?.instanceId || actor?.slotId || actor?.label || null,
            side: actor?.side || null,
            state: desc?.state || null,
            currentAnimId: desc?.currentAnimId || null,
            activeAnimId: desc?.activeAnimId || null,
            activeAnimRole: desc?.activeAnimRole || null,
            frame: desc?.frame ?? null,
            speed: desc?.speed ?? null,
            loop: desc?.loop ?? null,
            maxFrame: desc?.maxFrame ?? null,
            modelPartCount: desc?.modelPartCount ?? 0,
            appliedTrackCount: desc?.appliedTrackCount ?? 0,
            failedTrackCount: desc?.failedTrackCount ?? 0,
            drawListCount: desc?.drawListCount ?? 0,
            lastAnimatorDebug: desc?.lastAnimatorDebug ?? null,
            lastModelDebug: desc?.lastModelDebug ?? null,
            lastAnimationRuntimeDebug: desc?.lastAnimationRuntimeDebug ?? null
          };
        });
        return {
          contract: AnimationRuntime.getAnimationContract(),
          actors,
          examples: actors.slice(0, 3),
          warnings: actors.filter((a) => !a.currentAnimId || a.modelPartCount <= 0).slice(0, 5).map((a) => ({ id: a.id, reason: !a.currentAnimId ? 'missing-currentAnimId' : 'model-part-empty' }))
        };
      })(),
      warnings: [...(scene?.debugWarnings || [])]
    };
    this.updateDomOverlay(scene, info);
    return info;
  }
}
