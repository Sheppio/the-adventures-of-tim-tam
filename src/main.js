// The Adventures of Tim Tam -- one arena, one baguette, no death animation.
import {
  VIEW_W, VIEW_H, VW, VH, ZOOM, CAM_Y, WORLD_W, GROUND_Y, GRAVITY,
  HERO, BAGUETTE, DYNAMITE, GOOSE, GREG, GTA6_DATE, VERSION,
} from './config.js';
import { blast, rand, randInt, pick, clamp } from './physics.js';
import { Hero } from './hero.js';
import { Goose } from './goose.js';
import { Greg } from './greg.js';
import * as FX from './fx.js';
import * as R from './render.js';
import * as A from './audio.js';
import { initInput, held, justPressed, endFrameInput } from './input.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// roundRect landed in every current browser, but be kind to the stragglers.
if (!ctx.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };
}

document.getElementById('version').textContent = VERSION;
document.title = `The Adventures of Tim Tam ${VERSION}`;

// Frames between Greg going down and the arena freezing: long enough for his
// collapse and the firework cascade (8 blasts, 220ms apart) to finish.
const VICTORY_SETTLE = 130;

const ui = {
  title: document.getElementById('title'),
  hud: document.getElementById('hud'),
  geese: document.getElementById('stat-geese'),
  flops: document.getElementById('stat-flops'),
  slaps: document.getElementById('stat-slaps'),
  boom: document.getElementById('stat-boom'),
  gregWrap: document.getElementById('greg-bar'),
  gregFill: document.getElementById('greg-fill'),
  countdown: document.getElementById('countdown'),
  victory: document.getElementById('victory'),
  vStats: document.getElementById('victory-stats'),
  touch: document.getElementById('touch'),
};

class World {
  constructor() { this.reset(); }

  reset() {
    FX.clearFx();
    this.hero = new Hero(280);
    this.geese = [];
    this.dynamites = [];
    this.staplers = [];
    this.greg = null;
    this.gooseKills = 0;
    this.cam = 0;
    this.spawnTimer = 40;
    this.gregAnnounced = false;
    this.victory = false;
    this.victoryT = 0;
    this.frozen = false;
    this.frame = 0;
    ui.victory.classList.add('hidden');
    ui.gregWrap.classList.add('hidden');
  }

  // Every rigid-body point in the arena, for blast purposes.
  allParticles() {
    const out = [...this.hero.rag.list];
    for (const g of this.geese) out.push(...g.list);
    if (this.greg) out.push(...this.greg.rag.list);
    return out;
  }

  spawnStapler(greg, hero, delay) {
    const hand = greg.rag.p.handR;
    const dx = hero.x - hand.x, dy = hero.y - 30 - hand.y;
    const d = Math.max(1, Math.hypot(dx, dy));
    const spd = 12;
    this.staplers.push({
      x: hand.x, y: hand.y,
      vx: (dx / d) * spd + rand(-1, 1),
      vy: (dy / d) * spd - 3,
      rot: 0, spin: rand(-0.4, 0.4),
      life: 220,
    });
  }

  summonGeese(greg, n) {
    for (let i = 0; i < n; i++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const x = clamp(greg.x + side * rand(160, 340), 40, WORLD_W - 40);
      const g = new Goose(x, GROUND_Y - 300 - i * 60);
      g.facing = -side;
      this.geese.push(g);
    }
    FX.addShake(4);
  }

  maybeSpawnGeese() {
    const alive = this.geese.filter((g) => g.alive).length;
    // Ramp the cap with the body count, so the first minute isn't a wall.
    const cap = this.greg ? 6 : Math.min(GOOSE.maxAlive, 5 + Math.floor(this.gooseKills / 3));
    if (alive >= cap) { this.spawnTimer = 60; return; }
    if (--this.spawnTimer > 0) return;
    this.spawnTimer = GOOSE.respawnDelay + randInt(-30, 50);
    // Geese arrive from offscreen, at altitude, unbothered by how -- and
    // in gangs, because one at a time was never a threat.
    const fromLeft = Math.random() < 0.5;
    const n = Math.min(randInt(GOOSE.flock[0], GOOSE.flock[1]), cap - alive);
    for (let i = 0; i < n; i++) {
      const x = fromLeft ? rand(20, 150) : rand(WORLD_W - 150, WORLD_W - 20);
      const g = new Goose(x, GROUND_Y - rand(60, 300) - i * 40);
      g.facing = fromLeft ? 1 : -1;
      this.geese.push(g);
    }
  }

