import { normalizeCharacterModification } from './CharacterModificationNormalizer.js';
import { isEmptyCharacterModification } from './CharacterModificationSchema.js';

function canonicalValue(value, stack) {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Canonical JSON cannot contain NaN or Infinity.');
    return Object.is(value, -0) ? '0' : JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    if (stack.has(value)) throw new TypeError('Canonical JSON cannot contain cycles.');
    stack.add(value);
    const result = `[${value.map((item) => canonicalValue(item, stack)).join(',')}]`;
    stack.delete(value);
    return result;
  }
  if (typeof value === 'object') {
    if (stack.has(value)) throw new TypeError('Canonical JSON cannot contain cycles.');
    stack.add(value);
    const keys = Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort();
    const result = `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalValue(value[key], stack)}`).join(',')}}`;
    stack.delete(value);
    return result;
  }
  throw new TypeError(`Canonical JSON does not support ${typeof value}.`);
}

export function canonicalStringify(value) {
  return canonicalValue(value, new Set());
}

function fnv1a64(text) {
  let hash = 0xcbf29ce484222325n;
  const bytes = new TextEncoder().encode(text);
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, '0');
}

export function canonicalizeCharacterModification(modification, options = {}) {
  return normalizeCharacterModification(modification, options);
}

export function hashCharacterModification(modification, options = {}) {
  const normalized = canonicalizeCharacterModification(modification, options);
  return `cm-${fnv1a64(canonicalStringify(normalized))}`;
}

export const getCharacterModificationHash = hashCharacterModification;

export function describeCharacterModificationIdentity(modification, options = {}) {
  const normalized = canonicalizeCharacterModification(modification, options);
  const canonical = canonicalStringify(normalized);
  return Object.freeze({
    empty: isEmptyCharacterModification(normalized),
    hash: `cm-${fnv1a64(canonical)}`,
    canonical,
    modification: normalized
  });
}
