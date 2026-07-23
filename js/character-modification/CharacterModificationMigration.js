import {
  CHARACTER_MODIFICATION_SCHEMA_VERSION,
  CUSTOM_STAGE_CHARACTER_MODIFICATION_SCHEMA_VERSION,
  CHARACTER_MODIFICATION_PACK_VERSION,
  isPlainCharacterModificationObject
} from './CharacterModificationSchema.js';
import {
  normalizeCharacterModification
} from './CharacterModificationNormalizer.js';
import {
  ensureCharacterModificationDiagnostics
} from './CharacterModificationDiagnostics.js';

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function cloneJsonValue(value) {
  if (Array.isArray(value)) return value.map(cloneJsonValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneJsonValue(child)]));
}

function migrateUnversionedModification(input, diagnostics) {
  const source = cloneJsonValue(input);
  const migrated = { ...source, schemaVersion: CHARACTER_MODIFICATION_SCHEMA_VERSION };
  if (isPlainCharacterModificationObject(migrated.stats) && hasOwn(migrated.stats, 'hp') && !hasOwn(migrated.stats, 'maxHp')) {
    migrated.stats.maxHp = migrated.stats.hp;
    delete migrated.stats.hp;
    diagnostics.migration(0, 1, 'Renamed legacy stats.hp to stats.maxHp.', {
      path: 'stats.maxHp'
    });
  }
  if (isPlainCharacterModificationObject(migrated.attacks)
      && hasOwn(migrated.attacks, 'damage')
      && !migrated.attacks.hits) {
    migrated.attacks.hits = { 0: { damage: migrated.attacks.damage } };
    delete migrated.attacks.damage;
    diagnostics.migration(0, 1, 'Moved legacy attacks.damage to attacks.hits.0.damage.', {
      path: 'attacks.hits.0.damage'
    });
  }
  diagnostics.migration(0, 1, 'Added CharacterModification schemaVersion 1.');
  return migrated;
}

export function migrateCharacterModification(input, options = {}) {
  const diagnostics = ensureCharacterModificationDiagnostics(options.diagnostics);
  if (!isPlainCharacterModificationObject(input)) {
    diagnostics.error(
      'invalid-modification-object',
      'Character modification migration requires a plain object.'
    );
    return {
      valid: false,
      modification: null,
      ...diagnostics.snapshot()
    };
  }

  const rawVersion = hasOwn(input, 'schemaVersion') ? Number(input.schemaVersion) : 0;
  let migrated;
  if (rawVersion === 0) migrated = migrateUnversionedModification(input, diagnostics);
  else if (rawVersion === CHARACTER_MODIFICATION_SCHEMA_VERSION) {
    migrated = {
      ...cloneJsonValue(input),
      schemaVersion: CHARACTER_MODIFICATION_SCHEMA_VERSION
    };
  }
  else {
    diagnostics.error(
      'unsupported-schema-version',
      `Unsupported character modification schemaVersion: ${input.schemaVersion}`,
      {
        path: 'schemaVersion',
        value: input.schemaVersion,
        expected: CHARACTER_MODIFICATION_SCHEMA_VERSION
      }
    );
    return {
      valid: false,
      modification: null,
      ...diagnostics.snapshot()
    };
  }

  const modification = normalizeCharacterModification(migrated, {
    ...options,
    diagnostics
  });
  const snapshot = diagnostics.snapshot();
  return {
    valid: snapshot.valid,
    modification,
    errors: snapshot.errors,
    warnings: snapshot.warnings,
    migrations: snapshot.migrations,
    diagnostics: snapshot
  };
}

