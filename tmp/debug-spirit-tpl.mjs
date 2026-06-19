import { launch, newApp, startBattle } from './visual-harness.mjs';
const browser = await launch();
const { page } = await newApp(browser, {});
await startBattle(page);
const r = await page.evaluate(async () => {
  const scene = globalThis.__APP__?.battleScene;
  const out = {};
  // A: resolveUnitAsset for 729
  out.asset729 = scene.bcuDb?.assets?.resolveUnitAsset?.(729, 'f') || null;
  // B: build spirit def via runtime resolver from a fake summoner
  const rt = await import('/js/battle/bcu-runtime/BcuSpiritLifecycleRuntime.js');
  const fakeSummoner = { side:'dog-player', direction:-1, facing:-1, bcuCombatModel:{ proc:{ spirit:{ id:729, exists:true } } } };
  const def = rt.resolveBcuSpiritUnitDef(scene, 'x', fakeSummoner);
  out.spiritDef = def ? { slotId:def.slotId, assetId:def.assetId, statsType:def.statsType, statsId:def.statsId, hasAssetDef:!!def.assetDef, assetDefKeys: def.assetDef?Object.keys(def.assetDef):null } : null;
  // C: try preloadTemplate and capture error
  try { await scene.actorFactory.preloadTemplate(def, { level: 'spawn-ready' }); const tpl = scene.actorFactory.templates.get(def.slotId); out.preload = { ok:true, level: tpl?.loadingLevel, hasStats: !!tpl?.stats, hasModel: !!tpl?.model }; }
  catch(e){ out.preload = { ok:false, err: String(e?.message||e), stack: String(e?.stack||'').split('\n').slice(0,3) }; }
  // D: compare with building 729 as a normal cat unit production def
  const cfg = await import('/js/battle/BattleConfig.js');
  const cat729 = (cfg.BATTLE_CONFIG.rosters.catUnits||[]).find(u=>Number(u.statsId)===729);
  out.cat729InRoster = cat729 ? { slotId:cat729.slotId } : null;
  if (cat729) { const pd={...cat729,...(cat729.productionOverrides||{}),slotId:'norm-729',isProductionUnit:true}; try{ await scene.actorFactory.preloadTemplate(pd,{level:2}); const t=scene.actorFactory.templates.get('norm-729'); out.normPreload={ok:true,level:t?.loadingLevel}; }catch(e){ out.normPreload={ok:false,err:String(e?.message||e)}; } }
  return out;
});
console.log(JSON.stringify(r, null, 1));
await browser.close();
