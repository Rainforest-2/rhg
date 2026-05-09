import { parseImgcut as parseBcuImgcut } from '../bcu/BcuImgcutParser.js';
import { BATTLE_CONFIG } from './BattleConfig.js';

async function fetchText(path) { const r = await fetch(path); if (!r.ok) throw new Error(`Failed to fetch ${path}: ${r.status}`); return await r.text(); }
async function fetchTextSafe(path) { try { return await fetchText(path); } catch { return null; } }
async function loadImage(url) { return await new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = () => rej(new Error(`Image load failed: ${url}`)); img.src = url; }); }
function loadImageSafe(url) { return loadImage(url).catch(() => null); }
function normalizeBgId(bgId) { const n = Number(bgId); if (!Number.isFinite(n) || n < 0) return null; return Math.floor(n); }
function pad2(v) { return String(Math.max(0, Number(v) || 0)).padStart(2, '0'); }
function pad3(v) { return String(Math.max(0, Number(v) || 0)).padStart(3, '0'); }

export function resolveStageBackgroundAssetCandidates(bgId = 0, fallbackStage = {}) {
  const requestedBgId = bgId;
  const normalized = normalizeBgId(bgId);
  const resolvedBgId = normalized === null ? 0 : normalized;
  const bg3 = pad3(resolvedBgId);
  const bg2 = pad2(resolvedBgId);
  const imageCandidates = [
    `./public/assets/bcu/000001/org/img/bg/bg${bg3}.png`,
    `./public/assets/bcu/000001/org/img/bg/bg${bg2}.png`,
    `./public/assets/bcu/000001/org/battle/bg/bg${bg3}.png`,
    `./public/assets/bcu/000001/org/battle/bg/bg${bg2}.png`,
    fallbackStage.imagePath || null
  ].filter(Boolean);
  const imgcutCandidates = [
    `./public/assets/bcu/000001/org/battle/bg/bg${bg3}.imgcut`,
    `./public/assets/bcu/000001/org/battle/bg/bg${bg2}.imgcut`,
    `./public/assets/bcu/000001/org/battle/bg/bg${bg3}_00.imgcut`,
    `./public/assets/bcu/000001/org/battle/bg/bg${bg2}_00.imgcut`,
    `./public/assets/bcu/000001/org/img/bg/bg${bg3}.imgcut`,
    `./public/assets/bcu/000001/org/img/bg/bg${bg2}.imgcut`,
    `./public/assets/bcu/000001/org/img/bg/bg${bg3}_00.imgcut`,
    `./public/assets/bcu/000001/org/img/bg/bg${bg2}_00.imgcut`,
    fallbackStage.imgcutPath || null
  ].filter(Boolean);
  return {
    requestedBgId,
    resolvedBgId,
    usedFallback: normalized === null,
    fallbackReason: normalized === null ? 'bgId-invalid-fallback-0' : null,
    imagePath: imageCandidates[0],
    imgcutPath: imgcutCandidates[0] || null,
    imageCandidates,
    imgcutCandidates,
    csvPath: fallbackStage.csvPath || './public/assets/bcu/000001/org/battle/bg/bg.csv',
    stageId: fallbackStage.id || 0,
    cropName: fallbackStage.cropName || '背景bg',
    candidateReport: { bg3, bg2, imageCandidates, imgcutCandidates }
  };
}

function parseImgcut(text) {
  if (typeof text !== 'string' || !text.trim()) return { parts: [] };
  try {
    const parsed = parseBcuImgcut(text);
    return { parts: Array.isArray(parsed?.parts) ? parsed.parts : [] };
  } catch {
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    const count = Number(lines[3] || 0);
    const parts = [];
    for (let i = 0; i < count; i++) {
      const cols = (lines[4 + i] || '').split(',');
      parts.push({ x: Number(cols[0] || 0), y: Number(cols[1] || 0), w: Number(cols[2] || 0), h: Number(cols[3] || 0), name: (cols[4] || '').trim() });
    }
    return { parts };
  }
}

function parseRgb(cols, start) { return { r: Number(cols[start] || 0), g: Number(cols[start + 1] || 0), b: Number(cols[start + 2] || 0) }; }
function defaultBgRow(stageId = 0) { return { stageId, skyTop: { r: 0, g: 0, b: 0 }, skyBottom: { r: 0, g: 0, b: 0 }, groundTop: { r: 0, g: 0, b: 0 }, groundBottom: { r: 0, g: 0, b: 0 }, imgcutId: 0, showUpper: false }; }
function parseBgCsv(text, stageId) {
  if (typeof text !== 'string' || !text.trim()) return defaultBgRow(stageId);
  const rows = text.replace(/^\uFEFF/, '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  for (const row of rows) {
    const cols = row.split(',');
    if (Number(cols[0]) !== stageId) continue;
    return { stageId, skyTop: parseRgb(cols, 1), skyBottom: parseRgb(cols, 4), groundTop: parseRgb(cols, 7), groundBottom: parseRgb(cols, 10), imgcutId: Number(cols[13] || 0), showUpper: Number(cols[14] || 0) !== 0 };
  }
  return defaultBgRow(stageId);
}

