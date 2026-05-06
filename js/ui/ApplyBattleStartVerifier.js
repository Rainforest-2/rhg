import { BattleScene } from '../battle/BattleScene.js';
import { PreviewApp } from '../preview/PreviewApp.js';
import { FormationEditor } from './FormationEditor.js';

const ok = (details = null) => ({ ok: true, errors: [], details });
const fail = (errors, details = null) => ({ ok: false, errors, details });

export async function verifyBattleSceneConstructorDoesNotReferenceMissingOptions() {
  const src = BattleScene.toString();
  const errors = [];
  if (!src.includes('constructor(uiLog, options = {})')) errors.push('constructor options signature missing');
  if (src.includes('preferredStageId: options?.selectedStageId')) errors.push('raw options reference still exists');
  return errors.length ? fail(errors) : ok();
}

export async function verifyBattleSceneCanConstructWithoutOptions() {
  try {
    const s = new BattleScene(() => {});
    return (s.stage && (s.stage.selectedStageId || s.stage.stageCsvPath)) ? ok({ stage: s.stage }) : fail(['stage metadata missing'], { stage: s.stage });
  } catch (e) { return fail([String(e?.message || e)]); }
}

export async function verifyBattleSceneCanConstructWithSelectedStageId() {
  try {
    const s = new BattleScene(() => {}, { selectedStageId: 'stageRNA001_00' });
    return s.stage ? ok({ selectedStageId: s.stage?.selectedStageId, stageCsvPath: s.stage?.stageCsvPath }) : fail(['stage missing']);
  } catch (e) { return fail([String(e?.message || e)]); }
}

export async function verifyPreviewAppResetBattleConstructsSceneWithOptionsObject() {
  const src = PreviewApp.prototype.resetBattle?.toString?.() || '';
  const errors = [];
  if (!src.includes('new BattleScene')) errors.push('new BattleScene call missing');
  if (!src.includes('selectedStageId')) errors.push('second options argument with selectedStageId missing');
  return errors.length ? fail(errors) : ok();
}

export async function verifyApplyButtonCallsOnApplyBattleExactlyOnce() {
  let called = 0;
  const editor = {
    applying: false,
    formation: { pages: [[null]] },
    onApplyBattle: async () => { called += 1; },
    root: { querySelector: (s) => (s === '.apply-battle-button' ? { disabled: false, textContent: 'Apply Battle' } : { textContent: '' }) }
  };
  const ev = { target: { closest: (s) => (s === '[data-action]' ? { dataset: { action: 'apply' } } : null) }, preventDefault() {}, stopPropagation() {} };
  await FormationEditor.prototype.onClick.call(editor, ev);
  return called === 1 ? ok({ called }) : fail([`called=${called}`]);
}

export async function verifyApplyFailureIsReportedAndUiRecovered() {
  const btn = { disabled: false, textContent: 'Apply Battle' };
  const hint = { textContent: '' };
  const editor = {
    applying: false,
    formation: { pages: [[null]] },
    onApplyBattle: async () => { throw new Error('boom'); },
    root: { querySelector: (s) => (s === '.apply-battle-button' ? btn : hint) }
  };
  const ev = { target: { closest: (s) => (s === '[data-action]' ? { dataset: { action: 'apply' } } : null) }, preventDefault() {}, stopPropagation() {} };
  await FormationEditor.prototype.onClick.call(editor, ev);
  const errors = [];
  if (editor.applying) errors.push('applying not reset');
  if (btn.disabled) errors.push('button still disabled');
  if (!String(hint.textContent).includes('Apply failed')) errors.push('error hint missing');
  return errors.length ? fail(errors, { hint: hint.textContent }) : ok({ hint: hint.textContent });
}

export async function verifyFormationChangedLogSupportsPagesAndSlots() {
  const src = PreviewApp.toString();
  const errors = [];
  if (!src.includes('formatFormationForLog')) errors.push('formatFormationForLog missing');
  if (src.includes('Formation saved: ${f.slots.join')) errors.push('direct slots.join use still present');
  return errors.length ? fail(errors) : ok();
}
