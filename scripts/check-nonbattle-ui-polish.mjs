import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_REQUIRE || 'playwright');

const BASE_URL = process.env.UI_POLISH_URL || 'http://127.0.0.1:4173/';
const OUT_DIR = 'tmp/ui-polish-screens';
const VIEWPORTS = [
  [667, 375],
  [844, 390],
  [932, 430],
  [1024, 768],
  [1180, 820],
  [1366, 1024],
  [1440, 900],
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function visibleCount(page, selector) {
  return await page.locator(selector).evaluateAll((nodes) => nodes.filter((node) => {
    const style = getComputedStyle(node);
    const box = node.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0;
  }).length);
}

async function assertNoFatalHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert(overflow <= 2, `${label}: horizontal overflow ${overflow}px`);
}

async function assertCloseButtonVisible(page, label) {
  const box = await page.locator('.formation-stage-dialog header button').boundingBox();
  assert(box, `${label}: close button missing`);
  const vp = page.viewportSize();
  assert(box.x >= -1 && box.y >= -1 && box.x + box.width <= vp.width + 1 && box.y + box.height <= vp.height + 1, `${label}: close button outside viewport`);
}

async function assertInitialFormationIconsVisible(page, label) {
  await page.waitForFunction(() => {
    const visible = (node) => {
      const style = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0;
    };
    const slotImgs = [...document.querySelectorAll('.formation-slots img[data-semantic-icon]')].filter(visible);
    const catalogImgs = [...document.querySelectorAll('.formation-catalog-grid .formation-character-card img[data-semantic-icon]')].filter(visible);
    return slotImgs.length > 0
      && slotImgs.every((img) => img.dataset.iconResolved === '1' && img.naturalWidth > 0 && !img.classList.contains('image-missing'))
      && catalogImgs.slice(0, Math.min(3, catalogImgs.length)).every((img) => img.dataset.iconResolved === '1' && img.naturalWidth > 0 && !img.classList.contains('image-missing'));
  }, null, { timeout: 20000 });
}

async function assertCatalogCardsVisible(page, label) {
  await page.waitForFunction(() => {
    const cards = [...document.querySelectorAll('.formation-catalog-grid .formation-character-card')];
    return cards.some((node) => {
      const style = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0;
    });
  }, null, { timeout: 20000 });
  assert(await visibleCount(page, '.formation-character-card') > 0, `${label}: catalog cards not initially visible`);
}

