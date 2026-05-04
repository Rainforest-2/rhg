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

function parseBgCsv(text, stageId) {
  const rows = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  const header = rows[0].split(',');
  const idxId = header.indexOf('id');
  const idxImgcut = header.indexOf('使用imgcut');
  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i].split(',');
    if (Number(cols[idxId]) === stageId) return Number(cols[idxImgcut] || 0);
  }
  return 0;
}

export class StageBackgroundLoader {
  constructor(log) { this.log = log || (() => {}); }
  async load(stage) {
    const image = await loadImage(stage.imagePath);
    const imgcutText = await fetchText(stage.imgcutPath);
    const csvText = await fetchText(stage.csvPath);
    const imgcutId = parseBgCsv(csvText, stage.id || 0);
    const { parts } = parseImgcut(imgcutText);
    if (!parts.length) throw new Error('No imgcut parts for stage background');
    let part = parts.find((p) => p.name === stage.cropName);
    if (!part) { this.log('warn', `stage background crop '${stage.cropName}' not found; fallback parts[0]`); part = parts[0]; }
    return { image, crop: { x: part.x, y: part.y, w: part.w, h: part.h, name: part.name || stage.cropName || 'part0' }, source: { imagePath: stage.imagePath, imgcutPath: stage.imgcutPath, csvPath: stage.csvPath, stageId: stage.id || 0, imgcutId } };
  }
}
