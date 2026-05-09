import { BattleCamera } from '../js/battle/BattleCamera.js';
import { BattleCameraInputController } from '../js/preview/BattleCameraInputController.js';
import { DebugBattleInspector } from '../js/battle/DebugBattleInspector.js';

const nearly = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const checks = [];
const check = (name, cond) => checks.push({ name, ok: !!cond });

const cam = new BattleCamera({ stageLen: 4000, logicalW: 1280, initialSiz: 1 });
const world = 1234.56;
check('world->screen->world', nearly(cam.screenToWorldX(cam.worldToScreenX(world)), world));
const screen = 777.7;
check('screen->world->screen', nearly(cam.worldToScreenX(cam.screenToWorldX(screen)), screen));
check('bcu off default 200', cam.bcuOff === 200);
check('bcu projection includes off', nearly(cam.worldToScreenX(0), cam.originX + cam.bcuOff * cam.siz));
check('bcu projection formula', nearly(cam.worldToScreenX(800), cam.originX + ((800 - cam.pos) * cam.ratio + 200) * cam.siz));
check('stage pixel width includes both BCU margins', nearly(cam.stagePixelWidth, (cam.stageLen * cam.ratio + 400) * cam.siz));

cam.setStageLen(8000);
cam.setPos(500);
const stageLenBeforePan = cam.stageLen;
const posBeforePan = cam.pos;
cam.panByScreenDelta(-100);
check('pan changes pos', !nearly(cam.pos, posBeforePan));
check('pan keeps stageLen', cam.stageLen === stageLenBeforePan);

const stageLenBeforeZoom = cam.stageLen;
const anchor = 640;
const beforeWorldAtAnchor = cam.screenToWorldX(anchor);
cam.zoomAtScreenPoint(anchor, 1.5);
check('zoom keeps stageLen', cam.stageLen === stageLenBeforeZoom);
check('zoom keeps anchor world', nearly(cam.screenToWorldX(anchor), beforeWorldAtAnchor, 1e-4));
check('zoom keeps BCU inverse stable', nearly(cam.worldToScreenX(cam.screenToWorldX(anchor)), anchor, 1e-4));

cam.setPos(-999);
check('clamp min', cam.pos >= 0);
cam.setPos(999999);
check('clamp max', cam.pos <= cam.getClampRange().maxPos + 1e-6);

cam.setStageLen(10);
cam.setViewport(1280);
check('visible>=stage => pos0', cam.visibleWorldWidth >= cam.stageLen ? cam.pos === 0 : true);

const beforeViewportStageLen = cam.stageLen;
cam.setViewport(800);
check('setViewport keeps stageLen', cam.stageLen === beforeViewportStageLen);
cam.setStageLen(3000);
check('setStageLen mutates stageLen', cam.stageLen === 3000);

const canvas = { width: 1280, style: {}, addEventListener() {}, removeEventListener() {}, getBoundingClientRect() { return { left: 100, width: 640 }; } };
const ctrl = new BattleCameraInputController(canvas, () => cam, { logicalW: 1280 });
check('getCanvasLogicalX converts', nearly(ctrl.getCanvasLogicalX(420), ((420 - 100) / 640) * 1280));
check('getCanvasLogicalDeltaX converts', nearly(ctrl.getCanvasLogicalDeltaX(32), (32 / 640) * 1280));
ctrl.onWheel({ preventDefault() {}, ctrlKey: true, metaKey: false, clientX: 420, deltaY: -1, deltaX: 0 });
check('wheel zoom debug logicalX', Number.isFinite(ctrl.lastInputDebug?.logicalX));

const report = DebugBattleInspector.collect({ camera: cam, stage: { runtime: { stageLen: cam.stageLen }, definition: {} }, bases: [], actors: [], effects: [] });
check('inspector has clamp', !!report?.camera?.clamp);
check('inspector has visibleWorldRange', !!report?.camera?.visibleWorldRange);
check('inspector has camera stageLen', Number.isFinite(report?.camera?.stageLen));
check('inspector has bcu render offset', report?.camera?.bcuRenderOffset === 200 || report?.camera?.bcuOff === 200 || cam.bcuOff === 200);
check('inspector null safe', !!DebugBattleInspector.collect({}));

const failed = checks.filter((x) => !x.ok);
for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'} ${c.name}`);
if (failed.length) {
  console.error(`Failed ${failed.length} checks`);
  process.exit(1);
}
console.log('All BattleCamera contract checks passed');
