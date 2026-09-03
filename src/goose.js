// Geese. The antagonists. Motive: unclear. Committed, though.
import { Particle, Stick, solveAll, rand, randInt, pick, clamp } from './physics.js';
import { GROUND_Y, GOOSE } from './config.js';
import { spawnFeathers, say, addShake } from './fx.js';
import { sfxHonk, sfxThud } from './audio.js';

const HONKS = ['HONK', 'HONK!', 'HOOONK', 'hnk', 'HONK?!', 'HNGGK'];
const RAGE_HONKS = ['HOOOONK', 'HONK HONK', 'REEE', 'HNNNGK', 'UNFORGIVABLE'];

// States that take place in the air, where the leg spring must not run.
const AIRBORNE = new Set(['climb', 'hover', 'dive']);

export class Goose {
  constructor(x, y = GROUND_Y - 40) {
    // Everything is placed relative to the body, so a goose that arrives at
    // altitude doesn't get born with 300px legs.
    const P = (px, py, r, m) => new Particle(px, py, { r, mass: m, groundFriction: 0.8 });
    this.body = P(x, y, 15, 1.7);
    this.head = P(x + 15, y - 42, 8, 0.55);
    this.footL = P(x - 6, y + 32, 4, 0.4);
    this.footR = P(x + 6, y + 32, 4, 0.4);
    this.list = [this.body, this.head, this.footL, this.footR];
    const S = (a, b, stiff, mode, len) => new Stick(a, b, { stiff, mode, len });
    this.sticks = [
      S(this.body, this.head, 0.8, 'both', 45),
      S(this.body, this.footL, 0.95, 'both', 33),
      S(this.body, this.footR, 0.95, 'both', 33),
      S(this.body, this.head, 0.5, 'min', 30),
      S(this.footL, this.footR, 0.1, 'max', 34),
    ];

    this.hp = GOOSE.hp;
    this.facing = -1;
    this.state = 'wander';
    this.stateT = randInt(30, 120);
    this.limpT = 0;
    this.deadT = -1;
    this.getUp = 0;
    this.gait = rand(0, 6.28);
    this.flap = rand(0, 6.28);
    this.honkCd = randInt(60, 240);
    this.peckT = 0;
    this.buffetT = 0;
    this.attackCd = randInt(20, 70);
    this.diveCd = randInt(90, 300);
    this.rage = 0;
    this.standHeight = 38;
    this.drive = 1;
    // Which side of Tim Tam this goose wants to occupy. Without this they
    // all pile onto whichever side they spawned and he only has to face one way.
    this.slot = pick([-1, 1]);
    this.diver = Math.random() < 0.35;
    this.standoff = this.diver ? rand(190, 330) : rand(28, 52);
  }

  get x() { return this.body.x; }
  get y() { return this.body.y; }
  get alive() { return this.deadT < 0; }
  get conscious() { return this.deadT < 0 && this.limpT <= 0; }
  get flying() { return AIRBORNE.has(this.state); }
  get raging() { return this.rage > 0; }

  honk() {
    sfxHonk();
    const angry = this.raging;
    say(this.head.x, this.head.y - 22, pick(angry ? RAGE_HONKS : HONKS), {
      color: angry ? '#ff8a7a' : '#ffffff', size: angry ? 20 : 17, maxLife: 52,
    });
    this.honkCd = randInt(angry ? 40 : 90, angry ? 140 : 320);
  }

  // Watching a flockmate get launched is radicalising.
  enrage() {
    if (!this.conscious) return;
    this.rage = GOOSE.rageDuration;
    this.diveCd = Math.min(this.diveCd, 40);
    if (Math.random() < 0.5) this.honkCd = 0;
  }

  hit(power, fromX, fromY, opts = {}) {
    if (!this.alive) return false;
    const dir = Math.sign(this.body.x - fromX) || 1;
    this.hp -= opts.damage ?? 1;
    const push = power;
    for (const p of this.list) {
      p.addVel(dir * push * rand(0.35, 0.7) / p.mass, -push * rand(0.85, 1.25) / p.mass);
    }
    this.head.addVel(dir * push * 0.5, -push * 0.7);
    spawnFeathers(this.body.x, this.body.y, 10);
    if (this.hp <= 0) {
      this.die();
    } else {
      // Shorter than it was. They used to spend two seconds out of the fight
      // after a hit that didn't kill them, which read as them giving up.
      this.limpT = randInt(42, 74);
      this.drive = 0;
      this.peckT = this.buffetT = 0;
      this.state = 'wander';
      this.rage = Math.max(this.rage, GOOSE.rageDuration);  // survived it. furious.
      sfxHonk();
    }
    return true;
  }

  die() {
    this.deadT = 0;
    this.drive = 0;
    this.limpT = 9999;
    spawnFeathers(this.body.x, this.body.y, 26);
    sfxHonk();
    if (Math.random() < 0.45) {
      say(this.body.x, this.body.y - 40, pick(['honk...', 'goodbye', 'HONK (final)', 'oh no']), {
        color: '#ffd9d9', size: 18, maxLife: 70,
      });
    }
  }

