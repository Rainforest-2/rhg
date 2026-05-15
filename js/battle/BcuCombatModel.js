export const BCU_COMBAT_MODEL_VERSION = 'bcu-combat-v2';

export const BCU_TRAITS = Object.freeze({
  red: 'red', floating: 'floating', black: 'black', metal: 'metal', white: 'white', angel: 'angel', alien: 'alien', zombie: 'zombie', witch: 'witch', base: 'base', eva: 'eva', relic: 'relic', demon: 'demon', baron: 'baron', beast: 'beast', sage: 'sage', villain: 'villain'
});

export const BCU_ABI = Object.freeze({
  AB_GOOD: 1,
  AB_RESIST: 1 << 1,
  AB_MASSIVE: 1 << 2,
  AB_ONLY: 1 << 3,
  AB_METALIC: 1 << 4,
  AB_WAVES: 1 << 5,
  AB_SNIPERI: 1 << 6,
  AB_TIMEI: 1 << 7,
  AB_GHOST: 1 << 8,
  AB_ZKILL: 1 << 9,
  AB_WKILL: 1 << 10,
  AB_GLASS: 1 << 11,
  AB_THEMEI: 1 << 12,
  AB_EKILL: 1 << 13,
  AB_IMUSW: 1 << 14,
  AB_RESISTS: 1 << 15,
  AB_MASSIVES: 1 << 16,
  AB_BAKILL: 1 << 17,
  AB_CKILL: 1 << 18,
  AB_CSUR: 1 << 19,
  AB_SKILL: 1 << 20,
  AB_VKILL: 1 << 21
});

const UNIT_TRAIT_COLUMNS = Object.freeze([[10,BCU_TRAITS.red],[16,BCU_TRAITS.floating],[17,BCU_TRAITS.black],[18,BCU_TRAITS.metal],[19,BCU_TRAITS.white],[20,BCU_TRAITS.angel],[21,BCU_TRAITS.alien],[22,BCU_TRAITS.zombie],[78,BCU_TRAITS.relic],[96,BCU_TRAITS.demon]]);
const ENEMY_TRAIT_COLUMNS = Object.freeze([[10,BCU_TRAITS.red],[13,BCU_TRAITS.floating],[14,BCU_TRAITS.black],[15,BCU_TRAITS.metal],[16,BCU_TRAITS.white],[17,BCU_TRAITS.angel],[18,BCU_TRAITS.alien],[19,BCU_TRAITS.zombie],[48,BCU_TRAITS.witch],[49,BCU_TRAITS.base],[71,BCU_TRAITS.eva],[72,BCU_TRAITS.relic],[93,BCU_TRAITS.demon],[94,BCU_TRAITS.baron],[101,BCU_TRAITS.beast],[104,BCU_TRAITS.sage],[110,BCU_TRAITS.villain]]);

function n(raw,index,fallback=0){const v=Number(raw?.[index]);return Number.isFinite(v)?v:fallback;}
function enabled(raw,index){return n(raw,index,0)===1;}
function flagsFromList(list){return Object.fromEntries([...new Set(list)].map((key)=>[key,true]));}
function rangeEnd(rawStart, rawLength){return rawStart + rawLength;}

function parseTraits(rawValues, kind) {
  const cols = kind === 'enemy' ? ENEMY_TRAIT_COLUMNS : UNIT_TRAIT_COLUMNS;
  const list = [];
  const sources = [];
  for (const [index, trait] of cols) {
    if (enabled(rawValues, index)) { list.push(trait); sources.push({ index, trait }); }
  }
  return { list: [...new Set(list)], flags: flagsFromList(list), sources };
}

