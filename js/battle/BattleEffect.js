export class BattleEffect {
  constructor({ id, type = 'hit', x, y, durationMs = 225, frameDurationMs = 45, frameParts = [], image = null, scale = 1, source = 'effect', debug = null, createdAtMs = null, layer = null, bcuSmokeYOffset = null }) {
    this.id = id; this.type = type;
    this.x = x; this.y = y; // world coordinates
    this.worldX = x; this.worldY = y;
    this.source = source;
    this.currentLayer = Number.isFinite(Number(layer)) ? Number(layer) : 0;
    this.bcuRenderLayer = this.currentLayer;
    this.bcuRenderLayerSource = Number.isFinite(Number(layer)) ? 'effect-runtime-layer' : 'effect-runtime-default-layer';
    this.bcuSmokeYOffset = Number.isFinite(Number(bcuSmokeYOffset)) ? Number(bcuSmokeYOffset) : null;
    this.createdAtMs = createdAtMs;
    this.effectRuntimeDebug = debug || { source, type, worldX: x, worldY: y, hasImage: !!image, frameCount: frameParts?.length || 0 };
    this.elapsedMs = 0; this.durationMs = durationMs; this.frameDurationMs = frameDurationMs; this.frameParts = frameParts; this.image = image; this.scale = scale; this.finished = false; this.currentPart = frameParts[0] || null;
  }
  tick(dt) { this.elapsedMs += dt; const idx = Math.min(this.frameParts.length - 1, Math.floor(this.elapsedMs / this.frameDurationMs)); this.currentPart = this.frameParts[idx] || null; if (this.elapsedMs >= this.durationMs) this.finished = true; this.lastTickDebug = { elapsedMs: this.elapsedMs, durationMs: this.durationMs, finished: this.finished, currentPartName: this.currentPart?.name || null }; }
}
