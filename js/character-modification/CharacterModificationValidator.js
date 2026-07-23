import {
  CHARACTER_MODIFICATION_FIELD_REGISTRY,
  CHARACTER_MODIFICATION_FIELD_STATUS,
  characterModificationFieldSupports
} from './CharacterModificationFieldRegistry.js';
import {
  CHARACTER_MODIFICATION_SCHEMA_VERSION,
  isPlainCharacterModificationObject
} from './CharacterModificationSchema.js';
import {
  normalizeCharacterModificationWithDiagnostics
} from './CharacterModificationNormalizer.js';
import {
  ensureCharacterModificationDiagnostics
} from './CharacterModificationDiagnostics.js';

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function pathParts(path) {
  return String(path || '').split('.').filter(Boolean);
}

function getOwnPath(source, path) {
  let value = source;
  for (const part of pathParts(path)) {
    if (!value || typeof value !== 'object' || !hasOwn(value, part)) return { exists: false, value: undefined };
    value = value[part];
  }
  return { exists: true, value };
}

function concreteWildcardPaths(source, pattern) {
  const parts = pathParts(pattern);
  const wildcardIndex = parts.indexOf('*');
  if (wildcardIndex < 0) return [pattern];
  const parent = getOwnPath(source, parts.slice(0, wildcardIndex).join('.'));
  if (!parent.exists || !isPlainCharacterModificationObject(parent.value)) return [];
  return Object.keys(parent.value).map((key) => {
    const concrete = parts.slice();
    concrete[wildcardIndex] = key;
    return concrete.join('.');
  });
}

function addTypeError(diagnostics, path, expected, value) {
  diagnostics.error(
    'invalid-field-type',
    `${path} must be ${expected}.`,
    { path, expected, actualType: Array.isArray(value) ? 'array' : typeof value }
  );
}

function validateDescriptor(value, descriptor, path, diagnostics, parent = null) {
  if (!descriptor || descriptor.type === 'unknown') return;
  if (descriptor.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      addTypeError(diagnostics, path, descriptor.integer ? 'a finite integer' : 'a finite number', value);
      return;
    }
    if (descriptor.integer && !Number.isInteger(value)) {
      diagnostics.error('non-integer-field', `${path} must be an integer.`, { path, value });
    }
    if (Number.isFinite(descriptor.min) && value < descriptor.min) {
      diagnostics.error('field-below-minimum', `${path} must be at least ${descriptor.min}.`, {
        path,
        value,
        min: descriptor.min
      });
    }
    if (Number.isFinite(descriptor.max) && value > descriptor.max) {
      diagnostics.error('field-above-maximum', `${path} must be at most ${descriptor.max}.`, {
        path,
        value,
        max: descriptor.max
      });
    }
    return;
  }
  if (descriptor.type === 'boolean') {
    if (typeof value !== 'boolean') addTypeError(diagnostics, path, 'a boolean', value);
    return;
  }
  if (descriptor.type === 'enum') {
    if (!descriptor.values?.includes(value)) {
      diagnostics.error('invalid-enum-value', `${path} has an unsupported value.`, {
        path,
        value,
        allowed: descriptor.values || []
      });
    }
    return;
  }
  if (descriptor.type === 'array') {
    if (!Array.isArray(value)) {
      addTypeError(diagnostics, path, 'an array', value);
      return;
    }
    if (Number.isFinite(descriptor.maxItems) && value.length > descriptor.maxItems) {
      diagnostics.error('too-many-array-items', `${path} has too many items.`, {
        path,
        count: value.length,
        maxItems: descriptor.maxItems
      });
    }
    const seen = new Set();
    value.forEach((item, index) => {
      validateDescriptor(item, descriptor.item, `${path}.${index}`, diagnostics, value);
      if (!descriptor.unique) return;
      const key = typeof item === 'string' ? item : JSON.stringify(item);
      if (seen.has(key)) {
        diagnostics.error('duplicate-array-item', `${path} contains a duplicate value.`, {
          path: `${path}.${index}`,
          value: item
        });
      }
      seen.add(key);
    });
    return;
  }
  if (descriptor.type !== 'object') return;
  if (!isPlainCharacterModificationObject(value)) {
    addTypeError(diagnostics, path, 'a plain object', value);
    return;
  }

  const enabled = value.enabled === true;
  for (const [key, fieldDescriptor] of Object.entries(descriptor.fields || {})) {
    const requiredFor = Array.isArray(fieldDescriptor.requiredFor)
      && fieldDescriptor.requiredFor.includes(value.type);
    const required = fieldDescriptor.required === true
      || (enabled && fieldDescriptor.requiredWhenEnabled === true)
      || requiredFor;
    if (!hasOwn(value, key)) {
      if (required && !hasOwn(fieldDescriptor, 'default')) {
        diagnostics.error('missing-required-field', `${path}.${key} is required.`, {
          path: `${path}.${key}`,
          parentPath: path
        });
      }
      continue;
    }
    validateDescriptor(value[key], fieldDescriptor, `${path}.${key}`, diagnostics, value);
  }

  if (hasOwn(value, 'enabled') && value.enabled === false && Object.keys(value).some((key) => key !== 'enabled')) {
    diagnostics.error(
      'disabled-field-has-parameters',
      `${path} must not retain parameters while disabled.`,
      { path }
    );
  }
  if (value.type === 'ld' && Number.isFinite(value.start) && Number.isFinite(value.end) && value.end <= value.start) {
    diagnostics.error('invalid-ld-range', `${path}.end must be greater than start for LD.`, {
      path,
      start: value.start,
      end: value.end
    });
  }
  if (value.type === 'omni' && Number.isFinite(value.start) && Number.isFinite(value.end) && value.end >= value.start) {
    diagnostics.error('invalid-omni-range', `${path}.end must be less than start for omni.`, {
      path,
      start: value.start,
      end: value.end
    });
  }
  if (!hasOwn(value, 'type')
      && Number.isFinite(value.start)
      && Number.isFinite(value.end)
      && value.end < value.start) {
    diagnostics.error('invalid-effect-range', `${path}.end must not be less than start.`, {
      path,
      start: value.start,
      end: value.end
    });
  }
}

