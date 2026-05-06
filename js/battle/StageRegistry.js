export const STAGE_CANDIDATES = ['stageRNA001_00','stageRNA001_01','stageRNA001_02','stageRNA002_00'];
export const preferredDefaultStageId = 'stageRNA001_00';

export function scoreStageCandidate(stage = {}, index = 0) {
  const stageLen = Number(stage.stageLen || stage.runtime?.stageLen || 4000);
  const enemyBaseHp = Number(stage.enemyBaseHp || stage.runtime?.enemyBaseHp || 0);
  const rows = Array.isArray(stage.runtime?.enemyRows) ? stage.runtime.enemyRows : [];
  const active = rows.filter((r) => !r?.disabled);
  const unsupported = rows.filter((r) => r?.mapping?.status === 'missing' || r?.unsupported);
  const score = Math.abs(stageLen - 4000) + active.length * 30 + unsupported.length * 200 + Math.max(0, enemyBaseHp - 100000) / 1000 + index;
  return { score, stageLen, enemyBaseHp, activeRows: active.length, unsupportedRows: unsupported.length };
}

export function resolveSafeDefaultStage(candidates = []) {
  const pool = Array.isArray(candidates) && candidates.length ? candidates : STAGE_CANDIDATES.map((id, i) => ({ id, runtime: { stageLen: 4000 + i * 200, enemyRows: [] } }));
  const ranked = pool.map((c, i) => ({ candidate: c, eval: scoreStageCandidate(c, i) })).sort((a, b) => a.eval.score - b.eval.score);
  const selected = ranked[0]?.candidate;
  const rows = Array.isArray(selected?.runtime?.enemyRows) ? selected.runtime.enemyRows : [];
  const enabledEnemyRows = rows.filter((r) => !(r?.mapping?.status === 'missing' || r?.unsupported));
  const disabledEnemyRows = rows.filter((r) => !enabledEnemyRows.includes(r)).map((r) => ({ ...r, disabled: true, disabledReason: 'unsupported-enemy' }));
  return { selectedStageId: selected?.id || preferredDefaultStageId, enabledEnemyRows, disabledEnemyRows, ranking: ranked.map((r) => ({ id: r.candidate?.id, ...r.eval })) };
}
