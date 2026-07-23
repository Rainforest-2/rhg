import assert from 'node:assert/strict';
import {
  BattlePatchInstallError,
  installBattlePatchSteps
} from '../js/boot/installBattlePatches.js';

function group(path, installer) {
  return {
    kind: 'group',
    path,
    exportName: 'install',
    weight: 1,
    load: async () => ({ install: installer })
  };
}

// A required middle-group failure must abort the remaining install sequence.
{
  const calls = [];
  const steps = [
    group('first', async () => { calls.push('first'); }),
    group('middle', async () => { calls.push('middle'); throw new Error('synthetic-middle-failure'); }),
    group('last', async () => { calls.push('last'); })
  ];
  await assert.rejects(
    installBattlePatchSteps(steps),
    (error) => error instanceof BattlePatchInstallError
      && error.failedSubsystem === 'battle-patch-install'
      && error.detail.path === 'middle'
  );
  assert.deepEqual(calls, ['first', 'middle'], 'later required groups must not execute after failure');
  assert.equal(globalThis.__BATTLE_BOOT_PATCH_MANIFEST__?.status, 'failed');
  assert.equal(globalThis.__BATTLE_BOOT_PATCH_MANIFEST__?.complete, false);
  assert.equal(globalThis.__BATTLE_BOOT_PATCH_MANIFEST__?.completed.length, 1);
  assert.equal(globalThis.__BATTLE_BOOT_PATCH_ERRORS__?.length, 1);
  assert.equal(globalThis.__BATTLE_BOOT_PATCH_ERRORS__?.[0]?.path, 'middle');
}

// Missing installer export is also a hard boot failure.
{
  const steps = [{ kind: 'group', path: 'missing-export', exportName: 'install', weight: 1, load: async () => ({}) }];
  await assert.rejects(installBattlePatchSteps(steps), BattlePatchInstallError);
  assert.equal(globalThis.__BATTLE_BOOT_PATCH_MANIFEST__?.failed?.path, 'missing-export');
}

// Complete installs publish an authoritative, ordered manifest and no errors.
{
  const calls = [];
  const steps = [
    group('first', async () => { calls.push('first'); }),
    {
      kind: 'direct',
      path: 'direct',
      weight: 1,
      load: async () => { calls.push('direct'); }
    },
    group('last', async () => { calls.push('last'); })
  ];
  const progress = [];
  const manifest = await installBattlePatchSteps(steps, (value) => progress.push(value));
  assert.deepEqual(calls, ['first', 'direct', 'last']);
  assert.equal(manifest.status, 'complete');
  assert.equal(manifest.complete, true);
  assert.deepEqual(manifest.completed.map((entry) => entry.path), ['first', 'direct', 'last']);
  assert.deepEqual(globalThis.__BATTLE_BOOT_PATCH_ERRORS__, []);
  assert.equal(progress.at(-1), 1);
}

console.log('check-battle-patch-install-atomicity: OK');