  // A goose going up in feathers radicalises everything that saw it.
  enrageNear(x, y) {
    for (const g of this.geese) {
      if (g.alive && Math.hypot(g.x - x, g.y - y) < GOOSE.rageRadius) g.enrage();
    }
  }

  explode(x, y, radius, force, opts = {}) {
    FX.spawnBoom(x, y, radius);
    FX.addShake(radius / 9);
    A.sfxBoom(clamp(radius / 240, 0.6, 1.5));
    blast(this.allParticles(), x, y, radius, force);

    for (const g of this.geese) {
      if (!g.alive) continue;
      if (Math.hypot(g.x - x, g.y - y) < radius * 0.85) {
        g.die(); this.gooseKills++; this.enrageNear(g.x, g.y);
      }
    }
    if (this.greg && !this.greg.beaten) {
      const d = Math.hypot(this.greg.x - x, this.greg.y - y);
      if (d < radius) {
        this.greg.hit(30, x, opts.gregDamage ?? 9);
      }
    }
    // Tim Tam is emphatically included in his own blast radius.
    const d = Math.hypot(this.hero.x - x, this.hero.y - y);
    if (d < radius) {
      this.hero.takeHit(HERO.knockdownThreshold + 4, x, y);
    }
  }


  update() {
    // Greg is down and everything has settled: the arena holds still behind
    // the victory panel instead of carrying on without the player.
    if (this.frozen) { endFrameInput(); return; }

    this.frame++;
    const hero = this.hero;

    // --- input ---
    // Once Greg is beaten the player is no longer driving: the last second
    // is Tim Tam's ragdoll and the fireworks settling, not more fighting.
    const input = this.victory ? { left: false, right: false, jump: false } : {
      left: held('left'), right: held('right'),
      // Edge-triggered, so holding the key doesn't pin him to the ground.
      jump: justPressed('jump'),
    };
    // Held as well as tapped: with a flock on him, re-pressing for every
    // swing was the bottleneck.
    if (!this.victory && (justPressed('slap') || held('slap'))) hero.startSwing();
    if (!this.victory && justPressed('boom') && hero.canThrow()) {
      this.dynamites.push(hero.throwDynamite());
      FX.say(hero.x, hero.y - 90, pick(['DYNAMITE', 'catch!', 'bon appétit', 'for you']), {
        color: '#ffb3a0', size: 20, maxLife: 60,
      });
    }

    hero.update(input);

    // --- the universe's unprompted contributions ---

    // --- geese ---
    R.updateSky(this.cam);
    if (!this.victory) this.maybeSpawnGeese();
    for (let i = this.geese.length - 1; i >= 0; i--) {
      const g = this.geese[i];
      g.update(hero);
      if (g.deadT > 260) { this.geese.splice(i, 1); continue; }

      // Peck, wing buffet, or a full dive-bomb. Tim Tam notices these.
      if (g.conscious && hero.conscious && !this.victory) {
        for (const atk of g.attackHitboxes()) {
          const landed = hero.rag.list.some(
            (p) => Math.hypot(p.x - atk.x, p.y - atk.y) < atk.r + p.r);
          if (!landed) continue;
          hero.takeHit(atk.damage, g.x, g.y);
          g.peckT = 0;
          if (g.state === 'dive') g.crash();
          else g.honk();
          break;
        }
      }
    }

    // --- baguette vs everything ---
    if (hero.swingActive) {
      const seg = hero.baguetteSegment();
      for (const g of this.geese) {
        if (!g.alive) continue;
        const hitP = g.list.find((p) => segDist(seg, p.x, p.y) < 24 + p.r);
        if (hitP && hero.registerHit(g, hitP.x, hitP.y)) {
          g.hit(BAGUETTE.gooseKnockback, seg.x1, seg.y1);
          if (!g.alive) { this.gooseKills++; this.enrageNear(g.x, g.y); }
        }
      }
      if (this.greg && !this.greg.beaten) {
        const gp = this.greg.rag.list.find((p) => segDist(seg, p.x, p.y) < 24 + p.r);
        if (gp && hero.registerHit(this.greg, gp.x, gp.y)) {
          this.greg.hit(BAGUETTE.knockback, seg.x1, 4);
        }
      }
    }

    // --- Greg ---
    if (!this.greg && this.gooseKills >= GREG.spawnAfterGeese) this.introduceGreg();
    if (this.greg) {
      this.greg.update(hero, this);
      const box = this.greg.bodyHitbox();
      if (box) {
        for (const p of hero.rag.list) {
          if (Math.hypot(p.x - box.x, p.y - box.y) < box.r + p.r) {
            hero.takeHit(15, box.x, box.y);
            this.greg.enter('stalk', 60);
            FX.addShake(9);
            break;
          }
        }
      }
      if (this.greg.beaten && !this.victory) this.onVictory();
    }

    this.updateProjectiles();
    FX.updateFx();
    this.updateCamera();
    if (this.victory && ++this.victoryT >= VICTORY_SETTLE) this.freeze();
    endFrameInput();
  }

