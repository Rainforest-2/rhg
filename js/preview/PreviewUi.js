const ROLE_TAG = { dogs: 'DOG', cats: 'CAT', effects: 'FX', castles: 'CASTLE' };

export class PreviewUi {
  constructor(root, logEl) { this.root = root; this.logEl = logEl; this.logs = []; this.lastBattleProductionSignature=''; this.lastBattleLineupSignature=''; this.currentBattleSpawnHandler=null; }
  formatAssetLabel(a) { return `[${ROLE_TAG[a.group] || a.group?.toUpperCase() || 'UNK'}] ${a.label}`; }
  init(_assets, on) {
    this.root.innerHTML = `<h2>Formation Battle Controls</h2>
<div class='group row'><button id='reset-battle'>Reset Battle</button></div>
<div class='group' id='battle-prod'><div id='battle-econ'></div><div id='battle-buttons'></div></div>
<div class='group'><label>Speed</label><select id='speed'><option value='0.25'>0.25x</option><option value='0.5'>0.5x</option><option value='1' selected>1x</option><option value='1.5'>1.5x</option><option value='2'>2x</option></select><label>Scale <span id='scalev'>1.00</span></label><input id='scale' type='range' min='0.2' max='3' step='0.05' value='1'></div>
<div class='group checks'>${['raw', 'parts', 'pivots', 'bounds'].map((k) => `<label><input type='checkbox' id='${k}'> Show ${k === 'raw' ? 'raw imgcut frames' : k}</label>`).join('')}</div>
<div class='group stat' id='status'></div>
<div class='group stat'><div><strong>Debug</strong></div><pre id='debug' class='debug-box'></pre></div>`;
    this.root.querySelector('#speed').onchange = (e) => on.speed?.(+e.target.value);
    this.root.querySelector('#scale').oninput = (e) => { this.root.querySelector('#scalev').textContent = (+e.target.value).toFixed(2); on.scale?.(+e.target.value); };
    ['raw', 'parts', 'pivots', 'bounds'].forEach((k) => this.root.querySelector(`#${k}`).onchange = (e) => on.toggle?.(k, e.target.checked));
    this.root.querySelector('#reset-battle').onclick = () => on.resetBattle?.();
  }
  setAssetMeta() {}
  setAnimationAvailability() {}
  setStatus(t) { const el=this.root.querySelector('#status'); if(el) el.textContent = t; }
  setDebug(state) { const dbg=this.root.querySelector('#debug'); if(!dbg) return; dbg.textContent = `renderMode=battle\nmissing=${(state.missingFiles||[]).join(', ') || '-'}`; }
  log(level, msg) { this.logs.push({ level, msg, time: new Date().toISOString().slice(11, 19) }); if (this.logs.length > 120) this.logs.shift(); this.logEl.innerHTML = this.logs.map((l) => `<div class='log-item log-${l.level}'>[${l.time}] ${l.level.toUpperCase()} ${l.msg}</div>`).join(''); this.logEl.scrollTop = this.logEl.scrollHeight; }
}

PreviewUi.prototype.setBattleProduction=function(status){const econ=this.root.querySelector('#battle-econ');const btns=this.root.querySelector('#battle-buttons'); if(!econ||!btns)return; this.currentBattleSpawnHandler=status.onSpawn||null; const signature=JSON.stringify({money:Math.floor(status.money||0),maxMoney:status.maxMoney||0,roster:(status.roster||[]).map(r=>[r.slotId,!!r.canProduce,Math.ceil((r.cooldownMs||0)/100),r.cost||0])}); if(signature===this.lastBattleProductionSignature) return; this.lastBattleProductionSignature=signature; econ.textContent=`money:${Math.floor(status.money||0)}/${status.maxMoney||0} income:${status.incomePerSecond||0}/s`; btns.innerHTML=(status.roster||[]).map(r=>`<button data-slot='${r.slotId}' ${r.canProduce?'':'disabled'}>${r.label} cost:${r.cost} cd:${Math.ceil((r.cooldownMs||0)/1000)}s</button>`).join(''); [...btns.querySelectorAll('button[data-slot]')].forEach(b=>b.onclick=()=>this.currentBattleSpawnHandler?.(b.dataset.slot));};
