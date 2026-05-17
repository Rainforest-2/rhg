export const BCU_BATTLE_ACTIONS = {
  ACTION_LINEUP_CHANGE_UP: -4,
  ACTION_LINEUP_CHANGE_DOWN: -5
};

export function adaptBcuBattleAction(action, { frontLineup = 0, slot = null } = {}) {
  if (action in BCU_BATTLE_ACTIONS) return BCU_BATTLE_ACTIONS[action];
  if (Number.isFinite(slot)) return frontLineup * 5 + slot;
  return null;
}

