// Battle sound effects that have no downloadable BCU sample and so are
// synthesized through the AudioEngine's SE bus (volume slider + mute apply).
//
// Zombie Killer: the BCU/Battle-Cats reference states the ability has no unique
// sprite — "発動時は特有の効果音が鳴る" (a distinctive sound effect plays when it
// triggers); the visual is just the zombie's normal death soul. So the missing
// "Zombie Killer effect" is this sting, played the moment a zombie killer denies
// a zombie's revive. The project blocks raw bcu assets at runtime and bcu-assets
// ships no standalone SE file, so this is synthesized rather than fetched.

import { audioEngine } from './AudioEngine.js';

// A short, distinctive "soul shatter" sting: a bright noise burst shaped by a
// descending band-pass plus a falling tone, ~280ms, so it reads clearly over
// combat without being harsh.
function buildZombieKillerSe(ctx, destination, t0) {
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, t0);
  out.gain.exponentialRampToValueAtTime(0.9, t0 + 0.012);
  out.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
  out.connect(destination);

  // Noise burst through a sweeping band-pass = the "shatter".
  const noiseLen = 0.3;
  const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * noiseLen)), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = 6;
  band.frequency.setValueAtTime(2600, t0);
  band.frequency.exponentialRampToValueAtTime(420, t0 + 0.26);
  noise.connect(band).connect(out);
  noise.start(t0);
  noise.stop(t0 + noiseLen + 0.02);

  // Falling tone = the "kill" punctuation.
  const tone = ctx.createOscillator();
  tone.type = 'triangle';
  tone.frequency.setValueAtTime(880, t0);
  tone.frequency.exponentialRampToValueAtTime(150, t0 + 0.22);
  const toneGain = ctx.createGain();
  toneGain.gain.setValueAtTime(0.0001, t0);
  toneGain.gain.exponentialRampToValueAtTime(0.5, t0 + 0.02);
  toneGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.26);
  tone.connect(toneGain).connect(out);
  tone.start(t0);
  tone.stop(t0 + 0.3);
}

export function playZombieKillerSe(engine = audioEngine) {
  return engine.playSynthSe(buildZombieKillerSe);
}

export { buildZombieKillerSe };
