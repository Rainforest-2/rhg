import { buildPlayablePreviewAssets } from '../battle/PlayableCharacterRegistry.js';

const ANIM4_E = (p) => [
  { id: 'anim00', label: '00', file: `${p}00.maanim` },
  { id: 'anim01', label: '01', file: `${p}01.maanim` },
  { id: 'anim02', label: '02 attack candidate', file: `${p}02.maanim` },
  { id: 'anim03', label: '03', file: `${p}03.maanim` }
];

export const PREVIEW_ASSETS = [
  ...buildPlayablePreviewAssets(ANIM4_E),
  { id:'battle-critical', label:'Battle common / critical', role:'battle-effect', group:'effects', renderMode:'battle-effect', baseDir:'./public/assets/bcu/000001/org/battle/a/', image:'000_a.png', imgcut:'000_a.imgcut', model:'critical.mamodel', animations:[{id:'critical',label:'critical',file:'critical.maanim'}] },
  { id:'battle-boss-welcome', label:'Battle common / boss welcome', role:'battle-effect', group:'effects', renderMode:'battle-effect', baseDir:'./public/assets/bcu/000001/org/battle/a/', image:'000_a.png', imgcut:'000_a.imgcut', model:'boss_welcome.mamodel', animations:[{id:'boss_welcome',label:'boss welcome',file:'boss_welcome.maanim'}] },
  { id:'castle-composite-000', label:'にゃんこ城 / 合成', role:'castle', group:'castles', renderMode:'castle-composite', layers:[{id:'top',baseDir:'./public/assets/bcu/000001/org/castle/000/',image:'nyankoCastle_000_00.png',imgcut:'nyankoCastle_000_00.imgcut',offsetX:0,offsetY:0,anchor:'bottom-center',name:'top'},{id:'middle',baseDir:'./public/assets/bcu/000001/org/castle/002/',image:'nyankoCastle_002_00.png',imgcut:'nyankoCastle_002_00.imgcut',offsetX:0,offsetY:0,anchor:'bottom-center',name:'middle'},{id:'bottom',baseDir:'./public/assets/bcu/000001/org/castle/003/',image:'nyankoCastle_003_00.png',imgcut:'nyankoCastle_003_00.imgcut',offsetX:0,offsetY:0,anchor:'bottom-center',name:'bottom'}], model:null, animations:[] },
  { id:'castle-000-top', label:'Castle 000 / 城上部', role:'castle-part', group:'castles', renderMode:'static-imgcut', baseDir:'./public/assets/bcu/000001/org/castle/000/', image:'nyankoCastle_000_00.png', imgcut:'nyankoCastle_000_00.imgcut', model:null, animations:[] },
  { id:'castle-002-middle', label:'Castle 002 / 城中部', role:'castle-part', group:'castles', renderMode:'static-imgcut', baseDir:'./public/assets/bcu/000001/org/castle/002/', image:'nyankoCastle_002_00.png', imgcut:'nyankoCastle_002_00.imgcut', model:null, animations:[] },
  { id:'castle-003-bottom', label:'Castle 003 / 城下部', role:'castle-part', group:'castles', renderMode:'static-imgcut', baseDir:'./public/assets/bcu/000001/org/castle/003/', image:'nyankoCastle_003_00.png', imgcut:'nyankoCastle_003_00.imgcut', model:null, animations:[] },
  { id:'castle-001-cannon-effect', label:'Castle 001 / にゃんこ砲エフェクト', role:'battle-effect', group:'effects', renderMode:'battle-effect', baseDir:'./public/assets/bcu/000001/org/castle/001/', image:'nyankoCastle_001_00_00.png', imgcut:'nyankoCastle_001_00_00.imgcut', model:'nyankoCastle_001_00_00.mamodel', animations:[{id:'cannon',label:'cannon effect',file:'nyankoCastle_001_00_00.maanim'}] }
];
