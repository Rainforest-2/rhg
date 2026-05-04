export class BattleEffect {
  constructor({ id, type = 'hit', x, y, durationMs = 225, frameDurationMs = 45, frameParts = [], image = null, scale = 1 }) { this.id = id; this.type = type; this.x = x; this.y = y; this.elapsedMs = 0; this.durationMs = durationMs; this.frameDurationMs = frameDurationMs; this.frameParts = frameParts; this.image = image; this.scale = scale; this.finished = false; this.currentPart = frameParts[0] || null; }
  tick(dt) { this.elapsedMs += dt; const idx = Math.min(this.frameParts.length - 1, Math.floor(this.elapsedMs / this.frameDurationMs)); this.currentPart = this.frameParts[idx] || null; if (this.elapsedMs >= this.durationMs) this.finished = true; }
}
