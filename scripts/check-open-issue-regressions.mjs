import { spawnSync } from 'node:child_process';

const commands = [
  ['node', ['--check', 'js/battle/BcuStageCsvLayout.js']],
  ['node', ['--check', 'js/battle/StageDefinitionTrailParityPatch.js']],
  ['node', ['--check', 'js/battle/BcuStageSpawnRuntime.js']],
  ['node', ['--check', 'js/battle/BcuStageGroupRuntime.js']],
  ['node', ['--check', 'js/battle/StageRuntimeSceneAdapter.js']],
  ['node', ['--check', 'js/battle/BattleSceneStageRuntimeWiring.js']],
  ['node', ['--check', 'js/battle/BattleSceneStageUnitDeathKcPatch.js']],
  ['node', ['--check', 'js/battle/BcuRankingRuntime.js']],
  ['node', ['--check', 'js/battle/BattleSceneBcuRankingRuntimePatch.js']],
  ['node', ['--check', 'js/battle/BattleSceneCustomStageTrailParityPatch.js']],
  ['node', ['--check', 'js/battle/DamageAbilityResolverMetalAbiPatch.js']],
  ['node', ['--check', 'js/battle/BcuTraitCompatibility.js']],
  ['node', ['--check', 'js/battle/BattleSceneActorLayerOrderPatch.js']],
  ['node', ['--check', 'js/battle/ActorStatsModel.js']],
  ['node', ['--check', 'js/battle/bcu-runtime/BcuStageCrownRuntime.js']],
  ['node', ['--check', 'js/battle/bcu-runtime/BcuCastleGuardRuntime.js']],
  ['node', ['--check', 'js/battle/BattleSceneBcuCastleGuardPatch.js']],
  ['node', ['--check', 'js/ui/FormationStageDifficultyPatch.js']],
  ['node', ['--check', 'js/boot/installBattlePatches.js']],
  ['node', ['--check', 'scripts/build-bcu-background-index.mjs']],
  ['node', ['--check', 'scripts/build-bcu-stage-crown-index.mjs']],
  ['node', ['scripts/check-bcu-stage-layout-trail-parity.mjs']],
  ['node', ['scripts/check-bcu-special-base-317.mjs']],
  ['node', ['scripts/check-bcu-stage-spawn-layer-kc-parity.mjs']],
  ['node', ['scripts/check-bcu-stage-crown-precision.mjs']],
  ['node', ['scripts/check-bcu-stage-group-crown-integration.mjs']],
  ['node', ['scripts/check-bcu-ranking-runtime.mjs']],
  ['node', ['scripts/check-custom-stage-trail-domain-parity.mjs']],
  ['node', ['scripts/check-bcu-crown-map-identity.mjs']],
  ['node', ['scripts/check-bcu-metal-abi-double-apply.mjs']],
  ['node', ['scripts/check-bcu-trait-targetforms-loader-parity.mjs']],
  ['node', ['scripts/check-bcu-actor-layer-order-parity.mjs']],
  ['node', ['scripts/check-battle-patch-install-atomicity.mjs']],
  ['node', ['scripts/check-battle-scene-stage-runtime-wiring.mjs']],
  ['node', ['scripts/check-bcu-enemy-entity-castle-guard.mjs']]
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
