import { chromium } from 'playwright';

const URL = 'http://127.0.0.1:4173/';
const OUT = '/workspaces/rhg/tmp';
const LAUNCH = { args: ['--single-process', '--no-zygote', '--renderer-process-limit=1', '--disable-dev-shm-usage', '--no-sandbox', '--disable-gpu'] };

async function boot(page, errors) {
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto(URL, { waitUntil: 'commit' });
  await page.waitForSelector('.apply-battle-button', { timeout: 120000 });
  await page.waitForFunction(() => !!(globalThis.__BCU_DB__ && globalThis.__APP__?.formationEditor), null, { timeout: 120000 });
  await page.waitForTimeout(500);
}

function seedFixture() {
  const db = globalThis.__BCU_DB__;
  const bg = (db.backgrounds?.list?.() || [])[2]?.id ?? 0;
  const castles = db.castles?.enemy?.list?.() || db.castles?.list?.() || [];
  const castleId = castles[1]?.numericId ?? castles[1]?.id ?? castles[0]?.numericId ?? castles[0]?.id ?? 0;
  const enemies = (db.enemies?.list?.() || []).slice(0, 4).map((e) => e.id ?? e.numericId);
  const now = Date.now();
  const stage = {
    schemaVersion: 1, id: 'custom-verify-1', name: '検証ステージ', description: 'thumbnail test',
    createdAt: now, updatedAt: now,
    battle: { stageLength: 4200, enemyBaseHp: 250000, maxEnemyCount: 8, backgroundId: bg, enemyCastleId: castleId,
      enemyCastleAnimBaseId: null, enemyCastleCannonId: null, musicId: 0, bossMusicId: null, timeLimitFrames: 0, nonContinue: false, bossGuard: false },
    spawns: enemies.map((eid, i) => ({ id: 'spawn-' + i, enemyId: eid, count: 3, hpMultiplier: 100, attackMultiplier: 100,
      boss: i === enemies.length - 1, firstSpawn: { minFrames: i * 240, maxFrames: i * 240 }, respawn: { enabled: i === 0, minFrames: 240, maxFrames: 480 },
      conditions: { enemyBaseHp: { enabled: false, minPercent: 0, maxPercent: 100 }, killCount: { enabled: false, value: 0 }, layer: { enabled: false, min: 0, max: 0 }, groupId: 0, score: { enabled: false, value: 0 } } })),
    limits: { maxMoney: null, maxUnitSpawn: null, globalCostMultiplier: null, globalCooldownMultiplier: null, rarityDeployLimit: null, bannedCatComboIds: [], bannedOrbIds: [] }
  };
  localStorage.setItem('wanko.customStages.v1', JSON.stringify({ schemaVersion: 1, stages: [stage] }));
  return { bg, castleId, enemies };
}

function thumbStats() {
  const imgs = [...document.querySelectorAll('img[data-custom-thumb]')];
  const by = (k) => imgs.filter((i) => i.dataset.thumbKind === k);
  const ok = (arr) => arr.filter((i) => i.dataset.thumbDone === '1' && !i.classList.contains('is-missing') && i.naturalWidth > 0).length;
  return {
    total: imgs.length,
    background: { n: by('background').length, ok: ok(by('background')) },
    castle: { n: by('castle').length, ok: ok(by('castle')) },
    playerCastle: { n: by('player-castle').length, ok: ok(by('player-castle')) },
    enemy: { n: by('enemy').length, ok: ok(by('enemy')) },
    fieldPreview: !!document.querySelector('.formation-custom-field-preview'),
  };
}

