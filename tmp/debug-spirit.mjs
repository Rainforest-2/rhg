import { launch, newApp, startBattle } from './visual-harness.mjs';
const browser = await launch();
const { page, errors } = await newApp(browser, {});
await startBattle(page);

// 1) does the runtime unit model for conjurers carry spirit?
const models = await page.evaluate(async () => {
  const scene = globalThis.__APP__?.battleScene;
  const out = [];
  for (const id of [728, 731, 738, 754, 774]) {
    try { const s = await scene.statsLoader.loadUnitStats(id, 'f', 0); out.push({ id, spirit: s?.bcuCombatModel?.proc?.spirit || null }); }
    catch (e) { out.push({ id, err: String(e?.message || e) }); }
  }
  return out;
});
console.log('UNIT SPIRIT MODELS:', JSON.stringify(models));

// 2) deploy conjurer 728 and trace the flow
const trace = await page.evaluate(async () => {
  const scene = globalThis.__APP__?.battleScene;
  const cfg = await import('/js/battle/BattleConfig.js');
  const cat = (cfg.BATTLE_CONFIG.rosters.catUnits || []).find((u) => Number(u.statsId) === 728);
  if (!cat) return { error: 'no-cat-728', sample: (cfg.BATTLE_CONFIG.rosters.catUnits || []).slice(0, 3).map((u) => ({ slotId: u.slotId, statsId: u.statsId })) };
  const prod = { ...cat, ...(cat.productionOverrides || {}), slotId: 'spirit-conj-728', isProductionUnit: true, productionSide: 'player', cost: 0, cooldownMs: 0 };
  scene.playerProductionRoster[0] = prod;
  await scene.preloadProductionRoster([prod]);
  if (scene.economy) { scene.economy.money = 999999; scene.economy.internalMoney = 99999900; }
  const tpl = scene.actorFactory.templates.get('spirit-conj-728');
  const deployRes = scene.requestPlayerSpawn('spirit-conj-728');
  const summoner = (scene.actors || []).find((a) => /spirit-conj-728/.test(String(a.slotId)));
  const spec = summoner ? (await import('/js/battle/bcu-runtime/BcuSpiritLifecycleRuntime.js')).getBcuSpiritSpec(summoner) : null;
  return {
    catFound: { slotId: cat.slotId, statsId: cat.statsId, statsType: cat.statsType },
    tplLevel: tpl?.loadingLevel || null,
    deployRes,
    summonerExists: !!summoner,
    summonerModelSpirit: summoner?.bcuCombatModel?.proc?.spirit || null,
    spiritSpec: spec,
    stateKeys: scene.bcuSpiritState ? [...scene.bcuSpiritState.keys()] : null,
  };
});
console.log('DEPLOY TRACE:', JSON.stringify(trace, null, 1));

// 3) tap a few times and see spirit request results
await page.waitForTimeout(1000);
const taps = await page.evaluate(async () => {
  const scene = globalThis.__APP__?.battleScene;
  const rt = await import('/js/battle/bcu-runtime/BcuSpiritLifecycleRuntime.js');
  const out = [];
  for (let i = 0; i < 25; i += 1) {
    const r = rt.requestBcuSpiritSpawn(scene, 'spirit-conj-728');
    out.push(r.reason || (r.ok ? 'OK' : 'unknown'));
    // advance time
    for (let f = 0; f < 5; f += 1) scene.tick?.(1000 / 30);
  }
  const spirits = (scene.actors || []).filter((a) => a.bcuIsSpirit).length;
  return { taps: out, spirits, state: scene.bcuSpiritState ? [...scene.bcuSpiritState.entries()].map(([k, v]) => ({ k, cd: v.cooldownFrames, summonerSummoned: v.summonerSummoned, spiritSummoned: v.spiritSummoned })) : null };
});
console.log('TAPS:', JSON.stringify(taps, null, 1));
console.log('errors:', JSON.stringify(errors.slice(0, 6)));
await browser.close();
