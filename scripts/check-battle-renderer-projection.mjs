import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BattleSceneRenderer } from '../js/battle/BattleSceneRenderer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rendererPath = path.resolve(__dirname, '../js/battle/BattleSceneRenderer.js');
const src = fs.readFileSync(rendererPath, 'utf8');
const renderer = new BattleSceneRenderer();

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const scene = {
  camera: {
    siz: 2,
    zoom: 1.5,
    pixelsPerWorldUnit: 3,
    pos: 10,
    offsetX: 9,
    worldToScreenX: (x) => x * 10 + 7,
  },
};

assert(renderer.projectX(scene, 4) === 47, 'projectX should use worldToScreenX');
assert(renderer.projectX({}, 4) === 4, 'projectX should fallback to worldX without camera');
assert(renderer.getCameraScale(scene) === 2, 'getCameraScale should prioritize siz');
assert(renderer.getCameraScale({ camera: { siz: Number.NaN, zoom: 1.25 } }) === 1.25, 'getCameraScale should fallback to zoom');
assert(renderer.getPixelsPerWorldUnit(scene) === 3, 'getPixelsPerWorldUnit should prioritize pixelsPerWorldUnit');
assert(renderer.getCameraWorldLeft(scene) === 10, 'getCameraWorldLeft should prioritize pos');
assert(renderer.getBackgroundCameraOffsetX(scene) === -30, 'background camera offset should be -pos * pixelsPerWorldUnit');

const baseScreenX = renderer.projectX(scene, 12);
const scale = (1.2) * renderer.getCameraScale(scene);
const layerOffsetX = (5) * scale;
const compositeX = baseScreenX + layerOffsetX - 100 * 0.5 * scale;
assert(Number.isFinite(compositeX), 'composite projection calculation should apply offset after projectX');

assert(!src.includes('projectX(this._scene,base.x+(layer.offsetX'), 'world/screen mixed base projection pattern must not remain');
assert(!/fillText\([^\)]*box\.left\s*,/.test(src), 'unprojected debug fillText(box.left) must not remain');
assert(!src.includes('camera.stageLen ='), 'renderer must not mutate camera.stageLen');
assert(!src.includes('scene.stage.runtime.stageLen ='), 'renderer must not mutate runtime stageLen');
assert(!src.includes('scene.stageLen ='), 'renderer must not mutate scene.stageLen');
assert(src.includes('cam pos:') && src.includes('`,24,204);') && src.includes('stageSpawn rows:') && src.includes('`,24,224);'), 'drawHud camera/stageSpawn lines should be on different Y');

console.log('check-battle-renderer-projection: OK');