async function runViewport(vp) {
  const browser = await chromium.launch(LAUNCH);
  const errors = [];
  const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
  const out = { viewport: `${vp.w}x${vp.h}` };
  try {
    await boot(page, errors);
    // Seed fixture, then drive the REAL edit flow: custom-stage-battle -> click 編集.
    out.seed = await page.evaluate(() => {
      const s = (0, eval)('(' + seedFixtureSrc + ')')();
      const ed = globalThis.__APP__.formationEditor;
      ed.stageSelectorState = { level: 'custom-stage-battle', categoryId: null, mapKey: null };
      ed.renderStageSelector();
      return s;
    }, );
    await page.waitForTimeout(400);
    // Open stage overlay is not needed (list renders in place); click the real edit button.
    await page.evaluate(() => document.querySelector('[data-custom-builder-edit="custom-verify-1"]').click());
    await page.waitForSelector('.formation-custom-builder-screen', { timeout: 8000 });
    await page.waitForTimeout(2600); // resolve thumbnails
    await page.screenshot({ path: `${OUT}/cs2-basic-${vp.name}.png` });
    out.basic = await page.evaluate(thumbStats);

    await page.evaluate(() => { const ed = globalThis.__APP__.formationEditor; ed.__customBuilder.tab = 'enemy'; ed.renderStageSelector(); });
    await page.waitForTimeout(2600);
    await page.screenshot({ path: `${OUT}/cs2-enemy-${vp.name}.png` });
    out.enemy = await page.evaluate(thumbStats);

    await page.evaluate(() => { const ed = globalThis.__APP__.formationEditor; ed.__customBuilder.tab = 'confirm'; ed.renderStageSelector(); });
    await page.waitForTimeout(2200);
    await page.screenshot({ path: `${OUT}/cs2-confirm-${vp.name}.png` });
    out.confirm = await page.evaluate(thumbStats);

    out.overflowX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

    // BGM preview.
    await page.evaluate(() => { const ed = globalThis.__APP__.formationEditor; ed.__customBuilder.tab = 'basic'; ed.renderStageSelector(); });
    await page.waitForTimeout(700);
    out.bgm = await page.evaluate(async () => {
      const btn = document.querySelector('[data-custom-music-toggle]');
      if (!btn) return { hadButton: false };
      btn.click();
      await new Promise((r) => setTimeout(r, 1000));
      const playing = document.querySelector('[data-custom-music-toggle].is-playing');
      const previewing = globalThis.__APP__.formationEditor.__customBuilder ? undefined : undefined;
      const res = { hadButton: true, playingAfterClick: !!playing };
      // Stop it and confirm stop clears state.
      if (playing) { playing.click(); await new Promise((r) => setTimeout(r, 400)); }
      res.stoppedOk = !document.querySelector('[data-custom-music-toggle].is-playing');
      return res;
    });
  } catch (e) {
    out.error = e.message;
  }
  out.consoleErrors = errors.filter((e) => !/ALSA|dbus|GpuControl|PcmOpen|Floss|PulseAudio/.test(e)).slice(0, 15);
  await browser.close();
  return out;
}

const seedFixtureSrc = seedFixture.toString();
// Inject the fixture source into the page scope for eval.
const results = [];
for (const vp of [{ w: 1180, h: 820, name: 'ipad-land' }, { w: 390, h: 844, name: 'phone' }]) {
  // pass seedFixtureSrc via addInitScript
  const orig = runViewport;
  results.push(await runViewportWith(vp));
}
async function runViewportWith(vp) {
  const browser = await chromium.launch(LAUNCH);
  const errors = [];
  const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
  await page.addInitScript(`window.seedFixtureSrc = ${JSON.stringify(seedFixtureSrc)};`);
  const out = { viewport: `${vp.w}x${vp.h}`, name: vp.name };
  try {
    await boot(page, errors);
    await page.click('[data-action="stage-open"]').catch(() => {});
    await page.waitForTimeout(400);
    out.seed = await page.evaluate(() => {
      const s = (0, eval)('(' + window.seedFixtureSrc + ')')();
      const ed = globalThis.__APP__.formationEditor;
      ed.stageSelectorState = { level: 'custom-stage-battle', categoryId: null, mapKey: null };
      ed.renderStageSelector();
      return s;
    });
    await page.waitForTimeout(400);
    await page.evaluate(() => document.querySelector('[data-custom-builder-edit="custom-verify-1"]').click());
    await page.waitForSelector('.formation-custom-builder-screen', { state: 'attached', timeout: 8000 });
    await page.waitForTimeout(2600);
    await page.screenshot({ path: `${OUT}/cs2-basic-${vp.name}.png` });
    out.basic = await page.evaluate(thumbStats);
    await page.evaluate(() => { const ed = globalThis.__APP__.formationEditor; ed.__customBuilder.tab = 'enemy'; ed.renderStageSelector(); });
    await page.waitForTimeout(2600);
    await page.screenshot({ path: `${OUT}/cs2-enemy-${vp.name}.png` });
    out.enemy = await page.evaluate(thumbStats);
    await page.evaluate(() => { const ed = globalThis.__APP__.formationEditor; ed.__customBuilder.tab = 'confirm'; ed.renderStageSelector(); });
    await page.waitForTimeout(2200);
    await page.screenshot({ path: `${OUT}/cs2-confirm-${vp.name}.png` });
    out.confirm = await page.evaluate(thumbStats);
    out.overflowX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await page.evaluate(() => { const ed = globalThis.__APP__.formationEditor; ed.__customBuilder.tab = 'basic'; ed.renderStageSelector(); });
    await page.waitForTimeout(700);
    out.bgm = await page.evaluate(async () => {
      const btn = document.querySelector('[data-custom-music-toggle]');
      if (!btn) return { hadButton: false };
      btn.click();
      await new Promise((r) => setTimeout(r, 1100));
      const playing = document.querySelector('[data-custom-music-toggle].is-playing');
      const res = { hadButton: true, playingAfterClick: !!playing };
      if (playing) { playing.click(); await new Promise((r) => setTimeout(r, 400)); }
      res.stoppedOk = !document.querySelector('[data-custom-music-toggle].is-playing');
      return res;
    });
  } catch (e) { out.error = e.message; }
  out.consoleErrors = errors.filter((e) => !/ALSA|dbus|GpuControl|PcmOpen|Floss|PulseAudio/.test(e)).slice(0, 15);
  await browser.close();
  return out;
}

console.log(JSON.stringify(results, null, 2));
