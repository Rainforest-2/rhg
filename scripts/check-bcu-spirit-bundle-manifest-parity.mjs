import assert from 'node:assert/strict';
import { BcuBootLoader } from '../js/bcu/BcuBootLoader.js';
import { BattleActorFactory, TEMPLATE_LOAD_LEVEL } from '../js/battle/BattleActorFactory.js';
import { BattleStatsLoader } from '../js/battle/BattleStatsLoader.js';
import { parseAnim } from '../js/bcu/BcuAnimParser.js';
import { parseImgcut } from '../js/bcu/BcuImgcutParser.js';
import { parseModel } from '../js/bcu/BcuModelParser.js';
import { readJson, readStoreZipEntries, validatePngBuffer } from './bcu-semantic-utils.mjs';
import { resolveBcuSpiritUnitDef } from '../js/battle/bcu-runtime/BcuSpiritLifecycleRuntime.js';

const EXPECTED_SPIRIT_IDS = Object.freeze([729, 732, 734, 739, 755, 761, 764, 770, 775, 782, 800, 802, 812, 816, 818, 821, 825, 838, 839, 855, 860]);
const REQUIRED_SPIRIT_BUNDLE_ENTRIES = Object.freeze(['bundle.json', 'image.png', 'imgcut.imgcut', 'model.mamodel', 'attack.maanim']);

function installImageStub() {
  if (globalThis.Image) return;
  globalThis.Image = class BcuNodeTestImage {
    constructor() {
      this.width = 256;
      this.height = 256;
      this.naturalWidth = 256;
      this.naturalHeight = 256;
    }
    set src(value) {
      this._src = value;
      queueMicrotask(() => this.onload?.());
    }
    get src() { return this._src; }
    async decode() {}
  };
}

function spiritIdsFromDb(db) {
  const ids = new Set();
  for (const unit of db.units.list()) {
    for (const form of unit.forms || []) {
      const spirit = form?.stats?.bcuCombatModel?.proc?.spirit;
      const id = Number(spirit?.id);
      if (spirit?.exists === true && Number.isFinite(id) && id >= 0) ids.add(Math.trunc(id));
    }
  }
  return [...ids].sort((a, b) => a - b);
}

function text(buf) {
  return new TextDecoder().decode(buf);
}

const actorIndex = await readJson('public/assets/generated/bcu-actor-index.json', { byKey: {}, entries: [] });
const manifest = await readJson('public/assets/generated/bcu-bundle-manifest.json', { bundles: {} });
const db = await BcuBootLoader.loadGame();
const provider = db.semanticProvider;
const spiritIds = spiritIdsFromDb(db);

assert.deepEqual(spiritIds, EXPECTED_SPIRIT_IDS, 'derived spirit ids must come from DataUnit.ints[110] combat models');

