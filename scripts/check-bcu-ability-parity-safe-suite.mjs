import { spawnSync } from 'node:child_process';

const commands = [
  ['node', ['--check', 'js/battle/bcu-runtime/BcuDelayRuntime.js']],
  ['node', ['--check', 'js/battle/BcuDelayRuntimePatch.js']],
  ['node', ['--check', 'js/battle/bcu-runtime/BcuWaveInvalidRuntime.js']],
  ['node', ['--check', 'js/battle/BattleSceneBcuWaveInvalidApplyPatch.js']],
  ['node', ['--check', 'js/battle/bcu-runtime/BcuBarrierShieldEffectRuntime.js']],
  ['node', ['--check', 'js/battle/BattleActorBarrierShieldVisualPatch.js']],
  ['node', ['--check', 'js/battle/BattleToxicEffectAssetPatch.js']],
  ['node', ['--check', 'js/battle/BattleSceneBcuWaveOnBlockedHitPatch.js']],
  ['node', ['--check', 'js/preview/PreviewAppBattleResultOverlayPatch.js']],
  ['node', ['--check', 'scripts/check-bcu-parser-indexes.mjs']],
  ['node', ['--check', 'scripts/check-bcu-delay-runtime.mjs']],
  ['node', ['--check', 'scripts/check-bcu-stage-line-row-parity.mjs']],
  ['node', ['--check', 'scripts/check-bcu-wave-invalid-parity.mjs']],
  ['node', ['--check', 'scripts/check-bcu-wave-on-barrier-shield-block-parity.mjs']],
  ['node', ['--check', 'scripts/check-bcu-barrier-shield-effect-parity.mjs']],
  ['node', ['--check', 'scripts/check-bcu-burrow-lifecycle-parity.mjs']],
  ['node', ['--check', 'scripts/check-bcu-castle-guard-parity.mjs']],
  ['node', ['--check', 'scripts/check-bcu-spirit-lifecycle-parity.mjs']],
  ['node', ['--check', 'scripts/check-bcu-zombie-corpse-soulstrike-parity.mjs']],
  ['node', ['--check', 'scripts/check-bcu-demon-shield-regen-timing.mjs']],
  ['node', ['--check', 'scripts/check-projectile-damage-parity.mjs']],
  ['node', ['--check', 'scripts/check-proc-immunity-resistance-parity.mjs']],
  ['node', ['--check', 'scripts/check-bcu-toxic-effect-parity.mjs']],
  ['node', ['--check', 'scripts/check-effect-bundle-aliases.mjs']],
  ['node', ['--check', 'scripts/check-effect-coordinate-traces.mjs']],
  ['node', ['--check', 'scripts/check-debug-allocation-guards.mjs']],
  ['node', ['--check', 'scripts/check-bcu-death-animation-parity.mjs']],
  ['node', ['--check', 'scripts/check-bcu-warp-lifecycle-parity.mjs']],
  ['node', ['--check', 'scripts/check-ability-partial-blockers.mjs']],
  ['node', ['scripts/check-bcu-parser-indexes.mjs']],
  ['node', ['scripts/check-bcu-delay-runtime.mjs']],
  ['node', ['scripts/check-bcu-stage-line-row-parity.mjs']],
  ['node', ['scripts/check-bcu-wave-invalid-parity.mjs']],
  ['node', ['scripts/check-bcu-wave-on-barrier-shield-block-parity.mjs']],
  ['node', ['scripts/check-bcu-barrier-shield-effect-parity.mjs']],
  ['node', ['scripts/check-bcu-burrow-lifecycle-parity.mjs']],
  ['node', ['scripts/check-bcu-castle-guard-parity.mjs']],
  ['node', ['scripts/check-bcu-spirit-lifecycle-parity.mjs']],
  ['node', ['scripts/check-bcu-zombie-corpse-soulstrike-parity.mjs']],
  ['node', ['scripts/check-bcu-demon-shield-regen-timing.mjs']],
  ['node', ['scripts/check-projectile-damage-parity.mjs']],
  ['node', ['scripts/check-proc-immunity-resistance-parity.mjs']],
  ['node', ['scripts/check-bcu-toxic-effect-parity.mjs']],
  ['node', ['scripts/check-effect-bundle-aliases.mjs']],
  ['node', ['scripts/check-effect-coordinate-traces.mjs']],
  ['node', ['scripts/check-debug-allocation-guards.mjs']],
  ['node', ['scripts/check-bcu-death-animation-parity.mjs']],
  ['node', ['scripts/check-bcu-warp-lifecycle-parity.mjs']],
  ['node', ['scripts/check-ability-partial-blockers.mjs']]
];

const results = [];
let failed = false;

for (const [cmd, args] of commands) {
  const label = `${cmd} ${args.join(' ')}`;
  console.log(`\n$ ${label}`);
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: false });
  const status = result.status ?? 1;
  results.push({ label, status });
  if (status !== 0) {
    failed = true;
    console.error(`FAILED: ${label} exited with ${status}`);
    break;
  }
}

console.log('\nBCU ability parity safe suite summary:');
for (const r of results) console.log(`- ${r.status === 0 ? 'OK' : 'FAIL'}: ${r.label}`);

if (failed) process.exit(1);
console.log('\ncheck-bcu-ability-parity-safe-suite: OK');
