// Shared visual-review harness. Boots the real static app in headless Chromium,
// enters a battle for a chosen stage, and exposes helpers for screenshotting and
// inspecting battle-scene state. Used by the BCU parity visual-review scripts.
import { chromium } from 'playwright';

export const HEADLESS_SHELL =
  '/home/codespace/.cache/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell';
export const BASE = 'http://127.0.0.1:4173/';

export async function launch() {
  return chromium.launch({ executablePath: HEADLESS_SHELL });
}

export async function newApp(browser, { stageId, viewport } = {}) {
  const page = await browser.newPage({
    viewport: viewport || { width: 1180, height: 820 },
    deviceScaleFactor: 2,
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERR: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('CONSOLE: ' + m.text());
  });
  if (stageId) {
    await page.addInitScript((s) => {
      try { localStorage.setItem('bcu.selectedStageId', s); } catch {}
    }, stageId);
  }
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => !!globalThis.__APP__ || !!document.querySelector('.apply-battle-button'),
    null,
    { timeout: 120000 },
  );
  return { page, errors };
}

export async function startBattle(page) {
  await page.waitForSelector('.apply-battle-button', { timeout: 120000 });
  await page.waitForTimeout(1200);
  await page.click('.apply-battle-button');
  await page.waitForFunction(
    () => {
      const app = globalThis.__APP__ || globalThis.app;
      return !!(app?.sceneReady && app?.battleScene);
    },
    null,
    { timeout: 180000 },
  );
  await page.waitForTimeout(1500);
}

// Repeatedly tap the front production card to deploy units for `seconds`.
export async function produceLoop(page, seconds, everyMs = 600) {
  const end = Date.now() + seconds * 1000;
  while (Date.now() < end) {
    await page.evaluate(() => {
      const btn = document.querySelector('.prod-card.is-front:not(.is-disabled)');
      if (btn) {
        btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        btn.click();
      }
    });
    await page.waitForTimeout(everyMs);
  }
}

export async function sceneSummary(page) {
  return page.evaluate(() => {
    const scene = globalThis.__APP__?.battleScene;
    if (!scene) return { error: 'no-scene' };
    const actors = (scene.actors || []).map((a) => ({
      id: a.instanceId || a.label,
      side: a.side,
      state: a.state,
      hp: a.hp,
    }));
    const byType = {};
    for (const e of scene.events || []) byType[e.type] = (byType[e.type] || 0) + 1;
    return {
      actorCount: actors.length,
      sides: actors.reduce((m, a) => ((m[a.side] = (m[a.side] || 0) + 1), m), {}),
      effectTypes: (scene.effects || []).map((e) => e.type),
      eventTypeCounts: byType,
    };
  });
}