function parseUnitAbilities(rawValues) {
  let abi = 0; const sources = [];
  const set=(bit,index,key)=>{ if(enabled(rawValues,index)){ abi|=bit; sources.push({index,key,bit}); } };
  set(BCU_ABI.AB_GOOD,23,'strong');
  set(BCU_ABI.AB_RESIST,29,'resistant');
  set(BCU_ABI.AB_MASSIVE,30,'massiveDamage');
  set(BCU_ABI.AB_ONLY,32,'targetOnly');
  set(BCU_ABI.AB_METALIC,43,'metallic');
  set(BCU_ABI.AB_WAVES,47,'waveBlocker');
  set(BCU_ABI.AB_ZKILL,52,'zombieKiller');
  set(BCU_ABI.AB_WKILL,53,'witchKiller');
  if (n(rawValues,58,0) === 2) { abi |= BCU_ABI.AB_GLASS; sources.push({ index:58, key:'glass', bit:BCU_ABI.AB_GLASS }); }
  set(BCU_ABI.AB_IMUSW,56,'immuneSurge');
  set(BCU_ABI.AB_EKILL,77,'evaKiller');
  set(BCU_ABI.AB_RESISTS,80,'insanelyTough');
  set(BCU_ABI.AB_MASSIVES,81,'insaneDamage');
  set(BCU_ABI.AB_BAKILL,97,'baronKiller');
  set(BCU_ABI.AB_CKILL,98,'soulstrike');
  set(BCU_ABI.AB_CSUR,109,'counterSurge');
  set(BCU_ABI.AB_SKILL,111,'sageSlayer');
  return { abi, flags: {
    strong:(abi&BCU_ABI.AB_GOOD)!==0, resistant:(abi&BCU_ABI.AB_RESIST)!==0, massiveDamage:(abi&BCU_ABI.AB_MASSIVE)!==0, targetOnly:(abi&BCU_ABI.AB_ONLY)!==0, metallic:(abi&BCU_ABI.AB_METALIC)!==0, zombieKiller:(abi&BCU_ABI.AB_ZKILL)!==0, witchKiller:(abi&BCU_ABI.AB_WKILL)!==0, glass:(abi&BCU_ABI.AB_GLASS)!==0, evaKiller:(abi&BCU_ABI.AB_EKILL)!==0, insanelyTough:(abi&BCU_ABI.AB_RESISTS)!==0, insaneDamage:(abi&BCU_ABI.AB_MASSIVES)!==0, baronKiller:(abi&BCU_ABI.AB_BAKILL)!==0, soulstrike:(abi&BCU_ABI.AB_CKILL)!==0, counterSurge:(abi&BCU_ABI.AB_CSUR)!==0, sageSlayer:(abi&BCU_ABI.AB_SKILL)!==0 }, sources };
}

function parseEnemyAbilities(rawValues) {
  let abi = 0; const sources = [];
  const set=(bit,index,key)=>{ if(enabled(rawValues,index)){ abi|=bit; sources.push({index,key,bit}); } };
  set(BCU_ABI.AB_WAVES,38,'waveBlocker');
  if(n(rawValues,52,0)===2){ abi|=BCU_ABI.AB_GLASS; sources.push({index:52,key:'glass',bit:BCU_ABI.AB_GLASS}); }
  set(BCU_ABI.AB_CSUR,103,'counterSurge');
  return { abi, flags:{ waveBlocker:(abi&BCU_ABI.AB_WAVES)!==0, glass:(abi&BCU_ABI.AB_GLASS)!==0, counterSurge:(abi&BCU_ABI.AB_CSUR)!==0 }, sources };
}

function parseUnitProc(rawValues) {
  const miniWave = rawValues?.length >= 95 && enabled(rawValues,94);
  const miniVolc = rawValues?.length >= 109 && enabled(rawValues,108);
  const volcStart = n(rawValues,87,0)/4;
  const volcLength = n(rawValues,88,0)/4;
  const blastStart = n(rawValues,114,0)/4;
  const blastLength = n(rawValues,115,0)/4;
  return {
    knockback:{prob:n(rawValues,24,0)}, freeze:{prob:n(rawValues,25,0),time:n(rawValues,26,0)}, slow:{prob:n(rawValues,27,0),time:n(rawValues,28,0)}, critical:{prob:n(rawValues,31,0),mult:200}, bounty:{mult:enabled(rawValues,33)?100:0}, baseDestroyer:{mult:enabled(rawValues,34)?300:0},
    wave:{prob:miniWave?0:n(rawValues,35,0),level:miniWave?0:n(rawValues,36,0)}, miniWave:{prob:miniWave?n(rawValues,35,0):0,level:miniWave?n(rawValues,36,0):0,mult:miniWave?20:0},
    weaken:{prob:n(rawValues,37,0),time:n(rawValues,38,0),mult:n(rawValues,39,0)}, strengthen:{health:n(rawValues,40,0),mult:n(rawValues,41,0)}, lethal:{prob:n(rawValues,42,0)},
    barrierBreaker:{prob:n(rawValues,70,0)}, strongAttack:{prob:n(rawValues,82,0),mult:n(rawValues,83,0)}, curse:{prob:n(rawValues,92,0),time:n(rawValues,93,0)}, shieldBreaker:{prob:n(rawValues,95,0)},
    volcano:{prob:miniVolc?0:n(rawValues,86,0),dis0:miniVolc?0:volcStart,dis1:miniVolc?0:rangeEnd(volcStart,volcLength),time:miniVolc?0:n(rawValues,89,0)},
    miniVolcano:{prob:miniVolc?n(rawValues,86,0):0,dis0:miniVolc?volcStart:0,dis1:miniVolc?rangeEnd(volcStart,volcLength):0,time:miniVolc?n(rawValues,89,0):0,mult:miniVolc?20:0},
    metalKiller:{mult:n(rawValues,112,0)}, blast:{prob:n(rawValues,113,0),dis0:blastStart,dis1:rangeEnd(blastStart,blastLength)}
  };
}

