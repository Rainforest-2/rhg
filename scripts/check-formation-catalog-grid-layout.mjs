import fs from 'node:fs/promises';

const css = await fs.readFile('css/style.css', 'utf8');
const js = await fs.readFile('js/ui/FormationEditor.js', 'utf8');
const perfPatch = await fs.readFile('js/ui/FormationEditorPerformancePatch.js', 'utf8');
const failures = [];

if (!/formation-catalog-scroll/.test(css) || !/overflow-y:\s*auto/.test(css)) failures.push('formation catalog scroll container must own vertical scrolling');
if (!/formation-catalog-grid/.test(css) || !/grid-template-columns:\s*repeat\(auto-fill,\s*minmax\((120|160|168)px,\s*1fr\)\)/.test(css)) failures.push('formation catalog grid must use stable responsive columns');
if (!/formation-catalog-spacer/.test(js)) failures.push('formation catalog must use spacer-based windowing');
if (!/estimateCatalogColumns/.test(js)) failures.push('FormationEditor must estimate catalog columns for virtualization');
if (!/formation-stage-virtual-spacer/.test(perfPatch)) failures.push('stage selector must use spacer-based windowing for large map/stage lists');
if (!/buildScopedDifficultyFilterCandidates/.test(perfPatch)) failures.push('stage selector virtualization must honor scoped difficulty/search filters');
if (!/__FORMATION_RENDER_DEBUG__/.test(js)) failures.push('formation render diagnostics must be gated behind __FORMATION_RENDER_DEBUG__');

if (failures.length) {
  console.error(JSON.stringify({ failures }, null, 2));
  process.exit(1);
}
console.log('formation catalog grid layout check ok');
