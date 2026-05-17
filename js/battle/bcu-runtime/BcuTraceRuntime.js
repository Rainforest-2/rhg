const MAX_TRACE = 200;

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

function sanitize(value, depth = 0) {
  if (value == null) return value;
  if (depth > 4) return '[max-depth]';
  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 32).map((v) => sanitize(v, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [key, v] of Object.entries(value)) {
      if (typeof v === 'function') continue;
      if (key === 'model' || key === 'image' || key === 'img' || key === 'ctx' || key === 'canvas') {
        out[key] = '[omitted]';
        continue;
      }
      if (key === 'actor' || key === 'attacker' || key === 'target') {
        out[key] = v?.instanceId || v?.label || v?.id || null;
        continue;
      }
      out[key] = sanitize(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

export const BcuTraceRuntime = {
  enabled: true,
  frame: 0,
  channels: new Map(),
  resetFrame(frame) {
    const n = Number(frame);
    this.frame = Number.isFinite(n) ? n : this.frame + 1;
    this.expose();
  },
  push(channel, entry = {}) {
    if (!this.enabled || !channel) return null;
    const list = this.channels.get(channel) || [];
    const clean = sanitize({
      frame: Number.isFinite(entry.frame) ? entry.frame : this.frame,
      source: entry.source || 'BcuTraceRuntime',
      bcuReference: entry.bcuReference || null,
      ...entry
    });
    list.push(clean);
    if (list.length > MAX_TRACE) list.splice(0, list.length - MAX_TRACE);
    this.channels.set(channel, list);
    const globalName = CHANNEL_GLOBALS[channel];
    if (globalName) globalThis[globalName] = list;
    return clean;
  },
  get(channel) {
    return this.channels.get(channel) || [];
  },
  expose() {
    for (const [channel, globalName] of Object.entries(CHANNEL_GLOBALS)) {
      if (!this.channels.has(channel)) this.channels.set(channel, []);
      globalThis[globalName] = this.channels.get(channel);
    }
    globalThis.__BCU_TRACE_RUNTIME__ = this;
  }
};

BcuTraceRuntime.expose();
