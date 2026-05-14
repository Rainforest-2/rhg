import { buildActorIndexFromFiles, loadManifest, comparePackId, validatePngFile, writeJson } from './bcu-semantic-utils.mjs';

function basename(file) {
  return String(file || '').split('/').pop() || '';
}

function isUiIconLikePng(file) {
  const name = basename(file);
  return /^enemy_icon_/i.test(name)
    || /^edi\d+_/i.test(name)
    || /^udi\d+_/i.test(name)
    || /^uni\d+_/i.test(name);
}

function canonicalBodyNames(entry) {
  const id3 = entry.id3 || String(Number(entry.id) || 0).padStart(3, '0');
  if (entry.kind === 'unit') return [`${id3}_${entry.form}.png`];
  if (entry.kind === 'enemy') return [`${id3}_e.png`, `${id3}.png`];
  return [];
}

function findCanonicalBodyImage(entry, candidate) {
  const paths = candidate?.diagnostics?.sourceRawPaths || [];
  const pngs = paths.filter((file) => /\.png$/i.test(file) && !isUiIconLikePng(file));
  const names = canonicalBodyNames(entry).map((name) => name.toLowerCase());
  const exact = pngs.find((file) => names.includes(basename(file).toLowerCase()));
  if (exact) return exact;
  const current = candidate?.files?.image || null;
  if (current && /\.png$/i.test(current) && !isUiIconLikePng(current)) return current;
  return pngs[0] || null;
}

function normalizeActorBodyImages(index) {
  for (const entry of index.entries || []) {
    for (const candidate of entry.sourceCandidates || []) {
      const canonical = findCanonicalBodyImage(entry, candidate);
      if (canonical && candidate.files) candidate.files.image = canonical;
    }
    if (entry.selected?.sourcePack) {
      const replacement = (entry.sourceCandidates || []).find((candidate) => candidate.sourcePack === entry.selected.sourcePack && candidate.status === entry.status)
        || (entry.sourceCandidates || []).find((candidate) => candidate.sourcePack === entry.selected.sourcePack)
        || null;
      if (replacement?.files) entry.selected.files = replacement.files;
    }
  }
}

const manifest = await loadManifest();
const index = buildActorIndexFromFiles(manifest.files);
normalizeActorBodyImages(index);

for (const entry of index.entries || []) {
  if (!entry.selected?.files?.image) continue;
  const current = await validatePngFile(entry.selected.files.image);
  if (current.valid) continue;
  const replacements = [];
  for (const candidate of entry.sourceCandidates || []) {
    const canonical = findCanonicalBodyImage(entry, candidate);
    if (canonical && candidate.files) candidate.files.image = canonical;
    if (!candidate?.files?.image || !['full', 'partial'].includes(candidate.status)) continue;
    const png = await validatePngFile(candidate.files.image);
    if (png.valid) replacements.push({ candidate, png });
  }
  replacements.sort((a, b) => comparePackId(b.candidate.sourcePack, a.candidate.sourcePack));
  const full = replacements.filter((r) => r.candidate.status === 'full');
  const replacement = (full.length ? full : replacements)[0]?.candidate || null;
  if (!replacement) {
    entry.status = 'invalid';
    entry.warnings = [...(entry.warnings || []), `invalid-actor-image:${current.reason}`];
    continue;
  }
  entry.selected = { sourcePack: replacement.sourcePack, files: replacement.files };
  entry.status = replacement.status;
  entry.missing = replacement.missing || [];
  entry.warnings = [...(entry.warnings || []), `remapped-invalid-actor-image:${current.reason}`];
}

for (const entry of index.entries || []) {
  const selectedImage = entry.selected?.files?.image || null;
  if (selectedImage && isUiIconLikePng(selectedImage)) {
    entry.status = 'invalid';
    entry.warnings = [...(entry.warnings || []), `ui-icon-selected-as-actor-image:${basename(selectedImage)}`];
  }
}

await writeJson('public/assets/generated/bcu-actor-index.json', index);
console.log(`wrote bcu-actor-index entries=${index.entries.length}`);
