export class BattleCastleResolver {
  static numberOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  static getAssetVisualBounds(asset = null) {
    const crop = asset?.crop || asset?.imgcut?.part || null;
    const visual = asset?.visualBounds || null;
    const image = asset?.image || null;
    const width = this.numberOrNull(crop?.w) ?? this.numberOrNull(visual?.width) ?? this.numberOrNull(image?.width) ?? null;
    const height = this.numberOrNull(crop?.h) ?? this.numberOrNull(visual?.height) ?? this.numberOrNull(image?.height) ?? null;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
    return {
      width,
      height,
      cropX: this.numberOrNull(crop?.x) ?? 0,
      cropY: this.numberOrNull(crop?.y) ?? 0,
      source: crop ? 'imgcut-crop' : (visual ? 'visualBounds' : 'image-size')
    };
  }

  static resolveGeometry({ side, x, y, scale = 1, asset = null, fallbackWidth = 160, fallbackHeight = 220, source = 'castle-runtime' } = {}) {
    const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
    const b = this.getAssetVisualBounds(asset) || {
      width: Math.max(1, Number(fallbackWidth) || 160),
      height: Math.max(1, Number(fallbackHeight) || 220),
      cropX: 0,
      cropY: 0,
      source: 'fallback-size'
    };
    const worldX = Number.isFinite(x) ? x : 0;
    const groundY = Number.isFinite(y) ? y : 0;
    const width = b.width * s;
    const height = b.height * s;
    const visualBox = {
      left: worldX - width * 0.5,
      right: worldX + width * 0.5,
      top: groundY - height,
      bottom: groundY,
      width,
      height,
      centerX: worldX,
      centerY: groundY - height * 0.5
    };

    // BCU stage/base data treats castle/base as an independent battlefield object.
    // Until castle mamodel body metadata is available, use the resolved imgcut visual crop as the authoritative base body.
    // This is intentionally not the old arbitrary 0.42 width approximation.
    const combatBox = {
      ...visualBox,
      halfWidth: width * 0.5,
      source: `${source}:${b.source}:full-visual-body`
    };
    const frontX = side === 'cat-enemy' ? combatBox.right : combatBox.left;
    return {
      side,
      x: worldX,
      y: groundY,
      scale: s,
      visualBounds: { width: b.width, height: b.height, cropX: b.cropX, cropY: b.cropY, source: b.source },
      visualWorldBox: visualBox,
      combatBodyBox: combatBox,
      frontX,
      bodySource: combatBox.source,
      anchor: 'bottom-center',
      source
    };
  }

  static applyToBase(base, options = {}) {
    if (!base) return null;
    const geometry = this.resolveGeometry({
      side: base.side,
      x: base.x,
      y: base.y,
      scale: Number.isFinite(options.scale) ? options.scale : base.scale,
      asset: options.asset || base.castleAsset || null,
      fallbackWidth: options.fallbackWidth,
      fallbackHeight: options.fallbackHeight,
      source: options.source || 'BattleCastleResolver.applyToBase'
    });
    base.castleGeometry = geometry;
    base.visualBoundsPx = { width: geometry.visualBounds.width, height: geometry.visualBounds.height };
    base.visualWorldBox = geometry.visualWorldBox;
    base.combatBodyBoxOverride = geometry.combatBodyBox;
    base.combatBodyHalfWidthPx = geometry.combatBodyBox.halfWidth;
    base.combatBodyHeightPx = geometry.combatBodyBox.height;
    base.combatBodyYOffsetPx = 0;
    base.frontX = geometry.frontX;
    base.combatBodySource = geometry.bodySource;
    base.visualBottomToGround = true;
    base.visualBottomToCurrentCenter = false;
    return geometry;
  }
}
