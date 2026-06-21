import { chromium } from 'playwright';
const SHELL='/home/codespace/.cache/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell';
const vp=(process.argv[2]||'860x312').split('x').map(Number); const dpr=Number(process.argv[3]||2);
const browser = await chromium.launch({ executablePath: SHELL });
const page = await browser.newPage({ viewport:{width:vp[0],height:vp[1]}, deviceScaleFactor:dpr, isMobile:true, hasTouch:true });
const errors=[]; page.on('pageerror',e=>errors.push('PAGEERR '+e.message));
await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>!!globalThis.__APP__||!!document.querySelector('.apply-battle-button'),null,{timeout:120000});
await page.waitForTimeout(1500);
await page.click('.apply-battle-button');
await page.waitForFunction(()=>{const a=globalThis.__APP__||globalThis.app;return !!(a?.sceneReady&&a?.battleScene);},null,{timeout:180000}).catch(()=>{});
await page.waitForTimeout(2800);
await page.screenshot({path:`tmp/ui-explore/b-${vp[0]}x${vp[1]}.png`});
const info=await page.evaluate(()=>{
  const a=globalThis.__APP__; const cam=a?.battleScene?.camera; const r=a?.renderer;
  const cards=document.querySelector('.prod-ui .cards'); const cb=cards?.getBoundingClientRect();
  const cannon=document.querySelector('.cat-cannon-fire'); const cnb=cannon?.getBoundingClientRect();
  return { logicalW:r?.logicalW, logicalH:r?.logicalH, camLogicalW:cam?.logicalW, camSiz:cam?.siz,
    cardsBottomVisible: cb? (cb.bottom <= innerHeight+1 && cb.top>=0) : null, cardsRect: cb?{y:Math.round(cb.y),bottom:Math.round(cb.bottom),h:Math.round(cb.height)}:null,
    cannonVisible: cnb? (cnb.bottom<=innerHeight+1):null, innerH:innerHeight };
});
console.log(vp.join('x'),JSON.stringify(info),'err',errors.slice(0,3));
await browser.close();