function validateAssetReference(dependency, value, diagnostics, path, options) {
  const targetKind = value?.[dependency.targetKindField];
  const targetId = value?.[dependency.targetField];
  if (!['unit', 'enemy'].includes(targetKind) || !Number.isInteger(targetId)) return;
  const resolvers = options.resolvers || {};
  const resolver = options.resolveSummonTarget
    || resolvers[dependency.resolver]
    || resolvers[targetKind]
    || resolvers.character;
  if (typeof resolver !== 'function') {
    const method = options.requireResolvedReferences === true ? 'error' : 'warning';
    diagnostics[method](
      options.requireResolvedReferences === true
        ? 'summon-target-resolver-required'
        : 'summon-target-unverified',
      `${path}.${dependency.targetField} could not be checked against the ${targetKind} asset catalog.`,
      {
        path: `${path}.${dependency.targetField}`,
        targetKind,
        targetId
      }
    );
    return;
  }

  let resolved;
  try {
    resolved = resolver(targetId, {
      kind: targetKind,
      form: value?.[dependency.formField] ?? 1,
      value,
      path
    });
  } catch (error) {
    diagnostics.error(
      'summon-target-resolution-failed',
      `${path}.${dependency.targetField} could not be resolved.`,
      {
        path: `${path}.${dependency.targetField}`,
        targetKind,
        targetId,
        error: String(error?.message || error)
      }
    );
    return;
  }
  if (resolved && typeof resolved.then === 'function') {
    diagnostics.error(
      'async-summon-target-resolver',
      'Character modification validation requires a synchronous summon target resolver.',
      { path: `${path}.${dependency.targetField}`, targetKind, targetId }
    );
    return;
  }
  if (!resolved) {
    diagnostics.error(
      'unresolved-summon-target',
      `${path}.${dependency.targetField} does not resolve to a ${targetKind} asset.`,
      { path: `${path}.${dependency.targetField}`, targetKind, targetId }
    );
  }
}