for (const id of spiritIds) {
  const semanticKey = `unit:${id}:f`;
  const actorEntry = actorIndex.byKey?.[semanticKey] || provider.getActorEntry(semanticKey);
  assert.ok(actorEntry, `${semanticKey} exists in actor index`);
  assert.equal(actorEntry.status, 'partial', `${semanticKey} is an attack-only partial actor form`);
  assert.ok(actorEntry.bundleRef?.bundleKey, `${semanticKey} has a bundle key`);
  assert.ok(manifest.bundles?.[actorEntry.bundleRef.bundleKey], `${semanticKey} bundle is registered in bcu-bundle-manifest`);
  assert.equal(provider.hasBundleForKey(semanticKey), true, `${semanticKey} is runtime-usable through SemanticAssetProvider`);

  const zip = await readStoreZipEntries(actorEntry.bundleRef.bundlePath);
  for (const name of REQUIRED_SPIRIT_BUNDLE_ENTRIES) assert.ok(zip.has(name), `${semanticKey} ZIP contains ${name}`);
  for (const absent of ['move.maanim', 'idle.maanim', 'kb.maanim']) assert.equal(zip.has(absent), false, `${semanticKey} stays attack-only and does not invent ${absent}`);

  const png = validatePngBuffer(zip.get('image.png'), { allowTrailingBytes: true });
  assert.equal(png.valid, true, `${semanticKey} image.png is a valid PNG: ${png.reason || 'ok'}`);
  assert.doesNotThrow(() => parseImgcut(text(zip.get('imgcut.imgcut'))), `${semanticKey} imgcut parses`);
  assert.doesNotThrow(() => parseModel(text(zip.get('model.mamodel'))), `${semanticKey} model parses`);
  assert.doesNotThrow(() => parseAnim(text(zip.get('attack.maanim'))), `${semanticKey} attack animation parses`);

  const assetDef = db.assets.resolveUnitAsset(id, 'f');
  assert.equal(assetDef?.semanticKey, semanticKey, `${semanticKey} resolves from core DB assets`);
  assert.equal(assetDef?.semanticStatus, 'partial', `${semanticKey} preserves partial semantic status`);
  assert.ok(assetDef.animations?.some((anim) => anim.id === 'anim02'), `${semanticKey} exposes anim02 attack definition`);
}

installImageStub();
const statsLoader = new BattleStatsLoader({ bcuDb: db });
const factory = new BattleActorFactory(statsLoader);
const summonerStats = db.units.getFormStats(728, 'f');
const spiritUnitDef = resolveBcuSpiritUnitDef({
  bcuDb: db,
  bases: [
    { side: 'cat-enemy', posBcu: 800, getBattlePosBcu() { return this.posBcu; } },
    { side: 'dog-player', posBcu: 3200, getBattlePosBcu() { return this.posBcu; } }
  ]
}, 'spirit-conj-728', {
  slotId: 'spirit-conj-728',
  side: 'dog-player',
  direction: -1,
  facing: -1,
  renderFlipX: false,
  scale: 1,
  stats: summonerStats
});

assert.equal(spiritUnitDef.statsId, 729, 'conjurer 728 resolves spirit form 729');
assert.equal(spiritUnitDef.moveAnimId, 'anim02', 'attack-only spirit uses attack animation as move bootstrap');
assert.equal(spiritUnitDef.idleAnimId, 'anim02', 'attack-only spirit uses attack animation as idle bootstrap');
assert.equal(spiritUnitDef.attackAnimId, 'anim02', 'attack-only spirit attacks with anim02');
assert.equal(spiritUnitDef.knockbackAnimId, 'anim02', 'attack-only spirit has no invented kb animation');

const tpl = await factory.preloadTemplate(spiritUnitDef, { level: TEMPLATE_LOAD_LEVEL.SPAWN_READY });
assert.equal(tpl.loadingLevel, TEMPLATE_LOAD_LEVEL.SPAWN_READY, 'spirit template reaches spawn-ready through semantic ZIPs');
assert.equal(tpl.loadedAnimations.has('anim02'), true, 'spirit template loads attack animation');
assert.equal(tpl.loadedAnimations.has('anim00'), false, 'spirit template does not require missing move animation');
assert.equal(tpl.loadedAnimations.has('anim01'), false, 'spirit template does not require missing idle animation');
assert.equal(tpl.loadedAnimations.has('anim03'), false, 'spirit template does not require missing kb animation');

const actor = factory.createActor(spiritUnitDef.slotId, {
  side: 'dog-player',
  x: 3000,
  y: 0,
  direction: -1,
  facing: -1,
  renderFlipX: false,
  scale: 1,
  currentAnimId: spiritUnitDef.moveAnimId
});
assert.equal(actor.currentAnimId, 'anim02', 'spawned spirit starts with the only bundled animation');
assert.equal(actor.animations.has('anim02'), true, 'spawned spirit carries attack animation');

console.log(`check-bcu-spirit-bundle-manifest-parity: OK spirits=${spiritIds.length}`);
