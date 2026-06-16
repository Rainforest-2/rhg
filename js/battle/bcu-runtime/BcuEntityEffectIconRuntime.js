import { BcuEffAnimRuntime } from '../../bcu-render/BcuEffAnimRuntime.js';

export class BcuEntityEffectIconRuntime {
  constructor({ effectBundle, strict = true } = {}) {
    this.effectBundle = effectBundle || null;
    this.strict = strict;
  }

  createIcon(icon) {
    const asset = this.effectBundle?.[icon?.effectKey] || null;
    if (!asset) {
      const detail = { effectKey: icon?.effectKey || null, reason: 'asset-missing' };
      if (this.strict) throw new Error(`BCU status icon asset missing: ${detail.effectKey}`);
      return null;
    }
    return new BcuEffAnimRuntime({ ...asset, type: icon.effectKey });
  }
}