export function migrateCustomStageCharacterModificationSchema(stage, options = {}) {
  const diagnostics = ensureCharacterModificationDiagnostics(options.diagnostics);
  if (!isPlainCharacterModificationObject(stage)) {
    diagnostics.error('invalid-custom-stage', 'Custom stage migration requires a plain object.');
    return { valid: false, stage: null, ...diagnostics.snapshot() };
  }
  const version = Number(stage.schemaVersion || 1);
  if (version > CUSTOM_STAGE_CHARACTER_MODIFICATION_SCHEMA_VERSION || version < 1) {
    diagnostics.error(
      'unsupported-custom-stage-version',
      `Unsupported custom stage schemaVersion: ${stage.schemaVersion}`,
      {
        path: 'stage.schemaVersion',
        value: stage.schemaVersion,
        expected: CUSTOM_STAGE_CHARACTER_MODIFICATION_SCHEMA_VERSION
      }
    );
    return { valid: false, stage: null, ...diagnostics.snapshot() };
  }

  const migrated = cloneJsonValue(stage);
  if (version === 1) {
    migrated.schemaVersion = CUSTOM_STAGE_CHARACTER_MODIFICATION_SCHEMA_VERSION;
    migrated.modifications = {};
    if (Array.isArray(migrated.spawns)) {
      migrated.spawns = migrated.spawns.map((spawn) => {
        const next = { ...(spawn || {}) };
        delete next.modificationRef;
        return next;
      });
    }
    diagnostics.migration(1, 2, 'Added an empty modification table to the custom stage.');
  } else if (!isPlainCharacterModificationObject(migrated.modifications)) {
    migrated.modifications = {};
  }
  migrated.schemaVersion = CUSTOM_STAGE_CHARACTER_MODIFICATION_SCHEMA_VERSION;
  const snapshot = diagnostics.snapshot();
  return {
    valid: snapshot.valid,
    stage: migrated,
    errors: snapshot.errors,
    warnings: snapshot.warnings,
    migrations: snapshot.migrations,
    diagnostics: snapshot
  };
}

export function migrateFormationCharacterModifications(formation, options = {}) {
  const diagnostics = ensureCharacterModificationDiagnostics(options.diagnostics);
  if (!isPlainCharacterModificationObject(formation)) {
    diagnostics.error('invalid-formation', 'Formation migration requires a plain object.');
    return { valid: false, formation: null, ...diagnostics.snapshot() };
  }
  const migrated = cloneJsonValue(formation);
  migrated.options = isPlainCharacterModificationObject(migrated.options) ? migrated.options : {};
  if (!isPlainCharacterModificationObject(migrated.options.characterModifications)) {
    migrated.options.characterModifications = {};
    diagnostics.migration(
      Number(formation.version || 0),
      Number(options.targetVersion || formation.version || 0),
      'Added empty options.characterModifications to the formation.'
    );
  }
  if (Number.isFinite(options.targetVersion)) migrated.version = options.targetVersion;
  const snapshot = diagnostics.snapshot();
  return {
    valid: snapshot.valid,
    formation: migrated,
    errors: snapshot.errors,
    warnings: snapshot.warnings,
    migrations: snapshot.migrations,
    diagnostics: snapshot
  };
}

export function migrateCharacterModificationEnvelope(envelope, options = {}) {
  const diagnostics = ensureCharacterModificationDiagnostics(options.diagnostics);
  if (!isPlainCharacterModificationObject(envelope)) {
    diagnostics.error('invalid-import-envelope', 'Import envelope must be a plain object.');
    return { valid: false, envelope: null, ...diagnostics.snapshot() };
  }
  const migrated = cloneJsonValue(envelope);
  if (migrated.type === 'rhg-custom-stage') {
    if (Number(migrated.version) === 1) {
      migrated.version = CUSTOM_STAGE_CHARACTER_MODIFICATION_SCHEMA_VERSION;
      diagnostics.migration(1, 2, 'Migrated custom stage export envelope from version 1 to version 2.');
    }
    if (Number(migrated.version) !== CUSTOM_STAGE_CHARACTER_MODIFICATION_SCHEMA_VERSION) {
      diagnostics.error('unsupported-export-version', `Unsupported custom stage export version: ${migrated.version}`);
    }
  } else if (migrated.type === 'rhg-character-modification-pack') {
    if (Number(migrated.version) !== CHARACTER_MODIFICATION_PACK_VERSION) {
      diagnostics.error('unsupported-export-version', `Unsupported character modification pack version: ${migrated.version}`);
    }
  } else {
    diagnostics.error('unsupported-export-type', `Unsupported import type: ${String(migrated.type)}`);
  }
  const snapshot = diagnostics.snapshot();
  return {
    valid: snapshot.valid,
    envelope: snapshot.valid ? migrated : null,
    errors: snapshot.errors,
    warnings: snapshot.warnings,
    migrations: snapshot.migrations,
    diagnostics: snapshot
  };
}
