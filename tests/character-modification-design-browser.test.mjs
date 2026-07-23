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

async function waitForFormation(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('.formation-ui', { state: 'visible', timeout: 90000 });
  await page.waitForFunction(
    () => document.body.classList.contains('nyanko-ui-polish') && !!globalThis.__BCU_DB__,
    null,
    { timeout: 90000 }
  );
}

async function openFormationEditor(page) {
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
}

async function installMockVisualViewport(page, { height, offsetTop = 0 }) {
  await page.evaluate(({ initialHeight, initialOffsetTop }) => {
    const original = globalThis.visualViewport;
    const target = new EventTarget();
    const state = { height: initialHeight, offsetTop: initialOffsetTop };
    Object.defineProperties(target, {
      height: { configurable: true, get: () => state.height },
      offsetTop: { configurable: true, get: () => state.offsetTop },
      width: { configurable: true, get: () => innerWidth },
      offsetLeft: { configurable: true, get: () => 0 },
      pageTop: { configurable: true, get: () => state.offsetTop },
      pageLeft: { configurable: true, get: () => 0 },
      scale: { configurable: true, get: () => 1 }
    });
    Object.defineProperty(globalThis, 'visualViewport', {
      configurable: true,
      value: target
    });
    globalThis.__setStatusEditorViewport = (next) => {
      state.height = Number(next.height);
      state.offsetTop = Number(next.offsetTop) || 0;
      target.dispatchEvent(new Event('resize'));
    };
    globalThis.__restoreStatusEditorViewport = () => {
      Object.defineProperty(globalThis, 'visualViewport', {
        configurable: true,
        value: original
      });
      delete globalThis.__setStatusEditorViewport;
      delete globalThis.__restoreStatusEditorViewport;
    };
  }, { initialHeight: height, initialOffsetTop: offsetTop });
}

