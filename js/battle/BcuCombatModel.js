export const BCU_COMBAT_MODEL_VERSION = 'bcu-combat-v4-immunity-guards';

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
export const BCU_PROC_KB_DEFAULT = Object.freeze({ dis: 165, time: 11 });

export const BCU_PROC_IMMUNITY_FIELDS = Object.freeze({
  knockbackProc: 'IMUKB',
  freeze: 'IMUSTOP',
  slow: 'IMUSLOW',
  weaken: 'IMUWEAK',
  curse: 'IMUCURSE',
  warp: 'IMUWARP',
  toxic: 'IMUPOIATK',
  summon: 'IMUSUMMON',
  wave: 'IMUWAVE',
  miniWave: 'IMUWAVE',
  surge: 'IMUVOLC',
  miniSurge: 'IMUVOLC',
  blast: 'IMUBLAST'
});

export const BCU_DAMAGE_GUARD_FIELDS = Object.freeze({
  wave: 'IMUWAVE',
  miniWave: 'IMUWAVE',
  surge: 'IMUVOLC',
  miniSurge: 'IMUVOLC',
  volcano: 'IMUVOLC',
  miniVolcano: 'IMUVOLC',
  blast: 'IMUBLAST',
  toxic: 'IMUPOIATK'
});

function n(raw,index,fallback=0){const v=Number(raw?.[index]);return Number.isFinite(v)?v:fallback;}
function enabled(raw,index){return n(raw,index,0)===1;}
function flagsFromList(list){return Object.fromEntries([...new Set(list)].map((key)=>[key,true]));}
function rangeEnd(rawStart, rawLength){return rawStart + rawLength;}
function surgeFramesFromLevel(level){const lv=Math.max(0,Math.trunc(Number(level)||0));return lv*20;}
function volcanoProc({prob=0,dis0=0,dis1=0,level=0,mult=0}={}){const lv=Math.max(0,Math.trunc(Number(level)||0));return {prob,dis0,dis1,level:lv,time:lv,timeFrames:surgeFramesFromLevel(lv),aliveTimeFrames:surgeFramesFromLevel(lv),mult};}
function imu(mult=0, extra={}){const m=Math.max(0,Math.min(100,Math.trunc(Number(mult)||0)));return {mult:m,block:m,full:m>=100,partial:m>0&&m<100,...extra};}
function fullImu(raw,index,extra={}){return imu(enabled(raw,index)?100:0,{index,...extra});}
// BCU DataUnit.fillData ints[116] / DataEnemy.fillData ints[109] gate IMUBLAST with `!= 0`, unlike the `== 1` IMU columns.
function fullImuNonZero(raw,index,extra={}){return imu(n(raw,index,0)!==0?100:0,{index,...extra});}

function buildImmunity(proc = {}) {
  const out = {};
  for (const [key, field] of Object.entries(BCU_PROC_IMMUNITY_FIELDS)) {
    const mult = Number(proc?.[field]?.mult ?? proc?.[field]?.block ?? 0);
    const m = Number.isFinite(mult) ? Math.max(0, Math.min(100, Math.trunc(mult))) : 0;
    out[key] = { field, mult: m, full: m >= 100, partial: m > 0 && m < 100, damageMultiplier: Math.max(0, (100 - m) / 100) };
  }
  return out;
}

function buildResistance(proc = {}) {
  return Object.fromEntries(Object.entries(buildImmunity(proc)).filter(([, value]) => value.partial));
}

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
  set(BCU_ABI.AB_IMUSW,56,'bossShockwaveImmune');
  set(BCU_ABI.AB_EKILL,77,'evaKiller');
  set(BCU_ABI.AB_RESISTS,80,'insanelyTough');
  set(BCU_ABI.AB_MASSIVES,81,'insaneDamage');
  set(BCU_ABI.AB_BAKILL,97,'baronKiller');
  set(BCU_ABI.AB_CKILL,98,'soulstrike');
  set(BCU_ABI.AB_CSUR,109,'counterSurge');
  set(BCU_ABI.AB_SKILL,111,'sageSlayer');
  return { abi, flags: {
    strong:(abi&BCU_ABI.AB_GOOD)!==0, resistant:(abi&BCU_ABI.AB_RESIST)!==0, massiveDamage:(abi&BCU_ABI.AB_MASSIVE)!==0, targetOnly:(abi&BCU_ABI.AB_ONLY)!==0, metallic:(abi&BCU_ABI.AB_METALIC)!==0, waveBlocker:(abi&BCU_ABI.AB_WAVES)!==0, zombieKiller:(abi&BCU_ABI.AB_ZKILL)!==0, witchKiller:(abi&BCU_ABI.AB_WKILL)!==0, glass:(abi&BCU_ABI.AB_GLASS)!==0, bossShockwaveImmune:(abi&BCU_ABI.AB_IMUSW)!==0, evaKiller:(abi&BCU_ABI.AB_EKILL)!==0, insanelyTough:(abi&BCU_ABI.AB_RESISTS)!==0, insaneDamage:(abi&BCU_ABI.AB_MASSIVES)!==0, baronKiller:(abi&BCU_ABI.AB_BAKILL)!==0, soulstrike:(abi&BCU_ABI.AB_CKILL)!==0, counterSurge:(abi&BCU_ABI.AB_CSUR)!==0, sageSlayer:(abi&BCU_ABI.AB_SKILL)!==0 }, sources };
}

