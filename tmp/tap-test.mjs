import { chromium } from 'playwright';
const SHELL='/home/codespace/.cache/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await chromium.launch({ executablePath: SHELL });
const page = await browser.newPage({ viewport:{width:860,height:312}, deviceScaleFactor:2.625, isMobile:true, hasTouch:true });
await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>!!globalThis.__APP__,null,{timeout:120000});
await page.waitForTimeout(1500);
await page.click('.apply-battle-button');
await page.waitForFunction(()=>{const a=globalThis.__APP__;return !!(a?.sceneReady&&a?.battleScene);},null,{timeout:180000});
// wait for money to accumulate so front card is affordable
await page.waitForTimeout(6000);
const before = await page.evaluate(()=>({actors:globalThis.__APP__?.battleScene?.actors?.length, money:globalThis.__APP__?.battleScene?.economy?.money}));
// real touch tap on the front card (no move) via dispatched pointer events at card center
const tap = await page.evaluate(()=>{
  const card=document.querySelector('.prod-card.is-front[data-col]');
  if(!card) return {err:'no-front-card'};
  const r=card.getBoundingClientRect(); const x=r.x+r.width/2,y=r.y+r.height/2;
  const opts=t=>({bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:7,pointerType:'touch',isPrimary:true,button:0,buttons:t==='pointerdown'?1:0});
  card.dispatchEvent(new PointerEvent('pointerdown',opts('pointerdown')));
  card.dispatchEvent(new PointerEvent('pointerup',opts('pointerup')));
  return {ok:true, x:Math.round(x),y:Math.round(y), col:card.dataset.col};
});
await page.waitForTimeout(1200);
const after = await page.evaluate(()=>({actors:globalThis.__APP__?.battleScene?.actors?.length, money:globalThis.__APP__?.battleScene?.economy?.money, dbg:globalThis.__BATTLE_PRODUCTION_DEBUG__?.lastClick||globalThis.__APP__?.battleScene?.getProductionDebug?.()?.lastClick||null}));
console.log('tap',JSON.stringify(tap));
console.log('before',JSON.stringify(before));
console.log('after actors',after.actors,'money',after.money);
console.log('lastClick',JSON.stringify(after.dbg)?.slice(0,400));
await browser.close();