async function assertTuningOverlayStable(page, label) {
  const slot = page.locator('.formation-slot[data-slot]').first();
  const box = await slot.boundingBox();
  assert(box, `${label}: first formation slot missing`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(660);
  await page.mouse.up();
  await page.waitForSelector('.formation-tuning-overlay.is-open', { state: 'visible', timeout: 8000 });
  await page.waitForTimeout(760);
  const state = await page.evaluate(() => {
    const overlay = document.querySelector('.formation-tuning-overlay.is-open');
    const panel = overlay?.querySelector('.formation-tuning-panel');
    const icon = overlay?.querySelector('.formation-tuning-portrait img[data-semantic-icon]');
    const overlayStyle = overlay ? getComputedStyle(overlay) : null;
    const panelStyle = panel ? getComputedStyle(panel) : null;
    return {
      overlayOpacity: Number(overlayStyle?.opacity || 0),
      panelBackground: panelStyle?.backgroundColor || '',
      iconReady: !!icon && icon.dataset.iconResolved === '1' && icon.naturalWidth > 0 && !icon.classList.contains('image-missing'),
      overlayAnimations: [...(overlay?.getAnimations?.() || [])].map((a) => a.animationName),
      panelAnimations: [...(panel?.getAnimations?.() || [])].map((a) => a.animationName)
    };
  });
  assert(state.overlayOpacity >= 0.98, `${label}: tuning overlay faded/restarted after open (${state.overlayOpacity})`);
  assert(state.panelBackground !== 'rgba(0, 0, 0, 0)', `${label}: tuning panel has transparent background`);
  assert(state.iconReady, `${label}: tuning overlay icon did not resolve immediately`);
  assert(!state.overlayAnimations.includes('gameUiFade'), `${label}: generic gameUiFade is still driving tuning overlay`);
  assert(state.panelAnimations.length === 0, `${label}: tuning panel animation still running after settle: ${state.panelAnimations.join(',')}`);
  await page.locator('[data-tuning-close]').click();
  await page.waitForSelector('.formation-tuning-overlay.is-open', { state: 'hidden', timeout: 8000 });
}

async function waitForFormation(page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.formation-ui', { state: 'visible', timeout: 90000 });
  await page.waitForFunction(() => !!document.body.classList.contains('nyanko-ui-polish'), null, { timeout: 30000 });
}

async function openSelector(page) {
  await page.locator('[data-action="stage-open"]').click();
  await page.waitForSelector('.formation-stage-overlay.is-open', { state: 'visible', timeout: 20000 });
}

async function checkViewport(browser, width, height) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  const label = `${width}x${height}`;
  await waitForFormation(page);
  await assertCatalogCardsVisible(page, label);
  await assertInitialFormationIconsVisible(page, label);
  if (width <= 932 && height <= 430) await assertTuningOverlayStable(page, label);
  await page.screenshot({ path: `${OUT_DIR}/formation-${label}.png`, fullPage: false });
  await assertNoFatalHorizontalOverflow(page, `${label} formation`);

  await openSelector(page);
  await assertCloseButtonVisible(page, `${label} category`);
  await page.waitForSelector('.formation-stage-card-category', { state: 'visible', timeout: 15000 });
  assert(await visibleCount(page, '.formation-stage-card-category') >= 5, `${label}: category cards not visible`);
  await page.screenshot({ path: `${OUT_DIR}/category-${label}.png`, fullPage: false });

  if (width === 1024 && height === 768) {
    await page.locator('.formation-stage-card-category[data-stage-category="legend"]').click();
    await page.waitForSelector('.formation-stage-card-map', { state: 'visible', timeout: 20000 });
    const mapCountBefore = await visibleCount(page, '.formation-stage-card-map');
    assert(mapCountBefore > 0, 'map cards did not render');
    const starSelector = page.locator('[data-stage-crown-star]').first();
    assert(await starSelector.inputValue() === '1', 'stage crown selector did not default to ★1');
    await starSelector.selectOption('4');
    await page.waitForTimeout(350);
    const mapCountStar4 = await visibleCount(page, '.formation-stage-card-map');
    assert(mapCountStar4 > 0, '★4 crown filter hid every legend map');
    const starDebug = await page.evaluate(() => globalThis.__BCU_STAGE_DIFFICULTY_FILTER_DEBUG__ || null);
    assert(starDebug?.filter?.star === 4, `crown filter debug did not record ★4 (${JSON.stringify(starDebug?.filter)})`);
    assert(starDebug.matchedCount > 0 && starDebug.matchedCount < starDebug.total, `★4 crown filter did not reduce legend map candidates (${starDebug.matchedCount} / ${starDebug.total})`);
    await page.screenshot({ path: `${OUT_DIR}/map-${label}.png`, fullPage: false });

    const search = page.locator('[data-stage-search-input]').first();
    await search.fill('zzzzzz-no-match');
    // Typing is draft-only (kept light); the filter commits on Enter / blur / 検索 button.
    await search.press('Enter');
    await page.waitForTimeout(350);
    const mapCountAfter = await visibleCount(page, '.formation-stage-card-map');
    const hiddenDisplayCount = await page.locator('.formation-stage-card-map.is-difficulty-filtered').evaluateAll((nodes) => nodes.filter((node) => getComputedStyle(node).display === 'none').length);
    assert(mapCountAfter < mapCountBefore, 'search filter did not reduce visible map cards');
    assert(hiddenDisplayCount > 0, 'filtered map cards are not display:none');
    await page.locator('[data-stage-filter-reset]').click();
    await page.waitForTimeout(350);
    assert(await visibleCount(page, '.formation-stage-card-map') === mapCountBefore, 'reset did not restore map cards');
    assert(await starSelector.inputValue() === '1', 'reset did not restore the crown selector to ★1');

    await starSelector.selectOption('4');
    await page.waitForTimeout(350);
    await page.locator('.formation-stage-card-map[data-stage-map]').first().click();
    await page.waitForSelector('.formation-stage-card-stage', { state: 'visible', timeout: 20000 });
    assert(await visibleCount(page, '.formation-stage-card-stage') > 0, 'stage cards did not render');
    await page.screenshot({ path: `${OUT_DIR}/stage-${label}.png`, fullPage: false });

    await page.locator('.formation-stage-card-stage[data-stage-id]').first().click();
    await page.waitForSelector('.formation-stage-overlay.is-open', { state: 'detached', timeout: 20000 }).catch(async () => {
      await page.waitForSelector('.formation-stage-overlay.is-open', { state: 'hidden', timeout: 10000 });
    });

    await page.locator('.apply-battle-button').click();
    await page.waitForSelector('.app-loading-overlay:not(.is-hidden)', { state: 'visible', timeout: 15000 });
    await page.waitForFunction(() => document.querySelector('.app-loading-overlay')?.dataset.loadingMode === 'battle', null, { timeout: 15000 });
    await page.screenshot({ path: `${OUT_DIR}/battle-loading-${label}.png`, fullPage: false });
    await page.waitForSelector('.app-loading-overlay.is-hidden', { state: 'attached', timeout: 90000 });
    const battleCrown = await page.evaluate(() => globalThis.__LAST_APPLY_BATTLE_REPORT__?.selectedStageCrown || null);
    assert(battleCrown?.star === 4 && battleCrown?.crownStarIndex === 3, `battle launch did not preserve ★4 crown selection: ${JSON.stringify(battleCrown)}`);
  }

  const filteredVisible = await page.locator('.formation-stage-card.is-difficulty-filtered').evaluateAll((nodes) => nodes.filter((node) => getComputedStyle(node).display !== 'none').length);
  assert(filteredVisible === 0, `${label}: filtered cards still visible`);

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
