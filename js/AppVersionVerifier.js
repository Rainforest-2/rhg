import { GAME_VERSION } from './AppVersion.js';
import { BATTLE_CONFIG } from './battle/BattleConfig.js';
export async function verifyAppVersion(){
  const ok = GAME_VERSION==='0.12.26' && BATTLE_CONFIG.version===GAME_VERSION;
  return { ok, gameVersion: GAME_VERSION, battleVersion: BATTLE_CONFIG.version };
}
