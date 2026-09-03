// Greg.
//
// That's it. That's the boss. Some dude named Greg. He has a lanyard and
// strong opinions about bread.
import { Ragdoll } from './ragdoll.js';
import { GROUND_Y, GREG } from './config.js';
import { rand, randInt, pick, clamp } from './physics.js';
import { say, spawnBits, addShake, spawnBoom } from './fx.js';
import { sfxGreg, sfxThud, sfxThwack } from './audio.js';

const TAUNTS = [
  "I'm going to need that baguette.",
  "Let's circle back on the bread.",
  "This is a compliance issue.",
  "I have escalated this.",
  "Per my last honk.",
  "Do you have a permit for that?",
  "I'm not angry, I'm disappointed.",
  "My name is Greg. That's all.",
  "You're not on the approved vendor list.",
  "I've booked a meeting about you.",
];

const HURTS = ['ow', 'unprofessional', 'HR will hear', 'that is bread', 'my lanyard!', 'ugh'];

export class Greg {
  constructor(x) {
    this.rag = new Ragdoll(x, GROUND_Y - 84, 1.62, { tint: '#e8c39a' });
    this.rag.getUpFrames = 46;
    this.hp = GREG.hp;
    this.maxHp = GREG.hp;
    this.state = 'enter';
    this.stateT = 90;
    this.windup = 0;
    this.beaten = false;
    this.tauntCd = 120;
    this.hitFlash = 0;
    this.invuln = 0;
  }

  get x() { return this.rag.p.hips.x; }
  get y() { return this.rag.p.hips.y; }
  get conscious() { return this.rag.conscious && !this.beaten; }
  get phase() { return this.hp > this.maxHp * 0.6 ? 1 : this.hp > this.maxHp * 0.25 ? 2 : 3; }

  taunt() {
    say(this.rag.p.head.x, this.rag.p.head.y - 40, pick(TAUNTS), {
      color: '#dff0ff', size: 20, maxLife: 130,
    });
    sfxGreg('grunt');
    this.tauntCd = randInt(240, 460);
  }

  hit(power, fromX, damage = 1) {
    if (this.beaten || this.invuln > 0) return false;
    this.invuln = 8;
    this.hp = Math.max(0, this.hp - damage);
    this.hitFlash = 10;
    const dir = Math.sign(this.rag.p.hips.x - fromX) || 1;
    if (this.hp <= 0) { this.defeat(dir, power); return true; }

    if (power > 26) {
      this.rag.flop(randInt(50, 80), dir * power * 0.32, -power * 0.42);
      sfxThud();
    } else {
      this.rag.applyImpulse(dir * power * 0.3, -power * 0.22, 0.4);
    }
    say(this.rag.p.head.x, this.rag.p.head.y - 26, pick(HURTS), {
      color: '#ffd2d2', size: 17, maxLife: 60,
    });
    sfxGreg('hurt');
    return true;
  }

  defeat(dir, power) {
    this.beaten = true;
    this.rag.flop(99999, dir * (power + 14) * 0.4, -(power + 14) * 0.5);
    spawnBits(this.x, this.y, 30, { colors: ['#3b6ea5', '#d8d2c4', '#8a6a4a'], spread: 9 });
    sfxGreg('hurt');
    say(this.rag.p.head.x, this.rag.p.head.y - 50, "I'll be working from home.", {
      color: '#ffffff', size: 24, maxLife: 220,
    });
  }

  update(hero, world) {
    if (this.hitFlash > 0) this.hitFlash--;
    if (this.invuln > 0) this.invuln--;

    if (this.beaten) {
      this.rag.update();
      return;
    }

    if (this.rag.conscious) {
      if (--this.tauntCd <= 0) this.taunt();
      this.think(hero, world);
    }
    this.rag.update();
    this.driveArms();
  }

