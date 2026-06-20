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
import {
  BATTLE_HOT_SE_IDS,
  BATTLE_PRELOAD_SE_IDS,
  BCU_ALL_SOUND_IDS,
  BCU_CANNON_SE,
  BCU_SE,
  BCU_SOUND_ID_MAX,
  BCU_SOUND_ID_MIN,
  isBcuSoundId,
  normalizeBcuSoundId
} from '../js/audio/BattleSoundEffects.js';

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
check(manifest.minId === BCU_SOUND_ID_MIN && manifest.maxId === BCU_SOUND_ID_MAX,
  `musicmap.json: expected full BCU sound id range ${BCU_SOUND_ID_MIN}..${BCU_SOUND_ID_MAX}`);

// 2. catalog
const catalog = new MusicCatalog(manifest);
check(catalog.formatId(3) === '003', 'MusicCatalog.formatId(3) should be 003');
check(catalog.normalizeId(0) === 0 && catalog.normalizeId(190) === 190, 'MusicCatalog must accept the full vendored BCU sound range endpoints');
check(catalog.normalizeId(999) === null && catalog.normalizeId(-1) === null && catalog.normalizeId(191) === null, 'MusicCatalog must reject out-of-range ids');
const urls = catalog.resolveUrls(3);
check(urls.length === 1 && urls[0].includes('public/assets/music/003.m4a'),
  `MusicCatalog.resolveUrls must be the single public/assets 003.m4a candidate, got ${JSON.stringify(urls)}`);
const url190 = catalog.resolveUrls(190);
check(url190.length === 1 && url190[0].includes('public/assets/music/190.m4a'),
  `MusicCatalog.resolveUrls must include the final vendored BCU sound 190.m4a, got ${JSON.stringify(url190)}`);
check(catalog.resolveUrls(99999).length === 0, 'MusicCatalog.resolveUrls must be empty for an invalid id');
const catalogSource = await read('js/audio/MusicCatalog.js');
check(catalogSource.includes("cache: 'no-cache'"), 'MusicCatalog must revalidate musicmap.json instead of force-caching stale manifests');

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

const iriomoteEntry = {
  kind: 'stage-definition',
  basename: 'stage47',
  bundleRef: { bundleKey: 'stage-map:000001/CH/stage', bundlePath: 'public/assets/bundles/stage/map/000001__CH__stage.zip', internalPath: 'stage47.csv', readMode: 'zip-text' }
};
const iriomoteRef = deriveMsdRef(iriomoteEntry);
check(iriomoteRef?.stageIndex === 47, 'deriveMsdRef must map CH/stage/stage47 to row 47');
check(iriomoteRef?.bundleRef?.bundlePath === 'public/assets/bundles/stage/map/000001__CH__stageNormal.zip',
  'deriveMsdRef must map CH/stage to sibling CH/stageNormal music data');
check(iriomoteRef?.bundleRef?.internalPath === 'stageNormal0.csv',
  'deriveMsdRef must use stageNormal0.csv for EoC chapter-1 stage music');
const iriomoteZip = fileURLToPath(new URL(iriomoteRef.bundleRef.bundlePath, ROOT));
const iriomoteText = execFileSync('unzip', ['-p', iriomoteZip, iriomoteRef.bundleRef.internalPath], { encoding: 'utf8' });
const iriomoteMusic = parseStageMusicFromRows(parseMsdRows(iriomoteText), 47, catalog);
check(iriomoteMusic && iriomoteMusic.startMusicId === 4 && iriomoteMusic.bossMusicId === 4 && iriomoteMusic.bossHpThresholdPercent === 0,
  `EoC 西表島 stage47 should resolve BCU BGM id 4 from stageNormal0 row 47, got ${JSON.stringify(iriomoteMusic)}`);
