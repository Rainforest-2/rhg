import fs from 'node:fs/promises';

const parsePngSize = (buf) => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });
const parseUniImgcut = (text) => String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).map((v) => v.trim()).filter(Boolean)
  .map((line) => line.split(','))
  .filter((cols) => cols.length >= 4 && cols.slice(0, 4).every((v) => Number.isFinite(Number(v))))
  .map((cols, index) => ({ x: Number(cols[0]), y: Number(cols[1]), w: Number(cols[2]), h: Number(cols[3]), label: cols.slice(4).join(',').trim(), index }));

const files = [
  'public/assets/bcu/000004/org/unit/000/f/uni000_f00.png',
  'public/assets/bcu/000004/org/unit/001/f/uni001_f00.png',
  'public/assets/bcu/000004/org/unit/002/f/uni002_f00.png',
  'public/assets/bcu/000010/org/enemy/000/enemy_icon_000.png',
  'public/assets/bcu/000010/org/enemy/001/enemy_icon_001.png',
  'public/assets/bcu/000010/org/enemy/002/enemy_icon_002.png',
  'public/assets/bcu/000001/org/page/uni.png'
];

for (const file of files) {
  const size = parsePngSize(await fs.readFile(file));
  console.log(`${file} ${size.w}x${size.h}`);
}

const imgcutText = await fs.readFile('public/assets/bcu/000001/org/data/uni.imgcut', 'utf8');
const parts = parseUniImgcut(imgcutText);
console.log('\nuni.imgcut parts:');
for (const p of parts) console.log(`index=${p.index} x=${p.x} y=${p.y} w=${p.w} h=${p.h} label=${p.label}`);

const card = parts[0];
if (!card || card.x !== 9 || card.y !== 21 || card.w !== 110 || card.h !== 85) {
  throw new Error(`unexpected BCU unit card imgcut part: ${JSON.stringify(card)}`);
}
console.log(`\nBCU production card source rect: ${card.x},${card.y},${card.w},${card.h}`);
console.log(`BCU production card ratio: ${(card.w / card.h).toFixed(6)}`);
