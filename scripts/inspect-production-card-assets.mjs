import fs from 'node:fs/promises';
const files=[
'public/assets/bcu/000004/org/unit/000/f/uni000_f00.png','public/assets/bcu/000004/org/unit/001/f/uni001_f00.png','public/assets/bcu/000004/org/unit/002/f/uni002_f00.png',
'public/assets/bcu/000010/org/enemy/000/enemy_icon_000.png','public/assets/bcu/000010/org/enemy/001/enemy_icon_001.png','public/assets/bcu/000010/org/enemy/002/enemy_icon_002.png'
];
for (const f of files){ const b=await fs.readFile(f); console.log(f, b.readUInt32BE(16)+'x'+b.readUInt32BE(20)); }
console.log('\nuni.imgcut:\n'+await fs.readFile('public/assets/bcu/000001/org/data/uni.imgcut','utf8'));
