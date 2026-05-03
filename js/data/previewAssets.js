const ANIM4_E = (p) => [
  { id: 'anim00', label: '00', file: `${p}00.maanim` },
  { id: 'anim01', label: '01', file: `${p}01.maanim` },
  { id: 'anim02', label: '02 attack candidate', file: `${p}02.maanim` },
  { id: 'anim03', label: '03', file: `${p}03.maanim` }
];

export const PREVIEW_ASSETS = [
  { id:'enemy-000', label:'ワンコ', role:'player-dog-candidate', group:'dogs', baseDir:'./public/assets/bcu/000002/org/enemy/000/', image:'000_e.png', imgcut:'000_e.imgcut', model:'000_e.mamodel', animations:ANIM4_E('000_e') },
  { id:'enemy-001', label:'ニョロ', role:'player-dog-candidate', group:'dogs', baseDir:'./public/assets/bcu/000002/org/enemy/001/', image:'001_e.png', imgcut:'001_e.imgcut', model:'001_e.mamodel', animations:ANIM4_E('001_e') },
  { id:'enemy-002', label:'例のヤツ', role:'player-dog-candidate', group:'dogs', baseDir:'./public/assets/bcu/000002/org/enemy/002/', image:'002_e.png', imgcut:'002_e.imgcut', model:'002_e.mamodel', animations:ANIM4_E('002_e') },
  { id:'unit-000-f', label:'ネコ', role:'enemy-cat-candidate', group:'cats', baseDir:'./public/assets/bcu/000004/org/unit/000/f/', image:'000_f.png', imgcut:'000_f.imgcut', model:'000_f.mamodel', animations:ANIM4_E('000_f') },
  { id:'unit-001-f', label:'タンクネコ', role:'enemy-cat-candidate', group:'cats', baseDir:'./public/assets/bcu/000004/org/unit/001/f/', image:'001_f.png', imgcut:'001_f.imgcut', model:'001_f.mamodel', animations:ANIM4_E('001_f') },
  { id:'unit-002-f', label:'バトルネコ', role:'enemy-cat-candidate', group:'cats', baseDir:'./public/assets/bcu/000004/org/unit/002/f/', image:'002_f.png', imgcut:'002_f.imgcut', model:'002_f.mamodel', animations:ANIM4_E('002_f') },
  { id:'battle-critical', label:'Battle common / critical', role:'battle-effect', group:'effects', baseDir:'./public/assets/bcu/000001/org/battle/a/', image:'000_a.png', imgcut:'000_a.imgcut', model:'critical.mamodel', animations:[{id:'critical',label:'critical',file:'critical.maanim'}] },
  { id:'battle-boss-welcome', label:'Battle common / boss welcome', role:'battle-effect', group:'effects', baseDir:'./public/assets/bcu/000001/org/battle/a/', image:'000_a.png', imgcut:'000_a.imgcut', model:'boss_welcome.mamodel', animations:[{id:'boss_welcome',label:'boss welcome',file:'boss_welcome.maanim'}] },
  { id:'castle-000', label:'Castle 000 / static', role:'castle', group:'castles', renderMode:'static-imgcut', baseDir:'./public/assets/bcu/000001/org/castle/000/', image:'nyankoCastle_000_00.png', imgcut:'nyankoCastle_000_00.imgcut', model:null, animations:[] },
  { id:'castle-001', label:'Castle 001 / animated', role:'castle', group:'castles', renderMode:'model', baseDir:'./public/assets/bcu/000001/org/castle/001/', image:'nyankoCastle_001_00_00.png', imgcut:'nyankoCastle_001_00_00.imgcut', model:'nyankoCastle_001_00_00.mamodel', animations:[{id:'castle00',label:'00',file:'nyankoCastle_001_00_00.maanim'}] }
];
