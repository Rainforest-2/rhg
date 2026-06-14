import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readStoreZipEntries } from './bcu-semantic-utils.mjs';
import { BcuImgCut } from '../js/ui/BcuImgCut.js';

// Visual parity for the BCU bottom-left worker-cat / wallet upgrade button.
//
// BCU source ownership (do not change runtime logic, only the icon visual):
//   util/Res.java readBattle: aux.battle[0][0]=img002 parts[5], [1]=parts[24], [2]=parts[6]
//   androidutil/battle/BattleBox.java drawBtm: draws aux.battle[0][mtype]
//     mtype = sb.money < sb.upgradeCost ? 0 : (flash ? 1 : 2); sb.work_lv >= 8 forces 2
//
// img002 parts must keep this index->label mapping for the frame selection to be correct.
const WORKER_BUTTON_LABELS = Object.freeze({
  5: ['働きネコボタン', 'OFF'],   // aux.battle[0][0] unaffordable
  24: ['働きネコボタン', '点滅'],  // aux.battle[0][1] affordable flash
  6: ['働きネコボタン', 'ON']     // aux.battle[0][2] affordable steady / Lv8 max
});

function normalize(label) {
  return String(label || '').normalize('NFKC').replace(/\s+/g, '');
}

// 1) The sanctioned ui:battle bundle must carry img002 sheet + imgcut.
const bundle = await readStoreZipEntries('public/assets/bundles/ui/battle-ui.zip');
for (const name of ['img002.png', 'img002.imgcut']) {
  assert.ok(bundle.has(name), `battle-ui bundle must contain ${name}`);
}

// 2) The bundle build source must declare img002 (no raw public/assets/bcu runtime fallback).
const buildScript = readFileSync('scripts/build-bcu-ui-bundle.mjs', 'utf8');
assert.match(buildScript, /img002\.png/, 'bundle build must source img002.png');
assert.match(buildScript, /img002\.imgcut/, 'bundle build must source img002.imgcut');

// 3) The imgcut indices used by the runtime must map to the BCU worker-cat button parts.
const imgcut = BcuImgCut.parse(new TextDecoder().decode(bundle.get('img002.imgcut')));
for (const [index, needles] of Object.entries(WORKER_BUTTON_LABELS)) {
  const part = imgcut.getByIndex(Number(index));
  assert.ok(part, `img002 imgcut must define part[${index}]`);
  const norm = normalize(part.label);
  for (const needle of needles) {
    assert.ok(norm.includes(normalize(needle)), `img002 part[${index}] label "${part.label}" must contain "${needle}" (BCU aux.battle[0])`);
  }
  assert.ok(Number.isFinite(part.w) && part.w > 0 && Number.isFinite(part.h) && part.h > 0, `img002 part[${index}] must have positive dimensions`);
}

// 4) PlayerProductionBar must draw the BCU button from the bundle without breaking action -1.
const prodUi = readFileSync('js/ui/PlayerProductionBar.js', 'utf8');
assert.match(prodUi, /img002\.png/, 'PlayerProductionBar must load img002.png from the ui:battle bundle');
assert.match(prodUi, /img002\.imgcut/, 'PlayerProductionBar must load img002.imgcut from the ui:battle bundle');
assert.match(prodUi, /WORKER_BUTTON_PART\s*=\s*Object\.freeze\(\{\s*off:\s*5,\s*flash:\s*24,\s*on:\s*6/, 'PlayerProductionBar must map worker-button frames to BCU parts 5/24/6');
assert.match(prodUi, /drawWorkerButtonIcon/, 'PlayerProductionBar must draw the BCU worker button icon');
assert.match(prodUi, /createObjectUrl\(BCU_BATTLE_UI_BUNDLE_REF/, 'worker button image must come through the semantic bundle provider');
// Runtime logic must remain untouched.
assert.match(prodUi, /upgradeWallet\?\.\(\)/, 'wallet button must still call economy.upgradeWallet (action -1)');
assert.match(prodUi, /SBCtrl\.actions action -1 -> StageBasis\.act_mon/, 'wallet button must keep BCU action -1 evidence');

// 5) CSS must expose the BCU icon and keep the bottom-left anchor.
const css = readFileSync('css/bcu-battle-ui-fix.css', 'utf8');
assert.match(css, /\.prod-ui \.wallet-upgrade/, 'wallet button must remain positioned in battle UI CSS');
assert.match(css, /bottom:calc\(6px \+ env\(safe-area-inset-bottom,0px\)\)/, 'wallet button keeps BCU bottom-left anchor');
assert.match(css, /\.wallet-upgrade\.has-bcu-icon \.wallet-icon/, 'CSS must reveal the BCU icon canvas when loaded');

console.log('check-bcu-wallet-button-icon-parity: OK');
