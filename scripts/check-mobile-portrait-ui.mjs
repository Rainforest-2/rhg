// Portrait-phone layout check for the non-battle screens.
// Companion to check-nonbattle-ui-polish.mjs (which covers landscape/desktop):
// drives the real app in portrait viewports against a running preview server
// (UI_POLISH_URL, default http://127.0.0.1:4173/) and asserts the guarantees
// css/mobile-portrait-fit.css + FormationPhonePortraitLayoutPatch.js provide:
//
// 1. no horizontal overflow, header title not ellipsized
// 2. catalog paints 3 columns and the virtual rowHeight matches the painted
//    card height + grid gap (no long-list drift)
// 3. action rail: attack button full width, secondary labels not ellipsized,
//    selected-stage pill visible (portrait re-enables it)
// 4. stage selector: map-list virtual rowHeight matches painted rows
// 5. Enter commits the catalog search; tapping the stage-overlay backdrop
//    closes it (parity with the settings overlay)
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_REQUIRE || 'playwright');

const BASE_URL = process.env.UI_POLISH_URL || 'http://127.0.0.1:4173/';
const OUT_DIR = 'tmp/ui-polish-screens';
const VIEWPORTS = [
  [390, 844],
  [375, 667],
  [360, 780],
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForFormation(page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.formation-ui', { state: 'visible', timeout: 90000 });
  await page.waitForFunction(() => !!document.body.classList.contains('nyanko-ui-polish'), null, { timeout: 30000 });
}

async function checkViewport(browser, width, height) {
  const label = `${width}x${height}`;
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await waitForFormation(page);
  await page.waitForTimeout(800);

  // 1. shell fits + title readable
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert(overflow <= 2, `${label}: horizontal overflow ${overflow}px`);
  const title = await page.evaluate(() => {
    const h3 = document.querySelector('.formation-header h3');
    return h3 ? { clipped: h3.scrollWidth > h3.clientWidth + 1, text: h3.textContent } : null;
  });
  assert(title, `${label}: formation header title missing`);
  assert(!title.clipped, `${label}: header title ellipsized (${title.text})`);

  // 2. catalog geometry matches the virtual metrics
  const catalog = await page.evaluate(() => {
    const editor = document.querySelector('.formation-ui').__formationEditor;
    const grid = document.querySelector('.formation-catalog-grid');
    const card = grid?.querySelector('.formation-character-card');
    const columns = getComputedStyle(grid).gridTemplateColumns.split(/\s+/).filter(Boolean).length;
    const gap = Number.parseFloat(getComputedStyle(grid).rowGap) || 0;
    return {
      columns,
      virtualColumns: editor.catalogVirtual.columns,
      rowHeight: editor.catalogVirtual.rowHeight,
      paintedRow: card ? Math.round(card.getBoundingClientRect().height + gap) : null
    };
  });
  assert(catalog.columns === 3 && catalog.virtualColumns === 3, `${label}: catalog columns ${catalog.columns}/${catalog.virtualColumns} (want 3)`);
  assert(catalog.paintedRow != null && Math.abs(catalog.paintedRow - catalog.rowHeight) <= 2,
    `${label}: catalog virtual rowHeight ${catalog.rowHeight} != painted ${catalog.paintedRow}`);

  // 3. action rail
  const rail = await page.evaluate(() => {
    const apply = document.querySelector('.apply-battle-button');
    const railEl = document.querySelector('.formation-action-rail');
    const applyRect = apply.getBoundingClientRect();
    const railRect = railEl.getBoundingClientRect();
    const secondaries = [...railEl.querySelectorAll('.secondary-action')];
    const stagePill = document.querySelector('.formation-current-stage');
    const pillStyle = stagePill ? getComputedStyle(stagePill) : null;
    return {
      applySpansRail: applyRect.width >= railRect.width * 0.9,
      clippedLabels: secondaries.filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent.trim()),
      railInViewport: railRect.bottom <= window.innerHeight + 1,
      stagePillVisible: !!pillStyle && pillStyle.display !== 'none' && stagePill.getBoundingClientRect().height > 0
    };
  });
  assert(rail.applySpansRail, `${label}: attack button does not span the rail`);
  assert(rail.clippedLabels.length === 0, `${label}: rail labels ellipsized: ${rail.clippedLabels.join(',')}`);
  assert(rail.railInViewport, `${label}: action rail extends below the viewport`);
  assert(rail.stagePillVisible, `${label}: selected-stage pill hidden in portrait`);
  await page.screenshot({ path: `${OUT_DIR}/portrait-formation-${label}.png`, fullPage: false });

  // 4. stage selector map-list virtual metrics (one deep pass is enough)
  if (width === 390) {
    await page.locator('[data-action="stage-open"]').click();
    await page.waitForSelector('.formation-stage-overlay.is-open', { state: 'visible', timeout: 20000 });
    await page.locator('.formation-stage-card-category[data-stage-category="legend"]').click();
    await page.waitForSelector('.formation-stage-card-map', { state: 'visible', timeout: 20000 });
    // one scroll re-render so measuredStageRowHeight replaces the estimate
    await page.evaluate(() => { const l = document.querySelector('.formation-stage-list'); l.scrollTop = 200; });
    await page.waitForTimeout(400);
    const mapMetrics = await page.evaluate(() => {
      const editor = document.querySelector('.formation-ui').__formationEditor;
      const list = document.querySelector('.formation-stage-list');
      const card = list.querySelector('.formation-stage-card-map');
      const gap = Number.parseFloat(getComputedStyle(list).rowGap) || 0;
      return {
        virtual: editor.stageSelectorVirtual,
        paintedRow: card ? Math.round(card.getBoundingClientRect().height + gap) : null
      };
    });
    if (mapMetrics.virtual?.active) {
      assert(Math.abs(mapMetrics.paintedRow - mapMetrics.virtual.rowHeight) <= 2,
        `${label}: map virtual rowHeight ${mapMetrics.virtual.rowHeight} != painted ${mapMetrics.paintedRow}`);
    }
    await page.screenshot({ path: `${OUT_DIR}/portrait-map-${label}.png`, fullPage: false });

    // 5a. backdrop tap closes the stage overlay
    await page.evaluate(() => {
      document.querySelector('.formation-stage-overlay').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    await page.waitForFunction(() => !document.querySelector('.formation-stage-overlay.is-open'), null, { timeout: 8000 });

    // 5b. Enter commits the catalog search
    await page.locator('[data-search-input]').fill('わんこ');
    await page.locator('[data-search-input]').press('Enter');
    await page.waitForTimeout(400);
    const committed = await page.evaluate(() => document.querySelector('.formation-ui').__formationEditor.searchText);
    assert(committed === 'わんこ', `${label}: Enter did not commit the catalog search (got "${committed}")`);
  }

  assert(consoleErrors.length === 0, `${label}: console errors:\n${consoleErrors.join('\n')}`);
  await page.close();
  return { viewport: label, ok: true };
}

await mkdir(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const [width, height] of VIEWPORTS) {
    results.push(await checkViewport(browser, width, height));
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({ ok: true, screenshots: OUT_DIR, results }, null, 2));
