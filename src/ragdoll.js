// A humanoid ragdoll that can also, reluctantly, walk.
//
// The trick: the hips are puppeted with velocity control while a character
// is conscious, and everything else just dangles off them on springs. Set
// `drive` to 0 and the puppeteer lets go -- instant, honest ragdoll.
import { Particle, Stick, solveAll, clamp } from './physics.js';
import { GROUND_Y } from './config.js';

const lerp = (a, b, t) => a + (b - a) * t;

export class Ragdoll {
  constructor(x, y, scale = 1, opts = {}) {
    this.scale = scale;
    this.facing = 1;
    this.drive = 1;          // 0 = full ragdoll, 1 = fully in control
    this.jumpLock = 0;
    this.gait = 0;
    this.crouch = 0;
    this.limpTimer = 0;      // frames left flopping
    this.getUpTimer = 0;     // frames left wobbling upright
    this.armSwing = 0;
    this.tint = opts.tint ?? '#e8e0d0';

    const s = scale;
    this.dims = {
      neck: 24 * s, spine: 32 * s,
      upperArm: 17 * s, foreArm: 17 * s,
      thigh: 24 * s, shin: 24 * s,
      headR: 20 * s,
      stance: 15 * s,
    };
    const d = this.dims;
    this.standHeight = (d.thigh + d.shin) * 0.94 + 5 * s;

    const P = (px, py, r, mass) => new Particle(px, py, { r: r * s, mass });
    const hips  = P(x, y, 8, 2.4);
    const chest = P(x, y - d.spine, 9, 2.0);
    const head  = P(x, y - d.spine - d.neck, 14, 1.5);
    const elbowL = P(x - 8 * s, y - d.spine + 10 * s, 4, 0.5);
    const elbowR = P(x + 8 * s, y - d.spine + 10 * s, 4, 0.5);
    const handL = P(x - 12 * s, y - d.spine + 26 * s, 5, 0.45);
    const handR = P(x + 12 * s, y - d.spine + 26 * s, 5, 0.45);
    const kneeL = P(x - d.stance, y + d.thigh, 5, 0.8);
    const kneeR = P(x + d.stance, y + d.thigh, 5, 0.8);
    const footL = P(x - d.stance, y + d.thigh + d.shin, 5, 0.7);
    const footR = P(x + d.stance, y + d.thigh + d.shin, 5, 0.7);

    this.p = { hips, chest, head, elbowL, elbowR, handL, handR, kneeL, kneeR, footL, footR };
    this.list = Object.values(this.p);

    const S = (a, b, stiff, mode, len) => new Stick(a, b, { stiff, mode, len });
    this.sticks = [
      S(hips, chest, 1),
      S(chest, head, 1),
      S(chest, elbowL, 0.9), S(elbowL, handL, 0.9),
      S(chest, elbowR, 0.9), S(elbowR, handR, 0.9),
      S(hips, kneeL, 1), S(kneeL, footL, 1),
      S(hips, kneeR, 1), S(kneeR, footR, 1),
      // Bracing: stops the body folding into a croissant.
      S(hips, head, 0.55, 'max', d.spine + d.neck),
      S(hips, head, 0.35, 'min', (d.spine + d.neck) * 0.62),
      S(chest, handL, 0.4, 'max', d.upperArm + d.foreArm),
      S(chest, handR, 0.4, 'max', d.upperArm + d.foreArm),
      S(hips, footL, 0.5, 'max', d.thigh + d.shin),
      S(hips, footR, 0.5, 'max', d.thigh + d.shin),
      S(footL, footR, 0.12, 'max', d.stance * 6),
    ];
  }

  get x() { return this.p.hips.x; }
  get y() { return this.p.hips.y; }
  get conscious() { return this.limpTimer <= 0; }

  center() {
    let x = 0, y = 0, m = 0;
    for (const p of this.list) { x += p.x * p.mass; y += p.y * p.mass; m += p.mass; }
    return { x: x / m, y: y / m };
  }

  applyImpulse(vx, vy, spread = 0.6) {
    for (const p of this.list) {
      const f = (1 - spread) + Math.random() * spread * 2;
      p.addVel(vx * f / p.mass, vy * f / p.mass);
    }
  }

  // Go limp. No death animation, because nobody here is dying.
  flop(frames, vx = 0, vy = 0) {
    this.limpTimer = Math.max(this.limpTimer, frames);
    this.drive = 0;
    if (vx || vy) this.applyImpulse(vx, vy, 0.8);
  }

  // ---- driving ------------------------------------------------------------

