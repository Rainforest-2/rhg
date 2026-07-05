// Deterministic guard for the 1x render interpolation that smooths in-game
// (actor/effect) motion over BCU's fixed 30fps logic timer while the app paints
// at 60fps. Pure math on BattleSceneRenderer.getRenderBaseX, no DOM required.
import assert from 'node:assert';
import { BattleSceneRenderer } from '../js/battle/BattleSceneRenderer.js';

const r = new BattleSceneRenderer();

// ---- disabled (2x+, or no renderInterp published): raw logical X, exact prior behavior ----
r._scene = null;
assert.strictEqual(r.getRenderBaseX({ x: 123, renderPrevX: 0 }), 123, 'no scene -> raw x');
r._scene = { renderInterp: { enabled: false, alpha: 0.5 } };
assert.strictEqual(r.getRenderBaseX({ x: 100, renderPrevX: 0 }), 100, 'disabled -> raw x (no interpolation at 2x+)');

// ---- enabled (1x): lerp between previous and current logic-frame X by alpha ----
r._scene = { renderInterp: { enabled: true, alpha: 0.5 } };
assert.strictEqual(r.getRenderBaseX({ x: 100, renderPrevX: 0 }), 50, 'alpha 0.5 -> midpoint');
r._scene.renderInterp.alpha = 0;
assert.strictEqual(r.getRenderBaseX({ x: 100, renderPrevX: 60 }), 60, 'alpha 0 -> previous frame position');
r._scene.renderInterp.alpha = 1;
assert.strictEqual(r.getRenderBaseX({ x: 100, renderPrevX: 60 }), 100, 'alpha 1 -> current frame position');
r._scene.renderInterp.alpha = 0.25;
assert.strictEqual(r.getRenderBaseX({ x: 40, renderPrevX: 0 }), 10, 'alpha 0.25 -> quarter of the step');

// ---- spawn (no renderPrevX yet): treat prev as current -> no slide from origin ----
r._scene.renderInterp.alpha = 0.5;
assert.strictEqual(r.getRenderBaseX({ x: 500 }), 500, 'missing renderPrevX -> no interpolation on first frame');

// ---- teleport (warp/respawn/lineup swap): snap to current instead of a long slide ----
r._scene.renderInterp.alpha = 0.5;
assert.strictEqual(r.getRenderBaseX({ x: 2000, renderPrevX: 0 }), 2000, 'jump > teleport threshold -> snap to current x');
// A normal per-step move / knockback stays under the threshold and interpolates.
assert.strictEqual(r.getRenderBaseX({ x: 300, renderPrevX: 100 }), 200, 'sub-threshold move still interpolates');

console.log('check-battle-render-interpolation: OK');
