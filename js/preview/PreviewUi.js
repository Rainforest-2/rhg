const ROLE_TAG = { dogs: 'DOG', cats: 'CAT', effects: 'FX', castles: 'CASTLE' };

export class PreviewUi {
  constructor(root, logEl) { this.root = root; this.logEl = logEl; this.logs = []; this.lastBattleProductionSignature=''; this.lastBattleLineupSignature=''; this.currentBattleSpawnHandler=null; }
  formatAssetLabel(a) { return `[${ROLE_TAG[a.group] || a.group?.toUpperCase() || 'UNK'}] ${a.label}`; }
  init(assets, on) {
    this.root.innerHTML = `<h2>BCU Preview Controls</h2>
<div class='group'><label>Mode</label><select id='mode'><option value='preview' selected>Asset Preview</option><option value='battle'>Battle Scene</option></select><label>Asset set</label><select id='asset'></select><label>Animation</label><select id='anim'></select></div>
<div class='group row'><button id='play'>Play/Pause</button><button id='restart'>Restart</button><button id='stepm'>Step -1</button><button id='stepp'>Step +1</button></div>
<div class='group'><button id='reset-battle'>Reset Battle</button></div><div class='group' id='battle-prod' style='display:none'><label>Production lineup</label><select id='battle-lineup'></select><div id='battle-econ'></div><div id='battle-buttons'></div></div>
<div class='group'><label>Speed</label><select id='speed'><option value='0.25'>0.25x</option><option value='0.5'>0.5x</option><option value='1' selected>1x</option><option value='1.5'>1.5x</option><option value='2'>2x</option></select><label>Scale <span id='scalev'>1.00</span></label><input id='scale' type='range' min='0.2' max='3' step='0.05' value='1'></div>
<div class='group checks'>${['raw', 'parts', 'pivots', 'bounds'].map((k) => `<label><input type='checkbox' id='${k}'> Show ${k === 'raw' ? 'raw imgcut frames' : k}</label>`).join('')}</div>
<div class='group stat'><details id='asset-meta'><summary>Asset metadata</summary><pre id='asset-meta-pre' class='debug-box'></pre><div class='row'><button id='copy-asset-meta'>copy</button><button id='log-asset-meta'>console.log</button></div></details></div>
<div class='group stat' id='status'></div>
<div class='group stat'><div><strong>Debug</strong></div><pre id='debug' class='debug-box'></pre></div>`;
    const as = this.root.querySelector('#asset'), an = this.root.querySelector('#anim');
    assets.forEach((a) => as.add(new Option(this.formatAssetLabel(a), a.id)));
    const bindAnim = (a, available = null) => {
      an.innerHTML = '';
      if (!a.animations?.length) { an.add(new Option('none', 'none')); an.disabled = true; return; }
      an.disabled = false;
      a.animations.forEach((x) => {
        const exists = available ? available.has(x.id) : true;
        const opt = new Option(`${x.label}${exists ? '' : ' (missing)'}`, x.id);
        if (!exists) opt.disabled = true;
        an.add(opt);
      });
    };
    bindAnim(assets[0]);
    as.onchange = () => { const a = assets.find((v) => v.id === as.value); bindAnim(a); on.asset(a.id, an.value); };
    this.root.querySelector('#mode').onchange = (e) => { on.mode?.(e.target.value); this.root.querySelector('#battle-prod').style.display=e.target.value==='battle'?'block':'none';};
    an.onchange = () => on.anim(an.value);
    this.bindAnim = bindAnim;
    this.root.querySelector('#play').onclick = () => on.play(); this.root.querySelector('#restart').onclick = () => on.restart(); this.root.querySelector('#stepm').onclick = () => on.step(-1); this.root.querySelector('#stepp').onclick = () => on.step(1);
    this.root.querySelector('#speed').onchange = (e) => on.speed(+e.target.value);
    this.root.querySelector('#scale').oninput = (e) => { this.root.querySelector('#scalev').textContent = (+e.target.value).toFixed(2); on.scale(+e.target.value); };
    ['raw', 'parts', 'pivots', 'bounds'].forEach((k) => this.root.querySelector(`#${k}`).onchange = (e) => on.toggle(k, e.target.checked));
    this.root.querySelector('#copy-asset-meta').onclick = async () => { const text = this.root.querySelector('#asset-meta-pre').textContent || ''; await navigator.clipboard?.writeText(text); this.log('info', 'copied asset metadata'); };
    this.root.querySelector('#log-asset-meta').onclick = () => { const text = this.root.querySelector('#asset-meta-pre').textContent || ''; console.log(text); this.log('info', 'asset metadata logged'); };
    this.root.querySelector('#reset-battle').onclick = () => on.resetBattle?.();
    this.root.querySelector('#battle-lineup').onchange = (e) => on.lineup?.(e.target.value);
  }

