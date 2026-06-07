import { FormationEditor } from './FormationEditor.js';

const FLAG = Symbol.for('wanko-ui.formation-stage-difficulty-filter-controls.v1');

function updateFilterFromTarget(editor, target) {
  const q = target?.closest?.('[data-stage-search-input]');
  const min = target?.closest?.('[data-stage-difficulty-min]');
  const max = target?.closest?.('[data-stage-difficulty-max]');
  if (!(q || min || max) || !editor.root?.contains(target)) return false;

  const previous = editor.__bcuStageDifficultyFilter || {};
  editor.__bcuStageDifficultyFilter = {
    ...previous,
    ...(q ? { q: q.value } : {}),
    ...(min ? { min: min.value } : {}),
    ...(max ? { max: max.value } : {})
  };
  editor.renderStageSelector?.();
  return true;
}

function wireFilterControls(editor) {
  const root = editor.root;
  if (!root) return;
  const selector = '[data-stage-search-input],[data-stage-difficulty-min],[data-stage-difficulty-max]';
  for (const input of root.querySelectorAll(selector)) {
    if (input.dataset.bcuDifficultyFilterWired === '1') continue;
    input.dataset.bcuDifficultyFilterWired = '1';
    const handler = (event) => {
      event.stopPropagation();
      updateFilterFromTarget(editor, event.target);
    };
    input.addEventListener('input', handler);
    input.addEventListener('change', handler);
  }
}

export function installFormationStageDifficultyFilterControlPatch() {
  const proto = FormationEditor?.prototype;
  if (!proto || proto[FLAG]) return;
  proto[FLAG] = true;

  const render = proto.renderStageSelector;
  proto.renderStageSelector = function renderStageSelectorWithDifficultyFilterControls(...args) {
    const result = render.apply(this, args);
    wireFilterControls(this);
    return result;
  };

  const onInput = proto.onInput;
  proto.onInput = function onInputWithDifficultyFilterControls(event) {
    if (updateFilterFromTarget(this, event.target)) return;
    return onInput.call(this, event);
  };
}

installFormationStageDifficultyFilterControlPatch();
