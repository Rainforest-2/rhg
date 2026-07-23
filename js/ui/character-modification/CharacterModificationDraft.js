const BLOCKED_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const DEFAULT_SCHEMA_VERSION = 1;
const DEFAULT_HISTORY_LIMIT = 100;

function isPlainObject(value) {
  if (!value || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function cloneCharacterModificationValue(value, depth = 0, seen = new WeakMap()) {
  if (value && typeof value === 'object' && seen.has(value)) return seen.get(value);
  if (depth > 20) throw new RangeError('Character modification draft exceeds the supported depth');
  if (Array.isArray(value)) {
    const out = [];
    seen.set(value, out);
    for (const entry of value) out.push(cloneCharacterModificationValue(entry, depth + 1, seen));
    return out;
  }
  if (!isPlainObject(value)) return value;
  const out = {};
  seen.set(value, out);
  for (const [key, entry] of Object.entries(value)) {
    if (BLOCKED_KEYS.has(key)) continue;
    out[key] = cloneCharacterModificationValue(entry, depth + 1, seen);
  }
  return out;
}

function stableSerialize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  const keys = Object.keys(value).filter((key) => !BLOCKED_KEYS.has(key)).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(',')}}`;
}

function registryValues(registry) {
  if (!registry) return [];
  if (Array.isArray(registry)) return registry;
  if (registry instanceof Map) return [...registry.values()];
  if (typeof registry.getCharacterModificationFields === 'function') {
    return registry.getCharacterModificationFields() || [];
  }
  if (typeof registry.getFields === 'function') return registry.getFields() || [];
  if (Array.isArray(registry.fields)) return registry.fields;
  if (registry.fields instanceof Map) return [...registry.fields.values()];
  if (Array.isArray(registry.entries)) return registry.entries;
  return [];
}

function getNormalAttackHitCount(normalValues, modification, fields) {
  const normalCount = Array.isArray(normalValues?.attackHits)
    ? normalValues.attackHits.length
    : Number(normalValues?.attackCount || 0);
  const modifiedCount = Number(modification?.attacks?.hitCount || 0);
  const hitCountDescriptor = fields.find((field) => field.id === 'attacks.hitCount')?.value;
  const min = Number.isFinite(hitCountDescriptor?.min) ? hitCountDescriptor.min : 1;
  const max = Number.isFinite(hitCountDescriptor?.max) ? hitCountDescriptor.max : Math.max(min, normalCount || 1);
  return Math.max(min, Math.min(max, Math.trunc(modifiedCount || normalCount || min)));
}

function expandRegistryFields(fields, normalValues, modification) {
  const hitCount = getNormalAttackHitCount(normalValues, modification, fields);
  const expanded = [];
  for (const field of fields) {
    if (!field.id.includes('*')) {
      expanded.push(field);
      continue;
    }
    for (let hitIndex = 0; hitIndex < hitCount; hitIndex += 1) {
      expanded.push(Object.freeze({
        ...field,
        id: field.id.replace('*', String(hitIndex)),
        registryId: field.registryId || field.id,
        params: Object.freeze({ ...(field.params || {}), wildcard: String(hitIndex), hitIndex })
      }));
    }
  }
  return expanded;
}

export function getCharacterModificationRegistryFields(registry, { subjectKind = null, owner = null, includeHidden = false } = {}) {
  return registryValues(registry).filter((field) => {
    if (!field || typeof field.id !== 'string' || !field.id.trim()) return false;
    if (!includeHidden && getCharacterModificationFieldStatus(field) === 'hidden') return false;
    return characterModificationFieldSupports(field, subjectKind, owner);
  });
}

export function getCharacterModificationFieldStatus(field) {
  if (!field) return 'hidden';
  if (field.status) return field.status;
  if (field.unsupported === true) return 'unsupported';
  if (field.readOnly === true || field.editable === false) return 'readOnly';
  return 'editable';
}

export function characterModificationFieldSupports(field, subjectKind, owner = null) {
  const support = field?.support ?? field?.supports;
  const supportsKind = typeof support === 'function'
    ? support(subjectKind, owner) !== false
    : !subjectKind || !Array.isArray(support) || support.length === 0 || support.includes(subjectKind);
  const owners = field?.owners ?? field?.owner;
  const supportsOwner = !owner
    || !Array.isArray(owners)
    || owners.length === 0
    || owners.includes(owner);
  return supportsKind && supportsOwner;
}

function cleanPath(path) {
  const parts = Array.isArray(path) ? path : String(path || '').split('.');
  if (!parts.length || parts.some((part) => !part || BLOCKED_KEYS.has(String(part)))) return null;
  return parts.map(String);
}

export function getCharacterModificationFieldPath(field) {
  return cleanPath(field?.path ?? field?.modificationPath ?? field?.id);
}

export function readCharacterModificationPath(source, path) {
  const parts = cleanPath(path);
  if (!parts) return undefined;
  let value = source;
  for (const part of parts) {
    if (value == null || typeof value !== 'object' || !Object.prototype.hasOwnProperty.call(value, part)) return undefined;
    value = value[part];
  }
  return value;
}

function pruneEmptyParents(root, parts) {
  for (let length = parts.length - 1; length > 0; length -= 1) {
    const parentPath = parts.slice(0, length);
    const key = parts[length - 1];
    const parent = readCharacterModificationPath(root, parentPath.slice(0, -1));
    const container = parentPath.length === 1 ? root : parent;
    const value = container?.[key];
    if (!isPlainObject(value) || Object.keys(value).length > 0) break;
    delete container[key];
  }
  return root;
}

export function writeCharacterModificationPath(source, path, value) {
  const parts = cleanPath(path);
  if (!parts) throw new TypeError('Character modification field path is invalid');
  const root = isPlainObject(source) ? cloneCharacterModificationValue(source) : {};
  let cursor = root;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    const current = cursor[key];
    cursor[key] = isPlainObject(current) ? cloneCharacterModificationValue(current) : {};
    cursor = cursor[key];
  }
  const leaf = parts.at(-1);
  if (value === undefined) {
    delete cursor[leaf];
    return pruneEmptyParents(root, parts);
  }
  cursor[leaf] = cloneCharacterModificationValue(value);
  return root;
}

function modificationResult(result, fallback) {
  if (isPlainObject(result?.modification)) return result.modification;
  if (isPlainObject(result?.normalized)) return result.normalized;
  if (isPlainObject(result?.value)) return result.value;
  return isPlainObject(result) ? result : fallback;
}

function diagnosticsResult(result) {
  const source = result && typeof result === 'object' ? result : {};
  const errors = Array.isArray(source.errors) ? source.errors : [];
  const warnings = Array.isArray(source.warnings) ? source.warnings : [];
  return {
    ok: source.ok !== false && source.valid !== false && errors.length === 0,
    errors,
    warnings,
    diagnostics: Array.isArray(source.diagnostics) ? source.diagnostics : []
  };
}

function createEmptyModification(schemaVersion = DEFAULT_SCHEMA_VERSION) {
  return { schemaVersion: Number.isInteger(schemaVersion) && schemaVersion > 0 ? schemaVersion : DEFAULT_SCHEMA_VERSION };
}

function normalizeModification(normalize, input, context) {
  const fallback = cloneCharacterModificationValue(input);
  if (typeof normalize !== 'function') return fallback;
  const result = normalize(fallback, { ...context, withDiagnostics: true });
  return cloneCharacterModificationValue(modificationResult(result, fallback));
}

function findCaseInsensitive(source, key) {
  if (!source || typeof source !== 'object') return undefined;
  if (Object.prototype.hasOwnProperty.call(source, key)) return source[key];
  const wanted = String(key || '').toLowerCase();
  const match = Object.keys(source).find((candidate) => candidate.toLowerCase() === wanted);
  return match == null ? undefined : source[match];
}

function resolveProcNormalValue(field, normalValues) {
  const apply = field?.apply || {};
  const runtimeKey = apply.runtimeKey;
  const procSources = [
    normalValues?.procs,
    normalValues?.bcuProc,
    normalValues?.bcuCombatModel?.proc,
    normalValues?.abilities?.proc
  ];
  let raw;
  for (const source of procSources) {
    raw = findCaseInsensitive(source, runtimeKey);
    if (raw !== undefined) break;
  }
  if (raw === undefined || raw === null || raw === false) return { enabled: false };
  if (raw === true) return { enabled: true };
  if (typeof raw !== 'object') return { enabled: !!raw };
  const enabledUiField = apply.normalEnabledField || field?.value?.disableWhenZero || null;
  const enabledRuntimeField = apply.normalEnabledRuntimeField
    || apply.runtimeFields?.[enabledUiField]
    || enabledUiField;
  const enabledRaw = enabledRuntimeField
    ? findCaseInsensitive(raw, enabledRuntimeField)
    : undefined;
  const enabled = raw.enabled !== undefined
    ? raw.enabled !== false
    : enabledRaw !== undefined
      ? (typeof enabledRaw === 'boolean' ? enabledRaw : Number(enabledRaw) !== 0)
      : Object.keys(raw).length > 0;
  const out = { enabled };
  for (const [uiKey, runtimeField] of Object.entries(apply.runtimeFields || {})) {
    const value = findCaseInsensitive(raw, runtimeField);
    if (value !== undefined) out[uiKey] = value;
    else if (Object.prototype.hasOwnProperty.call(apply.runtimeDefaults || {}, uiKey)) {
      out[uiKey] = apply.runtimeDefaults[uiKey];
    }
  }
  for (const key of Object.keys(field?.value?.fields || {})) {
    if (key === 'enabled' || Object.prototype.hasOwnProperty.call(out, key)) continue;
    const value = findCaseInsensitive(raw, key);
    if (value !== undefined) out[key] = value;
  }
  return out;
}

function resolveAttackRangeNormalValue(hit, normalValues) {
  if (!hit || typeof hit !== 'object') return undefined;
  if (hit.range && typeof hit.range === 'object') return hit.range;
  const detectionRange = Number(normalValues?.detectionRange ?? normalValues?.range ?? 0);
  const start = Number(hit.ldStartRaw ?? hit.shortPointRaw ?? 0);
  const length = Number(hit.ldRangeRaw ?? 0);
  if (hit.isOmni) return { type: 'omni', start, end: start + length };
  if (hit.isLd) return { type: 'ld', start, end: start + length };
  return { type: 'normal', start: 0, end: detectionRange };
}

function resolveNormalValue(field, normalValues, context) {
  const reader = field?.getOriginalValue || field?.getNormalValue || field?.readNormal;
  if (typeof reader === 'function') {
    return reader(normalValues, context);
  }
  const apply = field?.apply || {};
  const hitIndex = Number(field?.params?.hitIndex);
  const hit = Number.isInteger(hitIndex) ? normalValues?.attackHits?.[hitIndex] : null;
  if (apply.kind === 'stat') {
    for (const runtimeKey of apply.runtimeKeys || []) {
      if (normalValues?.[runtimeKey] !== undefined) return normalValues[runtimeKey];
    }
  }
  if (apply.kind === 'production') {
    const runtimeKey = apply.runtimeKey;
    const production = normalValues?.production || {};
    const candidates = runtimeKey === 'cost'
      ? [production.deployCost, production.cost, normalValues?.deployCost, normalValues?.price, normalValues?.cost, normalValues?.costOrReward]
      : runtimeKey === 'respawnFrames'
        ? [production.respawnFrames, normalValues?.respawnFrames]
        : [production[runtimeKey], normalValues?.[runtimeKey]];
    return candidates.find((value) => value !== undefined);
  }
  if (apply.kind === 'attackCount') {
    return Number.isFinite(normalValues?.attackCount)
      ? normalValues.attackCount
      : Array.isArray(normalValues?.attackHits) ? normalValues.attackHits.length : undefined;
  }
  if (apply.kind === 'targetMode') {
    if (normalValues?.attacks?.targetMode != null) return normalValues.attacks.targetMode;
    if (normalValues?.targetMode != null) return normalValues.targetMode;
    if (normalValues?.isRange != null) return normalValues.isRange ? 'area' : 'single';
  }
  if (apply.kind === 'allowBaseHit') return normalValues?.allowBaseHit ?? true;
  if (apply.kind === 'attackHitTargetMode') {
    if (hit?.targetMode != null) return hit.targetMode === 'range' ? 'area' : hit.targetMode;
    return normalValues?.isRange ? 'area' : 'single';
  }
  if (apply.kind === 'attackHitAllowBaseHit') {
    return hit?.allowBaseHit ?? normalValues?.allowBaseHit ?? true;
  }
  if (apply.kind === 'attackHitAbilityFlag') {
    return hit?.characterModificationAbilityFlags?.[apply.runtimeKey]
      ?? normalValues?.bcuCombatModel?.ability?.flags?.[apply.runtimeKey]
      ?? normalValues?.bcuAbilityFlags?.[apply.runtimeKey]
      ?? false;
  }
  if (apply.kind === 'attackHitProc') {
    const hitProc = hit?.bcuProcIsComplete === true
      ? (hit?.bcuProc || {})
      : {
        ...(normalValues?.bcuCombatModel?.proc || normalValues?.bcuProc || {}),
        ...(hit?.bcuProc || hit?.proc || {})
      };
    return resolveProcNormalValue(field, {
      ...normalValues,
      bcuProc: hitProc,
      bcuCombatModel: {
        ...(normalValues?.bcuCombatModel || {}),
        proc: hitProc
      }
    });
  }
  if (apply.kind === 'attackHit' && hit) return hit[apply.runtimeKey];
  if (apply.kind === 'attackRange') return resolveAttackRangeNormalValue(hit, normalValues);
  if (apply.kind === 'traits') return normalValues?.traits;
  if (apply.kind === 'abilityFlag') {
    const sources = [
      normalValues?.abilityFlags,
      normalValues?.bcuAbilityFlags,
      normalValues?.abilities?.flags,
      normalValues?.abilityModel?.flags
    ];
    for (const source of sources) {
      const value = findCaseInsensitive(source, apply.runtimeKey);
      if (value !== undefined) return !!value;
    }
    return false;
  }
  if (apply.kind === 'proc') return resolveProcNormalValue(field, normalValues);
  const path = field?.normalPath ?? field?.runtimePath ?? getCharacterModificationFieldPath(field);
  const shaped = readCharacterModificationPath(normalValues, path);
  if (shaped !== undefined) return shaped;
  return readCharacterModificationPath(normalValues, getCharacterModificationFieldPath(field));
}

function descriptorPart(field, partId) {
  const fields = field?.value?.fields ?? field?.fields;
  if (Array.isArray(fields)) return fields.find((part) => part?.id === partId) || null;
  if (fields && typeof fields === 'object') {
    const entry = fields[partId];
    return entry ? { id: partId, ...entry } : null;
  }
  return null;
}

function pruneInactiveDescriptorParts(field, value) {
  if (!isPlainObject(value)) return value;
  const fields = field?.value?.fields ?? field?.fields;
  const parts = Array.isArray(fields)
    ? fields
    : fields && typeof fields === 'object'
      ? Object.entries(fields).map(([id, descriptor]) => ({ id, ...descriptor }))
      : [];
  const next = cloneCharacterModificationValue(value);
  for (const part of parts) {
    if (!Array.isArray(part?.requiredFor) || part.requiredFor.includes(next.type)) continue;
    delete next[part.id];
  }
  return next;
}

export class CharacterModificationDraft {
  constructor({
    modification = {},
    normalValues = {},
    registry,
    subjectKind = 'unit',
    normalize = null,
    validate = null,
    hash = null,
    historyLimit = DEFAULT_HISTORY_LIMIT,
    context = {}
  } = {}) {
    if (!registry) throw new TypeError('CharacterModificationDraft requires a field registry');
    this.registry = registry;
    this.subjectKind = subjectKind === 'enemy' ? 'enemy' : 'unit';
    this.normalValues = cloneCharacterModificationValue(normalValues);
    this.normalizeFn = normalize;
    this.validateFn = validate;
    this.hashFn = hash;
    this.context = {
      ...context,
      kind: this.subjectKind,
      subjectKind: this.subjectKind,
      registry,
      normalStats: this.normalValues,
      normalValues: this.normalValues,
      requireResolvedReferences: true
    };
    this.owner = context.owner || null;
    this.historyLimit = Math.max(1, Math.trunc(Number(historyLimit) || DEFAULT_HISTORY_LIMIT));
    this.baseFields = getCharacterModificationRegistryFields(registry, {
      subjectKind: this.subjectKind,
      owner: this.owner
    });
    const schemaVersion = Number(modification?.schemaVersion) || DEFAULT_SCHEMA_VERSION;
    const initial = isPlainObject(modification) ? modification : createEmptyModification(schemaVersion);
    this.current = normalizeModification(this.normalizeFn, initial, this.context);
    if (!Number.isInteger(this.current.schemaVersion)) this.current.schemaVersion = schemaVersion;
    this.refreshRegistryFields();
    this.baseline = cloneCharacterModificationValue(this.current);
    this.past = [];
    this.future = [];
    this.revision = 0;
    this.hashCache = { revision: -1, value: null };
    this.listeners = new Set();
    this.lastValidation = this.validate();
  }

  refreshRegistryFields() {
    this.fields = expandRegistryFields(this.baseFields, this.normalValues, this.current);
    this.fieldMap = new Map(this.fields.map((field) => [field.id, field]));
  }

  getField(fieldId) {
    return this.fieldMap.get(String(fieldId || '')) || null;
  }

  getFieldValue(fieldId) {
    const field = this.getField(fieldId);
    return field ? readCharacterModificationPath(this.current, getCharacterModificationFieldPath(field)) : undefined;
  }

  getOriginalValue(fieldId) {
    const field = this.getField(fieldId);
    return field ? cloneCharacterModificationValue(resolveNormalValue(field, this.normalValues, this.context)) : undefined;
  }

  getEffectiveValue(fieldId) {
    const override = this.getFieldValue(fieldId);
    return override === undefined ? this.getOriginalValue(fieldId) : cloneCharacterModificationValue(override);
  }

  isFieldChanged(fieldId) {
    return this.getFieldValue(fieldId) !== undefined;
  }

  getChangedFieldIds() {
    return this.fields.filter((field) => this.isFieldChanged(field.id)).map((field) => field.id);
  }

  getChangedCount() {
    return this.getChangedFieldIds().length;
  }

  isDirty() {
    return stableSerialize(this.current) !== stableSerialize(this.baseline);
  }

  canUndo() {
    return this.past.length > 0;
  }

  canRedo() {
    return this.future.length > 0;
  }

  subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(change) {
    const event = { ...change, revision: this.revision, snapshot: this.getSnapshot({ includeValidation: false }) };
    for (const listener of this.listeners) {
      try { listener(event); } catch {}
    }
  }

  commit(next, change) {
    const normalized = normalizeModification(this.normalizeFn, next, this.context);
    if (stableSerialize(normalized) === stableSerialize(this.current)) return false;
    this.past.push(cloneCharacterModificationValue(this.current));
    if (this.past.length > this.historyLimit) this.past.shift();
    this.current = normalized;
    this.refreshRegistryFields();
    this.future = [];
    this.revision += 1;
    this.lastValidation = this.validate();
    this.notify(change);
    return true;
  }

  assertEditable(fieldId) {
    const field = this.getField(fieldId);
    if (!field) throw new RangeError(`Unknown character modification field: ${fieldId}`);
    const status = getCharacterModificationFieldStatus(field);
    if (status !== 'editable') throw new TypeError(`Character modification field is ${status}: ${fieldId}`);
    if (!characterModificationFieldSupports(field, this.subjectKind, this.owner)) {
      throw new TypeError(`Character modification field does not support ${this.subjectKind}/${this.owner || 'any-owner'}: ${fieldId}`);
    }
    return field;
  }

  setField(fieldId, value) {
    const field = this.assertEditable(fieldId);
    const next = writeCharacterModificationPath(this.current, getCharacterModificationFieldPath(field), value);
    return this.commit(next, { type: 'set-field', fieldId: field.id });
  }

  setFieldPart(fieldId, partId, value) {
    const field = this.assertEditable(fieldId);
    const part = descriptorPart(field, String(partId || ''));
    if (!part) throw new RangeError(`Unknown character modification field part: ${fieldId}.${partId}`);
    const basePath = getCharacterModificationFieldPath(field);
    const partPath = cleanPath(part.path ?? part.id);
    if (!basePath || !partPath) throw new TypeError(`Character modification field part path is invalid: ${fieldId}.${partId}`);
    let next = this.current;
    const currentGroup = readCharacterModificationPath(this.current, basePath);
    if (currentGroup === undefined) {
      const effective = this.getEffectiveValue(fieldId);
      if (isPlainObject(effective)) {
        next = writeCharacterModificationPath(
          next,
          basePath,
          pruneInactiveDescriptorParts(field, effective)
        );
      }
    }
    next = writeCharacterModificationPath(next, [...basePath, ...partPath], value);
    const nextGroup = readCharacterModificationPath(next, basePath);
    if (isPlainObject(nextGroup)) {
      next = writeCharacterModificationPath(
        next,
        basePath,
        pruneInactiveDescriptorParts(field, nextGroup)
      );
    }
    return this.commit(next, { type: 'set-field-part', fieldId: field.id, partId: part.id });
  }

  resetField(fieldId) {
    const field = this.getField(fieldId);
    if (!field || !this.isFieldChanged(field.id)) return false;
    const next = writeCharacterModificationPath(this.current, getCharacterModificationFieldPath(field), undefined);
    return this.commit(next, { type: 'reset-field', fieldId: field.id });
  }

  resetCategory(categoryId) {
    const ids = this.fields.filter((field) => field.category === categoryId && this.isFieldChanged(field.id)).map((field) => field.id);
    if (!ids.length) return false;
    let next = this.current;
    for (const fieldId of ids) {
      next = writeCharacterModificationPath(next, getCharacterModificationFieldPath(this.fieldMap.get(fieldId)), undefined);
    }
    return this.commit(next, { type: 'reset-category', categoryId, fieldIds: ids });
  }

  resetAll() {
    if (this.getChangedCount() === 0) return false;
    const next = createEmptyModification(this.current.schemaVersion ?? this.baseline.schemaVersion);
    return this.commit(next, { type: 'reset-all', fieldIds: this.getChangedFieldIds() });
  }

  replaceModification(modification, { source = 'replace' } = {}) {
    const schemaVersion = Number(modification?.schemaVersion) || this.current.schemaVersion || DEFAULT_SCHEMA_VERSION;
    const next = isPlainObject(modification) ? modification : createEmptyModification(schemaVersion);
    return this.commit(next, { type: 'replace', source });
  }

  undo() {
    if (!this.past.length) return false;
    this.future.push(cloneCharacterModificationValue(this.current));
    this.current = this.past.pop();
    this.refreshRegistryFields();
    this.revision += 1;
    this.lastValidation = this.validate();
    this.notify({ type: 'undo' });
    return true;
  }

  redo() {
    if (!this.future.length) return false;
    this.past.push(cloneCharacterModificationValue(this.current));
    this.current = this.future.pop();
    this.refreshRegistryFields();
    this.revision += 1;
    this.lastValidation = this.validate();
    this.notify({ type: 'redo' });
    return true;
  }

  validate() {
    if (typeof this.validateFn !== 'function') return { ok: true, errors: [], warnings: [], diagnostics: [] };
    try {
      return diagnosticsResult(this.validateFn(cloneCharacterModificationValue(this.current), this.context));
    } catch (error) {
      return {
        ok: false,
        errors: [{ field: null, code: 'ui-validator-error', message: String(error?.message || error) }],
        warnings: [],
        diagnostics: []
      };
    }
  }

  getNormalizedModification() {
    return normalizeModification(this.normalizeFn, this.current, this.context);
  }

  getHash() {
    if (typeof this.hashFn !== 'function') return null;
    if (this.hashCache.revision === this.revision) return this.hashCache.value;
    const value = this.hashFn(this.getNormalizedModification(), this.context);
    this.hashCache = { revision: this.revision, value };
    return value;
  }

  markCommitted() {
    const previousRevision = this.revision;
    this.baseline = cloneCharacterModificationValue(this.current);
    this.past = [];
    this.future = [];
    this.revision += 1;
    if (this.hashCache.revision === previousRevision) {
      this.hashCache = { revision: this.revision, value: this.hashCache.value };
    }
    this.notify({ type: 'mark-committed' });
  }

  getSnapshot({ includeValidation = true } = {}) {
    return {
      modification: cloneCharacterModificationValue(this.current),
      normalizedModification: this.getNormalizedModification(),
      normalValues: cloneCharacterModificationValue(this.normalValues),
      changedFieldIds: this.getChangedFieldIds(),
      changedCount: this.getChangedCount(),
      dirty: this.isDirty(),
      revision: this.revision,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      validation: includeValidation ? (this.lastValidation || this.validate()) : null
    };
  }
}

export function createCharacterModificationDraft(options = {}) {
  return new CharacterModificationDraft(options);
}
