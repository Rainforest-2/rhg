import { chromium } from 'playwright';
const SHELL='/home/codespace/.cache/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell';
const vp = (process.argv[2]||'860x312').split('x').map(Number);
const dpr = Number(process.argv[3]||2.625);
const sfx = process.argv[4]||'';
const browser = await chromium.launch({ executablePath: SHELL });
const page = await browser.newPage({ viewport:{width:vp[0],height:vp[1]}, deviceScaleFactor:dpr, isMobile:true, hasTouch:true });
const errors=[]; page.on('pageerror',e=>errors.push('PAGEERR '+e.message));
await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>!!globalThis.__APP__||!!document.querySelector('.apply-battle-button'),null,{timeout:120000});
await page.waitForTimeout(2500);
const dir='tmp/ui-explore/';
const T=`${vp[0]}x${vp[1]}${sfx}`;
await page.screenshot({path:`${dir}m-formation-${T}.png`});
// open 本能 tuning overlay via the editor API on slot 0
const opened = await page.evaluate(()=>{
  const ed = globalThis.__APP__?.formationEditor; if(!ed) return 'no-editor';
  try{
    const f = ed.formation || ed.store?.formation || null;
    let id = null;
    if(Array.isArray(f)) id = f.find(x=>x!=null);
    if(id==null){ const slot=document.querySelector('.formation-slot[data-slot]'); id = slot?.dataset?.characterId || null; }
    if(typeof ed.openCharacterTuningOverlay==='function'){ ed.openCharacterTuningOverlay(id ?? undefined, 0); return 'api:'+id; }
    return 'no-method';
  }catch(e){return 'err:'+e.message;}
});
await page.waitForTimeout(700);
const hasOverlay = await page.evaluate(()=>!!document.querySelector('.formation-tuning-overlay.is-open'));
await page.screenshot({path:`${dir}m-tuning-${T}.png`});
console.log('tuning open:',opened,'visible:',hasOverlay);
// close overlay then open stage select
await page.evaluate(()=>{ document.querySelector('.formation-tuning-overlay')?.classList.remove('is-open'); const b=document.querySelector("[data-action='stage-open'],.stage-select-button"); b&&b.click(); });
await page.waitForTimeout(900);
await page.screenshot({path:`${dir}m-category-${T}.png`});
// click first category card to get to map list
const cat = await page.evaluate(()=>{ const c=document.querySelector('.formation-stage-card-category'); if(c){c.click();return c.textContent.slice(0,20);} return 'no-category-card'; });
await page.waitForTimeout(900);
await page.screenshot({path:`${dir}m-map-${T}.png`});
console.log('category:',cat,'errors:',errors.slice(0,4));
await browser.close();
