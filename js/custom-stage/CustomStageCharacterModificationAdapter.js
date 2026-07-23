import {
  isEmptyCharacterModification
} from '../character-modification/CharacterModificationNormalizer.js';
import { hashCharacterModification } from '../character-modification/CharacterModificationHash.js';
import { validateCharacterModification } from '../character-modification/CharacterModificationValidator.js';
import { normalizeCustomStage } from './CustomStageSchema.js';

export function resolveCustomStageSpawnModification(stage, spawn) {
  const ref = typeof spawn?.modificationRef === 'string' ? spawn.modificationRef : null;
  if (!ref) return null;
  const raw = stage?.modifications?.[ref];
  if (!raw) return null;
  const validation = validateCharacterModification(raw, {
    kind: 'enemy',
    owner: 'custom-stage',
    rejectUnsupportedFields: true,
    source: 'custom-stage'
  });
  if (!validation.valid) {
    const error = new Error(validation.errors.map((item) => item.message).join('; '));
    error.name = 'CharacterModificationValidationError';
    error.validation = validation;
    throw error;
  }
  const modification = validation.modification;
  if (isEmptyCharacterModification(modification)) return null;
  return {
    characterModification: modification,
    characterModificationHash: hashCharacterModification(modification),
    characterModificationSource: 'custom-stage',
    modificationRef: ref
  };
}

export function attachCustomStageCharacterModificationToRow(stage, spawn, row) {
  const resolved = resolveCustomStageSpawnModification(stage, spawn);
  if (!resolved) return row;
  return {
    ...row,
    characterModification: resolved.characterModification,
    characterModificationHash: resolved.characterModificationHash,
    characterModificationSource: resolved.characterModificationSource,
    modificationRef: resolved.modificationRef,
    debug: {
      ...(row?.debug || {}),
      characterModification: {
        source: resolved.characterModificationSource,
        ref: resolved.modificationRef,
        hash: resolved.characterModificationHash
      }
    }
  };
}

function findSpawnIndex(stage, spawnIdOrIndex) {
  if (Number.isInteger(spawnIdOrIndex)) return spawnIdOrIndex;
  return stage.spawns.findIndex((spawn) => spawn.id === String(spawnIdOrIndex));
}

export function setCustomStageSpawnCharacterModification(rawStage, spawnIdOrIndex, modification) {
  const stage = normalizeCustomStage(rawStage);
  const index = findSpawnIndex(stage, spawnIdOrIndex);
  if (index < 0 || index >= stage.spawns.length) {
    const error = new RangeError(`Custom stage spawn row not found: ${String(spawnIdOrIndex)}`);
    error.code = 'custom-stage-spawn-not-found';
    throw error;
  }
  const validation = validateCharacterModification(modification, {
    kind: 'enemy',
    owner: 'custom-stage',
    rejectUnsupportedFields: true,
    source: 'custom-stage-editor'
  });
  if (!validation.valid) {
    const error = new Error(validation.errors.map((item) => item.message).join('; '));
    error.name = 'CharacterModificationValidationError';
    error.validation = validation;
    throw error;
  }
  const normalized = validation.modification;
  const spawns = stage.spawns.map((spawn) => ({ ...spawn }));
  const modifications = { ...(stage.modifications || {}) };
  if (isEmptyCharacterModification(normalized)) {
    delete spawns[index].modificationRef;
  } else {
    const draftRef = `draft-${spawns[index].id}`;
    modifications[draftRef] = normalized;
    spawns[index].modificationRef = draftRef;
  }
  return normalizeCustomStage({ ...stage, spawns, modifications });
}

export function clearCustomStageSpawnCharacterModification(rawStage, spawnIdOrIndex) {
  return setCustomStageSpawnCharacterModification(rawStage, spawnIdOrIndex, null);
}
