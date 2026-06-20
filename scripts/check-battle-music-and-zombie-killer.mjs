#!/usr/bin/env node
// Deterministic check for the in-battle music pipeline + the Zombie Killer SE.
//
// Guards:
//  1. musicmap.json shape (remote BCU music base, local override base, padding).
//  2. MusicCatalog id normalization + local-then-remote URL resolution.
//  3. StageMusicResolver: MSD bundle/stage-index derivation from a layout entry,
//     and music-field parsing against a REAL MapStageData CSV from the bundle.
//  4. Stage->runtime wiring carries musicId/bossMusicId/threshold end to end.
//  5. AudioEngine persists battle audio through Cache API and preloads selected
//     stage BGM + common BCU SE ids during the sortie loading path.
//  6. AudioEngine + BattleSoundEffects expose real BCU SE ids and event playback,
//     and the Zombie Killer SE is fired where zombie killer denies a revive.
//  7. main.js installs the music patch; node --check on every touched module.
//
// Exits nonzero on the first failure.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { MusicCatalog } from '../js/audio/MusicCatalog.js';
import { deriveMsdRef, parseMsdRows, parseStageMusicFromRows, resolveStageMusic } from '../js/audio/StageMusicResolver.js';
import { BATTLE_PRELOAD_SE_IDS, BCU_SE } from '../js/audio/BattleSoundEffects.js';

const ROOT = new URL('../', import.meta.url);
const failures = [];
function check(cond, message) { if (!cond) failures.push(message); }
async function read(rel) { return readFile(new URL(rel, ROOT), 'utf8'); }

// 1. manifest
const manifest = JSON.parse(await read('public/assets/music/musicmap.json'));
// The tracks are vendored locally (no network fetch), so the remote bases are
// intentionally empty; only the local override dir is required.
check(manifest.cdnBaseUrl === '' && manifest.remoteBaseUrl === '', 'musicmap.json: cdn/remote bases must be empty (tracks are bundled locally)');
check(typeof manifest.localBaseUrl === 'string' && manifest.localBaseUrl.includes('assets/music'), 'musicmap.json: localBaseUrl must be the local assets/music override dir');
// iOS/Safari can't decode Ogg Vorbis, so the BGM is bundled as .m4a (AAC).
check(manifest.extension === '.m4a' && manifest.pad === 3, 'musicmap.json: expected .m4a / pad=3');

// 2. catalog
const catalog = new MusicCatalog(manifest);
check(catalog.formatId(3) === '003', 'MusicCatalog.formatId(3) should be 003');
check(catalog.normalizeId(999) === null && catalog.normalizeId(-1) === null, 'MusicCatalog must reject out-of-range ids');
const urls = catalog.resolveUrls(3);
check(urls.length === 1 && urls[0].includes('assets/music/003.m4a'),
  `MusicCatalog.resolveUrls must be the single local 003.m4a (remote bases empty), got ${JSON.stringify(urls)}`);
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
for (const api of ['playBgm', 'stopBgm', 'playSe', 'playSynthSe', 'setPaused', 'loadTrack', 'prepareTracks', 'prepareBattleMusic', 'subscribe']) {
  check(engine.includes(api), `AudioEngine: missing ${api}`);
}
for (const piece of ['AUDIO_CACHE_NAME', 'caches.open', 'cache.match', 'await cache.put', 'persistent-cache']) {
  check(engine.includes(piece), `AudioEngine: missing persistent-cache piece ${piece}`);
}
const se = await read('js/audio/BattleSoundEffects.js');
for (const piece of ['BCU_SE', 'BATTLE_PRELOAD_SE_IDS', 'playBcuSe', 'playZombieKillerSe', 'BCU_CANNON_SE']) {
  check(se.includes(piece), `BattleSoundEffects must expose ${piece}`);
}
check(BCU_SE.ZOMBIE_KILLER === 59 && BCU_SE.SPEND_FAIL === 15 && BCU_SE.SPEND_SUCCESS === 19 && BCU_SE.HIT_BASE === 22,
  'BattleSoundEffects: key BCU SE ids must match CommonStatic.java');
for (const id of [BCU_SE.ZOMBIE_KILLER, BCU_SE.SPEND_FAIL, BCU_SE.SPEND_SUCCESS, BCU_SE.HIT_0, BCU_SE.HIT_BASE, BCU_SE.VICTORY, BCU_SE.DEFEAT, ...BATTLE_PRELOAD_SE_IDS]) {
  const file = new URL(`public/assets/music/${String(id).padStart(3, '0')}.m4a`, ROOT);
  try { await readFile(file); }
  catch { check(false, `missing vendored SE/BGM file for id ${id}: ${file.pathname}`); }
}
const zombie = await read('js/battle/BattleActorZombieRevivePatch.js');
check(zombie.includes("from '../audio/BattleSoundEffects.js'") && zombie.includes('playZombieKillerSe()'), 'Zombie revive patch must play the Zombie Killer SE');
check(/zombieKillerBlocked: true[\s\S]{0,400}playZombieKillerSe\(\)/.test(zombie), 'Zombie Killer SE must fire in the revive-blocked branch');

const previewApp = await read('js/preview/PreviewApp.js');
check(previewApp.includes('BATTLE_PRELOAD_SE_IDS') && previewApp.includes('prepareTracks') && previewApp.includes('battleAudioPreloaded'),
  'PreviewApp must preload/cache selected battle BGM and common SE during battle start');
const eventPatch = await read('js/audio/BattleSoundEventPatch.js');
for (const piece of ['pushEventWithBattleSound', 'playerSpawned', 'playerSpawnRejected', 'damageQueued', 'baseDamageQueued', 'battleResult', 'bcuCatCannonActivated', 'cannonIdsForEvent']) {
  check(eventPatch.includes(piece), `BattleSoundEventPatch: missing ${piece}`);
}
check(!/case 'stageEnemySpawned':[\s\S]{0,120}playDeploySe/.test(eventPatch), 'BattleSoundEventPatch must not play player deploy SE for enemy spawns');
check(eventPatch.includes('BCU_CANNON_SE.WALL') && eventPatch.includes('BCU_CANNON_SE.BARRIER'), 'BattleSoundEventPatch must map cannon ids to BCU_CANNON_SE entries');

// 6. patch wiring + node --check
const main = await read('js/main.js');
check(main.includes('PreviewAppBattleMusicPatch.js'), 'main.js must import the battle music patch');
check(main.includes('BattleSoundEventPatch.js'), 'main.js must import the battle sound event patch');
const musicPatch = await read('js/preview/PreviewAppBattleMusicPatch.js');
for (const piece of ['playBgm', 'stopBgm', 'setPaused', 'bossMusicHpThresholdPercent', 'getEnemyBaseHpPercent']) {
  check(musicPatch.includes(piece), `BattleMusicPatch: missing "${piece}"`);
}

const touched = [
  'js/audio/MusicCatalog.js',
  'js/audio/StageMusicResolver.js',
  'js/audio/AudioEngine.js',
  'js/audio/BattleSoundEffects.js',
  'js/audio/BattleSoundEventPatch.js',
  'js/preview/PreviewAppBattleMusicPatch.js',
  'js/preview/PreviewApp.js',
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
