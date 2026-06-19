// Scan all BCU enemy stat rows (t_unit.csv across packs, newest pack wins per id)
// and report enemy ids that carry each ability of interest, with names.
import fs from 'node:fs/promises';
import path from 'node:path';
import { BcuCombatModel } from '../js/battle/BcuCombatModel.js';

const BCU_ROOT = 'public/assets/bcu';
const parseCsvRows = (text) => String(text || '').replace(/^﻿/, '').split(/\r?\n/)
  .map((l) => l.replace(/\/\/.*$/, '').trim()).filter(Boolean)
  .map((l) => l.split(',').map((x) => x.trim()));
const toNumbers = (cols) => cols.map((v) => (Number.isFinite(Number(v)) ? Number(v) : 0));
const packNum = (p) => Number(String(p).replace(/\D/g, '')) || 0;

const packs = (await fs.readdir(BCU_ROOT)).filter((d) => /^\d+$/.test(d)).sort((a, b) => packNum(a) - packNum(b));

// Load enemy stats: newest pack row wins per enemy id.
const enemyRows = new Map(); // id -> rawValues
for (const pack of packs) {
  const file = path.join(BCU_ROOT, pack, 'org/data/t_unit.csv');
  let text;
  try { text = await fs.readFile(file, 'utf8'); } catch { continue; }
  const rows = parseCsvRows(text).map(toNumbers);
  rows.forEach((row, id) => {
    if (Array.isArray(row) && row.some((v) => Number(v) !== 0)) enemyRows.set(id, row);
  });
}

// Load enemy names (EnemyName.txt: one name per line, line index = enemy id).
let names = [];
for (const pack of [...packs].reverse()) {
  const f1 = path.join(BCU_ROOT, pack, 'EnemyName.txt');
  try {
    const t = await fs.readFile(f1, 'utf8');
    const lines = t.replace(/^﻿/, '').split(/\r?\n/);
    if (lines.length > names.length) names = lines;
  } catch {}
}
const nm = (id) => (names[id] || '').trim();

const buckets = {
  delay: [], barrier: [], demonShield: [], burrow: [], zombieRevive: [],
  deathSurge: [], wave: [], surge: [], curse: [], freeze: [], slow: [],
  weaken: [], warp: [], toxic: [], summon: [],
};

for (const [id, raw] of [...enemyRows.entries()].sort((a, b) => a[0] - b[0])) {
  let m;
  try { m = BcuCombatModel.parseStats({ kind: 'enemy', rawValues: raw }); } catch { continue; }
  const p = m.proc || {};
  const tr = m.traits?.flags || {};
  const tag = `${id}(${nm(id)})`;
  if (p.delay?.prob > 0) buckets.delay.push(tag);
  if (p.barrier?.health > 0) buckets.barrier.push(tag);
  if (p.demonShield?.hp > 0) buckets.demonShield.push(tag);
  if (p.burrow?.count > 0) buckets.burrow.push(tag);
  if (p.revive?.count !== 0 && (tr.zombie || p.revive?.count)) buckets.zombieRevive.push(`${tag}[c=${p.revive.count},t=${p.revive.time},h=${p.revive.health}]`);
  if (p.deathSurge?.prob > 0) buckets.deathSurge.push(tag);
  if (p.wave?.prob > 0 || p.miniWave?.prob > 0) buckets.wave.push(tag);
  if (p.volcano?.prob > 0 || p.miniVolcano?.prob > 0) buckets.surge.push(tag);
  if (p.curse?.prob > 0) buckets.curse.push(tag);
  if (p.freeze?.prob > 0) buckets.freeze.push(tag);
  if (p.slow?.prob > 0) buckets.slow.push(tag);
  if (p.weaken?.prob > 0) buckets.weaken.push(tag);
  if (p.warp?.prob > 0) buckets.warp.push(tag);
  if (p.toxic?.prob > 0) buckets.toxic.push(tag);
  if (p.summon?.exists || p.summon?.prob > 0) buckets.summon.push(tag);
}

console.log('total enemy rows:', enemyRows.size, 'packs:', packs.join(','));
for (const [k, v] of Object.entries(buckets)) {
  console.log(`\n## ${k} (${v.length})`);
  console.log(v.slice(0, 40).join('  '));
}
