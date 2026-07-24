import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const guideDir = new URL('../docs/agent/community-stage/', import.meta.url);

const phases = [
  ['phase-3-cloudflare-foundation.md', ['# Phase 3', 'COMMUNITY_DB', 'COMMUNITY_BLOBS', '0001_users_sessions.sql', 'preview', 'production']],
  ['phase-4-auth.md', ['# Phase 4', 'PBKDF2-SHA-256', 'X-RHG-CSRF', 'Turnstile', 'last active admin', 'Terra用プロンプト']],
  ['phase-5-canonical-publish-import.md', ['# Phase 5', 'SHA-256', 'canonical', 'Idempotency-Key', 'R2 / D1 partial failure', 'CustomStage']],
  ['phase-6-browse.md', ['# Phase 6', '1page最大50件', '2-gram', '3-gram', 'clear_rate_ppm', 'back/forward']],
  ['phase-7-social.md', ['# Phase 7', '同一transaction', '5秒', '1日100件', 'admin-hidden', 'Idempotency-Key']],
  ['phase-8-stats.md', ['# Phase 8', 'logic frame', 'finish-before-start', 'IndexedDB', '30日', '35日', 'clear_rate_ppm']],
  ['phase-9-restrictions.md', ['# Phase 9', 'effectiveLevel = baseLevel + plusLevel', 'will + 1', 'ProductionRuntime.validateRequest', 'combo', '全10slot']],
  ['phase-10-fallback-admin.md', ['# Phase 10', 'current.json', 'previous 2', 'physical delete', 'admin_audit', 'rollback']],
  ['phase-11-acceptance.md', ['# Phase 11', 'G1 repository hygiene', 'G11 documentation/operations', 'Critical/High', 'iPad', 'rollback']]
];

const commonHeadings = [
  '## 0. Phaseの目的',
  '## 1. 開始条件',
  '非目標',
  'Test matrix',
  '完了条件',
  'Terra用プロンプト'
];

const index = await readFile(new URL('README.md', guideDir), 'utf8');
for (const [file] of phases) {
  assert.match(index, new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `community guide index must link ${file}`);
}
for (const required of ['正規情報源と優先順位', '絶対不変条件', 'Terra共通実行手順', '停止・Solへ昇格する条件', '完了報告フォーマット']) {
  assert.ok(index.includes(required), `community guide index missing ${required}`);
}

const allTexts = [index];
for (const [file, tokens] of phases) {
  const text = await readFile(new URL(file, guideDir), 'utf8');
  allTexts.push(text);
  for (const heading of commonHeadings) {
    assert.ok(text.toLowerCase().includes(heading.toLowerCase()), `${file} missing ${heading}`);
  }
  for (const token of tokens) {
    assert.ok(text.includes(token), `${file} missing contract token: ${token}`);
  }
  assert.doesNotMatch(text, /\b(?:TODO|TBD|FIXME|CHANGEME)\b/i, `${file} contains unfinished marker`);
  assert.doesNotMatch(text, /(?:sk-[A-Za-z0-9_-]{16,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/, `${file} appears to contain a secret`);
}

const docsIndex = await readFile(new URL('docs/README.md', root), 'utf8');
const agentIndex = await readFile(new URL('docs/agent/README.md', root), 'utf8');
assert.match(docsIndex, /agent\/community-stage\/README\.md/);
assert.match(docsIndex, /RHG_COMMUNITY_STAGE_PLATFORM_COMPLETE_DESIGN_2026-07-24_FINAL\.md/);
assert.match(agentIndex, /community-stage\/README\.md/);

const corpus = allTexts.join('\n');
for (const invariant of [
  'online payloadを直接`BattleScene`へ渡',
  'boot/import/wrapper順',
  'silent fallback',
  'feature flag OFF',
  'git diff自己レビュー'
]) {
  assert.ok(corpus.includes(invariant), `guide corpus missing cross-phase invariant: ${invariant}`);
}

console.log(`check-community-agent-guides: OK (${phases.length} phase guides + index)`);
