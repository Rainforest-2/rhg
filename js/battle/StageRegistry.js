export const STAGE_CANDIDATES = ['stageRNA001_00','stageRNA001_01','stageRNA001_02','stageRNA002_00'];
export const preferredDefaultStageId = 'stageRNA001_00';
export function resolveSafeDefaultStage(){ return { selectedStageId: preferredDefaultStageId, enabledEnemyRows: [], disabledEnemyRows: [] }; }
