import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer as createNetServer } from 'node:net';
import { createServer as createViteServer } from 'vite';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_REQUIRE || 'playwright');

const FORMATION_KEY = 'wanko-battle.formation.v2';
const CUSTOM_STAGE_KEY = 'wanko.customStages.v1';
const CUSTOM_STAGE_DRAFT_KEY = 'wanko.customStageDraft.v1';
const OUT_DIR = 'tmp/character-modification-ui';
const VIEWPORTS = [
  [320, 568, 'minimum-width'],
  [390, 844, 'iphone-portrait'],
  [667, 320, 'iphone-landscape'],
  [800, 360, 'android-low-landscape'],
  [1024, 768, 'ipad-mini-landscape'],
  [768, 1024, 'ipad-portrait'],
  [1280, 900, 'desktop']
];

function visible(rect) {
  return rect
    && rect.width > 0
    && rect.height > 0;
}

async function downloadText(download) {
  const path = await download.path();
  assert.ok(path, 'download path is available');
  return readFile(path, 'utf8');
}

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

async function openFormationEditor(page, characterId = 'dog-enemy-000') {
  await page.evaluate((id) => {
    const editor = document.querySelector('.formation-ui')?.__formationEditor;
    if (!editor) throw new Error('FormationEditor is unavailable');
    editor.openCharacterTuningOverlay(id, 0);
  }, characterId);
  const trigger = page.locator('[data-character-modification-open]');
  await trigger.waitFor({ state: 'visible', timeout: 10000 });
  await trigger.focus();
  await trigger.evaluate((button) => button.click());
  try {
    await page.waitForSelector('.cm-editor', { state: 'visible', timeout: 30000 });
  } catch (error) {
    const state = await page.evaluate(() => ({
      hint: document.querySelector('.formation-hint')?.textContent || null,
      tuningOpen: !!document.querySelector('.formation-tuning-overlay.is-open'),
      triggerConnected: !!document.querySelector('[data-character-modification-open]'),
      editorConnected: !!document.querySelector('.cm-editor')
    }));
    throw new Error(
      `Formation modification editor did not open: ${JSON.stringify(state)}`,
      { cause: error }
    );
  }
}

async function assertAccessibility(page, label) {
  const result = await page.evaluate(() => {
    const dialog = document.querySelector('.cm-dialog');
    const controls = [...dialog.querySelectorAll('input,select,textarea')]
      .filter((control) => control.type !== 'hidden');
    return {
      role: dialog.getAttribute('role'),
      modal: dialog.getAttribute('aria-modal'),
      unlabeled: controls
        .filter((control) => (
          !control.labels?.length
          && !control.getAttribute('aria-label')
          && !control.getAttribute('aria-labelledby')
        ))
        .map((control) => control.outerHTML.slice(0, 160)),
      wrongButtonTypes: [...dialog.querySelectorAll('button')]
        .filter((button) => button.type !== 'button')
        .map((button) => button.outerHTML.slice(0, 160)),
      focusedInside: dialog.contains(document.activeElement),
      liveRegion: !!dialog.parentElement?.querySelector('[data-cm-live-region]')
    };
  });
  assert.equal(result.role, 'dialog', `${label}: dialog role`);
  assert.equal(result.modal, 'true', `${label}: aria-modal`);
  assert.deepEqual(result.unlabeled, [], `${label}: every input has a label`);
  assert.deepEqual(result.wrongButtonTypes, [], `${label}: every button is type=button`);
  assert.equal(result.focusedInside, true, `${label}: focus starts inside dialog`);
  assert.equal(result.liveRegion, true, `${label}: aria-live region`);
}

async function assertViewport(page, width, height, label) {
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(120);
  const metrics = await page.evaluate(() => {
    const viewport = globalThis.visualViewport;
    const dialog = document.querySelector('.cm-dialog')?.getBoundingClientRect();
    const footer = document.querySelector('.cm-footer:not([hidden])')?.getBoundingClientRect();
    const root = document.documentElement;
    return {
      href: location.href,
      readyState: document.readyState,
      bodyClass: document.body.className,
      formationCount: document.querySelectorAll('.formation-ui').length,
      dialogCount: document.querySelectorAll('.cm-dialog').length,
      editorCount: document.querySelectorAll('.cm-editor').length,
      viewportTop: viewport?.offsetTop || 0,
      viewportHeight: viewport?.height || innerHeight,
      dialog: dialog ? {
        left: dialog.left,
        right: dialog.right,
        top: dialog.top,
        bottom: dialog.bottom,
        width: dialog.width,
        height: dialog.height
      } : null,
      footer: footer ? {
        left: footer.left,
        right: footer.right,
        top: footer.top,
        bottom: footer.bottom,
        width: footer.width,
        height: footer.height
      } : null,
      documentOverflow: root.scrollWidth - innerWidth,
      dialogOverflow: document.querySelector('.cm-dialog')?.scrollWidth
        - document.querySelector('.cm-dialog')?.clientWidth
    };
  });
  assert.ok(visible(metrics.dialog), `${label}: dialog is visible ${JSON.stringify(metrics)}`);
  assert.ok(visible(metrics.footer), `${label}: footer is visible`);
  assert.ok(metrics.dialog.left >= -1 && metrics.dialog.right <= width + 1, `${label}: dialog width fits`);
  assert.ok(
    metrics.dialog.top >= metrics.viewportTop - 1
      && metrics.dialog.bottom <= metrics.viewportTop + metrics.viewportHeight + 1,
    `${label}: dialog height fits ${JSON.stringify(metrics)}`
  );
  assert.ok(
    metrics.footer.bottom <= metrics.viewportTop + metrics.viewportHeight + 1,
    `${label}: save/cancel footer is reachable ${JSON.stringify(metrics.footer)}`
  );
  assert.ok(metrics.documentOverflow <= 2, `${label}: document horizontal overflow ${metrics.documentOverflow}`);
  assert.ok(metrics.dialogOverflow <= 2, `${label}: dialog horizontal overflow ${metrics.dialogOverflow}`);
  return metrics;
}

