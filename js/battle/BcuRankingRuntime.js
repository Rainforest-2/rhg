const BCU_FRAMES_PER_MINUTE = 60 * 30;

function finite(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function isAliveBase(base) {
  if (!base) return false;
  const hp = finite(base.hp ?? base.health, 0);
  return hp > 0 && base.destroyed !== true;
}

function actorIsResolvedDead(actor) {
  if (!actor) return false;
  return actor.deathPending === true
    || actor.deathAfterKnockback === true
    || actor.deathResolved === true
    || actor.state === 'dead'
    || actor.state === 'dying'
    || (finite(actor.hp, 1) <= 0 && actor.isAliveFlag === false);
}

function normalizeKillMode(value) {
  const mode = String(value ?? '').trim().toUpperCase();
  if (mode === 'NORMAL' || mode === 'SELF_DESTRUCT' || mode === 'SPIRIT') return mode;
  return null;
}

export function resolveBcuActorKillMode(actor) {
  for (const value of [actor?.bcuKillMode, actor?.lastKillMode, actor?.killMode]) {
    const mode = normalizeKillMode(value);
    if (mode) return mode;
  }
  const hits = Array.isArray(actor?.lastKilledBy) ? actor.lastKilledBy : [];
  for (let i = hits.length - 1; i >= 0; i -= 1) {
    const hit = hits[i];
    const mode = normalizeKillMode(
      hit?.meta?.bcuKillMode
      ?? hit?.meta?.killMode
      ?? hit?.damageCalculation?.killMode
      ?? hit?.meta?.damageCalculation?.killMode
    );
    if (mode) return mode;
  }
  // BattleActor.lastKilledBy is populated only by queued attack damage. In the
  // current runtime that is the NORMAL kill path; self-destruct/spirit callers
  // must set an explicit kill mode and therefore do not fall through here.
  return hits.length > 0 ? 'NORMAL' : 'UNKNOWN';
}

function stageRowForActor(scene, actor) {
  const rowIndex = finite(actor?.stageSpawnRowIndex, null);
  if (rowIndex == null) return null;
  const rows = scene?.stage?.runtime?.enemyRows || scene?.stageSpawnRuntime?.rows?.map((state) => state?.row) || [];
  return rows.find((row) => Number(row?.rowIndex) === rowIndex) || null;
}

function enemyDropRaw(actor) {
  return Math.max(0, finite(
    actor?.rawStats?.rewardRaw
      ?? actor?.rawStats?.reward
      ?? actor?.stats?.rewardRaw
      ?? actor?.stats?.reward
      ?? actor?.rewardRaw
      ?? actor?.reward,
    0
  ));
}

function exactTimeLimitFrames(stageRuntime) {
  return finite(
    stageRuntime?.timeLimitFramesExact
      ?? stageRuntime?.definition?.timeLimitFramesExact
      ?? stageRuntime?.stageDefinition?.timeLimitFramesExact
      ?? stageRuntime?.definition?.runtime?.timeLimitFramesExact
      ?? stageRuntime?.stageDefinition?.runtime?.timeLimitFramesExact,
    null
  );
}

function exactTimeLimitSource(stageRuntime) {
  return stageRuntime?.timeLimitSource
    ?? stageRuntime?.definition?.timeLimitSource
    ?? stageRuntime?.stageDefinition?.timeLimitSource
    ?? stageRuntime?.definition?.runtime?.timeLimitSource
    ?? stageRuntime?.stageDefinition?.runtime?.timeLimitSource
    ?? 'exact-frame-override';
}

export function calculateBcuRankingEnemyScore({ actor, row, elapsedFrames, timeLimitFrames } = {}) {
  const time = Math.max(1, Math.trunc(finite(timeLimitFrames, 1)));
  const elapsed = Math.max(0, Math.trunc(finite(elapsedFrames, 0)));
  const dropComponent = enemyDropRaw(actor) / 100;
  const rowScore = finite(row?.score ?? row?.scdef?.score ?? row?.scdefRaw?.internal?.SC, 0);
  // BCU EEnemy.kill(KillMode.NORMAL):
  // (int)(getDrop()/100f + row.score * (2*time - basis.time) / time)
  return Math.trunc(dropComponent + (rowScore * (2 * time - elapsed)) / time);
}

export class BcuRankingRuntime {
  constructor(stageRuntime = {}) {
    this.trail = stageRuntime?.trail === true;
    this.timeLimitMinutes = Math.max(0, Math.trunc(finite(stageRuntime?.timeLimit, 0)));
    const exactFrames = exactTimeLimitFrames(stageRuntime);
    if (Number.isFinite(exactFrames) && exactFrames > 0) {
      this.timeLimitFrames = Math.max(1, Math.ceil(exactFrames));
      this.timeLimitSource = exactTimeLimitSource(stageRuntime);
    } else {
      this.timeLimitFrames = this.timeLimitMinutes * BCU_FRAMES_PER_MINUTE;
      this.timeLimitSource = 'bcu-stage-timeLimit-minutes';
    }
    this.elapsedFrames = 0;
    this.score = Math.max(0, Math.trunc(finite(stageRuntime?.rankingScore ?? stageRuntime?.score, 0)));
    this.scoreLimit = finite(
      stageRuntime?.scoreLimit
        ?? stageRuntime?.rankingScoreLimit
        ?? stageRuntime?.lim?.score
        ?? stageRuntime?.customStageLimits?.score,
      null
    );
    this.overtime = false;
    this.failedScoreLimit = false;
    this.scoredActorIds = new Set();
    this.lastScoreEvent = null;
    this.source = 'BCU StageBasis.isDojoOvertime / EEnemy.kill trail score';
  }

  updateClock(logicFrame) {
    this.elapsedFrames = Math.max(0, Math.trunc(finite(logicFrame, this.elapsedFrames)));
    this.overtime = this.trail
      && this.timeLimitFrames > 0
      && (this.timeLimitFrames - this.elapsedFrames) < 0;
    return this.overtime;
  }

  isActive(scene) {
    if (!this.trail) return true;
    const enemyBase = (scene?.bases || []).find((base) => base?.side === 'cat-enemy');
    const playerBase = (scene?.bases || []).find((base) => base?.side === 'dog-player');
    return isAliveBase(enemyBase) && isAliveBase(playerBase) && !this.overtime;
  }

  scoreEnemyDeath(scene, actor) {
    if (!this.trail || !actor || actor.side !== 'cat-enemy' || !actorIsResolvedDead(actor)) return null;
    const actorId = String(actor.instanceId ?? actor.id ?? actor.stageSpawnId ?? '');
    if (!actorId || this.scoredActorIds.has(actorId)) return null;
    const killMode = resolveBcuActorKillMode(actor);
    if (killMode !== 'NORMAL' || this.overtime || !this.isActive(scene)) return null;
    // BCU explicitly scores EEnemy.line == -1 with lineScore = 0. A missing
    // stage row therefore removes only the row-score term, not the drop term.
    const row = stageRowForActor(scene, actor);
    const delta = calculateBcuRankingEnemyScore({
      actor,
      row,
      elapsedFrames: this.elapsedFrames,
      timeLimitFrames: this.timeLimitFrames
    });
    this.scoredActorIds.add(actorId);
    this.score += delta;
    this.lastScoreEvent = {
      actorId,
      rowIndex: row?.rowIndex ?? null,
      killMode,
      delta,
      score: this.score,
      elapsedFrames: this.elapsedFrames,
      timeLimitFrames: this.timeLimitFrames,
      timeLimitSource: this.timeLimitSource,
      rowScore: finite(row?.score, 0),
      dropRaw: enemyDropRaw(actor),
      source: 'BCU EEnemy.kill trail score formula'
    };
    return this.lastScoreEvent;
  }

  enforceOvertimeLoss(scene) {
    if (!this.overtime || !Number.isFinite(this.scoreLimit) || this.score >= this.scoreLimit) return false;
    const playerBase = (scene?.bases || []).find((base) => base?.side === 'dog-player');
    if (!playerBase) return false;
    if ('hp' in playerBase) playerBase.hp = 0;
    if ('health' in playerBase) playerBase.health = 0;
    playerBase.destroyed = true;
    this.failedScoreLimit = true;
    return true;
  }

  describe() {
    return {
      trail: this.trail,
      timeLimitMinutes: this.timeLimitMinutes,
      timeLimitFrames: this.timeLimitFrames,
      timeLimitSource: this.timeLimitSource,
      elapsedFrames: this.elapsedFrames,
      remainingFrames: this.timeLimitFrames > 0 ? this.timeLimitFrames - this.elapsedFrames : null,
      overtime: this.overtime,
      score: this.score,
      scoreLimit: this.scoreLimit,
      failedScoreLimit: this.failedScoreLimit,
      scoredEnemyCount: this.scoredActorIds.size,
      lastScoreEvent: this.lastScoreEvent,
      source: this.source
    };
  }
}

export { BCU_FRAMES_PER_MINUTE };
