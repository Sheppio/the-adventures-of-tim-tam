# Changelog

Versions are `vMAJOR.MINOR.PATCH`. The version shown on the title screen is
`VERSION` in [`src/config.js`](src/config.js) — bump it with every push.

- **MINOR** — new mechanics, enemies, or anything that changes how it plays.
- **PATCH** — bug fixes and tuning.

## v0.2.0

Geese fight back.

- Two new goose attacks. A **wing buffet** at close range and a **dive-bomb**:
  the goose climbs to altitude, hovers with a `!!` telegraph, then commits to a
  fixed line at 10px/frame. Both put Tim Tam on his back; the dive is dodgeable
  precisely because it can't steer once launched.
- The peck was incapable of knocking him down — it dealt 7.5 against a
  knockdown threshold of 9.5, so geese could only ever nudge him. Peck still
  staggers, but the two new attacks floor him.
- **Rage.** Launching a goose enrages every goose within 400px: faster, shorter
  attack cooldowns, quicker to dive, red-eyed. Surviving a hit also enrages.
- **Flocks.** Geese arrive 1–3 at a time, cap raised 7 → 12, ramping with the
  body count so the opening minute isn't a wall.
- Geese flank to a side slot instead of stacking on one shoulder, get up from a
  non-fatal hit in ~1s instead of ~2s, and take 3 hits instead of 2.
- Wings actually flap now; a diving goose points along its own velocity.

## v0.1.1

- Fixed the jump. Holding space left Tim Tam crouched ~45px below standing
  height instead of getting him airborne: the impulse went to the hips alone
  and the leg constraints handed most of it straight back, and a level-triggered
  jump re-armed the lock that disables his stand-up spring on every landing
  frame. Jump is edge-triggered with a 9-frame buffer, and launches the whole
  body.
- Fixed the sign of `crouch`, which was stretching Greg upward during his lunge
  wind-up instead of compressing him.

## v0.1.0

Initial release. Tim Tam, one baguette, geese, dynamite, unexplained
explosions, and Greg.