async function installMockVisualViewport(page, {
  height,
  offsetTop = 0
}) {
  await page.evaluate(({ height: initialHeight, offsetTop: initialOffsetTop }) => {
    const original = globalThis.visualViewport;
    const target = new EventTarget();
    const state = {
      height: initialHeight,
      offsetTop: initialOffsetTop
    };
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
    globalThis.__cmSetMockVisualViewport = (next) => {
      state.height = next.height;
      state.offsetTop = next.offsetTop || 0;
      target.dispatchEvent(new Event('resize'));
    };
    globalThis.__cmRestoreVisualViewport = () => {
      Object.defineProperty(globalThis, 'visualViewport', {
        configurable: true,
        value: original
      });
      delete globalThis.__cmSetMockVisualViewport;
      delete globalThis.__cmRestoreVisualViewport;
    };
  }, { height, offsetTop });
}

async function formationWorkflow(page) {
  await page.evaluate(({ formationKey, customStageKey, draftKey }) => {
    localStorage.removeItem(formationKey);
    localStorage.removeItem(customStageKey);
    localStorage.removeItem(draftKey);
  }, {
    formationKey: FORMATION_KEY,
    customStageKey: CUSTOM_STAGE_KEY,
    draftKey: CUSTOM_STAGE_DRAFT_KEY
  });

  await openFormationEditor(page);
  await assertAccessibility(page, 'formation');
  const focusTrap = await page.evaluate(() => {
    const dialog = document.querySelector('.cm-dialog');
    const selector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled]):not([type="hidden"])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]'
    ].join(',');
    const focusable = [...dialog.querySelectorAll(selector)].filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0
        && rect.height > 0
        && style.display !== 'none'
        && style.visibility !== 'hidden';
    });
    const first = focusable[0];
    const last = focusable.at(-1);
    last.focus();
    last.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true
    }));
    const forwardWrapped = document.activeElement === first;
    first.focus();
    first.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true
    }));
    return {
      count: focusable.length,
      forwardWrapped,
      backwardWrapped: document.activeElement === last
    };
  });
  assert.ok(focusTrap.count > 1, 'dialog exposes multiple keyboard controls');
  assert.equal(focusTrap.forwardWrapped, true, 'Tab wraps from the last control to the first');
  assert.equal(focusTrap.backwardWrapped, true, 'Shift+Tab wraps from the first control to the last');

  const hp = page.locator('[data-cm-field="stats.maxHp"] input');
  const originalHp = await hp.inputValue();
  await hp.fill('500000');
  await hp.blur();
  await page.waitForFunction(() => document.querySelector('.cm-changed-count')?.textContent === '改造 1件');

  await page.locator('[data-cm-action="undo"]').click();
  assert.equal(await hp.inputValue(), originalHp, 'undo restores the normal HP');
  await page.locator('[data-cm-action="redo"]').click();
  assert.equal(await hp.inputValue(), '500000', 'redo restores the absolute HP override');

  const changedOnly = page.locator('[data-cm-changed-only]');
  await changedOnly.check();
  assert.equal(await page.locator('[data-cm-field]').count(), 1, 'changed-only shows the sparse field');
  await changedOnly.uncheck();

  await page.locator('[data-cm-search]').fill('最大体力');
  assert.equal(await page.locator('[data-cm-field]').count(), 1, 'field search narrows results');
  await page.locator('[data-cm-search]').fill('');

  await page.locator('[data-cm-field="stats.maxHp"] [data-cm-action="reset-field"]').click();
  await page.waitForFunction(() => document.querySelector('.cm-changed-count')?.textContent === '改造 0件');
  await page.locator('[data-cm-action="undo"]').click();
  assert.equal(await hp.inputValue(), '500000', 'reset is undoable');

  const speed = page.locator('[data-cm-field="stats.speed"] input');
  const originalSpeed = await speed.inputValue();
  await speed.fill('123');
  await speed.blur();
  await page.waitForFunction(() => document.querySelector('.cm-changed-count')?.textContent === '改造 2件');
  await page.locator('[data-cm-action="reset-category"]').click();
  await page.waitForFunction(() => document.querySelector('.cm-changed-count')?.textContent === '改造 0件');
  assert.equal(await hp.inputValue(), originalHp, 'category reset restores normal HP');
  assert.equal(await speed.inputValue(), originalSpeed, 'category reset restores normal speed');
  await page.locator('[data-cm-action="undo"]').click();
  assert.equal(await hp.inputValue(), '500000', 'category reset is undoable for HP');
  assert.equal(await speed.inputValue(), '123', 'category reset is undoable for speed');
  await page.locator('[data-cm-field="stats.speed"] [data-cm-action="reset-field"]').click();
  await page.waitForFunction(() => document.querySelector('.cm-changed-count')?.textContent === '改造 1件');

  await page.locator('[data-cm-action="reset-all"]').click();
  await page.waitForFunction(() => document.querySelector('.cm-changed-count')?.textContent === '改造 0件');
  assert.equal(await hp.inputValue(), originalHp, 'all reset restores the normal HP');
  await page.locator('[data-cm-action="undo"]').click();
  assert.equal(await hp.inputValue(), '500000', 'all reset is undoable');
  await page.waitForFunction(() => document.querySelector('.cm-changed-count')?.textContent === '改造 1件');

  await page.locator('[data-cm-category="procs"]').click();
  const abilityFilter = page.locator('[data-cm-ability-view]');
  await abilityFilter.selectOption('current');
  const currentIds = await page.locator('[data-cm-field]').evaluateAll(
    (nodes) => nodes.map((node) => node.dataset.cmField)
  );
  await abilityFilter.selectOption('addable');
  const addable = await page.locator('[data-cm-field]').evaluateAll((nodes) => nodes.map((node) => ({
    id: node.dataset.cmField,
    readOnly: node.classList.contains('is-read-only')
  })));
  assert.ok(addable.length > 0, 'addable ability list is available');
  assert.ok(addable.every((item) => !item.readOnly), 'addable ability list excludes unsupported fields');
  assert.deepEqual(
    addable.filter((item) => currentIds.includes(item.id)),
    [],
    'current and addable ability lists are disjoint'
  );
  await abilityFilter.selectOption('all');
  await page.locator('[data-cm-category="attacks"]').evaluate((button) => button.click());

  const rangeField = page.locator('[data-cm-field="attacks.hits.0.range"]');
  const rangeType = rangeField.locator('[data-cm-part="type"]');
  await rangeType.selectOption('ld');
  assert.equal(
    await rangeField.locator('[data-cm-part="start"]').count(),
    1,
    'LD range shows its start coordinate'
  );
  assert.equal(
    await rangeField.locator('[data-cm-part="end"]').count(),
    1,
    'LD range shows its end coordinate'
  );
  await rangeField.locator('[data-cm-part="start"]').fill('0');
  await rangeField.locator('[data-cm-part="start"]').blur();
  await rangeField.locator('[data-cm-part="end"]').fill('100');
  await rangeField.locator('[data-cm-part="end"]').blur();
  await rangeField.locator('[data-cm-part="type"]').selectOption('normal');
  assert.equal(
    await rangeField.locator('[data-cm-part="start"]').count(),
    0,
    'normal range hides its inapplicable start coordinate'
  );
  assert.equal(
    await rangeField.locator('[data-cm-part="end"]').count(),
    0,
    'normal range hides its inapplicable end coordinate'
  );

  const formationDownloadEvent = page.waitForEvent('download');
  await page.locator('[data-cm-action="export"]').click();
  const formationDownload = await formationDownloadEvent;
  const formationPackText = await downloadText(formationDownload);
  const formationPack = JSON.parse(formationPackText);
  assert.equal(formationPack.type, 'rhg-character-modification-pack');
  assert.equal(formationPack.version, 1);
  assert.equal(formationPackText.includes('\n'), false, 'standard pack export is minified');
  const formationModification = formationPack.modifications[
    formationPack.entries.find((entry) => entry.characterId === 'dog-enemy-000').modificationRef
  ];
  assert.deepEqual(
    formationModification.attacks.hits['0'].range,
    { type: 'normal' },
    'range type changes do not export stale LD/omni coordinates'
  );
  await rangeField.locator('[data-cm-action="reset-field"]').click();
  await page.locator('[data-cm-category="stats"]').evaluate((button) => button.click());

  const formationSave = page.locator('[data-cm-action="save"]');
  await page.waitForFunction(() => !document.querySelector('[data-cm-action="save"]')?.disabled);
  const formationValidation = await page.locator('.cm-validation-summary').textContent();
  assert.equal(
    await formationSave.isEnabled(),
    true,
    `formation save remains enabled after export; validation=${formationValidation}`
  );
  await formationSave.click();
  await page.waitForSelector('.cm-editor', { state: 'detached', timeout: 10000 });
  await page.waitForFunction(() => {
    const stored = JSON.parse(localStorage.getItem('wanko-battle.formation.v2') || 'null');
    return stored?.options?.characterModifications?.['dog-enemy-000']?.stats?.maxHp === 500000;
  });
  await page.waitForFunction(
    () => document.activeElement?.matches?.('[data-character-modification-open]'),
    null,
    { timeout: 10000 }
  );

  await page.locator('[data-character-modification-open]').click();
  await page.waitForSelector('.cm-editor', { state: 'visible' });
  await page.locator('[data-cm-field="stats.speed"] input').fill('123');
  await page.locator('[data-cm-field="stats.speed"] input').evaluate((input) => input.blur());
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('.cm-footer [data-cm-action="cancel"]').click();
  await page.waitForSelector('.cm-editor', { state: 'detached', timeout: 10000 });
  const discarded = await page.evaluate(() => (
    JSON.parse(localStorage.getItem('wanko-battle.formation.v2'))
      .options.characterModifications['dog-enemy-000']
  ));
  assert.equal(discarded.stats.speed, undefined, 'formation cancel discards draft changes');

  await page.locator('[data-character-modification-open]').click();
  await page.waitForSelector('.cm-editor', { state: 'visible' });
  await page.keyboard.press('Escape');
  await page.waitForSelector('.cm-editor', { state: 'detached', timeout: 10000 });
  await page.waitForFunction(
    () => document.activeElement?.matches?.('[data-character-modification-open]'),
    null,
    { timeout: 10000 }
  );

  await page.locator('[data-character-modification-open]').click();
  await page.waitForSelector('.cm-editor', { state: 'visible' });
  const pack = JSON.stringify({
    type: 'rhg-character-modification-pack',
    version: 1,
    entries: [{ characterId: 'dog-enemy-000', modificationRef: 'm1' }],
    modifications: {
      m1: {
        schemaVersion: 1,
        stats: { maxHp: 777777 },
        unknownImportedField: { ignored: true }
      }
    }
  });
  const chooserEvent = page.waitForEvent('filechooser');
  await page.locator('[data-cm-action="import"]').click();
  const chooser = await chooserEvent;
  await chooser.setFiles({
    name: 'character-modification-pack.json',
    mimeType: 'application/json',
    buffer: Buffer.from(pack)
  });
  await page.waitForSelector('.cm-import-preview:not([hidden])', { state: 'visible' });
  const formationPreviewText = await page.locator('.cm-preview-body').textContent();
  assert.match(
    formationPreviewText,
    /警告|unknownImportedField/,
    'unknown imported field is shown as a warning'
  );
  assert.match(
    formationPreviewText,
    /上書きされるキャラクター/,
    'formation import preview identifies overwritten characters'
  );
  assert.match(
    formationPreviewText,
    /ID: dog-enemy-000/,
    'formation import preview includes the overwritten character name and id'
  );
  await page.locator('[data-cm-action="preview-apply"]').click();
  await page.waitForFunction(() => (
    JSON.parse(localStorage.getItem('wanko-battle.formation.v2'))
      ?.options?.characterModifications?.['dog-enemy-000']?.stats?.maxHp === 777777
  ));

  const fieldList = page.locator('.cm-field-list');
  const preservedScrollTop = await fieldList.evaluate((node) => {
    node.scrollTop = Math.min(140, Math.max(0, node.scrollHeight - node.clientHeight));
    return node.scrollTop;
  });
  assert.ok(preservedScrollTop > 0, 'field list has a scroll position to preserve');
  for (const [width, height, label] of VIEWPORTS) {
    await assertViewport(page, width, height, `formation ${label} ${width}x${height}`);
    assert.ok(
      Math.abs(await fieldList.evaluate((node) => node.scrollTop) - preservedScrollTop) <= 1,
      `${label}: resize preserves field-list scroll position`
    );
    assert.equal(
      await page.locator('[data-cm-field="stats.maxHp"] input').inputValue(),
      '777777',
      `${label}: orientation/resize preserves draft value`
    );
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '20px'; });
  await assertViewport(page, 390, 844, 'formation enlarged text');
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reducedMotion = await page.locator('.cm-command').first().evaluate((node) => ({
    transition: getComputedStyle(node).transitionDuration,
    animation: getComputedStyle(node).animationDuration
  }));
  assert.equal(reducedMotion.transition, '0s', 'reduced motion disables transitions');
  assert.equal(reducedMotion.animation, '0s', 'reduced motion disables animations');

  const hpInput = page.locator('[data-cm-field="stats.maxHp"] input');
  await hpInput.focus();
  await page.setViewportSize({ width: 390, height: 500 });
  await hpInput.evaluate((node) => node.scrollIntoView({ block: 'center' }));
  await assertViewport(page, 390, 500, 'formation software-keyboard-height');
  const inputRect = await hpInput.boundingBox();
  assert.ok(
    inputRect && inputRect.y >= 0 && inputRect.y + inputRect.height <= 500,
    `focused input remains visible ${JSON.stringify(inputRect)}`
  );
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  await page.setViewportSize({ width: 1280, height: 900 });
  await mkdir(OUT_DIR, { recursive: true });
  await page.screenshot({ path: `${OUT_DIR}/formation-editor-desktop.png`, fullPage: false });
  await page.locator('.cm-footer [data-cm-action="cancel"]').click();
  await page.waitForSelector('.cm-editor', { state: 'detached', timeout: 10000 });
  await page.locator('.formation-tuning-close').click();
  await page.waitForSelector('.formation-tuning-overlay.is-open', {
    state: 'detached',
    timeout: 10000
  });
}

