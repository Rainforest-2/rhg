import { chromium } from 'playwright';
const SHELL='/home/codespace/.cache/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await chromium.launch({ executablePath: SHELL });
const ctx = await browser.newContext({ viewport:{width:860,height:312}, deviceScaleFactor:2.625, isMobile:true, hasTouch:true });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>!!globalThis.__APP__,null,{timeout:120000});
await page.waitForTimeout(1500);
await page.click('.apply-battle-button');
await page.waitForFunction(()=>{const a=globalThis.__APP__;return !!(a?.sceneReady&&a?.battleScene);},null,{timeout:180000});
await page.waitForTimeout(6000);
const before = await page.evaluate(()=>globalThis.__APP__?.battleScene?.actors?.length);
const pos = await page.evaluate(()=>{const c=document.querySelector('.prod-card.is-front[data-col]');const r=c.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});
// REAL touch tap through browser input (honors setPointerCapture)
await page.touchscreen.tap(pos.x, pos.y);
await page.waitForTimeout(1200);
const after = await page.evaluate(()=>globalThis.__APP__?.battleScene?.actors?.length);
console.log('REAL TAP: actors before',before,'after',after, after>before?'=> SPAWNED OK':'=> NO SPAWN (touch bug)');
await browser.close();
