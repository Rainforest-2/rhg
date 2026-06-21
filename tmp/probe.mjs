import { chromium } from 'playwright';
const SHELL='/home/codespace/.cache/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await chromium.launch({ executablePath: SHELL });
const page = await browser.newPage({ viewport:{width:1290,height:600}, deviceScaleFactor:1.75, isMobile:true, hasTouch:true });
await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>!!globalThis.__APP__||!!document.querySelector('.apply-battle-button'),null,{timeout:120000});
await page.waitForTimeout(2500);
// which media queries match
const mq = await page.evaluate(()=>({
  w:innerWidth,h:innerHeight,dpr:devicePixelRatio,
  mw980:matchMedia('(max-width:980px)').matches,
  mw760:matchMedia('(max-width:760px)').matches,
  mh560L:matchMedia('(max-height:560px) and (orientation:landscape)').matches,
  mh470L:matchMedia('(max-height:470px) and (orientation:landscape)').matches,
  fontsReady: document.fonts ? document.fonts.status : 'n/a',
  loadedFonts: document.fonts ? [...document.fonts].map(f=>f.family+':'+f.status).slice(0,10) : [],
}));
console.log(JSON.stringify(mq,null,2));
await page.screenshot({path:'tmp/ui-explore/formation-1290x600.png'});
await browser.close();