  introduceGreg() {
    this.greg = new Greg(clamp(this.hero.x + 620, 400, WORLD_W - 260));
    ui.gregWrap.classList.remove('hidden');
    FX.say(this.greg.x, GROUND_Y - 260, 'GREG', { color: '#ffffff', size: 54, maxLife: 170 });
    FX.say(this.greg.x, GROUND_Y - 216, 'just some dude', {
      color: '#cfe4ff', size: 22, maxLife: 170,
    });
    FX.addShake(14);
    A.sfxGreg('grunt');
  }

  onVictory() {
    this.victory = true;
    this.victoryT = 0;
    A.sfxFanfare();
    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        if (!this.greg || this.frozen) return;
        this.explode(this.greg.x + rand(-160, 160), GROUND_Y - rand(20, 200), 150, 26,
          { gregDamage: 0 });
      }, i * 220);
    }
  }

  // Stop the world and put the panel up over the still frame.
  freeze() {
    if (this.frozen) return;
    this.frozen = true;
    ui.vStats.innerHTML =
      `Geese launched: <b>${this.gooseKills}</b><br>` +
      `Baguette connections: <b>${this.hero.slaps}</b><br>` +
      `Times Tim Tam was flattened: <b>${this.hero.flops}</b><br>` +
      `Times Tim Tam died: <b>0</b> <span class="dim">(not implemented)</span>`;
    ui.victory.classList.remove('hidden');
  }

  updateProjectiles() {
    for (let i = this.dynamites.length - 1; i >= 0; i--) {
      const d = this.dynamites[i];
      d.x += d.vx; d.y += d.vy;
      d.vy += GRAVITY * 0.85;
      d.vx *= 0.995;
      d.rot += d.spin;
      if (d.y > GROUND_Y - 8) {
        d.y = GROUND_Y - 8;
        d.vy *= -0.42;
        d.vx *= 0.72;
        d.spin *= 0.6;
      }
      if (d.x < 10 || d.x > WORLD_W - 10) { d.vx *= -0.6; d.x = clamp(d.x, 10, WORLD_W - 10); }
      if (d.fuse % 7 === 0) A.sfxFuse();
      FX.spawnBits(d.x + 2, d.y - 34, 1, {
        colors: ['#ffd76a', '#fff3c4'], spread: 1.4, grav: -0.05,
        minSize: 1.5, maxSize: 3, minLife: 10, maxLife: 20,
      });
      if (--d.fuse <= 0) {
        this.dynamites.splice(i, 1);
        this.explode(d.x, d.y, DYNAMITE.radius, DYNAMITE.force);
        FX.say(d.x, d.y - 90, pick(['KABOOM', 'BOOM', 'BAGUETTE-ADJACENT BOOM', 'YES']), {
          color: '#ffdca0', size: 30, maxLife: 74, wobble: 4,
        });
      }
    }

    for (let i = this.staplers.length - 1; i >= 0; i--) {
      const s = this.staplers[i];
      s.x += s.vx; s.y += s.vy;
      s.vy += GRAVITY * 0.55;
      s.rot += s.spin;
      let gone = --s.life <= 0;
      if (s.y > GROUND_Y - 6) {
        s.y = GROUND_Y - 6; s.vy *= -0.3; s.vx *= 0.7;
        if (Math.abs(s.vy) < 1) gone = gone || s.life < 120;
      }
      for (const p of this.hero.rag.list) {
        if (Math.hypot(p.x - s.x, p.y - s.y) < 16 + p.r) {
          this.hero.takeHit(11, s.x, s.y);
          FX.spawnBits(s.x, s.y, 6, { colors: ['#8a99a8', '#4a5a6a'], spread: 4 });
          gone = true;
          break;
        }
      }
      if (gone) this.staplers.splice(i, 1);
    }
  }

  updateCamera() {
    const target = clamp(this.hero.x - VW / 2, 0, WORLD_W - VW);
    this.cam += (target - this.cam) * 0.09;
    this.cam = clamp(this.cam, 0, WORLD_W - VW);
  }

  draw() {
    ctx.save();
    const sh = FX.shake.mag;
    const ox = sh ? rand(-sh, sh) : 0;
    const oy = sh ? rand(-sh, sh) : 0;
    // One transform for the whole world: zoom, then camera.
    ctx.scale(ZOOM, ZOOM);
    ctx.translate(-this.cam + ox, -CAM_Y + oy);

    R.drawBackground(ctx, this.cam);
    R.drawGround(ctx, this.cam);

    // Dead geese lie underneath the living, as is traditional.
    for (const g of this.geese) if (!g.alive) R.drawGoose(ctx, g);
    if (this.greg) R.drawGreg(ctx, this.greg);
    for (const g of this.geese) if (g.alive) R.drawGoose(ctx, g);

    FX.drawFx(ctx);
    for (const s of this.staplers) R.drawStapler(ctx, s);
    for (const d of this.dynamites) R.drawDynamite(ctx, d);

    R.drawHero(ctx, this.hero, this.frame);
    FX.drawTexts(ctx);
    ctx.restore();

    this.drawArenaEdges();
    if (this.greg && !this.greg.beaten) this.drawGregOffscreenHint();
  }

  drawArenaEdges() {
    // Soft vignette so the single arena feels like a stage.
    const g = ctx.createLinearGradient(0, 0, VIEW_W, 0);
    g.addColorStop(0, 'rgba(40,30,20,0.28)');
    g.addColorStop(0.12, 'rgba(40,30,20,0)');
    g.addColorStop(0.88, 'rgba(40,30,20,0)');
    g.addColorStop(1, 'rgba(40,30,20,0.28)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  drawGregOffscreenHint() {
    const sx = (this.greg.x - this.cam) * ZOOM;
    if (sx > 40 && sx < VIEW_W - 40) return;
    const edge = sx <= 40 ? 52 : VIEW_W - 52;
    const dir = sx <= 40 ? -1 : 1;
    ctx.save();
    ctx.translate(edge, (GROUND_Y - CAM_Y) * ZOOM - 210);
    ctx.fillStyle = 'rgba(59,110,165,0.9)';
    ctx.strokeStyle = '#f5f1e6';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(dir * 24, 0);
    ctx.lineTo(-dir * 12, -18);
    ctx.lineTo(-dir * 12, 18);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f5f1e6';
    ctx.font = '900 15px "Bree Serif", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('GREG', 0, 38);
    ctx.restore();
    ctx.textAlign = 'left';
  }

  syncHud() {
    ui.geese.textContent = this.gooseKills;
    ui.flops.textContent = this.hero.flops;
    ui.slaps.textContent = this.hero.slaps;
    const ready = this.hero.boomCd <= 0;
    ui.boom.textContent = ready ? 'READY' : Math.ceil(this.hero.boomCd / 60 * 10) / 10 + 's';
    ui.boom.classList.toggle('ready', ready);
    if (this.greg) {
      ui.gregFill.style.width = (this.greg.hp / this.greg.maxHp * 100) + '%';
    }
  }
}

