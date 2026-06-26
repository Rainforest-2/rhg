import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync('js/preview/PreviewRenderer.js', 'utf8');

assert.match(src, /const DEFAULT_MAX_CANVAS_DPR = 2;/, 'PreviewRenderer must cap battle canvas DPR for high-density mobile screens');
assert.match(src, /function getCanvasPixelRatio\(\)/, 'PreviewRenderer must centralize render DPR selection');
assert.match(src, /Math\.min\(Number\.isFinite\(raw\) \? raw : 1, cap\)/, 'PreviewRenderer must clamp raw devicePixelRatio to the configured cap');
assert.match(src, /this\.hasResizeObserver = false;/, 'PreviewRenderer must track ResizeObserver availability');
assert.match(src, /this\.hasResizeObserver = true;/, 'PreviewRenderer must prefer ResizeObserver when available');
assert.match(src, /if \(this\.hasResizeObserver\) return;/, 'PreviewRenderer.ensureCanvasSize must not read layout every animation frame when ResizeObserver is active');
assert.match(src, /this\.ensureCheckIntervalMs = 250;/, 'PreviewRenderer fallback size polling must be throttled');
assert.doesNotMatch(src, /const dpr = window\.devicePixelRatio \|\| 1;/, 'PreviewRenderer must not use uncapped raw devicePixelRatio for backing canvas size');

console.log('check-preview-renderer-performance-guards: OK');
