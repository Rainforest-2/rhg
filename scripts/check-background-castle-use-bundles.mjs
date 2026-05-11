import { BcuBootLoader } from '../js/bcu/BcuBootLoader.js';
import { StageBackgroundLoader } from '../js/battle/StageBackgroundLoader.js';
import { BcuCastleAssetLoader } from '../js/battle/BcuCastleAssetLoader.js';

globalThis.Image = class {
  constructor() { this.width = 256; this.height = 128; this.naturalWidth = 256; this.naturalHeight = 128; }
  set src(value) { this._src = value; setTimeout(() => this.onload?.(), 0); }
  get src() { return this._src; }
};

const errors = [];
const db = await BcuBootLoader.loadGame();
const bg = await new StageBackgroundLoader(() => {}, { bcuDb: db }).load({ bgId: 0, id: 0, cropName: '背景bg' });
if (!bg?.source || bg.source.bgCsvSource !== 'semantic-background-bundle') errors.push('background did not load from semantic bundle');
const castle = await new BcuCastleAssetLoader({ bcuDb: db, imageLoader: (src) => ({ width: 128, height: 256, naturalWidth: 128, naturalHeight: 256, src }) }).load(0);
if (!castle?.ok || castle.source !== 'semantic-castle-bundle') errors.push('castle did not load from semantic bundle');
if (db.semanticProvider.diagnostics.rawOnlyReads.length) errors.push('background/castle performed raw-only reads');

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('background/castle bundle check ok');
