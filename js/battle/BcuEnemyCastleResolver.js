// Faithful replication of BCU's enemy-castle id resolution for stages whose
// raw castle field is -1 ("inherit the map default"), proven against the local
// BCU references:
//
//   util/stage/Stage.java (loadStage, type == 0 branch):
//     int cas = parseIntN(strs[0]);
//     if (cas == -1) cas = CH_CASTLES[id.id];   // per-map default castle
//     if (sm.cast != -1) cas = sm.cast * 1000 + cas;  // StageMap chapter offset
//
//   util/stage/MapColc.java (main-story StageMap construction, cast arg):
//     EoC  X Zombie : new StageMap(id, abbr+"0_"+I+"_Z.csv", 1)  -> cast 1
//     ItF  X        : new StageMap(id, abbr+"1_"+I+".csv",   2)  -> cast 2
//     ItF  X Zombie : new StageMap(id, abbr+"1_"+I+"_Z.csv", 2)  -> cast 2
//     CotC X        : new StageMap(id, abbr+"2_"+I+".csv",   3)  -> cast 3
//     CotC X Zombie : new StageMap(id, abbr+"2_"+I+"_Z.csv", 3)  -> cast 3
//
// The bundled stage data in this project uses the BCU "stageNormal{F}_{C}[_Z]"
// naming, where F is the chapter family (0=EoC, 1=ItF, 2=CotC) and C is the
// chapter index (0..2). The MapColc add() index (which is what indexes
// CH_CASTLES) and the StageMap cast both follow from (F, C, zombie).
//
// We only ever rewrite the castle id when the raw value is -1/missing. Stages
// that carry an explicit castle id are returned unchanged, so this never alters
// event/collab/custom stages that already resolve a real castle.

// Stage.java CH_CASTLES (indexed by the StageMap's MapColc add() index).
export const CH_CASTLES = Object.freeze([
  45, 44, 43, 42, 41, 40, 39, 38, 37, 36, 35, 34, 33, 32, 31, 30, 29, 28,
  27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 46,
  47, 45, 47, 47, 45, 45
]);

// MapColc.java main-story add() indices, keyed by `${family}${zombie?'Z':''}`.
// Each entry maps the chapter index C (0..2) to the MapColc map id used as the
// CH_CASTLES index, plus the StageMap cast argument for that family.
const MAIN_STORY_MAPS = {
  '0Z': { cast: 1, addIndexByChapter: [0, 1, 2] },   // EoC  1/2/3 Zombie
  '1': { cast: 2, addIndexByChapter: [3, 4, 5] },    // ItF  1/2/3
  '1Z': { cast: 2, addIndexByChapter: [10, 12, 13] }, // ItF 1/2/3 Zombie
  '2': { cast: 3, addIndexByChapter: [6, 7, 8] },    // CotC 1/2/3
  '2Z': { cast: 3, addIndexByChapter: [15, 16, 17] } // CotC 1/2/3 Zombie
};

const STAGE_NORMAL_RE = /^stageNormal(-?\d+)_(-?\d+)(_Z)?$/i;
// BCU main-story EoC (日本編) per-stage files: org/stage/CH/stage/stageNN.csv. These are type != 0
// (no castle row), so Stage.java resolves castle = sm.cast(1) * 1000 + CH_CASTLES[id.id], i.e. the
// Empire (ec) castle that changes per stage index NN. Proven: base pack 000001 ships stage00..stage52,
// MapColc.java EoC StageMap cast = 1, Stage.java type!=0 branch uses CH_CASTLES[id.id].
const CH_EOC_STAGE_RE = /^stage(\d+)$/i;
const EOC_CAST = 1;

function chCastle(index) {
  if (!Number.isInteger(index) || index < 0 || index >= CH_CASTLES.length) return CH_CASTLES[0];
  return CH_CASTLES[index];
}

function applyCast(cas, cast) {
  return cast !== -1 && Number.isFinite(cast) ? cast * 1000 + cas : cas;
}

// Returns { castleId, source } given a raw stage castle field and the stage's
// basename (e.g. "stageNormal0_0_Z"). When rawCastleId is a finite, non-negative
// integer it is returned untouched.
export function resolveBcuEnemyCastleId(rawCastleId, { stageId = null } = {}) {
  // Only a real, non-negative numeric castle field counts as explicit. null/undefined (no castle row,
  // e.g. main-story CH stages) and -1 ("inherit map default") must fall through to CH resolution —
  // note Number(null) === 0 would otherwise be mistaken for an explicit rc000 castle.
  const raw = rawCastleId == null ? NaN : Number(rawCastleId);
  if (Number.isInteger(raw) && raw >= 0) {
    return { castleId: raw, source: 'explicit-stage-castle' };
  }

  const basename = String(stageId || '').split('/').pop() || '';

  // EoC per-stage files (stageNN): castle = EOC_CAST*1000 + CH_CASTLES[NN] (Empire castle, per stage).
  const eocMatch = basename.match(CH_EOC_STAGE_RE);
  if (eocMatch) {
    const stageIndex = Number(eocMatch[1]);
    return {
      castleId: applyCast(chCastle(stageIndex), EOC_CAST),
      source: `bcu-main-story-castle:eoc:stage${stageIndex}`
    };
  }

  const match = basename.match(STAGE_NORMAL_RE);
  if (match) {
    const family = Number(match[1]);
    const chapter = Number(match[2]);
    const zombie = !!match[3];
    const key = `${family}${zombie ? 'Z' : ''}`;
    const map = MAIN_STORY_MAPS[key];
    if (map) {
      const addIndex = map.addIndexByChapter[chapter] ?? map.addIndexByChapter[0];
      const cas = chCastle(addIndex);
      return {
        castleId: applyCast(cas, map.cast),
        source: `bcu-main-story-castle:stageNormal:${key}:chapter${chapter}`
      };
    }
  }

  // Unknown map with an inherited (-1) castle: fall back to BCU's per-map default
  // table indexed by the stage's local index, with no chapter cast offset. This
  // still resolves a real BCU castle image rather than the dev placeholder.
  const tail = basename.match(/_(-?\d+)$/);
  const localIndex = tail ? Number(tail[1]) : 0;
  return { castleId: chCastle(localIndex), source: 'bcu-default-castle-table' };
}
