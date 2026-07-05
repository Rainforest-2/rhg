import test from 'node:test';
import assert from 'node:assert';

// In-memory localStorage stub (node has none). Installed before the store modules run any op; the
// stores read globalThis.localStorage lazily inside each call, so this is sufficient.
function installStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  globalThis.localStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    clear: () => map.clear()
  };
  return map;
}

const {
  encodeStageRef, decodeStageRef, normalizeStageRef, stageRefsEqual, uniqueStageRefs,
  secondsToFrames, framesToSeconds, createCustomStage
} = await import('../js/custom-stage/CustomStageSchema.js');
const battleStore = await import('../js/custom-stage/CustomStageBattleStore.js');
const stageStore = await import('../js/custom-stage/CustomStageStore.js');
const { validateCustomStage } = await import('../js/custom-stage/CustomStageValidator.js');
const { resolveStageRef, validateBattleLaunch } = await import('../js/custom-stage/CustomStageReferenceResolver.js');

test('stage ref encode/decode round-trips bcu and custom', () => {
  assert.strictEqual(encodeStageRef({ kind: 'bcu', id: 'stageX' }), 'stageX');
  assert.strictEqual(encodeStageRef({ kind: 'custom', id: 'custom-1' }), 'custom:custom-1');
  assert.deepStrictEqual(decodeStageRef('stageX'), { kind: 'bcu', id: 'stageX' });
  assert.deepStrictEqual(decodeStageRef('custom:custom-1'), { kind: 'custom', id: 'custom-1' });
  assert.ok(stageRefsEqual('custom:a', { kind: 'custom', id: 'a' }));
  assert.strictEqual(normalizeStageRef(''), null);
  const deduped = uniqueStageRefs(['a', 'a', 'custom:b', { kind: 'custom', id: 'b' }]);
  assert.strictEqual(deduped.length, 2);
});

test('seconds<->frames uses 60 internal frames/sec', () => {
  assert.strictEqual(secondsToFrames(1), 60);
  assert.strictEqual(secondsToFrames(8), 480);
  assert.strictEqual(framesToSeconds(60), 1);
});

test('migration: legacy v1 flat ids -> v2 typed bcu refs, HP options preserved, idempotent', () => {
  const legacy = {
    mode: 'stage-vs-stage-multi',
    enabled: true,
    enemyStageIds: ['stageA', 'stageB'],
    playerStageIds: ['stageC'],
    baseSource: 'player',
    fixedBaseHpEnabled: true,
    baseHpDrainEnabled: true,
    autoBarrierBreakEnabled: true
  };
  installStorage({ 'wanko.customStageBattle.v1': JSON.stringify(legacy) });

  const migrated = battleStore.migrateBattleConfigInStorage();
  assert.strictEqual(migrated.schemaVersion, 2);
  assert.deepStrictEqual(migrated.enemyStages, [{ kind: 'bcu', id: 'stageA' }, { kind: 'bcu', id: 'stageB' }]);
  assert.deepStrictEqual(migrated.playerStages, [{ kind: 'bcu', id: 'stageC' }]);
  assert.deepStrictEqual(migrated.enemyStageIds, ['stageA', 'stageB'], 'flat mirror preserved');
  assert.strictEqual(migrated.baseSource, 'player');
  assert.strictEqual(migrated.fixedBaseHpEnabled, true);
  assert.strictEqual(migrated.baseHpDrainEnabled, true);
  assert.strictEqual(migrated.autoBarrierBreakEnabled, true);

  // Idempotent: running again yields an equal typed config and does not duplicate/lose entries.
  const again = battleStore.migrateBattleConfigInStorage();
  assert.deepStrictEqual(again.enemyStages, migrated.enemyStages);
  assert.deepStrictEqual(again.playerStages, migrated.playerStages);
  assert.strictEqual(again.fixedBaseHpEnabled, true);
});

