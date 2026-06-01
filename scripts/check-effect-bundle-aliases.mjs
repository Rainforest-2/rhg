import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { BattleWaveEffectLoader } from '../js/battle/BattleWaveEffectLoader.js';

function zipEntries(path) {
  const result = spawnSync('unzip', ['-Z1', path], { encoding: 'utf8' });
  assert.equal(result.status, 0, `unzip -Z1 ${path} exits 0: ${result.stderr}`);
  return new Set(result.stdout.trim().split(/\n/).filter(Boolean));
}

const waveEntries = zipEntries('public/assets/bundles/effect/wave.zip');
const statusEntries = zipEntries('public/assets/bundles/effect/status-effects.zip');
const kbEntries = zipEntries('public/assets/bundles/effect/kbeff.zip');
const loader = new BattleWaveEffectLoader();

for (const def of Object.values(loader.entries)) {
  const base = def.bundleDir;
  for (const required of [`${base}/image.png`, `${base}/imgcut.imgcut`, `${base}/model.mamodel`]) {
    assert.equal(waveEntries.has(required), true, `effect:wave contains ${required}`);
  }
  if (def.anim) assert.equal(waveEntries.has(`${base}/anim.maanim`), true, `effect:wave contains ${base}/anim.maanim`);
  for (const phase of Object.keys(def.phases || {})) {
    assert.equal(waveEntries.has(`${base}/anim-${phase}.maanim`), true, `effect:wave contains ${base}/anim-${phase}.maanim`);
  }
}

for (const dir of ['A_STOP', 'A_E_STOP', 'A_SLOW', 'A_E_SLOW', 'A_DOWN', 'A_E_DOWN', 'A_POISON']) {
  for (const file of ['image.png', 'imgcut.imgcut', 'model.mamodel', 'DEF.maanim']) {
    assert.equal(statusEntries.has(`${dir}/${file}`), true, `effect:status contains ${dir}/${file}`);
  }
}

for (const file of ['image.png', 'imgcut.imgcut', 'model.mamodel', 'critical.maanim', 'boss_welcome.maanim']) {
  assert.equal(kbEntries.has(file), true, `effect:kbeff contains ${file}`);
}

console.log('check-effect-bundle-aliases: OK');
