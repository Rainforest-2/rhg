import { chromium } from 'playwright';
const SHELL='/home/codespace/.cache/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await chromium.launch({ executablePath: SHELL });
const page = await browser.newPage({ viewport:{width:860,height:312}, deviceScaleFactor:2.625, isMobile:true, hasTouch:true });
const errors=[];
page.on('pageerror',e=>errors.push('PAGEERR '+e.message));
await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>!!globalThis.__APP__||!!document.querySelector('.apply-battle-button'),null,{timeout:120000});
await page.waitForTimeout(1500);
await page.click('.apply-battle-button');
await page.waitForFunction(()=>{const a=globalThis.__APP__||globalThis.app;return !!(a?.sceneReady&&a?.battleScene);},null,{timeout:180000}).catch(()=>{});
await page.waitForTimeout(2500);
await page.screenshot({path:'tmp/ui-explore/battle-860x312.png'});
// inspect canvas sizing
const info = await page.evaluate(()=>{
  const c=document.querySelector('#preview-canvas');
  const r=c?.getBoundingClientRect();
  const bar=document.querySelector('.player-production-bar,.production-bar,[class*="production"]');
  return {
    canvasCss: r?{w:Math.round(r.width),h:Math.round(r.height)}:null,
    canvasAttr: c?{w:c.width,h:c.height}:null,
    dpr: devicePixelRatio,
    inner:{w:innerWidth,h:innerHeight},
    barClass: bar?bar.className:null,
    barRect: bar?(()=>{const b=bar.getBoundingClientRect();return{x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height)};})():null,
  };
});
console.log(JSON.stringify(info,null,2));
console.log('errors', errors.slice(0,5));
await browser.close();
