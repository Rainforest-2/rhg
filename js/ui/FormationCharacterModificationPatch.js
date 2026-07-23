import { FormationEditor } from './FormationEditor.js';
import { FormationStore } from '../battle/FormationStore.js';
import { getCharacterById } from '../battle/CharacterCatalog.js';
import { BattleStatsLoader } from '../battle/BattleStatsLoader.js';
import { resolveNormalTemplateStats } from '../battle/BattleActorFactory.js';
import {
  computeFrontRowForms,
  resolveComboModifiersForFrontRow
} from '../battle/bcu-runtime/BcuComboStatModifier.js';
import { parseOrb } from '../battle/bcu-runtime/BcuOrbModifier.js';
import { getTalentInfoForUnit } from '../battle/bcu-runtime/BcuTalentInfoData.js';
import {
  applyCustomStageProductionModifiers,
  resolveBcuProductionValues,
  resolveUnitDefinitionProductionValues
} from '../battle/ProductionRuntime.js';
import { BCU_BATTLE_TIMER_PERIOD_MS } from '../battle/BattleFrameClock.js';
import {
  CHARACTER_MODIFICATION_IMPORT_LIMITS,
  isEmptyCharacterModification
} from '../character-modification/CharacterModificationSchema.js';
import {
  commitPreparedCharacterModificationImport,
  createCharacterModificationPack,
  prepareCharacterModificationImport
} from '../character-modification/CharacterModificationCodec.js';
import { validateCharacterModification } from '../character-modification/CharacterModificationValidator.js';
import {
  openCharacterModificationEditor
} from './character-modification/CharacterModificationEditor.js';
import {
  resolveCustomStageSpawnModification
} from '../custom-stage/CustomStageCharacterModificationAdapter.js';
import { decodeStageRef } from '../custom-stage/CustomStageSchema.js';
import { getCustomStage } from '../custom-stage/CustomStageStore.js';

const PATCH_FLAG = Symbol.for('wanko-formation-character-modification.v1');
const FORM_CODES = Object.freeze(['f', 'c', 's', 'u']);
const MAX_TREASURE_POINTS = 300;

function characterStatsIdentity(character) {
  const id = String(character?.characterId || '');
  const cat = /^cat-unit-(\d+)-([fcsu])$/.exec(id);
  if (cat) {
    const form = character?.form || cat[2];
    const formRow = Number.isInteger(character?.formIndex)
      ? character.formIndex
      : Math.max(0, FORM_CODES.indexOf(form));
    return {
      statsType: 'unit',
      statsId: Number(cat[1]),
      form,
      formRow
    };
  }
  const dog = /^dog-enemy-(\d+)$/.exec(id);
  if (dog) {
    return {
      statsType: 'enemy',
      statsId: Number(dog[1]),
      form: null,
      formRow: null
    };
  }
  return null;
}

function currentBcuDb() {
  const db = globalThis.__BCU_DB__ || null;
  if (!db) throw new Error('BCUデータの読み込み完了後にもう一度開いてください');
  return db;
}

function resolveBcuSummonTarget(targetId, { kind, form = 1 } = {}) {
  const db = currentBcuDb();
  const numericId = Number(targetId);
  if (!Number.isInteger(numericId) || numericId < 0) return false;
  if (kind === 'unit') {
    const formCode = FORM_CODES[Math.max(0, Math.min(FORM_CODES.length - 1, Number(form) - 1))] || 'f';
    return !!(
      db.assets?.resolveUnitAsset?.(numericId, formCode)
      || db.semanticProvider?.getActorEntry?.(`unit:${numericId}:${formCode}`)
      || db.semanticIndexes?.actors?.byKey?.[`unit:${numericId}:${formCode}`]
    );
  }
  if (kind === 'enemy') {
    return !!(
      db.assets?.resolveEnemyAsset?.(numericId)
      || db.semanticProvider?.getActorEntry?.(`enemy:${numericId}`)
      || db.semanticIndexes?.actors?.byKey?.[`enemy:${numericId}`]
    );
  }
  return false;
}

