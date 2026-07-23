export const CHARACTER_MODIFICATION_DIAGNOSTIC_LEVEL = Object.freeze({
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
});

function freezeEntry(level, code, message, detail = {}) {
  return Object.freeze({
    level,
    code: String(code || 'unknown'),
    message: String(message || code || 'Character modification diagnostic'),
    path: detail.path == null ? null : String(detail.path),
    ...detail
  });
}

export class CharacterModificationDiagnostics {
  constructor(seed = null) {
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.migrations = [];
    if (seed) this.merge(seed);
  }

  error(code, message, detail = {}) {
    const entry = freezeEntry(CHARACTER_MODIFICATION_DIAGNOSTIC_LEVEL.ERROR, code, message, detail);
    this.errors.push(entry);
    return entry;
  }

  warning(code, message, detail = {}) {
    const entry = freezeEntry(CHARACTER_MODIFICATION_DIAGNOSTIC_LEVEL.WARNING, code, message, detail);
    this.warnings.push(entry);
    return entry;
  }

  note(code, message, detail = {}) {
    const entry = freezeEntry(CHARACTER_MODIFICATION_DIAGNOSTIC_LEVEL.INFO, code, message, detail);
    this.info.push(entry);
    return entry;
  }

  migration(fromVersion, toVersion, message, detail = {}) {
    const entry = Object.freeze({
      fromVersion,
      toVersion,
      message: String(message || `Migrated ${fromVersion} to ${toVersion}`),
      ...detail
    });
    this.migrations.push(entry);
    return entry;
  }

  merge(other) {
    if (!other) return this;
    const source = typeof other.snapshot === 'function' ? other.snapshot() : other;
    for (const key of ['errors', 'warnings', 'info', 'migrations']) {
      if (Array.isArray(source?.[key])) this[key].push(...source[key]);
    }
    return this;
  }

  get valid() {
    return this.errors.length === 0;
  }

  snapshot() {
    return Object.freeze({
      valid: this.valid,
      errors: Object.freeze(this.errors.slice()),
      warnings: Object.freeze(this.warnings.slice()),
      info: Object.freeze(this.info.slice()),
      migrations: Object.freeze(this.migrations.slice())
    });
  }
}

export function ensureCharacterModificationDiagnostics(value = null) {
  return value instanceof CharacterModificationDiagnostics
    ? value
    : new CharacterModificationDiagnostics(value);
}
