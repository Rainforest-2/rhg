import { installBattleCorePatches } from './battle/installBattleCorePatches.js';
import { installBattleProjectilePatches } from './battle/installBattleProjectilePatches.js';
import { installBattleScenePatches } from './battle/installBattleScenePatches.js';
import { installBattleActorLifecyclePatches } from './battle/installBattleActorLifecyclePatches.js';
import { installBattleRendererPatches } from './battle/installBattleRendererPatches.js';

export async function installBattlePatches() {
  await installBattleCorePatches();
  await installBattleProjectilePatches();
  await installBattleScenePatches();
  // Input patches are kept here because one connector safety pass blocks moving these filenames into a helper.
  await import('../battle/BattleSceneBcuTouchPatch.js');
  await import('../battle/BattleSceneBcuMobileInputPatch.js');
  await installBattleActorLifecyclePatches();
  await installBattleRendererPatches();
}
