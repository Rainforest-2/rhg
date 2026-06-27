#!/usr/bin/env node
// Deterministic check: 日本編/EoC (CH/stage/stageNN.csv) must split into its 3 real BCU chapters.
//
// Facts (verified against public/assets/bcu/.../Map_option.csv + lang/jp-StageName.txt):
//   - Map_option 3000/3001/3002 = 日本編第1章/第2章/第3章 (mapColc 3, mapId 0/1/2).
//   - jp-StageName 003-<chapter>-<stageNo>: every chapter replays the SAME 48 stages
//     (stageNo 0-46 = 長崎県…沖縄県 prefectures, stageNo 47 = 西表島). The prefecture stage CSVs are
//     shared, so each is fanned out into all 3 chapters.
//   - The chapter 西表島 finale uses a per-chapter CSV: stage47->ch1, stage49->ch2, stage50->ch3,
//     each landing at stageNo 47.
//   - stage48 (チャレンジバトル) / stage51 (ケリ姫降臨！) / stage52 are NOT chapter stages; they stay
//     on the legacy aggregate map (日本編 その他) so nothing is dropped.
import { buildBcuStageCatalog } from '../js/ui/BcuStageCatalogBuilder.js';

let failed = 0;
const check = (name, cond, detail) => {
  if (cond) { console.log(`PASS ${name}`); return; }
  failed += 1;
  console.error(`FAIL ${name}${detail ? ` :: ${detail}` : ''}`);
};

const mk = (n) => ({
  stageKey: `stage:000001:CH/stage/stage${n}`,
  stageId: `stage${n}`,
  key: `stage:000001:CH/stage/stage${n}`,
  packId: '000001',
  category: 'CH',
  groupDir: 'stage',
  basename: `stage${n}`,
  semanticEntry: { category: 'CH', groupDir: 'stage', packId: '000001', basename: `stage${n}` }
});
const stages = [];
for (let i = 0; i <= 52; i += 1) stages.push(mk(String(i).padStart(2, '0')));

const catalog = buildBcuStageCatalog(stages, { bcuDb: null });
const main = catalog.getCategory('main');
const byLabel = new Map((main?.maps || []).map((m) => [m.label, m]));

const expectedPrefectureRun = Array.from({ length: 48 }, (_, i) => i); // 0..47 (長崎県…西表島)
for (const label of ['日本編 第1章', '日本編 第2章', '日本編 第3章']) {
  const map = byLabel.get(label);
  const stageNos = (map?.stages || []).map((s) => s.stageNo);
  check(`${label} exists`, !!map);
  check(`${label} has 48 stages (長崎県…西表島)`, map?.stageCount === 48, `got ${map?.stageCount}`);
  check(`${label} stageNo run is 0..47`, JSON.stringify(stageNos) === JSON.stringify(expectedPrefectureRun), JSON.stringify(stageNos));
}

// Chapter finale provenance: ch1<-stage47, ch2<-stage49, ch3<-stage50, each at stageNo 47.
const finaleOf = (label) => (byLabel.get(label)?.stages || []).find((s) => s.stageNo === 47);
check('第1章 finale (stageNo47) comes from stage47.csv', /stage47$/.test(finaleOf('日本編 第1章')?.rawId || ''), finaleOf('日本編 第1章')?.rawId);
check('第2章 finale (stageNo47) comes from stage49.csv', /stage49$/.test(finaleOf('日本編 第2章')?.rawId || ''), finaleOf('日本編 第2章')?.rawId);
check('第3章 finale (stageNo47) comes from stage50.csv', /stage50$/.test(finaleOf('日本編 第3章')?.rawId || ''), finaleOf('日本編 第3章')?.rawId);

// Extras (チャレンジ/ケリ姫/stage52) are kept off the chapters, on the leftover map.
const leftover = byLabel.get('日本編 その他');
const leftoverNos = (leftover?.stages || []).map((s) => s.stageNo).sort((a, b) => a - b);
check('日本編 その他 holds exactly stage48/51/52', JSON.stringify(leftoverNos) === JSON.stringify([48, 51, 52]), JSON.stringify(leftoverNos));
check('no synthetic single "日本編" aggregate map remains', !byLabel.has('日本編'), JSON.stringify([...byLabel.keys()]));

if (failed) {
  console.error(`check-bcu-eoc-chapter-split: FAILED (${failed})`);
  process.exit(1);
}
console.log('check-bcu-eoc-chapter-split: OK');
