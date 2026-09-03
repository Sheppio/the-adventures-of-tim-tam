// Verlet point-mass physics. Small, dumb, and extremely good at flailing.
import { GRAVITY, AIR_DRAG, GROUND_Y, WORLD_W } from './config.js';

export class Particle {
  constructor(x, y, opts = {}) {
    this.x = x; this.y = y;
    this.px = x; this.py = y;
    this.r = opts.r ?? 6;
    this.mass = opts.mass ?? 1;
    this.bounce = opts.bounce ?? 0.24;
    this.groundFriction = opts.groundFriction ?? 0.74;
    this.drag = opts.drag ?? AIR_DRAG;
    this.pinned = false;
    this.grounded = false;
  }

  get vx() { return this.x - this.px; }
  get vy() { return this.y - this.py; }

  setVel(vx, vy) { this.px = this.x - vx; this.py = this.y - vy; }
  addVel(vx, vy) { this.px -= vx; this.py -= vy; }

  // Nudge toward a target position. This is how we puppet a ragdoll
  // without giving up the floppiness.
  springTo(tx, ty, k) {
    this.x += (tx - this.x) * k;
    this.y += (ty - this.y) * k;
  }

  integrate(gravityScale = 1) {
    if (this.pinned) { this.px = this.x; this.py = this.y; return; }
    const vx = (this.x - this.px) * this.drag;
    const vy = (this.y - this.py) * this.drag;
    this.px = this.x; this.py = this.y;
    this.x += vx;
    this.y += vy + GRAVITY * gravityScale;
  }

  collide() {
    this.grounded = false;
    // Floor
    if (this.y + this.r > GROUND_Y) {
      const vx = this.x - this.px, vy = this.y - this.py;
      this.y = GROUND_Y - this.r;
      this.py = this.y + vy * this.bounce;
      this.px = this.x - vx * this.groundFriction;
      this.grounded = true;
    }
    // Arena walls. Invisible, but they are canonically made of croissant.
    if (this.x - this.r < 0) {
      const vx = this.x - this.px;
      this.x = this.r;
      this.px = this.x + vx * 0.4;
    } else if (this.x + this.r > WORLD_W) {
      const vx = this.x - this.px;
      this.x = WORLD_W - this.r;
      this.px = this.x + vx * 0.4;
    }
    // Ceiling, so nobody leaves the arena permanently.
    if (this.y < -1400) { this.y = -1400; this.py = this.y - 1; }
  }
}

export class Stick {
  constructor(a, b, opts = {}) {
    this.a = a; this.b = b;
    this.len = opts.len ?? Math.hypot(b.x - a.x, b.y - a.y);
    this.stiff = opts.stiff ?? 1;
    // A "brace" only resists compression -- lets limbs bend one way only,
    // which is the difference between a ragdoll and a bag of elbows.
    this.mode = opts.mode ?? 'both'; // 'both' | 'min' | 'max'
  }

  solve() {
    const a = this.a, b = this.b;
    let dx = b.x - a.x, dy = b.y - a.y;
    let d = Math.hypot(dx, dy);
    if (d < 1e-6) { dx = 0.01; d = 0.01; }
    if (this.mode === 'min' && d > this.len) return;
    if (this.mode === 'max' && d < this.len) return;
    const wa = a.pinned ? 0 : 1 / a.mass;
    const wb = b.pinned ? 0 : 1 / b.mass;
    const wsum = wa + wb;
    if (wsum === 0) return;
    const diff = ((d - this.len) / d) * this.stiff;
    const ox = dx * diff, oy = dy * diff;
    a.x += ox * (wa / wsum); a.y += oy * (wa / wsum);
    b.x -= ox * (wb / wsum); b.y -= oy * (wb / wsum);
  }
}

export function solveAll(sticks, iterations, particles) {
  for (let i = 0; i < iterations; i++) {
    for (const s of sticks) s.solve();
    for (const p of particles) p.collide();
  }
}

// Radial impulse. Used by dynamite, geese, Greg, and the universe's whims.
export function blast(particles, cx, cy, radius, force) {
  for (const p of particles) {
    if (p.pinned) continue;
    const dx = p.x - cx, dy = p.y - cy;
    const d = Math.hypot(dx, dy);
    if (d > radius) continue;
    const falloff = 1 - d / radius;
    const n = d < 1e-4 ? { x: 0, y: -1 } : { x: dx / d, y: dy / d };
    const mag = force * falloff * falloff / p.mass;
    // Bias upward, because things flying up is funnier than things sliding.
    p.addVel(n.x * mag, n.y * mag - mag * 0.55);
  }
}

export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
