const stripComment = (line) => String(line || '').split('//')[0].trim();

export function parseBcuStageCsvRows(text) {
  return String(text || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map(stripComment)
    .filter(Boolean)
    .map((line) => line.split(',').map((cell) => cell.trim()));
}

export function looksLikeBcuStageHeaderRow(row) {
  const stageLength = Number(row?.[0]);
  const baseHealth = Number(row?.[1]);
  return Number.isFinite(stageLength)
    && Number.isFinite(baseHealth)
    && stageLength >= 1000
    && baseHealth >= 100;
}

export function resolveBcuStageCsvLayout(input) {
  const rows = Array.isArray(input) ? input : parseBcuStageCsvRows(input);
  const hasCastleRow = rows.length > 0 && !looksLikeBcuStageHeaderRow(rows[0]);
  const headerIndex = hasCastleRow ? 1 : 0;
  const enemyRowStartIndex = headerIndex + 1;
  return {
    rows,
    hasCastleRow,
    castleRow: hasCastleRow ? (rows[0] || []) : [],
    headerRow: rows[headerIndex] || [],
    headerIndex,
    enemyRows: rows.slice(enemyRowStartIndex),
    enemyRowStartIndex
  };
}

export function getBcuStageBackgroundId(input) {
  const { headerRow } = resolveBcuStageCsvLayout(input);
  const bgId = Number(headerRow?.[4]);
  return Number.isFinite(bgId) ? bgId : null;
}
