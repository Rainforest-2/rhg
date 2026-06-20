#!/usr/bin/env node
// Deterministic check for the in-battle music pipeline + the Zombie Killer SE.
//
// Guards:
//  1. musicmap.json shape (remote BCU music base, local override base, padding).
//  2. MusicCatalog id normalization + local-then-remote URL resolution.
//  3. StageMusicResolver: MSD bundle/stage-index derivation from a layout entry,
//     and music-field parsing against a REAL MapStageData CSV from the bundle.
//  4. Stage->runtime wiring carries musicId/bossMusicId/threshold end to end.
//  5. AudioEngine + BattleSoundEffects expose the playback/SE API and the Zombie
//     Killer sting is fired where zombie killer denies a revive.
//  6. main.js installs the music patch; node --check on every touched module.
//
// Exits nonzero on the first failure.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { MusicCatalog } from '../js/audio/MusicCatalog.js';
import { deriveMsdRef, parseMsdRows, parseStageMusicFromRows, resolveStageMusic } from '../js/audio/StageMusicResolver.js';

const ROOT = new URL('../', import.meta.url);
const failures = [];
function check(cond, message) { if (!cond) failures.push(message); }
async function read(rel) { return readFile(new URL(rel, ROOT), 'utf8'); }

// 1. manifest
const manifest = JSON.parse(await read('public/assets/music/musicmap.json'));
check(/raw\.githubusercontent\.com\/battlecatsultimate\/bcu-assets\/.*\/music\//.test(manifest.remoteBaseUrl), 'musicmap.json: remoteBaseUrl must point at the bcu-assets music dir');
check(typeof manifest.localBaseUrl === 'string' && manifest.localBaseUrl.includes('assets/music'), 'musicmap.json: localBaseUrl must be the local assets/music override dir');
check(manifest.extension === '.ogg' && manifest.pad === 3, 'musicmap.json: expected .ogg / pad=3');

// 2. catalog
const catalog = new MusicCatalog(manifest);
check(catalog.formatId(3) === '003', 'MusicCatalog.formatId(3) should be 003');
check(catalog.normalizeId(999) === null && catalog.normalizeId(-1) === null, 'MusicCatalog must reject out-of-range ids');
const urls = catalog.resolveUrls(3);
check(urls.length === 2 && urls[0].includes('assets/music/003.ogg') && urls[1].includes('raw.githubusercontent.com'), 'MusicCatalog.resolveUrls must be local-then-remote for 003.ogg');
check(catalog.resolveUrls(99999).length === 0, 'MusicCatalog.resolveUrls must be empty for an invalid id');

// 3. resolver against a real MapStageData CSV from the bundle
const layoutEntry = {
  kind: 'stage-definition',
  basename: 'stageRNA001_04',
  bundleRef: { bundleKey: 'stage-map:000001/A/StageRNA', bundlePath: 'public/assets/bundles/stage/map/000001__A__StageRNA.zip', internalPath: 'stageRNA001_04.csv', readMode: 'zip-text' }
};
const ref = deriveMsdRef(layoutEntry);
check(!!ref && ref.stageIndex === 4, 'deriveMsdRef must extract stage index 4');
check(ref?.bundleRef?.bundlePath === 'public/assets/bundles/stage/map/000001__A__MSDNA.zip', 'deriveMsdRef must map StageR bundle -> MSD bundle');
check(ref?.bundleRef?.internalPath === 'MapStageDataNA_001.csv', 'deriveMsdRef must map layout file -> MapStageData file');
check(deriveMsdRef({ kind: 'stage-definition', basename: 'stage00', bundleRef: {} }) === null, 'deriveMsdRef must return null for families with no MSD sibling');

const msdZip = fileURLToPath(new URL(ref.bundleRef.bundlePath, ROOT));
const msdText = execFileSync('unzip', ['-p', msdZip, ref.bundleRef.internalPath], { encoding: 'utf8' });
const rows = parseMsdRows(msdText);
const music = parseStageMusicFromRows(rows, 4, catalog);
check(music && music.startMusicId === 3 && music.bossMusicId === 33 && music.bossHpThresholdPercent === 99,
  `MapStageDataNA_001 stage 4 should be start=3 boss=33 threshold=99, got ${JSON.stringify(music)}`);

const resolved = await resolveStageMusic({ stageEntry: layoutEntry, readMsdText: async () => msdText, catalog });
check(resolved.startMusicId === 3 && resolved.bossMusicId === 33, 'resolveStageMusic must return the parsed ids');
const fallback = await resolveStageMusic({ stageEntry: { kind: 'stage-definition', basename: 'stage00', bundleRef: {} }, readMsdText: async () => msdText, catalog });
check(fallback.source === 'catalog-default', 'resolveStageMusic must fall back to catalog defaults when no MSD');

// 4. stage -> runtime wiring
const loader = await read('js/battle/StageDefinitionLoader.js');
check(loader.includes('enrichMusic') && loader.includes('resolveStageMusic') && loader.includes("from '../audio/MusicCatalog.js'"), 'StageDefinitionLoader must enrich music via the resolver/catalog');
check(/bossMusicId|bossMusicHpThresholdPercent/.test(loader), 'StageDefinitionLoader.enrichMusic must set boss music fields');
const runtime = await read('js/battle/StageRuntime.js');
check(runtime.includes('bossMusicId') && runtime.includes('bossMusicHpThresholdPercent'), 'StageRuntime must carry boss music fields');
const scene = await read('js/battle/BattleScene.js');
check(/musicId:def\?\.musicId/.test(scene) && scene.includes('bossMusicHpThresholdPercent'), 'BattleScene.buildStageRuntime must expose music fields');

// 5. audio engine + SE
const engine = await read('js/audio/AudioEngine.js');
for (const api of ['playBgm', 'stopBgm', 'playSe', 'playSynthSe', 'setPaused', 'loadTrack', 'subscribe']) {
  check(engine.includes(api), `AudioEngine: missing ${api}`);
}
const se = await read('js/audio/BattleSoundEffects.js');
check(se.includes('export function playZombieKillerSe'), 'BattleSoundEffects must export playZombieKillerSe');
const zombie = await read('js/battle/BattleActorZombieRevivePatch.js');
check(zombie.includes("from '../audio/BattleSoundEffects.js'") && zombie.includes('playZombieKillerSe()'), 'Zombie revive patch must play the Zombie Killer SE');
check(/zombieKillerBlocked: true[\s\S]{0,400}playZombieKillerSe\(\)/.test(zombie), 'Zombie Killer SE must fire in the revive-blocked branch');

// 6. patch wiring + node --check
const main = await read('js/main.js');
check(main.includes('PreviewAppBattleMusicPatch.js'), 'main.js must import the battle music patch');
const musicPatch = await read('js/preview/PreviewAppBattleMusicPatch.js');
for (const piece of ['playBgm', 'stopBgm', 'setPaused', 'bossMusicHpThresholdPercent', 'getEnemyBaseHpPercent']) {
  check(musicPatch.includes(piece), `BattleMusicPatch: missing "${piece}"`);
}

const touched = [
  'js/audio/MusicCatalog.js',
  'js/audio/StageMusicResolver.js',
  'js/audio/AudioEngine.js',
  'js/audio/BattleSoundEffects.js',
  'js/preview/PreviewAppBattleMusicPatch.js',
  'js/battle/StageDefinitionLoader.js',
  'js/battle/StageRuntime.js',
  'js/battle/BattleScene.js',
  'js/battle/BattleActorZombieRevivePatch.js',
  'js/main.js'
];
for (const rel of touched) {
  try { execFileSync(process.execPath, ['--check', fileURLToPath(new URL(rel, ROOT))], { stdio: 'pipe' }); }
  catch (error) { check(false, `node --check failed for ${rel}: ${error.stderr?.toString() || error.message}`); }
}

if (failures.length) {
  console.error('check-battle-music-and-zombie-killer: FAIL');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('check-battle-music-and-zombie-killer: OK (music pipeline + stage music + zombie killer SE)');
