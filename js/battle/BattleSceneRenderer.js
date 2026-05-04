import { BATTLE_CONFIG } from './BattleConfig.js';

export class BattleSceneRenderer {
  render(previewRenderer, scene, showParts = false) {
    const c = previewRenderer.ctx; const w = previewRenderer.logicalW; const h = previewRenderer.logicalH; const groundY = scene?.groundY || BATTLE_CONFIG.visualLayout?.groundY || BATTLE_CONFIG.groundY || 590;
    c.clearRect(0, 0, w, h);
    if (scene?.stage?.background?.image && scene?.stage?.background?.crop) { if (BATTLE_CONFIG.stage.backgroundMode === 'bcu-stage0') this.drawBackgroundBcuStage0(c, scene.stage.background, w, h); else this.drawBackgroundCropCover(c, scene.stage.background, w, h); } else this.drawFallbackBackground(c, w, h, groundY);
    this.drawBases(c, scene?.bases || [], groundY, showParts);
    const actorsForRender = this.getAliveActorsForRender(scene);
    for (const actor of actorsForRender) this.drawActor(c, actor);
    if (Array.isArray(scene?.effects) && scene.effects.length) this.drawEffects(c, scene.effects);
    for (const actor of actorsForRender) this.drawHpBar(c, actor);
    for (const base of (scene?.bases || [])) this.drawBaseHpBar(c, base);
    if (showParts) { for (const actor of actorsForRender) this.drawActorDebug(c, actor, scene?.battleState || 'running'); this.drawEventLog(c, scene?.debugEvents || []); }
    this.drawHud(c, scene, showParts);
  }
  getActorLocalRenderBounds(actor){if(!actor?.sprite||!actor?.model)return null;const baseAngle=actor.model.baseAngle||3600;let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const p of actor.model.getDrawList()){const w=p.world;const partIndex=p.current?.partIndex??p.partIndex;const imgcutIndex=p.current?.imgcutIndex??p.imgcutIndex;if(!Number.isInteger(partIndex)||partIndex<0)continue;if((imgcutIndex??0)<0)continue;if(!w||(w.o??1)<=0)continue;const part=actor.sprite?.imgcut?.parts?.[partIndex];if(!part||part.w<=0||part.h<=0)continue;const cx=w.x*actor.scale,cy=w.y*actor.scale,sx=w.sx*actor.scale,sy=w.sy*actor.scale;const halfW=Math.abs(part.w*sx)*0.5,halfH=Math.abs(part.h*sy)*0.5;const angle=(w.a/baseAngle)*Math.PI*2,cos=Math.cos(angle),sin=Math.sin(angle);for(const [px,py] of [[-halfW,-halfH],[halfW,-halfH],[-halfW,halfH],[halfW,halfH]]){const rx=cx+px*cos-py*sin;const ry=cy+px*sin+py*cos;minX=Math.min(minX,rx);minY=Math.min(minY,ry);maxX=Math.max(maxX,rx);maxY=Math.max(maxY,ry);}}if(!Number.isFinite(minX)||!Number.isFinite(minY)||!Number.isFinite(maxX)||!Number.isFinite(maxY))return null;return{left:minX,top:minY,right:maxX,bottom:maxY,width:maxX-minX,height:maxY-minY};}
  getActorBottomAnchorOffset(actor){const bounds=this.getActorLocalRenderBounds(actor);if(!bounds)return 0;return -bounds.bottom;}
  getActorRenderDepthY(actor){return Number.isFinite(actor.y)?actor.y:0;}
  getAliveActorsForRender(scene){return (scene?.actors||[]).filter((actor)=>actor?.isAlive?.()).slice().sort((a,b)=>{const ay=this.getActorRenderDepthY(a);const by=this.getActorRenderDepthY(b);if(ay!==by)return ay-by;const ax=Number.isFinite(a.x)?a.x:0;const bx=Number.isFinite(b.x)?b.x:0;if(ax!==bx)return ax-bx;const at=Number.isFinite(a.spawnedAtMs)?a.spawnedAtMs:0;const bt=Number.isFinite(b.spawnedAtMs)?b.spawnedAtMs:0;return at-bt;});}

  rgb(color){return `rgb(${color.r},${color.g},${color.b})`;}
  drawVerticalGradient(c,x,y,w,h,top,bottom){const g=c.createLinearGradient(0,y,0,y+h);g.addColorStop(0,this.rgb(top));g.addColorStop(1,this.rgb(bottom));c.fillStyle=g;c.fillRect(x,y,w,h);}
  drawCropTiledX(c,image,crop,dx,dy,scale,targetW){const dw=crop.w*scale;const dh=crop.h*scale;if(dw<=0||dh<=0)return;let x=dx;while(x>0)x-=dw;while(x<targetW){c.drawImage(image,crop.x,crop.y,crop.w,crop.h,x,dy,dw,dh);x+=dw;}}
  drawCropTiledXWithTopFade(c,image,crop,dx,dy,scale,targetW,fadeHeight=0,step=4){const dw=crop.w*scale;const dh=crop.h*scale;if(dw<=0||dh<=0)return;let x0=dx;while(x0>0)x0-=dw;const fadePx=Math.max(0,Math.min(crop.h,fadeHeight||0));const strip=Math.max(1,step||4);for(let x=x0;x<targetW;x+=dw){if(fadePx>0){for(let sy=0;sy<fadePx;sy+=strip){const sh=Math.min(strip,fadePx-sy);const alpha=Math.max(0,Math.min(1,(sy+sh)/fadePx));c.save();c.globalAlpha=alpha;c.drawImage(image,crop.x,crop.y+sy,crop.w,sh,x,dy+sy*scale,dw,sh*scale);c.restore();}const restH=crop.h-fadePx;if(restH>0)c.drawImage(image,crop.x,crop.y+fadePx,crop.w,restH,x,dy+fadePx*scale,dw,restH*scale);}else{c.drawImage(image,crop.x,crop.y,crop.w,crop.h,x,dy,dw,dh);}}}
  drawBackgroundBcuStage0(c,bg,w,h){const colors=bg.colors;const crop=bg.crop;const image=bg.image;const layout=BATTLE_CONFIG.stage.backgroundLayout||{};if(!image||!crop||!colors){this.drawBackgroundCropCover(c,bg,w,h);return;}const scale=Number.isFinite(layout.cropScale)?layout.cropScale:1.0;const dx=Number.isFinite(layout.cropOffsetX)?layout.cropOffsetX:0;const dy=Number.isFinite(layout.cropOffsetY)?layout.cropOffsetY:130;const fadeHeight=Number.isFinite(layout.cropTopFadeHeight)?layout.cropTopFadeHeight:0;const fadeStep=Number.isFinite(layout.cropTopFadeStep)?layout.cropTopFadeStep:4;const cropBottomY=dy+crop.h*scale;this.drawVerticalGradient(c,0,0,w,h,colors.skyTop,colors.skyBottom);if(layout.tileX!==false)this.drawCropTiledXWithTopFade(c,image,crop,dx,dy,scale,w,fadeHeight,fadeStep);else this.drawCropTiledXWithTopFade(c,image,crop,dx,dy,scale,dx+crop.w*scale,fadeHeight,fadeStep);if(cropBottomY<h)this.drawVerticalGradient(c,0,cropBottomY,w,h-cropBottomY,colors.groundTop,colors.groundBottom);}
  drawBackgroundCropCover(c,bg,w,h){const{image,crop}=bg;const scale=Math.max(w/crop.w,h/crop.h);const dw=crop.w*scale,dh=crop.h*scale;const dx=(w-dw)*0.5;const alignY=Number.isFinite(BATTLE_CONFIG.visualLayout?.backgroundVerticalAlign)?BATTLE_CONFIG.visualLayout.backgroundVerticalAlign:0.5;const dy=(h-dh)*alignY;c.drawImage(image,crop.x,crop.y,crop.w,crop.h,dx,dy,dw,dh)}
  drawFallbackBackground(c,w,h,groundY){const sky=c.createLinearGradient(0,0,0,groundY);sky.addColorStop(0,'#7dc7ff');sky.addColorStop(1,'#d9f0ff');c.fillStyle=sky;c.fillRect(0,0,w,groundY);c.fillStyle='#c9b78f';c.fillRect(0,groundY,w,h-groundY)}

  getCompositeBaseLocalBounds(base) {
    const layers = base?.layers || [];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const layer of layers) {
      if (!layer?.image) continue;
      const offsetX = layer.offsetX || 0;
      const offsetY = layer.offsetY || 0;

      const x1 = offsetX - layer.image.width * 0.5;
      const y1 = offsetY - layer.image.height;
      const x2 = offsetX + layer.image.width * 0.5;
      const y2 = offsetY;

      minX = Math.min(minX, x1);
      minY = Math.min(minY, y1);
      maxX = Math.max(maxX, x2);
      maxY = Math.max(maxY, y2);
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return null;
    return { left: minX, top: minY, right: maxX, bottom: maxY, width: maxX - minX, height: maxY - minY };
  }

  getBaseVisualYOffset(base) {
    if (!base?.visualBottomToCurrentCenter) return 0;
    if (base.visualKind !== 'castle-composite') return 0;

    const bounds = this.getCompositeBaseLocalBounds(base);
    if (!bounds) return 0;

    const s = base.scale || 1;
    return -bounds.height * s * 0.5;
  }
  drawBases(c,bases,groundY,showParts){for(const base of bases) this.drawBase(c,base,groundY,showParts)}
  drawBase(c,base,groundY,showParts){ if(base.visualKind==='castle-composite'&&base.layers?.length){ const visualYOffset = this.getBaseVisualYOffset(base); for(const layer of base.layers){const s=base.scale||1;const x=base.x+(layer.offsetX||0)*s-layer.image.width*0.5*s;const y=base.y+visualYOffset+(layer.offsetY||0)*s-layer.image.height*s;c.drawImage(layer.image,x,y,layer.image.width*s,layer.image.height*s);} } else { const pw=BATTLE_CONFIG.visualLayout?.catBasePlaceholder?.width??100; const ph=BATTLE_CONFIG.visualLayout?.catBasePlaceholder?.height??80; const ly=BATTLE_CONFIG.visualLayout?.catBasePlaceholder?.labelYOffset??8; c.fillStyle='#374151'; c.fillRect(base.x-pw*0.5, base.y-ph, pw, ph); c.fillStyle='#e5e7ebcc'; c.fillText('CAT BASE TEMP', base.x-pw*0.44, base.y-ph-ly);} if(showParts) this.drawBaseDebug(c,base); }
  drawBaseHpBar(c,base){const yOffset=BATTLE_CONFIG.visualLayout?.baseHpBarYOffset??210;const x=base.x-60,y=base.y-yOffset,w=120,h=10;const ratio=Math.max(0,Math.min(1,base.hp/Math.max(1,base.maxHp)));c.fillStyle='#111827';c.fillRect(x,y,w,h);c.fillStyle='#60a5fa';c.fillRect(x,y,w*ratio,h);c.strokeStyle='#e5e7eb';c.strokeRect(x,y,w,h);}
  drawBaseDebug(c,base){c.fillStyle='#0008';c.fillRect(base.x-90,base.y-250,180,34);c.fillStyle='#f8fafc';c.font='12px ui-monospace';c.fillText(`${base.label} hp:${base.hp}/${base.maxHp}`,base.x-84,base.y-230);}
  drawHud(c, scene, showParts) { const dog = scene?.actors?.find((a) => a.side === 'dog-player'); const cat = scene?.actors?.find((a) => a.side === 'cat-enemy'); const dogBase=scene?.bases?.find((b)=>b.side==='dog-player'); const catBase=scene?.bases?.find((b)=>b.side==='cat-enemy'); const aliveDogs=(scene?.actors||[]).filter(a=>a.isAlive()&&a.side==='dog-player').length; const aliveCats=(scene?.actors||[]).filter(a=>a.isAlive()&&a.side==='cat-enemy').length; c.fillStyle = '#0008'; c.fillRect(14, 14, 860, 170); c.fillStyle = '#f8fafc'; c.font = '20px ui-sans-serif'; c.fillText('Wanko Battle v0.7.2', 24, 40); c.font = '14px ui-monospace, monospace'; c.fillText(`dogBase HP:${dogBase?.hp ?? '-'} catBase HP:${catBase?.hp ?? '-'}`,24,62); c.fillText(`dog HP/state: ${dog?.hp ?? '-'} / ${dog?.state ?? '-'}`, 24, 84); c.fillText(`cat HP/state: ${cat?.hp ?? '-'} / ${cat?.state ?? '-'}`, 24, 104); c.fillText(`money:${Math.floor(scene?.economy?.money||0)}/${scene?.economy?.maxMoney||0} dogs:${aliveDogs} cats:${aliveCats}`,24,124); c.fillText(`battleState:${scene?.battleState || '-'} debug:${showParts?'ON':'OFF'} effects:${(scene?.effects||[]).length}`,24,144); }
  drawHpBar(c, actor) { const yOffset = BATTLE_CONFIG.visualLayout?.actorHpBarYOffset ?? 194; const x = actor.x - 40, y = actor.y - yOffset, w = 80, h = 8; const ratio = Math.max(0, Math.min(1, actor.hp / Math.max(1, actor.maxHp))); c.fillStyle = '#111827'; c.fillRect(x, y, w, h); c.fillStyle = '#22c55e'; c.fillRect(x, y, w * ratio, h); c.strokeStyle = '#e5e7eb'; c.strokeRect(x, y, w, h); }
  drawActorDebug(c, actor, battleState) { const src = actor.rawStats?.source || {}; const d = actor.debugDistance || {}; const lines = [`${actor.instanceId||'-'} slot:${actor.slotId||'-'} state:${actor.state} battle:${battleState}`,`anim:${actor.currentAnimId} role:${actor.activeAnimRole} target:${actor.currentTargetLabel||'-'} type:${actor.currentTargetType||'-'}`,`bodyDistance:${(d.bodyDistance ?? 0).toFixed(1)} moveSpeed:${(actor.moveSpeed||0).toFixed(1)} sideBlocking:disabled spacing:spawn-only`,`kbElapsed:${(actor.knockbackPositionElapsedMs||0).toFixed(1)} kbDur:${(actor.knockbackPositionDurationMs||0).toFixed(1)} from:${(actor.knockbackFromX||0).toFixed(1)} to:${(actor.knockbackToX||0).toFixed(1)}`,`mappingStatus:${src.mappingStatus || '-'} fallback:${(src.fallbackFields||[]).join('|')||'-'}`]; c.fillStyle = '#0008'; c.fillRect(actor.x - 170, actor.y - 190, 560, 62); c.fillStyle = '#f8fafc'; c.font = '12px ui-monospace, monospace'; lines.forEach((line, i) => c.fillText(line, actor.x - 164, actor.y - 176 + i * 14)); }
  drawEventLog(c, events){c.fillStyle='#0008';c.fillRect(14,170,900,170);c.fillStyle='#fde68a';c.font='13px ui-monospace';c.fillText('battle events (latest 10)',24,190);c.fillStyle='#f8fafc';(events||[]).slice().reverse().forEach((e,i)=>c.fillText(`${Math.round(e.timeMs)} ${e.type} ${e.actor||'-'} -> ${e.target||'-'} ${e.targetType||''} dmg:${e.damage??'-'}`,24,210+i*14));}
  drawEffects(c, effects) {
    for (const effect of effects || []) {
      if (!effect || effect.finished || !effect.image || !effect.currentPart) continue;
      const p = effect.currentPart;
      if (!p || p.w <= 0 || p.h <= 0) continue;
      const s = effect.scale || 1;
      const dw = p.w * s;
      const dh = p.h * s;
      c.drawImage(effect.image, p.x, p.y, p.w, p.h, effect.x - dw * 0.5, effect.y - dh * 0.5, dw, dh);
    }
  }

  getBattlePartLocalBounds(actor, p) {
    const partIndex = p.partIndex ?? p.current?.partIndex ?? p.rawPart?.partIndex;
    const imgcutIndex = p.imgcutIndex ?? p.current?.imgcutIndex ?? p.rawPart?.imgcutIndex;
    if (!Number.isInteger(partIndex) || partIndex < 0) return null;
    if ((imgcutIndex ?? 0) < 0) return null;
    const opacity = Number.isFinite(p.opacity) ? p.opacity : (p.world?.o ?? 1);
    if (opacity <= 0) return null;
    const part = actor.sprite?.imgcut?.parts?.[partIndex];
    if (!part || part.w <= 0 || part.h <= 0) return null;
    const m = Array.isArray(p.matrix) && p.matrix.length === 6 ? p.matrix : null;
    if (!m) return null;
    const pivotX = Number.isFinite(p.pivotX) ? p.pivotX : part.w * 0.5;
    const pivotY = Number.isFinite(p.pivotY) ? p.pivotY : part.h * 0.5;
    const corners = [[-pivotX, -pivotY], [part.w - pivotX, -pivotY], [-pivotX, part.h - pivotY], [part.w - pivotX, part.h - pivotY]];
    let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
    for (const [x, y] of corners) { const rx = m[0] * x + m[2] * y + m[4]; const ry = m[1] * x + m[3] * y + m[5]; minX = Math.min(minX, rx); minY = Math.min(minY, ry); maxX = Math.max(maxX, rx); maxY = Math.max(maxY, ry); }
    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return null;
    return { modelPartIndex: Number.isInteger(p.index) ? p.index : p.rawPart?.index, partIndex, imgcutIndex, opacity, left: minX, top: minY, right: maxX, bottom: maxY, width: maxX - minX, height: maxY - minY };
  }
  getBattleDrawListLocalBounds(actor, drawList) {
    if (!actor?.sprite || !Array.isArray(drawList)) return null;
    let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
    for (const p of drawList) {
      const b = this.getBattlePartLocalBounds(actor, p);
      if (!b) continue;
      minX = Math.min(minX, b.left); minY = Math.min(minY, b.top); maxX = Math.max(maxX, b.right); maxY = Math.max(maxY, b.bottom);
    }
    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return null;
    return { left: minX, top: minY, right: maxX, bottom: maxY, width: maxX - minX, height: maxY - minY };
  }
  initializeActorGroundContact(actor, drawList) {
    if (actor.visualGroundContactInitialized) return;
    const partBounds = [];
    for (const p of drawList) {
      const b = this.getBattlePartLocalBounds(actor, p);
      if (!b) continue;
      if (!Number.isInteger(b.modelPartIndex)) continue;
      if (b.opacity <= 0.05) continue;
      partBounds.push(b);
    }
    if (!partBounds.length) { actor.visualGroundContactInitialized = true; actor.visualGroundContactPartIndices = []; actor.visualGroundAnchorLocalY = 0; return; }
    const overallBottom = Math.max(...partBounds.map((b) => b.bottom));
    const contactBand = 18;
    let candidates = partBounds.filter((b) => b.bottom >= overallBottom - contactBand).filter((b) => b.width >= 4 && b.height >= 2).map((b) => b.modelPartIndex);
    candidates = [...new Set(candidates)];
    if (!candidates.length) {
      const bottomPart = partBounds.slice().sort((a, b) => b.bottom - a.bottom)[0];
      if (Number.isInteger(bottomPart?.modelPartIndex)) candidates = [bottomPart.modelPartIndex];
    }
    actor.visualGroundContactInitialized = true;
    actor.visualGroundContactPartIndices = candidates;
    actor.visualGroundReferenceBottomLocalY = overallBottom;
    actor.visualGroundAnchorLocalY = overallBottom;
  }
  getCurrentGroundContactBottomLocalY(actor, drawList) {
    const indices = actor.visualGroundContactPartIndices;
    if (!Array.isArray(indices) || !indices.length) return null;
    const allowed = new Set(indices);
    let bottom = -Infinity;
    for (const p of drawList) {
      const modelPartIndex = Number.isInteger(p.index) ? p.index : p.rawPart?.index;
      if (!allowed.has(modelPartIndex)) continue;
      const b = this.getBattlePartLocalBounds(actor, p);
      if (!b) continue;
      bottom = Math.max(bottom, b.bottom);
    }
    return Number.isFinite(bottom) ? bottom : null;
  }
  getActorGroundAnchorLocalY(actor, drawList) {
    this.initializeActorGroundContact(actor, drawList);
    const currentContactBottom = this.getCurrentGroundContactBottomLocalY(actor, drawList);
    if (Number.isFinite(currentContactBottom)) return currentContactBottom;
    if (Number.isFinite(actor.visualGroundAnchorLocalY)) return actor.visualGroundAnchorLocalY;
    const bounds = this.getBattleDrawListLocalBounds(actor, drawList);
    return bounds && Number.isFinite(bounds.bottom) ? bounds.bottom : 0;
  }
  drawActorLegacy(c, actor, drawList) {
    const baseAngle = actor.model.baseAngle || 3600;
    c.save(); c.translate(actor.x, actor.y); if (actor.renderFlipX) c.scale(-1, 1);
    for (const p of drawList) { const w = p.world; const partIndex = p.current?.partIndex ?? p.partIndex; const imgcutIndex = p.current?.imgcutIndex ?? p.imgcutIndex; if (!Number.isInteger(partIndex) || partIndex < 0) continue; if ((imgcutIndex ?? 0) < 0) continue; if (!w || (w.o ?? 1) <= 0) continue; const part = actor.sprite?.imgcut?.parts?.[partIndex]; if (!part || part.w <= 0 || part.h <= 0) continue; c.save(); c.translate(w.x * actor.scale, w.y * actor.scale); c.rotate((w.a / baseAngle) * Math.PI * 2); c.globalAlpha = w.o ?? 1; const sx = w.sx * actor.scale; const sy = w.sy * actor.scale; actor.sprite.drawPart(c, partIndex, -part.w * 0.5 * sx, -part.h * 0.5 * sy, { scaleX: sx, scaleY: sy }); c.restore(); }
    c.restore();
  }
  drawActor(c, actor) {
    if (!actor?.sprite || !actor?.model || !actor.isAlive()) return;
    const hasBattleDrawList = typeof actor.model.getBattleDrawList === 'function';
    const drawList = hasBattleDrawList ? actor.model.getBattleDrawList() : actor.model.getDrawList();
    if (!hasBattleDrawList) { this.drawActorLegacy(c, actor, drawList); return; }
    const anchorY = this.getActorGroundAnchorLocalY(actor, drawList);
    c.save();
    c.translate(actor.x, actor.y);
    if (actor.renderFlipX) c.scale(-1, 1);
    const s = Number.isFinite(actor.scale) ? actor.scale : 1;
    c.scale(s, s);
    c.translate(0, -anchorY);
    for (const p of drawList) {
      const partIndex = p.partIndex ?? p.current?.partIndex ?? p.rawPart?.partIndex;
      const imgcutIndex = p.imgcutIndex ?? p.current?.imgcutIndex ?? p.rawPart?.imgcutIndex;
      if (!Number.isInteger(partIndex) || partIndex < 0) continue;
      if ((imgcutIndex ?? 0) < 0) continue;
      const opacity = Number.isFinite(p.opacity) ? p.opacity : (p.world?.o ?? 1);
      if (opacity <= 0) continue;
      const part = actor.sprite?.imgcut?.parts?.[partIndex];
      if (!part || part.w <= 0 || part.h <= 0) continue;
      const m = Array.isArray(p.matrix) && p.matrix.length === 6 ? p.matrix : null;
      if (!m) continue;
      c.save();
      c.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
      c.globalAlpha = opacity;
      const pivotX = Number.isFinite(p.pivotX) ? p.pivotX : part.w * 0.5;
      const pivotY = Number.isFinite(p.pivotY) ? p.pivotY : part.h * 0.5;
      actor.sprite.drawPart(c, partIndex, -pivotX, -pivotY, { scaleX: 1, scaleY: 1 });
      c.restore();
    }
    c.restore();
  }
}