function characterModificationValidationContext() {
  return {
    resolveSummonTarget: resolveBcuSummonTarget,
    requireResolvedReferences: true
  };
}

function treasureContext(formation) {
  const treasure = formation?.options?.bcuTreasure?.trea || {};
  return {
    trea: [
      Math.trunc(Number(treasure.atk) || 0) || MAX_TREASURE_POINTS,
      Math.trunc(Number(treasure.def) || 0) || MAX_TREASURE_POINTS
    ]
  };
}

function augmentProductionNormalValues(normalStats, production) {
  if (!production) return normalStats;
  return {
    ...normalStats,
    production: {
      cost: production.deployCost,
      respawnFrames: production.respawnFrames,
      deployLimit: production.deployLimit
    }
  };
}

export function resolveFormationCharacterModificationStageLimits(editor) {
  const config = typeof editor?.getCustomStageBattleConfig === 'function'
    ? editor.getCustomStageBattleConfig()
    : globalThis.__CUSTOM_STAGE_BATTLE_CONFIG__;
  if (!config?.enabled || !config.baseStageId) return null;
  const ref = decodeStageRef(config.baseStageId);
  if (ref?.kind !== 'custom') return null;
  const stage = getCustomStage(ref.id);
  if (!stage) {
    throw new Error(`カスタムステージ ${ref.id} が見つからないため生産値を解決できません`);
  }
  return stage.limits || null;
}

export function applyFormationCharacterModificationProductionContext(production, editor) {
  return applyCustomStageProductionModifiers(
    production,
    resolveFormationCharacterModificationStageLimits(editor)
  );
}

async function resolveFormationNormalValues(editor, characterId) {
  const character = getCharacterById(characterId);
  const identity = characterStatsIdentity(character);
  if (!character || !identity) throw new Error('キャラクターのBCU統計IDを解決できません');
  const loader = new BattleStatsLoader({ bcuDb: currentBcuDb() });
  const tuning = editor.getCharacterBattleTuning?.(characterId) || {};
  const formation = FormationStore.load();
  const unitDef = {
    slotId: `modification-preview-${characterId}`,
    characterId,
    sourceSlotId: character.sourceSlotId || characterId,
    statsType: identity.statsType,
    statsId: identity.statsId,
    form: identity.form,
    formRow: identity.formRow
  };

  let baseStats;
  let production;
  if (identity.statsType === 'unit') {
    baseStats = await loader.loadUnitStats(identity.statsId, identity.form, identity.formRow);
    const resolved = tuning.catResolved || {};
    unitDef.bcuUnitLevel = {
      level: resolved.level,
      plusLevel: resolved.plusLevel,
      prefLevel: resolved.prefLevel,
      metadata: character.bcuUnitLevelMeta || baseStats.bcuUnitLevelMeta || {},
      source: 'formation-character-modification-preview'
    };
    const combo = resolveComboModifiersForFrontRow(computeFrontRowForms(formation));
    if (combo) unitDef.bcuComboModifiers = combo;
    unitDef.bcuTreasure = treasureContext(formation);
    const talentLevels = Array.isArray(tuning.catTalentLevels)
      ? tuning.catTalentLevels
      : [];
    const talentInfo = getTalentInfoForUnit(identity.statsId);
    if (talentInfo && talentLevels.some((level) => Number(level) > 0)) {
      unitDef.bcuTalentInfo = talentInfo;
      unitDef.bcuTalentLevels = talentLevels;
    }
    const orbs = (tuning.catOrbEquipment || []).map(parseOrb).filter(Boolean);
    if (orbs.length) unitDef.bcuEquippedOrbs = orbs;
  } else {
    baseStats = await loader.loadEnemyStats(identity.statsId);
    const percent = Math.max(1, Number(tuning.dogResolved?.percent) || 100);
    unitDef.stageStatModifiers = {
      source: 'formation-character-modification-preview',
      magnification: percent,
      hpMagnification: percent,
      attackMagnification: percent
    };
  }

  const normalStats = resolveNormalTemplateStats(loader, unitDef, baseStats);
  if (identity.statsType === 'unit') {
    production = resolveBcuProductionValues(normalStats);
  } else {
    production = resolveUnitDefinitionProductionValues({
      cost: character.defaultCost ?? character.cost,
      cooldownMs: character.defaultCooldownMs ?? character.cooldownMs
    });
  }
  production = applyFormationCharacterModificationProductionContext(production, editor);
  return augmentProductionNormalValues(normalStats, production);
}