  think(hero, world) {
    const dx = hero.x - this.x;
    const dist = Math.abs(dx);
    const ph = this.phase;
    this.stateT--;

    switch (this.state) {
      case 'enter':
        if (this.stateT <= 0) { this.state = 'stalk'; this.stateT = randInt(60, 120); }
        this.rag.driveStand(0, false, { speed: 0 });
        break;

      case 'stalk': {
        const dir = Math.sign(dx) || 1;
        this.rag.driveStand(dir, false, { speed: GREG.speed * (1 + (ph - 1) * 0.35) });
        if (this.stateT <= 0) {
          const roll = Math.random();
          if (dist < 260 || roll < 0.35) this.enter('windup', 34 - ph * 5);
          else if (roll < 0.7) this.enter('throw', 30);
          else this.enter('meeting', 50);
        }
        break;
      }

      case 'windup':
        this.rag.driveStand(0, false, { speed: 0 });
        this.rag.crouch = -13;
        if (this.stateT <= 0) {
          this.lungeDir = Math.sign(dx) || 1;
          this.enter('lunge', 32);
          sfxGreg('grunt');
          say(this.rag.p.head.x, this.rag.p.head.y - 34, 'SYNERGY!', { color: '#ffe08a', size: 26 });
        }
        break;

      case 'lunge':
        this.rag.driveStand(this.lungeDir, false, { speed: GREG.lungeSpeed + ph * 0.8 });
        if (this.stateT <= 0) this.enter('stalk', randInt(70, 140));
        break;

      case 'throw':
        this.rag.driveStand(0, false, { speed: 0 });
        if (this.stateT === 14) {
          const n = ph === 3 ? 3 : ph === 2 ? 2 : 1;
          for (let i = 0; i < n; i++) world.spawnStapler(this, hero, i * 0.14);
          say(this.rag.p.head.x, this.rag.p.head.y - 34, 'STAPLER', { color: '#cfe4ff', size: 22 });
        }
        if (this.stateT <= 0) this.enter('stalk', randInt(60, 130));
        break;

      case 'meeting':
        this.rag.driveStand(0, false, { speed: 0 });
        if (this.stateT === 26) {
          world.summonGeese(this, ph + 1);
          say(this.rag.p.head.x, this.rag.p.head.y - 40, "I'm calling a meeting.", {
            color: '#dff0ff', size: 21, maxLife: 120,
          });
        }
        if (this.stateT <= 0) this.enter('stalk', randInt(60, 120));
        break;
    }
  }

  enter(s, t) { this.state = s; this.stateT = t; }

  driveArms() {
    const { chest, handL, handR } = this.rag.p;
    const f = this.rag.facing, dr = this.rag.drive, s = this.rag.scale;
    if (this.state === 'windup') {
      handL.springTo(chest.x - f * 26 * s, chest.y - 16 * s, 0.3 * dr);
      handR.springTo(chest.x - f * 22 * s, chest.y - 10 * s, 0.3 * dr);
    } else if (this.state === 'lunge') {
      handL.springTo(chest.x + f * 34 * s, chest.y + 2 * s, 0.34 * dr);
      handR.springTo(chest.x + f * 30 * s, chest.y + 8 * s, 0.34 * dr);
    } else if (this.state === 'throw') {
      handR.springTo(chest.x - f * 18 * s, chest.y - 22 * s, 0.3 * dr);
    } else {
      // Hands on hips. The universal posture of a man about to say "so".
      handR.springTo(chest.x + f * 21 * s, chest.y + 26 * s, 0.16 * dr);
      handL.springTo(chest.x - f * 19 * s, chest.y + 26 * s, 0.14 * dr);
    }
  }

  // Greg's body is dangerous when he's lunging. Otherwise he's just a guy.
  bodyHitbox() {
    if (this.state !== 'lunge' || !this.rag.conscious) return null;
    return { x: this.rag.p.chest.x, y: this.rag.p.chest.y, r: 40 };
  }
}
