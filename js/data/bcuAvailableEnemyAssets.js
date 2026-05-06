export const BCU_AVAILABLE_ENEMY_IDS = new Set(Array.from({ length: 300 }, (_, i) => i));
export function hasBcuEnemyAsset(enemyId){ return BCU_AVAILABLE_ENEMY_IDS.has(Number(enemyId)); }
