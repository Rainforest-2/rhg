import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer as createNetServer } from 'node:net';
import { createServer as createViteServer } from 'vite';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_REQUIRE || 'playwright');
const OUT_DIR = 'tmp/character-modification-ui';

async function findFreePort() {
  return await new Promise((resolve, reject) => {
    const probe = createNetServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : null;
      probe.close((error) => {
        if (error) reject(error);
        else if (!port) reject(new Error('Could not reserve a browser-check port'));
        else resolve(port);
      });
    });
  });
}

async function openEditor(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('.formation-ui', { state: 'visible', timeout: 90000 });
  await page.waitForFunction(
    () => document.body.classList.contains('nyanko-ui-polish') && !!globalThis.__BCU_DB__,
    null,
    { timeout: 90000 }
  );
  await page.evaluate(() => {
    const editor = document.querySelector('.formation-ui')?.__formationEditor;
    if (!editor) throw new Error('FormationEditor is unavailable');
    editor.openCharacterTuningOverlay('dog-enemy-000', 0);
  });
  const trigger = page.locator('[data-character-modification-open]');
  await trigger.waitFor({ state: 'visible', timeout: 10000 });
  await trigger.evaluate((button) => button.click());
  await page.waitForSelector('.cm-editor[data-cm-design-context="standalone"]', {
    state: 'visible',
    timeout: 30000
  });
  await page.waitForTimeout(120);
}

async function metrics(page) {
  return await page.evaluate(() => {
    const rect = (selector) => {
      const node = document.querySelector(selector);
      const value = node?.getBoundingClientRect();
      return value ? {
        left: value.left,
        right: value.right,
        top: value.top,
        bottom: value.bottom,
        width: value.width,
        height: value.height
      } : null;
    };
    const toolbarControls = [
      '.cm-search',
      '.cm-filter-check',
      '.cm-ability-filter .cm-select',
      '.cm-history'
    ].map(rect);
    const dialog = document.querySelector('.cm-dialog');
    return {
      viewport: { width: innerWidth, height: innerHeight },
      layer: rect('.cm-host-layer-standalone'),
      dialog: rect('.cm-dialog'),
      header: rect('.cm-header'),
      toolbar: rect('.cm-toolbar'),
      workspace: rect('.cm-workspace'),
      categories: rect('.cm-categories'),
      contentHead: rect('.cm-content-head'),
      fieldList: rect('.cm-field-list'),
      footer: rect('.cm-footer'),
      firstField: rect('.cm-field'),
      input: rect('[data-cm-field="stats.maxHp"] input'),
      toolbarControls,
      documentOverflow: document.documentElement.scrollWidth - innerWidth,
      dialogOverflow: dialog ? dialog.scrollWidth - dialog.clientWidth : null
    };
  });
}

function assertFullBleed(result, label) {
  assert.ok(result.layer && result.dialog, `${label}: editor geometry exists`);
  assert.ok(Math.abs(result.layer.left) <= 1, `${label}: layer starts at viewport left`);
  assert.ok(Math.abs(result.layer.top) <= 1, `${label}: no application-created top gap`);
  assert.ok(Math.abs(result.dialog.left) <= 1, `${label}: dialog starts at viewport left`);
  assert.ok(Math.abs(result.dialog.top) <= 1, `${label}: dialog starts at viewport top`);
  assert.ok(
    Math.abs(result.dialog.width - result.viewport.width) <= 2,
    `${label}: dialog consumes viewport width`
  );
  assert.ok(
    Math.abs(result.dialog.height - result.viewport.height) <= 2,
    `${label}: dialog consumes viewport height`
  );
  assert.ok(result.documentOverflow <= 2, `${label}: no document horizontal overflow`);
  assert.ok(result.dialogOverflow <= 2, `${label}: no dialog horizontal overflow`);
}

function assertToolbarIsOneRow(result, label) {
  const controls = result.toolbarControls.filter(Boolean);
  assert.equal(controls.length, 4, `${label}: every toolbar control is present`);
  const centers = controls.map((entry) => entry.top + entry.height / 2);
  assert.ok(
    Math.max(...centers) - Math.min(...centers) <= 3,
    `${label}: search, filters and history share one row`
  );
}

test('phone status editor gives the viewport to the editing canvas', { timeout: 240000 }, async () => {
  const port = await findFreePort();
  const server = await createViteServer({
    root: process.cwd(),
    logLevel: 'error',
    server: { host: '127.0.0.1', port, strictPort: true }
  });
  await server.listen();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  try {
    await mkdir(OUT_DIR, { recursive: true });
    await openEditor(page, `http://127.0.0.1:${port}/`);

    const portrait = await metrics(page);
    assertFullBleed(portrait, '390x844');
    assertToolbarIsOneRow(portrait, '390x844');
    assert.ok(portrait.header.height <= 46, '390x844: header is compact');
    assert.ok(portrait.toolbar.height <= 42, '390x844: toolbar is compact');
    assert.ok(portrait.categories.height <= 38, '390x844: category rail is compact');
    assert.ok(portrait.contentHead.height <= 34, '390x844: section heading is compact');
    assert.ok(portrait.footer.height <= 50, '390x844: footer is compact');
    assert.ok(
      portrait.workspace.height / portrait.dialog.height >= 0.82,
      '390x844: workspace owns at least 82% of dialog height'
    );
    assert.ok(portrait.fieldList.height >= 580, '390x844: field list remains the dominant region');
    assert.ok(portrait.firstField.height < 150, '390x844: first field is not a desktop-sized card');
    assert.ok(portrait.input?.height <= 40, '390x844: numeric input is compact');
    await page.screenshot({
      path: `${OUT_DIR}/status-editor-mobile-390x844.png`,
      fullPage: false
    });

    await page.setViewportSize({ width: 667, height: 320 });
    await page.waitForTimeout(160);
    const landscape = await metrics(page);
    assertFullBleed(landscape, '667x320');
    assertToolbarIsOneRow(landscape, '667x320');
    assert.ok(landscape.header.height <= 40, '667x320: header is compact');
    assert.ok(landscape.toolbar.height <= 38, '667x320: toolbar is compact');
    assert.ok(landscape.categories.height <= 34, '667x320: category rail is compact');
    assert.ok(landscape.contentHead.height <= 32, '667x320: section heading is compact');
    assert.ok(landscape.footer.height <= 44, '667x320: footer is compact');
    assert.ok(
      landscape.workspace.height / landscape.dialog.height >= 0.62,
      '667x320: workspace owns at least 62% of low landscape height'
    );
    assert.ok(landscape.fieldList.height >= 120, '667x320: editing list remains usable');
    await page.screenshot({
      path: `${OUT_DIR}/status-editor-mobile-667x320.png`,
      fullPage: false
    });
  } finally {
    await context.close();
    await browser.close();
    await server.close();
  }
});