const iriomoteResolved = await resolveStageMusic({ stageEntry: iriomoteEntry, readMsdText: async () => iriomoteText, catalog });
check(iriomoteResolved.startMusicId === 4 && iriomoteResolved.source === 'MapStageData',
  `resolveStageMusic must not fall back to 000.m4a for EoC 西表島, got ${JSON.stringify(iriomoteResolved)}`);

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
// AudioEngine is HTMLAudio-only (no Web Audio decode, no Cache-API persistence): BGM
// streams one-way through a reusable looping element and SE play through a pooled set
// of elements, all unlocked once inside a user gesture for the iOS autoplay policy.
for (const piece of ['new Audio(', '_playBgmElement', '_sePool', '_unlock', 'SILENT_WAV_DATA_URI', 'loop', '.play(', '.pause(']) {
  check(engine.includes(piece), `AudioEngine (html-audio): missing ${piece}`);
}
for (const banned of ['AudioContext', 'decodeAudioData', 'createBufferSource', 'caches.open', "cache: 'no-cache'"]) {
  check(!engine.includes(banned), `AudioEngine must not reintroduce Web Audio / Cache-API persistence (${banned})`);
}
const se = await read('js/audio/BattleSoundEffects.js');
for (const piece of ['BCU_SE', 'BCU_ALL_SOUND_IDS', 'BATTLE_PRELOAD_SE_IDS', 'BATTLE_HOT_SE_IDS', 'normalizeBcuSoundId', 'playBcuSe', 'playZombieKillerSe', 'BCU_CANNON_SE']) {
  check(se.includes(piece), `BattleSoundEffects must expose ${piece}`);
}
check(BCU_SE.ZOMBIE_KILLER === 59 && BCU_SE.SPEND_FAIL === 15 && BCU_SE.SPEND_SUCCESS === 19 && BCU_SE.HIT_BASE === 22,
  'BattleSoundEffects: key BCU SE ids must match CommonStatic.java');
check(BCU_CANNON_SE.BASIC[0] === 25 && BCU_CANNON_SE.BASIC[1] === 26 && BCU_CANNON_SE.CURSE[0] === 124,
  'BattleSoundEffects: BCU SE_CANNON ids must match util/Data.java');
check(BCU_ALL_SOUND_IDS.length === 191 && BCU_ALL_SOUND_IDS[0] === 0 && BCU_ALL_SOUND_IDS.at(-1) === 190,
  'BattleSoundEffects: BCU_ALL_SOUND_IDS must cover every vendored BCU sound id 0..190');
check(BATTLE_PRELOAD_SE_IDS.length === BCU_ALL_SOUND_IDS.length && BATTLE_PRELOAD_SE_IDS.every((id, i) => id === BCU_ALL_SOUND_IDS[i]),
  'BattleSoundEffects: BATTLE_PRELOAD_SE_IDS must expose the full lazy BCU sound catalog');
check(BATTLE_HOT_SE_IDS.length < BATTLE_PRELOAD_SE_IDS.length && BATTLE_HOT_SE_IDS.every((id) => BATTLE_PRELOAD_SE_IDS.includes(id)),
  'BattleSoundEffects: BATTLE_HOT_SE_IDS must remain a small subset of the full catalog');
check(normalizeBcuSoundId('190') === 190 && normalizeBcuSoundId('') === null && normalizeBcuSoundId(null) === null && normalizeBcuSoundId(false) === null && normalizeBcuSoundId(191) === null && isBcuSoundId(0) && !isBcuSoundId(191),
  'BattleSoundEffects: raw BCU sound id normalization must match the vendored catalog range');
