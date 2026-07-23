import { spawnSync } from 'node:child_process';

const commands = [
  ['node', ['--check', 'js/battle/BcuStageCsvLayout.js']],
  ['node', ['--check', 'js/battle/StageDefinitionTrailParityPatch.js']],
  ['node', ['--check', 'js/battle/BcuStageSpawnRuntime.js']],
  ['node', ['--check', 'js/battle/StageRuntimeSceneAdapter.js']],
  ['node', ['--check', 'js/battle/BattleSceneStageRuntimeWiring.js']],
  ['node', ['--check', 'js/battle/BattleSceneStageUnitDeathKcPatch.js']],
  ['node', ['--check', 'js/battle/DamageAbilityResolverMetalAbiPatch.js']],
  ['node', ['--check', 'js/battle/BcuTraitCompatibility.js']],
  ['node', ['--check', 'js/battle/BattleSceneActorLayerOrderPatch.js']],
  ['node', ['--check', 'js/boot/installBattlePatches.js']],
  ['node', ['--check', 'scripts/build-bcu-background-index.mjs']],
  ['node', ['scripts/check-bcu-stage-layout-trail-parity.mjs']],
  ['node', ['scripts/check-bcu-stage-spawn-layer-kc-parity.mjs']],
  ['node', ['scripts/check-bcu-metal-abi-double-apply.mjs']],
  ['node', ['scripts/check-bcu-trait-targetforms-loader-parity.mjs']],
  ['node', ['scripts/check-bcu-actor-layer-order-parity.mjs']],
  ['node', ['scripts/check-battle-patch-install-atomicity.mjs']],
  ['node', ['scripts/check-battle-scene-stage-runtime-wiring.mjs']]
];

for (const [command, args] of commands) {
  const label = `${command} ${args.join(' ')}`;
  console.log(`\n$ ${label}`);
  const result = spawnSync(command, args, { stdio: 'inherit', shell: false });
  if ((result.status ?? 1) !== 0) {
    console.error(`FAILED: ${label}`);
    process.exit(result.status ?? 1);
  }
}

console.log('\ncheck-open-issue-regressions: OK');