  // Slammed into the ground at the end of a dive.
  crash() {
    this.state = 'wander';
    this.limpT = randInt(26, 44);
    this.drive = 0;
    this.diveCd = randInt(150, 320);
    this.attackCd = 40;
    spawnFeathers(this.body.x, this.body.y, 8);
    sfxThud();
    addShake(2);
  }

  update(hero) {
    if (this.rage > 0) this.rage--;
    if (this.attackCd > 0) this.attackCd--;
    if (this.diveCd > 0) this.diveCd--;

    if (this.deadT >= 0) {
      this.deadT++;
    } else if (this.limpT > 0) {
      this.limpT--;
      if (this.limpT === 0) this.getUp = 26;
    } else if (this.getUp > 0) {
      this.getUp--;
      this.drive = 1 - this.getUp / 26;
    } else {
      this.drive = 1;
      this.think(hero);
    }

    if (this.drive > 0.02) {
      if (this.flying) this.driveFlight(hero);
      else this.driveBody(hero);
    }

    for (const p of this.list) p.integrate();

    const rooted = this._driveVel && this.drive > 0.01;
    const preX = this.body.x;

    solveAll(this.sticks, 3, this.list);

    if (rooted) {
      const a = 0.9 * this.drive;
      this.body.x += (preX - this.body.x) * a;
      this.body.setVel(this.body.vx + (this._wantVx - this.body.vx) * 0.5 * this.drive, this.body.vy);
      this.body.collide();
      this._driveVel = false;
    }

    // A dive ends against the ground if it didn't end against Tim Tam.
    if (this.state === 'dive' && this.body.y > GROUND_Y - 26) this.crash();
  }

  think(hero) {
    if (--this.honkCd <= 0) this.honk();
    this.stateT--;
    if (this.peckT > 0) this.peckT--;
    if (this.buffetT > 0) this.buffetT--;

    const dx = hero.x - this.body.x;
    const dist = Math.abs(dx);
    const raging = this.raging;

    // Committed attacks run to completion -- including the facing lock, so a
    // goose can't pivot mid-swing to track him.
    if (this.buffetT > 0) { this.state = 'buffet'; return; }
    if (this.flying) { this.flightThink(hero); return; }

    // Take off for a dive. Needs a little room to get up to speed, but the
    // climb itself opens distance, so the floor is low.
    const diveOdds = (this.diver ? 0.085 : 0.02) * (raging ? 2.4 : 1);
    if (hero.conscious && this.diveCd <= 0 &&
        dist > 90 && dist < GOOSE.diveRange && Math.random() < diveOdds) {
      this.state = 'climb';
      this.diveY = GROUND_Y - rand(250, 340);
      this.facing = Math.sign(dx) || this.facing;
      return;
    }

    if (hero.conscious && dist < GOOSE.buffetRange && this.attackCd <= 0 &&
        Math.random() < (raging ? 0.5 : 0.28)) {
      this.state = 'buffet';
      this.buffetT = 38;
      this.attackCd = raging ? 46 : 82;
      this.facing = Math.sign(dx) || this.facing;
      return;
    }

    if (dist < GOOSE.peckRange && hero.conscious) {
      this.state = 'peck';
      if (this.peckT <= 0 && this.attackCd <= 0) {
        this.peckT = 26;
        this.attackCd = raging ? 14 : 28;
      }
    } else if (hero.conscious || dist > 260) {
      // No aggro leash. A goose that can't see him still knows.
      this.state = 'charge';
    } else if (this.stateT <= 0) {
      // Only mills about when he's already on the floor nearby.
      this.state = this.state === 'wander' ? 'idle' : 'wander';
      this.stateT = randInt(40, 150);
      if (Math.random() < 0.4) this.wanderDir = pick([-1, 1]);
    }

    // Re-pick a flanking side now and then so they don't all settle on one.
    if (this.stateT <= 0 && Math.random() < 0.5) {
      this.slot = pick([-1, 1]);
      this.standoff = this.diver ? rand(190, 330) : rand(28, 52);
    }
    if (dx !== 0 && this.state !== 'idle') this.facing = Math.sign(dx);
  }

  flightThink(hero) {
    const b = this.body;
    if (this.state === 'climb') {
      if (b.y <= this.diveY + 24) {
        this.state = 'hover';
        this.stateT = randInt(20, 36);
        // Telegraph. Being dive-bombed with no warning is just unfair.
        say(b.x, b.y - 34, '!!', { color: '#ff6b5a', size: 26, maxLife: 40 });
        this.honk();
      }
    } else if (this.state === 'hover') {
      if (--this.stateT <= 0) {
        // Lead the target slightly, then commit. No steering after this
        // point, which is what makes a dive dodgeable.
        const tx = hero.x + hero.rag.p.hips.vx * 7;
        const ty = hero.y + 12;
        const d = Math.hypot(tx - b.x, ty - b.y) || 1;
        this.diveVx = ((tx - b.x) / d) * GOOSE.diveSpeed;
        this.diveVy = ((ty - b.y) / d) * GOOSE.diveSpeed;
        this.state = 'dive';
        this.facing = Math.sign(this.diveVx) || this.facing;
        sfxHonk();
      }
    }
  }