async function resolveCustomStageNormalValues(stage, spawn) {
  const loader = new BattleStatsLoader({ bcuDb: currentBcuDb() });
  const baseStats = await loader.loadEnemyStats(spawn.enemyId);
  return resolveNormalTemplateStats(loader, {
    slotId: `custom-stage-modification-preview-${spawn.id}`,
    statsType: 'enemy',
    statsId: spawn.enemyId,
    stageStatModifiers: {
      source: 'custom-stage-character-modification-preview',
      magnification: spawn.hpMultiplier,
      hpMagnification: spawn.hpMultiplier,
      attackMagnification: spawn.attackMultiplier,
      customStageId: stage.id,
      spawnId: spawn.id
    }
  }, baseStats);
}

function scheduleFormationRefresh(editor, characterId) {
  globalThis.setTimeout?.(() => {
    editor.formation = FormationStore.load();
    editor.onFormationChanged?.(editor.formation);
    editor.renderDynamic?.();
    const draft = editor.characterTuningDraft;
    if (draft?.characterId === characterId) {
      editor.root?.querySelector?.(
        '.formation-tuning-overlay [data-character-modification-open]'
      )?.focus?.({ preventScroll: true });
    }
  }, 0);
}

function updateTuningModificationCount(trigger, count) {
  const label = trigger?.closest?.('.formation-character-modification-entry')
    ?.querySelector?.('.formation-tuning-control-head span');
  if (label) label.textContent = `${count}項目変更`;
}

function downloadJson(json, fileName) {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    globalThis.setTimeout?.(() => URL.revokeObjectURL(url), 1000);
  }
}

function selectJsonFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.hidden = true;
    document.body.appendChild(input);
    let settled = false;
    const finish = (value, error = null) => {
      if (settled) return;
      settled = true;
      globalThis.removeEventListener?.('focus', onWindowFocus, true);
      input.remove();
      if (error) reject(error);
      else resolve(value);
    };
    const onWindowFocus = () => {
      globalThis.setTimeout?.(() => {
        if (!input.files?.length) finish(null);
      }, 250);
    };
    input.addEventListener('cancel', () => finish(null), { once: true });
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return finish(null);
      if (file.size > CHARACTER_MODIFICATION_IMPORT_LIMITS.maxBytes) {
        return finish(null, new Error('JSONは5 MiB以下にしてください'));
      }
      try {
        finish(await file.text());
      } catch (error) {
        finish(null, error);
      }
    }, { once: true });
    globalThis.addEventListener?.('focus', onWindowFocus, true);
    input.click();
  });
}

function modificationPackEntries(overrides = {}) {
  const stored = FormationStore.getOptions().characterModifications || {};
  const modifications = { ...stored, ...overrides };
  return Object.entries(modifications)
    .filter(([, modification]) => !isEmptyCharacterModification(modification))
    .map(([characterId, modification]) => ({
      characterId,
      name: getCharacterById(characterId)?.label || characterId,
      modification
    }));
}

function exportFormationModificationPack(characterId, currentModification) {
  const entries = modificationPackEntries({ [characterId]: currentModification });
  if (!entries.length) return { ok: false, message: '書き出す改造がありません' };
  const encoded = createCharacterModificationPack(entries);
  if (!encoded.ok) {
    return {
      ok: false,
      message: encoded.errors?.[0]?.message || '改造パックを作成できません'
    };
  }
  downloadJson(encoded.json, 'rhg-character-modifications.json');
  return {
    ok: true,
    message: `${encoded.entryCount}キャラクターの改造を書き出しました`
  };
}

function characterModificationKind(character) {
  return character?.faction === 'cat' ? 'unit' : 'enemy';
}

