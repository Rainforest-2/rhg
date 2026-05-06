import { GAME_VERSION } from './AppVersion.js';
import { BATTLE_CONFIG } from './battle/BattleConfig.js';

export async function verifyAppVersion() {
  return {
    ok: GAME_VERSION === BATTLE_CONFIG.version,
    gameVersion: GAME_VERSION,
    battleVersion: BATTLE_CONFIG.version
  };
}