function parseEnemyAbilities(rawValues) {
  let abi = 0; const sources = [];
  const set=(bit,index,key)=>{ if(enabled(rawValues,index)){ abi|=bit; sources.push({index,key,bit}); } };
  set(BCU_ABI.AB_WAVES,38,'waveBlocker');
  if(n(rawValues,52,0)===2){ abi|=BCU_ABI.AB_GLASS; sources.push({index:52,key:'glass',bit:BCU_ABI.AB_GLASS}); }
  set(BCU_ABI.AB_CSUR,103,'counterSurge');
  return { abi, flags:{ waveBlocker:(abi&BCU_ABI.AB_WAVES)!==0, glass:(abi&BCU_ABI.AB_GLASS)!==0, counterSurge:(abi&BCU_ABI.AB_CSUR)!==0 }, sources };
}

function parseDeathAnimation(rawValues, kind) {
  if (kind === 'enemy') {
    const rawSoulId = Math.trunc(n(rawValues, 54, 0));
    const demonFallbackFlag = n(rawValues, 63, 0);
    const fallbackApplied = rawSoulId === -1 && demonFallbackFlag === 1;
    return {
      soulId: fallbackApplied ? 9 : rawSoulId,
      rawSoulId,
      source: 'DataEnemy.ints[54]',
      fallbackApplied,
      fallbackSource: fallbackApplied ? 'DataEnemy.ints[54] == -1 && ints[63] == 1 -> Soul 9' : null,
      bcuReference: 'BCU DataEnemy.fillData: death=Identifier.parseInt(ints[54], Soul.class); if ints[54] == -1 && ints[63] == 1 death=Soul 9'
    };
  }
  const hasExtendedColumns = Array.isArray(rawValues) && rawValues.length >= 68;
  const rawSoulId = hasExtendedColumns ? Math.trunc(n(rawValues, 67, 0)) : 0;
  return {
    soulId: rawSoulId,
    rawSoulId,
    source: hasExtendedColumns ? 'DataUnit.ints[67]' : 'DataUnit legacy fallback Soul 0 when ints.length < 68',
    fallbackApplied: !hasExtendedColumns,
    fallbackSource: !hasExtendedColumns ? 'DataUnit.ints.length < 68 -> Soul 0' : null,
    bcuReference: 'BCU DataUnit constructor: if ints.length < 68 death=Soul 0; otherwise death=Identifier.parseInt(ints[67], Soul.class)'
  };
}

