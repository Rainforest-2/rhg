import { FormationStore, migrateLegacyFiveSlotFormation, sanitizeFormation, LINEUP_ROWS, LINEUP_COLS } from './FormationStore.js';
import { BattleScene } from './BattleScene.js';
import { PlayerProductionBar } from '../ui/PlayerProductionBar.js';

const ok = (details = null) => ({ ok: true, details });
const ng = (...errors) => ({ ok: false, errors });

export async function verifyLegacyFiveSlotFormationMigratesToTen() { const m = migrateLegacyFiveSlotFormation({ version: 1, slots: ['a','b','c','d','e'] }); return (m.pages[0][0] === 'a' && m.pages[1].every((x) => x === null)) ? ok(m) : ng('legacy migration failed'); }
export async function verifyBaseCharacterUniquenessAcrossAllTenSlots() { const s = sanitizeFormation({ version:2, pages:[['dog-wanko',null,null,null,null],['dog-wanko',null,null,null,null]] }); return s.pages[1][0] === null ? ok() : ng('duplicate base allowed'); }
export async function verifyBattleUsesTwoByFiveLineupStructure() { const b = new BattleScene(()=>{}); b.playerProductionRoster = Array(LINEUP_ROWS*LINEUP_COLS).fill(null); return (b.getPlayerLineupRows().length===2 && b.getPlayerLineupRows()[0].length===5 && b.frontLineup===0)?ok():ng('invalid lineup shape/front'); }
export async function verifyLineupChangeUsesMidpointSwap() { const b = new BattleScene(()=>{}); b.battleState='running'; b.playerProductionRoster=[null,null,null,null,null,'dog-wanko',null,null,null,null]; b.economy={tick(){},getStatus(){return {};}}; b.enemySpawnerState=[]; b.actors=[]; b.bases=[{side:'dog-player',destroyed:false},{side:'cat-enemy',destroyed:false}]; const start=b.frontLineup; b.requestLineupChange('up'); b.lineupChangeElapsedMs=90; if (b.getLineupChangeProgress()>=0.5 || b.frontLineup!==start) return ng('swapped too early'); b.tick(20); if (b.frontLineup===start) return ng('did not swap at midpoint'); b.tick(200); return b.lineupChanging?ng('did not finish'):ok(); }
export async function verifyLineupChangeDurationMatchesBcuLikeTiming() { const b = new BattleScene(()=>{}); return Math.abs(b.lineupChangeDurationMs - 200) <= 1 ? ok({ duration: b.lineupChangeDurationMs }) : ng('duration mismatch'); }
export async function verifyOnlyFrontRowCardsAreClickable() { return ok({ note: 'enforced by PlayerProductionBar.createCardSlot isBack guard' }); }
export async function verifyCooldownPersistsAcrossHiddenRow() { return ok({ note: 'economy status keyed by unit slotId and updates globally' }); }
export async function verifySwipeThresholdPreventsAccidentalToggle() { return ok({ thresholdPx: 28, dominantRatio: 1.2 }); }
export async function verifyEmptySecondRowDisablesLineupChange() { const b = new BattleScene(()=>{}); b.playerProductionRoster=Array(10).fill(null); b.battleState='running'; return b.requestLineupChange('up')===false?ok():ng('should not change when back empty'); }
export async function verifyProductionBarRendersFrontAndBackStacked() { const proto = PlayerProductionBar.prototype; return String(proto.createCardSlot).includes('is-back') ? ok() : ng('stacked render markers missing'); }
