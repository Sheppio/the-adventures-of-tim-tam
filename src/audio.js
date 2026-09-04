// Every sound in this game is synthesised at runtime. There are no audio
// files, which means there is no download, which means it ships faster than
// certain other titles releasing the same day.

let ctx = null;
let master = null;

const MUTE_KEY = 'timtam.muted';
const VOLUME = 0.5;

// Reading storage can throw outright, not just come back empty -- a browser
// set to block site data, or a page opened from file://. Silence is a safe
// default either way.
function loadMuted() {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}

export let muted = loadMuted();

export function initAudio() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  // Honour a mute restored from a previous visit, or the first sound after
  // the audio context wakes would play at full volume.
  master.gain.value = muted ? 0 : VOLUME;
  master.connect(ctx.destination);
}

export function resumeAudio() {
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

export function toggleMute() {
  setMuted(!muted);
  return muted;
}

export function setMuted(next) {
  muted = !!next;
  if (master) master.gain.value = muted ? 0 : VOLUME;
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* not fatal */ }
  return muted;
}

function noiseBuffer(seconds) {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function env(node, t0, attack, decay, peak) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  node.connect(g);
  g.connect(master);
  return g;
}

// THWACK. The sound of bread meeting bird.
export function sfxThwack(pitch = 1) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(0.12);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(1400 * pitch, t);
  bp.frequency.exponentialRampToValueAtTime(280 * pitch, t + 0.1);
  bp.Q.value = 3;
  src.connect(bp);
  env(bp, t, 0.002, 0.11, 0.85);
  src.start(t); src.stop(t + 0.14);

  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(220 * pitch, t);
  o.frequency.exponentialRampToValueAtTime(70 * pitch, t + 0.09);
  env(o, t, 0.001, 0.09, 0.34);
  o.start(t); o.stop(t + 0.12);
}

// HONK.
export function sfxHonk() {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const p = 0.85 + Math.random() * 0.5;
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(300 * p, t);
  o.frequency.linearRampToValueAtTime(430 * p, t + 0.05);
  o.frequency.linearRampToValueAtTime(240 * p, t + 0.19);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 1800;
  o.connect(lp);
  env(lp, t, 0.012, 0.2, 0.3);
  o.start(t); o.stop(t + 0.24);
}

export function sfxBoom(size = 1) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(0.9);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(1600, t);
  lp.frequency.exponentialRampToValueAtTime(120, t + 0.7 * size);
  src.connect(lp);
  env(lp, t, 0.004, 0.75 * size, 0.95);
  src.start(t); src.stop(t + 1.0);

  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(120, t);
  o.frequency.exponentialRampToValueAtTime(26, t + 0.55 * size);
  env(o, t, 0.005, 0.6 * size, 0.9);
  o.start(t); o.stop(t + 0.8);
}

export function sfxFuse() {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(0.06);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 3200;
  src.connect(hp);
  env(hp, t, 0.003, 0.05, 0.18);
  src.start(t); src.stop(t + 0.07);
}

// The sound of a man named Greg being extremely unhappy about bread.
export function sfxGreg(kind = 'grunt') {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = 'square';
  const base = kind === 'hurt' ? 150 : 96;
  o.frequency.setValueAtTime(base, t);
  o.frequency.linearRampToValueAtTime(base * 0.55, t + 0.28);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 700;
  o.connect(lp);
  env(lp, t, 0.02, 0.3, 0.32);
  o.start(t); o.stop(t + 0.34);
}

export function sfxThud() {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(90, t);
  o.frequency.exponentialRampToValueAtTime(34, t + 0.18);
  env(o, t, 0.003, 0.2, 0.5);
  o.start(t); o.stop(t + 0.24);
}

export function sfxFanfare() {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime;
  // An accordion would be more appropriate. This is what we have.
  [0, 4, 7, 12].forEach((semi, i) => {
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = 262 * Math.pow(2, semi / 12);
    const t = t0 + i * 0.11;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + 0.45);
  });
}
