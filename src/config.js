// The Adventures of Tim Tam -- global knobs.
// Everything absurd in this game has a number here. Turn them up.

// The framing the game is composed for. Any window shows at least this much.
export const VIEW_W = 1280;
export const VIEW_H = 720;

// The world is drawn zoomed in a little, so the characters have some presence
// instead of being distant twitching specks.
export const ZOOM = 1.25;

// One arena. That's the whole game. Side-scrolling, no levels, no lore.
export const WORLD_W = 3600;
export const GROUND_Y = 620;
export const SOIL = 128;                   // world px of earth below the surface

const BASE_VH = VIEW_H / ZOOM;

// The canvas fills whatever window it is given rather than letterboxing: the
// design framing above is always fully visible, and spare aspect ratio becomes
// more world -- extra sky and earth on a tall screen, extra arena on a wide
// one. Everything here is recomputed by resizeView() on every resize, so read
// it through the object; a destructured copy goes stale.
export const view = {
  w: VIEW_W, h: VIEW_H,                    // canvas size, design px
  vw: VIEW_W / ZOOM, vh: BASE_VH,          // visible world size
  camY: GROUND_Y + SOIL - BASE_VH,         // world y at the top of the view
  soil: SOIL,
};

export function resizeView(cw, ch) {
  const scale = Math.min(cw / VIEW_W, ch / VIEW_H);
  view.w = Math.max(VIEW_W, cw / scale);
  view.h = Math.max(VIEW_H, ch / scale);
  view.vw = view.w / ZOOM;
  view.vh = view.h / ZOOM;
  // Split spare height between sky and earth, so the action doesn't ride at
  // the top of a tall phone with everything below it empty.
  view.soil = SOIL + (view.vh - BASE_VH) * 0.55;
  view.camY = GROUND_Y + view.soil - view.vh;
  return scale;
}

export const GRAVITY = 0.62;
export const AIR_DRAG = 0.994;

// Tim Tam
export const HERO = {
  speed: 3.4,
  jump: 11.2,
  standHeight: 74,
  // Matched, so held swings chain back-to-back without one arc cutting
  // off the last frames of the previous. 5/sec, up from 3.
  slapCooldown: 12,
  slapDuration: 12,
  // Tim Tam has no health. He has "dignity", and it regenerates.
  flopDuration: 78,        // frames spent as a limp noodle
  getUpDuration: 34,       // frames spent wobbling back to vertical
  knockdownThreshold: 9.5, // impulse magnitude that puts him on his back
  wakeGrace: 55,           // frames after standing up where a knockdown only staggers
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

export const GOOSE = {
  hp: 3,
  speed: 1.45,
  chargeSpeed: 3.6,
  maxAlive: 12,
  respawnDelay: 95,
  flock: [1, 3],           // geese arrive in gangs, not one at a time

  // Three attacks, deliberately escalating. Only the peck is spammable;
  // the two that put Tim Tam on his back both cost a cooldown, so being
  // surrounded is dangerous without being unplayable.
  peckRange: 62,
  peckDamage: 8.5,         // below knockdownThreshold: staggers, never floors
  buffetRange: 76,
  buffetDamage: 13,        // wing shove. Above the threshold. He goes down.
  diveRange: 540,
  diveSpeed: 10.5,
  diveDamage: 16,          // a goose doing 10px/frame straight at your head

  // A launched goose enrages the ones that watched it happen.
  rageRadius: 400,
  rageDuration: 320,
};

export const GREG = {
  hp: 100,
  speed: 1.9,
  lungeSpeed: 8.5,
  spawnAfterGeese: 10,
};

// Bump this on every push. Shown on the title screen so you always know
// which build you're actually playing. See CHANGELOG.md.
export const VERSION = 'v0.7.1';

// The joke that started all this.
// GTA VI: November 19, 2026. Every other publisher fled the date.
// Tim Tam did not flee. Tim Tam has a baguette.
export const GTA6_DATE = new Date('2026-11-19T00:00:00Z');
