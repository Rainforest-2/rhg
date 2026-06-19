// Spirit visual review (fixed): deploy conjurer, explicitly preload the resolved
// spirit form template and wait until it's SPAWN_READY, then tap to summon the spirit
// and capture it. Yields to the event loop between checks so async fetches resolve.
import { launch, newApp, startBattle } from './visual-harness.mjs';

const OUT = 'tmp/visual-shots';
const log = (...a) => console.log('[spirit2]', ...a);

const browser = await launch();
let captured = null;

for (const conjurerId of [728, 731, 738]) {
  const { page, errors } = await newApp(browser, {});
  await startBattle(page);

  const setup = await page.evaluate(async (cid) => {
    const scene = globalThis.__APP__?.battleScene;
    const cfg = await import('/js/battle/BattleConfig.js');
    const cat = (cfg.BATTLE_CONFIG.rosters.catUnits || []).find((u) => Number(u.statsId) === cid);
    if (!cat) return { ok: false, reason: 'no-cat' };
    const prod = { ...cat, ...(cat.productionOverrides || {}), slotId: `spirit-conj-${cid}`, isProductionUnit: true, productionSide: 'player', cost: 0, cooldownMs: 0 };
    scene.playerProductionRoster[0] = prod;
    await scene.preloadProductionRoster([prod]);
    if (scene.economy) { scene.economy.money = 999999; scene.economy.internalMoney = 99999900; }
    const deployed = scene.requestPlayerSpawn(`spirit-conj-${cid}`);
    // resolve + warm the spirit form template now
    const rt = await import('/js/battle/bcu-runtime/BcuSpiritLifecycleRuntime.js');
    const factoryMod = await import('/js/battle/BattleActorFactory.js');
    const summoner = (scene.actors || []).find((a) => /spirit-conj-/.test(String(a.slotId)));
    const spiritDef = summoner ? rt.resolveBcuSpiritUnitDef(scene, `spirit-conj-${cid}`, summoner) : null;
    if (spiritDef) { scene.bcuSpiritUnitDefs = scene.bcuSpiritUnitDefs || new Map(); scene.bcuSpiritUnitDefs.set(`spirit-conj-${cid}`, spiritDef); await scene.actorFactory.preloadTemplate(spiritDef, { level: factoryMod.TEMPLATE_LOAD_LEVEL.SPAWN_READY }).catch(() => {}); }
    return { ok: true, deployed, slotId: `spirit-conj-${cid}`, spiritSlot: spiritDef?.slotId || null, spiritStatsId: spiritDef?.statsId || null };
  }, conjurerId);
  log(conjurerId, 'setup', JSON.stringify(setup));
  if (!setup.ok) { await page.close(); continue; }

  // wait until the spirit template is ready (real waits so the fetch resolves)
  let ready = false;
  for (let i = 0; i < 40 && !ready; i += 1) {
    ready = await page.evaluate((slot) => {
      const scene = globalThis.__APP__?.battleScene;
      const tpl = scene.actorFactory.templates.get(slot);
      return !!tpl && (tpl.loadingLevel === 'spawn-ready' || tpl.loadingLevel === 'full-visual');
    }, setup.spiritSlot);
    if (!ready) await page.waitForTimeout(400);
  }
  log(conjurerId, 'spirit template ready:', ready);

  // tap to summon the spirit
  let seen = null;
  const end = Date.now() + 20000;
  while (Date.now() < end && !seen) {
    await page.evaluate((slot) => { globalThis.__APP__.battleScene.requestPlayerSpawn(slot); }, setup.slotId);
    const st = await page.evaluate(() => {
      const scene = globalThis.__APP__?.battleScene;
      const spirits = (scene.actors || []).filter((a) => a.bcuIsSpirit === true);
      return { spirits: spirits.map((s) => ({ id: s.instanceId, x: Math.round(s.x), st: s.state })), state: scene.battleState };
    });
    if (st.spirits.length) {
      seen = st;
      await page.screenshot({ path: `${OUT}/spirit-${conjurerId}.png` });
      await page.screenshot({ path: `${OUT}/spirit-${conjurerId}-zoom.png`, clip: { x: 250, y: 280, width: 620, height: 420 } });
      log(conjurerId, 'SPIRIT CAPTURED', JSON.stringify(st.spirits));
    }
    if (st.state !== 'running') break;
    await page.waitForTimeout(250);
  }
  if (seen) { captured = conjurerId; await page.close(); break; }
  log(conjurerId, 'no spirit');
  await page.close();
}

console.log('SPIRIT RESULT:', captured ? `captured with conjurer ${captured}` : 'none');
await browser.close();