async function readDesignMetrics(page) {
  return await page.evaluate(() => {
    const editor = document.querySelector('.cm-editor');
    const dialog = document.querySelector('.cm-dialog');
    const header = editor?.querySelector('.cm-header');
    const toolbar = editor?.querySelector('.cm-toolbar');
    const workspace = editor?.querySelector('.cm-workspace');
    const categories = editor?.querySelector('.cm-categories');
    const field = editor?.querySelector('.cm-field');
    const comparison = field?.querySelector('.cm-comparison');
    const control = field?.querySelector('.cm-field-control');
    const save = editor?.querySelector('[data-cm-action="save"]');
    const utility = editor?.querySelector('[data-cm-action="reset-all"]');
    const allButtons = [...(editor?.querySelectorAll('button') || [])];
    const rect = (node) => {
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
    const style = (node) => node ? getComputedStyle(node) : null;
    const saveStyle = style(save);
    const utilityStyle = style(utility);
    const root = document.documentElement;
    return {
      context: editor?.dataset.cmDesignContext,
      ready: editor?.parentElement?.dataset.cmDesignReady || editor?.closest('.cm-editor-root')?.dataset.cmDesignReady,
      dialog: rect(dialog),
      header: rect(header),
      toolbar: rect(toolbar),
      workspace: rect(workspace),
      categories: rect(categories),
      field: rect(field),
      comparison: rect(comparison),
      control: rect(control),
      save: {
        rect: rect(save),
        backgroundColor: saveStyle?.backgroundColor,
        backgroundImage: saveStyle?.backgroundImage,
        borderRadius: saveStyle?.borderRadius,
        boxShadow: saveStyle?.boxShadow,
        color: saveStyle?.color
      },
      utility: {
        rect: rect(utility),
        backgroundColor: utilityStyle?.backgroundColor,
        backgroundImage: utilityStyle?.backgroundImage,
        borderRadius: utilityStyle?.borderRadius,
        boxShadow: utilityStyle?.boxShadow
      },
      undersizedButtons: allButtons
        .map((button) => ({
          action: button.dataset.cmAction || button.textContent?.trim().slice(0, 30),
          rect: rect(button)
        }))
        .filter((entry) => entry.rect && (entry.rect.width < 44 || entry.rect.height < 44)),
      documentOverflow: root.scrollWidth - innerWidth,
      dialogOverflow: dialog ? dialog.scrollWidth - dialog.clientWidth : null
    };
  });
}

function assertDesignMetrics(metrics, { context }) {
  assert.equal(metrics.context, context, `${context}: design context is explicit`);
  assert.ok(metrics.dialog?.width > 0 && metrics.dialog?.height > 0, `${context}: dialog is visible`);
  assert.ok(metrics.header?.height >= 42, `${context}: header hierarchy is retained`);
  assert.ok(metrics.toolbar?.height >= 42, `${context}: toolbar remains usable`);
  assert.ok(metrics.workspace?.height > 100, `${context}: editing workspace receives the main area`);
  assert.ok(metrics.categories?.width >= 160, `${context}: category navigation is scannable`);
  assert.ok(metrics.field?.width > 400, `${context}: field card uses available width`);
  assert.ok(
    metrics.comparison && metrics.control && metrics.comparison.left < metrics.control.left,
    `${context}: wide layout separates reference values and controls`
  );
  assert.equal(metrics.save.backgroundImage, 'none', `${context}: primary action has no game gradient`);
  assert.equal(metrics.save.borderRadius, '8px', `${context}: primary action is not a pill`);
  assert.equal(metrics.save.boxShadow, 'none', `${context}: primary action has no game shadow`);
  assert.equal(metrics.utility.backgroundImage, 'none', `${context}: utility action has no game gradient`);
  assert.equal(metrics.utility.borderRadius, '8px', `${context}: utility action is not a pill`);
  assert.equal(metrics.utility.boxShadow, 'none', `${context}: utility action has no game shadow`);
  assert.notEqual(
    metrics.save.backgroundColor,
    metrics.utility.backgroundColor,
    `${context}: primary and utility actions have clear hierarchy`
  );
  assert.deepEqual(metrics.undersizedButtons, [], `${context}: interactive buttons keep 44px targets`);
  assert.ok(metrics.documentOverflow <= 2, `${context}: no document horizontal overflow`);
  assert.ok(metrics.dialogOverflow <= 2, `${context}: no dialog horizontal overflow`);
}

async function openCustomStageEditor(page) {
  await page.locator('[data-action="stage-open"]').click();
  await page.waitForSelector('[data-custom-stage-category]', { state: 'visible', timeout: 20000 });
  await page.locator('[data-custom-stage-category]').click();
  await page.waitForSelector('[data-custom-builder-new]', { state: 'visible', timeout: 10000 });
  await page.locator('[data-custom-builder-new]').click();
  await page.locator('[data-custom-builder-tab="enemy"]').click();
  await page.locator('[data-custom-spawn-add]').click();
  await page.waitForSelector('.formation-custom-spawn-modal-card', { state: 'visible', timeout: 10000 });
  await installMockVisualViewport(page, { height: 1024, offsetTop: 0 });
  await page.locator('[data-custom-spawn-modification-open]').click();
  await page.waitForSelector('.cm-editor[data-cm-design-context="embedded"]', {
    state: 'visible',
    timeout: 30000
  });
}

test('formation and custom-stage status editors share a professional visual contract', { timeout: 240000 }, async () => {
  const port = await findFreePort();
  const server = await createViteServer({
    root: process.cwd(),
    logLevel: 'error',
    server: { host: '127.0.0.1', port, strictPort: true }
  });
  await server.listen();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 1024 } });
  const page = await context.newPage();
  const url = `http://127.0.0.1:${port}/`;

  try {
    await mkdir(OUT_DIR, { recursive: true });
    await waitForFormation(page, url);
    await openFormationEditor(page);
    const formationMetrics = await readDesignMetrics(page);
    assertDesignMetrics(formationMetrics, { context: 'standalone' });
    await page.screenshot({
      path: `${OUT_DIR}/status-editor-formation-design.png`,
      fullPage: false
    });

    await page.locator('.cm-footer [data-cm-action="cancel"]').click();
    await page.waitForSelector('.cm-editor', { state: 'detached', timeout: 10000 });
    await page.locator('.formation-tuning-close').click();
    await page.waitForSelector('.formation-tuning-overlay.is-open', {
      state: 'detached',
      timeout: 10000
    });

    await openCustomStageEditor(page);
    const customMetrics = await readDesignMetrics(page);
    assertDesignMetrics(customMetrics, { context: 'embedded' });
    assert.ok(customMetrics.dialog.width >= 1100, 'embedded: custom-stage editor uses the available iPad width');
    assert.equal(
      customMetrics.save.backgroundColor,
      formationMetrics.save.backgroundColor,
      'both entry points share the same primary action styling'
    );
    assert.equal(
      customMetrics.utility.backgroundColor,
      formationMetrics.utility.backgroundColor,
      'both entry points share the same utility action styling'
    );
    await page.screenshot({
      path: `${OUT_DIR}/status-editor-custom-stage-design.png`,
      fullPage: false
    });

    const hpInput = page.locator('[data-cm-field="stats.maxHp"] input');
    await hpInput.focus();
    await page.evaluate(() => {
      globalThis.__setStatusEditorViewport({ height: 560, offsetTop: 0 });
    });
    await page.waitForTimeout(180);
    const keyboardMetrics = await page.evaluate(() => {
      const footer = document.querySelector('.cm-footer');
      const layer = document.querySelector('.cm-host-layer-embedded');
      const input = document.querySelector('[data-cm-field="stats.maxHp"] input');
      const style = footer ? getComputedStyle(footer) : null;
      const layerRect = layer?.getBoundingClientRect();
      const inputRect = input?.getBoundingClientRect();
      return {
        footerVisibility: style?.visibility,
        footerPointerEvents: style?.pointerEvents,
        footerHeight: footer?.getBoundingClientRect().height,
        layerTop: layerRect?.top,
        inputTop: inputRect?.top,
        inputBottom: inputRect?.bottom
      };
    });
    assert.equal(keyboardMetrics.footerVisibility, 'hidden', 'keyboard: footer actions are visually removed');
    assert.equal(keyboardMetrics.footerPointerEvents, 'none', 'keyboard: footer actions cannot receive input');
    assert.equal(keyboardMetrics.footerHeight, 0, 'keyboard: footer reserves no space');
    assert.ok(keyboardMetrics.layerTop >= -1 && keyboardMetrics.layerTop <= 48, 'keyboard: editor is not shifted excessively upward');
    assert.ok(
      keyboardMetrics.inputTop >= 0 && keyboardMetrics.inputBottom <= 560,
      'keyboard: focused input remains inside the visible area'
    );
    await page.screenshot({
      path: `${OUT_DIR}/status-editor-custom-stage-keyboard-design.png`,
      fullPage: false
    });
  } finally {
    await page.evaluate(() => globalThis.__restoreStatusEditorViewport?.()).catch(() => {});
    await context.close();
    await browser.close();
    await server.close();
  }
});
