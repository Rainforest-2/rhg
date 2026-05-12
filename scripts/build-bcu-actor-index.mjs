import { buildActorIndexFromFiles, loadManifest, comparePackId, validatePngFile, writeJson } from './bcu-semantic-utils.mjs';
const manifest = await loadManifest();
const index = buildActorIndexFromFiles(manifest.files);
for (const entry of index.entries || []) {
  if (!entry.selected?.files?.image) continue;
  const current = await validatePngFile(entry.selected.files.image);
  if (current.valid) continue;
  const replacements = [];
  for (const candidate of entry.sourceCandidates || []) {
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
await writeJson('public/assets/generated/bcu-actor-index.json', index);
console.log(`wrote bcu-actor-index entries=${index.entries.length}`);