for (const id of BATTLE_PRELOAD_SE_IDS) {
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
for (const piece of ['pushEventWithBattleSound', 'playerSpawned', 'playerSpawnRejected', 'damageQueued', 'procResolved', 'baseDamageQueued', 'battleResult', 'bcuCatCannonActivated', 'cannonIdsForEvent', 'collectBcuSoundIds', 'playExplicitBcuSe', 'bcuSetSe', 'bcuSound', 'bcuSeIds']) {
  check(eventPatch.includes(piece), `BattleSoundEventPatch: missing ${piece}`);
}
check(!/case 'stageEnemySpawned':[\s\S]{0,120}playDeploySe/.test(eventPatch), 'BattleSoundEventPatch must not play player deploy SE for enemy spawns');
check(eventPatch.includes('BCU_CANNON_SE.WALL') && eventPatch.includes('BCU_CANNON_SE.BARRIER') && eventPatch.includes('BCU_CANNON_SE.CURSE'), 'BattleSoundEventPatch must map cannon ids to BCU_CANNON_SE entries');
check(eventPatch.includes('includeGenericArrays') && eventPatch.includes('oncePerFrame(scene, `se-${id}`)'),
  'BattleSoundEventPatch must support raw BCU setSE ids with per-frame dedupe');
check(eventPatch.includes('playCannonActivationSe') && eventPatch.includes('playCannonSecondarySe') && eventPatch.includes('bcuWalletUpgraded'),
  'BattleSoundEventPatch must split BCU cannon press/secondary SE and wallet upgrade SE');
for (const piece of ['BCU_SE.CRIT', 'BCU_SE.SATK', 'BCU_SE.WAVE', 'BCU_SE.POISON', 'BCU_SE.VOLC_START', 'BCU_SE.VOLC_LOOP', 'BCU_SE.BARRIER_ATK', 'BCU_SE.SHIELD_BREAKER', 'BCU_SE.WARP_ENTER', 'BCU_SE.DEATH_SURGE']) {
  check(eventPatch.includes(piece), `BattleSoundEventPatch must cover ${piece}`);
}
const { playForEvent } = await import('../js/audio/BattleSoundEventPatch.js');
let soundTestFrame = 1000;
function playedFor(event, sceneExtra = {}) {
  const played = [];
  const fakeEngine = { playSe(id) { played.push(id); return true; } };
  soundTestFrame += 1;
  playForEvent({ logicFrame: soundTestFrame, timeMs: soundTestFrame * 33, bcuCatCannon: { id: 0 }, ...sceneExtra }, event, fakeEngine);
  return played;
}
check(JSON.stringify(playedFor({ type: 'bcuCatCannonActivated', cannonId: 0 })) === JSON.stringify([19, 25]),
  'BCU basic cannon press must play SE_SPEND_SUC then SE_CANNON[0][0], not wave SE');
check(JSON.stringify(playedFor({ type: 'bcuCatCannonBasicAttack', cannonId: 0 })) === JSON.stringify([26]),
  'BCU basic cannon wave container must play SE_CANNON[0][1]');
check(JSON.stringify(playedFor({ type: 'bcuNonBasicCatCannonAttack', cannonId: 3 })) === JSON.stringify([37]),
  'BCU freeze cannon secondary attack must play SE_CANNON[3][1]');
check(JSON.stringify(playedFor({ type: 'bcuWalletUpgraded' })) === JSON.stringify([19]),
  'BCU wallet upgrade success must play SE_SPEND_SUC');
check(JSON.stringify(playedFor({ type: 'bcuWalletUpgradeRejected' })) === JSON.stringify([15]),
  'BCU wallet upgrade failure must play SE_SPEND_FAIL');
check(JSON.stringify(playedFor({ type: 'bcuSetSe', bcuSeIds: [190, 190, 26] })) === JSON.stringify([190, 26]),
  'generic BCU setSE events must accept raw ids and dedupe duplicates in one event');
const waveRuntime = await read('js/battle/BattleWaveRuntimePatch.js');
check(waveRuntime.includes('bcuWaveSe') && waveRuntime.includes('SE_WAVE'), 'BattleWaveRuntimePatch must emit SE_WAVE at ContWaveDef t==0');
const surgeRuntime = await read('js/battle/BattleSurgeRuntimePatch.js');
check(surgeRuntime.includes('bcuSurgeSe') && surgeRuntime.includes('SE_VOLC_START') && surgeRuntime.includes('SE_VOLC_LOOP'), 'BattleSurgeRuntimePatch must emit volcano SE at runtime phase changes');

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
  'js/battle/BattleWaveRuntimePatch.js',
  'js/battle/BattleSurgeRuntimePatch.js',
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
