export class PreviewUi{constructor(root,logEl){this.root=root;this.logEl=logEl;this.logs=[];}
init(assets,on){this.root.innerHTML=`<h2>BCU Preview Controls</h2>
<div class='group'><label>Asset set</label><select id='asset'></select><label>Animation</label><select id='anim'></select></div>
<div class='group row'><button id='play'>Play/Pause</button><button id='restart'>Restart</button><button id='stepm'>Step -1</button><button id='stepp'>Step +1</button></div>
<div class='group'><label>Speed</label><select id='speed'><option>0.25</option><option>0.5</option><option selected>1</option><option>2</option></select><label>Scale <span id='scalev'>1.00</span></label><input id='scale' type='range' min='0.2' max='3' step='0.05' value='1'></div>
<div class='group checks'>${['raw','parts','pivots','bounds'].map(k=>`<label><input type='checkbox' id='${k}'> Show ${k==='raw'?'raw imgcut frames':k}</label>`).join('')}</div>
<div class='group stat' id='status'></div>`;
const as=this.root.querySelector('#asset'),an=this.root.querySelector('#anim'); assets.forEach(a=>as.add(new Option(a.label,a.id))); const bindAnim=(a)=>{an.innerHTML='';a.animations.forEach(x=>an.add(new Option(x.label,x.id)));}; bindAnim(assets[0]);
as.onchange=()=>{const a=assets.find(v=>v.id===as.value);bindAnim(a);on.asset(a.id,an.value)};an.onchange=()=>on.anim(an.value);
this.root.querySelector('#play').onclick=()=>on.play();this.root.querySelector('#restart').onclick=()=>on.restart();this.root.querySelector('#stepm').onclick=()=>on.step(-1);this.root.querySelector('#stepp').onclick=()=>on.step(1);
this.root.querySelector('#speed').onchange=e=>on.speed(+e.target.value);this.root.querySelector('#scale').oninput=e=>{this.root.querySelector('#scalev').textContent=(+e.target.value).toFixed(2);on.scale(+e.target.value)};
['raw','parts','pivots','bounds'].forEach(k=>this.root.querySelector(`#${k}`).onchange=e=>on.toggle(k,e.target.checked));
}
setStatus(t){this.root.querySelector('#status').textContent=t}
log(level,msg){this.logs.push({level,msg,time:new Date().toISOString().slice(11,19)}); if(this.logs.length>120)this.logs.shift(); this.logEl.innerHTML=this.logs.map(l=>`<div class='log-item log-${l.level}'>[${l.time}] ${l.level.toUpperCase()} ${l.msg}</div>`).join(''); this.logEl.scrollTop=this.logEl.scrollHeight;}
}
