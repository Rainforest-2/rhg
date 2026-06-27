export const BCU_ASSET_VERIFIER_VERSION = '0.11.2';

const UNIT_VERSION = '000004';
const ENEMY_DATA_VERSION = '000002';
const ENEMY_ICON_VERSION = '000010';

const pad3 = (n) => String(n).padStart(3, '0');

async function importNode(specifier) {
  return await Function('specifier', 'return import(specifier)')(specifier);
}

export function getUnitRequiredAssetPaths(unitId, form = 'f') {
  const u = pad3(unitId);
  const p = `./public/assets/bcu/${UNIT_VERSION}/org/unit/${u}/${form}/`;
  return [
    `./public/assets/bcu/${UNIT_VERSION}/org/unit/${u}/unit${u}.csv`,
    `${p}${u}_${form}.png`, `${p}${u}_${form}.imgcut`, `${p}${u}_${form}.mamodel`,
    `${p}${u}_${form}00.maanim`, `${p}${u}_${form}01.maanim`, `${p}${u}_${form}02.maanim`, `${p}${u}_${form}03.maanim`,
    `${p}uni${u}_${form}00.png`
  ];
}

export function getEnemyRequiredAssetPaths(enemyId) {
  const e = pad3(enemyId);
  const p = `./public/assets/bcu/${ENEMY_DATA_VERSION}/org/enemy/${e}/`;
  return [
    `${p}${e}_e.png`, `${p}${e}_e.imgcut`, `${p}${e}_e.mamodel`, `${p}${e}_e00.maanim`, `${p}${e}_e01.maanim`, `${p}${e}_e02.maanim`, `${p}${e}_e03.maanim`,
    `${p}edi_${e}.png`, `./public/assets/bcu/${ENEMY_ICON_VERSION}/org/enemy/${e}/enemy_icon_${e}.png`
  ];
}

export async function verifyAssetPath(path) {
  try {
    if (typeof window === 'undefined') {
      const { access } = await importNode('node:fs/promises');
      const { fileURLToPath, pathToFileURL } = await importNode('node:url');
      const cwdBase = pathToFileURL(`${process.cwd().replace(/\\/g, '/')}/`);
      await access(fileURLToPath(new URL(path, cwdBase)));
      return { path, ok: true, mode: 'node-fs' };
    }
    const head = await fetch(path, { method: 'HEAD' });
    if (head.ok) return { path, ok: true, mode: 'browser-head' };
    const get = await fetch(path);
    return { path, ok: get.ok, mode: 'browser-get', status: get.status };
  } catch (e) {
    return { path, ok: false, error: String(e?.message || e) };
  }
}

export async function verifyUnitAssets(unitId, form = 'f') {
  const paths = getUnitRequiredAssetPaths(unitId, form);
  const checks = await Promise.all(paths.map((path) => verifyAssetPath(path)));
  return { kind: 'unit', unitId, form, ok: checks.every((x) => x.ok), checks };
}

export async function verifyEnemyAssets(enemyId) {
  const paths = getEnemyRequiredAssetPaths(enemyId);
  const checks = await Promise.all(paths.map((path) => verifyAssetPath(path)));
  const icon = checks.find((c) => c.path.includes('enemy_icon_'));
  const edi = checks.find((c) => c.path.includes('/edi_'));
  const coreOk = checks.filter((c) => !c.path.includes('enemy_icon_')).every((c) => c.ok);
  const ok = coreOk && (!!icon?.ok || !!edi?.ok);
  return { kind: 'enemy', enemyId, ok, checks };
}

export async function verifyKnownCharacterAssets() {
  const known = {
    'dog-wanko': await verifyEnemyAssets(0),
    'dog-nyoro': await verifyEnemyAssets(1),
    'dog-rei': await verifyEnemyAssets(2),
    'cat-basic': await verifyUnitAssets(0, 'f'),
    'cat-tank': await verifyUnitAssets(1, 'f'),
    'cat-battle': await verifyUnitAssets(2, 'f'),
    'cat-kimo': await verifyUnitAssets(3, 'f')
  };
  return { ok: Object.values(known).every((v) => v.ok), known };
}

export async function getVerifiedExtraCatUnits() {
  const out = [];
  for (let id = 4; id <= 8; id += 1) {
    const r = await verifyUnitAssets(id, 'f');
    out.push({ unitId: id, ok: r.ok });
  }
  return out;
}

export async function verifyKbeffAssets() {
  const p = './public/assets/bcu/000001/org/battle/a/';
  const paths = ['000_a.png','000_a.imgcut','kb.mamodel','kb_hb.maanim','kb_sw.maanim','kb_ass.maanim'].map((f)=>`${p}${f}`);
  const checks = await Promise.all(paths.map((path) => verifyAssetPath(path)));
  return { kind: 'kbeff', ok: checks.every((x) => x.ok), checks };
}
