const ANIM4_E = (p) => [
  { id: 'anim00', label: '00', file: `${p}00.maanim` },
  { id: 'anim01', label: '01', file: `${p}01.maanim` },
  { id: 'anim02', label: '02 attack candidate', file: `${p}02.maanim` },
  { id: 'anim03', label: '03', file: `${p}03.maanim` }
];

export const PREVIEW_ASSETS = [
  { id:'enemy-000', label:'Enemy 000 / ワンコ候補', role:'player-dog-candidate', group:'dogs', baseDir:'./public/assets/bcu/000002/org/enemy/000/', image:'000_e.png', imgcut:'000_e.imgcut', model:'000_e.mamodel', animations:ANIM4_E('000_e') },
  { id:'enemy-001', label:'Enemy 001 / ワンコ候補', role:'player-dog-candidate', group:'dogs', baseDir:'./public/assets/bcu/000002/org/enemy/001/', image:'001_e.png', imgcut:'001_e.imgcut', model:'001_e.mamodel', animations:ANIM4_E('001_e') },
  { id:'enemy-002', label:'Enemy 002 / ワンコ候補', role:'player-dog-candidate', group:'dogs', baseDir:'./public/assets/bcu/000002/org/enemy/002/', image:'002_e.png', imgcut:'002_e.imgcut', model:'002_e.mamodel', animations:ANIM4_E('002_e') },
  { id:'unit-000-c', label:'Unit 000 c / ネコ候補', role:'enemy-cat-candidate', group:'cats', baseDir:'./public/assets/bcu/000004/org/unit/000/c/', image:'000_c.png', imgcut:'000_c.imgcut', model:'000_c.mamodel', animations:ANIM4_E('000_c') },
  { id:'unit-001-c', label:'Unit 001 c / ネコ候補', role:'enemy-cat-candidate', group:'cats', baseDir:'./public/assets/bcu/000004/org/unit/001/c/', image:'001_c.png', imgcut:'001_c.imgcut', model:'001_c.mamodel', animations:ANIM4_E('001_c') },
  { id:'unit-002-c', label:'Unit 002 c / ネコ候補', role:'enemy-cat-candidate', group:'cats', baseDir:'./public/assets/bcu/000004/org/unit/002/c/', image:'002_c.png', imgcut:'002_c.imgcut', model:'002_c.mamodel', animations:ANIM4_E('002_c') },
  { id:'battle-critical', label:'Battle common / critical', role:'battle-effect', group:'effects', baseDir:'./public/assets/bcu/000001/org/battle/a/', image:'000_a.png', imgcut:'000_a.imgcut', model:'critical.mamodel', animations:[{id:'critical',label:'critical',file:'critical.maanim'}] },
  { id:'battle-boss-welcome', label:'Battle common / boss welcome', role:'battle-effect', group:'effects', baseDir:'./public/assets/bcu/000001/org/battle/a/', image:'000_a.png', imgcut:'000_a.imgcut', model:'boss_welcome.mamodel', animations:[{id:'boss_welcome',label:'boss welcome',file:'boss_welcome.maanim'}] },
  { id:'castle-000', label:'Castle 000', role:'castle', group:'castles', baseDir:'./public/assets/bcu/000001/org/castle/000/', image:['nyankoCastle_000_00.png','nyankoCastle_000_01.png'], imgcut:['nyankoCastle_000_00.imgcut','nyankoCastle_000_01.imgcut'], model:['nyankoCastle_000_00.mamodel','nyankoCastle_000_01.mamodel'], animations:[{id:'castle00',label:'00',file:['nyankoCastle_000_00.maanim','nyankoCastle_000_01.maanim']}] },
  { id:'castle-001', label:'Castle 001', role:'castle', group:'castles', baseDir:'./public/assets/bcu/000001/org/castle/001/', image:['nyankoCastle_001_00.png','nyankoCastle_001_01.png'], imgcut:['nyankoCastle_001_00.imgcut','nyankoCastle_001_01.imgcut'], model:['nyankoCastle_001_00.mamodel','nyankoCastle_001_01.mamodel'], animations:[{id:'castle00',label:'00',file:['nyankoCastle_001_00.maanim','nyankoCastle_001_01.maanim']}] }
];
