const CHANNEL_GLOBALS = {
  frame: '__BCU_FRAME_TRACE__',
  entity: '__BCU_ENTITY_TRACE__',
  attack: '__BCU_ATTACK_TRACE__',
  proc: '__BCU_PROC_TRACE__',
  render: '__BCU_RENDER_TRACE__',
  wave: '__BCU_WAVE_TRACE__',
  surge: '__BCU_SURGE_TRACE__',
  statusIcon: '__BCU_STATUS_ICON_TRACE__',
  statusIconRender: '__BCU_STATUS_ICON_RENDER_TRACE__',
  stagebasis: '__BCU_STAGEBASIS_TRACE__',
  input: '__BCU_INPUT_TRACE__',
  blend: '__BCU_BLEND_TRACE__',
  epartMatrix: '__BCU_EPART_MATRIX_TRACE__',
  damageGuard: '__BCU_DAMAGE_GUARD_TRACE__',
  barrier: '__BCU_BARRIER_TRACE__',
  shield: '__BCU_SHIELD_TRACE__',
  zombie: '__BCU_ZOMBIE_TRACE__',
  warp: '__BCU_WARP_TRACE__',
  lifecycle: '__BCU_LIFECYCLE_TRACE__'
};

const EMPTY_TRACE = Object.freeze([]);

function exposeEmptyTraces() {
  for (const globalName of Object.values(CHANNEL_GLOBALS)) {
    globalThis[globalName] = EMPTY_TRACE;
  }
  globalThis.__BCU_TRACE_RUNTIME__ = BcuTraceRuntime;
}

export const BcuTraceRuntime = {
  enabled: false,
  frame: 0,
  channels: new Map(),
  resetFrame(frame) {
    const n = Number(frame);
    this.frame = Number.isFinite(n) ? n : this.frame + 1;
    return this.frame;
  },
  push() {
    return null;
  },
  get() {
    return EMPTY_TRACE;
  },
  expose() {
    exposeEmptyTraces();
  },
  clear() {
    this.channels.clear();
    exposeEmptyTraces();
  }
};

BcuTraceRuntime.expose();
