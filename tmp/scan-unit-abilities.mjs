import fs from 'node:fs/promises';
import path from 'node:path';
import { BcuCombatModel } from '../js/battle/BcuCombatModel.js';
const ROOT='public/assets/bcu';
const parseRows=(t)=>String(t||'').replace(/^﻿/,'').split(/\r?\n/).map(l=>l.replace(/\/\/.*$/,'').trim()).filter(Boolean).map(l=>l.split(',').map(x=>x.trim()));
const toN=(c)=>c.map(v=>Number.isFinite(Number(v))?Number(v):0);
const packNum=(p)=>Number(String(p).replace(/\D/g,''))||0;
const packs=(await fs.readdir(ROOT)).filter(d=>/^\d+$/.test(d)).sort((a,b)=>packNum(a)-packNum(b));
// units live in per-unit folders org/unit/NNN/*.csv ; the stat csv is unitNNN.csv? Let's find unit stat files.
// BCU unit stats are in t_unit.csv too? No. Let's search one pack.
const sample=path.join(ROOT,'000001','org');
async function walk(d){let out=[];for(const e of await fs.readdir(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())out=out.concat(await walk(p));else out.push(p);}return out;}
const files=await walk(sample);
console.log('sample org files w/ "unit" in path (first 30):');
console.log(files.filter(f=>/unit/i.test(f)).slice(0,30).join('\n'));