  driveFlight() {
    const b = this.body, dr = this.drive;
    this.flap += this.state === 'dive' ? 0.22 : 0.62;
    const f = this.facing;

    if (this.state === 'climb') {
      b.addVel(0, (-(b.y - this.diveY) * 0.035 - b.vy * 0.14) * dr);
      b.addVel((f * 1.2 - b.vx) * 0.06 * dr, 0);
    } else if (this.state === 'hover') {
      b.addVel(0, (-(b.y - this.diveY) * 0.06 - b.vy * 0.32) * dr);
      b.addVel((f * 1.6 - b.vx) * 0.09 * dr, 0);
    } else {
      b.setVel(this.diveVx, this.diveVy);
    }

    // Neck out front, feet tucked behind: the silhouette sells the attack.
    const ny = this.state === 'dive' ? b.y + 8 : b.y - 16;
    this.head.springTo(b.x + f * 22, ny, 0.34 * dr);
    this.footL.springTo(b.x - f * 15, b.y + 13, 0.22 * dr);
    this.footR.springTo(b.x - f * 11, b.y + 16, 0.22 * dr);
  }

  driveBody(hero) {
    const b = this.body, dr = this.drive, f = this.facing;
    const targetY = GROUND_Y - this.standHeight;
    const rageMul = this.raging ? 1.32 : 1;

    let want = 0;
    if (this.state === 'charge') {
      // Aim for a spot beside Tim Tam rather than at him, so a flock
      // surrounds him instead of stacking up on one shoulder.
      const goal = hero.x + this.slot * this.standoff;
      const d = goal - b.x;
      const spd = (this.diver ? GOOSE.speed * 1.4 : GOOSE.chargeSpeed) * rageMul;
      want = Math.abs(d) < 10 ? 0 : clamp(d * 0.055, -1, 1) * spd;
    } else if (this.state === 'wander') {
      want = (this.wanderDir ?? f) * GOOSE.speed;
    } else if (this.state === 'peck') {
      want = f * 0.4;
    } else if (this.state === 'buffet') {
      // Lunges forward on the swing itself.
      want = this.buffetT < 24 && this.buffetT > 12 ? f * 3.4 : f * 0.3;
    }

    b.addVel((want - b.vx) * 0.12 * dr, 0);
    this._wantVx = want;
    this._driveVel = true;
    if (b.y > targetY) {
      b.addVel(0, -Math.min((b.y - targetY) * 0.3, 12) * dr);
      b.setVel(b.vx, b.vy * (1 - 0.2 * dr));
    }

    // Neck. Extends alarmingly when pecking.
    const peck = this.peckT > 0 ? Math.sin((1 - this.peckT / 26) * Math.PI) : 0;
    const rear = this.state === 'buffet' ? Math.sin((1 - this.buffetT / 38) * Math.PI) : 0;
    const nx = b.x + f * (14 + peck * 34 + rear * 10);
    const ny = b.y - 41 + peck * 36 - rear * 12;
    this.head.springTo(nx, ny, 0.3 * dr);

    // Waddle.
    this.gait += Math.abs(b.vx) * 0.19 + 0.02;
    if (this.state === 'buffet') this.flap += 0.75;
    const stride = clamp(Math.abs(b.vx) * 3.4, 2, 13);
    const foot = (p, phase, side) => {
      const sw = Math.sin(phase);
      const lift = Math.max(0, Math.sin(phase + Math.PI / 2)) * clamp(Math.abs(b.vx) * 3, 0, 12);
      p.springTo(b.x + side * 6 + sw * stride, GROUND_Y - 4 - lift, 0.3 * dr);
    };
    foot(this.footL, this.gait, -1);
    foot(this.footR, this.gait + Math.PI, 1);
  }

  // --- hitboxes, read by the world each frame ---

  // Is the goose currently jabbing its face at something?
  peckHitbox() {
    if (this.peckT < 8 || this.peckT > 20) return null;
    return { x: this.head.x, y: this.head.y, r: 18, damage: GOOSE.peckDamage };
  }

  // Wing shove. Wide, slow, and it puts him on his back.
  buffetHitbox() {
    if (this.buffetT < 13 || this.buffetT > 24) return null;
    return { x: this.body.x + this.facing * 24, y: this.body.y - 2, r: 32, damage: GOOSE.buffetDamage };
  }

  diveHitbox() {
    if (this.state !== 'dive') return null;
    return { x: this.head.x, y: this.head.y, r: 24, damage: GOOSE.diveDamage };
  }

  // Every way a goose can currently be hurting Tim Tam.
  attackHitboxes() {
    const out = [];
    const d = this.diveHitbox(); if (d) out.push(d);
    const b = this.buffetHitbox(); if (b) out.push(b);
    const p = this.peckHitbox(); if (p) out.push(p);
    return out;
  }
}
