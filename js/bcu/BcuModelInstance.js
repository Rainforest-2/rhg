export class BcuModelInstance {
  constructor(model){ this.model=model; this.baseScale=model.baseScale||1000; this.baseAngle=model.baseAngle||3600; this.baseOpacity=model.baseOpacity||255; this.parts=model.parts.map((p)=>({...p,base:{...p,hf:1,vf:1},current:{...p,hf:1,vf:1}})); }
  identityMatrix(){return [1,0,0,1,0,0];} multiplyMatrix(a,b){return [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];} translateMatrix(x,y){return [1,0,0,1,x,y];} rotateMatrix(rad){const c=Math.cos(rad),s=Math.sin(rad);return [c,s,-s,c,0,0];} scaleMatrix(sx,sy){return [sx,0,0,sy,0,0];}
  reset(){this.parts.forEach((p)=>{p.current={...p.base};});}
  applyTrack(partId, prop, v, modification=null){ const p=this.parts[partId]; if(!p)return {applied:false}; const b=p.base,c=p.current; const bs=this.baseScale,bo=this.baseOpacity; switch(modification){case 0:c.parent=Math.trunc(v);break;case 1:c.imgcutIndex=Math.trunc(v);break;case 2:c.partIndex=Math.trunc(v);break;case 3:c.zOrder=Math.trunc(v);break;case 4:c.posX=b.posX+v;break;case 5:c.posY=b.posY+v;break;case 6:c.pivotX=b.pivotX+v;break;case 7:c.pivotY=b.pivotY+v;break;case 8:c.scaleX=b.scaleX*v/bs;c.scaleY=b.scaleY*v/bs;break;case 9:c.scaleX=b.scaleX*v/bs;break;case 10:c.scaleY=b.scaleY*v/bs;break;case 11:c.angle=b.angle+v;break;case 12:c.opacity=v*b.opacity/bo;break;case 13:c.hf=v===0?1:-1;break;case 14:c.vf=v===0?1:-1;break;default: if(prop==='posX')c.posX=b.posX+v; else if(prop==='posY')c.posY=b.posY+v; else if(prop==='partIndex')c.partIndex=Math.trunc(v);} return {applied:true,partId,modification}; }
  getRootPivotCompensation(part, sx, sy) {
    const conf0 = this.model?.confs?.[0]?.values;
    const confX = Number.isFinite(conf0?.[2]) ? conf0[2] : 0;
    const confY = Number.isFinite(conf0?.[3]) ? conf0[3] : 0;
    const pivotX = Number.isFinite(part.current?.pivotX) ? part.current.pivotX : (part.pivotX ?? 0);
    const pivotY = Number.isFinite(part.current?.pivotY) ? part.current.pivotY : (part.pivotY ?? 0);
    return {
      x: (pivotX - confX) * sx,
      y: (pivotY - confY) * sy
    };
  }
  getBattleDrawList({parentMatrix=null}={}){ const by=new Map(this.parts.map(p=>[p.index,p])); const cache=new Map(); const calc=(part)=>{ if(cache.has(part.index))return cache.get(part.index); const c=part.current; const sx=((c.scaleX??part.scaleX)/this.baseScale)*(c.hf??1); const sy=((c.scaleY??part.scaleY)/this.baseScale)*(c.vf??1); const ang=((c.angle??0)/this.baseAngle)*Math.PI*2; const isRoot=part.index===0; const translate=isRoot?{x:0,y:0}:{x:(c.posX??0),y:-(c.posY??0)}; const rootComp=isRoot?this.getRootPivotCompensation(part,sx,sy):{x:0,y:0}; const local=this.multiplyMatrix(this.translateMatrix(translate.x+rootComp.x,translate.y-rootComp.y),this.multiplyMatrix(this.rotateMatrix(ang),this.scaleMatrix(sx,sy))); const pp=by.get(c.parent); const pm=pp?calc(pp).matrix:(parentMatrix||this.identityMatrix()); const po=pp?calc(pp).opacity:1; const matrix=this.multiplyMatrix(pm,local); const opacity=po*((c.opacity??part.opacity??this.baseOpacity)/this.baseOpacity); const st={index:part.index,partIndex:c.partIndex,imgcutIndex:c.imgcutIndex,opacity,matrix,pivotX:c.pivotX,pivotY:c.pivotY,rawPart:part,z:(c.zOrder??part.zOrder??0)*Math.max(1,this.parts.length)+part.index}; cache.set(part.index,st); return st; }; return this.parts.map(calc).sort((a,b)=>a.z-b.z); }
  buildWorld(){ return this.getBattleDrawList(); }
  getDrawList(){ return this.parts; }
}