async function setValidCustomStageAssets(page) {
  await page.evaluate(() => {
    const editor = document.querySelector('.formation-ui')?.__formationEditor;
    const state = editor?.getCustomStageBuilderState?.();
    const db = globalThis.__BCU_DB__;
    const background = db?.backgrounds?.list?.()?.[0];
    const castle = (db?.castles?.enemy?.list?.() || db?.castles?.list?.() || [])[0];
    if (!state?.stage || !background || !castle) throw new Error('Custom-stage asset catalog is unavailable');
    state.stage.name = 'Character modification UI stage';
    state.stage.battle.backgroundId = background.id;
    state.stage.battle.enemyCastleId = castle.numericId ?? castle.id;
    state.stage.battle.musicId = null;
  });
}

async function customStageWorkflow(page) {
  await page.setViewportSize({ width: 667, height: 320 });
  await page.locator('[data-action="stage-open"]').click();
  await page.waitForSelector('[data-custom-stage-category]', { state: 'visible', timeout: 20000 });
  await page.locator('[data-custom-stage-category]').click();
  await page.waitForSelector('[data-custom-builder-new]', { state: 'visible' });
  await page.locator('[data-custom-builder-new]').click();
  await page.locator('[data-custom-builder-tab="enemy"]').click();
  await page.locator('[data-custom-spawn-add]').click();
  await page.waitForSelector('.formation-custom-spawn-modal-card', { state: 'visible' });
  const embeddedScrollBefore = await page.evaluate(() => ({
    htmlOverflow: document.documentElement.style.overflow,
    bodyOverflow: document.body.style.overflow
  }));
  await installMockVisualViewport(page, { height: 320 });
  await page.locator('[data-custom-spawn-modification-open]').click();
  await page.waitForSelector('.cm-editor', { state: 'visible', timeout: 30000 });
  await assertAccessibility(page, 'custom-stage embedded');
  assert.equal(await page.locator('.cm-overlay').count(), 0, 'custom-stage uses no unrelated fixed overlay');
  assert.equal(
    await page.locator('.formation-custom-spawn-modal-card.cm-embedded-container').count(),
    1,
    'custom-stage reuses the existing modal host'
  );
  const embeddedIsolation = await page.evaluate(() => {
    const modal = document.querySelector('.formation-custom-spawn-modal');
    const card = modal?.querySelector('.formation-custom-spawn-modal-card');
    const layer = card?.querySelector(':scope > .cm-host-layer-embedded');
    const backdrop = modal?.querySelector('.formation-custom-spawn-modal-backdrop');
    const hiddenChildren = [...(card?.children || [])].filter((child) => child !== layer);
    let bubbledPointerCount = 0;
    const onPointer = () => { bubbledPointerCount += 1; };
    modal?.addEventListener('pointerdown', onPointer);
    card?.querySelector('[data-cm-field]')?.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, cancelable: true })
    );
    modal?.removeEventListener('pointerdown', onPointer);
    backdrop?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return {
      backdropInert: backdrop?.inert,
      backdropAriaHidden: backdrop?.getAttribute('aria-hidden'),
      hiddenChildrenIsolated: hiddenChildren.every((child) => (
        child.hidden && child.inert && child.getAttribute('aria-hidden') === 'true'
      )),
      htmlOverflow: document.documentElement.style.overflow,
      bodyOverflow: document.body.style.overflow,
      bubbledPointerCount,
      editorStillConnected: !!document.querySelector('.cm-editor'),
      modalStillConnected: !!document.querySelector('.formation-custom-spawn-modal')
    };
  });
  assert.equal(embeddedIsolation.backdropInert, true, 'embedded editor inerts the existing modal backdrop');
  assert.equal(embeddedIsolation.backdropAriaHidden, 'true', 'embedded editor hides the backdrop from assistive technology');
  assert.equal(embeddedIsolation.hiddenChildrenIsolated, true, 'embedded editor isolates the prior modal content');
  assert.equal(embeddedIsolation.htmlOverflow, 'hidden', 'embedded editor locks documentElement scrolling');
  assert.equal(embeddedIsolation.bodyOverflow, 'hidden', 'embedded editor locks body scrolling');
  assert.equal(embeddedIsolation.bubbledPointerCount, 0, 'embedded editor pointer events do not reach the outer modal');
  assert.equal(embeddedIsolation.editorStillConnected, true, 'backdrop cannot bypass editor close handling');
  assert.equal(embeddedIsolation.modalStillConnected, true, 'backdrop cannot destroy the reused modal host');
  assert.match(
    await page.locator('.cm-subject-title').textContent(),
    /敵spawn row 1.*HP倍率 100%.*攻撃倍率 100%/s,
    'custom-stage header identifies the row and enemy multipliers'
  );
  const missingRowUpdate = await page.evaluate(() => {
    const editor = document.querySelector('.formation-ui')?.__formationEditor;
    const state = editor?.getCustomStageBuilderState?.();
    const before = JSON.stringify(state?.stage);
    const result = editor?.setCustomStageSpawnCharacterModification?.(
      'missing-row',
      { stats: { maxHp: 999999 } }
    );
    return { result, unchanged: before === JSON.stringify(state?.stage) };
  });
  assert.equal(missingRowUpdate.result?.ok, false, 'builder reports a missing spawn row as failure');
  assert.equal(missingRowUpdate.result?.code, 'custom-stage-spawn-not-found');
  assert.equal(missingRowUpdate.unchanged, true, 'builder leaves its draft unchanged after a missing-row update');
  await assertViewport(page, 667, 320, 'custom-stage low-height landscape');
  await page.evaluate(() => {
    globalThis.__cmSetMockVisualViewport({ height: 220, offsetTop: 40 });
  });
  await page.waitForTimeout(120);
  const keyboardViewport = await page.evaluate(() => {
    const layer = document.querySelector('.cm-host-layer-embedded')?.getBoundingClientRect();
    const dialog = document.querySelector('.cm-dialog')?.getBoundingClientRect();
    const footer = document.querySelector('.cm-footer:not([hidden])')?.getBoundingClientRect();
    return {
      layer: layer && { top: layer.top, bottom: layer.bottom },
      dialog: dialog && { top: dialog.top, bottom: dialog.bottom },
      footer: footer && { top: footer.top, bottom: footer.bottom }
    };
  });
  for (const [name, rect] of Object.entries(keyboardViewport)) {
    assert.ok(rect, `custom-stage visualViewport keyboard: ${name} is visible`);
    assert.ok(
      rect.top >= 39 && rect.bottom <= 261,
      `custom-stage visualViewport keyboard: ${name} fits ${JSON.stringify(rect)}`
    );
  }
  await page.evaluate(() => {
    globalThis.__cmSetMockVisualViewport({ height: innerHeight, offsetTop: 0 });
  });
  await page.waitForTimeout(120);

  const hp = page.locator('[data-cm-field="stats.maxHp"] input');
  await hp.fill('123456');
  await hp.blur();
  await page.evaluate((draftKey) => {
    const prototype = Object.getPrototypeOf(localStorage);
    globalThis.__cmOriginalDraftSetItem = prototype.setItem;
    globalThis.__cmDraftStorageFailures = [];
    globalThis.__cmDraftStorageFailureHandler = (event) => {
      globalThis.__cmDraftStorageFailures.push(event.detail);
    };
    globalThis.addEventListener('wanko-storage-error', globalThis.__cmDraftStorageFailureHandler);
    prototype.setItem = function setItemWithDraftFailure(key, value) {
      if (key === draftKey) throw new DOMException('draft quota', 'QuotaExceededError');
      return globalThis.__cmOriginalDraftSetItem.call(this, key, value);
    };
  }, CUSTOM_STAGE_DRAFT_KEY);
  await page.locator('[data-cm-action="save"]').click();
  await page.waitForSelector('.cm-editor', { state: 'detached', timeout: 10000 });
  await page.evaluate(() => globalThis.__cmRestoreVisualViewport());
  await page.waitForFunction(() => {
    const editor = document.querySelector('.formation-ui')?.__formationEditor;
    const state = editor?.getCustomStageBuilderState?.();
    const ref = state?.stage?.spawns?.[0]?.modificationRef;
    return state?.stage?.modifications?.[ref]?.stats?.maxHp === 123456;
  });
  await page.waitForFunction(() => (
    document.querySelector('.formation-custom-toast')?.textContent?.includes('一時保存に失敗')
  ));
  const draftWriteFailure = await page.evaluate(() => ({
    status: document.querySelector('.formation-custom-status')?.textContent,
    diagnostic: globalThis.__cmDraftStorageFailures?.at(-1)
  }));
  assert.match(draftWriteFailure.status || '', /一時保存失敗/, 'draft write failure is visible in builder status');
  assert.equal(draftWriteFailure.diagnostic?.scope, 'custom-stage-draft');
  assert.equal(draftWriteFailure.diagnostic?.op, 'write');
  await page.evaluate(() => {
    const prototype = Object.getPrototypeOf(localStorage);
    prototype.setItem = globalThis.__cmOriginalDraftSetItem;
    globalThis.removeEventListener(
      'wanko-storage-error',
      globalThis.__cmDraftStorageFailureHandler
    );
    delete globalThis.__cmOriginalDraftSetItem;
    delete globalThis.__cmDraftStorageFailureHandler;
    delete globalThis.__cmDraftStorageFailures;
  });
  assert.equal(
    await page.locator('.formation-custom-spawn-modal-card').count(),
    1,
    'spawn modal is restored after embedded editor closes'
  );
  const restoredModal = await page.evaluate(() => {
    const card = document.querySelector('.formation-custom-spawn-modal-card');
    const restoredChildren = [...(card?.children || [])];
    return {
      childrenRestored: restoredChildren.every((child) => (
        !child.hidden && !child.inert && child.getAttribute('aria-hidden') !== 'true'
      )),
      htmlOverflow: document.documentElement.style.overflow,
      bodyOverflow: document.body.style.overflow
    };
  });
  assert.equal(restoredModal.childrenRestored, true, 'closing embedded editor restores the spawn modal content');
  assert.deepEqual(
    {
      htmlOverflow: restoredModal.htmlOverflow,
      bodyOverflow: restoredModal.bodyOverflow
    },
    embeddedScrollBefore,
    'closing embedded editor restores the prior document scroll styles'
  );
  await setValidCustomStageAssets(page);
  await page.locator('[data-custom-spawn-modal-close]').last().click();
  await page.evaluate((draftKey) => {
    const prototype = Object.getPrototypeOf(localStorage);
    globalThis.__cmOriginalDraftRemoveItem = prototype.removeItem;
    globalThis.__cmDraftStorageFailures = [];
    globalThis.__cmDraftStorageFailureHandler = (event) => {
      globalThis.__cmDraftStorageFailures.push(event.detail);
    };
    globalThis.addEventListener('wanko-storage-error', globalThis.__cmDraftStorageFailureHandler);
    prototype.removeItem = function removeItemWithDraftFailure(key) {
      if (key === draftKey) throw new DOMException('draft clear denied', 'SecurityError');
      return globalThis.__cmOriginalDraftRemoveItem.call(this, key);
    };
  }, CUSTOM_STAGE_DRAFT_KEY);
  await page.locator('[data-custom-builder-save]').click();
  await page.waitForFunction(() => (
    document.querySelector('.formation-custom-status')?.textContent?.includes('一時保存の削除失敗')
  ));
  const draftClearFailure = await page.evaluate(() => ({
    status: document.querySelector('.formation-custom-status')?.textContent,
    diagnostic: globalThis.__cmDraftStorageFailures?.at(-1)
  }));
  assert.match(draftClearFailure.status || '', /一時保存の削除失敗/, 'draft clear failure is visible after stage save');
  assert.equal(draftClearFailure.diagnostic?.scope, 'custom-stage-draft');
  assert.equal(draftClearFailure.diagnostic?.op, 'clear');
  await page.evaluate(() => {
    const prototype = Object.getPrototypeOf(localStorage);
    prototype.removeItem = globalThis.__cmOriginalDraftRemoveItem;
    globalThis.removeEventListener(
      'wanko-storage-error',
      globalThis.__cmDraftStorageFailureHandler
    );
    delete globalThis.__cmOriginalDraftRemoveItem;
    delete globalThis.__cmDraftStorageFailureHandler;
    delete globalThis.__cmDraftStorageFailures;
  });
  await page.locator('[data-custom-builder-save]').click();
  await page.waitForFunction(() => {
    const envelope = JSON.parse(localStorage.getItem('wanko.customStages.v1') || 'null');
    return envelope?.stages?.[0]?.schemaVersion === 3
      && envelope.stages[0].challengeRestrictions === null
      && Object.keys(envelope.stages[0].modifications || {}).length === 1;
  });

  const savedStage = await page.evaluate(() => (
    JSON.parse(localStorage.getItem('wanko.customStages.v1')).stages[0]
  ));
  const savedRef = savedStage.spawns[0].modificationRef;
  assert.equal(savedStage.modifications[savedRef].stats.maxHp, 123456);

  await page.locator('[data-custom-builder-tab="enemy"]').click();
  await page.locator('button[data-custom-spawn-toggle="0"]').click();
  await page.locator('[data-custom-spawn-modification-open]').click();
  await page.waitForSelector('.cm-editor', { state: 'visible' });
  await page.locator('[data-cm-field="stats.maxHp"] input').fill('654321');
  await page.locator('[data-cm-field="stats.maxHp"] input').blur();
  await page.locator('[data-cm-action="save"]').click();
  await page.waitForSelector('.cm-editor', { state: 'detached', timeout: 10000 });
  await page.locator('[data-custom-spawn-modal-close]').last().click();
  await page.evaluate((draftKey) => {
    const prototype = Object.getPrototypeOf(localStorage);
    globalThis.__cmOriginalDraftRemoveItem = prototype.removeItem;
    prototype.removeItem = function removeItemWithDraftFailure(key) {
      if (key === draftKey) throw new DOMException('draft clear denied', 'SecurityError');
      return globalThis.__cmOriginalDraftRemoveItem.call(this, key);
    };
  }, CUSTOM_STAGE_DRAFT_KEY);
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('[data-custom-builder-back]').click();
  assert.equal(
    await page.locator('.formation-custom-builder-screen').count(),
    1,
    'builder stays open when its persisted draft cannot be discarded'
  );
  assert.match(
    await page.locator('.formation-custom-status').textContent(),
    /一時保存の削除失敗/,
    'builder close exposes persisted-draft cleanup failure'
  );
  await page.evaluate(() => {
    const prototype = Object.getPrototypeOf(localStorage);
    prototype.removeItem = globalThis.__cmOriginalDraftRemoveItem;
    delete globalThis.__cmOriginalDraftRemoveItem;
  });
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('[data-custom-builder-back]').click();
  await page.waitForSelector('[data-custom-builder-new]', { state: 'visible' });
  const afterDiscard = await page.evaluate(() => ({
    stage: JSON.parse(localStorage.getItem('wanko.customStages.v1')).stages[0],
    draft: localStorage.getItem('wanko.customStageDraft.v1')
  }));
  assert.equal(
    afterDiscard.stage.modifications[afterDiscard.stage.spawns[0].modificationRef].stats.maxHp,
    123456,
    'custom-stage cancel leaves the saved stage unchanged'
  );
  assert.equal(afterDiscard.draft, null, 'custom-stage cancel removes the self-persisted draft');

  const stageDownloadEvent = page.waitForEvent('download');
  await page.locator('[data-custom-builder-export]').click();
  const stageDownload = await stageDownloadEvent;
  const stageJson = await downloadText(stageDownload);
  const exported = JSON.parse(stageJson);
  assert.equal(exported.exportVersion, 3);
  assert.equal(exported.stage.schemaVersion, 3);
  assert.equal(exported.provenance, null);
  assert.equal(stageJson.includes('\n'), false, 'standard custom-stage export is minified');

  await page.locator('[data-custom-builder-import-file]').setInputFiles({
    name: 'custom-stage.json',
    mimeType: 'application/json',
    buffer: Buffer.from(stageJson)
  });
  await page.waitForSelector('.formation-custom-import-preview', { state: 'visible' });
  assert.match(
    await page.locator('.formation-custom-import-preview').textContent(),
    /読み込み内容を確認/,
    'custom-stage import shows a preview before commit'
  );
  const stagePreviewText = await page.locator('.formation-custom-import-preview').textContent();
  for (const requiredText of [
    '追加されるstage',
    '上書きされるstage',
    '敵spawn row',
    '改造データ',
    '変更フィールド',
    'マイグレーション',
    '警告',
    'エラー'
  ]) {
    assert.match(stagePreviewText, new RegExp(requiredText), `custom-stage preview shows ${requiredText}`);
  }
  const immutableStagePreview = await page.evaluate(() => {
    const editor = document.querySelector('.formation-ui')?.__formationEditor;
    const preview = editor?.__customStageImportPreview;
    const before = preview?.stage?.name;
    try { preview.stage.name = 'mutated after preview'; } catch {}
    try { preview.stage.battle.stageLength = 0; } catch {}
    try { preview.stage = { name: 'replacement' }; } catch {}
    return {
      transactionFrozen: Object.isFrozen(preview),
      stageFrozen: Object.isFrozen(preview?.stage),
      battleFrozen: Object.isFrozen(preview?.stage?.battle),
      nameUnchanged: preview?.stage?.name === before,
      stageLength: preview?.stage?.battle?.stageLength
    };
  });
  assert.equal(immutableStagePreview.transactionFrozen, true, 'custom-stage import transaction is immutable after preview');
  assert.equal(immutableStagePreview.stageFrozen, true, 'custom-stage import candidate is immutable after preview');
  assert.equal(immutableStagePreview.battleFrozen, true, 'nested stage data is immutable after preview');
  assert.equal(immutableStagePreview.nameUnchanged, true, 'preview mutation cannot replace the imported stage');
  assert.ok(immutableStagePreview.stageLength > 0, 'preview mutation cannot invalidate nested stage data');
  await page.locator('[data-custom-builder-import-commit]').click();
  await page.waitForFunction(() => (
    JSON.parse(localStorage.getItem('wanko.customStages.v1'))?.stages?.length === 2
  ));

  await page.screenshot({ path: `${OUT_DIR}/custom-stage-list-landscape.png`, fullPage: false });
}

await mkdir(OUT_DIR, { recursive: true });
const port = await findFreePort();
const server = await createViteServer({
  root: process.cwd(),
  logLevel: 'error',
  server: { host: '127.0.0.1', port, strictPort: true }
});
await server.listen();
const url = `http://127.0.0.1:${port}/`;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const browserErrors = [];
page.on('pageerror', (error) => browserErrors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') browserErrors.push(message.text());
});

try {
  await waitForFormation(page, url);
  await formationWorkflow(page);
  await customStageWorkflow(page);
  assert.deepEqual(browserErrors, [], `browser console errors:\n${browserErrors.join('\n')}`);
} finally {
  await page.close();
  await browser.close();
  await server.close();
}

console.log(JSON.stringify({
  ok: true,
  checks: ['formation', 'custom-stage', 'responsive', 'accessibility', 'import-export'],
  viewports: VIEWPORTS.map(([width, height, label]) => ({ width, height, label })),
  screenshots: OUT_DIR
}, null, 2));
