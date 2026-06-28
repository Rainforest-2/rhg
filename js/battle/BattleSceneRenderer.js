import { BATTLE_CONFIG } from './BattleConfig.js';
import { BattleBodyResolver } from './BattleBodyResolver.js';
import { BattleAttackProfile } from './BattleAttackProfile.js';
import { BattleAttackResolver } from './BattleAttackResolver.js';
import { DebugBattleInspector } from './DebugBattleInspector.js';

const BCU_RENDER_CONSTANTS = Object.freeze({
  off: 200,
  roadH: 156,
  depthStep: 4,
  spriteScale: 0.8,
  source: 'BCU-java-PC BattleBox.BBPainter'
});

export class BattleSceneRenderer {
  // Renderer X projection contract:
  // - World X values must be converted with projectX(scene, worldX).
  // - Screen/local pixel offsets must be added after projectX(), not before.
  // - Renderer must not mutate camera position, zoom, siz, or stageLen.
  // - Background may use camera state for parallax, but must do so through helper methods and must not write camera fields.
  // - UI/HUD coordinates are screen-space and must not be passed through projectX().
  projectX(scene, worldX) {
    return scene?.camera ? scene.camera.worldToScreenX(worldX) : worldX;
  }
  projectBcuX(scene, worldX) {
    const camera = scene?.camera;
    if (camera && typeof camera.getBcuRenderX === 'function') return camera.getBcuRenderX(worldX);
    if (camera && typeof camera.bcuWorldToScreenX === 'function') return camera.bcuWorldToScreenX(worldX);
    return this.projectX(scene, worldX);
  }
  projectBattleX(scene, worldX) {
    const cfg = BATTLE_CONFIG.visualLayout?.bcuEntityRender || {};
    return cfg.enabled && cfg.applyBcuProjection !== false
      ? this.projectBcuX(scene, worldX)
      : this.projectX(scene, worldX);
  }
  getCameraScale(scene) {
    const camera = scene?.camera;
    return Number.isFinite(camera?.siz)
      ? camera.siz
      : Number.isFinite(camera?.zoom)
        ? camera.zoom
        : 1;
  }
  getPixelsPerWorldUnit(scene) {
    const camera = scene?.camera;
    if (Number.isFinite(camera?.pixelsPerWorldUnit)) return camera.pixelsPerWorldUnit;
    return this.getCameraScale(scene);
  }
  getCameraWorldLeft(scene) {
    const camera = scene?.camera;
    if (Number.isFinite(camera?.pos)) return camera.pos;
    if (Number.isFinite(camera?.offsetX)) return camera.offsetX;
    return 0;
  }
  getBackgroundCameraOffsetX(scene) {
    const pos = this.getCameraWorldLeft(scene);
    const pxPerWorld = this.getPixelsPerWorldUnit(scene);
    return -(pos * pxPerWorld);
  }
  getBcuRenderConstants() {
    return BCU_RENDER_CONSTANTS;
  }
  getBcuStageGroundY(scene, fallbackH = 720) {
    const cameraMidh = Number(scene?.camera?.midh);
    if (Number.isFinite(cameraMidh)) return cameraMidh;
    if (typeof scene?.camera?.computeBcuMidhForSiz === 'function') {
      const computed = scene.camera.computeBcuMidhForSiz(scene.camera.siz);
      if (Number.isFinite(computed)) return computed;
    }
    const runtimeGround = Number(scene?.stage?.runtime?.groundY);
    if (Number.isFinite(runtimeGround)) return runtimeGround;
    const sceneGround = Number(scene?.groundY);
    if (Number.isFinite(sceneGround)) return sceneGround;
    return fallbackH;
  }
  getBcuLayerScreenY(scene, layer = 0, fallbackH = 720) {
    const c = this.getBcuRenderConstants();
    const scale = this.getCameraScale(scene);
    const groundY = this.getBcuStageGroundY(scene, fallbackH);
    const dep = (Number(layer) || 0) * c.depthStep;
    return groundY - (c.roadH - dep) * scale;
  }
  getBcuSpriteScale(scene, baseScale = 1) {
    return (Number(baseScale) || 1) * this.getCameraScale(scene) * this.getBcuRenderConstants().spriteScale;
  }
  getBcuEntityLayer(entity) {
    const candidates = [
      entity?.currentLayer,
      entity?.bcuRenderLayer,
      entity?.stageSpawnLayerMin,
      entity?.layerMin,
      entity?.frontLayer
    ];
    for (const value of candidates) {
      const n = Number(value);
      if (Number.isFinite(n)) return n;
    }
    return 0;
  }
  getEntityRenderY(scene, entity, fallbackH = 720) {
    const cfg = BATTLE_CONFIG.visualLayout?.bcuEntityRender || {};
    if (cfg.enabled && cfg.applyRoadBaseline !== false) {
      const layer = this.getBcuEntityLayer(entity);
      const baseline = this.getBcuLayerScreenY(scene, layer, fallbackH);
      const legacyY = Number.isFinite(entity?.y) ? entity.y : this.getBcuStageGroundY(scene, fallbackH);
      if (entity && (scene?.debugBattleEnabled || globalThis.__BCU_RENDER_DEBUG__ === true || globalThis.__BCU_DEBUG_ALLOCATIONS__ === true)) {
        entity.lastRenderYDebug = { source: cfg.source || 'bcu-entity-render', layer, baselineY: baseline, legacyY };
      }
      return baseline;
    }
    return Number.isFinite(entity?.y) ? entity.y : this.getBcuStageGroundY(scene, fallbackH);
  }
  getEntityRenderScale(scene, entity, baseScale = 1) {
    const cfg = BATTLE_CONFIG.visualLayout?.bcuEntityRender || {};
    if (cfg.enabled && cfg.applySpriteScale === true) {
      const scaleBase = cfg.ignoreActorConfigScale === true ? 1 : baseScale;
      return this.getBcuSpriteScale(scene, scaleBase);
    }
    return (Number(baseScale) || 1) * this.getCameraScale(scene);
  }
  getBcuBackgroundLayout(scene, bg, w, h) {
    const crop = bg?.crop;
    const layout = BATTLE_CONFIG.stage.backgroundLayout || {};
    const camera = scene?.camera || {};
    const scale = (Number.isFinite(layout.cropScale) ? layout.cropScale : 1.0) * this.getCameraScale(scene);
    const cropW = Math.max(1, Number(crop?.w || 0) * scale);
    const cropH = Math.max(1, Number(crop?.h || 0) * scale);
    const off = Number.isFinite(camera.bcuOff) ? camera.bcuOff : this.getBcuRenderConstants().off;
    const ratio = Number.isFinite(camera.ratio) ? camera.ratio : (Number.isFinite(camera.bcuRatio) ? camera.bcuRatio : 768 / 2400);
    const posWorld = this.getCameraWorldLeft(scene);
    const sbPosPx = -(posWorld * ratio * this.getCameraScale(scene));
    const offsetX = Number.isFinite(layout.cropOffsetX) ? layout.cropOffsetX * scale : 0;
    const offsetY = Number.isFinite(layout.cropOffsetY) ? layout.cropOffsetY * scale : 0;
    const groundY = this.getBcuStageGroundY(scene, h);
    return {
      source: 'BCU Background.draw parity',
      scale,
      cropW,
      cropH,
      sbPosPx,
      offPx: off * this.getCameraScale(scene),
      dx: sbPosPx + off * this.getCameraScale(scene) - cropW + offsetX,
      dy: groundY - cropH + offsetY,
      groundY,
      canvasW: w,
      canvasH: h,
      ratio,
      posWorld
    };
  }
  addScreenOffsetX(screenX, offsetPx = 0, scene = this._scene) {
    const scale = this.getCameraScale(scene);
    const n = Number(offsetPx);
    return screenX + (Number.isFinite(n) ? n * scale : 0);
  }
  render(previewRenderer, scene, debugOptions = false) {
    const c = previewRenderer.ctx; const w = previewRenderer.logicalW; const h = previewRenderer.logicalH; const groundY = scene?.groundY || BATTLE_CONFIG.visualLayout?.groundY || BATTLE_CONFIG.groundY || 590;
    c.clearRect(0, 0, w, h);
    if (scene?.stage?.background?.image && scene?.stage?.background?.crop) { if (BATTLE_CONFIG.stage.backgroundMode === 'bcu-stage0') this.drawBackgroundBcuStage0(c, scene.stage.background, w, h, scene); else this.drawBackgroundCropCover(c, scene.stage.background, w, h); } else this.drawFallbackBackground(c, w, h, groundY);
    const debug = typeof debugOptions === 'object' ? { showParts: !!debugOptions.showParts, showBounds: !!debugOptions.showBounds, showPivots: !!debugOptions.showPivots, rawMode: !!debugOptions.rawMode } : { showParts: !!debugOptions, showBounds: !!debugOptions, showPivots: false, rawMode: false };
    this._scene=scene; this.drawBases(c, scene?.bases || [], groundY, debug.showBounds);
    const actorsForRender = this.getAliveActorsForRender(scene);
    for (const actor of actorsForRender) this.drawActor(c, actor);
    if (Array.isArray(scene?.effects) && scene.effects.length) this.drawEffects(c, scene.effects);
    // Unit HP bars removed by request; base HP bars retained.
    for (const base of (scene?.bases || [])) this.drawBaseHpBar(c, base);
    if (debug.showBounds) { this.drawCombatDebug(c, scene, debug); for (const actor of actorsForRender) this.drawActorDebug(c, actor, scene?.battleState || 'running'); this.drawEventLog(c, scene?.debugEvents || []); this.drawStageSpawnPreview(c, scene); }
    this.drawHud(c, scene, debug);
    if (scene?.debugBattleEnabled) this.drawDebugBattleOverlay(c, scene);
  }
  getActorLocalRenderBounds(actor){if(!actor?.sprite||!actor?.model)return null;const baseAngle=actor.model.baseAngle||3600;let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const p of actor.model.getDrawList()){const w=p.world;const partIndex=p.current?.partIndex??p.partIndex;const imgcutIndex=p.current?.imgcutIndex??p.imgcutIndex;if(!Number.isInteger(partIndex)||partIndex<0)continue;if((imgcutIndex??0)<0)continue;if(!w||(w.o??1)<=0)continue;const part=actor.sprite?.imgcut?.parts?.[partIndex];if(!part||part.w<=0||part.h<=0)continue;const cx=w.x*actor.scale,cy=w.y*actor.scale,sx=w.sx*actor.scale,sy=w.sy*actor.scale;const halfW=Math.abs(part.w*sx)*0.5,halfH=Math.abs(part.h*sy)*0.5;const angle=(w.a/baseAngle)*Math.PI*2,cos=Math.cos(angle),sin=Math.sin(angle);for(const [px,py] of [[-halfW,-halfH],[halfW,-halfH],[-halfW,halfH],[halfW,halfH]]){const rx=cx+px*cos-py*sin;const ry=cy+px*sin+py*cos;minX=Math.min(minX,rx);minY=Math.min(minY,ry);maxX=Math.max(maxX,rx);maxY=Math.max(maxY,ry);}}if(!Number.isFinite(minX)||!Number.isFinite(minY)||!Number.isFinite(maxX)||!Number.isFinite(maxY))return null;return{left:minX,top:minY,right:maxX,bottom:maxY,width:maxX-minX,height:maxY-minY};}
  getActorBottomAnchorOffset(actor){const bounds=this.getActorLocalRenderBounds(actor);if(!bounds)return 0;return -bounds.bottom;}
  getActorRenderDepthY(actor){const y=Number.isFinite(actor.y)?actor.y:0;const crowdY=Number.isFinite(actor.visualCrowdYOffsetPx)?actor.visualCrowdYOffsetPx:0;return y+crowdY;}
  getAliveActorsForRender(scene){return (scene?.actors||[]).filter((actor)=>actor?.isRenderable?actor.isRenderable():actor?.isAlive?.()).sort((a,b)=>{const ay=this.getActorRenderDepthY(a);const by=this.getActorRenderDepthY(b);if(ay!==by)return ay-by;const ax=Number.isFinite(a.x)?a.x:0;const bx=Number.isFinite(b.x)?b.x:0;if(ax!==bx)return ax-bx;const at=Number.isFinite(a.spawnedAtMs)?a.spawnedAtMs:0;const bt=Number.isFinite(b.spawnedAtMs)?b.spawnedAtMs:0;return at-bt;});}

  rgb(color){return `rgb(${color.r},${color.g},${color.b})`;}
  drawVerticalGradient(c,x,y,w,h,top,bottom){const g=c.createLinearGradient(0,y,0,y+h);g.addColorStop(0,this.rgb(top));g.addColorStop(1,this.rgb(bottom));c.fillStyle=g;c.fillRect(x,y,w,h);}
  drawCropTiledX(c,image,crop,dx,dy,scale,targetW){const dw=crop.w*scale;const dh=crop.h*scale;if(dw<=0||dh<=0)return;let x=dx;while(x>0)x-=dw;while(x<targetW){c.drawImage(image,crop.x,crop.y,crop.w,crop.h,x,dy,dw,dh);x+=dw;}}
  drawCropTiledXWithTopFade(c,image,crop,dx,dy,scale,targetW,fadeHeight=0,step=4){const dw=crop.w*scale;const dh=crop.h*scale;if(dw<=0||dh<=0)return;let x0=dx;while(x0>0)x0-=dw;const fadePx=Math.max(0,Math.min(crop.h,fadeHeight||0));const strip=Math.max(1,step||4);for(let x=x0;x<targetW;x+=dw){if(fadePx>0){for(let sy=0;sy<fadePx;sy+=strip){const sh=Math.min(strip,fadePx-sy);const alpha=Math.max(0,Math.min(1,(sy+sh)/fadePx));c.save();c.globalAlpha=alpha;c.drawImage(image,crop.x,crop.y+sy,crop.w,sh,x,dy+sy*scale,dw,sh*scale);c.restore();}const restH=crop.h-fadePx;if(restH>0)c.drawImage(image,crop.x,crop.y+fadePx,crop.w,restH,x,dy+fadePx*scale,dw,restH*scale);}else{c.drawImage(image,crop.x,crop.y,crop.w,crop.h,x,dy,dw,dh);}}}
  drawBackgroundBcuStage0(c,bg,w,h,scene){const colors=bg.colors;const crop=bg.crop;const image=bg.image;const layout=BATTLE_CONFIG.stage.backgroundLayout||{};if(!image||!crop||!colors){this.drawBackgroundCropCover(c,bg,w,h);return;}const bcu=this.getBcuBackgroundLayout(scene,bg,w,h);const fadeHeight=Number.isFinite(layout.cropTopFadeHeight)?layout.cropTopFadeHeight:0;const fadeStep=Number.isFinite(layout.cropTopFadeStep)?layout.cropTopFadeStep:4;const groundY=bcu.groundY;if(groundY<h)this.drawVerticalGradient(c,0,groundY,w,h-groundY,colors.groundTop,colors.groundBottom);if(groundY>bcu.cropH){let topY=groundY-bcu.cropH*2;if(bg.upperCrop){const top=bg.upperCrop;const topW=top.w*bcu.scale;const topH=top.h*bcu.scale;topY+=bcu.cropH-topH;let tx=bcu.dx;while(tx>0)tx-=topW;for(;tx<w;tx+=topW)if(tx+topW>0)c.drawImage(image,top.x,top.y,top.w,top.h,tx,topY,topW,topH);if(topY>0)this.drawVerticalGradient(c,0,0,w,topY,colors.skyTop,colors.skyBottom);}else{this.drawVerticalGradient(c,0,0,w,Math.max(0,bcu.cropH+topY),colors.skyTop,colors.skyBottom);}}if(layout.tileX!==false)this.drawCropTiledXWithTopFade(c,image,crop,bcu.dx,groundY-bcu.cropH,bcu.scale,w,fadeHeight,fadeStep);else this.drawCropTiledXWithTopFade(c,image,crop,bcu.dx,groundY-bcu.cropH,bcu.scale,bcu.dx+bcu.cropW,fadeHeight,fadeStep);bg.lastRenderDebug={source:bcu.source,drawSource:'BCU Background.draw ground-gradient-first',dx:bcu.dx,dy:groundY-bcu.cropH,scale:bcu.scale,cropW:bcu.cropW,cropH:bcu.cropH,groundY,posWorld:bcu.posWorld,offPx:bcu.offPx,upperCrop:!!bg.upperCrop};}
  drawBackgroundCropCover(c,bg,w,h){const{image,crop}=bg;const scale=Math.max(w/crop.w,h/crop.h);const dw=crop.w*scale,dh=crop.h*scale;const dx=(w-dw)*0.5;const alignY=Number.isFinite(BATTLE_CONFIG.visualLayout?.backgroundVerticalAlign)?BATTLE_CONFIG.visualLayout.backgroundVerticalAlign:0.5;const dy=(h-dh)*alignY;c.drawImage(image,crop.x,crop.y,crop.w,crop.h,dx,dy,dw,dh)}
  drawFallbackBackground(c,w,h,groundY){const sky=c.createLinearGradient(0,0,0,groundY);sky.addColorStop(0,'#7dc7ff');sky.addColorStop(1,'#d9f0ff');c.fillStyle=sky;c.fillRect(0,0,w,groundY);const ground=c.createLinearGradient(0,groundY,0,h);ground.addColorStop(0,'#d8c59a');ground.addColorStop(1,'#80633d');c.fillStyle=ground;c.fillRect(0,groundY,w,h-groundY)}

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
    let y = 0;
    if (base?.visualBottomToCurrentCenter && base.visualKind === 'castle-composite') {
      const bounds = this.getCompositeBaseLocalBounds(base);
      if (bounds) {
        const s = base.scale || 1;
        y += -bounds.height * s * 0.5;
      }
    }
    if (Number.isFinite(base?.visualYOffsetPx)) y += base.visualYOffsetPx;
    return y;
  }
  drawBases(c,bases,groundY,showParts){for(const base of bases) this.drawBase(c,base,groundY,showParts)}
  drawBase(c,base,groundY,showParts){const renderY=this.getEntityRenderY(this._scene,base,groundY); if(base.visualKind==='bcu-enemy-castle'&&base.castleAsset?.image){this.drawBcuEnemyCastle(c,base);} else if(base.visualKind==='bcu-player-castle-composite'&&base.layers?.length){this.drawBcuPlayerCastleComposite(c,base,renderY);} else if(base.visualKind==='castle-composite'&&base.layers?.length){ const visualYOffset = this.getBaseVisualYOffset(base); for(const layer of base.layers){const s=(base.scale||1)*this.getCameraScale(this._scene);const baseScreenX=this.projectBcuX(this._scene,base.x);const offsetX=Number.isFinite(layer.offsetX)?layer.offsetX*base.scale:0;const anchorX=base.side==='dog-player'?this.addScreenOffsetX(baseScreenX,offsetX,this._scene):this.addScreenOffsetX(baseScreenX,offsetX,this._scene)-layer.image.width*0.5*s;const x=anchorX;const y=renderY+visualYOffset+(layer.offsetY||0)*s-layer.image.height*s;c.drawImage(layer.image,x,y,layer.image.width*s,layer.image.height*s);} } else { const pw=BATTLE_CONFIG.visualLayout?.catBasePlaceholder?.width??100; const ph=BATTLE_CONFIG.visualLayout?.catBasePlaceholder?.height??80; const ly=BATTLE_CONFIG.visualLayout?.catBasePlaceholder?.labelYOffset??8; c.fillStyle='#374151'; const sx=this.projectBcuX(this._scene,base.x); c.fillRect(sx-pw*0.5, renderY-ph, pw, ph); c.fillStyle='#e5e7ebcc'; c.fillText('CAT BASE TEMP', sx-pw*0.44, renderY-ph-ly);} if(showParts) this.drawBaseDebug(c,base); }

  drawBcuPlayerCastleComposite(c,base,renderY){const s=(Number.isFinite(base.scale)?base.scale:1)*this.getCameraScale(this._scene);const sx=this.projectBcuX(this._scene,base.x);for(const layer of base.layers||[]){if(!layer?.image)continue;const x=sx+(Number.isFinite(layer.offsetX)?layer.offsetX*s:0);const y=renderY+(Number.isFinite(layer.offsetY)?layer.offsetY*s:0);c.drawImage(layer.image,x,y,layer.image.width*s,layer.image.height*s);}base.renderDebug={...(base.renderDebug||{}),rendererMode:'bcu-player-castle-composite',anchor:'left-bottom',source:'BCU-java-PC BattleBox.BBPainter.drawNyCast',posBcu:base.posBcu,x:base.x,drawX:sx,scale:s};}

  drawBcuEnemyCastle(c,base){const a=base.castleAsset;const crop=a?.crop;if(!a?.image||!crop)return;const s=(Number.isFinite(base.scale)?base.scale:1)*this.getCameraScale(this._scene);const sx=this.projectBcuX(this._scene,base.x);const renderY=this.getEntityRenderY(this._scene,base,base.y);const drawW=crop.w*s,drawH=crop.h*s;const drawX=sx-drawW;const drawY=renderY-drawH+(Number.isFinite(base.visualYOffsetPx)?base.visualYOffsetPx:0);// BCU enemy castle uses right-edge anchor: drawX = getX(ebase.pos) - width.
c.drawImage(a.image,crop.x,crop.y,crop.w,crop.h,drawX,drawY,drawW,drawH);}
  drawBaseHpBar(c,base){const yOffset=BATTLE_CONFIG.visualLayout?.baseHpBarYOffset??210;const renderY=this.getEntityRenderY(this._scene,base,base.y);const x=this.projectBattleX(this._scene,base.x)-60,y=renderY-yOffset,w=120,h=10;const ratio=Math.max(0,Math.min(1,base.hp/Math.max(1,base.maxHp)));c.fillStyle='#111827';c.fillRect(x,y,w,h);c.fillStyle='#60a5fa';c.fillRect(x,y,w*ratio,h);c.strokeStyle='#e5e7eb';c.strokeRect(x,y,w,h);}
  drawBaseDebug(c,base){c.fillStyle='#0008';const sx=this.projectBattleX(this._scene,base.x);const sy=this.getEntityRenderY(this._scene,base,base.y); c.fillRect(sx-90,sy-250,180,34);c.fillStyle='#f8fafc';c.font='12px ui-monospace';c.fillText(`${base.label} hp:${base.hp}/${base.maxHp}`,sx-84,sy-230);}

  getDebugCombatBodyBox(entity){return BattleBodyResolver.getCombatBodyBox(entity);}

  drawCombatDebug(c, scene){const actors=(scene?.actors||[]).filter((a)=>a?.isAlive?.());const bases=scene?.bases||[];c.save();c.lineWidth=2;c.font='11px ui-monospace, monospace';for(const actor of actors){const box=this.getDebugCombatBodyBox(actor);if(!box)continue;const debug=BattleBodyResolver.getAttackRangeDebug(actor);const actorX=Number.isFinite(actor?.x)?actor.x:0;const posX=Number.isFinite(box.combatPositionX)?box.combatPositionX:debug.frontX;const edgeOffset=Number.isFinite(actor?.resolvedCombatEdgeWorldOffsetPx)?actor.resolvedCombatEdgeWorldOffsetPx:0;const edgeX=actorX+edgeOffset;const renderOriginX=actorX+(Number.isFinite(actor?.visualRenderOffsetWorldPx)?actor.visualRenderOffsetWorldPx:0);const crowdVisualX=renderOriginX+(Number.isFinite(actor?.visualCrowdFanoutPx)?actor.visualCrowdFanoutPx:0);const kbVisualX=crowdVisualX+(Number.isFinite(actor?.kbVisualOffsetX)?actor.kbVisualOffsetX:0);const sideColor=actor.side==='dog-player'?'#f97316':'#38bdf8';c.strokeStyle=sideColor;c.globalAlpha=0.35;c.strokeRect(this.projectX(scene,box.left),box.top,this.projectX(scene,box.right)-this.projectX(scene,box.left),box.bottom-box.top);c.globalAlpha=1;c.strokeStyle='#9ca3af';c.lineWidth=1;c.beginPath();c.moveTo(this.projectX(scene,actorX),box.top-12);c.lineTo(this.projectX(scene,actorX),box.bottom+12);c.stroke();c.strokeStyle='#f8fafc';c.lineWidth=3;c.beginPath();c.moveTo(this.projectX(scene,posX),box.top-12);c.lineTo(this.projectX(scene,posX),box.bottom+12);c.stroke();c.strokeStyle='#86efac';c.lineWidth=2;c.beginPath();c.moveTo(this.projectX(scene,edgeX),box.top-8);c.lineTo(this.projectX(scene,edgeX),box.bottom+8);c.stroke();c.strokeStyle='#ff00ff';c.lineWidth=2;c.beginPath();c.moveTo(this.projectX(scene,renderOriginX),box.top-6);c.lineTo(this.projectX(scene,renderOriginX),box.bottom+6);c.stroke();c.strokeStyle='#22d3ee';c.lineWidth=2;c.beginPath();c.moveTo(this.projectX(scene,crowdVisualX),box.top-4);c.lineTo(this.projectX(scene,crowdVisualX),box.bottom+4);c.stroke();c.strokeStyle='#67e8f9';c.lineWidth=2;c.beginPath();c.moveTo(this.projectX(scene,kbVisualX),box.top-2);c.lineTo(this.projectX(scene,kbVisualX),box.bottom+2);c.stroke();const profile=actor.getAttackProfile?.()||BattleAttackProfile.ensure(actor);for(const event of (profile?.events||[])){const line=BattleAttackResolver.getAttackDebugLine(actor,event);if(!line||!Number.isFinite(line.left)||!Number.isFinite(line.right)||!Number.isFinite(line.centerY)||!Number.isFinite(line.top))continue;const kind=event?.attackKind||event?.raw?.attackKind||'normal';const color=kind==='omni'?'#a855f7':(kind==='ld'?'#fb923c':'#facc15');const y=Number.isFinite(line.centerY)?line.centerY:(box.centerY??actor.y??0);const labelY=Number.isFinite(line.top)?(line.top-2):(y-16);if(!Number.isFinite(y)||!Number.isFinite(labelY))continue;c.save();if(kind==='normal')c.setLineDash([4,4]);c.strokeStyle=color;c.beginPath();c.moveTo(this.projectX(scene,line.left),y);c.lineTo(this.projectX(scene,line.right),y);c.stroke();c.restore();c.fillStyle=color;const labelX=this.projectX(scene,Math.min(line.left,line.right));const mode=line.mode||'unknown';c.fillText(`atk:${kind} ${Math.round(line.left)}..${Math.round(line.right)} ${mode}`,labelX,labelY);}const ro=Math.round(actor.visualRenderOffsetWorldPx||0);const crowdX=Math.round(actor.visualCrowdFanoutPx||0);const crowdY=Math.round(actor.visualCrowdYOffsetPx||0);c.fillStyle='#f8fafc';const actorLabelX=this.projectX(scene,box.left);c.fillText(`st:${actor.state} hp:${Math.round(actor.hp||0)} dist:${Math.round(actor.debugDistance?.combatBodyDistance||0)} range:${Math.round(actor.detectionRangePx||0)}`,actorLabelX,box.top-18);c.fillText(`pos:${Math.round(posX)} x:${Math.round(actorX)} ro:${ro} crowd:${crowdX}/${crowdY}`,actorLabelX,box.top-4);}for(const base of bases){const box=this.getDebugCombatBodyBox(base);if(!box)continue;c.strokeStyle='#a78bfa';c.strokeRect(this.projectX(scene,box.left),box.top,this.projectX(scene,box.right)-this.projectX(scene,box.left),box.bottom-box.top);}c.fillStyle='#f8fafc';c.fillText('white=combatX, cyan/kb=render-only KB, magenta=render origin, yellow=attack',20,356);c.restore();}

  drawDebugBattleOverlay(c, scene) {
    const info = DebugBattleInspector.collect(scene);
    const x = 16;
    const y = 260;
    const w = 520;
    const lines = [
      `debugBattle: ON source:${scene?.debugBattleSource || '-'}`,
      `frame:${info.frame} time:${Math.round(info.timeMs || 0)}ms`,
      `stage castle:${info.stage?.castleId ?? '-'} bg:${info.stage?.bgId ?? '-'} len:${info.stage?.stageLen ?? '-'}`,
      `base player:${Math.round(info.runtime?.playerBaseHp ?? 0)} enemy:${Math.round(info.runtime?.enemyBaseHp ?? 0)}`,
      `spawn rows:${info.spawn?.rowCount ?? 0} active:${info.spawn?.activeRows ?? 0} pending:${info.spawn?.pendingSpawnCount ?? 0}`,
      `actors dog:${info.actors?.playerAlive ?? 0} cat:${info.actors?.enemyAlive ?? 0} kb:${info.actors?.knockback ?? 0}`,
      `camera pos:${Math.round(info.camera?.pos ?? 0)} zoom:${Number(info.camera?.zoom ?? 1).toFixed(2)} stageLen:${info.camera?.stageLen ?? '-'}`,
      `castle resolved:${info.assets?.castle?.resolvedCastleId ?? '-'} fallback:${info.assets?.castle?.fallbackReason ?? '-'}`,
      `bg resolved:${info.assets?.background?.resolvedBgId ?? '-'} fallback:${info.assets?.background?.fallbackReason ?? '-'}`
    ];
    c.save();
    c.fillStyle = '#020617dd';
    c.fillRect(x, y, w, lines.length * 16 + 18);
    c.strokeStyle = '#38bdf8';
    c.strokeRect(x, y, w, lines.length * 16 + 18);
    c.fillStyle = '#e0f2fe';
    c.font = '12px ui-monospace, monospace';
    lines.forEach((line, i) => c.fillText(line, x + 10, y + 20 + i * 16));
    c.restore();
  }
  drawHud(c, scene, debug) { const dog = scene?.actors?.find((a) => a.side === 'dog-player'); const cat = scene?.actors?.find((a) => a.side === 'cat-enemy'); const dogBase=scene?.bases?.find((b)=>b.side==='dog-player'); const catBase=scene?.bases?.find((b)=>b.side==='cat-enemy'); const aliveDogs=(scene?.actors||[]).filter(a=>a.isAlive()&&a.side==='dog-player').length; const aliveCats=(scene?.actors||[]).filter(a=>a.isAlive()&&a.side==='cat-enemy').length; c.fillStyle = '#0008'; c.fillRect(14, 14, 1080, 236); c.fillStyle = '#f8fafc'; c.font = '20px ui-sans-serif'; const version = BATTLE_CONFIG.version || '0.0.0'; c.fillText(`Wanko Battle v${version}`, 24, 40); c.font = '14px ui-monospace, monospace'; c.fillText(`dogBase HP:${dogBase?.hp ?? '-'} catBase HP:${catBase?.hp ?? '-'}`,24,62); c.fillText(`dog HP/state: ${dog?.hp ?? '-'} / ${dog?.state ?? '-'}`, 24, 84); c.fillText(`cat HP/state: ${cat?.hp ?? '-'} / ${cat?.state ?? '-'}`, 24, 104); const kbActors=(scene?.actors||[]).filter(a=>a.state==='knockback').length; c.fillText(`money:${Math.floor(scene?.economy?.money||0)}/${scene?.economy?.maxMoney||0} dogs:${aliveDogs} cats:${aliveCats} kb:${kbActors}`,24,124); c.fillText(`battleState:${scene?.battleState || '-'} debug:${debug?.showBounds?'ON':'OFF'} effects:${(scene?.effects||[]).length}`,24,144); const sd=scene?.stage?.definition?.summary; c.fillText(`stageDefinition len:${sd?.stageLen ?? '-'} bg:${sd?.bgId ?? '-'} baseHp:${sd?.enemyBaseHp ?? '-'} maxEnemy:${sd?.maxEnemyCount ?? '-'}`,24,164); const rt=scene?.stage?.runtime; c.fillText(`stageRuntime maxEnemy:${rt?.effectiveMaxEnemyCount ?? '-'} src:${rt?.effectiveMaxEnemyCountSource ?? '-'} bg:${rt?.bgId ?? '-'} len:${rt?.stageLen ?? '-'}`,24,184); const sp=scene?.stage?.spawnPreview?.summary; const firstMs=Number.isFinite(sp?.firstSpawnMs)?sp.firstSpawnMs:'-'; c.font='13px ui-monospace, monospace'; const cam=scene?.camera; c.fillText(`cam pos:${Math.round(cam?.pos??cam?.offsetX??0)} siz:${(cam?.siz??cam?.zoom??1).toFixed(2)} ratio:${(cam?.bcuRatio??0.32).toFixed(2)} visW:${Math.round(cam?.visibleWorldWidth??0)} stagePx:${Math.round(cam?.stagePixelWidth??0)}`,24,204); c.fillText(`stageSpawn rows:${sp?.totalRows ?? '-'} boss:${sp?.bossRows ?? '-'} unresolved:${sp?.unresolvedRows ?? '-'} first:${firstMs}ms`,24,224); }
  drawHpBar(c, actor) { const yOffset = BATTLE_CONFIG.visualLayout?.actorHpBarYOffset ?? 194; const visualX=actor.x+(actor.visualRenderOffsetWorldPx||0)+(actor.visualCrowdFanoutPx||0)+(actor.kbVisualOffsetX||0); const visualY=this.getEntityRenderY(this._scene,actor,actor.y)+(actor.visualCrowdYOffsetPx||0)+(actor.kbVisualOffsetY||0); const x = this.projectBattleX(this._scene,visualX) - 40, y = visualY - yOffset, w = 80, h = 8; const ratio = Math.max(0, Math.min(1, actor.hp / Math.max(1, actor.maxHp))); c.fillStyle = '#111827'; c.fillRect(x, y, w, h); c.fillStyle = '#22c55e'; c.fillRect(x, y, w * ratio, h); c.strokeStyle = '#e5e7eb'; c.strokeRect(x, y, w, h); }
  drawActorDebug(c, actor, battleState) { const d = actor.debugDistance || {}; const lifeState = actor.isAlive?.() ? 'alive' : (actor.isFinalKnockback?.() ? 'finalKB' : actor.state); const frontScreenOffset = Number.isFinite(actor.visualRenderOffsetDebug?.frontScreenOffset) ? Math.round(actor.visualRenderOffsetDebug.frontScreenOffset) : '-'; const mode = actor.combatPositionMode || BATTLE_CONFIG.tuning?.combatPositionMode || 'screen-combat-point'; const combatX = Math.round(BattleBodyResolver.getActorCombatPositionX(actor)); const cap=actor.lastCaptureDebug?.capturedCount; const q=actor.lastHitQueueDebug?.damage; const crowdX=Math.round(actor.visualCrowdFanoutPx||0); const crowdY=Math.round(actor.visualCrowdYOffsetPx||0); const kb=actor.lastKnockbackDebug;const frame=actor.lastKnockbackFrameDebug;const touchState=actor.getTouchState?.()||actor.kbTouchState||'normal';const kbText=actor.state==='knockback'&&kb?`kb:${actor.knockbackType} ${actor.kbBcuType} f:${actor.kbFrameIndex}/${actor.kbFramesTotal} rem:${Math.round(actor.kbRemainingDistancePx||0)} y:${Math.round(actor.kbVisualOffsetY||0)} tch:${touchState}`:`cap:${cap===undefined?'-':cap} mode:${actor.lastCaptureDebug?.mode||mode} q:${q===undefined?'-':q} tch:${touchState}`; const lines = [`${actor.instanceId||'-'} ${actor.state} hp:${Math.round(actor.hp||0)}`,`combatX:${combatX} range:${Math.round(actor.detectionRangePx||0)} dist:${Math.round(d.combatBodyDistance??0)} can:${d.canAttack===undefined?'-':d.canAttack}`,`${kbText} ro:${Math.round(actor.visualRenderOffsetWorldPx||0)} crowd:${crowdX}/${crowdY}`]; c.fillStyle = '#0008'; const sx=this.projectBattleX(this._scene,actor.x);const sy=this.getEntityRenderY(this._scene,actor,actor.y);c.fillRect(sx - 170, sy - 190, 560, 48); c.fillStyle = '#f8fafc'; c.font = '12px ui-monospace, monospace'; lines.forEach((line, i) => c.fillText(line, sx - 164, sy - 176 + i * 14)); }

  drawStageSpawnPreview(c, scene){const rows=scene?.stage?.spawnPreview?.visibleRows||[];if(!rows.length)return;const maxRows=Math.min(rows.length,Number.isFinite(scene?.stage?.spawnPreview?.summary?.visibleRows)?scene.stage.spawnPreview.summary.visibleRows:rows.length);const lines=['CSV spawn preview:'];for(let i=0;i<maxRows;i+=1){const r=rows[i]||{};const firstMs=Number.isFinite(r.firstMs)?r.firstMs:'-';const repMin=Number.isFinite(r.respawnMinMs)?r.respawnMinMs:'-';const repMax=Number.isFinite(r.respawnMaxMs)?r.respawnMaxMs:'-';lines.push(`#${r.index ?? i} id:${r.enemyId ?? '-'} first:${firstMs}ms rep:${repMin}-${repMax} count:${r.countLabel || '-'} trigger:${r.triggerLabel || '-'} boss:${r.bossLabel || '-'} map:${r.mapping?.status || '-'}`);}c.fillStyle='#0008';c.fillRect(14,344,1240,Math.max(40,lines.length*14+14));c.fillStyle='#f8fafc';c.font='12px ui-monospace';lines.forEach((line,idx)=>c.fillText(line,24,362+idx*14));}
  drawEventLog(c, events){c.fillStyle='#0008';c.fillRect(14,170,900,170);c.fillStyle='#fde68a';c.font='13px ui-monospace';c.fillText('battle events (latest 10)',24,190);c.fillStyle='#f8fafc';(events||[]).slice().reverse().forEach((e,i)=>{const actor=e.actor||'-'; const target=e.target?` -> ${e.target}`:''; const dmg=e.damage!==undefined?` dmg:${e.damage}`:''; const cnt=e.count!==undefined?` count:${e.count}`:''; const mode=e.mode?` ${e.mode}`:''; const kbTypeSet=new Set(['knockbackStart','finalKnockbackStart','knockbackEnd','finalKnockbackEnd','deadAfterFinalKnockback']); const kb=kbTypeSet.has(e.type)&&(e.bcuType||e.frames!==undefined||e.distance!==undefined||e.moveMode)?`${e.bcuType?` ${e.bcuType}`:''}${e.frames!==undefined?` f:${e.frames}`:''}${e.distance!==undefined?` d:${e.distance}`:''}${e.moveMode?` ${e.moveMode}`:''}`:''; c.fillText(`${Math.round(e.timeMs)} ${e.type} ${actor}${target}${kb}${cnt}${dmg}${mode}`,24,210+i*14);});}
  drawEffects(c, effects) {
    for (const effect of effects || []) {
      if (!effect || effect.finished || !effect.image || !effect.currentPart) continue;
      const p = effect.currentPart;
      if (!p || p.w <= 0 || p.h <= 0) continue;
      const s = this.getEntityRenderScale(this._scene,effect,effect.scale || 1);
      const dw = p.w * s;
      const dh = p.h * s;
      const yOffset = Number.isFinite(effect.bcuSmokeYOffset) ? effect.bcuSmokeYOffset * this.getCameraScale(this._scene) : 0;
      c.drawImage(effect.image, p.x, p.y, p.w, p.h, this.projectBattleX(this._scene,effect.x) - dw * 0.5, this.getEntityRenderY(this._scene,effect,effect.y) - yOffset - dh * 0.5, dw, dh);
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
    let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
    const x0 = -pivotX; const y0 = -pivotY; const x1 = part.w - pivotX; const y1 = part.h - pivotY;
    let rx = m[0] * x0 + m[2] * y0 + m[4]; let ry = m[1] * x0 + m[3] * y0 + m[5]; minX = Math.min(minX, rx); minY = Math.min(minY, ry); maxX = Math.max(maxX, rx); maxY = Math.max(maxY, ry);
    rx = m[0] * x1 + m[2] * y0 + m[4]; ry = m[1] * x1 + m[3] * y0 + m[5]; minX = Math.min(minX, rx); minY = Math.min(minY, ry); maxX = Math.max(maxX, rx); maxY = Math.max(maxY, ry);
    rx = m[0] * x0 + m[2] * y1 + m[4]; ry = m[1] * x0 + m[3] * y1 + m[5]; minX = Math.min(minX, rx); minY = Math.min(minY, ry); maxX = Math.max(maxX, rx); maxY = Math.max(maxY, ry);
    rx = m[0] * x1 + m[2] * y1 + m[4]; ry = m[1] * x1 + m[3] * y1 + m[5]; minX = Math.min(minX, rx); minY = Math.min(minY, ry); maxX = Math.max(maxX, rx); maxY = Math.max(maxY, ry);
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
  buildActorRenderDebug(actor, drawList, bounds, skippedReason = null) {
    const invalidRectCount = (actor?.sprite?.imgcut?.parts || []).filter((p) => p.x < 0 || p.y < 0 || p.w <= 0 || p.h <= 0 || p.x + p.w > actor.sprite.image.width || p.y + p.h > actor.sprite.image.height).length;
    const invalidPartRefs = (actor?.model?.model?.parts || []).filter((p) => Number.isInteger(p.partIndex) && p.partIndex >= 0 && p.partIndex >= (actor?.sprite?.imgcut?.parts?.length || 0)).length;
    const invalidTrackRefs = {};
    for (const [role, animId] of [['move',actor?.moveAnimId],['idle',actor?.idleAnimId],['attack',actor?.attackAnimId],['kb',actor?.knockbackAnimId]]) {
      const anim = actor?.animations?.get?.(animId);
      invalidTrackRefs[role] = (anim?.tracks || []).filter((t) => !Number.isInteger(t.partId) || t.partId < 0 || t.partId >= (actor?.model?.parts?.length || 0)).length;
    }
    return {
      semanticKey: actor?.semanticKey || actor?.assetDef?.semanticKey || null,
      characterId: actor?.characterId || actor?.slotId || actor?.unitId || null,
      side: actor?.side || null,
      sourcePack: actor?.sourcePack || null,
      bundlePath: actor?.bundlePath || null,
      image: { width: actor?.sprite?.image?.width || 0, height: actor?.sprite?.image?.height || 0 },
      imgcut: { partCount: actor?.sprite?.imgcut?.parts?.length || 0, invalidRectCount },
      model: { partCount: actor?.model?.parts?.length || 0, invalidPartRefs },
      animations: {
        loadedRoles: [['move',actor?.moveAnimId],['idle',actor?.idleAnimId],['attack',actor?.attackAnimId],['kb',actor?.knockbackAnimId]].filter(([,id])=>actor?.animations?.has?.(id)).map(([role])=>role),
        missingRoles: [['move',actor?.moveAnimId],['idle',actor?.idleAnimId],['attack',actor?.attackAnimId],['kb',actor?.knockbackAnimId]].filter(([,id])=>!actor?.animations?.has?.(id)).map(([role])=>role),
        invalidTrackRefs
      },
      firstFrameBounds: actor?.firstFrameBounds || bounds || null,
      lastFrameBounds: bounds || null,
      transformExamples: (drawList || []).slice(0, 4).map((p) => ({ index: p.index, partIndex: p.partIndex, imgcutIndex: p.imgcutIndex, matrix: Array.isArray(p.matrix) ? p.matrix.slice(0, 6) : null, opacity: p.opacity })),
      skippedReason
    };
  }
  isAbsurdActorBounds(actor, bounds) {
    if (!bounds) return false;
    // This per-frame runtime gate must reject ONLY genuinely broken transforms, not
    // legitimate large-scale animation frames. A BCU attack/beam/explosion routinely
    // scales parts to tens of thousands of model-local px while the resting sprite sheet
    // is only a few hundred px wide. The previous `max(imageDim*4, 4096)` envelope assumed
    // a rendered model never exceeds ~4x its sheet and dropped the WHOLE actor on every
    // frame that exceeded it — e.g. enemy 393 (ラミエル) whose beam reaches ~15000px wide
    // from frame 130 onward, making the body blink out then reappear mid-attack.
    // That tight resting-frame envelope is correct only for the INITIAL/frame-0 draw and is
    // still enforced there at build time by scripts/check-actor-bundle-compatibility.mjs.
    // At runtime the only thing that genuinely cannot reach the canvas is a non-finite
    // (NaN/Infinity) coordinate — it corrupts the 2D context state for every later draw —
    // plus astronomically large extents that can only come from a matrix/parenting bug.
    if (!Number.isFinite(bounds.width) || !Number.isFinite(bounds.height)
      || !Number.isFinite(bounds.left) || !Number.isFinite(bounds.right)
      || !Number.isFinite(bounds.top) || !Number.isFinite(bounds.bottom)) return true;
    const SANITY_CAP_PX = 1_000_000;
    return bounds.width > SANITY_CAP_PX || bounds.height > SANITY_CAP_PX
      || Math.abs(bounds.left) > SANITY_CAP_PX || Math.abs(bounds.right) > SANITY_CAP_PX
      || Math.abs(bounds.top) > SANITY_CAP_PX || Math.abs(bounds.bottom) > SANITY_CAP_PX;
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
    actor.visualGroundContactPartIndexSet = new Set(candidates);
    actor.visualGroundReferenceBottomLocalY = overallBottom;
    actor.visualGroundAnchorLocalY = overallBottom;
  }
  getCurrentGroundContactBottomLocalY(actor, drawList) {
    const indices = actor.visualGroundContactPartIndices;
    if (!Array.isArray(indices) || !indices.length) return null;
    const allowed = actor.visualGroundContactPartIndexSet instanceof Set ? actor.visualGroundContactPartIndexSet : new Set(indices);
    actor.visualGroundContactPartIndexSet = allowed;
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
  initializeActorStableGroundAnchor(actor, drawList) {
    if (!actor || actor.stableGroundAnchorInitialized) return;
    this.initializeActorGroundContact(actor, drawList);
    const bounds = this.getBattleDrawListLocalBounds(actor, drawList);
    const anchor = Number.isFinite(actor.visualGroundAnchorLocalY) ? actor.visualGroundAnchorLocalY : (bounds && Number.isFinite(bounds.bottom) ? bounds.bottom : 0);
    actor.stableGroundAnchorLocalY = anchor;
    actor.stableGroundAnchorInitialized = true;
    actor.stableGroundAnchorSource = 'initial-reference-frame';
    actor.stableGroundAnchorDebug = { anchor, bounds, contactPartIndices: actor.visualGroundContactPartIndices || [] };
  }
  getActorGroundAnchorLocalY(actor, drawList) {
    this.initializeActorStableGroundAnchor(actor, drawList);
    const stable = Number.isFinite(actor.stableGroundAnchorLocalY) ? actor.stableGroundAnchorLocalY : 0;
    actor.lastGroundAnchorLocalY = stable;
    if (this._scene?.debugBattleEnabled || globalThis.__BCU_RENDER_DEBUG__ === true || globalThis.__BCU_DEBUG_ALLOCATIONS__ === true) {
      const current = this.getCurrentGroundContactBottomLocalY(actor, drawList);
      actor.lastGroundAnchorDebug = { stable, current: Number.isFinite(current) ? current : null, delta: Number.isFinite(current) ? current - stable : null, source: 'stable-ground-anchor-v0113' };
    }
    return stable;
  }
  drawActorLegacy(c, actor, drawList) {
    const baseAngle = actor.model.baseAngle || 3600;
    const paraOpacity = actor.bcuWarpParaTransform && Number.isFinite(actor.bcuWarpParaTransform.opacity) ? Math.max(0, Math.min(1, actor.bcuWarpParaTransform.opacity)) : 1;
    c.save(); c.translate(this.projectBattleX(this._scene,actor.x), this.getEntityRenderY(this._scene,actor,actor.y)); if (actor.renderFlipX) c.scale(-1, 1);
    for (const p of drawList) { const w = p.world; const partIndex = p.current?.partIndex ?? p.partIndex; const imgcutIndex = p.current?.imgcutIndex ?? p.imgcutIndex; if (!Number.isInteger(partIndex) || partIndex < 0) continue; if ((imgcutIndex ?? 0) < 0) continue; if (!w || (w.o ?? 1) * paraOpacity <= 0) continue; const part = actor.sprite?.imgcut?.parts?.[partIndex]; if (!part || part.w <= 0 || part.h <= 0) continue; c.save(); c.translate(w.x * actor.scale, w.y * actor.scale); c.rotate((w.a / baseAngle) * Math.PI * 2); c.globalAlpha = (w.o ?? 1) * paraOpacity; const sx = w.sx * actor.scale; const sy = w.sy * actor.scale; actor.sprite.drawPart(c, partIndex, -part.w * 0.5 * sx, -part.h * 0.5 * sy, { scaleX: sx, scaleY: sy }); c.restore(); }
    c.restore();
  }
  drawActor(c, actor) {
    if (!actor?.sprite || !actor?.model) return;
    if (actor.isRenderable ? !actor.isRenderable() : !actor.isAlive?.()) return;
    const hasBattleDrawList = typeof actor.model.getBattleDrawList === 'function';
    // BCU WaprCont ent.paraTo(A_W_C): the warp chara anim parents the whole entity, like KBEff paraTo.
    const warpPara = actor.bcuWarpParaTransform || null;
    const parentMatrix = actor.kbeffEnabled ? actor.kbeffParentMatrix : (warpPara?.matrix || null);
    const drawList = hasBattleDrawList ? actor.model.getBattleDrawList({ parentMatrix }) : actor.model.getDrawList();
    if (!hasBattleDrawList) { this.drawActorLegacy(c, actor, drawList); return; }
    const bounds = this.getBattleDrawListLocalBounds(actor, drawList);
    if (!actor.firstFrameBounds && bounds) actor.firstFrameBounds = bounds;
    if (this.isAbsurdActorBounds(actor, bounds)) {
      const skippedReason = 'non-finite-or-absurd-bounds';
      globalThis.__LAST_ACTOR_RENDER_DEBUG__ = this.buildActorRenderDebug(actor, drawList, bounds, skippedReason);
      actor.lastRenderSkippedReason = skippedReason;
      this._scene?.pushEvent?.({ type: 'actorRenderSkipped', actor: actor.instanceId || actor.label, semanticKey: actor.semanticKey || actor.assetDef?.semanticKey || null, reason: skippedReason, bounds });
      return;
    }
    // buildActorRenderDebug walks imgcut/model/anim arrays per actor and only ever
    // feeds the inspect-only __LAST_ACTOR_RENDER_DEBUG__ global (read by hand in
    // devtools, never by runtime/tests). Skip that per-frame allocation during
    // normal play; populate it only when battle debug or the opt-in flag is on.
    if (this._scene?.debugBattleEnabled || globalThis.__BCU_RENDER_DEBUG__ === true) {
      globalThis.__LAST_ACTOR_RENDER_DEBUG__ = this.buildActorRenderDebug(actor, drawList, bounds, null);
    }
    const anchorY = this.getActorGroundAnchorLocalY(actor, drawList);
    c.save();
    const alignCfg = BATTLE_CONFIG.tuning?.visualOriginAlignment || {};
    if (alignCfg?.enabled) {
      if (alignCfg.recomputePerFrame === true) {
        BattleBodyResolver.computeActorRenderAlignmentFromDrawList(actor, drawList, alignCfg);
      } else if (!actor.stableRenderOffsetInitialized) {
        BattleBodyResolver.initializeStableRenderAlignment(actor, drawList, alignCfg);
      } else {
        BattleBodyResolver.applyStableRenderAlignment(actor);
      }
    }
    const modelAlignOffsetX = Number.isFinite(actor.visualRenderOffsetWorldPx) ? actor.visualRenderOffsetWorldPx : 0;
    const prevOffset = Number.isFinite(actor.lastRenderOffsetWorldPx) ? actor.lastRenderOffsetWorldPx : modelAlignOffsetX;
    const deltaOffset = modelAlignOffsetX - prevOffset;
    actor.lastRenderOffsetWorldPx = modelAlignOffsetX;
    if (Math.abs(deltaOffset) > (alignCfg.maxAllowedOffsetJumpPx ?? 8)) actor.lastRenderAnchorJumpDebug = { state: actor.state, animId: actor.currentAnimId, activeAnimRole: actor.activeAnimRole, prevOffset, nextOffset: modelAlignOffsetX, delta: deltaOffset, source: actor.visualRenderOffsetSource };
    const crowdOffsetX = Number.isFinite(actor.visualCrowdFanoutPx) ? actor.visualCrowdFanoutPx : 0;
    const crowdOffsetY = Number.isFinite(actor.visualCrowdYOffsetPx) ? actor.visualCrowdYOffsetPx : 0;
    const kbOffsetX = Number.isFinite(actor.kbVisualOffsetX) ? actor.kbVisualOffsetX : 0;
    const kbOffsetY = Number.isFinite(actor.kbVisualOffsetY) ? actor.kbVisualOffsetY : 0;
    const crowdScale = Number.isFinite(actor.visualCrowdScaleMultiplier) ? actor.visualCrowdScaleMultiplier : 1;
    const kbScale = Number.isFinite(actor.kbVisualScale) ? actor.kbVisualScale : 1;
    const renderY=this.getEntityRenderY(this._scene,actor,actor.y);
    c.translate(this.projectBattleX(this._scene,actor.x + modelAlignOffsetX + crowdOffsetX + kbOffsetX), renderY + crowdOffsetY + kbOffsetY);
    if (actor.renderFlipX) c.scale(-1, 1);
    const s = Number.isFinite(actor.scale) ? actor.scale : 1;
    const renderScale=this.getEntityRenderScale(this._scene,actor,s);c.scale(renderScale * crowdScale * kbScale, renderScale * crowdScale * kbScale);
    c.translate(0, -anchorY);
    const k = actor.kbeffParentTransform;
    if (k && actor.kbeffEnabled) {
      const tx = Number.isFinite(k.localX) ? k.localX : 0;
      const ty = Number.isFinite(k.localY) ? k.localY : 0;
      const sx = Number.isFinite(k.scaleX) ? k.scaleX : 1;
      const sy = Number.isFinite(k.scaleY) ? k.scaleY : 1;
      c.translate(tx, ty);
      if (Number.isFinite(k.angleRad) && k.angleRad !== 0) c.rotate(k.angleRad);
      if (sx !== 1 || sy !== 1) c.scale(sx, sy);
    }
    // BCU EPart.opa(): fa.opa() * opacity — the para parent opacity multiplies all parts.
    const paraOpacity = warpPara && Number.isFinite(warpPara.opacity) ? Math.max(0, Math.min(1, warpPara.opacity)) : 1;
    for (const p of drawList) {
      const partIndex = p.partIndex ?? p.current?.partIndex ?? p.rawPart?.partIndex;
      const imgcutIndex = p.imgcutIndex ?? p.current?.imgcutIndex ?? p.rawPart?.imgcutIndex;
      if (!Number.isInteger(partIndex) || partIndex < 0) continue;
      if ((imgcutIndex ?? 0) < 0) continue;
      const opacity = (Number.isFinite(p.opacity) ? p.opacity : (p.world?.o ?? 1)) * paraOpacity;
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
