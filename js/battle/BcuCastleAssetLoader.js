function id3(v){ return String(Math.max(0, Number(v)||0)).padStart(3,'0'); }
export function resolveEnemyCastleAsset(castleId=0){ const id=id3(castleId<0?0:castleId); const baseDir=`./public/assets/bcu/000001/org/castle/${id}/`; return { castleId:Number(castleId)||0, imagePath:`${baseDir}nyankoCastle_${id}_00.png`, imgcutPath:`${baseDir}nyankoCastle_${id}_00.imgcut` }; }
export class BcuCastleAssetLoader { async load(castleId=0){ return resolveEnemyCastleAsset(castleId); } }
