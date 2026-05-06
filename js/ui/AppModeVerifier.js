import { PreviewUi } from '../preview/PreviewUi.js';
import { PREVIEW_ASSETS } from '../data/previewAssets.js';
import '../battle/BattleScene.js';
import './FormationEditor.js';
export async function verifyOnlyFormationModeIsExposed(){
  const html=[];
  const root={innerHTML:'',querySelector:()=>({onchange:null,onclick:null,oninput:null,textContent:''})};
  const ui=new PreviewUi(root,{innerHTML:'',scrollTop:0,scrollHeight:0});
  ui.init(PREVIEW_ASSETS,{});
  const markup=root.innerHTML||'';
  const ok=!markup.includes('Asset Preview')&&!markup.includes('Battle Scene')&&!markup.includes("id='mode'");
  return {ok};
}
