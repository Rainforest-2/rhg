// Spirit lifecycle + mini-death-surge visual review.
//  SPIRIT: inject a real conjurer cat unit (728 -> spirit form 729) into the player
//   production roster, deploy it, then tap its card to summon the spirit and capture it.
//  MINI-DEATH-SURGE: deploy a unit, inject the proven miniDeathSurge proc holder, kill
//   it, and capture the demon-soul + mini surge death effect.
import { launch, newApp, startBattle, produceLoop } from './visual-harness.mjs';

const OUT = 'tmp/visual-shots';
const log = (...a) => console.log('[ss]', ...a);

const browser = await launch();
const results = {};

// ---------------- SPIRIT ----------------
for (const conjurerId of [728, 731, 738, 754, 774]) {
  const { page, errors } = await newApp(browser, {});
  await startBattle(page);
  const setup = await page.evaluate(async (cid) => {
    const scene = globalThis.__APP__?.battleScene;
    const cfg = await import('/js/battle/BattleConfig.js');
    const cat = (cfg.BATTLE_CONFIG.rosters.catUnits || []).find((u) => Number(u.statsId) === cid);
    if (!cat) return { ok: false, reason: 'conjurer-not-in-roster' };
    const prod = { ...cat, ...(cat.productionOverrides || {}), slotId: `spirit-conj-${cid}`, isProductionUnit: true, productionSide: 'player', cost: 0, cooldownMs: 0 };
    scene.playerProductionRoster[0] = prod;
    await scene.preloadProductionRoster([prod]);
    if (scene.economy) { scene.economy.money = 999999; scene.economy.internalMoney = 99999900; }
    return { ok: true, slotId: prod.slotId, statsId: cid };
  }, conjurerId);
  if (!setup.ok) { log('spirit', conjurerId, 'setup failed', setup.reason); await page.close(); continue; }
  // deploy conjurer
  await page.evaluate((slot) => { globalThis.__APP__.battleScene.requestPlayerSpawn(slot); }, setup.slotId);
  await page.waitForTimeout(800);
  // tap repeatedly to request spirit summon (after cooldown 15 + template load)
  let spiritSeen = null;
  const end = Date.now() + 30000;
  while (Date.now() < end && !spiritSeen) {
    await page.evaluate((slot) => { globalThis.__APP__.battleScene.requestPlayerSpawn(slot); }, setup.slotId);
    const st = await page.evaluate(() => {
      const scene = globalThis.__APP__?.battleScene;
      const spirits = (scene.actors || []).filter((a) => a.bcuIsSpirit === true);
      const conj = (scene.actors || []).filter((a) => a.bcuIsSummoner === true || /spirit-conj/.test(String(a.slotId)));
      const stateMap = [];
      try { for (const [k, v] of (scene.bcuSpiritState || new Map())) stateMap.push({ k, spiritSummoned: v.spiritSummoned, cd: v.cooldownFrames }); } catch {}
      return { spirits: spirits.map((s) => ({ id: s.instanceId, x: Math.round(s.x), st: s.state })), conjCount: conj.length, stateMap, state: scene.battleState };
    });
    if (st.spirits.length) { spiritSeen = st; await page.screenshot({ path: `${OUT}/spirit-${conjurerId}.png` }); await page.screenshot({ path: `${OUT}/spirit-${conjurerId}-zoom.png`, clip: { x: 280, y: 300, width: 600, height: 400 } }); log('SPIRIT', conjurerId, 'seen', JSON.stringify(st.spirits), 'state', JSON.stringify(st.stateMap)); }
    if (st.state !== 'running') break;
    await page.waitForTimeout(300);
  }
  results['spirit-' + conjurerId] = { setup, spiritSeen, errors: errors.slice(0, 4) };
  log('spirit', conjurerId, spiritSeen ? 'CAPTURED' : 'no-spirit');
  await page.close();
  if (spiritSeen) break; // one good capture is enough
}

// ---------------- MINI-DEATH-SURGE ----------------
{
  const { page } = await newApp(browser, {});
  await startBattle(page);
  await produceLoop(page, 4, 300);
  const inject = await page.evaluate(() => {
    const scene = globalThis.__APP__?.battleScene;
    const u = (scene.actors || []).find((a) => a.side === 'dog-player' && a.isAlive?.());
    if (!u) return { ok: false, reason: 'no-unit' };
    const cm = u.bcuCombatModel || (u.bcuCombatModel = { proc: {} });
    cm.proc = cm.proc || {};
    // proven holder shape: ORB_DEATH_SURGE grade 5 -> mult 2000(=20x), dis 200..500, time 20
    cm.proc.miniDeathSurge = { prob: 100, dis0: 200, dis1: 500, time: 20, mult: 2000, source: 'visual-review-injection' };
    return { ok: true, id: u.instanceId, x: Math.round(u.x) };
  });
  log('mini-surge inject', JSON.stringify(inject));
  // kill it and capture demon soul + mini surge
  const seen = new Set();
  const end = Date.now() + 20000;
  let killed = false;
  while (Date.now() < end) {
    if (!killed) killed = await page.evaluate(async () => {
      const scene = globalThis.__APP__?.battleScene;
      const u = (scene.actors || []).find((a) => a.side === 'dog-player' && a.isAlive?.());
      if (!u) return false;
      const mod = await import('/js/battle/bcu-runtime/BcuDeathAnimationRuntime.js');
      u.hp = 0;
      mod.startBcuDeathAnimation(u, { scene, nowMs: scene.timeMs });
      return true;
    });
    const st = await page.evaluate(() => {
      const scene = globalThis.__APP__?.battleScene;
      const fx = (scene?.effects || []);
      const surge = fx.filter((e) => /surge|soul|volcano|demon/i.test(String(e.type)));
      const da = (scene?.actors || []).map((a) => a.bcuDeathAnimation).filter((d) => d?.active && d.deathSurge);
      return { surgeFx: surge.map((e) => ({ type: e.type })), allTypes: [...new Set(fx.map((x) => x.type))], deathSurgeActive: da.map((d) => ({ kind: d.kind, isMini: d.deathSurge?.isMini, triggered: d.deathSurge?.triggered })) };
    });
    if ((st.surgeFx.length || st.deathSurgeActive.length) && !seen.has('surge')) {
      seen.add('surge');
      await page.screenshot({ path: `${OUT}/mini-death-surge.png` });
      await page.screenshot({ path: `${OUT}/mini-death-surge-zoom.png`, clip: { x: 250, y: 300, width: 600, height: 420 } });
      log('mini-surge captured', JSON.stringify(st.surgeFx), 'da', JSON.stringify(st.deathSurgeActive));
    }
    await page.waitForTimeout(100);
  }
  results.miniDeathSurge = { inject, captured: [...seen] };
  await page.close();
}

console.log('\n===== SS RESULTS =====');
console.log(JSON.stringify(results, null, 1));
await browser.close();
