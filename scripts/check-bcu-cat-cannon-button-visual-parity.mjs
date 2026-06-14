import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readStoreZipEntries } from './bcu-semantic-utils.mjs';
import { BcuImgCut } from '../js/ui/BcuImgCut.js';

// Visual parity for the BCU bottom-right cat-cannon button + worker/cost BCU fonts + the
// cat-cannon firing animation. Runtime logic (action -2, charge, NYPRE timing) is unchanged.
//
// BCU source ownership:
//   util/Res.java readBattle: aux.battle[1][0]=img002 parts[8], [1]=parts[7],
//     [2+i]=parts[11+i] (10%..100% gauge), [12]=parts[9] (FIRE jp font)
//   androidutil/battle/BattleBox.java drawBtm: aux.battle[1][ctype] + stacked gauge + FIRE
//   util/Res.java getWorkerLv: 働きネコレベル数字 (img001), getCost: 金額数字小 / 金額数字小 MAX
//   util/pack/NyCastle.java read + battle/entity/Cannon.java activate:
//     aux.atks[0] from org/castle/001/nyankoCastle_001_00_*; anim = getEAnim(BASE) (*_01)
//   util/Data.java NYPRE[BASE_H] = 18

const norm = (s) => String(s || '').normalize('NFKC').replace(/\s+/g, '');
const includesAll = (label, needles) => needles.every((n) => norm(label).includes(norm(n)));

const bundle = await readStoreZipEntries('public/assets/bundles/ui/battle-ui.zip');

// 1) Cat-cannon button parts in img002.
const img002 = BcuImgCut.parse(new TextDecoder().decode(bundle.get('img002.imgcut')));
assert.ok(includesAll(img002.getByIndex(8)?.label, ['にゃんこ砲ボタン', 'OFF']), 'img002 part[8] = cannon button OFF (aux.battle[1][0])');
assert.ok(includesAll(img002.getByIndex(7)?.label, ['にゃんこ砲ボタン', '点滅']), 'img002 part[7] = cannon button flash/full (aux.battle[1][1])');
assert.ok(includesAll(img002.getByIndex(9)?.label, ['にゃんこ砲ボタン', 'フォント']), 'img002 part[9] = cannon FIRE font (aux.battle[1][12])');
for (let i = 0; i < 10; i += 1) {
  const part = img002.getByIndex(11 + i);
  assert.ok(part && norm(part.label).includes('にゃんこ砲') && part.w > 0 && part.h > 0, `img002 part[${11 + i}] = cannon gauge ${(i + 1) * 10}% (aux.battle[1][${2 + i}])`);
}

// 2) BCU worker-Lv and cost/MAX font sprites in img001.
const img001 = BcuImgCut.parse(new TextDecoder().decode(bundle.get('img001.imgcut')));
assert.ok(img001.parts.some((p) => includesAll(p.label, ['働きネコレベル数字', 'LEVEL']) && !norm(p.label).includes('暗転')), 'img001 has 働きネコレベル数字 LEVEL label');
for (let d = 0; d < 10; d += 1) assert.ok(img001.parts.some((p) => norm(p.label) === norm(`働きネコレベル数字${d}`)), `img001 has 働きネコレベル数字 ${d}`);
assert.ok(img001.parts.some((p) => includesAll(p.label, ['金額数字小', 'MAX']) && !norm(p.label).includes('暗転')), 'img001 has 金額数字小 MAX (Res.getCost cost==-1)');

// 3) Cat-cannon firing animation asset (BASE eanim) is bundled.
const cannonZip = await readStoreZipEntries('public/assets/bundles/castle/nyanko/001.zip');
for (const f of ['nyankoCastle_001_00_01.mamodel', 'nyankoCastle_001_00_01.maanim', 'nyankoCastle_001_00_00.imgcut', 'nyankoCastle_001_00_00.png']) {
  assert.ok(cannonZip.has(f), `nyankoCastle:001 bundle must contain ${f}`);
}

// 4) BcuSpriteText exposes the BCU worker-Lv and cost/MAX fonts.
const spriteText = readFileSync('js/ui/BcuSpriteText.js', 'utf8');
assert.match(spriteText, /workerLvDigitsOn/, 'BcuSpriteText must map worker-Lv digits');
assert.match(spriteText, /働きネコレベル数字/, 'BcuSpriteText must reference the BCU worker-Lv sprites');
assert.match(spriteText, /drawWorkerLv/, 'BcuSpriteText must draw worker level with BCU sprites');
assert.match(spriteText, /drawCostOrMax/, 'BcuSpriteText must draw cost / MAX with BCU sprites');

// 5) PlayerProductionBar draws the cannon button bitmap + gauge + fire and BCU fonts.
const prodUi = readFileSync('js/ui/PlayerProductionBar.js', 'utf8');
assert.match(prodUi, /CANNON_BUTTON_PART\s*=\s*Object\.freeze\(\{\s*off:\s*8,\s*full:\s*7,\s*fire:\s*9/, 'cannon button frames map to BCU img002 parts 8/7/9');
assert.match(prodUi, /drawCannonButtonIcon/, 'PlayerProductionBar must draw the BCU cannon button icon');
assert.match(prodUi, /drawWorkerLvCentered/, 'wallet button must render the BCU worker-Lv font');
assert.match(prodUi, /drawCostOrMaxCentered/, 'wallet button must render the BCU cost / MAX font');
// Runtime logic must remain untouched.
assert.match(prodUi, /requestCatCannonFire\?\.\(\)/, 'cannon button must still call requestCatCannonFire (action -2)');
assert.match(prodUi, /SBCtrl\.actions action -2 -> StageBasis\.act_can/, 'cannon button must keep BCU action -2 evidence');

// 6) Cat-cannon firing animation wiring + unchanged 18-frame timing.
const cannonPatch = readFileSync('js/battle/BattleSceneBcuCatCannonPatch.js', 'utf8');
assert.match(cannonPatch, /nyankoCastle_001_00_01\.mamodel/, 'cannon patch must load the BCU BASE cannon model');
assert.match(cannonPatch, /spawnCatCannonFireEffect/, 'cannon patch must spawn the firing animation effect');
assert.match(cannonPatch, /new BcuModelInstance/, 'cannon firing effect must use the BCU model-effanim render path');
const cannonRuntime = readFileSync('js/battle/bcu-runtime/BcuCatCannonRuntime.js', 'utf8');
assert.match(cannonRuntime, /BCU_CAT_CANNON_BASIC_PRE_FRAMES\s*=\s*18/, 'press-to-hit delay must stay NYPRE[BASE_H] = 18 frames');
assert.match(cannonRuntime, /spawnCatCannonFireEffect\?\.\(\)/, 'activate must trigger the firing animation on press');

// 7) CSS: cannon button uses the BCU icon and buttons sit flush in the corners.
const css = readFileSync('css/bcu-battle-ui-fix.css', 'utf8');
assert.match(css, /\.cat-cannon-fire\.has-bcu-icon \.cannon-icon/, 'CSS must reveal the cannon BCU icon canvas');
assert.match(css, /\.prod-ui \.wallet-upgrade\{[^}]*left:env\(safe-area-inset-left,0px\)/, 'wallet button must sit flush bottom-left');
assert.match(css, /\.prod-ui \.cat-cannon-fire\{[^}]*right:env\(safe-area-inset-right,0px\)/, 'cannon button must sit flush bottom-right');

console.log('check-bcu-cat-cannon-button-visual-parity: OK');