function imageFullCrop(image, name = 'whole-image') {
  const w = Number(image?.naturalWidth || image?.width || 0);
  const h = Number(image?.naturalHeight || image?.height || 0);
  return { x: 0, y: 0, w: Math.max(1, w), h: Math.max(1, h), name, cropRole: 'full-image-fallback-because-imgcut-missing' };
}

function forceCoverModeForWholeImageBackground() {
  if (!BATTLE_CONFIG?.stage) return;
  BATTLE_CONFIG.stage.backgroundMode = 'cover';
  BATTLE_CONFIG.stage.backgroundModeSource = 'bcu-bg-image-whole-crop-cover-no-ground-fill';
}

export class StageBackgroundLoader {
  constructor(log) { this.log = log || (() => {}); }
  async load(stage) {
    if (this.__test) {
      const bgResolved = resolveStageBackgroundAssetCandidates(stage?.bgId, stage || {});
      forceCoverModeForWholeImageBackground();
      return { image: { width: 1024, height: 512, src: bgResolved.imagePath }, crop: { x: 0, y: 0, w: 1024, h: 512, name: 'whole-image', cropRole: 'full-image-fallback-because-imgcut-missing' }, upperCrop: null, colors: defaultBgRow(stage?.id || 0), source: { requestedBgId: bgResolved.requestedBgId, resolvedBgId: bgResolved.resolvedBgId, bgUsedFallback: false, bgFallbackReason: null, imagePath: bgResolved.imagePath, imgcutPath: null, csvPath: bgResolved.csvPath, stageId: stage?.id || 0, imgcutId: 0, showUpper: false, backgroundCsvKind: 'bcu-bg-csv', usesWholeImageAsCrop: true, disableGroundFill: true, rendererMode: 'cover', rendererModeSource: BATTLE_CONFIG.stage.backgroundModeSource, candidateReport: bgResolved.candidateReport } };
    }
    const fallbackStage = stage || {};
    const bgResolved = resolveStageBackgroundAssetCandidates(stage?.bgId, fallbackStage);
    let image = null;
    let imagePath = null;
    for (const candidate of bgResolved.imageCandidates) {
      image = await loadImageSafe(candidate);
      if (image) { imagePath = candidate; break; }
    }
    if (!image) {
      const fallbackImagePath = fallbackStage.imagePath || bgResolved.imagePath;
      image = await loadImageSafe(fallbackImagePath);
      imagePath = image ? fallbackImagePath : null;
    }
    if (!image) throw new Error('No image for stage background');

    let imgcutText = null;
    let imgcutPath = null;
    for (const candidate of bgResolved.imgcutCandidates) {
      imgcutText = await fetchTextSafe(candidate);
      if (imgcutText) { imgcutPath = candidate; break; }
    }

    const csvPath = stage?.csvPath || bgResolved.csvPath;
    const csvText = await fetchTextSafe(csvPath);
    const bgRow = parseBgCsv(csvText, stage?.id || 0);
    const { parts } = parseImgcut(imgcutText);
    let part = null;
    let upperPart = null;
    let usesWholeImageAsCrop = false;
    let bgFallbackReason = bgResolved.fallbackReason;

    if (parts.length) {
      part = parts.find((p) => p.name === stage?.cropName) || parts.find((p) => p.name === bgResolved.cropName) || parts[bgRow.imgcutId] || parts[0];
      upperPart = bgRow.showUpper ? parts.find((p) => p.name === '背景上部') : null;
    } else {
      part = imageFullCrop(image);
      usesWholeImageAsCrop = true;
      bgFallbackReason = bgFallbackReason || null;
      forceCoverModeForWholeImageBackground();
      this.log('warn', `background imgcut missing for bgId=${bgResolved.resolvedBgId}; using whole bg image as crop with cover renderer`);
    }

    return {
      image,
      crop: { x: part.x, y: part.y, w: part.w, h: part.h, name: part.name || stage?.cropName || 'whole-image', cropRole: part.cropRole || 'BCU Background.BG part' },
      upperCrop: upperPart ? { x: upperPart.x, y: upperPart.y, w: upperPart.w, h: upperPart.h, name: upperPart.name, upperCropRole: 'BCU Background.TOP part if present' } : null,
      colors: { skyTop: bgRow.skyTop, skyBottom: bgRow.skyBottom, groundTop: bgRow.groundTop, groundBottom: bgRow.groundBottom },
      source: {
        requestedBgId: bgResolved.requestedBgId,
        resolvedBgId: bgResolved.resolvedBgId,
        bgUsedFallback: !!bgResolved.usedFallback,
        bgFallbackReason: bgFallbackReason || null,
        imagePath,
        imgcutPath,
        csvPath,
        stageId: stage?.id || 0,
        imgcutId: bgRow.imgcutId,
        showUpper: bgRow.showUpper,
        backgroundCsvKind: 'bcu-bg-csv',
        usesWholeImageAsCrop,
        disableGroundFill: usesWholeImageAsCrop,
        rendererMode: usesWholeImageAsCrop ? 'cover' : (BATTLE_CONFIG.stage?.backgroundMode || 'bcu-stage0'),
        rendererModeSource: usesWholeImageAsCrop ? BATTLE_CONFIG.stage?.backgroundModeSource : null,
        candidateReport: bgResolved.candidateReport
      }
    };
  }
}