async function prepareFormationPackTransaction(editor, selectedCharacterId) {
  const text = await selectJsonFile();
  if (text == null) return null;
  const prepared = prepareCharacterModificationImport(text, {
    owner: 'formation',
    ...characterModificationValidationContext()
  });
  if (!prepared.ok) {
    throw new Error(prepared.errors?.[0]?.message || '改造パックを読み込めません');
  }
  if (prepared.candidate.type !== 'rhg-character-modification-pack') {
    throw new Error('キャラクター改造パックを選択してください');
  }

  const existing = FormationStore.getOptions().characterModifications || {};
  const replacements = {};
  const errors = [];
  const warnings = [...(prepared.warnings || [])];
  const seenCharacters = new Set();
  for (const entry of prepared.candidate.entries || []) {
    const characterId = String(entry.characterId || '');
    const character = getCharacterById(characterId);
    if (!character) {
      errors.push({ message: `存在しないキャラクターIDです: ${characterId}` });
      continue;
    }
    if (seenCharacters.has(characterId)) {
      errors.push({ message: `同じキャラクターが重複しています: ${characterId}` });
      continue;
    }
    seenCharacters.add(characterId);
    const source = prepared.candidate.modifications?.[entry.modificationRef];
    const validation = validateCharacterModification(source, {
      kind: characterModificationKind(character),
      owner: 'formation',
      allowNumericStrings: false,
      ...characterModificationValidationContext()
    });
    errors.push(...validation.errors);
    warnings.push(...validation.warnings);
    if (!validation.valid || isEmptyCharacterModification(validation.modification)) {
      if (validation.valid) {
        warnings.push({ message: `${characterId}には適用可能な改造項目がありません` });
      }
      continue;
    }
    replacements[characterId] = validation.modification;
  }

  const ids = Object.keys(replacements);
  const overwrittenCharacters = ids
    .filter((id) => Object.prototype.hasOwnProperty.call(existing, id))
    .map((id) => {
      const character = getCharacterById(id);
      return `${character?.label || id} (ID: ${id})`;
    });
  const overwriteCount = overwrittenCharacters.length;
  return {
    preview: {
      addedModificationCount: ids.length - overwriteCount,
      overwriteCount,
      overwrittenCharacters,
      changedFieldCount: prepared.preview.changedFieldCount,
      migrations: prepared.migrations,
      warnings,
      errors
    },
    cancel() {},
    commit() {
      if (errors.length) return { ok: false, message: '入力エラーがあるため適用できません' };
      const write = commitPreparedCharacterModificationImport(prepared, () => (
        FormationStore.setCharacterModificationsAtomic(replacements)
      ));
      if (!write.ok) {
        return {
          ok: false,
          message: '保存領域へ書き込めなかったため、インポートを確定できません'
        };
      }
      editor.formation = write.formation;
      const selectedImported = Object.prototype.hasOwnProperty.call(
        replacements,
        selectedCharacterId
      );
      return {
        ok: true,
        committed: selectedImported,
        ...(selectedImported
          ? { modification: replacements[selectedCharacterId] }
          : {}),
        message: `${ids.length}キャラクターの改造を読み込みました`
      };
    }
  };
}

async function openFormationCharacterModification(editor, trigger) {
  const draft = editor.characterTuningDraft;
  const characterId = draft?.characterId;
  const character = characterId ? getCharacterById(characterId) : null;
  if (!character) return false;
  const overlay = editor.root?.querySelector?.('.formation-tuning-overlay');
  if (!overlay) return false;
  const iconElement = overlay.querySelector('.formation-tuning-portrait img');
  await openCharacterModificationEditor({
    mode: 'standalone',
    mount: editor.root,
    overlay,
    trigger,
    owner: 'formation',
    subjectKind: characterStatsIdentity(character)?.statsType || 'unit',
    subject: {
      characterId,
      name: character.label || characterId,
      formLabel: character.form ? `形態 ${character.form}` : null,
      levelLabel: character.faction === 'cat'
        ? `Lv${draft.level ?? '-'}+${draft.plusLevel ?? 0}`
        : `${draft.percent ?? 100}%`,
      contextLabel: '最終設定値',
      iconElement
    },
    modification: FormationStore.getCharacterModification(characterId),
    context: characterModificationValidationContext(),
    onResolveNormalValues: () => resolveFormationNormalValues(editor, characterId),
    framesToSeconds: (frames) => (
      Math.round(Number(frames || 0) * BCU_BATTLE_TIMER_PERIOD_MS) / 1000
    ),
    onCommit: ({ modification, changedCount }) => {
      const write = FormationStore.setCharacterModificationsAtomic({
        [characterId]: modification
      });
      if (!write.ok) {
        return {
          ok: false,
          message: '保存領域へ書き込めませんでした。変更はeditor内に保持しています'
        };
      }
      editor.formation = write.formation;
      updateTuningModificationCount(trigger, changedCount);
      return { ok: true, message: 'キャラクター改造を保存しました' };
    },
    onAfterClose: () => scheduleFormationRefresh(editor, characterId),
    onRequestExport: ({ modification }) => (
      exportFormationModificationPack(characterId, modification)
    ),
    onRequestImport: () => (
      prepareFormationPackTransaction(editor, characterId)
    )
  });
  return true;
}