test('migration: custom entries survive round trip and flat is ground truth', () => {
  installStorage({ 'wanko.customStageBattle.v1': JSON.stringify({
    mode: 'stage-vs-stage-multi', enabled: true,
    enemyStageIds: ['stageA', 'custom:c1'], playerStageIds: ['custom:c2']
  }) });
  const cfg = battleStore.readBattleConfig();
  assert.deepStrictEqual(cfg.enemyStages, [{ kind: 'bcu', id: 'stageA' }, { kind: 'custom', id: 'c1' }]);
  assert.deepStrictEqual(cfg.playerStages, [{ kind: 'custom', id: 'c2' }]);

  // Simulate a legacy patch overwriting only the flat array while preserving a now-stale typed array.
  installStorage({ 'wanko.customStageBattle.v1': JSON.stringify({
    mode: 'stage-vs-stage-multi', enabled: true,
    enemyStages: [{ kind: 'bcu', id: 'STALE' }],
    enemyStageIds: ['stageA'], playerStageIds: ['stageC']
  }) });
  const cfg2 = battleStore.readBattleConfig();
  assert.deepStrictEqual(cfg2.enemyStages, [{ kind: 'bcu', id: 'stageA' }], 'flat wins over stale typed');
});

test('custom stage store: create/save/read/duplicate/delete', () => {
  installStorage();
  const saved = stageStore.createAndSaveCustomStage({ name: 'テストA', battle: { backgroundId: 0, enemyCastleId: 0 } });
  assert.ok(saved.id.startsWith('custom-'));
  assert.strictEqual(stageStore.readCustomStages().length, 1);

  const copy = stageStore.duplicateCustomStage(saved.id);
  assert.strictEqual(copy.name, 'テストAのコピー');
  assert.notStrictEqual(copy.id, saved.id);
  assert.strictEqual(stageStore.readCustomStages().length, 2);

  assert.strictEqual(stageStore.deleteCustomStage(saved.id), true);
  assert.strictEqual(stageStore.getCustomStage(saved.id), null);
  assert.strictEqual(stageStore.readCustomStages().length, 1);
});

test('validator: hard errors block save; soft warnings allow it', () => {
  // Pass a RAW draft (not a normalized stage) so the blank-name and zero-value checks fire.
  const bad = { name: '', battle: { stageLength: 0, enemyBaseHp: 0, maxEnemyCount: 0, backgroundId: null, enemyCastleId: null } };
  const r = validateCustomStage(bad);
  assert.strictEqual(r.ok, false);
  const fields = r.errors.map((e) => e.field);
  assert.ok(fields.includes('name'));
  assert.ok(fields.includes('backgroundId'));
  assert.ok(fields.includes('enemyCastleId'));
  assert.ok(fields.includes('stageLength'));

  const okStage = createCustomStage({
    name: 'OK', battle: { backgroundId: 5, enemyCastleId: 3, musicId: null },
    spawns: []
  });
  const r2 = validateCustomStage(okStage);
  assert.strictEqual(r2.ok, true, JSON.stringify(r2.errors));
  assert.ok(r2.warnings.some((w) => w.field === 'musicId'));
  assert.ok(r2.warnings.some((w) => w.field === 'spawns'));
});

test('reference resolver: deleted custom ref is surfaced, launch guard stops battle', () => {
  installStorage();
  const stage = stageStore.createAndSaveCustomStage({ name: '味方ステージ', battle: { backgroundId: 0, enemyCastleId: 0 } });
  const okResolved = resolveStageRef({ kind: 'custom', id: stage.id });
  assert.strictEqual(okResolved.ok, true);
  assert.strictEqual(okResolved.label, '味方ステージ');

  const missing = resolveStageRef({ kind: 'custom', id: 'custom-gone' });
  assert.strictEqual(missing.ok, false);
  assert.strictEqual(missing.reason, 'custom-stage-deleted');
  assert.strictEqual(missing.label, '削除済み自作ステージ');

  // Launch: enemy has a live custom stage, player references a deleted custom stage → not ok.
  const launch = validateBattleLaunch({
    enemyStages: [{ kind: 'custom', id: stage.id }],
    playerStages: [{ kind: 'custom', id: 'custom-gone' }],
    baseSource: 'enemy'
  }, { resolveBcu: () => null });
  assert.strictEqual(launch.ok, false);
  assert.ok(launch.errors.some((e) => e.reason === 'custom-stage-deleted'));

  const emptyLaunch = validateBattleLaunch({ enemyStages: [], playerStages: [] });
  assert.ok(emptyLaunch.errors.some((e) => e.reason === 'empty'));
});
