import { BATTLE_CONFIG } from './BattleConfig.js';
import { BattleSceneRenderer } from './BattleSceneRenderer.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-renderer-patch.v1');
const BCU_RENDER = Object.freeze({ off: 200, roadH: 156, castW: 128, castH: 256 });

function getCameraScale(renderer, scene) {
  return renderer.getCameraScale?.(scene) ?? scene?.camera?.siz ?? scene?.camera?.zoom ?? 1;
}

function getBcuRenderX(renderer, scene, posBcu) {
  if (typeof scene?.camera?.getBcuRenderX === 'function') return scene.camera.getBcuRenderX(posBcu);
  if (typeof scene?.camera?.worldToScreenX === 'function') return scene.camera.worldToScreenX(posBcu);
  const ratio = Number.isFinite(scene?.camera?.ratio) ? scene.camera.ratio : 768 / 2400;
  const siz = getCameraScale(renderer, scene);
  const pos = Number.isFinite(scene?.camera?.pos) ? scene.camera.pos : 0;
  return ((posBcu - pos) * ratio + BCU_RENDER.off) * siz;
}

function getBcuRoadTopY(renderer, scene, canvasH) {
  const siz = getCameraScale(renderer, scene);
  return canvasH - BCU_RENDER.roadH * siz;
}

function getBaseCombatPos(base) {
  if (typeof base?.getBattlePosBcu === 'function') return base.getBattlePosBcu();
  if (Number.isFinite(base?.posBcu)) return base.posBcu;
  if (Number.isFinite(base?.frontX)) return base.frontX;
  return Number.isFinite(base?.x) ? base.x : 0;
}

function drawTiledCrop(ctx, image, crop, startX, y, scale, targetW) {
  const dw = crop.w * scale;
  const dh = crop.h * scale;
  if (!(dw > 0) || !(dh > 0)) return;
  let x = startX;
  while (x > 0) x -= dw;
  while (x < targetW) {
    ctx.drawImage(image, crop.x, crop.y, crop.w, crop.h, x, y, dw, dh);
    x += dw;
  }
}

function getCompositeBounds(renderer, base) {
  if (typeof renderer.getCompositeBaseLocalBounds === 'function') return renderer.getCompositeBaseLocalBounds(base);
  const layers = base?.layers || [];
  let minX = Infinity;
  let maxX = -Infinity;
  for (const layer of layers) {
    if (!layer?.image) continue;
    const ox = Number.isFinite(layer.offsetX) ? layer.offsetX : 0;
    minX = Math.min(minX, ox - layer.image.width * 0.5);
    maxX = Math.max(maxX, ox + layer.image.width * 0.5);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(maxX)) return null;
  return { left: minX, right: maxX, width: maxX - minX };
}

export function installBattleSceneRendererBcuPatch() {
  const proto = BattleSceneRenderer?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;
  proto.bcuRenderConstants = BCU_RENDER;
  proto.getBcuRenderX = function getBcuRenderXPatched(scene, posBcu) {
    return getBcuRenderX(this, scene, posBcu);
  };
  proto.getBcuRoadTopY = function getBcuRoadTopYPatched(scene, canvasH = 720) {
    return getBcuRoadTopY(this, scene, canvasH);
  };

  proto.drawBackgroundBcuStage0 = function drawBackgroundBcuStage0BcuPatched(ctx, bg, w, h, scene) {
    const colors = bg?.colors;
    const crop = bg?.crop;
    const image = bg?.image;
    if (!image || !crop || !colors) {
      this.drawBackgroundCropCover(ctx, bg, w, h);
      return;
    }
    const siz = getCameraScale(this, scene);
    const roadTopY = getBcuRoadTopY(this, scene, h);
    const fw = crop.w * siz;
    const fh = crop.h * siz;
    const bgStartX = getBcuRenderX(this, scene, 0) - fw;
    this.drawVerticalGradient(ctx, 0, 0, w, roadTopY, colors.skyTop, colors.skyBottom);
    drawTiledCrop(ctx, image, crop, bgStartX, roadTopY - fh, siz, w);
    this.drawVerticalGradient(ctx, 0, roadTopY, w, Math.max(0, h - roadTopY), colors.groundTop, colors.groundBottom);
    if (bg.upperCrop) {
      const upper = bg.upperCrop;
      const upperStartX = getBcuRenderX(this, scene, 0) - upper.w * siz;
      drawTiledCrop(ctx, image, upper, upperStartX, 0, siz, w);
    }
    bg.source = {
      ...(bg.source || {}),
      rendererMode: 'bcu-background-draw-patch',
      bcuOff: BCU_RENDER.off,
      bcuRoadH: BCU_RENDER.roadH,
      roadTopY,
      bgStartX,
      bgTileWidth: fw
    };
  };

  proto.drawBcuEnemyCastle = function drawBcuEnemyCastleBcuPatched(ctx, base) {
    const asset = base?.castleAsset;
    const crop = asset?.crop;
    if (!asset?.image || !crop) return;
    const siz = getCameraScale(this, this._scene);
    const posBcu = getBaseCombatPos(base);
    const posX = getBcuRenderX(this, this._scene, posBcu);
    const posY = getBcuRoadTopY(this, this._scene, ctx.canvas?.height || 720);
    const drawW = crop.w * siz;
    const drawH = crop.h * siz;
    const drawX = posX - drawW;
    const drawY = posY - drawH;
    ctx.drawImage(asset.image, crop.x, crop.y, crop.w, crop.h, drawX, drawY, drawW, drawH);
    base.renderDebug = { ...(base.renderDebug || {}), rendererMode: 'bcu-enemy-castle-png', posBcu, posX, posY, drawX, drawY, drawW, drawH, anchor: 'right-bottom' };
  };

  const originalDrawBase = proto.drawBase;
  proto.drawBase = function drawBaseBcuPatched(ctx, base, groundY, showParts) {
    if (base?.visualKind === 'bcu-enemy-castle' && base.castleAsset?.image) {
      this.drawBcuEnemyCastle(ctx, base);
      if (showParts) this.drawBaseDebug(ctx, base);
      return;
    }
    if (base?.visualKind === 'castle-composite' && base.layers?.length) {
      const siz = getCameraScale(this, this._scene);
      const baseScale = Number.isFinite(base.scale) ? base.scale : 1;
      const scale = baseScale * siz;
      const posBcu = getBaseCombatPos(base);
      const posX = getBcuRenderX(this, this._scene, posBcu);
      const posY = getBcuRoadTopY(this, this._scene, ctx.canvas?.height || 720);
      const bounds = getCompositeBounds(this, base);
      const visualLeftShift = bounds ? -bounds.left * scale : 0;
      for (const layer of base.layers) {
        if (!layer?.image) continue;
        const offsetX = Number.isFinite(layer.offsetX) ? layer.offsetX * scale : 0;
        const offsetY = Number.isFinite(layer.offsetY) ? layer.offsetY * scale : 0;
        const x = posX + visualLeftShift + offsetX - layer.image.width * 0.5 * scale;
        const y = posY + offsetY - layer.image.height * scale;
        ctx.drawImage(layer.image, x, y, layer.image.width * scale, layer.image.height * scale);
      }
      base.renderDebug = { ...(base.renderDebug || {}), rendererMode: 'bcu-player-castle-composite', posBcu, posX, posY, visualLeftShift, anchor: 'left-bottom', scale };
      if (showParts) this.drawBaseDebug(ctx, base);
      return;
    }
    return originalDrawBase.call(this, ctx, base, groundY, showParts);
  };
}

installBattleSceneRendererBcuPatch();
