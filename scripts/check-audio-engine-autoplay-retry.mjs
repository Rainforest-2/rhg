import assert from 'node:assert/strict';

const listeners = new Map();
globalThis.window = {
  addEventListener(type, handler, options) {
    if (!listeners.has(type)) listeners.set(type, []);
    listeners.get(type).push({ handler, options });
  },
  removeEventListener(type, handler) {
    listeners.set(type, (listeners.get(type) || []).filter((entry) => entry.handler !== handler));
  }
};

const infoCalls = [];
const originalInfo = console.info;
console.info = (...args) => { infoCalls.push(args); };

class FakeAudio {
  constructor() {
    this.dataset = {};
    this.paused = true;
    this.ended = true;
    this.currentTime = 0;
    this.volume = 1;
    this.playCount = 0;
    this.rejectNext = false;
  }

  getAttribute(name) {
    if (name === 'src') return this.src || '';
    return '';
  }

  play() {
    this.playCount += 1;
    if (this.rejectNext) {
      this.rejectNext = false;
      this.paused = true;
      const error = new Error('blocked by autoplay policy');
      error.name = 'NotAllowedError';
      return Promise.reject(error);
    }
    this.paused = false;
    this.ended = false;
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
  }

  load() {}
}

globalThis.Audio = FakeAudio;

try {
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
      return [`/assets/music/${String(id).padStart(3, '0')}.m4a`];
    },
    load: async () => {}
  };

  const engine = new AudioEngine({ audio, catalog });
  const bgmEl = engine._ensureBgmEl();
  bgmEl.rejectNext = true;

  assert.equal(await engine.playBgm(3), false, 'autoplay-blocked BGM start reports pending');
  assert.deepEqual(infoCalls, [], 'autoplay-blocked BGM start must not write a console info line');
  assert.equal(engine.lastBgmStartDebug?.id, 3, 'blocked start leaves compact diagnostic id');
  assert.equal(engine.lastBgmStartDebug?.status, 'blocked', 'blocked start leaves compact diagnostic status');
  assert.equal(engine._wantedBgmId, 3, 'blocked track remains wanted for retry');
  assert.equal(bgmEl.paused, true, 'blocked element remains paused before user gesture');

  const entries = listeners.get('pointerdown') || [];
  assert.ok(entries.length > 0, 'gesture retry listener is bound');
  assert.ok(entries.every((entry) => entry.options?.capture === true), 'gesture retry listener is capture-phase');
  assert.ok((listeners.get('click') || []).length > 0, 'click gesture retry listener is bound');
  for (const { handler } of entries) handler();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(bgmEl.paused, false, 'next user gesture retries and starts wanted BGM');
  assert.equal(engine._bgmId, 3, 'retry keeps the wanted track id');
  assert.equal(engine.lastBgmStartDebug?.status, 'playing', 'successful retry updates BGM diagnostic');
} finally {
  console.info = originalInfo;
}

console.log('check-audio-engine-autoplay-retry: OK');
