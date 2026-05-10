function toFiniteNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeBgId(bgId) {
  const n = Number(bgId);
  if (!Number.isFinite(n) || n < 0) {
    return {
      requestedBgId: bgId,
      resolvedBgId: 0,
      usedFallback: true,
      fallbackReason: 'bgId-invalid-fallback-0'
    };
  }
  return {
    requestedBgId: bgId,
    resolvedBgId: Math.floor(n),
    usedFallback: false,
    fallbackReason: null
  };
}

function firstResolvableBgValue(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === '') continue;
    return value;
  }
  return null;
}

function pad2(v) { return String(Math.max(0, Number(v) || 0)).padStart(2, '0'); }
function pad3(v) { return String(Math.max(0, Number(v) || 0)).padStart(3, '0'); }

export class StageBackgroundResolver {
  static normalizeBgId(bgId) { return normalizeBgId(bgId); }

  static resolve(bgId = 0, fallbackStage = {}, options = {}) {
    const normalized = normalizeBgId(bgId);
    const resolvedBgId = normalized.resolvedBgId;
    const bg3 = pad3(resolvedBgId);
    const bg2 = pad2(resolvedBgId);
    const baseDir = options.baseDir || './public/assets/bcu/000001/org';
    const imagePath = `${baseDir}/img/bg/bg${bg3}.png`;
    const imgcutPath = `${baseDir}/battle/bg/bg${bg2}.imgcut`;
    const csvPath = fallbackStage.csvPath || `${baseDir}/battle/bg/bg.csv`;
    const cropName = fallbackStage.cropName || '背景bg';
    return {
      requestedBgId: normalized.requestedBgId,
      resolvedBgId,
      usedFallback: normalized.usedFallback,
      fallbackReason: normalized.fallbackReason,
      imagePath,
      imgcutPath,
      imageCandidates: [imagePath, fallbackStage.imagePath].filter(Boolean),
      imgcutCandidates: [imgcutPath, fallbackStage.imgcutPath].filter(Boolean),
      csvPath,
      stageId: toFiniteNumber(fallbackStage.id, 0),
      cropName,
      assetKind: 'bcu-stage-background',
      backgroundCsvKind: 'bcu-bg-csv',
      candidateReport: {
        requestedBgId: normalized.requestedBgId,
        resolvedBgId,
        bg3,
        bg2,
        imagePath,
        imgcutPath,
        csvPath,
        cropName,
        usedFallback: normalized.usedFallback,
        fallbackReason: normalized.fallbackReason
      }
    };
  }

  static fromStage(stage = {}, runtime = null, options = {}) {
    const stageDefinition = stage?.definition || stage?.stageDefinition || null;
    const bgId = firstResolvableBgValue(
      runtime?.bgId,
      stage?.runtime?.bgId,
      stageDefinition?.runtime?.bgId,
      stageDefinition?.bgId,
      stage?.bgId
    );
    return StageBackgroundResolver.resolve(bgId, stage, options);
  }

  static buildSource(resolved, loaded = {}) {
    return {
      requestedBgId: resolved?.requestedBgId ?? null,
      resolvedBgId: resolved?.resolvedBgId ?? null,
      bgUsedFallback: !!resolved?.usedFallback || !!loaded?.usedFallback,
      bgFallbackReason: loaded?.fallbackReason || resolved?.fallbackReason || null,
      imagePath: loaded?.imagePath || resolved?.imagePath || null,
      imgcutPath: loaded?.imgcutPath || resolved?.imgcutPath || null,
      csvPath: loaded?.csvPath || resolved?.csvPath || null,
      stageId: loaded?.stageId ?? resolved?.stageId ?? 0,
      bgId: loaded?.bgId ?? resolved?.resolvedBgId ?? null,
      imgcutId: loaded?.imgcutId ?? null,
      showUpper: !!loaded?.showUpper,
      imageReferenceId: loaded?.imageReferenceId ?? null,
      csvRowFound: loaded?.csvRowFound ?? null,
      bgCsvSource: loaded?.bgCsvSource || null,
      backgroundCsvKind: resolved?.backgroundCsvKind || 'bcu-bg-csv',
      assetKind: resolved?.assetKind || 'bcu-stage-background',
      candidateReport: resolved?.candidateReport || null
    };
  }
}

export function resolveStageBackgroundAssetCandidates(bgId = 0, fallbackStage = {}, options = {}) {
  return StageBackgroundResolver.resolve(bgId, fallbackStage, options);
}
