export class BattleEffect {
  constructor({ id, type = 'hit', x, y, durationMs = 225, frameDurationMs = 45, frameParts = [], image = null, imgcut = null, model = null, animator = null, scale = 1, source = 'effect', debug = null, createdAtMs = null, layer = null, bcuSmokeYOffset = null, bcuScreenOffsetX = 0, renderFlipX = false, bcuScaleMode = 'legacy' }) {
    this.id = id;
    this.type = type;
    this.x = x;
    this.y = y;
    this.worldX = x;
    this.worldY = y;
    this.source = source;
    this.currentLayer = Number.isFinite(Number(layer)) ? Number(layer) : 0;
    this.layer = this.currentLayer;
    this.bcuRenderLayer = this.currentLayer;
    this.bcuRenderLayerSource = Number.isFinite(Number(layer)) ? 'effect-runtime-layer' : 'effect-runtime-default-layer';
    this.bcuSmokeYOffset = Number.isFinite(Number(bcuSmokeYOffset)) ? Number(bcuSmokeYOffset) : null;
    this.bcuScreenOffsetX = Number.isFinite(Number(bcuScreenOffsetX)) ? Number(bcuScreenOffsetX) : 0;
    this.renderFlipX = renderFlipX === true;
    this.bcuScaleMode = bcuScaleMode;
    this.createdAtMs = createdAtMs;
    this.effectRuntimeDebug = debug || { source, type, worldX: x, worldY: y, hasImage: !!image, frameCount: frameParts?.length || 0 };
    this.elapsedMs = 0;
    this.durationMs = durationMs;
    this.frameDurationMs = frameDurationMs;
    this.frameParts = frameParts;
    this.image = image;
    this.imgcut = imgcut;
    this.model = model;
    this.animator = animator;
    this.scale = scale;
    this.finished = false;
    this.currentPart = frameParts[0] || null;
  }

  tick(dt) {
    if (this.finished) return;
    this.elapsedMs += dt;
    if (this.animator?.tick) this.animator.tick(dt);
    if (this.animator?.apply && this.model) this.animator.apply(this.model);
    const idx = Math.min(this.frameParts.length - 1, Math.floor(this.elapsedMs / this.frameDurationMs));
    this.currentPart = this.frameParts[idx] || null;
    if (this.elapsedMs >= this.durationMs) this.finished = true;
    // Inspect-only snapshot; allocating it per effect per tick is pure GC pressure.
    if (globalThis.__BCU_DEBUG_ALLOCATIONS__ === true) {
      this.lastTickDebug = {
        elapsedMs: this.elapsedMs,
        durationMs: this.durationMs,
        finished: this.finished,
        currentPartName: this.currentPart?.name || null,
        animatorFrame: this.animator?.frame ?? null,
        animatorMaxFrame: this.animator?.anim?.maxFrame ?? null
      };
    }
  }
}
