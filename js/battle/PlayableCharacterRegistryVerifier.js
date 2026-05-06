import { BATTLE_CONFIG } from './BattleConfig.js';
import { buildCharacterCatalog } from './PlayableCharacterRegistry.js';
import { PREVIEW_ASSETS } from '../data/previewAssets.js';
import { DEFAULT_FORMATION, sanitizeFormation } from './FormationStore.js';
import { getCharacterBaseId } from './CharacterCatalog.js';

const eqSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

export async function verifyPlayableCharacterRegistry() {
  const checks = [];
  const catalog = buildCharacterCatalog();
  const ids = catalog.map((c) => c.characterId);
  checks.push({ name: 'uniqueCharacterId', ok: new Set(ids).size === ids.length });
  checks.push({ name: 'allHaveBaseCharacterId', ok: catalog.every((c) => !!c.baseCharacterId) });
  const dogs = catalog.filter((c) => c.faction === 'dog');
  const cats = catalog.filter((c) => c.faction === 'cat');
  checks.push({ name: 'dogCostFixed100', ok: dogs.every((c) => c.defaultCost === 100) });
  checks.push({ name: 'dogRosterCatalogMatch', ok: eqSet(new Set(BATTLE_CONFIG.rosters.dogPlayer.map((r) => r.slotId)), new Set(dogs.map((c) => c.characterId))) });
  checks.push({ name: 'catRosterCatalogMatch', ok: eqSet(new Set(BATTLE_CONFIG.rosters.catUnits.map((r) => r.slotId)), new Set(cats.map((c) => c.characterId))) });
  const previewIds = new Set(PREVIEW_ASSETS.map((a) => a.id));
  checks.push({ name: 'previewContainsAllPlayableAssets', ok: [...BATTLE_CONFIG.rosters.dogPlayer, ...BATTLE_CONFIG.rosters.catUnits].every((r) => previewIds.has(r.assetId)) });
  checks.push({ name: 'getCharacterBaseIdDogCat', ok: getCharacterBaseId('dog-wanko') === 'dog-wanko' && getCharacterBaseId('cat-basic') === 'cat-basic' });
  const s = sanitizeFormation({ slots: ['cat-basic', 'cat-basic', 'dog-wanko', 'dog-wanko', null] });
  checks.push({ name: 'sanitizeFormationBaseDedup', ok: s.slots[0] === 'cat-basic' && s.slots[1] === null && s.slots[2] === 'dog-wanko' && s.slots[3] === null });
  checks.push({ name: 'defaultFormationUnchanged', ok: JSON.stringify(DEFAULT_FORMATION.slots) === JSON.stringify(['dog-wanko', 'dog-nyoro', 'dog-rei', 'cat-basic', 'cat-tank']) });
  checks.push({ name: 'productionDefaultLineupUnchanged', ok: JSON.stringify(BATTLE_CONFIG.production.player.defaultLineup.map((x) => x.slotId)) === JSON.stringify(['prod-dog-wanko', 'prod-dog-nyoro', 'prod-dog-rei', 'prod-cat-basic', 'prod-cat-tank']) });
  checks.push({ name: 'catEnemyStill3', ok: BATTLE_CONFIG.rosters.catEnemy.length === 3 });
  checks.push({ name: 'stageFlagsFalse', ok: BATTLE_CONFIG.stage.applyStageDefinition.replaceEnemySpawnSchedule === false && BATTLE_CONFIG.stage.applyStageDefinition.applyStageLenToCoordinate === false });
  return { ok: checks.every((c) => c.ok), checks };
}