  driveStand(moveDir, wantJump, opts = {}) {
    const hips = this.p.hips;
    const dr = this.drive;
    if (dr <= 0.001) return false;

    const targetY = GROUND_Y - this.standHeight - this.crouch;
    const speed = opts.speed ?? 3.2;
    const grounded = hips.y > targetY - 12 * this.scale;

    // Horizontal: the authoritative correction happens after the constraint
    // solve (see update), because limb springs quietly leak momentum into the
    // hips and he'd moonwalk across the arena while standing still.
    const want = moveDir * speed;
    this._wantVx = want;
    this._driveVel = true;
    hips.addVel((want - hips.vx) * 0.18 * dr, 0);

    // Vertical: a leg spring that only ever pushes up.
    if (this.jumpLock > 0) this.jumpLock--;
    else if (hips.y > targetY) {
      const err = hips.y - targetY;
      hips.addVel(0, -Math.min(err * 0.34, 14) * dr);
      hips.setVel(hips.vx, hips.vy * (1 - 0.30 * dr));
      // Landing from orbit shouldn't fire him straight back into it.
      if (hips.vy < -8) hips.setVel(hips.vx, -8);
    }

    if (wantJump && grounded && this.jumpLock <= 0) {
      hips.addVel(0, -(opts.jump ?? 12));
      this.p.chest.addVel(0, -(opts.jump ?? 12) * 0.4);
      this.jumpLock = 20;
      this.crouch = -6 * this.scale;
    }

    this.crouch = lerp(this.crouch, 0, 0.12);
    if (moveDir !== 0) this.facing = moveDir > 0 ? 1 : -1;

    // Gait phase tracks actual speed, so he moonwalks if shoved backwards.
    this.gait += Math.abs(hips.vx) * 0.13 + 0.012;
    this.driveLimbs(grounded, Math.abs(hips.vx));
    return grounded;
  }

  driveLimbs(grounded, spd) {
    const { hips, chest, head, footL, footR, kneeL, kneeR, handL, elbowL, elbowR } = this.p;
    const d = this.dims, dr = this.drive, s = this.scale, f = this.facing;

    // Torso stacks itself above the hips, leaning into the run.
    const lean = clamp(hips.vx * 1.5, -9, 9) * s;
    chest.springTo(hips.x + lean * 0.45, hips.y - d.spine, 0.30 * dr);
    head.springTo(chest.x + lean * 0.5, chest.y - d.neck, 0.26 * dr);

    // Legs
    const stride = clamp(spd * 4.2, 0, 21) * s;
    const legY = GROUND_Y - 4 * s;
    if (grounded) {
      const walking = spd > 0.35;
      const set = (foot, knee, phase, side) => {
        // Standing still means standing still -- no phantom moonwalking.
        const sw = walking ? Math.sin(phase) : 0;
        const lift = walking
          ? Math.max(0, Math.sin(phase + Math.PI / 2)) * clamp(spd * 4, 0, 20) * s
          : 0;
        const tx = hips.x + side * d.stance * 0.8 + sw * stride;
        const ty = legY - lift;
        foot.springTo(tx, ty, 0.30 * dr);
        knee.springTo((hips.x + tx) / 2 + f * 5 * s + side * d.stance * 0.5, (hips.y + ty) / 2, 0.16 * dr);
      };
      set(footL, kneeL, this.gait, -1);
      set(footR, kneeR, this.gait + Math.PI, 1);
    } else {
      // Airborne: legs tuck up in a way that is not athletic.
      footL.springTo(hips.x - f * 9 * s, hips.y + 30 * s, 0.14 * dr);
      footR.springTo(hips.x + f * 4 * s, hips.y + 40 * s, 0.14 * dr);
      kneeL.springTo(hips.x - f * 6 * s, hips.y + 16 * s, 0.10 * dr);
      kneeR.springTo(hips.x + f * 3 * s, hips.y + 20 * s, 0.10 * dr);
    }

    // Off-hand flaps for balance. It does not help.
    this.armSwing += 0.16 + spd * 0.04;
    const flap = Math.sin(this.armSwing) * 12 * s;
    handL.springTo(chest.x - f * 16 * s, chest.y + 22 * s + flap, 0.14 * dr);
    elbowL.springTo(chest.x - f * 10 * s, chest.y + 10 * s, 0.10 * dr);
    elbowR.springTo(chest.x + f * 12 * s, chest.y + 9 * s, 0.10 * dr);
  }

  update(gravityScale = 1) {
    if (this.limpTimer > 0) {
      this.limpTimer--;
      if (this.limpTimer === 0) this.getUpTimer = this.getUpFrames ?? 30;
    } else if (this.getUpTimer > 0) {
      this.getUpTimer--;
      // Drive fades back in, so he levitates upright like a broken deckchair.
      this.drive = 1 - this.getUpTimer / (this.getUpFrames ?? 30);
    } else {
      this.drive = 1;
    }
    for (const p of this.list) p.integrate(gravityScale);

    // While he's conscious the hips are the root: the solver may not shove
    // them sideways, or the arm springs walk him out of the arena on their own.
    const hips = this.p.hips;
    const rooted = this._driveVel && this.drive > 0.01;
    const preX = hips.x;

    solveAll(this.sticks, 4, this.list);

    if (rooted) {
      const a = 0.92 * this.drive;
      hips.x += (preX - hips.x) * a;
      hips.setVel(hips.vx + (this._wantVx - hips.vx) * 0.6 * this.drive, hips.vy);
      hips.collide();
      this._driveVel = false;
    }
  }
}
