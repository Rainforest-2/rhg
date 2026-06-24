// BCU battle/StageBasis.java manual-deploy "button delay" model.
//
// When buttonDelayOn (CommonStatic.getConfig().buttonDelay), a manual deploy press does NOT spawn
// immediately. StageBasis.act_spawn(i, j, manual=true):
//   if (buttonDelay > 0 || ubase.health == 0) return false;            // press ignored while counting
//   if (buttonDelayOn && manual && selectedUnit[0] == -1) {            // nothing queued yet
//     if (elu.price[i][j] != -1 || b.lu.fs[i][j] == null) {           // a real filled slot
//       if (lineupChanging) return false;
//       buttonDelay = 6;                                              // start the 6-frame delay
//       selectedUnit[0] = i; selectedUnit[1] = j;                     // remember the queued unit
//       return true;                                                  // accepted, but NOT spawned
//     }
//   }
//   ... real cost/cooldown check + entity spawn (only reached once delay has elapsed) ...
//
// StageBasis.update() each frame:
//   if (buttonDelay > 0 && --buttonDelay == 0) {                       // 6 frames later
//     act_spawn(selectedUnit[0], selectedUnit[1], true);              // real deploy now happens
//     selectedUnit[0] = -1; selectedUnit[1] = -1;
//   }
//
// So the queued unit's real deploy (cost charged, cooldown started, entity created) lands exactly
// 6 frames after the press, and every other manual press during that window is dropped.

export const BCU_BUTTON_DELAY_FRAMES = 6;

export function createBcuButtonDelayState() {
  return { frames: 0, queued: null };
}

// Disposition of a manual deploy press, WITHOUT performing the real deploy:
//   'passthrough' : delay disabled -> caller performs its normal immediate deploy.
//   'blocked'     : a delay is already counting down (or lineup is swapping) -> press ignored.
//   'queued'      : delay started and the unit was recorded; caller must NOT spawn now.
export function requestBcuButtonDelaySpawn(state, request, {
  enabled = true,
  frames = BCU_BUTTON_DELAY_FRAMES,
  lineupChanging = false
} = {}) {
  if (!enabled) return { action: 'passthrough' };
  // StageBasis.act_spawn early-return: any press while buttonDelay > 0 is dropped.
  if ((state.frames | 0) > 0) return { action: 'blocked', reason: 'button-delay-active', remaining: state.frames };
  // StageBasis 507: a press mid lineup-swap fails without starting a delay.
  if (lineupChanging) return { action: 'blocked', reason: 'lineup-changing', remaining: 0 };
  state.frames = Math.max(1, Math.floor(Number.isFinite(frames) ? frames : BCU_BUTTON_DELAY_FRAMES));
  state.queued = request || null;
  return { action: 'queued', frames: state.frames };
}

// One StageBasis.update() countdown step. Returns { fire } with the queued request on the frame the
// delay reaches 0 (the real deploy must run then), otherwise { fire: null }.
export function tickBcuButtonDelay(state) {
  if ((state.frames | 0) <= 0) return { fire: null, frames: 0 };
  state.frames -= 1;
  if (state.frames === 0) {
    const fire = state.queued;
    state.queued = null;
    return { fire: fire || null, frames: 0 };
  }
  return { fire: null, frames: state.frames };
}
