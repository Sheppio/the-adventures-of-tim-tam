// Tim Tam. Baker. Idiot. Immortal.
//
// He has no health bar and no death animation, because there is no state of
// affairs in which Tim Tam stops. Hit him hard enough and he becomes a sack
// of limbs for a second and a half, then he stands back up and resumes
// slapping. That is the entire character arc.
import { Ragdoll } from './ragdoll.js';
import { HERO, BAGUETTE, DYNAMITE, GROUND_Y } from './config.js';
import { rand, pick, clamp } from './physics.js';
import { say, spawnBits, addShake } from './fx.js';
import { sfxThwack, sfxThud } from './audio.js';

const OOF = [
  'ow', 'that was my hip', 'still fine', 'unhurt!', 'tis but a flesh wound',
  'my beret!', 'ooooof', 'this is fine', 'i meant to do that',
  'no notes', 'again!', 'the bread is undamaged', 'i am unkillable, actually',
];

const SLAP_WORDS = ['THWACK!', 'BAGUETTE!', 'BONK', 'CRUNCH!', 'BAGUETTED', 'SLAP!', 'CROUTON!'];

export class Hero {
  constructor(x) {
    this.rag = new Ragdoll(x, GROUND_Y - 60, 1.18, { tint: '#f2d5a8' });
    this.rag.getUpFrames = HERO.getUpDuration;
    this.swing = 0;            // frames left in the current swing
    this.slapCd = 0;
    this.boomCd = 0;
    this.flops = 0;            // "deaths", except he doesn't
    this.slaps = 0;
    this.hitThisSwing = new Set();
    this.blinkT = 0;
    this.eyeWander = 0;
    this.wakeGrace = 0;        // brief post-getup window where he can't be re-floored
    this._wasConscious = true;
  }

  get x() { return this.rag.p.hips.x; }
  get y() { return this.rag.p.hips.y; }
  get conscious() { return this.rag.conscious; }
  get facing() { return this.rag.facing; }

  // Where the bread is, and which way it points.
  baguetteTransform() {
    const hand = this.rag.p.handR;
    const f = this.rag.facing;
    let ang;
    if (this.swing > 0) {
      const t = 1 - this.swing / HERO.slapDuration;
      const e = 1 - Math.pow(1 - t, 2.4);          // fast out, slow finish
      ang = -2.25 + e * 3.1;
    } else {
      // Resting jauntily on the shoulder like a rifle he is not licensed for.
      ang = -0.55 + Math.sin(this.rag.armSwing * 0.4) * 0.09;
    }
    const len = BAGUETTE.length;
    // Direction vector, mirrored for left-facing.
    return {
      x: hand.x, y: hand.y, ang, len,
      dx: Math.cos(ang) * f,
      dy: Math.sin(ang),
    };
  }

  baguetteSegment() {
    const b = this.baguetteTransform();
    return {
      x1: b.x, y1: b.y,
      x2: b.x + b.dx * b.len,
      y2: b.y + b.dy * b.len,
    };
  }

  // The window where bread is genuinely dangerous.
  get swingActive() {
    if (this.swing <= 0) return false;
    const t = 1 - this.swing / HERO.slapDuration;
    return t > 0.1 && t < 0.8;
  }

  startSwing() {
    if (this.slapCd > 0 || !this.conscious) return false;
    this.swing = HERO.slapDuration;
    this.slapCd = HERO.slapCooldown;
    this.hitThisSwing.clear();
    return true;
  }

  registerHit(target, x, y) {
    if (this.hitThisSwing.has(target)) return false;
    this.hitThisSwing.add(target);
    this.slaps++;
    sfxThwack(rand(0.85, 1.2));
    say(x, y - 38, pick(SLAP_WORDS), { color: '#ffe9a8', size: 22, wobble: 3, maxLife: 52 });
    spawnBits(x, y, 9, { colors: ['#f2c14e', '#fff3d0', '#e0a83a'], spread: 6 });
    addShake(5);
    return true;
  }

  // Something hit Tim Tam. This is a scheduling inconvenience, not a threat.
  takeHit(power, fromX, fromY) {
    if (!this.conscious) return;
    const hips = this.rag.p.hips;
    const dir = Math.sign(hips.x - fromX) || 1;
    // Just got up: absorb one knockdown-tier hit as a stagger. Without this
    // a flock can chain him from one flop straight into the next and he
    // spends the fight on his back, which isn't a fight.
    if (power >= HERO.knockdownThreshold && this.wakeGrace > 0) {
      this.wakeGrace = 0;
      this.rag.applyImpulse(dir * power * 0.55, -power * 0.35, 0.4);
      sfxThud();
      say(hips.x, hips.y - 70, pick(OOF), { color: '#ffd7d7', size: 19, maxLife: 70 });
      addShake(5);
      return;
    }
    if (power >= HERO.knockdownThreshold) {
      this.flops++;
      this.rag.flop(HERO.flopDuration, dir * power * 0.42, -power * 0.5);
      sfxThud();
      say(hips.x, hips.y - 70, pick(OOF), { color: '#ffd7d7', size: 21, maxLife: 92 });
      addShake(8);
    } else {
      // Not even enough to interrupt him.
      this.rag.applyImpulse(dir * power * 0.5, -power * 0.3, 0.4);
      this.rag.p.head.addVel(dir * power * 0.3, -power * 0.2);
    }
  }

  update(input) {
    const rag = this.rag;
    // Arm the grace window on the frame he finishes standing up.
    if (rag.conscious && !this._wasConscious) this.wakeGrace = HERO.wakeGrace;
    this._wasConscious = rag.conscious;
    if (this.wakeGrace > 0) this.wakeGrace--;
    if (this.slapCd > 0) this.slapCd--;
    if (this.boomCd > 0) this.boomCd--;
    if (this.swing > 0) this.swing--;
    this.blinkT--;
    if (this.blinkT < -180) this.blinkT = rand(6, 12);
    this.eyeWander += 0.021;

    let move = 0;
    if (rag.conscious) {
      if (input.left) move -= 1;
      if (input.right) move += 1;
      rag.driveStand(move, input.jump, { speed: HERO.speed, jump: HERO.jump });
      this.driveBaguetteArm();
    } else {
      // No inputs while limp. He is busy.
      rag.gait += 0.02;
    }
    rag.update();
    return move;
  }

  driveBaguetteArm() {
    const { chest, handR, elbowR } = this.rag.p;
    const f = this.rag.facing;
    const dr = this.rag.drive;
    if (this.swing > 0) {
      const t = 1 - this.swing / HERO.slapDuration;
      const e = 1 - Math.pow(1 - t, 2.4);
      const a = -2.0 + e * 2.9;
      const R = 30;
      handR.springTo(chest.x + Math.cos(a) * R * f, chest.y + Math.sin(a) * R + 4, 0.55 * dr);
      elbowR.springTo(chest.x + f * 14, chest.y + 4, 0.3 * dr);
    } else {
      handR.springTo(chest.x + f * 15, chest.y + 8, 0.2 * dr);
    }
  }

  canThrow() { return this.boomCd <= 0 && this.conscious; }

  throwDynamite() {
    this.boomCd = DYNAMITE.cooldown;
    const hand = this.rag.p.handL;
    const f = this.rag.facing;
    return {
      x: hand.x + f * 8, y: hand.y - 6,
      vx: f * DYNAMITE.throwPower + this.rag.p.hips.vx * 0.5,
      vy: -DYNAMITE.throwPower * 0.62,
      fuse: DYNAMITE.fuse,
      rot: 0, spin: f * 0.34,
    };
  }
}
