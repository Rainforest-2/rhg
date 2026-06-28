import fs from 'node:fs/promises';

const src = await fs.readFile('js/ui/FormationEditor.js', 'utf8');
const tuningSrc = await fs.readFile('js/ui/FormationEditorBcuUnitLevelPatch.js', 'utf8');
const failures = [];

const requireText = (needle, message) => { if (!src.includes(needle)) failures.push(message); };
const requireTuningText = (needle, message) => { if (!tuningSrc.includes(needle)) failures.push(message); };

requireText('resolveSelectedSlotIconsImmediately(provider)', 'selected slot icons must be loaded immediately');
requireText('resolveVisibleCatalogIconsImmediately(provider)', 'visible catalog icons must be eagerly enqueued after virtual render');
requireText('primeFormationIconLoads()', 'current formation icons must be prewarmed before the editor is shown');
requireTuningText('resolveTuningOverlayIcons(editor, overlay)', 'tuning overlay icons must be queued during the opening render');
requireTuningText('primeTuningIconFromResolvedImage(editor, img)', 'tuning overlay should reuse an already resolved icon before paint');
requireText('__FORMATION_ICON_DEBUG__', 'formation icon debug global is missing');
requireText('recentIconFailures', 'formation icon failure history is missing');
requireText('waitForImageReady', 'images must be marked resolved only after load/decode');
requireText('this.iconWork.delete(key)', 'failed icon promises must be removed so re-render can retry');

if (/rootMargin:\s*['"]160px['"]/.test(src)) failures.push('IntersectionObserver rootMargin is still the old 160px');
if (/overscanRows:\s*3\b/.test(src) && !/dynamicOverscanRows/.test(src)) failures.push('overscan is still fixed at 3 rows without viewport-derived overscan');
if (!/rootMargin:\s*['"]600px 0px 900px 0px['"]/.test(src)) failures.push('IntersectionObserver rootMargin must be larger than the old small margin');
if (!/Math\.max\(8,\s*Math\.ceil\(\(\(scroller\.clientHeight/.test(src)) failures.push('catalog overscan must be at least 8 rows or roughly two viewport heights');
if (!/img\.dataset\.iconResolved = '1'/.test(src) || !/await this\.waitForImageReady\(img\)/.test(src)) failures.push('resolved marker must be set after image readiness');
if (!/delete img\.dataset\.iconPending/.test(src)) failures.push('iconPending must clear after completion/failure');

if (failures.length) {
  console.error(JSON.stringify({ failures }, null, 2));
  process.exit(1);
}
console.log('formation virtual icon loading check ok');