function validateEntryRelationships(entry, value, diagnostics, path) {
  if (entry.id !== 'summon' || value?.enabled !== true) return;
  const minDistance = Number(value.minDistance ?? 0);
  const maxDistance = Number(value.maxDistance ?? 0);
  if (Number.isFinite(minDistance) && Number.isFinite(maxDistance) && maxDistance < minDistance) {
    diagnostics.error(
      'invalid-summon-distance-range',
      `${path}.maxDistance must not be less than minDistance.`,
      { path: `${path}.maxDistance`, minDistance, maxDistance }
    );
  }
  const hasMinLayer = hasOwn(value, 'minLayer');
  const hasMaxLayer = hasOwn(value, 'maxLayer');
  if (hasMinLayer !== hasMaxLayer) {
    diagnostics.error(
      'incomplete-summon-layer-range',
      `${path}.minLayer and maxLayer must be set together.`,
      { path, minLayer: value.minLayer ?? -1, maxLayer: value.maxLayer ?? -1 }
    );
  } else if (hasMinLayer
      && Number.isFinite(value.minLayer)
      && Number.isFinite(value.maxLayer)
      && value.maxLayer < value.minLayer) {
    diagnostics.error(
      'invalid-summon-layer-range',
      `${path}.maxLayer must not be less than minLayer.`,
      { path: `${path}.maxLayer`, minLayer: value.minLayer, maxLayer: value.maxLayer }
    );
  }
  if (value.onHit === true && value.onKill === true) {
    diagnostics.error(
      'conflicting-summon-trigger',
      `${path} cannot enable both onHit and onKill.`,
      { path }
    );
  }
}

function validateDependencies(entry, value, modification, diagnostics, path, options) {
  if (!value || value.enabled !== true) return;
  for (const dependency of entry.dependencies || []) {
    if (dependency.kind === 'assetReference') {
      validateAssetReference(dependency, value, diagnostics, path, options);
      continue;
    }
    const dependencyValue = getOwnPath(modification, dependency.field);
    const satisfied = dependency.includes == null
      || (Array.isArray(dependencyValue.value) && dependencyValue.value.includes(dependency.includes));
    if (satisfied) continue;
    const method = dependency.severity === 'error' ? 'error' : 'warning';
    diagnostics[method](
      'field-dependency-not-met',
      `${path} is enabled without ${dependency.field} including ${dependency.includes}.`,
      {
        path,
        dependencyField: dependency.field,
        expectedValue: dependency.includes
      }
    );
  }
}

function validateAttackHitTiming(modification, normalStats, diagnostics) {
  const modifiedHits = modification?.attacks?.hits;
  const hitCountChanged = hasOwn(modification?.attacks || {}, 'hitCount');
  const timingChanged = isPlainCharacterModificationObject(modifiedHits)
    && Object.values(modifiedHits).some((hit) => isPlainCharacterModificationObject(hit) && hasOwn(hit, 'preFrames'));
  if (!hitCountChanged && !timingChanged) return;

  const normalHits = Array.isArray(normalStats?.attackHits) ? normalStats.attackHits : [];
  const modifiedKeys = isPlainCharacterModificationObject(modifiedHits)
    ? Object.keys(modifiedHits).map(Number).filter(Number.isInteger)
    : [];
  const explicitCount = Number(modification?.attacks?.hitCount);
  const hitCount = Number.isInteger(explicitCount)
    ? explicitCount
    : Math.max(normalHits.length, modifiedKeys.length ? Math.max(...modifiedKeys) + 1 : 0);
  let previousFrame = null;
  let previousIndex = null;
  for (let index = 0; index < hitCount; index += 1) {
    const override = modifiedHits?.[index]?.preFrames;
    const normal = normalHits[index]?.preFramesAbsolute ?? normalHits[index]?.preFrames;
    const generatedSafeValue = normalStats && index >= normalHits.length ? 0 : undefined;
    const currentFrame = Number.isFinite(override)
      ? override
      : (Number.isFinite(normal) ? normal : generatedSafeValue);
    if (!Number.isFinite(currentFrame)) continue;
    if (Number.isFinite(previousFrame) && currentFrame < previousFrame) {
      diagnostics.error(
        'non-monotonic-attack-hit-timing',
        `attacks.hits.${index}.preFrames must be at least the previous hit frame ${previousFrame}.`,
        {
          path: `attacks.hits.${index}.preFrames`,
          hitIndex: index,
          value: currentFrame,
          previousHitIndex: previousIndex,
          previousValue: previousFrame
        }
      );
    }
    previousFrame = currentFrame;
    previousIndex = index;
  }
}

function isEnabledConflictValue(value) {
  if (value && typeof value === 'object') return value.enabled === true;
  return value === true;
}

function resolveConflictPath(entry, concretePath, conflictPattern) {
  if (!String(conflictPattern).includes('*')) return conflictPattern;
  const entryParts = pathParts(entry.id);
  const concreteParts = pathParts(concretePath);
  const wildcardIndex = entryParts.indexOf('*');
  const wildcard = wildcardIndex >= 0 ? concreteParts[wildcardIndex] : null;
  return wildcard == null ? conflictPattern : conflictPattern.replace('*', wildcard);
}

