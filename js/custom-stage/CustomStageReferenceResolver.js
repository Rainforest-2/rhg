// Resolve typed stage references into a status descriptor.
//
// Used both for UI display (badge BCU / 自作, "削除済み自作ステージ") and for the pre-launch guard
// that must STOP a stage-vs-stage battle when a referenced custom stage was deleted or a BCU stage
// no longer resolves. A deleted custom ref is never auto-replaced — it is surfaced as an error.
import { normalizeStageRef, stageRefKey } from './CustomStageSchema.js';
import { getCustomStage } from './CustomStageStore.js';

// BCU resolution goes through StageRegistry.getStageById, which requires the BCU asset database to
// be loaded. Wrap it so a not-loaded / throwing lookup degrades to "unresolved" instead of crashing
// callers (and so node unit tests can inject their own resolver).
function defaultResolveBcu(id) {
  try {
    // Lazy import keeps this module loadable without the battle DB in plain-node tests.
    const mod = globalThis.__STAGE_REGISTRY_FOR_CUSTOM_STAGE__ || null;
    if (mod && typeof mod.getStageById === 'function') return mod.getStageById(id) || null;
  } catch {}
  return null;
}

export function resolveStageRef(rawRef, { resolveBcu = defaultResolveBcu } = {}) {
  const ref = normalizeStageRef(rawRef);
  if (!ref) {
    return { ok: false, kind: null, id: null, ref: null, reason: 'invalid-ref', label: '不明なステージ' };
  }
  if (ref.kind === 'custom') {
    const stage = getCustomStage(ref.id);
    if (!stage) {
      return { ok: false, kind: 'custom', id: ref.id, ref, reason: 'custom-stage-deleted', label: '削除済み自作ステージ' };
    }
    return { ok: true, kind: 'custom', id: ref.id, ref, stage, label: stage.name || '自作ステージ' };
  }
  const bcu = resolveBcu(ref.id);
  if (!bcu) {
    return { ok: false, kind: 'bcu', id: ref.id, ref, reason: 'bcu-stage-unresolved', label: ref.id };
  }
  return { ok: true, kind: 'bcu', id: ref.id, ref, bcu, label: bcu.label || bcu.stageId || ref.id };
}

export function resolveStageRefList(refs, options = {}) {
  return (refs || []).map((ref) => resolveStageRef(ref, options));
}

// Pre-launch validation for a full battle config. Returns { ok, errors: [...] } with a Japanese
// reason per broken reference so the UI can scroll to and explain the failing row.
export function validateBattleLaunch(config, options = {}) {
  const errors = [];
  const enemyStages = config?.enemyStages || [];
  const playerStages = config?.playerStages || [];
  if (!enemyStages.length) errors.push({ side: 'enemy', reason: 'empty', message: '敵側にステージが登録されていません' });
  if (!playerStages.length) errors.push({ side: 'player', reason: 'empty', message: '味方側にステージが登録されていません' });

  const check = (side, refs) => {
    for (const ref of refs) {
      const resolved = resolveStageRef(ref, options);
      if (resolved.ok) continue;
      const reasonMessage = resolved.reason === 'custom-stage-deleted'
        ? `${side === 'enemy' ? '敵側' : '味方側'}に削除済みの自作ステージが登録されています`
        : `${side === 'enemy' ? '敵側' : '味方側'}のステージ「${resolved.label}」を読み込めません`;
      errors.push({ side, reason: resolved.reason, ref: resolved.ref, key: stageRefKey(resolved.ref), message: reasonMessage });
    }
  };
  check('enemy', enemyStages);
  check('player', playerStages);

  // Base stage must resolve (its background/castle/HP/length drive the shared battlefield).
  const baseSource = config?.baseSource === 'player' ? 'player' : 'enemy';
  const baseRef = baseSource === 'player'
    ? (playerStages[0] || enemyStages[0] || null)
    : (enemyStages[0] || playerStages[0] || null);
  if (baseRef) {
    const resolvedBase = resolveStageRef(baseRef, options);
    if (!resolvedBase.ok) {
      errors.push({ side: 'base', reason: 'base-unresolved', ref: resolvedBase.ref, message: '基準ステージを読み込めません' });
    }
  }
  return { ok: errors.length === 0, errors, baseRef: baseRef ? normalizeStageRef(baseRef) : null, baseSource };
}
