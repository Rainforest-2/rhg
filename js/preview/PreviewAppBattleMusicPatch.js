// Wires in-battle BGM into PreviewApp.
//
// Responsibilities:
//  - On battle start, lazily download + play the stage's start music
//    (resolved from MapStageData via StageRuntime.musicId).
//  - Switch to the boss music once the enemy base HP% (int-truncated) drops
//    strictly below the stage's boss-music threshold (BCU Stage.mush;
//    BattleView.aboveBoss), with thresholds 0/100 never arming a boss track
//    (DefStageInfo).
//  - Pause/resume the music together with the simulation (pause menu OR tab
//    hidden), and stop it when the battle ends or the player aborts.
//
// Self-installing like the other PreviewApp patches; imported from main.js after
// the pause-overlay patch so it can observe __pauseMenuOpen.

import { PreviewApp } from './PreviewApp.js';
import { audioEngine } from '../audio/AudioEngine.js';

const APP_PATCH_FLAG = Symbol.for('wanko-preview.battle-music.v1');

// Music id for the formation / non-battle screen. 002.m4a ships in the initial
// vendored music set (public/assets/music/002.m4a), so it needs no extra preload.
const FORMATION_BGM_ID = 2;

function battleIsActive(app) {
  if (!app || !app.sceneReady || app.sceneTransitioning || !app.battleScene) return false;
  const state = app.battleScene.battleState;
  return state === 'running' || state == null;
}

function stageMusicSpec(app) {
  const rt = app.battleScene?.stage?.runtime || null;
  if (!rt) return null;
  const startId = Number.isFinite(rt.musicId) ? rt.musicId : null;
  const bossId = Number.isFinite(rt.bossMusicId) ? rt.bossMusicId : null;
  const threshold = Number.isFinite(rt.bossMusicHpThresholdPercent) ? rt.bossMusicHpThresholdPercent : 100;
  // A custom stage authors ONLY a normal BGM + a boss BGM and marks boss enemies; it has no
  // BCU castle-HP "mush" threshold. There the boss track arms when a boss enemy appears (the
  // Battle Cats boss-appearance trigger), so bypass the HP-threshold gate below.
  const bossByAppearance = app.battleScene?.customStageBaseIsCustom === true;
  // BCU never arms a boss track for threshold 0/100 (DefStageInfo only stores
  // mush/mus1 when data[3] != 0 && data[3] != 100; BattleView.aboveBoss repeats
  // the same exclusion) or when both ids match (SoundHandler.twoMusic).
  const bossEnabled = bossId != null && bossId !== startId
    && (bossByAppearance || (threshold !== 0 && threshold !== 100));
  // startId == null means "silent battle" (custom stage with no BGM authored). We still return a
  // spec (with startId null) so the battle registers and the formation BGM is stopped, instead of
  // leaking into the fight.
  return { startId, bossId: bossEnabled ? bossId : null, threshold, bossByAppearance, silent: startId == null };
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

// Should the boss track be playing now? Custom stages arm it on boss-enemy appearance; BCU
// stages arm it on int-truncated enemy-base HP% strictly below mush (BCU BattleView.aboveBoss).
function bossArmed(app, spec) {
  if (spec.bossId == null) return false;
  if (spec.bossByAppearance) return app.battleScene?.customStageBossAppeared === true;
  return Math.trunc(enemyBaseHpPercent(app)) < spec.threshold;
}

function startBattleMusic(app) {
  const spec = stageMusicSpec(app);
  if (!spec) return;
  app.__battleMusic = { ...spec, onBoss: false, instance: battleInstanceKey(app) };
  // A silent stage (no authored BGM) must not let the formation BGM bleed into the battle.
  if (spec.silent) { audioEngine.stopBgm(); return; }
  const onBoss = bossArmed(app, spec);
  app.__battleMusic.onBoss = onBoss;
  audioEngine.playBgm(onBoss ? spec.bossId : spec.startId).catch(() => {});
}

function updateBattleMusic(app) {
  const m = app.__battleMusic;
  if (!m || m.onBoss || m.bossId == null || m.silent) return;
  if (bossArmed(app, m)) {
    m.onBoss = true;
    audioEngine.playBgm(m.bossId).catch(() => {});
  }
}

// On the formation / non-battle screen, play the formation BGM (002.m4a) instead
// of stopping music entirely. Idempotent via __formationMusicActive so the rAF
// watcher does not restart the track every frame. Clears any battle-music
// tracking so the next battle is detected as a fresh instance.
function startFormationMusic(app) {
  if (app.__formationMusicActive) return;
  app.__formationMusicActive = true;
  app.__battleMusic = null;
  audioEngine.playBgm(FORMATION_BGM_ID).catch(() => {});
}

function installMusicWatcher(app) {
  if (app.__battleMusicWatcherInstalled) return;
  app.__battleMusicWatcherInstalled = true;
  const tick = () => {
    const active = battleIsActive(app);
    const sameInstance = app.__battleMusic && app.__battleMusic.instance === battleInstanceKey(app);
    if (active && !sameInstance) { app.__formationMusicActive = false; startBattleMusic(app); }
    else if (!active) startFormationMusic(app);
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
