import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [home, preview, html] = await Promise.all([
  readFile(new URL('../js/community/CommunityHomeController.js', import.meta.url), 'utf8'),
  readFile(new URL('../js/preview/PreviewApp.js', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8')
]);
assert.match(home, /browseAvailable = browseAvailable === true && false/);
assert.match(home, /community-home__title', 'BWS'/);
assert.match(home, /browseButton\.disabled = true/);
assert.match(home, /textContent = text/);
assert.doesNotMatch(home, /\.innerHTML\s*=/);
assert.match(preview, /enterLegacyPlay\(\)/);
assert.match(preview, /showCommunityHome\(\)/);
assert.match(preview, /if \(this\._legacyPlayStarted\) return/);
assert.match(preview, /if \(this\._renderLoopStarted\) return/);
assert.match(html, /community-home\.css/);
assert.ok(html.indexOf('community-home.css') < html.indexOf('nyanko-premium-polish.css'));
console.log('check-community-home-shell: OK');
