import assert from 'node:assert/strict';

class FakeAudio {
  constructor() {
    this.dataset = {};
    this.paused = true;
    this.ended = true;
    this.currentTime = 0;
    this.volume = 1;
    this.playCount = 0;
  }

  getAttribute(name) {
    if (name === 'src') return this.src || '';
    return '';
  }

  play() {
    this.paused = false;
    this.ended = false;
    this.playCount += 1;
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
  }

  load() {}
}

globalThis.Audio = FakeAudio;

const { AudioEngine } = await import('../js/audio/AudioEngine.js');

const audio = {
  getEffectiveBgmVolume: () => 0.7,
  getEffectiveSeVolume: () => 0.8,
  subscribe: () => () => {}
};

const catalog = {
  normalizeId(id) {
    const n = Math.trunc(Number(id));
    return Number.isFinite(n) ? n : null;
  },
  resolveUrls(id) {
    return [`/assets/music/${id}.m4a`];
  },
  load: async () => {}
};

function totalSePlays(engine) {
  return engine._sePool.reduce((sum, el) => sum + (el.playCount || 0), 0);
}

{
  const engine = new AudioEngine({ audio, catalog });
  let now = 1000;
  engine._now = () => now;

  for (let i = 0; i < 20; i += 1) {
    now += 1;
    assert.equal(engine.playSe(20), true, `rapid same-id SE request ${i + 1} still plays`);
  }

  assert.equal(totalSePlays(engine), 20, 'rapid same-id SE requests must not be suppressed');
  assert.ok(engine._sePool.length > 12, 'dense overlap grows beyond the initial SE pool instead of stealing immediately');
  assert.equal(engine.lastSeVoiceDebug.mode, 'expanded');
}

{
  const engine = new AudioEngine({ audio, catalog });
  let now = 5000;
  engine._now = () => now;

  for (let id = 0; id < 32; id += 1) {
    now += 1;
    assert.equal(engine.playSe(id), true, `distinct burst SE ${id} still plays`);
  }

  assert.equal(totalSePlays(engine), 32, 'distinct burst SE requests must all reach HTMLAudio');
  assert.equal(engine._sePool.length, 32, 'SE pool grows up to the configured maximum');

  now += 1;
  assert.equal(engine.playSe(99), true, 'above the growth cap, playSe still plays by reusing the oldest voice');
  assert.equal(totalSePlays(engine), 33, 'oldest-voice reuse must still call play()');
  assert.equal(engine.lastSeVoiceDebug.mode, 'stolen-oldest');
}

console.log('check-audio-engine-se-pool-growth: OK');
