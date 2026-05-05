async function fetchText(path) { const r = await fetch(path); if (!r.ok) throw new Error(`Failed to fetch ${path}: ${r.status}`); return await r.text(); }
async function loadImage(url) { return await new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = () => rej(new Error(`Image load failed: ${url}`)); img.src = url; }); }

function parseImgcut(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const count = Number(lines[3] || 0);
  const parts = [];
  for (let i = 0; i < count; i++) {
    const cols = (lines[4 + i] || '').split(',');
    parts.push({ x: Number(cols[0] || 0), y: Number(cols[1] || 0), w: Number(cols[2] || 0), h: Number(cols[3] || 0), name: (cols[4] || '').trim() });
  }
  return { parts };
}

function parseRgb(cols, start) { return { r: Number(cols[start] || 0), g: Number(cols[start + 1] || 0), b: Number(cols[start + 2] || 0) }; }

function parseBgCsv(text, stageId) {
  const rows = text.replace(/^\uFEFF/, '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  for (const row of rows) {
    const cols = row.split(',');
    if (Number(cols[0]) !== stageId) continue;
    return {
      stageId,
      skyTop: parseRgb(cols, 1),
      skyBottom: parseRgb(cols, 4),
      groundTop: parseRgb(cols, 7),
      groundBottom: parseRgb(cols, 10),
      imgcutId: Number(cols[13] || 0),
      showUpper: Number(cols[14] || 0) !== 0
    };
  }
  return {
    stageId,
    skyTop: { r: 0, g: 0, b: 0 },
    skyBottom: { r: 0, g: 0, b: 0 },
    groundTop: { r: 0, g: 0, b: 0 },
    groundBottom: { r: 0, g: 0, b: 0 },
    imgcutId: 0,
    showUpper: false
  };
}

export class StageBackgroundLoader {
  constructor(log) { this.log = log || (() => {}); }
  async load(stage) {
    const image = await loadImage(stage.imagePath);
    const imgcutText = await fetchText(stage.imgcutPath);
    const csvText = await fetchText(stage.csvPath);
    const bgRow = parseBgCsv(csvText, stage.id || 0);
    const { parts } = parseImgcut(imgcutText);
    if (!parts.length) throw new Error('No imgcut parts for stage background');
    let part = parts.find((p) => p.name === stage.cropName);
    if (!part) { this.log('warn', `stage background crop '${stage.cropName}' not found; fallback parts[0]`); part = parts[0]; }
    const upperPart = bgRow.showUpper ? parts.find((p) => p.name === '背景上部') : null;
    return {
      image,
      crop: { x: part.x, y: part.y, w: part.w, h: part.h, name: part.name || stage.cropName || 'part0', cropRole: 'BCU Background.BG part' },
      upperCrop: upperPart ? { x: upperPart.x, y: upperPart.y, w: upperPart.w, h: upperPart.h, name: upperPart.name, upperCropRole: 'BCU Background.TOP part if present' } : null,
      colors: { skyTop: bgRow.skyTop, skyBottom: bgRow.skyBottom, groundTop: bgRow.groundTop, groundBottom: bgRow.groundBottom },
      source: { imagePath: stage.imagePath, imgcutPath: stage.imgcutPath, csvPath: stage.csvPath, stageId: stage.id || 0, imgcutId: bgRow.imgcutId, showUpper: bgRow.showUpper, backgroundCsvKind: 'bcu-bg-csv', notStageMetadata: true }
    };
  }
}
