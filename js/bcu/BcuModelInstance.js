export class BcuModelInstance{constructor(model){this.model=model;this.parts=model.parts.map(p=>({...p,current:{posX:p.posX,posY:p.posY,scaleX:p.scaleX,scaleY:p.scaleY,angle:p.angle,opacity:p.opacity}}));}
reset(){this.parts.forEach(p=>p.current={posX:p.posX,posY:p.posY,scaleX:p.scaleX,scaleY:p.scaleY,angle:p.angle,opacity:p.opacity});}
applyTrack(partId,prop,val){const p=this.parts.find(v=>v.index===partId); if(!p) return; p.current[prop]=val;}
buildWorld(){const map=new Map(this.parts.map(p=>[p.index,p])); for(const p of this.parts){const par=map.get(p.parent); const c=p.current; if(par){const pr=par.world??{x:0,y:0,a:0,sx:1,sy:1}; p.world={x:pr.x+c.posX*pr.sx,y:pr.y-c.posY*pr.sy,a:pr.a+c.angle,sx:pr.sx*(c.scaleX/1000),sy:pr.sy*(c.scaleY/1000),o:(par.current.opacity/255)*(c.opacity/255)};} else p.world={x:c.posX,y:-c.posY,a:c.angle,sx:c.scaleX/1000,sy:c.scaleY/1000,o:c.opacity/255};}}
getDrawList(){this.buildWorld(); return [...this.parts].sort((a,b)=>a.zOrder-b.zOrder);}
}
