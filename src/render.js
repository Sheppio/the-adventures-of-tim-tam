// All the drawing. No sprites, no atlas, no artist. Just vectors and hubris.
import { GROUND_Y, WORLD_W, VW, VH, CAM_Y } from './config.js';
import { clamp } from './physics.js';

const TAU = Math.PI * 2;

function limb(ctx, a, b, w, color, cap = 'round') {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = cap;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function blob(ctx, x, y, rx, ry, ang, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function outlined(ctx, fn, stroke = '#2a1a10', w = 3) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = stroke;
  ctx.lineWidth = w;
  fn(true);
  ctx.restore();
}

// ---------------------------------------------------------------- background

const clouds = Array.from({ length: 14 }, (_, i) => ({
  x: (i * 337) % (WORLD_W + 600),
  y: 60 + ((i * 97) % 170),
  s: 0.6 + ((i * 13) % 10) / 10,
  d: 0.12 + ((i % 3) * 0.05),
}));

// Deterministic per-house, so a given shop always has the same name.
// Keep these short: the narrowest shopfront gives ~62px, and the sign only
// shrinks to 7px Georgia before it stops being readable.
const SHOP_NAMES = [
  'BOULANGERIE', 'PATISSERIE', 'FROMAGERIE', 'CHARCUTERIE', 'CREPERIE',
  'CHOCOLATERIE', 'POISSONNERIE', 'BRASSERIE', 'EPICERIE', 'FLEURISTE',
  'LIBRAIRIE', 'BOUCHERIE', 'CAFE DES OIES', 'LE PETIT PAIN',
  'BAGUETTE D\'OR', 'AUX DEUX OIES', 'LE PAIN LOURD', 'CHEZ GREG',
  'TABAC', 'PAIN & CO',
];

const houses = Array.from({ length: 26 }, (_, i) => {
  const r = (n) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
  return {
    x: i * 168 - 120,
    w: 88 + r(1) * 58,
    h: 96 + r(2) * 118,
    hue: [ '#c9a27a', '#d9b48c', '#b98d68', '#e0c3a0', '#a8785a' ][Math.floor(r(3) * 5)],
    roof: [ '#5a5f6b', '#6d5350', '#4c5259' ][Math.floor(r(4) * 3)],
    shop: r(5) > 0.62,
    awning: r(6) > 0.5,
    name: SHOP_NAMES[Math.floor(r(7) * SHOP_NAMES.length)],
  };
});

// The far skyline: Paris rooftops behind the village, hazy and low-contrast
// so it reads as distance rather than as more scenery.
const skyline = Array.from({ length: 40 }, (_, i) => {
  const r = (n) => ((Math.sin(i * 7.31 + n * 41.7) * 31877.1) % 1 + 1) % 1;
  return {
    x: i * 132 - 200,
    w: 74 + r(1) * 76,
    h: 120 + r(2) * 130,
    cap: r(3) > 0.88 ? 'dome' : r(3) > 0.76 ? 'spire' : r(3) > 0.4 ? 'mansard' : 'flat',
    chimneys: Math.floor(r(4) * 4),
  };
});

const tufts = Array.from({ length: 90 }, (_, i) => {
  const r = (n) => ((Math.sin(i * 3.71 + n * 19.7) * 24631.7) % 1 + 1) % 1;
  return { x: r(1) * WORLD_W, h: 6 + r(2) * 14, w: 2 + r(3) * 3 };
});

// Everything below is drawn INSIDE the world transform (scaled by ZOOM and
// translated by the camera), so all coordinates here are world coordinates.
// Parallax layers translate by cam*(1-depth) to partially undo the camera.
export function drawBackground(ctx, cam) {
  const top = CAM_Y;

  // Sky
  const sky = ctx.createLinearGradient(0, top, 0, GROUND_Y);
  sky.addColorStop(0, '#8fd0f0');
  sky.addColorStop(0.55, '#c7e7f5');
  sky.addColorStop(1, '#f6e7c9');
  ctx.fillStyle = sky;
  ctx.fillRect(cam - 40, top - 40, VW + 80, VH + 80);

  // Sun
  const sunX = cam + VW * 0.82, sunY = top + 70;
  ctx.save();
  ctx.globalAlpha = 0.75;
  const sg = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 130);
  sg.addColorStop(0, '#fff8d0');
  sg.addColorStop(1, 'rgba(255,240,180,0)');
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.arc(sunX, sunY, 130, 0, TAU); ctx.fill();
  ctx.restore();

  // Clouds
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  const span = WORLD_W + 700;
  for (const c of clouds) {
    // Wrap the cloud's parallaxed screen position, then push it back to world.
    const screenX = (((c.x - cam * c.d) % span) + span) % span - 240;
    const cx = cam + screenX;
    const y = top + c.y;
    const s = c.s;
    ctx.beginPath();
    ctx.arc(cx, y, 26 * s, 0, TAU);
    ctx.arc(cx + 30 * s, y + 6 * s, 20 * s, 0, TAU);
    ctx.arc(cx - 28 * s, y + 8 * s, 17 * s, 0, TAU);
    ctx.arc(cx + 8 * s, y - 14 * s, 18 * s, 0, TAU);
    ctx.fill();
  }

  // Eiffel Tower: furthest thing built, so it goes down first and the
  // rooftops in front of it overlap its base. Its base sits on GROUND_Y, the
  // same line the houses stand on -- it used to be 40px above it, which is
  // why it floated.
  ctx.save();
  ctx.translate(cam * 0.84, 0);
  drawTower(ctx, 640, GROUND_Y, 1.5);
  ctx.restore();

  // Far skyline, between the tower's parallax and the village's so the depth
  // ramp is even.
  ctx.save();
  ctx.translate(cam * 0.74, 0);
  drawSkyline(ctx);
  ctx.restore();

  drawFlyers(ctx, cam);

  // Village
  ctx.save();
  ctx.translate(cam * 0.58, 0);
  for (const h of houses) {
    const hTop = GROUND_Y - 30 - h.h;
    ctx.fillStyle = h.hue;
    ctx.fillRect(h.x, hTop, h.w, h.h + 30);
    ctx.fillStyle = h.roof;
    ctx.beginPath();
    ctx.moveTo(h.x - 8, hTop);
    ctx.lineTo(h.x + h.w / 2, hTop - 34);
    ctx.lineTo(h.x + h.w + 8, hTop);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(60,70,90,0.55)';
    for (let wy = hTop + 24; wy < GROUND_Y - 84; wy += 50) {
      for (let wx = h.x + 14; wx < h.x + h.w - 20; wx += 40) {
        ctx.fillRect(wx, wy, 19, 28);
      }
    }
    if (h.shop) {
      ctx.fillStyle = '#3b2a1c';
      ctx.fillRect(h.x + 10, GROUND_Y - 92, h.w - 20, 62);
      ctx.fillStyle = '#f0d9a8';
      ctx.textAlign = 'center';
      // Shrink to fit: the names vary a lot in length and the shopfronts don't.
      const maxW = h.w - 26;
      let size = 13;
      ctx.font = `900 ${size}px Georgia, serif`;
      while (size > 7 && ctx.measureText(h.name).width > maxW) {
        size -= 0.5;
        ctx.font = `900 ${size}px Georgia, serif`;
      }
      ctx.fillText(h.name, h.x + h.w / 2, GROUND_Y - 100);
      ctx.textAlign = 'left';
    }
    if (h.awning) {
      ctx.fillStyle = '#c0453b';
      ctx.beginPath();
      ctx.moveTo(h.x + 4, GROUND_Y - 96);
      ctx.lineTo(h.x + h.w - 4, GROUND_Y - 96);
      ctx.lineTo(h.x + h.w - 14, GROUND_Y - 74);
      ctx.lineTo(h.x + 14, GROUND_Y - 74);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();

  // Bunting strung across the arena, sagging optimistically.
  ctx.save();
  ctx.translate(cam * 0.28, 0);
  const buntY = top + 96;
  const colors = ['#2b4a8b', '#f5f1e6', '#c0453b'];
  ctx.strokeStyle = 'rgba(50,40,30,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 96; i++) ctx.lineTo(i * 62 - 60, buntY + Math.sin(i * 0.7) * 8);
  ctx.stroke();
  for (let i = 0; i < 96; i++) {
    const x = i * 62 - 60;
    const sag = Math.sin(i * 0.7) * 8;
    ctx.fillStyle = colors[i % 3];
    ctx.beginPath();
    ctx.moveTo(x, buntY + sag);
    ctx.lineTo(x + 26, buntY + sag);
    ctx.lineTo(x + 13, buntY + 30 + sag);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// Distant Paris rooftops. Flat silhouettes in a haze tone -- no windows, no
// detail, because anything legible here competes with the playfield.
function drawSkyline(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(151,171,191,0.34)';
  for (const b of skyline) {
    const top = GROUND_Y - b.h;
    ctx.fillRect(b.x, top, b.w, b.h);
    const mid = b.x + b.w / 2;
    if (b.cap === 'mansard') {
      ctx.beginPath();
      ctx.moveTo(b.x - 5, top);
      ctx.lineTo(b.x + 12, top - 22);
      ctx.lineTo(b.x + b.w - 12, top - 22);
      ctx.lineTo(b.x + b.w + 5, top);
      ctx.closePath(); ctx.fill();
    } else if (b.cap === 'spire') {
      ctx.beginPath();
      ctx.moveTo(b.x + 6, top);
      ctx.lineTo(mid, top - 74);
      ctx.lineTo(b.x + b.w - 6, top);
      ctx.closePath(); ctx.fill();
    } else if (b.cap === 'dome') {
      ctx.beginPath();
      ctx.arc(mid, top, b.w * 0.44, Math.PI, TAU);
      ctx.fill();
      ctx.fillRect(mid - 2, top - b.w * 0.44 - 16, 4, 18);
    }
    // Chimney pots. The most Parisian detail available at four pixels wide.
    for (let c = 0; c < b.chimneys; c++) {
      const cx = b.x + 10 + ((c * 29) % Math.max(1, b.w - 22));
      ctx.fillRect(cx, top - 13, 5, 13);
    }
  }
  ctx.restore();
}

// -------------------------------------------------------------- sky traffic

const BANNERS = [
  'HONK', 'VIVE LE PAIN', 'GREG IS FINE', 'BAGUETTE POWER',
  'SEE YOU NOV 19', 'GEESE GO HOME', 'BREAD IS LOVE', 'IL EST TEMPS',
];

// Birds and the occasional banner plane. Purely decorative: nothing up here
// collides with anything, and none of it is part of the fight.
const flyers = [];
let flyerTimer = 90;

export function updateSky(cam) {
  for (let i = flyers.length - 1; i >= 0; i--) {
    const f = flyers[i];
    f.x += f.vx;
    f.phase += f.kind === 'plane' ? 0.5 : 0.22;
    // Despawn on viewport offset, which is where the parallax actually puts it.
    const off = f.x - cam * (1 - f.d);
    if (off < -620 || off > VW + 620) flyers.splice(i, 1);
  }

  if (--flyerTimer > 0 || flyers.length > 2) return;
  flyerTimer = 420 + Math.floor(Math.random() * 620);
  spawnFlyover(cam);
}

export function spawnFlyover(cam, kind) {
  const plane = kind ? kind === 'plane' : Math.random() < 0.34;
  const dir = Math.random() < 0.5 ? 1 : -1;
  const d = plane ? 0.34 : 0.62;
  const edge = dir > 0 ? -260 : VW + 260;
  flyers.push({
    kind: plane ? 'plane' : 'birds',
    d,
    x: cam * (1 - d) + edge,
    // The plane flies under the bunting (CAM_Y+96) and over the rooftops:
    // the bunting is a nearer layer, so it slices the banner if they overlap.
    y: CAM_Y + (plane ? 152 + Math.random() * 78 : 52 + Math.random() * 150),
    vx: dir * (plane ? 2.4 + Math.random() * 0.8 : 1.35 + Math.random() * 0.6),
    dir,
    phase: 0,
    n: 4 + Math.floor(Math.random() * 5),
    banner: BANNERS[Math.floor(Math.random() * BANNERS.length)],
  });
}

function drawFlyers(ctx, cam) {
  for (const f of flyers) {
    ctx.save();
    ctx.translate(cam * f.d, 0);
    if (f.kind === 'plane') drawPlane(ctx, f);
    else drawBirdFlock(ctx, f);
    ctx.restore();
  }
}

// A V of distant birds. Each one is two strokes; the illusion is the formation.
function drawBirdFlock(ctx, f) {
  ctx.strokeStyle = 'rgba(58,60,70,0.58)';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  for (let i = 0; i < f.n; i++) {
    // Leader at rank 0, then pairs peeling off alternating arms: a V, not a
    // queue. Ranks trail behind the direction of travel.
    const rank = Math.ceil(i / 2);
    const arm = i % 2 ? 1 : -1;
    const bx = f.x - f.dir * rank * 27;
    const by = f.y + (rank === 0 ? 0 : arm * rank * 11);
    // Wings beat out of phase down the formation so it doesn't pulse as one.
    const w = Math.sin(f.phase + i * 0.8) * 4.5;
    ctx.beginPath();
    ctx.moveTo(bx - 9, by + w);
    ctx.quadraticCurveTo(bx - 3.5, by - 3.5, bx, by);
    ctx.quadraticCurveTo(bx + 3.5, by - 3.5, bx + 9, by + w);
    ctx.stroke();
  }
}

function drawPlane(ctx, f) {
  const d = f.dir;
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.scale(d, 1);

  // Banner first, so the plane overlaps its leading edge.
  const bw = 168, bh = 30, gap = 34;
  ctx.fillStyle = 'rgba(70,60,55,0.5)';
  ctx.fillRect(-gap, -1.5, gap, 2);
  ctx.fillStyle = 'rgba(214,74,64,0.88)';
  ctx.fillRect(-gap - bw, -bh / 2, bw, bh);
  ctx.save();
  ctx.scale(d, 1);                       // un-mirror, or the text reads backwards
  ctx.fillStyle = '#fff4e0';
  ctx.font = '900 15px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(f.banner, d * (-gap - bw / 2), 1);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.restore();

  ctx.strokeStyle = 'rgba(45,38,32,0.75)';
  ctx.lineWidth = 2;

  ctx.fillStyle = '#c9412f';
  ctx.beginPath();                       // tail fin, first so the body caps it
  ctx.moveTo(-20, -2); ctx.lineTo(-31, -21); ctx.lineTo(-11, -3);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath();                       // tailplane
  ctx.ellipse(-24, 1, 9, 3, 0, 0, TAU);
  ctx.fill(); ctx.stroke();

  // Fuselage: a wedge with a pointed nose. A plain ellipse read as a fish.
  ctx.fillStyle = '#e8e2d4';
  ctx.beginPath();
  ctx.moveTo(30, 0);
  ctx.quadraticCurveTo(22, -9, 4, -9);
  ctx.lineTo(-24, -4);
  ctx.quadraticCurveTo(-30, -1, -24, 3);
  ctx.lineTo(6, 8);
  ctx.quadraticCurveTo(23, 7, 30, 0);
  ctx.closePath(); ctx.fill(); ctx.stroke();

  ctx.fillStyle = 'rgba(120,180,215,0.95)';
  ctx.beginPath();                       // cockpit glass
  ctx.ellipse(10, -6, 7.5, 4.5, 0, Math.PI, TAU);
  ctx.fill(); ctx.stroke();

  ctx.fillStyle = '#cfc7b6';
  ctx.beginPath();                       // wing, swept back under the body
  ctx.moveTo(8, 3); ctx.lineTo(-6, 16); ctx.lineTo(-16, 15); ctx.lineTo(-4, 3);
  ctx.closePath(); ctx.fill(); ctx.stroke();

  // Prop: a thin blurred arc, not a full disc -- a ring at the nose read as
  // a second body.
  ctx.strokeStyle = 'rgba(60,55,50,0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(31, 0, 2, 12 + Math.sin(f.phase * 3) * 1.5, 0, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

function drawTower(ctx, x, baseY, s) {
  ctx.save();
  ctx.translate(x, baseY);
  ctx.scale(s, s);
  ctx.strokeStyle = 'rgba(112,104,96,0.4)';
  ctx.fillStyle = 'rgba(132,122,110,0.3)';
  ctx.lineWidth = 3.5;
  const H = 330;
  // Silhouette: the classic flare, splayed feet to a needle.
  const leg = (t) => 70 - 59 * Math.pow(t, 0.55);   // half-width at height t
  ctx.beginPath();
  ctx.moveTo(-70, 0);
  for (let t = 0; t <= 0.72; t += 0.06) ctx.lineTo(-leg(t / 0.72) , -H * t);
  ctx.lineTo(-5, -H); ctx.lineTo(5, -H);
  for (let t = 0.72; t >= 0; t -= 0.06) ctx.lineTo(leg(t / 0.72), -H * t);
  ctx.closePath(); ctx.fill(); ctx.stroke();

  // Lattice. Cheap X-bracing, but it's what makes it read as the tower
  // rather than as a pylon.
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1.6;
  for (let t = 0.02; t < 0.7; t += 0.055) {
    const w0 = leg(t / 0.72), w1 = leg((t + 0.055) / 0.72);
    const y0 = -H * t, y1 = -H * (t + 0.055);
    ctx.beginPath();
    ctx.moveTo(-w0, y0); ctx.lineTo(w1, y1);
    ctx.moveTo(w0, y0); ctx.lineTo(-w1, y1);
    ctx.stroke();
  }
  ctx.restore();

  // Observation decks
  ctx.beginPath();
  ctx.moveTo(-46, -H * 0.24); ctx.lineTo(46, -H * 0.24);
  ctx.moveTo(-21, -H * 0.52); ctx.lineTo(21, -H * 0.52);
  ctx.moveTo(-11, -H * 0.72); ctx.lineTo(11, -H * 0.72);
  ctx.stroke();
  // Arch
  ctx.beginPath();
  ctx.moveTo(-52, 0);
  ctx.quadraticCurveTo(0, -H * 0.22, 52, 0);
  ctx.stroke();
  ctx.restore();
}

export function drawGround(ctx, cam) {
  const g = ctx.createLinearGradient(0, GROUND_Y, 0, CAM_Y + VH + 40);
  g.addColorStop(0, '#a4936f');
  g.addColorStop(1, '#6f6149');
  ctx.fillStyle = g;
  ctx.fillRect(cam - 40, GROUND_Y, VW + 80, VH);
  ctx.fillStyle = '#7f7154';
  ctx.fillRect(cam - 40, GROUND_Y, VW + 80, 6);

  // Cobbles
  ctx.fillStyle = 'rgba(70,54,34,0.13)';
  const x0 = Math.floor((cam - 46) / 46) * 46;
  for (let x = x0; x < cam + VW + 46; x += 46) {
    for (let y = GROUND_Y + 14; y < CAM_Y + VH + 40; y += 22) {
      const off = ((y / 22) | 0) % 2 ? 23 : 0;
      ctx.fillRect(x + off, y, 36, 13);
    }
  }
  ctx.fillStyle = '#69793f';
  for (const t of tufts) {
    if (t.x < cam - 40 || t.x > cam + VW + 40) continue;
    ctx.fillRect(t.x, GROUND_Y - t.h, t.w, t.h);
    ctx.fillRect(t.x + 4, GROUND_Y - t.h * 0.7, t.w, t.h * 0.7);
  }
}

// -------------------------------------------------------------------- shadow

export function drawShadow(ctx, x, y, w) {
  const h = clamp(1 - (GROUND_Y - y) / 420, 0.15, 1);
  ctx.globalAlpha = 0.15 * h;
  ctx.fillStyle = '#4a3a20';
  ctx.beginPath();
  ctx.ellipse(x, GROUND_Y - 1, w * h * 0.8, 5 * h, 0, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
}

// -------------------------------------------------------------------- Tim Tam

export function drawHero(ctx, hero, t) {
  const p = hero.rag.p;
  const f = hero.rag.facing;
  drawShadow(ctx, p.hips.x, p.hips.y, 26);

  // Back arm + back leg first, in a darker shade for depth.
  limb(ctx, p.hips, p.kneeL, 13, '#2f3a5c');
  limb(ctx, p.kneeL, p.footL, 11, '#2f3a5c');
  shoe(ctx, p.footL, f, '#4a3320');

  limb(ctx, p.chest, p.elbowL, 10, '#d9c39f');
  limb(ctx, p.elbowL, p.handL, 9, '#f2d5a8');
  ctx.fillStyle = '#f2d5a8';
  ctx.beginPath(); ctx.arc(p.handL.x, p.handL.y, 7, 0, TAU); ctx.fill();

  // Torso: Breton stripes, obviously.
  torso(ctx, p.hips, p.chest, hero.rag.scale);

  // Front leg
  limb(ctx, p.hips, p.kneeR, 14, '#3c4a72');
  limb(ctx, p.kneeR, p.footR, 12, '#3c4a72');
  shoe(ctx, p.footR, f, '#5c4026');

  heroHead(ctx, p, f, hero, t);

  // Sword arm and the bread itself, on top of everything.
  limb(ctx, p.chest, p.elbowR, 11, '#e8cfa4');
  limb(ctx, p.elbowR, p.handR, 10, '#f2d5a8');
  ctx.fillStyle = '#f2d5a8';
  ctx.beginPath(); ctx.arc(p.handR.x, p.handR.y, 7.5, 0, TAU); ctx.fill();
  drawBaguette(ctx, hero);
}

function torso(ctx, hips, chest, s) {
  const ang = Math.atan2(chest.y - hips.y, chest.x - hips.x);
  const len = Math.hypot(chest.x - hips.x, chest.y - hips.y);
  ctx.save();
  ctx.translate(hips.x, hips.y);
  ctx.rotate(ang + Math.PI / 2);
  const w = 30 * s, h = len + 2 * s;
  ctx.beginPath();
  ctx.moveTo(-w / 2, 6);
  ctx.quadraticCurveTo(-w / 2 - 3, -h / 2, -w / 2 + 3, -h + 4);
  ctx.lineTo(w / 2 - 3, -h + 4);
  ctx.quadraticCurveTo(w / 2 + 3, -h / 2, w / 2, 6);
  ctx.closePath();
  ctx.fillStyle = '#f5f1e6';
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#2b4a8b';
  for (let y = -h; y < 8; y += 14) ctx.fillRect(-w, y, w * 2, 7);
  ctx.restore();
  ctx.strokeStyle = '#2a1a10';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();
}

function shoe(ctx, foot, f, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(foot.x + f * 4, foot.y + 2, 12, 6.5, 0, 0, TAU);
  ctx.fill();
}

function heroHead(ctx, p, f, hero, t) {
  const head = p.head, chest = p.chest;
  const ang = Math.atan2(head.y - chest.y, head.x - chest.x) + Math.PI / 2;
  const limp = !hero.conscious;
  ctx.save();
  ctx.translate(head.x, head.y);
  ctx.rotate(ang);

  // Neck
  ctx.strokeStyle = '#e8cfa4';
  ctx.lineWidth = 11;
  ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(0, 24); ctx.stroke();

  // Skull
  ctx.fillStyle = '#f2d5a8';
  ctx.strokeStyle = '#2a1a10';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, 20, 21.5, 0, 0, TAU);
  ctx.fill(); ctx.stroke();

  // Ears
  ctx.beginPath(); ctx.ellipse(-19, 3, 5, 6.5, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(19, 3, 5, 6.5, 0, 0, TAU); ctx.fill(); ctx.stroke();

  // Eyes: deliberately mismatched, deliberately not looking at the same thing.
  const blink = hero.blinkT > 0;
  const wx = Math.sin(hero.eyeWander) * 2.2;
  const wy = Math.cos(hero.eyeWander * 1.7) * 1.4;
  const eye = (ex, ey, r, pr, dx, dy) => {
    ctx.fillStyle = '#fffdf5';
    ctx.beginPath(); ctx.arc(ex, ey, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 1.6; ctx.stroke();
    if (!blink) {
      ctx.fillStyle = '#181008';
      ctx.beginPath(); ctx.arc(ex + dx, ey + dy, pr, 0, TAU); ctx.fill();
    } else {
      ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ex - r, ey); ctx.lineTo(ex + r, ey); ctx.stroke();
    }
  };
  if (limp) {
    // X eyes would imply damage. These are spiral-adjacent instead.
    ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 2.2;
    for (const ex of [-6 + f * 2, 7 + f * 2]) {
      ctx.beginPath();
      ctx.moveTo(ex - 4, -6); ctx.lineTo(ex + 4, 0);
      ctx.moveTo(ex + 4, -6); ctx.lineTo(ex - 4, 0);
      ctx.stroke();
    }
  } else {
    eye(-7 + f * 3, -4, 8.5, 3.6, wx, wy);
    eye(9 + f * 3, -5, 6.2, 2.7, wx * 1.4, wy);
  }

  // Two enormous front teeth. Non-negotiable.
  ctx.fillStyle = '#fffdf5';
  ctx.strokeStyle = '#2a1a10';
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.rect(f * 2 - 5, 7, 5, 8); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.rect(f * 2 + 0.6, 7, 5, 8); ctx.fill(); ctx.stroke();

  // Mouth line
  ctx.strokeStyle = '#8a5a3a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(f * 2, 5, 7, 0.25, Math.PI - 0.25);
  ctx.stroke();

  // Beret, worn at an angle that suggests confidence rather than competence.
  ctx.save();
  ctx.rotate(-f * 0.28);
  ctx.fillStyle = '#c0453b';
  ctx.strokeStyle = '#2a1a10';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.ellipse(0, -16, 25, 11, 0, Math.PI * 1.02, Math.PI * 2 - 0.02);
  ctx.ellipse(0, -15.5, 22, 6, 0, 0, Math.PI);
  ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(f * 6, -26, 3.4, 0, TAU);
  ctx.fillStyle = '#8f2f28'; ctx.fill();
  ctx.restore();

  // A moustache he cannot grow but insists upon.
  ctx.fillStyle = '#4a3320';
  ctx.beginPath();
  ctx.ellipse(f * 2 - 5.5, 1.5, 5, 2, -0.22, 0, TAU);
  ctx.ellipse(f * 2 + 5.5, 1.5, 5, 2, 0.22, 0, TAU);
  ctx.fill();

  ctx.restore();
}

export function drawBaguette(ctx, hero) {
  const b = hero.baguetteTransform();
  const ang = Math.atan2(b.dy, b.dx);
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(ang);

  // Motion arc while swinging, so you can see the crime.
  if (hero.swingActive) {
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = '#fff3c4';
    ctx.lineWidth = 16;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, b.len * 0.8, -0.9, 0.5);
    ctx.stroke();
    ctx.restore();
  }

  const L = b.len;
  const grd = ctx.createLinearGradient(0, -9, 0, 9);
  grd.addColorStop(0, '#f0c674');
  grd.addColorStop(0.5, '#dda94f');
  grd.addColorStop(1, '#b9822f');
  ctx.fillStyle = grd;
  ctx.strokeStyle = '#7a4f1c';
  ctx.lineWidth = 2.5;
  // True semicircular caps at both ends. The tip was originally two curves
  // meeting at a single vertex, which read as a spear; capping it with a
  // quadratic instead left a kink where the curve met the crust, so both
  // ends are arcs and the crusts meet them near-tangentially.
  const hx = 5, tx = L - 8;        // cap centres
  const rH = 7.2, rT = 7.6;        // cap radii
  ctx.beginPath();
  ctx.moveTo(hx, -rH);
  ctx.quadraticCurveTo(L * 0.5, -11, tx, -rT);          // top crust
  ctx.arc(tx, 0, rT, -Math.PI / 2, Math.PI / 2);        // nose cap
  ctx.quadraticCurveTo(L * 0.5, 11, hx, rH);            // bottom crust
  ctx.arc(hx, 0, rH, Math.PI / 2, -Math.PI / 2);        // heel cap
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // Slashes. The genuine article has slashes.
  ctx.strokeStyle = 'rgba(120,74,26,0.85)';
  ctx.lineWidth = 2.2;
  for (let i = 1; i <= 5; i++) {
    const x = (L / 6) * i;
    ctx.beginPath();
    ctx.moveTo(x - 4, -5.5);
    ctx.lineTo(x + 4, 5.5);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------- geese

// One goose wing, in the body's local space. `side` is 1 for the near wing
// and negative for the far one, which also scales it down for depth.
function drawWing(ctx, f, beat, side) {
  const up = beat * 0.9 * (side < 0 ? 0.8 : 1);
  ctx.save();
  ctx.translate(-f * 3, -2);
  ctx.rotate(-f * (up + 0.15));
  ctx.scale(1, Math.abs(side));
  ctx.fillStyle = side < 0 ? '#d9d5c8' : '#eeebe0';
  ctx.strokeStyle = 'rgba(42,26,16,0.6)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.ellipse(-f * 12, 0, 20, 8.5, -f * 0.25, 0, TAU);
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

export function drawGoose(ctx, g) {
  const fade = g.deadT >= 0 ? clamp(1 - Math.max(0, g.deadT - 200) / 60, 0, 1) : 1;
  ctx.globalAlpha = fade;
  const b = g.body, h = g.head, f = g.facing;
  drawShadow(ctx, b.x, b.y, 19);

  // Legs
  limb(ctx, b, g.footL, 4.5, '#d07d22');
  limb(ctx, b, g.footR, 4.5, '#f09a33');
  for (const ft of [g.footL, g.footR]) {
    ctx.fillStyle = '#f09a33';
    ctx.beginPath();
    ctx.ellipse(ft.x + f * 3, ft.y + 2, 8, 3.5, 0, 0, TAU);
    ctx.fill();
  }

  // Neck: outline stroke first, white fill stroke on top.
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(b.x - f * 4, b.y - 6);
  ctx.quadraticCurveTo(b.x + f * 5, (b.y + h.y) / 2 - 4, h.x, h.y);
  ctx.strokeStyle = '#2a1a10';
  ctx.lineWidth = 13;
  ctx.stroke();
  ctx.strokeStyle = '#f7f5ee';
  ctx.lineWidth = 9;
  ctx.stroke();

  // Body
  const flapping = g.flying || g.state === 'buffet';
  ctx.save();
  ctx.translate(b.x, b.y);
  // A diving goose points along its own velocity. It is an arrow now.
  ctx.rotate(g.state === 'dive'
    ? Math.atan2(b.vy, b.vx) - (f < 0 ? Math.PI : 0)
    : clamp(b.vx * 0.03, -0.5, 0.5));
  ctx.fillStyle = '#f7f5ee';
  ctx.strokeStyle = '#2a1a10';
  ctx.lineWidth = 2.5;

  // Far wing, drawn behind the body so the flap reads as depth.
  const beat = flapping ? Math.sin(g.flap) : 0;
  if (flapping) drawWing(ctx, f, beat, -0.85);

  ctx.beginPath();
  ctx.ellipse(0, 0, 21, 15, 0, 0, TAU);
  ctx.fill(); ctx.stroke();

  // Near wing: folded ellipse at rest, a whole beating limb in the air.
  if (flapping) {
    drawWing(ctx, f, beat, 1);
  } else {
    ctx.fillStyle = '#e6e3d8';
    ctx.beginPath();
    ctx.ellipse(-f * 4, 1, 13, 9, -f * 0.2, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(42,26,16,0.5)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
  // Tail
  ctx.fillStyle = '#f7f5ee';
  ctx.beginPath();
  ctx.moveTo(-f * 19, -4);
  ctx.lineTo(-f * 32, -10);
  ctx.lineTo(-f * 20, 5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#2a1a10';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // Head
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.fillStyle = '#f7f5ee';
  ctx.strokeStyle = '#2a1a10';
  ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.arc(0, 0, 9.5, 0, TAU); ctx.fill(); ctx.stroke();
  // Beak
  ctx.fillStyle = '#f09a33';
  ctx.beginPath();
  ctx.moveTo(f * 6, -3.5);
  ctx.lineTo(f * 21, 0.5);
  ctx.lineTo(f * 6, 4.5);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // Eye. Furious.
  if (g.deadT >= 0) {
    ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(f * 1 - 3, -4); ctx.lineTo(f * 1 + 3, 1);
    ctx.moveTo(f * 1 + 3, -4); ctx.lineTo(f * 1 - 3, 1);
    ctx.stroke();
  } else {
    const mad = g.raging;
    ctx.fillStyle = mad ? '#ffdcd2' : '#fffdf5';
    ctx.beginPath(); ctx.arc(f * 2, -2.5, mad ? 4.6 : 4, 0, TAU); ctx.fill();
    ctx.fillStyle = mad ? '#c1231a' : '#181008';
    ctx.beginPath(); ctx.arc(f * 3, -2.5, mad ? 2.6 : 2.1, 0, TAU); ctx.fill();
    // Angry brow. Angrier when radicalised.
    ctx.strokeStyle = mad ? '#8e1b12' : '#2a1a10';
    ctx.lineWidth = mad ? 3 : 2.2;
    ctx.beginPath();
    ctx.moveTo(f * -2, mad ? -8.5 : -7.5); ctx.lineTo(f * 7, -4.5);
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ----------------------------------------------------------------------- Greg

export function drawGreg(ctx, greg) {
  const p = greg.rag.p;
  const f = greg.rag.facing;
  const s = greg.rag.scale;
  drawShadow(ctx, p.hips.x, p.hips.y, 34);

  if (greg.hitFlash > 0) {
    ctx.save();
    ctx.globalAlpha = 0.35 * (greg.hitFlash / 10);
    ctx.fillStyle = '#fff';
  }

  // Khakis. Pressed. Somehow still pressed.
  limb(ctx, p.hips, p.kneeL, 16 * s, '#8d7a5c');
  limb(ctx, p.kneeL, p.footL, 14 * s, '#8d7a5c');
  gregShoe(ctx, p.footL, f, s);
  limb(ctx, p.chest, p.elbowL, 12 * s, '#28507f');
  limb(ctx, p.elbowL, p.handL, 10 * s, '#cfa87f');
  ctx.fillStyle = '#cfa87f';
  ctx.beginPath(); ctx.arc(p.handL.x, p.handL.y, 8 * s, 0, TAU); ctx.fill();

  // Polo shirt, tucked in.
  gregTorso(ctx, p.hips, p.chest, s);

  limb(ctx, p.hips, p.kneeR, 17 * s, '#b89e7c');
  limb(ctx, p.kneeR, p.footR, 15 * s, '#b89e7c');
  gregShoe(ctx, p.footR, f, s);

  gregHead(ctx, p, f, s, greg);

  limb(ctx, p.chest, p.elbowR, 13 * s, '#3b6ea5');
  limb(ctx, p.elbowR, p.handR, 11 * s, '#e8c39a');
  ctx.fillStyle = '#e8c39a';
  ctx.beginPath(); ctx.arc(p.handR.x, p.handR.y, 8.5 * s, 0, TAU); ctx.fill();

  if (greg.hitFlash > 0) ctx.restore();
}

function gregTorso(ctx, hips, chest, s) {
  const ang = Math.atan2(chest.y - hips.y, chest.x - hips.x);
  const len = Math.hypot(chest.x - hips.x, chest.y - hips.y);
  ctx.save();
  ctx.translate(hips.x, hips.y);
  ctx.rotate(ang + Math.PI / 2);
  const w = 42 * s, h = len + 2 * s;
  ctx.beginPath();
  ctx.moveTo(-w / 2, 8);
  ctx.quadraticCurveTo(-w / 2 - 5, -h / 2, -w / 2 + 4, -h);
  ctx.lineTo(w / 2 - 4, -h);
  ctx.quadraticCurveTo(w / 2 + 5, -h / 2, w / 2, 8);
  ctx.closePath();
  ctx.fillStyle = '#3b6ea5';
  ctx.fill();
  ctx.strokeStyle = '#1f3a58';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // Collar + placket
  ctx.strokeStyle = '#2f5a8f';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -h + 4); ctx.lineTo(0, -h + 20 * s);
  ctx.stroke();
  ctx.fillStyle = '#5b8fc4';
  ctx.beginPath();
  ctx.moveTo(-12 * s, -h); ctx.lineTo(0, -h + 13 * s); ctx.lineTo(12 * s, -h);
  ctx.closePath(); ctx.fill();
  // Belt
  ctx.fillStyle = '#4a3320';
  ctx.fillRect(-w / 2, 0, w, 8 * s);
  ctx.fillStyle = '#c9b273';
  ctx.fillRect(-5 * s, 0, 10 * s, 8 * s);
  ctx.restore();
}

function gregShoe(ctx, foot, f, s) {
  ctx.fillStyle = '#3a2a1c';
  ctx.beginPath();
  ctx.ellipse(foot.x + f * 5 * s, foot.y + 2, 15 * s, 7 * s, 0, 0, TAU);
  ctx.fill();
}

function gregHead(ctx, p, f, s, greg) {
  const head = p.head, chest = p.chest;
  const ang = Math.atan2(head.y - chest.y, head.x - chest.x) + Math.PI / 2;
  ctx.save();
  ctx.translate(head.x, head.y);
  ctx.rotate(ang);
  ctx.scale(s * 0.82, s * 0.82);

  ctx.strokeStyle = '#e8c39a'; ctx.lineWidth = 13;
  ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(0, 20); ctx.stroke();

  // Lanyard. His true weapon.
  ctx.strokeStyle = '#2b6b4a'; ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-9, 14); ctx.quadraticCurveTo(0, 34, 9, 14);
  ctx.stroke();
  ctx.fillStyle = '#f5f1e6';
  ctx.fillRect(-7, 30, 14, 10);
  ctx.strokeStyle = '#8a8478'; ctx.lineWidth = 1;
  ctx.strokeRect(-7, 30, 14, 10);
  ctx.fillStyle = '#7a8fa8';
  ctx.fillRect(-5, 32, 5, 6);

  ctx.fillStyle = '#e8c39a';
  ctx.strokeStyle = '#3a2a1c';
  ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.ellipse(0, 0, 17, 19, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(-16, 2, 4.5, 6, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(16, 2, 4.5, 6, 0, 0, TAU); ctx.fill(); ctx.stroke();

  // Hair, in strategic retreat.
  ctx.fillStyle = '#6b5340';
  ctx.beginPath();
  ctx.ellipse(-13, -8, 6, 8, 0.4, 0, TAU);
  ctx.ellipse(13, -8, 6, 8, -0.4, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-16, -6);
  ctx.quadraticCurveTo(0, -20, 16, -6);
  ctx.quadraticCurveTo(0, -13, -16, -6);
  ctx.fill();

  if (greg.beaten) {
    ctx.strokeStyle = '#3a2a1c'; ctx.lineWidth = 2.4;
    for (const ex of [-6, 7]) {
      ctx.beginPath();
      ctx.moveTo(ex - 4, -6); ctx.lineTo(ex + 4, -1);
      ctx.moveTo(ex + 4, -6); ctx.lineTo(ex - 4, -1);
      ctx.stroke();
    }
  } else {
    // Rimless glasses and the flat stare of middle management.
    for (const ex of [-7, 7]) {
      ctx.fillStyle = '#fffdf5';
      ctx.beginPath(); ctx.arc(ex, -3, 6, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#3a2a1c'; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.fillStyle = '#181008';
      ctx.beginPath(); ctx.arc(ex + f * 1.5, -3, 2.4, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(90,90,100,0.85)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(-7, -3, 8, 0, TAU);
    ctx.arc(7, -3, 8, 0, TAU);
    ctx.moveTo(-1, -3); ctx.lineTo(1, -3);
    ctx.stroke();
    // Mouth, a flat line of policy.
    ctx.strokeStyle = '#8a5a3a'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(-6, 9); ctx.lineTo(6, 9); ctx.stroke();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ props

export function drawDynamite(ctx, d) {
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.rotate(d.rot);
  ctx.fillStyle = '#b83b2e';
  ctx.strokeStyle = '#5c1f18';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-8, -20, 16, 40, 3);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f0e0c0';
  ctx.fillRect(-8, -6, 16, 9);
  ctx.strokeRect(-8, -6, 16, 9);
  ctx.fillStyle = '#5c1f18';
  ctx.font = '900 8px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('BOOM', 0, 1);
  ctx.textAlign = 'left';
  // Fuse
  ctx.strokeStyle = '#6b5340';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, -20);
  ctx.quadraticCurveTo(6, -28, 2, -34);
  ctx.stroke();
  const flick = 3 + Math.random() * 4;
  ctx.fillStyle = Math.random() > 0.5 ? '#ffd76a' : '#fff3c4';
  ctx.beginPath(); ctx.arc(2, -34, flick, 0, TAU); ctx.fill();
  ctx.restore();
}

export function drawStapler(ctx, s) {
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.rot);
  ctx.fillStyle = '#4a5a6a';
  ctx.strokeStyle = '#22303c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-14, -6, 28, 12, 3);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#8a99a8';
  ctx.beginPath();
  ctx.roundRect(-13, -10, 24, 6, 2);
  ctx.fill(); ctx.stroke();
  ctx.restore();
}