// Distance from a point to a segment. The baguette's entire hit model.
function segDist(seg, px, py) {
  const dx = seg.x2 - seg.x1, dy = seg.y2 - seg.y1;
  const l2 = dx * dx + dy * dy;
  if (l2 < 1e-6) return Math.hypot(px - seg.x1, py - seg.y1);
  let t = ((px - seg.x1) * dx + (py - seg.y1) * dy) / l2;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (seg.x1 + t * dx), py - (seg.y1 + t * dy));
}

// ------------------------------------------------------------------ shell

const world = new World();
let state = 'title';
let acc = 0;
let last = performance.now();
const STEP = 1000 / 60;

function fitCanvas() {
  const wrap = document.getElementById('stage');
  const scale = Math.min(wrap.clientWidth / VIEW_W, wrap.clientHeight / VIEW_H);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.style.width = VIEW_W * scale + 'px';
  canvas.style.height = VIEW_H * scale + 'px';
  canvas.width = Math.round(VIEW_W * dpr);
  canvas.height = Math.round(VIEW_H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function startGame() {
  A.initAudio();
  A.resumeAudio();
  world.reset();
  state = 'play';
  ui.title.classList.add('hidden');
  ui.hud.classList.remove('hidden');
  ui.touch.classList.remove('hidden');
  FX.say(world.hero.x, GROUND_Y - 150, 'FOR BREAD!', { color: '#ffe9a8', size: 34, maxLife: 100 });
}

function loop(now) {
  let dt = now - last;
  last = now;
  if (dt > 200) dt = 200;      // tab was in the background; don't simulate a week
  acc += dt;
  let steps = 0;
  while (acc >= STEP && steps < 5) {
    if (state === 'play') world.update();
    else endFrameInput();
    acc -= STEP;
    steps++;
  }
  if (state === 'play') {
    world.draw();
    world.syncHud();
  } else {
    // Title screen still simulates, so there's carnage behind the menu.
    world.update();
    world.draw();
  }
  requestAnimationFrame(loop);
}

function tickCountdown() {
  const ms = GTA6_DATE.getTime() - Date.now();
  if (ms <= 0) {
    ui.countdown.innerHTML =
      '<b>IT IS RELEASE DAY.</b> Somewhere, a very expensive game also came out.';
    return;
  }
  const d = Math.floor(ms / 86400000);
  const h = Math.floor(ms / 3600000) % 24;
  const m = Math.floor(ms / 60000) % 60;
  const s = Math.floor(ms / 1000) % 60;
  ui.countdown.innerHTML =
    `<span class="cd-label">Launching head-to-head with GTA VI in</span> ` +
    `<b>${d}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s</b>`;
}

// Handy from the console: __tt.world, __tt.hero, __tt.spawnGreg()
window.__tt = {
  world,
  get hero() { return world.hero; },
  spawnGreg: () => world.introduceGreg(),
  boom: (x, y) => world.explode(x ?? world.hero.x, y ?? GROUND_Y - 40, 260, 60),
  version: VERSION,
  flyover: (kind) => R.spawnFlyover(world.cam, kind),
  addGoose: (x, y) => world.geese.push(new Goose(x ?? world.hero.x + 160, y ?? GROUND_Y - 40)),
};

initInput(canvas, () => { A.initAudio(); A.resumeAudio(); });

addEventListener('keydown', (e) => {
  if (e.code === 'Enter' && state === 'title') startGame();
  if (e.code === 'KeyR' && state === 'play') {
    world.reset();
    FX.say(world.hero.x, GROUND_Y - 150, 'ROUND TWO', { color: '#ffe9a8', size: 30 });
  }
  if (e.code === 'KeyM') A.toggleMute();
});
document.getElementById('start').addEventListener('click', startGame);
document.getElementById('restart').addEventListener('click', () => world.reset());
document.getElementById('mute').addEventListener('click', (e) => {
  A.initAudio();
  e.currentTarget.textContent = A.toggleMute() ? '🔇' : '🔊';
});

addEventListener('resize', fitCanvas);
fitCanvas();
tickCountdown();
setInterval(tickCountdown, 1000);
requestAnimationFrame(loop);
