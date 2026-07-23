import {
  CHARACTER_MODIFICATION_FIELD_REGISTRY,
  CHARACTER_MODIFICATION_FIELD_STATUS,
  characterModificationFieldSupports,
  matchCharacterModificationField
} from './CharacterModificationFieldRegistry.js';
import {
  CHARACTER_MODIFICATION_SCHEMA_VERSION,
  isEmptyCharacterModification,
  isPlainCharacterModificationObject
} from './CharacterModificationSchema.js';
import {
  ensureCharacterModificationDiagnostics
} from './CharacterModificationDiagnostics.js';

const SKIP = Symbol('character-modification-skip');
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const NUMERIC_STRING = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

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

function setOwnPath(target, path, value) {
  const parts = pathParts(path);
  let cursor = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index];
    if (!hasOwn(cursor, part)) cursor[part] = {};
    cursor = cursor[part];
  }
  cursor[parts[parts.length - 1]] = value;
}

function patternCouldContain(path, pattern) {
  const actual = pathParts(path);
  const expected = pathParts(pattern);
  if (actual.length > expected.length) return false;
  for (let index = 0; index < actual.length; index += 1) {
    if (expected[index] !== '*' && expected[index] !== actual[index]) return false;
  }
  return true;
}

function scanUnknownPaths(value, path, diagnostics) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  for (const key of Object.keys(value)) {
    const nextPath = path ? `${path}.${key}` : key;
    if (nextPath === 'schemaVersion') continue;
    const matched = matchCharacterModificationField(nextPath);
    if (matched) {
      if (matched.entry.value?.type === 'object' && isPlainCharacterModificationObject(value[key])) {
        const known = matched.entry.value.fields || {};
        for (const childKey of Object.keys(value[key])) {
          if (hasOwn(known, childKey)) continue;
          diagnostics.warning(
            'unknown-field-dropped',
            `Unknown character modification field was dropped: ${nextPath}.${childKey}`,
            { path: `${nextPath}.${childKey}` }
          );
        }
      }
      continue;
    }
    const couldContain = CHARACTER_MODIFICATION_FIELD_REGISTRY.some((entry) => patternCouldContain(nextPath, entry.id));
    if (couldContain) {
      scanUnknownPaths(value[key], nextPath, diagnostics);
      continue;
    }
    diagnostics.warning(
      'unknown-field-dropped',
      `Unknown character modification field was dropped: ${nextPath}`,
      { path: nextPath }
    );
  }
}

function normalizeNumber(value, descriptor, options) {
  let normalized = value;
  if (typeof normalized === 'string' && options.allowNumericStrings !== false && NUMERIC_STRING.test(normalized.trim())) {
    normalized = Number(normalized);
  }
  if (typeof normalized !== 'number' || !Number.isFinite(normalized)) return normalized;
  if (Object.is(normalized, -0)) normalized = 0;
  if (descriptor.integer) normalized = Math.trunc(normalized);
  if (descriptor.omitDefault && normalized === descriptor.default) return SKIP;
  return normalized;
}

