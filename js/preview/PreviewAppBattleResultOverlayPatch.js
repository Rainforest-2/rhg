import { PreviewApp } from './PreviewApp.js';
import { BattleScene } from '../battle/BattleScene.js';

const APP_PATCH_FLAG = Symbol.for('wanko-preview.battle-result-overlay.v1');
const SCENE_PATCH_FLAG = Symbol.for('wanko-battle.scene-result-state.v1');
const STYLE_ID = 'battle-result-overlay-style';

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .battle-result-overlay{position:absolute;inset:0;z-index:80;display:none;align-items:center;justify-content:center;pointer-events:auto;background:rgba(0,0,0,.08);font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow:hidden}
    .battle-result-overlay.is-visible{display:flex}
    .battle-result-card{width:100%;height:100%;position:relative;display:grid;grid-template-rows:1fr auto 1.15fr;align-items:center;justify-items:center;color:#fff;text-align:center;pointer-events:none}
    .battle-result-title{grid-row:1 / 3;align-self:end;margin:0 0 clamp(28px,5vh,46px);font-size:clamp(56px,13vw,142px);line-height:.92;font-weight:1000;letter-spacing:.03em;color:#fff;-webkit-text-stroke:clamp(4px,.7vw,9px) #050505;text-shadow:0 clamp(4px,.7vw,8px) 0 #050505,clamp(4px,.8vw,9px) clamp(7px,1vw,13px) 0 rgba(0,0,0,.58),0 0 18px rgba(255,255,255,.22);paint-order:stroke fill;transform:rotate(-1deg)}
    .battle-result-title.is-defeat{color:#f7f7f7;text-shadow:0 clamp(4px,.7vw,8px) 0 #050505,clamp(4px,.8vw,9px) clamp(7px,1vw,13px) 0 rgba(0,0,0,.66),0 0 14px rgba(248,113,113,.28)}
    .battle-result-ok{grid-row:3;align-self:start;pointer-events:auto;width:min(340px,42vw);min-width:170px;margin-top:clamp(18px,4vh,38px);border:clamp(3px,.5vw,5px) solid #070707;border-radius:999px;background:linear-gradient(180deg,#fff178 0%,#ffc31d 42%,#f09b00 55%,#d57b00 100%);color:#fff;font-size:clamp(30px,6.2vw,64px);font-weight:1000;letter-spacing:.04em;line-height:1;padding:clamp(10px,2vh,18px) clamp(28px,5vw,54px);box-shadow:inset 0 3px 0 rgba(255,255,255,.85),inset 0 -5px 0 rgba(98,42,0,.32),0 6px 0 #4a2600,0 12px 22px rgba(0,0,0,.38);text-shadow:0 3px 0 #050505,-2px 0 0 #050505,2px 0 0 #050505,0 -2px 0 #050505;touch-action:manipulation}
    .battle-result-ok:active{transform:translateY(4px);box-shadow:inset 0 2px 0 rgba(255,255,255,.75),inset 0 -3px 0 rgba(98,42,0,.28),0 2px 0 #4a2600,0 8px 14px rgba(0,0,0,.34)}
  `;
  document.head.appendChild(style);
}

function baseBySide(scene, side) {
  return (scene?.bases || []).find((base) => base?.side === side) || null;
}

function resolveBattleResult(scene) {
  const enemyBase = baseBySide(scene, 'cat-enemy');
  const playerBase = baseBySide(scene, 'dog-player');
  if (enemyBase && (enemyBase.destroyed || enemyBase.hp <= 0)) return { type: 'victory', title: '完全勝利!!' };
  if (playerBase && (playerBase.destroyed || playerBase.hp <= 0)) return { type: 'defeat', title: '敗北...' };
  return null;
}

function ensureOverlay(app) {
  injectStyle();
  const mount = document.querySelector('.canvas-panel') || document.body;
  let overlay = mount.querySelector(':scope > .battle-result-overlay');
  if (overlay) return overlay;
  overlay = document.createElement('section');
  overlay.className = 'battle-result-overlay';
  overlay.setAttribute('aria-live', 'polite');
  overlay.innerHTML = `
    <div class="battle-result-card">
      <h1 class="battle-result-title">完全勝利!!</h1>
      <button class="battle-result-ok" type="button">OK</button>
    </div>
  `;
  overlay.querySelector('.battle-result-ok')?.addEventListener('click', () => app.returnToFormationFromBattleResult?.());
  mount.appendChild(overlay);
  return overlay;
}

function showOverlay(app, result) {
  const overlay = ensureOverlay(app);
  const type = result?.type || 'victory';
  // The result watcher re-runs every animation frame while a terminal result is
  // still in memory. Once the overlay already shows this result there is nothing
  // to change, so skip the per-frame DOM writes and visibility re-assertions.
  if (overlay.classList.contains('is-visible') && overlay.dataset.result === type) return;
  const title = overlay.querySelector('.battle-result-title');
  if (title) {
    title.textContent = result?.title || '完全勝利!!';
    title.classList.toggle('is-defeat', type === 'defeat');
  }
  overlay.dataset.result = type;
  overlay.classList.add('is-visible');
  app.productionBar?.setVisible(false);
  // The BCU speed-up control is battle-only; hide it on the result screen so the
  // fixed FAB (z-index 99970) does not float over the victory/defeat card. The
  // next battle's resetBattle re-shows it, so this never leaves it stuck off.
  app.speedControl?.setVisible(false);
}

function hideOverlay(app) {
  const overlay = document.querySelector('.battle-result-overlay');
  overlay?.classList.remove('is-visible');
}

function installSceneResultPatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[SCENE_PATCH_FLAG]) return;
  proto[SCENE_PATCH_FLAG] = true;
  const originalTick = proto.tick;
  if (typeof originalTick !== 'function') return;
  proto.tick = function tickWithBattleResultState(dt) {
    if (this.battleState !== 'running') return originalTick.call(this, dt);
    const out = originalTick.call(this, dt);
    const result = resolveBattleResult(this);
    if (result) {
      this.battleState = result.type;
      this.battleResult = result;
      this.pushEvent?.({ type: 'battleResult', result: result.type, title: result.title, source: 'PreviewAppBattleResultOverlayPatch' });
    }
    return out;
  };
}

function installResultWatcher(app) {
  if (app.__battleResultOverlayWatcherInstalled) return;
  app.__battleResultOverlayWatcherInstalled = true;
  const tick = () => {
    const scene = app.battleScene;
    const result = scene?.battleResult || (scene?.battleState === 'victory' ? { type: 'victory', title: '完全勝利!!' } : scene?.battleState === 'defeat' ? { type: 'defeat', title: '敗北...' } : resolveBattleResult(scene));
    if (result && app.sceneReady && !app.sceneTransitioning) showOverlay(app, result);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export function installPreviewAppBattleResultOverlayPatch() {
  installSceneResultPatch();
  const proto = PreviewApp?.prototype;
  if (!proto || proto[APP_PATCH_FLAG]) return;
  proto[APP_PATCH_FLAG] = true;

  const originalStart = proto.start;
  proto.start = async function startWithBattleResultOverlay(...args) {
    const result = await originalStart.apply(this, args);
    installResultWatcher(this);
    return result;
  };

  const originalResetBattle = proto.resetBattle;
  proto.resetBattle = async function resetBattleHidingBattleResultOverlay(...args) {
    hideOverlay(this);
    return await originalResetBattle.apply(this, args);
  };

  proto.returnToFormationFromBattleResult = function returnToFormationFromBattleResult() {
    hideOverlay(this);
    this.sceneReady = false;
    if (this.battleScene) {
      this.battleScene.battleState = 'ended-returned-to-formation';
      this.battleScene.pushEvent?.({ type: 'battleResultOkReturnToFormation', source: 'PreviewAppBattleResultOverlayPatch' });
    }
    this.productionBar?.setVisible(false);
    // The BCU speed-up control belongs to the battle scene only; hide it when we
    // leave battle so it never lingers over the formation/non-battle screens.
    this.speedControl?.setVisible(false);
    this.formationEditor?.setVisible(true);
  };
}

installPreviewAppBattleResultOverlayPatch();
