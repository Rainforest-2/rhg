import { FormationEditor } from './FormationEditor.js';

const FLAG = Symbol.for('wanko-ui.formation-stage-default-crown-fast-path.v1');
const SINGLE_CROWN_INDEX = Object.freeze({
  schemaVersion: 3,
  encoding: 'single-crown-fast-path',
  entries: Object.freeze([]),
  byKey: Object.freeze({}),
  byMapId: Object.freeze({}),
  byName: Object.freeze({}),
  byNormalizedName: Object.freeze({})
});

function hasExplicitCrownFilter(editor) {
  const filter = editor?.__bcuStageDifficultyFilter || {};
  const query = String(filter.q || '').normalize('NFKC').trim();
  const rawStar = Number(filter.star ?? 1);
  return !!query || (Number.isFinite(rawStar) && Math.trunc(rawStar) > 1);
}

export function installFormationStageDefaultCrownFastPathPatch() {
  const prototype = FormationEditor?.prototype;
  if (!prototype || prototype[FLAG]) return;
  prototype[FLAG] = true;

  const render = prototype.renderStageSelector;
  prototype.renderStageSelector = function renderStageSelectorWithDefaultCrownFastPath(...args) {
    const fullIndex = this.__bcuStageCrownIndex;
    if (!fullIndex || hasExplicitCrownFilter(this)) return render.apply(this, args);

    // ★1 without a search query includes every map regardless of its crown metadata. Avoid resolving
    // every event map against the full cumulative-pack index during this default category render.
    // The real index is restored synchronously before selection/filter actions can read it.
    this.__bcuStageCrownIndex = SINGLE_CROWN_INDEX;
    try {
      return render.apply(this, args);
    } finally {
      this.__bcuStageCrownIndex = fullIndex;
    }
  };
}

installFormationStageDefaultCrownFastPathPatch();
