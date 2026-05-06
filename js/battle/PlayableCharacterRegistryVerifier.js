import { BATTLE_CONFIG } from './BattleConfig.js';
import { buildCharacterCatalog, buildPlayablePreviewAssets, formatBcuId } from './PlayableCharacterRegistry.js';
import { PREVIEW_ASSETS } from '../data/previewAssets.js';
import { DEFAULT_FORMATION, sanitizeFormation } from './FormationStore.js';
import { getCharacterBaseId, isSameBaseCharacter } from './CharacterCatalog.js';

const ANIM4_E = (p) => [
  { id: 'anim00', label: '00', file: `${p}00.maanim` },
  { id: 'anim01', label: '01', file: `${p}01.maanim` },
  { id: 'anim02', label: '02 attack candidate', file: `${p}02.maanim` },
  { id: 'anim03', label: '03', file: `${p}03.maanim` }
];

const eqSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

export async function verifyPlayableCharacterRegistry() {
  const checks = [];
  const catalog = buildCharacterCatalog();
  const ids = catalog.map((c) => c.characterId);
  checks.push({ name: 'uniqueCharacterId', ok: new Set(ids).size === ids.length });
  checks.push({ name: 'allHaveBaseCharacterId', ok: catalog.every((c) => !!c.baseCharacterId) });
  const dogs = catalog.filter((c) => c.faction === 'dog');
  const cats = catalog.filter((c) => c.faction === 'cat');
  const playableAssets = buildPlayablePreviewAssets(ANIM4_E);
  const dogPlayableAssets = playableAssets.filter((a) => a.group === 'dogs');
  const catPlayableAssets = playableAssets.filter((a) => a.group === 'cats');
  let formatStrict = true;
  try {
    formatStrict = formatBcuId(0) === '000' && formatBcuId(8) === '008' && formatBcuId(12) === '012';
    let threw = false;
    try { formatBcuId('abc'); } catch (_) { threw = true; }
    formatStrict = formatStrict && threw;
    threw = false;
    try { formatBcuId(-1); } catch (_) { threw = true; }
    formatStrict = formatStrict && threw;
  } catch (_) {
    formatStrict = false;
  }
  checks.push({ name: 'formatBcuIdStrict', ok: formatStrict });
  checks.push({ name: 'dogCostFixed100', ok: dogs.every((c) => c.defaultCost === 100) });
  checks.push({ name: 'dogRosterAllCost100', ok: BATTLE_CONFIG.rosters.dogPlayer.every((r) => r.cost === 100) && dogs.every((c) => c.defaultCost === 100) });
  checks.push({ name: 'dogRosterCatalogMatch', ok: eqSet(new Set(BATTLE_CONFIG.rosters.dogPlayer.map((r) => r.slotId)), new Set(dogs.map((c) => c.characterId))) });
  checks.push({ name: 'catRosterCatalogMatch', ok: eqSet(new Set(BATTLE_CONFIG.rosters.catUnits.map((r) => r.slotId)), new Set(cats.map((c) => c.characterId))) });
  checks.push({
    name: 'sourceOfTruthGuard',
    ok: eqSet(new Set(BATTLE_CONFIG.rosters.dogPlayer.map((r) => r.slotId)), new Set(dogs.map((c) => c.characterId)))
      && eqSet(new Set(BATTLE_CONFIG.rosters.catUnits.map((r) => r.slotId)), new Set(cats.map((c) => c.characterId)))
      && eqSet(new Set([...BATTLE_CONFIG.rosters.dogPlayer, ...BATTLE_CONFIG.rosters.catUnits].map((r) => r.assetId)), new Set(playableAssets.map((a) => a.id))),
  });
  const previewIds = new Set(PREVIEW_ASSETS.map((a) => a.id));
  checks.push({ name: 'previewContainsAllPlayableAssets', ok: [...BATTLE_CONFIG.rosters.dogPlayer, ...BATTLE_CONFIG.rosters.catUnits].every((r) => previewIds.has(r.assetId)) });
  checks.push({
    name: 'assetPathShape',
    ok: dogPlayableAssets.every((a) => /^enemy-\d{3}$/.test(a.id)
      && /\/org\/enemy\/\d{3}\//.test(a.baseDir)
      && /^\d{3}_e\.(png)$/.test(a.image)
      && /^\d{3}_e\.(imgcut)$/.test(a.imgcut)
      && /^\d{3}_e\.(mamodel)$/.test(a.model))
      && catPlayableAssets.every((a) => /^unit-\d{3}-[a-z0-9]+$/.test(a.id)
      && /\/org\/unit\/\d{3}\/[a-z0-9]+\//.test(a.baseDir)
      && /^\d{3}_[a-z0-9]+\.(png)$/.test(a.image)
      && /^\d{3}_[a-z0-9]+\.(imgcut)$/.test(a.imgcut)
      && /^\d{3}_[a-z0-9]+\.(mamodel)$/.test(a.model)),
  });
  checks.push({
    name: 'bcuUnitFormBaseCompatibility',
    ok: isSameBaseCharacter(
      { characterId: 'cat-test-f', baseCharacterId: 'cat-test' },
      { characterId: 'cat-test-c', baseCharacterId: 'cat-test' }
    ) === true
    && isSameBaseCharacter(
      { characterId: 'cat-test-f', baseCharacterId: 'cat-test' },
      { characterId: 'cat-other-f', baseCharacterId: 'cat-other' }
    ) === false,
  });
  checks.push({ name: 'getCharacterBaseIdDogCat', ok: getCharacterBaseId('dog-wanko') === 'dog-wanko' && getCharacterBaseId('cat-basic') === 'cat-basic' });
  const s = sanitizeFormation({ slots: ['cat-basic', 'cat-basic', 'dog-wanko', 'dog-wanko', null] });
  checks.push({ name: 'sanitizeFormationBaseDedup', ok: s.slots[0] === 'cat-basic' && s.slots[1] === null && s.slots[2] === 'dog-wanko' && s.slots[3] === null });
  checks.push({ name: 'defaultFormationUnchanged', ok: JSON.stringify(DEFAULT_FORMATION.slots) === JSON.stringify(['dog-wanko', 'dog-nyoro', 'dog-rei', 'cat-basic', 'cat-tank']) });
  checks.push({ name: 'productionDefaultLineupUnchanged', ok: JSON.stringify(BATTLE_CONFIG.production.player.defaultLineup.map((x) => x.slotId)) === JSON.stringify(['prod-dog-wanko', 'prod-dog-nyoro', 'prod-dog-rei', 'prod-cat-basic', 'prod-cat-tank']) });
  checks.push({ name: 'catEnemyStill3', ok: BATTLE_CONFIG.rosters.catEnemy.length === 3 });
  checks.push({ name: 'stageFlagsFalse', ok: BATTLE_CONFIG.stage.applyStageDefinition.replaceEnemySpawnSchedule === false && BATTLE_CONFIG.stage.applyStageDefinition.applyStageLenToCoordinate === false });
  return { ok: checks.every((c) => c.ok), checks };
}
