// Explosions, feathers, crumbs, screen shake and unsolicited commentary.
import { rand, randInt, pick, clamp } from './physics.js';
import { GROUND_Y } from './config.js';

export const bits = [];       // debris particles
export const booms = [];      // expanding explosion rings
export const texts = [];      // floating words
export const smokes = [];

export const shake = { mag: 0, decay: 0.9 };

export function addShake(m) { shake.mag = Math.min(46, shake.mag + m); }

export function updateShake() {
  shake.mag *= shake.decay;
  if (shake.mag < 0.05) shake.mag = 0;
}

export function spawnBits(x, y, n, opts = {}) {
  for (let i = 0; i < n; i++) {
    bits.push({
      x, y,
      vx: rand(-1, 1) * (opts.spread ?? 7),
      vy: rand(-1, 0.35) * (opts.spread ?? 7) - (opts.lift ?? 3),
      life: randInt(opts.minLife ?? 26, opts.maxLife ?? 80),
      maxLife: 80,
      size: rand(opts.minSize ?? 2, opts.maxSize ?? 6),
      color: pick(opts.colors ?? ['#f2c14e', '#e0a83a', '#fff3d0']),
      spin: rand(-0.3, 0.3),
      rot: rand(0, 6.28),
      kind: opts.kind ?? 'crumb',
      grav: opts.grav ?? 0.42,
    });
  }
}

export function spawnFeathers(x, y, n = 12) {
  spawnBits(x, y, n, {
    colors: ['#ffffff', '#f2f2ef', '#e4e2da', '#ff9c33'],
    spread: 5, lift: 4, kind: 'feather', grav: 0.13,
    minSize: 3, maxSize: 7, minLife: 60, maxLife: 130,
  });
}

export function spawnBoom(x, y, radius) {
  booms.push({ x, y, r: 8, max: radius, life: 0, maxLife: 26 });
  for (let i = 0; i < 5; i++) {
    smokes.push({
      x: x + rand(-30, 30), y: y + rand(-30, 30),
      r: rand(20, 46), life: 0, maxLife: randInt(40, 85),
      vx: rand(-1.2, 1.2), vy: rand(-2.2, -0.4),
    });
  }
  spawnBits(x, y, 34, {
    colors: ['#ffe08a', '#ffb347', '#ff6b35', '#8a4b2a', '#3a3a3a'],
    spread: 13, lift: 6, minSize: 2, maxSize: 8, minLife: 24, maxLife: 74,
  });
}

export function say(x, y, text, opts = {}) {
  // Cap the chatter, or a chain explosion buries the screen in words.
  while (texts.length > 8) texts.shift();
  texts.push({
    // A little scatter so three geese honking at once don't stack into mush.
    x: x + rand(-14, 14), y: y + rand(-8, 8), text,
    vy: opts.vy ?? -1.1,
    life: 0, maxLife: opts.maxLife ?? 78,
    color: opts.color ?? '#fff8e6',
    size: opts.size ?? 22,
    outline: opts.outline ?? '#2a1a10',
    wobble: opts.wobble ?? 0,
  });
}

export function updateFx() {
  for (let i = bits.length - 1; i >= 0; i--) {
    const b = bits[i];
    b.x += b.vx; b.y += b.vy;
    b.vy += b.grav;
    b.vx *= 0.99;
    b.rot += b.spin;
    if (b.kind === 'feather') {
      b.vx += Math.sin((b.life + i) * 0.14) * 0.14;
      b.vy *= 0.94;
    }
    if (b.y > GROUND_Y - 1) {
      b.y = GROUND_Y - 1;
      b.vy *= -0.32;
      b.vx *= 0.7;
      b.spin *= 0.6;
      if (Math.abs(b.vy) < 0.4) b.vy = 0;
    }
    if (--b.life <= 0) bits.splice(i, 1);
  }
  for (let i = booms.length - 1; i >= 0; i--) {
    const b = booms[i];
    b.life++;
    const t = b.life / b.maxLife;
    b.r = b.max * (1 - Math.pow(1 - t, 2.6));
    if (b.life >= b.maxLife) booms.splice(i, 1);
  }
  for (let i = smokes.length - 1; i >= 0; i--) {
    const s = smokes[i];
    s.life++; s.x += s.vx; s.y += s.vy; s.vy *= 0.97; s.r += 0.7;
    if (s.life >= s.maxLife) smokes.splice(i, 1);
  }
  for (let i = texts.length - 1; i >= 0; i--) {
    const t = texts[i];
    t.life++; t.y += t.vy; t.vy *= 0.97;
    if (t.life >= t.maxLife) texts.splice(i, 1);
  }
  updateShake();
}

export function clearFx() {
  bits.length = 0; booms.length = 0; texts.length = 0; smokes.length = 0;
  shake.mag = 0;
}

export function drawFx(ctx) {
  // Smoke first, behind everything else.
  for (const s of smokes) {
    const t = s.life / s.maxLife;
    ctx.globalAlpha = (1 - t) * 0.34;
    ctx.fillStyle = '#6b6156';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, 6.2832);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  for (const b of bits) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.rot);
    ctx.globalAlpha = clamp(b.life / 22, 0, 1);
    ctx.fillStyle = b.color;
    if (b.kind === 'feather') {
      ctx.beginPath();
      ctx.ellipse(0, 0, b.size * 1.9, b.size * 0.6, 0, 0, 6.2832);
      ctx.fill();
    } else {
      ctx.fillRect(-b.size / 2, -b.size / 2, b.size, b.size);
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  for (const b of booms) {
    const t = b.life / b.maxLife;
    // Core flash
    ctx.globalAlpha = Math.max(0, 1 - t * 1.5);
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, Math.max(1, b.r));
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.25, '#ffe07a');
    g.addColorStop(0.6, '#ff7a2f');
    g.addColorStop(1, 'rgba(255,90,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(b.x, b.y, Math.max(1, b.r), 0, 6.2832); ctx.fill();
    // Shock ring
    ctx.globalAlpha = Math.max(0, 1 - t) * 0.8;
    ctx.strokeStyle = '#fff6d8';
    ctx.lineWidth = Math.max(1, 7 * (1 - t));
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 1.06, 0, 6.2832); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export function drawTexts(ctx) {
  for (const t of texts) {
    const k = t.life / t.maxLife;
    ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
    ctx.font = `900 ${t.size}px "Bree Serif", Georgia, serif`;
    ctx.textAlign = 'center';
    const wob = t.wobble ? Math.sin(t.life * 0.3) * t.wobble : 0;
    ctx.lineWidth = 6;
    ctx.strokeStyle = t.outline;
    ctx.strokeText(t.text, t.x + wob, t.y);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x + wob, t.y);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}
