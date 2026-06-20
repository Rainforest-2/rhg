// Wires in-battle BGM into PreviewApp.
//
// Responsibilities:
//  - On battle start, lazily download + play the stage's start music
//    (resolved from MapStageData via StageRuntime.musicId).
//  - Crossfade to the boss music once the enemy base HP% drops to the stage's
//    boss-music threshold (BCU mus_de).
//  - Pause/resume the music together with the simulation (pause menu OR tab
//    hidden), and stop it when the battle ends or the player aborts.
//
// Self-installing like the other PreviewApp patches; imported from main.js after
// the pause-overlay patch so it can observe __pauseMenuOpen.

import { PreviewApp } from './PreviewApp.js';
import { audioEngine } from '../audio/AudioEngine.js';

const APP_PATCH_FLAG = Symbol.for('wanko-preview.battle-music.v1');

function battleIsActive(app) {
  if (!app || !app.sceneReady || app.sceneTransitioning || !app.battleScene) return false;
  const state = app.battleScene.battleState;
  return state === 'running' || state == null;
}

function stageMusicSpec(app) {
  const rt = app.battleScene?.stage?.runtime || null;
  if (!rt) return null;
  const startId = Number.isFinite(rt.musicId) ? rt.musicId : null;
  if (startId == null) return null;
  const bossId = Number.isFinite(rt.bossMusicId) ? rt.bossMusicId : null;
  const threshold = Number.isFinite(rt.bossMusicHpThresholdPercent) ? rt.bossMusicHpThresholdPercent : 100;
  return { startId, bossId, threshold };
}

function enemyBaseHpPercent(app) {
  const fn = app.battleScene?.getEnemyBaseHpPercent;
  return typeof fn === 'function' ? app.battleScene.getEnemyBaseHpPercent() : 100;
}

// Stable identity for "this battle instance" so we restart music on a new battle
// even if the same stage is replayed.
function battleInstanceKey(app) {
  return app.battleScene || null;
}

function startBattleMusic(app) {
  const spec = stageMusicSpec(app);
  if (!spec) return;
  const pct = enemyBaseHpPercent(app);
  const onBoss = spec.bossId != null && spec.bossId !== spec.startId && pct <= spec.threshold;
  const initialId = onBoss ? spec.bossId : spec.startId;
  app.__battleMusic = { ...spec, onBoss, instance: battleInstanceKey(app) };
  audioEngine.playBgm(initialId).catch(() => {});
}

function updateBattleMusic(app) {
  const m = app.__battleMusic;
  if (!m || m.onBoss || m.bossId == null || m.bossId === m.startId) return;
  if (enemyBaseHpPercent(app) <= m.threshold) {
    m.onBoss = true;
    audioEngine.playBgm(m.bossId).catch(() => {});
  }
}

function stopBattleMusic(app) {
  app.__battleMusic = null;
  audioEngine.stopBgm({ fadeMs: 500 });
}

function installMusicWatcher(app) {
  if (app.__battleMusicWatcherInstalled) return;
  app.__battleMusicWatcherInstalled = true;
  const tick = () => {
    const active = battleIsActive(app);
    const sameInstance = app.__battleMusic && app.__battleMusic.instance === battleInstanceKey(app);
    if (active && !sameInstance) startBattleMusic(app);
    else if (!active && app.__battleMusic) stopBattleMusic(app);
    else if (active) updateBattleMusic(app);

    // Music follows the simulation pause gate (manual pause menu OR tab hidden).
    const paused = !!app.__pauseMenuOpen || !!app.simulationPausedByVisibility;
    if (paused !== app.__battleMusicPaused) {
      app.__battleMusicPaused = paused;
      audioEngine.setPaused(paused);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export function installPreviewAppBattleMusicPatch() {
  const proto = PreviewApp?.prototype;
  if (!proto || proto[APP_PATCH_FLAG]) return;
  proto[APP_PATCH_FLAG] = true;

  const originalStart = proto.start;
  proto.start = async function startWithBattleMusic(...args) {
    const result = await originalStart.apply(this, args);
    try { installMusicWatcher(this); }
    catch (error) { console.error('[BattleMusicPatch] init failed', error); }
    return result;
  };
}

installPreviewAppBattleMusicPatch();
