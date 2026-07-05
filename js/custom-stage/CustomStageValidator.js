// Save-time validation for a custom stage: hard errors (block save) + soft warnings (allow save,
// shown prominently). Asset-resolution checks are optional and injected so this stays unit-testable
// without the BCU asset database; when a resolver returns falsy the corresponding "未解決" error is
// raised. All messages are Japanese to match the in-game UI.
//
// IMPORTANT: numeric / structural constraints are checked against the RAW draft, not the normalized
// stage. The schema factory deliberately repairs invalid values (0 → default) for runtime safety, so
// validating the normalized object would silently accept a user who cleared a field to 0/blank.
import { normalizeCustomStage, framesToSeconds } from './CustomStageSchema.js';

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function rawNum(value) {
  if (isBlank(value)) return NaN;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function isPositive(value) {
  const n = rawNum(value);
  return Number.isFinite(n) && n > 0;
}

function always() { return true; }

// resolvers: { background(id), castle(id), music(id), enemy(id) } -> truthy when the asset resolves.
export function validateCustomStage(rawStage, { resolvers = {} } = {}) {
  const raw = rawStage || {};
  const rawBattle = raw.battle || {};
  const rawSpawns = Array.isArray(raw.spawns) ? raw.spawns : [];
  const stage = normalizeCustomStage(raw); // used for stable iteration + frame math only
  const errors = [];
  const warnings = [];
  const resolveBackground = resolvers.background || always;
  const resolveCastle = resolvers.castle || always;
  const resolveMusic = resolvers.music || always;
  const resolveEnemy = resolvers.enemy || always;

  const err = (field, message) => errors.push({ field, message });
  const warn = (field, message) => warnings.push({ field, message });

  if (isBlank(raw.name)) err('name', 'ステージ名を入力してください');

  if (isBlank(rawBattle.backgroundId)) err('backgroundId', '背景を選択してください');
  else if (!resolveBackground(rawBattle.backgroundId)) err('backgroundId', '選択した背景を読み込めません');

  if (isBlank(rawBattle.enemyCastleId)) err('enemyCastleId', '敵城を選択してください');
  else if (!resolveCastle(rawBattle.enemyCastleId)) err('enemyCastleId', '選択した敵城を読み込めません');

  if (isBlank(rawBattle.musicId)) warn('musicId', 'BGMが未設定です（基準ステージまたは既定BGMを使用）');
  else if (!resolveMusic(rawBattle.musicId)) err('musicId', '選択したBGMを読み込めません');

  if (!isPositive(rawBattle.stageLength)) err('stageLength', '戦場の長さは1以上にしてください');
  if (!isPositive(rawBattle.enemyBaseHp)) err('enemyBaseHp', '敵城HPは1以上にしてください');
  if (!isPositive(rawBattle.maxEnemyCount)) err('maxEnemyCount', '最大敵数は1以上にしてください');

  if (!rawSpawns.length) warn('spawns', '敵が1体も登録されていません');

  rawSpawns.forEach((spawn, index) => {
    const at = `spawns[${index}]`;
    const s = spawn || {};
    if (isBlank(s.enemyId)) err(`${at}.enemyId`, `${index + 1}番目の敵が未選択です`);
    else if (!resolveEnemy(s.enemyId)) err(`${at}.enemyId`, `${index + 1}番目の敵を読み込めません`);
    if (!isPositive(s.count)) err(`${at}.count`, `${index + 1}番目の敵の出現数は1以上にしてください`);
    if (!isPositive(s.hpMultiplier)) err(`${at}.hpMultiplier`, `${index + 1}番目の敵のHP倍率は0より大きくしてください`);
    if (!isPositive(s.attackMultiplier)) err(`${at}.attackMultiplier`, `${index + 1}番目の敵の攻撃倍率は0より大きくしてください`);
    const first = s.firstSpawn || {};
    if (rawNum(first.minFrames) > rawNum(first.maxFrames)) {
      err(`${at}.firstSpawn`, `${index + 1}番目の初回出現時間の最小が最大を超えています`);
    }
    const respawn = s.respawn || {};
    if (respawn.enabled && rawNum(respawn.minFrames) > rawNum(respawn.maxFrames)) {
      err(`${at}.respawn`, `${index + 1}番目の再出現時間の最小が最大を超えています`);
    }
    if (respawn.enabled && rawNum(respawn.maxFrames) === 0) {
      warn(`${at}.respawn`, `${index + 1}番目の再出現時間が0秒に設定されています`);
    }
    const cond = s.conditions || {};
    const hpCond = cond.enemyBaseHp || {};
    if (hpCond.enabled && rawNum(hpCond.minPercent) > rawNum(hpCond.maxPercent)) {
      warn(`${at}.conditions.enemyBaseHp`, `${index + 1}番目の城HP条件が到達不能の可能性があります`);
    }
  });

  const maxEnemy = rawNum(rawBattle.maxEnemyCount);
  if (Number.isFinite(maxEnemy) && maxEnemy > 0 && stage.spawns.length > maxEnemy * 3) {
    warn('maxEnemyCount', '最大敵数が小さく、出現待ちが起きやすい設定です');
  }
  if (stage.battle.timeLimitFrames > 0) {
    const seconds = framesToSeconds(stage.battle.timeLimitFrames);
    const latestFirst = stage.spawns.reduce((max, s) => Math.max(max, s.firstSpawn.maxFrames), 0);
    if (latestFirst > stage.battle.timeLimitFrames) {
      warn('timeLimitFrames', `一部の敵の初回出現が時間制限(${seconds}秒)より遅く、出現しない可能性があります`);
    }
  }

  return { ok: errors.length === 0, errors, warnings, stage };
}
