// Geese. The antagonists. Motive: unclear. Committed, though.
import { Particle, Stick, solveAll, rand, randInt, pick, clamp } from './physics.js';
import { GROUND_Y, GOOSE } from './config.js';
import { spawnFeathers, say, spawnBits } from './fx.js';
import { sfxHonk, sfxThud } from './audio.js';

const HONKS = ['HONK', 'HONK!', 'HOOONK', 'hnk', 'HONK?!', 'HNGGK'];

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

    this.hp = 2;
    this.facing = -1;
    this.state = 'wander';
    this.stateT = randInt(30, 120);
    this.limpT = 0;
    this.deadT = -1;
    this.gait = rand(0, 6.28);
    this.honkCd = randInt(60, 240);
    this.peckT = 0;
    this.standHeight = 38;
    this.drive = 1;
  }

  get x() { return this.body.x; }
  get y() { return this.body.y; }
  get alive() { return this.deadT < 0; }
  get conscious() { return this.deadT < 0 && this.limpT <= 0; }

  honk() {
    sfxHonk();
    say(this.head.x, this.head.y - 22, pick(HONKS), { color: '#ffffff', size: 17, maxLife: 52 });
    this.honkCd = randInt(90, 320);
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
      this.limpT = randInt(80, 130);
      this.drive = 0;
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

  update(hero) {
    if (this.deadT >= 0) {
      this.deadT++;
    } else if (this.limpT > 0) {
      this.limpT--;
      if (this.limpT === 0) this.getUp = 40;
    } else if (this.getUp > 0) {
      this.getUp--;
      this.drive = 1 - this.getUp / 40;
    } else {
      this.drive = 1;
      this.think(hero);
    }

    if (this.drive > 0.02) this.driveBody(hero);

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
  }

  think(hero) {
    if (--this.honkCd <= 0) this.honk();
    this.stateT--;
    const dx = hero.x - this.body.x;
    const dist = Math.abs(dx);

    if (this.peckT > 0) this.peckT--;

    if (dist < GOOSE.peckRange && hero.conscious) {
      this.state = 'peck';
      if (this.peckT <= 0) this.peckT = 34;
    } else if (dist < 420) {
      this.state = 'charge';
    } else if (this.stateT <= 0) {
      this.state = this.state === 'wander' ? 'idle' : 'wander';
      this.stateT = randInt(40, 150);
      if (Math.random() < 0.4) this.wanderDir = pick([-1, 1]);
    }
    if (dx !== 0 && this.state !== 'idle') this.facing = Math.sign(dx);
  }

  driveBody(hero) {
    const b = this.body, dr = this.drive, f = this.facing;
    const targetY = GROUND_Y - this.standHeight;

    let want = 0;
    if (this.state === 'charge') want = f * GOOSE.chargeSpeed;
    else if (this.state === 'wander') want = (this.wanderDir ?? f) * GOOSE.speed;
    else if (this.state === 'peck') want = f * 0.4;

    b.addVel((want - b.vx) * 0.12 * dr, 0);
    this._wantVx = want;
    this._driveVel = true;
    if (b.y > targetY) {
      b.addVel(0, -Math.min((b.y - targetY) * 0.3, 12) * dr);
      b.setVel(b.vx, b.vy * (1 - 0.2 * dr));
    }

    // Neck. Extends alarmingly when pecking.
    const peck = this.peckT > 0 ? Math.sin((1 - this.peckT / 34) * Math.PI) : 0;
    const nx = b.x + f * (14 + peck * 34);
    const ny = b.y - 41 + peck * 36;
    this.head.springTo(nx, ny, 0.3 * dr);

    // Waddle.
    this.gait += Math.abs(b.vx) * 0.19 + 0.02;
    const stride = clamp(Math.abs(b.vx) * 3.4, 2, 13);
    const foot = (p, phase, side) => {
      const sw = Math.sin(phase);
      const lift = Math.max(0, Math.sin(phase + Math.PI / 2)) * clamp(Math.abs(b.vx) * 3, 0, 12);
      p.springTo(b.x + side * 6 + sw * stride, GROUND_Y - 4 - lift, 0.3 * dr);
    };
    foot(this.footL, this.gait, -1);
    foot(this.footR, this.gait + Math.PI, 1);
  }

  // Is the goose currently jabbing its face at something?
  peckHitbox() {
    if (this.peckT < 10 || this.peckT > 26) return null;
    return { x: this.head.x, y: this.head.y, r: 18 };
  }
}
