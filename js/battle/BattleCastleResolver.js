export class BattleCastleResolver {
  static numberOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  static getAssetVisualBounds(asset = null) {
    const visual = asset?.visualBounds || null;
    const image = asset?.image || null;
    const width = this.numberOrNull(visual?.width) ?? this.numberOrNull(image?.naturalWidth) ?? this.numberOrNull(image?.width) ?? null;
    const height = this.numberOrNull(visual?.height) ?? this.numberOrNull(image?.naturalHeight) ?? this.numberOrNull(image?.height) ?? null;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
    return { width, height, source: visual?.parser || visual?.source || 'image-size-no-imgcut' };
  }

  static resolveVisualGeometry({ x = 0, y = 0, scale = 1, asset = null, fallbackWidth = 160, fallbackHeight = 220, source = 'castle-visual-only' } = {}) {
    const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
    const b = this.getAssetVisualBounds(asset) || { width: Math.max(1, Number(fallbackWidth) || 160), height: Math.max(1, Number(fallbackHeight) || 220), source: 'fallback-size' };
    const worldX = Number.isFinite(x) ? x : 0;
    const groundY = Number.isFinite(y) ? y : 0;
    const width = b.width * s;
    const height = b.height * s;
    return {
      x: worldX,
      y: groundY,
      scale: s,
      visualBounds: { width: b.width, height: b.height, source: b.source },
      visualWorldBox: { left: worldX - width * 0.5, right: worldX + width * 0.5, top: groundY - height, bottom: groundY, width, height, centerX: worldX, centerY: groundY - height * 0.5 },
      combatBodyBox: null,
      frontX: null,
      bodySource: 'none-visual-only-bcu-base-uses-pos-point',
      anchor: 'visual-bottom-center',
      source
    };
  }

  static applyToBase(base, options = {}) {
    if (!base) return null;
    const geometry = this.resolveVisualGeometry({
      x: base.x,
      y: base.y,
      scale: Number.isFinite(options.scale) ? options.scale : base.scale,
      asset: options.asset || base.castleAsset || null,
      fallbackWidth: options.fallbackWidth,
      fallbackHeight: options.fallbackHeight,
      source: options.source || 'BattleCastleResolver.applyToBase.visual-only'
    });
    base.castleGeometry = geometry;
    base.visualBoundsPx = { width: geometry.visualBounds.width, height: geometry.visualBounds.height };
    base.visualWorldBox = geometry.visualWorldBox;
    base.visualBottomToGround = true;
    base.visualBottomToCurrentCenter = false;
    return geometry;
  }
}
