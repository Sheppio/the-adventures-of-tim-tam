// The Adventures of Tim Tam -- global knobs.
// Everything absurd in this game has a number here. Turn them up.

export const VIEW_W = 1280;
export const VIEW_H = 720;

// The world is drawn zoomed in a little, so the characters have some presence
// instead of being distant twitching specks.
export const ZOOM = 1.25;
export const VW = VIEW_W / ZOOM;          // visible world width
export const VH = VIEW_H / ZOOM;          // visible world height

// One arena. That's the whole game. Side-scrolling, no levels, no lore.
export const WORLD_W = 3600;
export const GROUND_Y = 620;
export const CAM_Y = GROUND_Y + 46 - VH;   // vertical camera anchor (constant)

export const GRAVITY = 0.62;
export const AIR_DRAG = 0.994;

// Tim Tam
export const HERO = {
  speed: 3.4,
  jump: 11.2,
  standHeight: 74,
  slapCooldown: 20,
  slapDuration: 16,
  // Tim Tam has no health. He has "dignity", and it regenerates.
  flopDuration: 78,        // frames spent as a limp noodle
  getUpDuration: 34,       // frames spent wobbling back to vertical
  knockdownThreshold: 9.5, // impulse magnitude that puts him on his back
};

// The baguette. It is not balanced. It was never going to be balanced.
export const BAGUETTE = {
  length: 96,
  knockback: 34,
  lift: -19,
  gooseKnockback: 33,
};

// Comically powerful dynamite.
export const DYNAMITE = {
  cooldown: 46,
  fuse: 50,
  throwPower: 10.5,
  radius: 260,
  force: 62,
};

// Explosions that happen for no reason whatsoever. This is a feature.
export const RANDOM_BOOM = {
  minDelay: 90,
  maxDelay: 260,
  radius: 190,
  force: 40,
};

export const GOOSE = {
  speed: 1.3,
  chargeSpeed: 2.9,
  peckRange: 58,
  peckDamage: 7.5,   // damage to Tim Tam's dignity, not his life
  maxAlive: 7,
  respawnDelay: 150,
};

export const GREG = {
  hp: 100,
  speed: 1.9,
  lungeSpeed: 8.5,
  spawnAfterGeese: 10,
};

// The joke that started all this.
// GTA VI: November 19, 2026. Every other publisher fled the date.
// Tim Tam did not flee. Tim Tam has a baguette.
export const GTA6_DATE = new Date('2026-11-19T00:00:00Z');
