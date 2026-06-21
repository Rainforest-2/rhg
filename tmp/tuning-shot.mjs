import { chromium } from 'playwright';
const SHELL='/home/codespace/.cache/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell';
const vp=(process.argv[2]||'860x312').split('x').map(Number); const dpr=Number(process.argv[3]||2.625); const sfx=process.argv[4]||'';
const browser = await chromium.launch({ executablePath: SHELL });
const page = await browser.newPage({ viewport:{width:vp[0],height:vp[1]}, deviceScaleFactor:dpr, isMobile:true, hasTouch:true });
const errors=[]; page.on('pageerror',e=>errors.push('PAGEERR '+e.message));
await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>!!globalThis.__APP__||!!document.querySelector('.apply-battle-button'),null,{timeout:120000});
await page.waitForTimeout(2500);
// long-press first occupied slot
const box = await page.evaluate(()=>{
  const slots=[...document.querySelectorAll('.formation-slot[data-slot]')];
  const occ = slots.find(s=>s.querySelector('img')) || slots[0];
  if(!occ) return null; const r=occ.getBoundingClientRect();
  return {x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2)};
});
if(box){
  await page.evaluate(({x,y})=>{ const el=document.elementFromPoint(x,y); const ev=t=>el.dispatchEvent(new PointerEvent(t,{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'touch',isPrimary:true,button:0})); ev('pointerdown'); window.__lpEl=el; window.__lpXY={x,y}; },box);
  await page.waitForTimeout(680);
  await page.evaluate(()=>{ const {x,y}=window.__lpXY; const el=window.__lpEl; el.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'touch',isPrimary:true,button:0})); });
  await page.waitForTimeout(600);
}
const open = await page.evaluate(()=>!!document.querySelector('.formation-tuning-overlay.is-open'));
await page.screenshot({path:`tmp/ui-explore/m-tuning-${vp[0]}x${vp[1]}${sfx}.png`});
console.log('box',box,'tuningOpen',open,'errors',errors.slice(0,4));
await browser.close();
