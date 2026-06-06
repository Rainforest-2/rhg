import { BattleScene } from './BattleScene.js';

const PATCH_FLAG = Symbol.for('wanko-battle.scene-bcu-burrow-diagnostics.v1');
const reported = new Set();

function isBurrowAnimationDiagnostic(event) {
  return event?.type === 'bcuBurrowAnimationUnavailable'
    || event?.type === 'bcuBurrowAnimationLoadFailed'
    || (event?.type === 'bcuBurrowStartDeferred' && event?.skipped === true);
}

function diagnosticKey(event) {
  return [event?.type, event?.semanticKey, event?.slotId, event?.actor, event?.reason, (event?.missingAnimations || []).join('|')].join(':');
}

function recordBurrowDiagnostic(event) {
  if (!isBurrowAnimationDiagnostic(event)) return;
  globalThis.__BCU_BURROW_ANIMATION_DIAGNOSTICS__ ||= [];
  globalThis.__BCU_BURROW_ANIMATION_DIAGNOSTICS__.push({
    ...event,
    recordedAtMs: Date.now(),
    source: 'BattleActorBcuBurrowDiagnosticsPatch'
  });
  globalThis.__BCU_BURROW_ANIMATION_DIAGNOSTICS__.splice(80);
  const key = diagnosticKey(event);
  if (reported.has(key)) return;
  reported.add(key);
  console.warn('[BCU burrow] missing burrow animation for a burrow-capable actor', event);
}

export function installBattleActorBcuBurrowDiagnosticsPatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;
  const originalPushEvent = proto.pushEvent;
  proto.pushEvent = function pushEventWithBurrowDiagnostics(event) {
    recordBurrowDiagnostic(event);
    return originalPushEvent?.call(this, event);
  };
}

installBattleActorBcuBurrowDiagnosticsPatch();
