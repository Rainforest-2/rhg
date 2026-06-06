import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { BattleWaveEffectLoader } from '../js/battle/BattleWaveEffectLoader.js';
import { BCU_STATUS_EFFECT_SPECS, getStatusEffectKey } from '../js/battle/bcu-runtime/BcuStatusEffectSpec.js';

function zipEntries(path) {
  const result = spawnSync('unzip', ['-Z1', path], { encoding: 'utf8' });
  assert.equal(result.status, 0, `unzip -Z1 ${path} exits 0: ${result.stderr}`);
  return new Set(result.stdout.trim().split(/\n/).filter(Boolean));
}

const waveEntries = zipEntries('public/assets/bundles/effect/wave.zip');
const statusEntries = zipEntries('public/assets/bundles/effect/status-effects.zip');
const kbEntries = zipEntries('public/assets/bundles/effect/kbeff.zip');
const soulEntries = zipEntries('public/assets/bundles/effect/soul.zip');
const loader = new BattleWaveEffectLoader();

for (const def of Object.values(loader.entries)) {
  const base = def.bundleDir;
  const sourceStyle = String(base || '').startsWith('all-skill-effects/');
  const coreFiles = sourceStyle
    ? [def.image, def.imgcut, def.model].map((file) => `${base}/${file}`)
    : [`${base}/image.png`, `${base}/imgcut.imgcut`, `${base}/model.mamodel`];
  for (const required of coreFiles) {
    assert.equal(waveEntries.has(required), true, `effect:wave contains ${required}`);
  }
  if (def.anim) {
    const animPath = sourceStyle ? `${base}/${def.anim}` : `${base}/anim.maanim`;
    assert.equal(waveEntries.has(animPath), true, `effect:wave contains ${animPath}`);
  }
  for (const phase of Object.keys(def.phases || {})) {
    assert.equal(waveEntries.has(`${base}/anim-${phase}.maanim`), true, `effect:wave contains ${base}/anim-${phase}.maanim`);
  }
}

for (const dir of ['warp', 'warp-chara']) {
  assert.equal(waveEntries.has(`${dir}/image.png`), true, `effect:wave contains ${dir}/image.png`);
  assert.equal(waveEntries.has(`${dir}/model.mamodel`), true, `effect:wave contains ${dir}/model.mamodel`);
  assert.equal(waveEntries.has(`${dir}/anim-entrance.maanim`), true, `effect:wave contains ${dir}/anim-entrance.maanim`);
  assert.equal(waveEntries.has(`${dir}/anim-exit.maanim`), true, `effect:wave contains ${dir}/anim-exit.maanim`);
}

for (const dir of ['soul-000', 'soul-003', 'soul-009', 'demon-soul-enemy', 'demon-soul-unit']) {
  for (const file of ['image.png', 'imgcut.imgcut', 'model.mamodel', 'anim.maanim']) {
    assert.equal(soulEntries.has(`${dir}/${file}`), true, `effect:soul contains ${dir}/${file}`);
  }
}

const requiredStatusAliases = [
  'A_UP',
  'A_E_UP',
  'A_DOWN',
  'A_E_DOWN',
  'A_STOP',
  'A_E_STOP',
  'A_SLOW',
  'A_E_SLOW',
  'A_IMUATK',
  'A_SHIELD',
  'A_E_SHIELD',
  'A_CURSE',
  'A_E_CURSE',
  'A_SEAL',
  'A_E_SEAL',
  'A_POISON'
];

for (const dir of requiredStatusAliases) {
  assert.equal(Object.prototype.hasOwnProperty.call(BCU_STATUS_EFFECT_SPECS, dir), true, `BcuStatusEffectSpec declares ${dir}`);
  for (const file of ['image.png', 'imgcut.imgcut', 'model.mamodel', 'DEF.maanim']) {
    assert.equal(statusEntries.has(`${dir}/${file}`), true, `effect:status contains ${dir}/${file}`);
  }
}

assert.equal(getStatusEffectKey('STRONG', { side: 'dog-player' }), 'A_UP', 'status resolver maps unit strengthen to A_UP');
assert.equal(getStatusEffectKey('STRONG', { side: 'cat-enemy' }), 'A_E_UP', 'status resolver maps enemy strengthen to A_E_UP');
assert.equal(getStatusEffectKey('WEAK', { side: 'dog-player' }), 'A_DOWN', 'status resolver maps unit weaken to A_DOWN');
assert.equal(getStatusEffectKey('WEAK', { side: 'cat-enemy' }), 'A_E_DOWN', 'status resolver maps enemy weaken to A_E_DOWN');
assert.equal(getStatusEffectKey('ATTACK_NULLIFY', { side: 'dog-player' }), 'A_IMUATK', 'status resolver maps attack nullify to A_IMUATK');
assert.equal(getStatusEffectKey('POISON', { side: 'cat-enemy' }), 'A_POISON', 'status resolver maps toxic/poison visual to A_POISON');

for (const file of ['image.png', 'imgcut.imgcut', 'model.mamodel', 'critical.maanim', 'critical.mamodel', 'boss_welcome.maanim', 'boss_welcome.mamodel', 'kb_ass.maanim', 'kb_hb.maanim', 'kb_sw.maanim', 'kb.mamodel']) {
  assert.equal(kbEntries.has(file), true, `effect:kbeff contains ${file}`);
}

console.log('check-effect-bundle-aliases: OK');