  setAssetMeta(meta) {
    const text = `id=${meta?.id || '-'}\nlabel=${meta?.label || '-'}\ngroup=${meta?.group || '-'}\nrole=${meta?.role || '-'}\nrenderMode=${meta?.renderMode || '-'}\nbaseDir=${meta?.baseDir || '-'}\nlayers=${meta?.layers || 0}`;
    this.root.querySelector('#asset-meta-pre').textContent = text;
  }
  setAnimationAvailability(asset, available) { this.bindAnim?.(asset, available); }
  setStatus(t) { this.root.querySelector('#status').textContent = t; }
  setDebug(state) {
    const anim = state.anim;
    const first = anim?.tracks?.[0];
    const hist = Object.entries(anim?.modificationHistogram || {}).map(([k, v]) => `${k}=${v}`).join(', ') || 'none';
    const applied = (state.debugApplied || []).slice(0, 12).map((v) => `${v.applied ? 'OK' : 'NG'} p:${v.partId} pi:${v.partIndex} ${v.prop}=${v.value} ${v.reason || ''}`).join('\n');
    this.root.querySelector('#debug').textContent = `role=${state.assetMeta?.role || '-'}\ngroup=${state.assetMeta?.group || '-'}\nrenderMode=${state.renderMode || state.assetMeta?.renderMode || 'model'}\nmodel required=${state.modelRequired ? 'yes' : 'no'}\nanimation required=${state.animationRequired ? 'yes' : 'no'}\nbaseDir=${state.assetMeta?.baseDir || '-'}\nloaded=${(state.loadedFiles||[]).join(', ') || '-'}\nmissing=${(state.missingFiles||[]).join(', ') || '-'}\nparts=${state.debugStats?.parts || 0} modelParts=${state.debugStats?.modelParts || 0} tracks=${state.debugStats?.tracks || 0} maxFrame=${state.debugStats?.maxFrame || 0}\nframe=${state.debugStats?.frame || 0} applied=${state.debugStats?.appliedCount || 0}\nmodificationHistogram: ${hist}\nfirstTrack: ${first?.rawHeader || '-'}\nfirstKeyframes: ${JSON.stringify(first?.keyframes || [])}\napplied:\n${applied}`;
  }
  log(level, msg) { this.logs.push({ level, msg, time: new Date().toISOString().slice(11, 19) }); if (this.logs.length > 120) this.logs.shift(); this.logEl.innerHTML = this.logs.map((l) => `<div class='log-item log-${l.level}'>[${l.time}] ${l.level.toUpperCase()} ${l.msg}</div>`).join(''); this.logEl.scrollTop = this.logEl.scrollHeight; }
}


PreviewUi.prototype.setBattleProduction=function(status){const econ=this.root.querySelector('#battle-econ');const btns=this.root.querySelector('#battle-buttons'); if(!econ||!btns)return; this.currentBattleSpawnHandler=status.onSpawn||null; const signature=JSON.stringify({money:Math.floor(status.money||0),maxMoney:status.maxMoney||0,roster:(status.roster||[]).map(r=>[r.slotId,!!r.canProduce,Math.ceil((r.cooldownMs||0)/100),r.cost||0])}); if(signature===this.lastBattleProductionSignature) return; this.lastBattleProductionSignature=signature; econ.textContent=`money:${Math.floor(status.money||0)}/${status.maxMoney||0} income:${status.incomePerSecond||0}/s`; btns.innerHTML=(status.roster||[]).map(r=>`<button data-slot='${r.slotId}' ${r.canProduce?'':'disabled'}>${r.label} cost:${r.cost} cd:${((r.cooldownMs||0)/1000).toFixed(1)}s</button>`).join(' '); if(!btns.dataset.bound){btns.dataset.bound='1';btns.onclick=(ev)=>{const b=ev.target.closest('button[data-slot]');if(!b)return; this.currentBattleSpawnHandler?.(b.dataset.slot);};}};

PreviewUi.prototype.setBattleLineupOptions=function(options=[]){const sel=this.root.querySelector('#battle-lineup');if(!sel)return;const signature=JSON.stringify(options);if(signature===this.lastBattleLineupSignature)return;this.lastBattleLineupSignature=signature;sel.innerHTML='';for(const opt of options){const o=new Option(opt.lineupId,opt.lineupId);o.selected=!!opt.active;sel.add(o);}};
