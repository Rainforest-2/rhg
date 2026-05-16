import { BattleScene } from './BattleScene.js';
import { BattleCombatCoordinateRuntime } from './BattleCombatCoordinateRuntime.js';

const PATCH_FLAG = Symbol.for('wanko-battle.entity-order-patch.v1');

function getPos(actor) {
  const n = BattleCombatCoordinateRuntime.getEntityPosBcu(actor);
  return Number.isFinite(n) ? n : 0;
}

function getDire(actor) {
  if (Number.isFinite(actor?.direction)) return actor.direction;
  return actor?.side === 'dog-player' ? -1 : 1;
}

function getLayer(actor) {
  return Number.isFinite(actor?.currentLayer) ? actor.currentLayer : 0;
}

function sortForUpdate(actors = []) {
  actors.sort((a, b) => {
    const ad = getDire(a);
    const bd = getDire(b);
    if (ad !== bd) return ad - bd;
    const ap = getPos(a);
    const bp = getPos(b);
    if (ap !== bp) return ap - bp;
    return String(a?.instanceId || '').localeCompare(String(b?.instanceId || ''));
  });
}

function sortForLayer(actors = []) {
  actors.sort((a, b) => {
    const al = getLayer(a);
    const bl = getLayer(b);
    if (al !== bl) return al - bl;
    const ap = getPos(a);
    const bp = getPos(b);
    if (ap !== bp) return ap - bp;
    return String(a?.instanceId || '').localeCompare(String(b?.instanceId || ''));
  });
}

export function installBattleSceneBcuEntityOrderPatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalRunTickPhase = proto.runTickPhase;
  if (typeof originalRunTickPhase !== 'function') {
    throw new Error('BattleScene.runTickPhase is missing; cannot install BCU entity order patch');
  }

  proto.runTickPhase = function runTickPhaseWithBcuEntityOrder(phase, fn = () => {}) {
    if (phase === 'actor-state-update') {
      return originalRunTickPhase.call(this, phase, () => {
        sortForUpdate(this.actors || []);
        const result = fn();
        return result;
      });
    }
    if (phase === 'cleanup' || phase === 'camera-update') {
      return originalRunTickPhase.call(this, phase, () => {
        const result = fn();
        sortForLayer(this.actors || []);
        return result;
      });
    }
    return originalRunTickPhase.call(this, phase, fn);
  };
}

installBattleSceneBcuEntityOrderPatch();
