import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIXED_DATE, fileBufferOrNull, hashFile, readJson, writeJson, writeStoreZip } from './bcu-semantic-utils.mjs';

export const EFFECT_WAVE_BUNDLE_KEY = 'effect:wave';
export const EFFECT_WAVE_BUNDLE_PATH = 'public/assets/bundles/effect/wave.zip';
const GENERATED_BUNDLE_MANIFEST_PATH = 'public/assets/generated/bcu-bundle-manifest.json';
const BCU_ASSET_ROOT = 'public/assets/bcu';
const ALL_SKILL_EFFECTS_PREFIX = 'all-skill-effects';
const SKILL_EFFECT_FILE_RE = /\.(png|imgcut|mamodel|maanim)$/i;
const SKILL_EFFECT_DIR_RE = /\/org\/battle\/s\d+$/;

function normalizePath(p) {
  return String(p || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function single({ key, role, dir, out, image, imgcut, model, anim }) {
  return { key, role, sourceDir: dir, entries: [
    { name: `${out}/image.png`, source: image, required: true },
    { name: `${out}/imgcut.imgcut`, source: imgcut, required: true },
    { name: `${out}/model.mamodel`, source: model, required: true },
    { name: `${out}/anim.maanim`, source: anim, required: true }
  ] };
}

function phased({ key, role, dir, out, image, imgcut, model, prefix, names = ['start', 'during', 'end'] }) {
  return { key, role, sourceDir: dir, entries: [
    { name: `${out}/image.png`, source: image, required: true },
    { name: `${out}/imgcut.imgcut`, source: imgcut, required: true },
    { name: `${out}/model.mamodel`, source: model, required: true },
    ...names.map((phase, i) => ({ name: `${out}/anim-${phase}.maanim`, source: `${prefix}${String(i).padStart(2, '0')}.maanim`, required: true, phase }))
  ] };
}

function namedPhased({ key, role, dir, out, image, imgcut, model, phases }) {
  return { key, role, sourceDir: dir, entries: [
    { name: `${out}/image.png`, source: image, required: true },
    { name: `${out}/imgcut.imgcut`, source: imgcut, required: true },
    { name: `${out}/model.mamodel`, source: model, required: true },
    ...Object.entries(phases).map(([phase, source]) => ({ name: `${out}/anim-${phase}.maanim`, source, required: true, phase }))
  ] };
}

const EFFECT_DEFS = Object.freeze([
  single({ key: 'unitWave', role: 'bcu-A_WAVE', dir: 'public/assets/bcu/000001/org/battle/s4', out: 'unit-wave', image: 'skill004.png', imgcut: 'skill004.imgcut', model: 'skill_wave_attack.mamodel', anim: 'skill_wave_attack.maanim' }),
  single({ key: 'enemyWave', role: 'bcu-A_E_WAVE', dir: 'public/assets/bcu/000001/org/battle/s5', out: 'enemy-wave', image: 'skill005.png', imgcut: 'skill005.imgcut', model: 'skill_wave_attack_e.mamodel', anim: 'skill_wave_attack_e.maanim' }),
  single({ key: 'unitMiniWave', role: 'bcu-A_MINIWAVE', dir: 'public/assets/bcu/100100/org/battle/s12', out: 'unit-mini-wave', image: 'skill012.png', imgcut: 'skill012.imgcut', model: 'skill_smallwave_attack.mamodel', anim: 'skill_smallwave_attack.maanim' }),
  single({ key: 'enemyMiniWave', role: 'bcu-A_E_MINIWAVE', dir: 'public/assets/bcu/100100/org/battle/s13', out: 'enemy-mini-wave', image: 'skill013.png', imgcut: 'skill013.imgcut', model: 'skill_smallwave_attack_e.mamodel', anim: 'skill_smallwave_attack_e.maanim' }),

  phased({ key: 'unitSurge', role: 'bcu-A_VOLC', dir: 'public/assets/bcu/000001/org/battle/s9', out: 'unit-surge', image: 'skill009.png', imgcut: 'skill009.imgcut', model: 'skill_volcano.mamodel', prefix: 'skill_volcano' }),
  phased({ key: 'enemySurge', role: 'bcu-A_E_VOLC', dir: 'public/assets/bcu/000001/org/battle/s10', out: 'enemy-surge', image: 'skill010.png', imgcut: 'skill010.imgcut', model: 'skill_volcano.mamodel', prefix: 'skill_volcano' }),
  phased({ key: 'unitMiniSurge', role: 'bcu-A_MINIVOLC', dir: 'public/assets/bcu/120300/org/battle/s15', out: 'unit-mini-surge', image: 'skill015.png', imgcut: 'skill015.imgcut', model: 'skill_smallvolcano.mamodel', prefix: 'skill_smallvolcano' }),
  phased({ key: 'enemyMiniSurge', role: 'bcu-A_E_MINIVOLC', dir: 'public/assets/bcu/120300/org/battle/s16', out: 'enemy-mini-surge', image: 'skill016.png', imgcut: 'skill016.imgcut', model: 'skill_smallvolcano_e.mamodel', prefix: 'skill_smallvolcano_e' }),

  phased({ key: 'unitBlast', role: 'bcu-A_BLAST', dir: 'public/assets/bcu/130700/org/battle/s21', out: 'unit-blast', image: 'skill021.png', imgcut: 'skill021.imgcut', model: 'skill_explosion.mamodel', prefix: 'skill_explosion', names: ['start', 'explode', 'dummy'] }),
  phased({ key: 'enemyBlast', role: 'bcu-A_E_BLAST', dir: 'public/assets/bcu/130700/org/battle/s22', out: 'enemy-blast', image: 'skill022.png', imgcut: 'skill022.imgcut', model: 'skill_explosion_e.mamodel', prefix: 'skill_explosion', names: ['start', 'explode', 'dummy'] }),

  single({ key: 'strongAttack', role: 'bcu-A_SATK', dir: 'public/assets/bcu/000001/org/battle/s6', out: 'strong-attack', image: 'skill006.png', imgcut: 'skill006.imgcut', model: 'strong_attack.mamodel', anim: 'strong_attack.maanim' }),
  single({ key: 'metalKiller', role: 'bcu-A_METAL_KILLER/A_E_METAL_KILLER', dir: 'public/assets/bcu/130300/org/battle/s20', out: 'metal-killer', image: 'skill020.png', imgcut: 'skill020.imgcut', model: 'skill_metal_strong.mamodel', anim: 'skill_metal_strong.maanim' }),

  namedPhased({ key: 'unitBarrier', role: 'bcu-A_B', dir: 'public/assets/bcu/000001/org/battle/s2', out: 'unit-barrier', image: 'skill002.png', imgcut: 'skill002.imgcut', model: 'skill_barrier_e.mamodel', phases: { none: 'skill_barrier_e.maanim', breaker: 'skill_barrier_e_breaker.maanim', destruction: 'skill_barrier_e_destruction.maanim' } }),
  namedPhased({ key: 'enemyBarrier', role: 'bcu-A_E_B', dir: 'public/assets/bcu/000001/org/battle/s2', out: 'enemy-barrier', image: 'skill002.png', imgcut: 'skill002.imgcut', model: 'skill_barrier_e.mamodel', phases: { none: 'skill_barrier_e.maanim', breaker: 'skill_barrier_e_breaker.maanim', destruction: 'skill_barrier_e_destruction.maanim' } }),
  namedPhased({ key: 'demonShield', role: 'bcu-A_DEMON_SHIELD/A_E_DEMON_SHIELD', dir: 'public/assets/bcu/100800/org/battle/s14', out: 'demon-shield', image: 'skill014.png', imgcut: 'skill014.imgcut', model: 'skill_demonshield.mamodel', phases: { full: 'skill_demonshield00.maanim', half: 'skill_demonshield01.maanim', destruction: 'skill_demonshield_destruction.maanim', breaker: 'skill_demonshield_breaker.maanim', revive: 'skill_demonshield_revive.maanim' } }),
  namedPhased({ key: 'warp', role: 'bcu-A_W', dir: 'public/assets/bcu/000001/org/battle/s2', out: 'warp', image: 'skill002.png', imgcut: 'skill002.imgcut', model: 'skill_warp.mamodel', phases: { entrance: 'skill_warp_entrance.maanim', exit: 'skill_warp_exit.maanim' } }),
  namedPhased({ key: 'warpChara', role: 'bcu-A_W_C', dir: 'public/assets/bcu/000001/org/battle/s2', out: 'warp-chara', image: 'skill002.png', imgcut: 'skill002.imgcut', model: 'skill_warp_chara.mamodel', phases: { entrance: 'skill_warp_chara_entrance.maanim', exit: 'skill_warp_chara_exit.maanim' } }),
  single({ key: 'unitWaveInvalid', role: 'bcu-A_WAVE_INVALID', dir: 'public/assets/bcu/000001/org/battle/s0/wave_invalid', out: 'unit-wave-invalid', image: '../skill000.png', imgcut: '../skill000.imgcut', model: 'skill_wave_invalid.mamodel', anim: 'skill_wave_invalid.maanim' }),
  single({ key: 'enemyWaveInvalid', role: 'bcu-A_E_WAVE_INVALID', dir: 'public/assets/bcu/000001/org/battle/s0/wave_invalid', out: 'enemy-wave-invalid', image: '../skill000.png', imgcut: '../skill000.imgcut', model: 'skill_wave_invalid_e.mamodel', anim: 'skill_wave_invalid_e.maanim' }),
  single({ key: 'unitWaveStop', role: 'bcu-A_WAVE_STOP', dir: 'public/assets/bcu/000001/org/battle/s0/wave_stop', out: 'unit-wave-stop', image: '../skill000.png', imgcut: '../skill000.imgcut', model: 'skill_wave_stop.mamodel', anim: 'skill_wave_stop.maanim' }),
  single({ key: 'enemyWaveStop', role: 'bcu-A_E_WAVE_STOP', dir: 'public/assets/bcu/000001/org/battle/s0/wave_stop', out: 'enemy-wave-stop', image: '../skill000.png', imgcut: '../skill000.imgcut', model: 'skill_wave_stop_e.mamodel', anim: 'skill_wave_stop_e.maanim' }),
  namedPhased({ key: 'enemyWaveGuard', role: 'bcu-A_E_GUARD', dir: 'public/assets/bcu/130200/org/battle/s19', out: 'enemy-wave-guard', image: 'skill019.png', imgcut: 'skill019.imgcut', model: 'skill_guard_e.mamodel', phases: { none: 'skill_guard_e.maanim', breaker: 'skill_guard_e_breaker.maanim' } }),
  single({ key: 'unitCounterSurge', role: 'bcu-A_COUNTERSURGE', dir: 'public/assets/bcu/130000/org/battle/s18', out: 'unit-counter-surge', image: 'skill018.png', imgcut: 'skill018.imgcut', model: 'skill_demonsummon.mamodel', anim: 'skill_demonsummon.maanim' }),
  single({ key: 'enemyCounterSurge', role: 'bcu-A_E_COUNTERSURGE', dir: 'public/assets/bcu/130000/org/battle/s17', out: 'enemy-counter-surge', image: '../../../../120400/org/battle/s17/skill017.png', imgcut: '../../../../120400/org/battle/s17/skill017.imgcut', model: 'skill_demonsummon_e.mamodel', anim: 'skill_demonsummon_e.maanim' })
]);

function addEntry(entries, entry) {
  const name = normalizePath(entry.name);
  const previous = entries.get(name);
  entries.set(name, {
    ...previous,
    ...entry,
    name,
    required: !!(previous?.required || entry.required),
    data: entry.data ?? previous?.data ?? null
  });
}

async function* walkFiles(dir) {
  let list;
  try {
    list = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of list) {
    const full = normalizePath(path.join(dir, ent.name));
    if (ent.isDirectory()) {
      yield* walkFiles(full);
    } else if (ent.isFile()) {
      yield full;
    }
  }
}

function isSkillEffectFile(file) {
  const normalized = normalizePath(file);
  if (!SKILL_EFFECT_FILE_RE.test(normalized)) return false;
  return SKILL_EFFECT_DIR_RE.test(normalizePath(path.dirname(normalized)));
}

async function collectAllSkillEffectEntries() {
  const out = [];
  for await (const file of walkFiles(BCU_ASSET_ROOT)) {
    if (!isSkillEffectFile(file)) continue;
    const rel = normalizePath(file).replace(`${BCU_ASSET_ROOT}/`, '');
    const data = await fileBufferOrNull(file);
    if (!data) continue;
    out.push({
      name: `${ALL_SKILL_EFFECTS_PREFIX}/${rel}`,
      data,
      sourcePath: file,
      required: false,
      role: 'bcu-all-skill-effect-raw-copy'
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

function makeBundleJson({ aliases, missingRequired, allSkillEffectFiles }) {
  return Buffer.from(JSON.stringify({
    key: EFFECT_WAVE_BUNDLE_KEY,
    scope: 'all-skill-effects-with-runtime-wave-surge-aliases',
    bcuReference: {
      package: 'battlecatsultimate/BCU_java_util_common',
      classes: ['battle.entity.ContWaveDef', 'battle.attack.ContVolcano', 'battle.attack.ContBlast'],
      importantEffects: {
        A_WAVE: './org/battle/s4/skill_wave_attack',
        A_E_WAVE: './org/battle/s5/skill_wave_attack_e',
        A_MINIWAVE: './org/battle/s12/skill_smallwave_attack',
        A_E_MINIWAVE: './org/battle/s13/skill_smallwave_attack_e',
        A_VOLC: './org/battle/s9/skill_volcano',
        A_E_VOLC: './org/battle/s10/skill_volcano',
        A_MINIVOLC: './org/battle/s15/skill_smallvolcano',
        A_E_MINIVOLC: './org/battle/s16/skill_smallvolcano_e',
        A_BLAST: './org/battle/s21/skill_explosion',
        A_E_BLAST: './org/battle/s22/skill_explosion',
        A_SATK: './org/battle/s6/strong_attack',
        A_METAL_KILLER: './org/battle/s20/skill_metal_strong',
        A_E_METAL_KILLER: './org/battle/s20/skill_metal_strong',
        A_B: './org/battle/s2/skill_barrier_e',
        A_E_B: './org/battle/s2/skill_barrier_e',
        A_W: './org/battle/s2/skill_warp',
        A_W_C: './org/battle/s2/skill_warp_chara',
        A_WAVE_INVALID: './org/battle/s0/wave_invalid/skill_wave_invalid',
        A_E_WAVE_INVALID: './org/battle/s0/wave_invalid/skill_wave_invalid_e',
        A_WAVE_STOP: './org/battle/s0/wave_stop/skill_wave_stop',
        A_E_WAVE_STOP: './org/battle/s0/wave_stop/skill_wave_stop_e',
        A_DEMON_SHIELD: './org/battle/s14/skill_demonshield',
        A_E_DEMON_SHIELD: './org/battle/s14/skill_demonshield',
        A_COUNTERSURGE: './org/battle/s18/skill_demonsummon',
        A_E_COUNTERSURGE: './org/battle/s17/skill_demonsummon_e',
        A_E_GUARD: './org/battle/s19/skill_guard_e'
      },
      timing: {
        normalWave: { initialT: -3, effectAtT: 0, attackAtT: 6, nextWaveAtT: 3 },
        miniWave: { initialT: -1, effectAtT: 0, attackAtT: 4, nextWaveAtT: 1 },
        blast: { pre: 11, interval: 10, duration: 15 }
      }
    },
    runtimeAliases: aliases,
    allSkillEffects: {
      prefix: ALL_SKILL_EFFECTS_PREFIX,
      files: allSkillEffectFiles
    },
    policy: 'single projectile/effect bundle; runtime aliases use short paths, all skill effect source files are also copied under all-skill-effects/',
    missingRequired,
    generatedAt: FIXED_DATE
  }, null, 2));
}

export async function buildWaveEffectBundleEntries() {
  const entries = new Map();
  const aliases = [];
  const missingRequired = [];

  for (const def of EFFECT_DEFS) {
    for (const alias of def.entries) {
      const sourcePath = normalizePath(path.join(def.sourceDir, alias.source));
      const data = await fileBufferOrNull(sourcePath);
      const detail = {
        key: def.key,
        role: def.role,
        name: alias.name,
        source: alias.source,
        sourcePath,
        required: alias.required,
        phase: alias.phase || null,
        present: !!data
      };
      aliases.push(detail);
      if (alias.required && !data) missingRequired.push({ key: def.key, name: alias.name, source: alias.source, sourcePath, role: def.role });
      addEntry(entries, { name: alias.name, data, sourcePath, required: alias.required, role: def.role });
    }
  }

  const allSkillEffectEntries = await collectAllSkillEffectEntries();
  for (const entry of allSkillEffectEntries) addEntry(entries, entry);

  addEntry(entries, {
    name: 'bundle.json',
    data: makeBundleJson({
      aliases,
      missingRequired,
      allSkillEffectFiles: allSkillEffectEntries.map((entry) => ({ name: entry.name, sourcePath: entry.sourcePath }))
    }),
    required: true,
    sourcePath: 'generated'
  });

  return [...entries.values()].sort((a, b) => {
    if (a.name === 'bundle.json') return -1;
    if (b.name === 'bundle.json') return 1;
    return a.name.localeCompare(b.name);
  });
}

export async function rebuildWaveEffectBundle() {
  const entries = await buildWaveEffectBundleEntries();
  const missingRequired = entries.filter((entry) => entry.required && entry.data == null).map((entry) => entry.name);
  if (missingRequired.length) throw new Error(`Cannot build ${EFFECT_WAVE_BUNDLE_KEY}; missing required entries: ${missingRequired.join(', ')}`);

  const filtered = entries.filter((entry) => entry.data != null).map(({ name, data }) => ({ name, data }));
  await writeStoreZip(EFFECT_WAVE_BUNDLE_PATH, filtered);
  const stat = await fs.stat(EFFECT_WAVE_BUNDLE_PATH);
  const manifest = await readJson(GENERATED_BUNDLE_MANIFEST_PATH, { schemaVersion: 1, generatedAt: FIXED_DATE, zipFormat: 'store-only', bundles: {} });
  manifest.bundles ||= {};
  manifest.bundles[EFFECT_WAVE_BUNDLE_KEY] = {
    kind: 'effect',
    key: EFFECT_WAVE_BUNDLE_KEY,
    bundlePath: EFFECT_WAVE_BUNDLE_PATH,
    status: 'full',
    sizeBytes: stat.size,
    hash: await hashFile(EFFECT_WAVE_BUNDLE_PATH),
    files: filtered.map((entry) => entry.name),
    allSkillEffectsPrefix: ALL_SKILL_EFFECTS_PREFIX
  };
  await writeJson(GENERATED_BUNDLE_MANIFEST_PATH, manifest);
  return { bundleKey: EFFECT_WAVE_BUNDLE_KEY, bundlePath: EFFECT_WAVE_BUNDLE_PATH, entries: filtered.map((entry) => entry.name), sizeBytes: stat.size, hash: manifest.bundles[EFFECT_WAVE_BUNDLE_KEY].hash };
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) console.log(JSON.stringify(await rebuildWaveEffectBundle(), null, 2));
