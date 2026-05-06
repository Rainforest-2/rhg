import { BattleScene } from './BattleScene.js';
import { TEMPLATE_LOAD_LEVEL } from './BattleActorFactory.js';
import { BATTLE_CONFIG } from './BattleConfig.js';

function createScene(){
  globalThis.performance = globalThis.performance || { now: () => Date.now() };
  globalThis.Image = globalThis.Image || class { set src(_v){ setTimeout(()=>this.onload?.(),0); } };
  return new BattleScene(()=>{});
}

function stubLocalStorage(slots=['dog-wanko','dog-nyoro','dog-rei','cat-basic','cat-tank']){
  const store=new Map();
  store.set('battleCatsFormationV1', JSON.stringify({version:1,slots}));
  globalThis.localStorage = {
    getItem:(k)=>store.has(k)?store.get(k):null,
    setItem:(k,v)=>store.set(k,String(v)),
    removeItem:(k)=>store.delete(k)
  };
}

export async function verifyBattleStartsWithoutAutoPlayerSpawn(){
  stubLocalStorage();
  const scene=createScene();
  await scene.init();
  const playerActors=scene.actors.filter((a)=>a.side==='dog-player');
  const playerSpawnedEvents=scene.debugEvents.filter((e)=>e.type==='playerSpawned');
  const roster=scene.getPlayerProductionRoster();
  const status=scene.getPlayerRosterStatus();
  const errors=[];
  if(playerActors.length!==0)errors.push(`expected 0 player actors, got ${playerActors.length}`);
  if(playerSpawnedEvents.length!==0)errors.push(`unexpected playerSpawned events: ${playerSpawnedEvents.length}`);
  if(roster.length!==5)errors.push(`expected roster length 5, got ${roster.length}`);
  if(status.length!==5)errors.push(`expected roster status length 5, got ${status.length}`);
  return { ok: errors.length===0, errors };
}

export async function verifyEnemySpawnComesOnlyFromSchedule(){
  const scene=createScene();
  await scene.init();
  const scheduleIds=new Set((BATTLE_CONFIG.enemySpawnSchedule||[]).map((s)=>s.slotId));
  const initialEnemyActors=scene.actors.filter((a)=>a.side==='cat-enemy');
  const errors=[];
  if(initialEnemyActors.length!==0)errors.push('enemy actor spawned during init');
  scene.tick(1000);
  const enemySpawnedEvents=scene.debugEvents.filter((e)=>e.type==='enemySpawned'||e.type==='stageEnemySpawned');
  const seen=new Set();
  for(const ev of enemySpawnedEvents){
    if(ev.type==='enemySpawned' && !scheduleIds.has(ev.slotId))errors.push(`enemySpawned slotId not in schedule: ${ev.slotId}`);
    const key=`${ev.timeMs}:${ev.slotId}`;
    if(seen.has(key))errors.push(`duplicate enemy spawn event at ${key}`);
    seen.add(key);
  }
  return { ok: errors.length===0, errors };
}

export async function verifyNoInitialEconomyConsumption(){
  const scene=createScene();
  await scene.init();
  const startMoney=BATTLE_CONFIG.economy.dogPlayer.startMoney;
  const errors=[];
  if(scene.economy.money!==startMoney)errors.push(`money changed on init: ${scene.economy.money}`);
  if(scene.debugEvents.some((e)=>e.type==='playerSpawned'))errors.push('playerSpawned emitted during init');
  const slotId=scene.getPlayerProductionRoster().find(Boolean)?.slotId;
  if(slotId){
    const def=scene.findPlayerProductionUnit(slotId);
    await scene.actorFactory.preloadTemplate(def,{level:TEMPLATE_LOAD_LEVEL.RENDER_CORE,animIds:[def.idleAnimId,def.moveAnimId].filter(Boolean)});
    const before=scene.economy.money;
    const ok=scene.requestPlayerSpawn(slotId);
    if(!ok)errors.push('requestPlayerSpawn failed for first slot');
    if(scene.economy.money>=before)errors.push('money did not decrease after player spawn request');
  }
  return { ok: errors.length===0, errors };
}

export async function verifyInitialPreloadDoesNotRequirePlayerRenderCore(){
  const scene=createScene();
  await scene.init();
  const required=scene.getRequiredInitialTemplateDefs();
  const playerSlots=new Set(scene.getPlayerProductionRoster().filter(Boolean).map((u)=>u.slotId));
  const requiredSlots=new Set(required.map((u)=>u.slotId));
  const scheduleSlots=new Set((BATTLE_CONFIG.enemySpawnSchedule||[]).map((s)=>s.slotId));
  const errors=[];
  for(const slotId of playerSlots){
    if(!requiredSlots.has(slotId))errors.push(`player roster slot missing from preload requirements: ${slotId}`);
  }
  if(required.some((u)=>u.side==='dog-player'&&!playerSlots.has(u.slotId)))errors.push('unexpected extra dog-player preload unit found');
  for(const slotId of requiredSlots){
    if(!playerSlots.has(slotId)&&!scheduleSlots.has(slotId))errors.push(`preload includes non-schedule non-player slot: ${slotId}`);
  }
  return { ok: errors.length===0, errors };
}
