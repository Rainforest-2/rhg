import { buildBattleDebugReport } from './BattleDebugReport.js';

function makeEl(tag, className = '', text = '') {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

function boolMark(v) {
  return v ? 'ON' : '-';
}

function fmt(v) {
  if (v == null) return '-';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(2);
  return String(v);
}

function shortJson(value, max = 900) {
  if (value == null) return '-';
  const s = JSON.stringify(value, null, 2);
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export class BattleDebugHud {
  constructor({ app = null, mount = document.body } = {}) {
    this.app = app;
    this.mount = mount;
    this.visible = true;
    this.lastRenderAt = 0;
    this.updateIntervalMs = 120;
    this.root = makeEl('section', 'bcu-debug-hud');
    this.root.setAttribute('aria-label', 'BCU Battle Debug HUD');
    this.root.innerHTML = `
      <header class="bcu-debug-hud__header">
        <strong>BCU DEBUG</strong>
        <span class="bcu-debug-hud__sub">always-on unified</span>
      </header>
      <div class="bcu-debug-hud__body"></div>
    `;
    this.body = this.root.querySelector('.bcu-debug-hud__body');
    this.injectStyle();
    this.mount.appendChild(this.root);
  }

  injectStyle() {
    if (document.getElementById('bcu-debug-hud-style')) return;
    const style = document.createElement('style');
    style.id = 'bcu-debug-hud-style';
    style.textContent = `
      .bcu-debug-hud{position:fixed;right:8px;top:8px;z-index:999998;width:min(520px,calc(100vw - 16px));max-height:calc(100vh - 16px);overflow:auto;background:rgba(3,7,18,.92);color:#e5e7eb;border:1px solid rgba(148,163,184,.45);border-radius:10px;box-shadow:0 16px 48px rgba(0,0,0,.45);font:12px/1.35 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;pointer-events:none;}
      .bcu-debug-hud__header{display:flex;gap:8px;align-items:center;padding:8px 10px;border-bottom:1px solid rgba(148,163,184,.25);background:rgba(15,23,42,.9);position:sticky;top:0;}
      .bcu-debug-hud__header strong{color:#facc15;letter-spacing:.04em;}
      .bcu-debug-hud__sub{color:#94a3b8;font-size:11px;}
      .bcu-debug-hud__body{padding:8px 10px;display:grid;gap:8px;}
      .bcu-debug-card{border:1px solid rgba(148,163,184,.22);border-radius:8px;padding:7px;background:rgba(15,23,42,.58);}
      .bcu-debug-title{color:#93c5fd;font-weight:700;margin-bottom:4px;}
      .bcu-debug-grid{display:grid;grid-template-columns:110px 1fr;gap:2px 8px;}
      .bcu-debug-k{color:#94a3b8;}
      .bcu-debug-v{color:#e5e7eb;word-break:break-word;}
      .bcu-debug-ok{color:#86efac;font-weight:700;}
      .bcu-debug-bad{color:#fca5a5;font-weight:700;}
      .bcu-debug-pre{white-space:pre-wrap;word-break:break-word;max-height:180px;overflow:hidden;color:#d1d5db;margin:0;}
    `;
    document.head.appendChild(style);
  }

  row(k, v, cls = '') {
    return `<span class="bcu-debug-k">${k}</span><span class="bcu-debug-v ${cls}">${v}</span>`;
  }

  renderCard(title, html) {
    return `<section class="bcu-debug-card"><div class="bcu-debug-title">${title}</div>${html}</section>`;
  }

  render() {
    const scene = this.app?.battleScene || globalThis.__APP__?.battleScene || null;
    const r = buildBattleDebugReport(scene);
    if (!r.ready) {
      this.body.innerHTML = this.renderCard('state', `<div class="bcu-debug-grid">${this.row('ready', 'false', 'bcu-debug-bad')}${this.row('reason', r.reason || '-')}</div>`);
      return;
    }
    const dmg = r.latestDamage || {};
    const applied = dmg.applied || {};
    const abilityApplied = dmg.abilityResolver?.applied || {};
    const focus = r.focus || {};
    const proc = focus.lastDamage?.proc || null;
    const details = focus.lastDamage?.abilityDetails || focus.lastIncomingDamageCalculation?.abilityDetails || [];
    const html = [
      this.renderCard('scene', `<div class="bcu-debug-grid">
        ${this.row('frame/time', `${fmt(r.logicFrame)} / ${fmt(r.timeMs)}ms`)}
        ${this.row('state', fmt(r.battleState))}
        ${this.row('phase', fmt(r.tickPhase))}
        ${this.row('actors', `${r.counts.playerActors}P / ${r.counts.enemyActors}E / ${r.counts.actors}`)}
        ${this.row('rng', r.rng ? `#${r.rng.count} ${fmt(r.rng.value)}` : '-')}
      </div>`),
      this.renderCard('latest damage', `<div class="bcu-debug-grid">
        ${this.row('actor', fmt(dmg.actor))}
        ${this.row('target', fmt(dmg.target))}
        ${this.row('base/final', `${fmt(dmg.baseDamage)} -> ${fmt(dmg.finalDamage)}`)}
        ${this.row('metal', boolMark(applied.metal || abilityApplied.metal), (applied.metal || abilityApplied.metal) ? 'bcu-debug-ok' : '')}
        ${this.row('critical', boolMark(applied.critical || abilityApplied.critical), (applied.critical || abilityApplied.critical) ? 'bcu-debug-ok' : '')}
        ${this.row('rawAbi', fmt(dmg.rawAbi))}
        ${this.row('mapping', fmt(dmg.abilityMappingStatus))}
      </div>`),
      this.renderCard('focus actor', `<div class="bcu-debug-grid">
        ${this.row('id', fmt(focus.id))}
        ${this.row('side/state', `${fmt(focus.side)} / ${fmt(focus.state)}`)}
        ${this.row('hp', `${fmt(focus.hp)} / ${fmt(focus.maxHp)}`)}
        ${this.row('traits', Array.isArray(focus.traits) ? focus.traits.join(',') : '-')}
        ${this.row('abi', fmt(focus.abi))}
      </div>`),
      this.renderCard('ability details', `<pre class="bcu-debug-pre">${shortJson(details, 1200)}</pre>`),
      this.renderCard('proc / status', `<pre class="bcu-debug-pre">${shortJson({ proc, status: focus.procStatus, barrierShield: focus.barrierShield, zombie: focus.zombie }, 1400)}</pre>`),
      this.renderCard('recent events', `<pre class="bcu-debug-pre">${shortJson(r.events, 1800)}</pre>`)
    ].join('');
    this.body.innerHTML = html;
    globalThis.__BCU_DEBUG_REPORT__ = r;
  }

  tick(now = performance.now()) {
    if (!this.visible) return;
    if (now - this.lastRenderAt < this.updateIntervalMs) return;
    this.lastRenderAt = now;
    this.render();
  }
}
