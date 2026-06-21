import { chromium } from 'playwright';
const SHELL='/home/codespace/.cache/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await chromium.launch({ executablePath: SHELL });
async function shot(w,h,dpr,tag,injectFont){
  const page = await browser.newPage({ viewport:{width:w,height:h}, deviceScaleFactor:dpr, isMobile:true, hasTouch:true });
  if(injectFont){ await page.addInitScript(()=>{ const s=document.createElement('style'); s.textContent='html{font-size:'+22+'px !important}'; addEventListener('DOMContentLoaded',()=>document.head.appendChild(s)); }); }
  await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!globalThis.__APP__||!!document.querySelector('.apply-battle-button'),null,{timeout:120000});
  await page.waitForTimeout(2500);
  await page.screenshot({path:`tmp/ui-explore/${tag}.png`});
  await page.close();
  console.log('shot',tag);
}
await shot(850,500,2.2,'form-850x500');
await shot(860,312,2.625,'form-bigfont-860x312',true);
await browser.close();
