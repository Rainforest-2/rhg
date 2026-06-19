// Probe RUNTIME-accurate enemy abilities via scene.statsLoader.loadEnemyStats(id),
// which uses the same pack-priority resolution the live battle uses. Reports which
// candidate enemy ids actually carry barrier / demon-shield / delay / burrow at runtime.
import { launch, newApp, startBattle } from './visual-harness.mjs';

const browser = await launch();
const { page } = await newApp(browser, {});
await startBattle(page);

const out = await page.evaluate(async () => {
  const ranges = {
    barrier: [364, 365, 367, 368, 377, 390, 419, 420, 447],
    demonShield: [554, 559, 560, 561, 562, 563, 565, 572, 573, 574, 575],
    delay: [774],
    burrow: [284, 286, 287, 288],
  };
  const scene = globalThis.__APP__?.battleScene;
  const loader = scene?.statsLoader;
  const res = {};
  for (const [ability, ids] of Object.entries(ranges)) {
    res[ability] = [];
    for (const id of ids) {
      try {
        const stats = await loader.loadEnemyStats(id);
        const p = stats?.bcuCombatModel?.proc || stats?.bcuProc || {};
        res[ability].push({
          id,
          barrier: p?.barrier?.health ?? 0,
          demonShield: p?.demonShield?.hp ?? 0,
          delay: p?.delay?.prob ?? 0,
          burrow: p?.burrow?.count ?? 0,
          revive: p?.revive?.count ?? 0,
        });
      } catch (e) { res[ability].push({ id, error: String(e?.message || e) }); }
    }
  }
  return res;
});
console.log(JSON.stringify(out, null, 1));

// Also do a broad sweep to find ANY enemy with barrier/shield/delay at runtime.
const sweep = await page.evaluate(async () => {
  const scene = globalThis.__APP__?.battleScene;
  const loader = scene?.statsLoader;
  const found = { barrier: [], demonShield: [], delay: [] };
  for (let id = 1; id < 800; id += 1) {
    try {
      const stats = await loader.loadEnemyStats(id);
      const p = stats?.bcuCombatModel?.proc || {};
      if (p?.barrier?.health > 0) found.barrier.push(id);
      if (p?.demonShield?.hp > 0) found.demonShield.push(id);
      if (p?.delay?.prob > 0) found.delay.push(id);
    } catch {}
  }
  return found;
});
console.log('SWEEP barrier:', sweep.barrier.slice(0, 20).join(','), '(n=' + sweep.barrier.length + ')');
console.log('SWEEP demonShield:', sweep.demonShield.slice(0, 20).join(','), '(n=' + sweep.demonShield.length + ')');
console.log('SWEEP delay:', sweep.delay.slice(0, 20).join(','), '(n=' + sweep.delay.length + ')');
await browser.close();
