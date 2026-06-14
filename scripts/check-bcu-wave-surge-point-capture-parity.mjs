// Locks wave/surge/blast horizontal target capture to BCU point semantics.
//
// BCU StageBasis.inRange tests AbEntity.pos as a single point (left <= pos <= right)
// and does NOT widen the band by the target's half width. The surge and blast runtimes
// were corrected to this; wave previously inflated the band by half the target width,
// which both over-hit wide entities and mis-counted wave stoppers. This guard fails if
// any of the three runtimes reintroduce a half-width expansion in their range predicate.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const HALF_WIDTH_EXPANSION = /\(\s*p\s*[+-]\s*half\s*\)/;

const files = [
  ['js/battle/BattleWaveRuntimePatch.js', 'wave'],
  ['js/battle/BattleSurgeRuntimePatch.js', 'surge']
];

for (const [file, label] of files) {
  const text = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(
    text,
    HALF_WIDTH_EXPANSION,
    `${label} target capture must not expand the range by target half width (BCU StageBasis.inRange is point capture)`
  );
  assert.match(
    text,
    /return\s+p\s*>=\s*lo\s*&&\s*p\s*<=\s*hi;/,
    `${label} target capture must use point predicate p >= lo && p <= hi`
  );
}

// Blast uses the same point predicate inside a range list helper.
const blast = fs.readFileSync('js/battle/BattleBlastRuntimePatch.js', 'utf8');
assert.match(
  blast,
  /p\s*>=\s*Math\.min\(lo,\s*hi\)\s*&&\s*p\s*<=\s*Math\.max\(lo,\s*hi\)/,
  'blast target capture must use point predicate against each range'
);

console.log('check-bcu-wave-surge-point-capture-parity: OK');