function parseUnitProc(rawValues) {
  const miniWave = rawValues?.length >= 95 && enabled(rawValues,94);
  const miniVolc = rawValues?.length >= 109 && enabled(rawValues,108);
  const volcStart = n(rawValues,87,0)/4;
  const volcLength = n(rawValues,88,0)/4;
  const volcLevel = n(rawValues,89,0);
  const blastStart = n(rawValues,114,0)/4;
  const blastLength = n(rawValues,115,0)/4;
  const spiritRaw = n(rawValues, 110, -1);
  return {
    knockback:{prob:n(rawValues,24,0),dis:BCU_PROC_KB_DEFAULT.dis,time:BCU_PROC_KB_DEFAULT.time}, freeze:{prob:n(rawValues,25,0),time:n(rawValues,26,0)}, slow:{prob:n(rawValues,27,0),time:n(rawValues,28,0)}, critical:{prob:n(rawValues,31,0),mult:200}, bounty:{mult:enabled(rawValues,33)?100:0}, baseDestroyer:{mult:enabled(rawValues,34)?300:0},
    wave:{prob:miniWave?0:n(rawValues,35,0),level:miniWave?0:n(rawValues,36,0)}, miniWave:{prob:miniWave?n(rawValues,35,0):0,level:miniWave?n(rawValues,36,0):0,mult:miniWave?20:0}, IMUWAVE:fullImu(rawValues,46,{source:'DataUnit.ints[46]'}),
    weaken:{prob:n(rawValues,37,0),time:n(rawValues,38,0),mult:n(rawValues,39,0)}, strengthen:{health:n(rawValues,40,0),mult:n(rawValues,41,0)}, lethal:{prob:n(rawValues,42,0)},
    IMUKB:fullImu(rawValues,48,{source:'DataUnit.ints[48]'}), IMUSTOP:fullImu(rawValues,49,{source:'DataUnit.ints[49]'}), IMUSLOW:fullImu(rawValues,50,{source:'DataUnit.ints[50]'}), IMUWEAK:fullImu(rawValues,51,{source:'DataUnit.ints[51]',smartImu:0}),
    IMUWARP:fullImu(rawValues,75,{source:'DataUnit.ints[75]'}), IMUCURSE:fullImu(rawValues,79,{source:'DataUnit.ints[79]'}), IMUPOIATK:fullImu(rawValues,90,{source:'DataUnit.ints[90]'}), IMUVOLC:fullImu(rawValues,91,{source:'DataUnit.ints[91]'}), IMUBLAST:fullImuNonZero(rawValues,116,{source:'DataUnit.ints[116] != 0'}),
    attackNullify:{prob:n(rawValues,84,0),time:n(rawValues,85,0)}, IMUATK:{prob:n(rawValues,84,0),time:n(rawValues,85,0)},
    barrierBreaker:{prob:n(rawValues,70,0)}, strongAttack:{prob:n(rawValues,82,0),mult:n(rawValues,83,0)}, curse:{prob:n(rawValues,92,0),time:n(rawValues,93,0)}, shieldBreaker:{prob:n(rawValues,95,0)},
    volcano:volcanoProc({prob:miniVolc?0:n(rawValues,86,0),dis0:miniVolc?0:volcStart,dis1:miniVolc?0:rangeEnd(volcStart,volcLength),level:miniVolc?0:volcLevel}),
    miniVolcano:volcanoProc({prob:miniVolc?n(rawValues,86,0):0,dis0:miniVolc?volcStart:0,dis1:miniVolc?rangeEnd(volcStart,volcLength):0,level:miniVolc?volcLevel:0,mult:miniVolc?20:0}),
    beastHunter:{active:enabled(rawValues,105)?1:0,prob:n(rawValues,106,0),time:n(rawValues,107,0)}, bsthunt:{active:enabled(rawValues,105)?1:0,prob:n(rawValues,106,0),time:n(rawValues,107,0)}, BSTHUNT:{active:enabled(rawValues,105)?1:0,prob:n(rawValues,106,0),time:n(rawValues,107,0)},
    spirit:{id:spiritRaw>=0?Math.trunc(spiritRaw):null,exists:spiritRaw>=0,source:'DataUnit.ints[110]'},
    metalKiller:{mult:n(rawValues,112,0)}, blast:{prob:n(rawValues,113,0),dis0:blastStart,dis1:rangeEnd(blastStart,blastLength)}
  };
}

