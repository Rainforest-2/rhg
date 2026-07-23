import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('CI retains character-modification visual diagnostics on failure', () => {
  const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
  const browserContract = readFileSync(
    'tests/character-modification-design-browser.test.mjs',
    'utf8'
  );
  assert.match(workflow, /set -o pipefail/);
  assert.match(workflow, /tee tmp\/character-modification-ui\/verify\.log/);
  assert.match(workflow, /if-no-files-found: error/);
  assert.match(browserContract, /status-editor-formation-design\.png/);
  assert.match(browserContract, /status-editor-custom-stage-design\.png/);
  assert.match(browserContract, /status-editor-custom-stage-keyboard-design\.png/);
});
