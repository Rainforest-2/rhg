const ROLE_TAG = { dogs: 'DOG', cats: 'CAT', effects: 'FX', castles: 'CASTLE' };

export class PreviewUi {
  constructor(root, logEl) {
    this.root = root;
    this.logEl = logEl;
    this.enabled = !!(root && !root.hidden);
    this.logs = [];
    this.lastBattleProductionSignature = '';
    this.currentBattleSpawnHandler = null;
  }
  formatAssetLabel(a) { return `[${ROLE_TAG[a.group] || a.group?.toUpperCase() || 'UNK'}] ${a.label}`; }
  init(_assets, _on) {
    if (!this.enabled || !this.root) return;
  }
  setAssetMeta() {}
  setAnimationAvailability() {}
  setStatus(_t) { if (!this.enabled) return; }
  setDebug(_state) { if (!this.enabled) return; }
  log(level, msg) {
    this.logs.push({ level, msg, time: new Date().toISOString().slice(11, 19) });
    if (this.logs.length > 120) this.logs.shift();
    if (!this.logEl || this.logEl.hidden) { console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](`[PreviewUi] ${msg}`); return; }
    this.logEl.innerHTML = this.logs.map((l) => `<div class='log-item log-${l.level}'>[${l.time}] ${l.level.toUpperCase()} ${l.msg}</div>`).join('');
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }
}