async function openCustomStageCharacterModification(editor, trigger) {
  const state = editor.getCustomStageBuilderState?.();
  const index = Number(trigger.dataset.customSpawnModificationOpen);
  const spawn = state?.stage?.spawns?.[index];
  const card = trigger.closest?.('.formation-custom-spawn-modal-card');
  if (!state?.stage || !spawn || !card) return false;
  const resolved = resolveCustomStageSpawnModification(state.stage, spawn);
  const iconElement = card.querySelector('.formation-custom-spawn-modal-head img');
  await openCharacterModificationEditor({
    mode: 'embedded',
    mount: card,
    trigger,
    owner: 'custom-stage',
    subjectKind: 'enemy',
    subject: {
      characterId: `enemy-${spawn.enemyId}`,
      name: card.querySelector('.formation-custom-spawn-modal-head strong')?.textContent
        || `敵 ${spawn.enemyId}`,
      formLabel: `敵spawn row ${index + 1}`,
      levelLabel: `HP倍率 ${spawn.hpMultiplier ?? 100}% / 攻撃倍率 ${spawn.attackMultiplier ?? 100}%`,
      contextLabel: `spawn row ${index + 1} 最終設定値`,
      iconElement
    },
    modification: resolved?.characterModification || null,
    context: characterModificationValidationContext(),
    onResolveNormalValues: () => resolveCustomStageNormalValues(state.stage, spawn),
    framesToSeconds: (frames) => (
      Math.round(Number(frames || 0) * BCU_BATTLE_TIMER_PERIOD_MS) / 1000
    ),
    onCommit: ({ modification, changedCount }) => {
      const result = editor.setCustomStageSpawnCharacterModification?.(
        spawn.id,
        modification
      );
      if (!result?.ok) return result || { ok: false };
      return { ok: true, message: `spawn rowへ${changedCount}項目の改造を反映しました` };
    },
    onAfterClose: () => {
      editor.refreshCustomStageSpawnModal?.();
      globalThis.setTimeout?.(() => {
        editor.root?.querySelector?.(
          `[data-custom-spawn-modification-open='${index}']`
        )?.focus?.({ preventScroll: true });
      }, 0);
    }
  });
  return true;
}

export function installFormationCharacterModificationPatch() {
  const proto = FormationEditor?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;
  const originalOnClick = proto.onClick;
  proto.onClick = function onClickWithCharacterModification(event) {
    const formationTrigger = event.target.closest?.('[data-character-modification-open]');
    const customStageTrigger = event.target.closest?.('[data-custom-spawn-modification-open]');
    if ((formationTrigger || customStageTrigger) && this.root?.contains(event.target)) {
      event.preventDefault();
      event.stopPropagation();
      const open = formationTrigger
        ? openFormationCharacterModification(this, formationTrigger)
        : openCustomStageCharacterModification(this, customStageTrigger);
      open.catch((error) => {
        this.setHint?.(`キャラクター改造を開けません: ${error?.message || error}`);
      });
      return;
    }
    return originalOnClick.call(this, event);
  };
}

installFormationCharacterModificationPatch();
