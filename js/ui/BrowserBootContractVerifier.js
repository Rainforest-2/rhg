
import { verifyNoNodeBuiltinsInBrowserModules, verifyPreviewAppModuleBoots } from './BootSmokeVerifier.js';
import { BattleScene } from '../battle/BattleScene.js';

export async function verifyBrowserEntrypointHasNoNodeBuiltins(){
  return verifyNoNodeBuiltinsInBrowserModules();
}
export async function verifyBrowserImportChainHasNoNodeBuiltins(){
  return verifyNoNodeBuiltinsInBrowserModules();
}
export async function verifyStageRuntimeCannotBreakFormationBoot(){
  return verifyPreviewAppModuleBoots();
}
export async function verifyMissingStageEnemyAssetsDoNotRejectInit(){
  const errors=[];
  try{
    const scene=new BattleScene(()=>{});
    await scene.init?.();
  }catch(e){errors.push(String(e?.message||e));}
  return {ok:errors.length===0,errors};
}