function parseEnemyProc(rawValues) {
  const miniWave = rawValues?.length >= 87 && enabled(rawValues,86);
  const miniVolc = rawValues?.length >= 103 && enabled(rawValues,102);
  const volcStart = n(rawValues,82,0)/4;
  const volcLength = n(rawValues,83,0)/4;
  const volcLevel = n(rawValues,84,0);
  const deathSurgeStart = n(rawValues,90,0)/4;
  const deathSurgeLength = n(rawValues,91,0)/4;
  const deathSurgeLevel = n(rawValues,92,0);
  const blastStart = n(rawValues,107,0)/4;
  const blastLength = n(rawValues,108,0)/4;
  return {
    knockback:{prob:n(rawValues,20,0),dis:BCU_PROC_KB_DEFAULT.dis,time:BCU_PROC_KB_DEFAULT.time}, freeze:{prob:n(rawValues,21,0),time:n(rawValues,22,0)}, slow:{prob:n(rawValues,23,0),time:n(rawValues,24,0)}, critical:{prob:n(rawValues,25,0),mult:200}, baseDestroyer:{mult:enabled(rawValues,26)?300:0},
    wave:{prob:miniWave?0:n(rawValues,27,0),level:miniWave?0:n(rawValues,28,0)}, miniWave:{prob:miniWave?n(rawValues,27,0):0,level:miniWave?n(rawValues,28,0):0,mult:miniWave?20:0}, IMUWAVE:fullImu(rawValues,37,{source:'DataEnemy.ints[37]'}),
    weaken:{prob:n(rawValues,29,0),time:n(rawValues,30,0),mult:n(rawValues,31,0)}, strengthen:{health:n(rawValues,32,0),mult:n(rawValues,33,0)}, lethal:{prob:n(rawValues,34,0)},
    IMUKB:fullImu(rawValues,39,{source:'DataEnemy.ints[39]'}), IMUSTOP:fullImu(rawValues,40,{source:'DataEnemy.ints[40]'}), IMUSLOW:fullImu(rawValues,41,{source:'DataEnemy.ints[41]'}), IMUWEAK:fullImu(rawValues,42,{source:'DataEnemy.ints[42]',smartImu:0}),
    IMUWARP:fullImu(rawValues,70,{source:'DataEnemy.ints[70]'}), IMUVOLC:fullImu(rawValues,85,{source:'DataEnemy.ints[85]'}), IMUCURSE:fullImu(rawValues,105,{source:'DataEnemy.ints[105]'}), IMUBLAST:fullImuNonZero(rawValues,109,{source:'DataEnemy.ints[109] != 0'}), IMUPOIATK:imu(0,{source:'DataEnemy has POIATK attack columns but no confirmed IMUPOIATK raw column in DataEnemy.fillData'}),
    burrow:{count:n(rawValues,43,0),dis:n(rawValues,44,0)/4}, revive:{count:n(rawValues,45,0),time:n(rawValues,46,0),health:n(rawValues,47,0)}, barrier:{health:n(rawValues,64,0)},
    warp:{prob:n(rawValues,65,0),time:n(rawValues,66,0),dis0:n(rawValues,67,0)/4,dis1:n(rawValues,68,0)/4}, curse:{prob:n(rawValues,73,0),time:n(rawValues,74,0)}, strongAttack:{prob:n(rawValues,75,0),mult:n(rawValues,76,0)}, attackNullify:{prob:n(rawValues,77,0),time:n(rawValues,78,0)}, IMUATK:{prob:n(rawValues,77,0),time:n(rawValues,78,0)}, toxic:{prob:n(rawValues,79,0),mult:n(rawValues,80,0)},
    volcano:volcanoProc({prob:miniVolc?0:n(rawValues,81,0),dis0:miniVolc?0:volcStart,dis1:miniVolc?0:rangeEnd(volcStart,volcLength),level:miniVolc?0:volcLevel}),
    miniVolcano:volcanoProc({prob:miniVolc?n(rawValues,81,0):0,dis0:miniVolc?volcStart:0,dis1:miniVolc?rangeEnd(volcStart,volcLength):0,level:miniVolc?volcLevel:0,mult:miniVolc?20:0}),
    demonShield:{hp:n(rawValues,87,0),regen:n(rawValues,88,0)}, deathSurge:volcanoProc({prob:n(rawValues,89,0),dis0:deathSurgeStart,dis1:rangeEnd(deathSurgeStart,deathSurgeLength),level:deathSurgeLevel}),
    blast:{prob:n(rawValues,106,0),dis0:blastStart,dis1:rangeEnd(blastStart,blastLength)}, delay:{prob:n(rawValues,111,0),strength:n(rawValues,112,0)}
  };
}

export class BcuCombatModel {
  static parseStats({ rawValues = [], kind = 'unknown' } = {}) {
    const statsKind = kind === 'enemy' ? 'enemy' : 'unit';
    const traits = parseTraits(rawValues, statsKind);
    const ability = statsKind === 'enemy' ? parseEnemyAbilities(rawValues) : parseUnitAbilities(rawValues);
    const proc = statsKind === 'enemy' ? parseEnemyProc(rawValues) : parseUnitProc(rawValues);
    const deathAnimation = parseDeathAnimation(rawValues, statsKind);
    const immunity = buildImmunity(proc);
    const resistance = buildResistance(proc);
    return { version: BCU_COMBAT_MODEL_VERSION, kind: statsKind, traits, targetTraits: statsKind === 'unit' ? traits : null, ability, proc, deathAnimation, immunity, resistance, source: statsKind === 'enemy' ? 'BCU DataEnemy.fillData' : 'BCU DataUnit.constructor', notes: ['BCU DataUnit/DataEnemy trait, ability, proc, death animation, and full IMU* columns mapped', 'Surge/death-surge time columns are exposed as level and aliveTimeFrames=level*20 for Battle Cats level compatibility', 'Partial/smart immunity is represented when present on proc fields but CSV full-immunity flags parse as mult=100'] };
  }
  static hasAbi(model, bit) { return ((Number(model?.ability?.abi)||0)&bit)!==0; }
}
