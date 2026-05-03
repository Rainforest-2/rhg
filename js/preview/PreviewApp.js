import { PREVIEW_ASSETS } from '../data/previewAssets.js';
import { BcuAssetLoader } from '../bcu/BcuAssetLoader.js';
import { BcuSpriteSheet } from '../bcu/BcuSpriteSheet.js';
import { BcuModelInstance } from '../bcu/BcuModelInstance.js';
import { BcuAnimator } from '../bcu/BcuAnimator.js';
import { PreviewRenderer } from './PreviewRenderer.js';
import { PreviewUi } from './PreviewUi.js';

export class PreviewApp{constructor(){this.assets=PREVIEW_ASSETS;this.loader=new BcuAssetLoader();this.state={scale:1,showParts:false,showPivots:false,showBounds:false,rawMode:false};}
async start(){this.renderer=new PreviewRenderer(document.getElementById('preview-canvas'));this.ui=new PreviewUi(document.getElementById('control-panel'),document.getElementById('log-list'));this.ui.init(this.assets,{asset:(id,anim)=>this.load(id,anim),anim:id=>this.loadAnim(id),play:()=>this.animator&&(this.animator.playing=!this.animator.playing),restart:()=>this.animator?.restart(),step:v=>{this.animator?.step(v);this.applyAnim();},speed:s=>this.animator?.setSpeed(s),scale:s=>this.state.scale=s,toggle:(k,v)=>{this.state[k==='raw'?'rawMode':`show${k[0].toUpperCase()+k.slice(1)}`]=v;}});
await this.load(this.assets[0].id,this.assets[0].animations[0].id); let last=performance.now(); const loop=(t)=>{const dt=t-last;last=t; if(this.animator){this.animator.tick(dt);this.applyAnim();} this.renderer.render(this.state); this.updateStatus(); requestAnimationFrame(loop);}; requestAnimationFrame(loop);} 
findAsset(id){return this.assets.find(a=>a.id===id)||this.assets[0]}
async load(id,animId){this.current=this.findAsset(id);this.ui.log('info',`load asset ${this.current.label}`); const r=await this.loader.loadAssetSet(this.current); r.errors.forEach(e=>this.ui.log('error',e)); this.state.sprite=(r.image&&r.imgcut)?new BcuSpriteSheet(r.image,r.imgcut):null; this.state.model=r.model?new BcuModelInstance(r.model):null; this.ui.log('info',`loaded files: ${r.loaded.join(', ')||'none'}`); await this.loadAnim(animId||this.current.animations[0]?.id);} 
async loadAnim(animId){const ad=this.current.animations.find(a=>a.id===animId)||this.current.animations[0]; if(!ad) return; const {anim,error}=await this.loader.loadAnimation(this.current,ad); if(error)this.ui.log('error',error); this.state.anim=anim; this.animator=new BcuAnimator(anim||{tracks:[],maxFrame:1}); this.applyAnim();}
applyAnim(){if(!this.state.model) return; this.state.model.reset(); this.animator?.apply(this.state.model);} updateStatus(){const frame=(this.animator?.frame||0).toFixed(2),parts=this.state.sprite?.imgcut?.parts?.length||0,m=this.state.model?.parts?.length||0,t=this.state.anim?.tracks?.length||0; this.ui.setStatus(`frame:${frame} | parts:${parts} | model parts:${m} | tracks:${t} | ${this.animator?.playing?'playing':'paused'}`)} }
