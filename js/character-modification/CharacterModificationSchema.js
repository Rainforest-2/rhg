import {
  CHARACTER_MODIFICATION_FIELD_REGISTRY,
  getCharacterModificationRootKeys
} from './CharacterModificationFieldRegistry.js';

export const CHARACTER_MODIFICATION_SCHEMA_VERSION = 1;
export const CUSTOM_STAGE_CHARACTER_MODIFICATION_SCHEMA_VERSION = 3;
export const CHARACTER_MODIFICATION_PACK_VERSION = 1;

export const CHARACTER_MODIFICATION_IMPORT_LIMITS = Object.freeze({
  maxBytes: 5 * 1024 * 1024,
  maxDepth: 12,
  // General JSON arrays may contain a sparse hit/proc structure; stage-specific arrays retain
  // their stricter 1,000-row limits in the custom-stage validator.
  maxArrayLength: 5000,
  maxStringLength: 64 * 1024,
  maxSpawns: 1000,
  maxModifications: 500,
  maxObjectKeys: 10_000
});

export const CHARACTER_MODIFICATION_FORBIDDEN_KEYS = Object.freeze([
  '__proto__',
  'prototype',
  'constructor'
]);

export const CHARACTER_MODIFICATION_ROOT_KEYS = getCharacterModificationRootKeys();

export const CHARACTER_MODIFICATION_SCHEMA = Object.freeze({
  title: 'RHG CharacterModification',
  schemaVersion: CHARACTER_MODIFICATION_SCHEMA_VERSION,
  required: Object.freeze(['schemaVersion']),
  optionalRootKeys: CHARACTER_MODIFICATION_ROOT_KEYS,
  sparse: true,
  additionalProperties: false,
  fieldRegistry: CHARACTER_MODIFICATION_FIELD_REGISTRY
});

export function isPlainCharacterModificationObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function createEmptyCharacterModification() {
  return { schemaVersion: CHARACTER_MODIFICATION_SCHEMA_VERSION };
}

export function isEmptyCharacterModification(value) {
  if (!isPlainCharacterModificationObject(value)) return true;
  return Object.keys(value).every((key) => key === 'schemaVersion');
}

export function getCharacterModificationSchema() {
  return CHARACTER_MODIFICATION_SCHEMA;
}
