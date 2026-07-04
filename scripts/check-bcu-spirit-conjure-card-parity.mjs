import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readStoreZipEntries } from './bcu-semantic-utils.mjs';
import { BcuImgCut } from '../js/ui/BcuImgCut.js';

const norm = (s) => String(s || '').normalize('NFKC').replace(/\s+/g, '');

const bundle = await readStoreZipEntries('public/assets/bundles/ui/battle-ui.zip');
for (const name of ['spiritSummon.png', 'spiritSummon.imgcut']) {
  assert.ok(bundle.has(name), `battle-ui bundle must contain ${name}`);
}

const imgcut = BcuImgCut.parse(new TextDecoder().decode(bundle.get('spiritSummon.imgcut')));
const summonOk = imgcut.getByIndex(53);
assert.ok(summonOk, 'spiritSummon imgcut must define BCU part[53]');
assert.ok(norm(summonOk.label).includes(norm('召喚OK')), `part[53] must be the BCU summon-ready text, got "${summonOk?.label}"`);
assert.ok(summonOk.w > 0 && summonOk.h > 0, 'spirit summon-ready part must have positive dimensions');

const buildScript = readFileSync('scripts/build-bcu-ui-bundle.mjs', 'utf8');
assert.match(buildScript, /spiritSummon\.png/, 'ui bundle build must declare spiritSummon.png');
assert.match(buildScript, /spiritSummon\.imgcut/, 'ui bundle build must declare spiritSummon.imgcut');
assert.match(buildScript, /130100\/org\/page\/img002\.imgcut/, 'spirit summon source must be an explicit semantic bundle source');

const skin = readFileSync('js/ui/ProductionCardSkin.js', 'utf8');
assert.match(skin, /BCU_SPIRIT_SUMMON_PART_INDEX\s*=\s*53/, 'ProductionCardSkin must use BCU aux.spiritSummon part[53]');
assert.match(skin, /drawBcuSpiritConjureCard/, 'ProductionCardSkin must draw the BCU spirit conjure card state');
assert.match(skin, /spiritSummon\.png/, 'ProductionCardSkin must load the summon-ready sheet from ui:battle');
assert.match(skin, /spiritSummon\.imgcut/, 'ProductionCardSkin must load the summon-ready imgcut from ui:battle');
assert.doesNotMatch(skin, /fillText\([^)]*召喚/, 'ProductionCardSkin must not synthesize summon text as a fallback');

const prodUi = readFileSync('js/ui/PlayerProductionBar.js', 'utf8');
assert.match(prodUi, /bcuSpirit:\s*entry\.bcuSpirit/, 'PlayerProductionBar must pass bcuSpirit state to the card skin');
assert.match(prodUi, /bcuSpirit\?\.spiritSummoned/, 'PlayerProductionBar render key must include spirit one-shot state');
assert.match(prodUi, /bcuSpirit\?\.spiritReady/, 'PlayerProductionBar render key must include spirit ready state');

const runtime = readFileSync('js/battle/bcu-runtime/BcuSpiritLifecycleRuntime.js', 'utf8');
assert.match(runtime, /if \(spirits\.length > 0\) st\.spiritSummoned = true;/, 'spiritSummoned must latch true while the summoner remains alive');
assert.doesNotMatch(runtime, /st\.spiritSummoned = spirits\.length > 0;/, 'spiritSummoned must not reset just because the spirit actor disappeared');

console.log('check-bcu-spirit-conjure-card-parity: OK');
