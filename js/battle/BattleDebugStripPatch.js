import { BattleScene } from './BattleScene.js';

const PATCH_FLAG = Symbol.for('wanko-battle.debug-strip.v3-mutable-empty-arrays');

const KEEP_GLOBALS = new Set([
  '__APP__',
  'app',
  '__WAN_BOOT_ERROR__',
  '__BCU_DB__'
]);

function clearArray(value) {
  if (Array.isArray(value)) {
    value.length = 0;
    return value;
  }
  return [];
}

function noDebugEventStore(scene) {
  if (!scene) return;
  // Keep these arrays mutable because existing runtime wrappers may still push into them.
  // We strip storage by truncating before/after runtime phases instead of assigning a frozen array.
  scene.debugEvents = clearArray(scene.debugEvents);
  scene.tickPhaseTrace = clearArray(scene.tickPhaseTrace);
  scene.debugBattleEnabled = false;
  scene.debugBattleSource = 'disabled-debug-strip';
}

function clearDebugGlobals() {
  for (const key of Object.keys(globalThis)) {
    if (KEEP_GLOBALS.has(key)) continue;
    if (
      key.startsWith('__BCU_') ||
      key.startsWith('__BATTLE_') ||
      key.startsWith('__FORMATION_') ||
      key.includes('_DEBUG__') ||
      key.includes('_TRACE__')
    ) {
      try { delete globalThis[key]; } catch { globalThis[key] = undefined; }
    }
  }
}

export function installBattleDebugStripPatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalInit = proto.init;
  if (typeof originalInit === 'function') {
    proto.init = async function initWithoutDebugEvents(...args) {
      noDebugEventStore(this);
      const result = await originalInit.apply(this, args);
      noDebugEventStore(this);
      clearDebugGlobals();
      return result;
    };
  }

  proto.pushEvent = function pushEventDisabled() {
    return null;
  };

  const originalRunTickPhase = proto.runTickPhase;
  if (typeof originalRunTickPhase === 'function') {
    proto.runTickPhase = function runTickPhasePreserveRuntimeChain(phase, fn = () => {}) {
      noDebugEventStore(this);
      const result = originalRunTickPhase.call(this, phase, (...args) => {
        noDebugEventStore(this);
        const out = fn(...args);
        noDebugEventStore(this);
        return out;
      });
      noDebugEventStore(this);
      return result;
    };
  }

  const originalTick = proto.tick;
  if (typeof originalTick === 'function') {
    proto.tick = function tickWithoutDebugStorage(...args) {
      noDebugEventStore(this);
      const result = originalTick.apply(this, args);
      noDebugEventStore(this);
      return result;
    };
  }

  proto.getCrowdPerformanceDebug = function getCrowdPerformanceDebugDisabled() {
    return {
      source: 'BattleDebugStripPatch',
      debugDisabled: true,
      actors: Array.isArray(this.actors) ? this.actors.length : 0,
      effects: Array.isArray(this.effects) ? this.effects.length : 0
    };
  };
}

installBattleDebugStripPatch();
