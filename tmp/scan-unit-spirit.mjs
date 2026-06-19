import fs from 'node:fs/promises';
import path from 'node:path';
import { BcuCombatModel } from '../js/battle/BcuCombatModel.js';
const ROOT='public/assets/bcu';
const parseRows=(t)=>String(t||'').replace(/^﻿/,'').split(/\r?\n/).map(l=>l.replace(/\/\/.*$/,'').trim()).filter(Boolean).map(l=>l.split(',').map(x=>x.trim()));
const toN=(c)=>c.map(v=>Number.isFinite(Number(v))?Number(v):0);
const packs=(await fs.readdir(ROOT)).filter(d=>/^\d+$/.test(d));
const byUnit=new Map(); // unitId -> {form0 raw, pack}
for(const pack of packs){
  const ud=path.join(ROOT,pack,'org/unit');
  let ids;try{ids=await fs.readdir(ud);}catch{continue;}
  for(const id of ids){
    const f=path.join(ud,id,`unit${id}.csv`);
    let t;try{t=await fs.readFile(f,'utf8');}catch{continue;}
    const rows=parseRows(t).map(toN);
    if(rows.length) byUnit.set(Number(id), rows[0]); // newest pack overwrites; form 0 row
  }
}
const spirit=[],barrierU=[],reviveU=[];
for(const [id,raw] of [...byUnit].sort((a,b)=>a[0]-b[0])){
  let m;try{m=BcuCombatModel.parseStats({kind:'unit',rawValues:raw});}catch{continue;}
  const p=m.proc||{};
  if(p.spirit?.id) spirit.push(`${id}->spiritForm${p.spirit.id}`);
  if(p.barrier?.health>0) barrierU.push(id);
  if(p.revive?.count) reviveU.push(id);
}
console.log('units scanned:',byUnit.size);
console.log('SPIRIT units:',spirit.join('  '));
console.log('barrier units:',barrierU.join(','));
console.log('revive units:',reviveU.join(','));