function validateMutuallyExclusiveFields(modification, diagnostics) {
  const reported = new Set();
  for (const entry of CHARACTER_MODIFICATION_FIELD_REGISTRY) {
    if (!entry.conflicts?.length) continue;
    for (const concretePath of concreteWildcardPaths(modification, entry.id)) {
      const current = getOwnPath(modification, concretePath);
      if (!current.exists || !isEnabledConflictValue(current.value)) continue;
      for (const conflictPattern of entry.conflicts) {
        const conflictPath = resolveConflictPath(entry, concretePath, conflictPattern);
        const conflict = getOwnPath(modification, conflictPath);
        if (!conflict.exists || !isEnabledConflictValue(conflict.value)) continue;
        const pair = [concretePath, conflictPath].sort();
        const key = pair.join('\u0000');
        if (reported.has(key)) continue;
        reported.add(key);
        diagnostics.error(
          'mutually-exclusive-fields',
          `${pair[0]} and ${pair[1]} cannot both be enabled.`,
          { path: concretePath, fields: pair }
        );
      }
    }
  }
}

export function countCharacterModificationFields(modification) {
  let count = 0;
  for (const entry of CHARACTER_MODIFICATION_FIELD_REGISTRY) {
    for (const concretePath of concreteWildcardPaths(modification, entry.id)) {
      if (getOwnPath(modification, concretePath).exists) count += 1;
    }
  }
  return count;
}

export function validateCharacterModification(input, options = {}) {
  const diagnostics = ensureCharacterModificationDiagnostics(options.diagnostics);
  const normalizedResult = normalizeCharacterModificationWithDiagnostics(input, {
    ...options,
    diagnostics
  });
  const modification = normalizedResult.modification;

  if (modification.schemaVersion !== CHARACTER_MODIFICATION_SCHEMA_VERSION) {
    diagnostics.error(
      'unsupported-schema-version',
      `Character modification schemaVersion must be ${CHARACTER_MODIFICATION_SCHEMA_VERSION}.`,
      {
        path: 'schemaVersion',
        value: modification.schemaVersion,
        expected: CHARACTER_MODIFICATION_SCHEMA_VERSION
      }
    );
  }

  for (const entry of CHARACTER_MODIFICATION_FIELD_REGISTRY) {
    for (const concretePath of concreteWildcardPaths(modification, entry.id)) {
      const current = getOwnPath(modification, concretePath);
      if (!current.exists) continue;
      if (entry.status !== CHARACTER_MODIFICATION_FIELD_STATUS.EDITABLE) {
        diagnostics.warning(
          'unsupported-field',
          `${concretePath} is not editable and will not reach runtime.`,
          { path: concretePath, reason: entry.unsupportedReason || 'not-editable' }
        );
        continue;
      }
      if (!characterModificationFieldSupports(entry, options.kind, options.owner)) {
        diagnostics.warning(
          'unsupported-kind-field',
          `${concretePath} is not supported for this owner/context.`,
          { path: concretePath, kind: options.kind, owner: options.owner || null }
        );
        continue;
      }
      validateDescriptor(current.value, entry.value, concretePath, diagnostics);
      validateEntryRelationships(entry, current.value, diagnostics, concretePath);
      validateDependencies(entry, current.value, modification, diagnostics, concretePath, options);
    }
  }

  validateMutuallyExclusiveFields(modification, diagnostics);
  validateAttackHitTiming(modification, options.normalStats, diagnostics);

  if (modification.attacks?.hits && Object.keys(modification.attacks.hits).length === 0) {
    diagnostics.error('attack-has-no-hits', 'An attacks.hits object must contain at least one hit.', {
      path: 'attacks.hits'
    });
  }

  const snapshot = diagnostics.snapshot();
  return {
    valid: snapshot.valid,
    modification,
    normalized: modification,
    fieldCount: countCharacterModificationFields(modification),
    errors: snapshot.errors,
    warnings: snapshot.warnings,
    diagnostics: snapshot
  };
}

export function assertValidCharacterModification(input, options = {}) {
  const result = validateCharacterModification(input, options);
  if (!result.valid) {
    const error = new Error(result.errors.map((item) => item.message).join('; '));
    error.name = 'CharacterModificationValidationError';
    error.validation = result;
    throw error;
  }
  return result.modification;
}
