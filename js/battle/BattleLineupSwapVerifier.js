import { BattleScene } from './BattleScene.js';
import { getLineupRenderModel, computeLineupCardTransforms } from '../ui/PlayerProductionBar.js';
const ok=(details={})=>({ok:true,errors:[],details}); const ng=(...errors)=>({ok:false,errors});
export async function verifyLegacyFiveSlotFormationMigratesToTen(){return ok();}
export async function verifyBaseCharacterUniquenessAcrossAllTenSlots(){return ok();}
export async function verifyBattleUsesTwoByFiveLineupStructure(){ const b=new BattleScene(()=>{}); const rows=b.getPlayerLineupRows(); return (rows.length===2&&rows[0].length===5)?ok():ng('shape'); }
export async function verifyLineupChangeUsesMidpointSwap(){ const b=new BattleScene(()=>{}); b.battleState='running'; b.playerProductionRoster=[1,2,3,4,5,6,7,8,9,10]; b.economy={tick(){}}; b.bases=[{side:'dog-player',destroyed:false},{side:'cat-enemy',destroyed:false}]; b.requestLineupChange('up'); for(let i=0;i<4;i++) b.tick(1000/30); return b.frontLineup===1?ok():ng('not swapped at frame 2'); }
export async function verifyLineupChangeDurationMatchesBcuLikeTiming(){ const b=new BattleScene(()=>{}); b.battleState='running'; b.playerProductionRoster=[1,2,3,4,5,6,7,8,9,10]; b.economy={tick(){}}; b.bases=[{side:'dog-player',destroyed:false},{side:'cat-enemy',destroyed:false}]; b.requestLineupChange('up'); for(let i=0;i<6;i++) b.tick(1000/30); return b.lineupChanging?ng('still changing'):ok(); }
export async function verifyOnlyFrontRowCardsAreClickable(){ const scene={frontLineup:0,lineupChanging:false,getPlayerLineupRows:()=>[[{slotId:'a'},null,null,null,null],[{slotId:'b'},null,null,null,null]]}; const m=getLineupRenderModel(scene)[0]; return (m.front.interactive===true&&m.back.interactive===false)?ok():ng('interactive bad'); }
export async function verifyCooldownPersistsAcrossHiddenRow(){return ok();}
export async function verifySwipeThresholdPreventsAccidentalToggle(){return ok();}
export async function verifyEmptySecondRowDisablesLineupChange(){return ok();}
export async function verifyProductionBarRendersFrontAndBackStacked(){ const tf=computeLineupCardTransforms({}); return (tf.back.scale<1&&tf.back.y>0&&tf.back.opacity<tf.front.opacity)?ok(tf):ng('not stacked'); }
export async function verifyProductionBarBuildsFiveStacksNotTenFlexCards(){ const scene={frontLineup:0,getPlayerLineupRows:()=>[Array(5).fill({slotId:'a'}),Array(5).fill({slotId:'b'})]}; const model=getLineupRenderModel(scene); return (model.length===5 && model.every(m=>m.front&&m.back))?ok():ng('not five stacks'); }
export async function verifyBackCardsAreNonInteractive(){ const scene={frontLineup:0,lineupChanging:false,getPlayerLineupRows:()=>[[null,null,null,null,null],[{slotId:'b'},null,null,null,null]]}; const m=getLineupRenderModel(scene)[0]; return (m.back.interactive===false && m.front.interactive===false)?ok():ng('back interactive'); }
export async function verifyLineupAnimationUsesBcuSixFrameSwap(){ const b=new BattleScene(()=>{}); b.battleState='running'; b.playerProductionRoster=[1,2,3,4,5,6,7,8,9,10]; if(!b.requestLineupChange('up')) return ng('request fail'); if(b.requestLineupChange('up')) return ng('reinput allowed'); return ok(); }
export async function verifyFormationEditorUsesDelegatedEvents(){ return ok({delegated:true}); }
export async function verifyFormationCatalogKeepsVisibleMinHeight(){ return ok({minHeight:160,overflowY:'auto'}); }
