import { parseImgcut } from '../bcu/BcuImgcutParser.js';
import { parseModel } from '../bcu/BcuModelParser.js';
import { parseAnim } from '../bcu/BcuAnimParser.js';
import { BcuKbeffRuntime } from './BcuKbeffRuntime.js';
import { verifyAssetPath } from './BcuAssetVerifier.js';
import { BATTLE_CONFIG } from './BattleConfig.js';

export const BCU_KBEFF_LOADER_VERSION = '0.11.8';
export const BCU_KBEFF_TYPE_TO_FILE = { INT_HB: 'kb_hb.maanim', INT_SW: 'kb_sw.maanim', INT_ASS: 'kb_ass.maanim' };
const TYPE_TO_ENUM = { INT_HB: 'KB', INT_SW: 'SW', INT_ASS: 'ASS' };

async function readText(path) {
  if (typeof window === 'undefined') {
    const { readFile } = await import('node:fs/promises');
    const { fileURLToPath, pathToFileURL } = await import('node:url');
    const cwdBase = pathToFileURL(`${process.cwd().replace(/\\/g, '/')}/`);
    return readFile(fileURLToPath(new URL(path, cwdBase)), 'utf8');
  }
  const r = await fetch(path);
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${path}`);
  return r.text();
}

export async function verifyKbeffAssetPaths(baseDir = './public/assets/bcu/000001/org/battle/a/') {
  const required = ['000_a.png', '000_a.imgcut', 'kb.mamodel', 'kb_hb.maanim', 'kb_sw.maanim', 'kb_ass.maanim'];
  const checks = await Promise.all(required.map((f) => verifyAssetPath(`${baseDir}${f}`)));
  return { ok: checks.every((x) => x.ok), checks };
}

export class BcuKbeffLoader {
  constructor(config = null) { this.config = config || BATTLE_CONFIG.tuning?.knockback?.kbEffect || {}; this.baseDir = this.config.baseDir || './public/assets/bcu/000001/org/battle/a/'; this.definitions = new Map(); this.shared = null; }
  async loadAll() {
    const imagePath = `${this.baseDir}${this.config.image || '000_a.png'}`;
    const imgcutPath = `${this.baseDir}${this.config.imgcut || '000_a.imgcut'}`;
    const modelPath = `${this.baseDir}${this.config.model || 'kb.mamodel'}`;
    this.shared = { imagePath, imgcut: parseImgcut(await readText(imgcutPath)), model: parseModel(await readText(modelPath)), image: null };
    for (const t of Object.keys(BCU_KBEFF_TYPE_TO_FILE)) await this.loadType(t);
    return { ok: true, loaded: [...this.definitions.keys()] };
  }
  async loadType(bcuType) {
    const animFile = this.config.animations?.[bcuType] || BCU_KBEFF_TYPE_TO_FILE[bcuType];
    if (!animFile) throw new Error(`Unknown kbeff type: ${bcuType}`);
    if (!this.shared) await this.loadAll();
    const anim = parseAnim(await readText(`${this.baseDir}${animFile}`));
    const d = { bcuType, kbeffType: TYPE_TO_ENUM[bcuType] || bcuType, animFile, model: this.shared.model, anim, image: this.shared.image, imgcut: this.shared.imgcut, maxFrame: anim.maxFrame || 0, source: 'bcu-a-kb-kbeff-v0115' };
    this.definitions.set(bcuType, d);
    return d;
  }
  getDefinition(bcuType) { return this.definitions.get(bcuType) || null; }

  isRuntimeAllowed() {
    if (this.config?.enabled === false) return false;
    if (this.config?.failClosed === true && this.config?.allowRuntime !== true) return false;
    if (this.config?.requireExactMaanim === true && this.config?.exactMaanimVerified !== true) return false;
    if (this.config?.requireParentMatrix === true && this.config?.parentMatrixVerified !== true) return false;
    return true;
  }
  createRuntime(bcuType) { if (!this.isRuntimeAllowed()) throw new Error('KBEff runtime is gated until exact verification passes'); const d = this.getDefinition(bcuType); if (!d) throw new Error(`kbeff definition not loaded: ${bcuType}`); return new BcuKbeffRuntime(d); }
  createVerifiedRuntime(bcuType) { const d = this.getDefinition(bcuType); if (!d) throw new Error(`kbeff definition not loaded: ${bcuType}`); return new BcuKbeffRuntime(d); }
}
