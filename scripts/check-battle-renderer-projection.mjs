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
assert(renderer.projectBattleX({ camera: { getBcuRenderX: (x) => x + 200 } }, 4) === 204, 'projectBattleX should use BCU projection for battlefield entities');
assert(renderer.getCameraScale(scene) === 2, 'getCameraScale should prioritize siz');
assert(renderer.getCameraScale({ camera: { siz: Number.NaN, zoom: 1.25 } }) === 1.25, 'getCameraScale should fallback to zoom');
assert(renderer.getPixelsPerWorldUnit(scene) === 3, 'getPixelsPerWorldUnit should prioritize pixelsPerWorldUnit');
assert(renderer.getCameraWorldLeft(scene) === 10, 'getCameraWorldLeft should prioritize pos');
assert(renderer.getBackgroundCameraOffsetX(scene) === -30, 'background camera offset should be -pos * pixelsPerWorldUnit');
assert(renderer.getBcuRenderConstants().off === 200, 'BCU render off should match BattleBox.BBPainter.off');
assert(renderer.getBcuRenderConstants().roadH === 156, 'BCU road height should match BattleBox.BBPainter.road_h');
assert(renderer.getBcuLayerScreenY({ camera: { siz: 2 }, groundY: 560 }, 3, 720) === 560 - (156 - 12) * 2, 'BCU layer Y should use road_h and DEP');
assert(renderer.getBcuSpriteScale({ camera: { siz: 2 } }, 1.25) === 1.25 * 2 * 0.8, 'BCU sprite scale should include sprite multiplier');
const layerActor = { currentLayer: 2 };
assert(renderer.getBcuEntityLayer(layerActor) === 2, 'renderer should read actor currentLayer as BCU layer');
assert(renderer.getEntityRenderY({ camera: { siz: 1 }, groundY: 560 }, layerActor, 720) === 560 - (156 - 8), 'entity render Y should use BCU road baseline and DEP');
assert(layerActor.lastRenderYDebug?.source, 'entity render Y should leave debug source');

const bgLayout = renderer.getBcuBackgroundLayout(
  { camera: { siz: 2, ratio: 0.32, pos: 10, bcuOff: 200 }, groundY: 560 },
  { crop: { w: 100, h: 50 } },
  1280,
  720
);
assert(bgLayout.dx === -(10 * 0.32 * 2) + 200 * 2 - 100 * 2, 'BCU background dx should match pos + 200*siz - bgWidth');
assert(bgLayout.dy === 560 - 50 * 2, 'BCU background dy should anchor crop bottom to groundY');

const baseScreenX = renderer.projectX(scene, 12);
const scale = 1.2 * renderer.getCameraScale(scene);
const compositeX = renderer.addScreenOffsetX(baseScreenX, 5 * 1.2, scene) - 100 * 0.5 * scale;
assert(Number.isFinite(compositeX), 'composite projection calculation should apply offset after projectX');
assert(
  (src.includes('const baseScreenX=this.projectX(this._scene,base.x);') || src.includes('const baseScreenX=this.projectBcuX(this._scene,base.x);')) &&
    (src.includes('this.addScreenOffsetX(baseScreenX') || src.includes('baseScreenX+layerOffsetX')),
  'composite base rendering must apply layer offset in screen space after projection',
);

assert(!src.includes('projectX(this._scene,base.x+(layer.offsetX'), 'world/screen mixed base projection pattern must not remain');
assert(!/fillText\([^\)]*box\.left\s*,/.test(src), 'unprojected debug fillText(box.left) must not remain');
assert(!src.includes('camera.stageLen ='), 'renderer must not mutate camera.stageLen');
assert(!src.includes('scene.stage.runtime.stageLen ='), 'renderer must not mutate runtime stageLen');
assert(!src.includes('scene.stageLen ='), 'renderer must not mutate scene.stageLen');
assert(src.includes('BCU-java-PC BattleBox.BBPainter'), 'renderer should cite BCU BattleBox render constants');
assert(src.includes('BCU Background.draw parity'), 'renderer should expose BCU background layout source');
assert(src.includes('BCU Background.draw ground-gradient-first'), 'background draw should record BCU ground-gradient-first source');
assert(src.includes("ground.addColorStop(0,'#d8c59a')"), 'fallback background ground must be a gradient, not a solid band');
assert(src.includes("base.side==='dog-player'?this.addScreenOffsetX"), 'player castle composite should use BCU left-edge drawNyCast anchor');
assert(src.includes('bg.lastRenderDebug'), 'background rendering should leave debug layout data');
assert(src.includes('projectBattleX(scene, worldX)'), 'renderer should expose unified BCU battle projection helper');
assert(src.includes('applyBcuProjection'), 'renderer should make BCU battle projection explicit');
assert(src.includes('getEntityRenderY'), 'renderer should expose BCU entity render Y helper');
assert(src.includes('getEntityRenderScale'), 'renderer should expose entity render scale helper');
assert(src.includes('cam pos:') && src.includes('`,24,204);') && src.includes('stageSpawn rows:') && src.includes('`,24,224);'), 'drawHud camera/stageSpawn lines should be on different Y');

console.log('check-battle-renderer-projection: OK');