function normalizeDescriptor(value, descriptor, path, diagnostics, options) {
  if (!descriptor || descriptor.type === 'unknown') return value;
  if (descriptor.type === 'number') return normalizeNumber(value, descriptor, options);
  if (descriptor.type === 'boolean') {
    if (descriptor.omitDefault && value === descriptor.default) return SKIP;
    return value;
  }
  if (descriptor.type === 'enum') {
    if (descriptor.omitDefault && value === descriptor.default) return SKIP;
    return value;
  }
  if (descriptor.type === 'array') {
    if (!Array.isArray(value)) return value;
    const normalized = [];
    const seen = new Set();
    for (let index = 0; index < value.length; index += 1) {
      const item = normalizeDescriptor(value[index], descriptor.item, `${path}.${index}`, diagnostics, options);
      if (item === SKIP) continue;
      const identity = typeof item === 'string' ? item : JSON.stringify(item);
      if (descriptor.unique && seen.has(identity)) continue;
      seen.add(identity);
      normalized.push(item);
    }
    if (descriptor.orderInsensitive) normalized.sort((left, right) => String(left).localeCompare(String(right)));
    if (normalized.length === 0 && descriptor.preserveEmpty !== true) return SKIP;
    return normalized;
  }
  if (descriptor.type !== 'object') return value;
  if (!isPlainCharacterModificationObject(value)) return value;

  const fields = descriptor.fields || {};
  const normalized = {};
  for (const [key, childDescriptor] of Object.entries(fields)) {
    if (!hasOwn(value, key)) continue;
    if (Array.isArray(childDescriptor.requiredFor)
        && !childDescriptor.requiredFor.includes(value.type)) {
      continue;
    }
    const child = normalizeDescriptor(value[key], childDescriptor, `${path}.${key}`, diagnostics, options);
    if (child !== SKIP && child !== undefined && child !== null) normalized[key] = child;
  }

  if (hasOwn(normalized, 'enabled') && normalized.enabled === false) return { enabled: false };
  const disableField = descriptor.disableWhenZero;
  if (disableField && Number(normalized[disableField]) === 0) return { enabled: false };
  if (Object.keys(normalized).length === 0) return SKIP;
  return normalized;
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

function pruneSparse(value, path = '') {
  if (Array.isArray(value)) {
    if (value.length === 0 && path !== 'traits') return SKIP;
    return value;
  }
  if (!isPlainCharacterModificationObject(value)) return value;
  const out = {};
  for (const [key, child] of Object.entries(value)) {
    if (child === undefined || child === null) continue;
    const childPath = path ? `${path}.${key}` : key;
    const normalized = pruneSparse(child, childPath);
    if (normalized !== SKIP) out[key] = normalized;
  }
  if (Object.keys(out).length === 0) return SKIP;
  return out;
}

export function normalizeCharacterModification(input, options = {}) {
  const diagnostics = ensureCharacterModificationDiagnostics(options.diagnostics);
  const source = isPlainCharacterModificationObject(input) ? input : {};
  const output = {
    schemaVersion: hasOwn(source, 'schemaVersion')
      ? source.schemaVersion
      : CHARACTER_MODIFICATION_SCHEMA_VERSION
  };

  if (!isPlainCharacterModificationObject(input) && input != null) {
    diagnostics.error(
      'invalid-modification-object',
      'Character modification must be a plain object.',
      { path: '' }
    );
  }

  scanUnknownPaths(source, '', diagnostics);

  for (const registryEntry of CHARACTER_MODIFICATION_FIELD_REGISTRY) {
    const paths = concreteWildcardPaths(source, registryEntry.id);
    for (const concretePath of paths) {
      const raw = getOwnPath(source, concretePath);
      if (!raw.exists) continue;

      if (registryEntry.status !== CHARACTER_MODIFICATION_FIELD_STATUS.EDITABLE) {
        diagnostics.warning(
          'unsupported-field-dropped',
          `Unsupported character modification field was dropped: ${concretePath}`,
          {
            path: concretePath,
            registryId: registryEntry.id,
            reason: registryEntry.unsupportedReason || 'not-editable'
          }
        );
        continue;
      }
      if (!characterModificationFieldSupports(registryEntry, options.kind, options.owner)) {
        const method = options.rejectUnsupportedFields === true ? 'error' : 'warning';
        diagnostics[method](
          'unsupported-kind-field-dropped',
          `Character modification field is not supported for this owner/context: ${concretePath}`,
          {
            path: concretePath,
            kind: options.kind,
            owner: options.owner || null,
            registryId: registryEntry.id
          }
        );
        continue;
      }

      const wildcard = registryEntry.id.includes('*')
        ? concretePath.split('.')[registryEntry.id.split('.').indexOf('*')]
        : null;
      if (wildcard != null && (!/^\d+$/.test(wildcard) || Number(wildcard) < 0 || Number(wildcard) > 2)) {
        diagnostics.warning(
          'invalid-hit-index-dropped',
          `Attack hit index must be between 0 and 2: ${concretePath}`,
          { path: concretePath, hitIndex: wildcard }
        );
        continue;
      }

      const normalized = normalizeDescriptor(raw.value, registryEntry.value, concretePath, diagnostics, options);
      if (normalized !== SKIP && normalized !== undefined && normalized !== null) {
        setOwnPath(output, concretePath, normalized);
      }
    }
  }

  const explicitHitCount = Number(output.attacks?.hitCount);
  const normalHitCount = Array.isArray(options.normalStats?.attackHits)
    ? options.normalStats.attackHits.length
    : Number(options.normalStats?.attackCount || 0);
  const effectiveHitCount = Number.isInteger(explicitHitCount)
    ? explicitHitCount
    : (Number.isInteger(normalHitCount) && normalHitCount > 0 ? normalHitCount : null);
  if (effectiveHitCount != null && isPlainCharacterModificationObject(output.attacks?.hits)) {
    for (const hitKey of Object.keys(output.attacks.hits)) {
      if (Number(hitKey) < effectiveHitCount) continue;
      delete output.attacks.hits[hitKey];
      diagnostics.warning(
        'nonexistent-hit-dropped',
        `Attack hit ${hitKey} was removed because hitCount is ${effectiveHitCount}.`,
        { path: `attacks.hits.${hitKey}`, hitIndex: Number(hitKey), hitCount: effectiveHitCount }
      );
    }
  }

  const sparse = pruneSparse(output) || { schemaVersion: CHARACTER_MODIFICATION_SCHEMA_VERSION };
  if (!hasOwn(sparse, 'schemaVersion')) sparse.schemaVersion = CHARACTER_MODIFICATION_SCHEMA_VERSION;
  const snapshot = diagnostics.snapshot();
  if (options.withDiagnostics === true) {
    return {
      modification: sparse,
      diagnostics: snapshot,
      errors: snapshot.errors,
      warnings: snapshot.warnings
    };
  }
  return sparse;
}

export function normalizeCharacterModificationWithDiagnostics(input, options = {}) {
  return normalizeCharacterModification(input, { ...options, withDiagnostics: true });
}

export { isEmptyCharacterModification };