function parseEnemyProc(rawValues) {
  const miniWave = rawValues?.length >= 87 && enabled(rawValues,86);
  const miniVolc = rawValues?.length >= 103 && enabled(rawValues,102);
  const volcStart = n(rawValues,82,0)/4;
  const volcLength = n(rawValues,83,0)/4;
  const deathSurgeStart = n(rawValues,90,0)/4;
  const deathSurgeLength = n(rawValues,91,0)/4;
  const blastStart = n(rawValues,107,0)/4;
  const blastLength = n(rawValues,108,0)/4;
  return {
    knockback:{prob:n(rawValues,20,0)}, freeze:{prob:n(rawValues,21,0),time:n(rawValues,22,0)}, slow:{prob:n(rawValues,23,0),time:n(rawValues,24,0)}, critical:{prob:n(rawValues,25,0),mult:200}, baseDestroyer:{mult:enabled(rawValues,26)?300:0},
    wave:{prob:miniWave?0:n(rawValues,27,0),level:miniWave?0:n(rawValues,28,0)}, miniWave:{prob:miniWave?n(rawValues,27,0):0,level:miniWave?n(rawValues,28,0):0,mult:miniWave?20:0},
    weaken:{prob:n(rawValues,29,0),time:n(rawValues,30,0),mult:n(rawValues,31,0)}, strengthen:{health:n(rawValues,32,0),mult:n(rawValues,33,0)}, lethal:{prob:n(rawValues,34,0)},
    burrow:{count:n(rawValues,43,0),dis:n(rawValues,44,0)/4}, revive:{count:n(rawValues,45,0),time:n(rawValues,46,0),health:n(rawValues,47,0)}, barrier:{health:n(rawValues,64,0)},
    warp:{prob:n(rawValues,65,0),time:n(rawValues,66,0),dis0:n(rawValues,67,0)/4,dis1:n(rawValues,68,0)/4}, curse:{prob:n(rawValues,73,0),time:n(rawValues,74,0)}, strongAttack:{prob:n(rawValues,75,0),mult:n(rawValues,76,0)}, toxic:{prob:n(rawValues,79,0),mult:n(rawValues,80,0)},
    volcano:{prob:miniVolc?0:n(rawValues,81,0),dis0:miniVolc?0:volcStart,dis1:miniVolc?0:rangeEnd(volcStart,volcLength),time:miniVolc?0:n(rawValues,84,0)},
    miniVolcano:{prob:miniVolc?n(rawValues,81,0):0,dis0:miniVolc?volcStart:0,dis1:miniVolc?rangeEnd(volcStart,volcLength):0,time:miniVolc?n(rawValues,84,0):0,mult:miniVolc?20:0},
    demonShield:{hp:n(rawValues,87,0),regen:n(rawValues,88,0)}, deathSurge:{prob:n(rawValues,89,0),dis0:deathSurgeStart,dis1:rangeEnd(deathSurgeStart,deathSurgeLength),time:n(rawValues,92,0)},
    blast:{prob:n(rawValues,106,0),dis0:blastStart,dis1:rangeEnd(blastStart,blastLength)}, delay:{prob:n(rawValues,111,0),strength:n(rawValues,112,0)}
  };
}

export class BcuCombatModel {
  static parseStats({ rawValues = [], kind = 'unknown' } = {}) {
    const statsKind = kind === 'enemy' ? 'enemy' : 'unit';
    const traits = parseTraits(rawValues, statsKind);
    const ability = statsKind === 'enemy' ? parseEnemyAbilities(rawValues) : parseUnitAbilities(rawValues);
    const proc = statsKind === 'enemy' ? parseEnemyProc(rawValues) : parseUnitProc(rawValues);
    return { version: BCU_COMBAT_MODEL_VERSION, kind: statsKind, traits, targetTraits: statsKind === 'unit' ? traits : null, ability, proc, source: statsKind === 'enemy' ? 'BCU DataEnemy.fillData' : 'BCU DataUnit.constructor', notes: ['BCU CSV columns mapped from DataEnemy/DataUnit; stage save-state treasure/combo/orb values require a full BCU Basis model'] };
  }
  static hasAbi(model, bit) { return ((Number(model?.ability?.abi)||0)&bit)!==0; }
}
