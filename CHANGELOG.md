# Changelog

Versions are `vMAJOR.MINOR.PATCH`. The version shown on the title screen is
`VERSION` in [`src/config.js`](src/config.js) — bump it with every push.

- **MINOR** — new mechanics, enemies, or anything that changes how it plays.
- **PATCH** — bug fixes and tuning.

## v0.7.0

- **The canvas fills the window.** It used to render a fixed 1280×720 and
  letterbox, which on a phone left big black bars. The 1280×720 framing is now
  a *minimum* — every window shows at least that much — and spare aspect ratio
  becomes more world instead of bars: extra sky and earth on a tall screen,
  extra arena on a wide one. Phone landscape goes from 1024 to 1358 world px
  wide; portrait gets ~900px of earth under the street.
- **Things buried in the soil.** Dinosaur skeletons mid-excavation, ammonites,
  ribcages, amphorae, treasure chests, an abandoned bicycle, pottery shards, a
  petrified baguette, a goose skeleton (the feud predates all of us) and one of
  Greg's ancestral staplers. Plus strata, roots and pebbles. Shallow finds are
  sparse so the default framing doesn't read as clutter; a denser deep layer
  only appears on tall screens.
- Sky furniture (sun, clouds, bunting, birds, planes) now hangs off the ground
  line rather than the top of the view, so a tall screen doesn't strand the
  bunting hundreds of pixels above the village. More clouds, spread higher.
- Eiffel Tower scaled to 1.3 so it fits the minimum framing — the deeper soil
  raised the horizon and was clipping its tip.

## v0.6.1

- Touch buttons enlarged: 62 → 76px (62px on short screens, up from 52px).
- Jump moved to the left cluster, centred above ◀ ▶, so all movement is under
  one thumb and the right hand is just baguette and dynamite.

## v0.6.0

- **Fullscreen.** A ⛶ button next to mute, or <kbd>F</kbd>. Uses the Fullscreen
  API with the `webkit` fallbacks Safari still needs, and hides itself entirely
  where the API isn't available — iPhone Safari only allows fullscreen on
  `<video>`, so the button would otherwise be a dead control. The canvas
  refits on entering and leaving.
- The icon is inline SVG rather than a glyph: the obvious fullscreen characters
  (U+26F6 and friends) are missing from plenty of phone fonts and render as
  tofu boxes.

## v0.5.1

- **The fight no longer starts before you press the button.** The title screen
  was deliberately simulating the whole game behind the menu, which with an
  82%-opaque overlay just read as the game having already begun. The village
  still lives — sky, clouds, birds, planes, Tim Tam standing about — but no
  geese spawn, no Greg arrives, and the keyboard does nothing until `SLAP SOME
  GEESE` is pressed.
- **Fixed Tim Tam moonwalking.** Standing still, he drifted right at a steady
  3px/s — 180px a minute, unbounded. The hips-rooting step cancelled only 92%
  of the constraint solver's sideways nudge each frame, and since the body is
  asymmetric (baguette arm out to one side) the surviving 8% always leaned the
  same way and integrated. It is cancelled outright when no movement is asked
  for. Only visible on the title screen, but it applied in-game too.
- Title and play now share one fixed-step update path; the title scene was
  previously stepped once per rendered frame.

## v0.5.0

- **The arena freezes once Greg is beaten.** The victory panel used to appear
  over a fight that carried on behind it — geese still attacking, Tim Tam still
  taking input. Now the player's input is dropped and geese stop being a threat
  the instant Greg goes down, physics runs on for ~2s so his collapse and the
  firework cascade resolve, then the world hard-stops and the panel goes up
  over the still frame. `GO AGAIN` clears the freeze.
- **Rounded the ends of the baguette.** The tip was two curves meeting at a
  single vertex, which read as a spear. Both ends are semicircular arc caps
  now, with the crusts meeting them near-tangentially — capping the tip with a
  quadratic instead left a visible kink at the heel.

## v0.4.0

Environment pass.

- **The Eiffel Tower no longer floats.** Its base was drawn at `GROUND_Y - 40`,
  40px above the line the houses stand on. It also drew *in front* of the
  skyline despite sitting further back, so the depth order is fixed too: it
  goes down first and the rooftops overlap its base. Scaled up so it clears the
  roofline, given X-brace latticing so it reads as the tower rather than a
  pylon, and hazed back so it doesn't out-contrast nearer layers.
- **New parallax layer** at depth 0.74, between the tower (0.84) and the
  village (0.58): a hazy Paris skyline of mansards, domes, spires and chimney
  pots. Flat silhouettes only — anything legible back there competes with the
  playfield.
- **Twenty French shop names** instead of every shop being BOULANGERIE, picked
  deterministically per building so a given shop keeps its name. Signs shrink
  to fit their shopfront; the name list is length-checked against the narrowest
  one.
- **Sky traffic.** Occasional V-formations of distant birds, and a banner plane
  towing things like SEE YOU NOV 19 and GREG IS FINE. Purely decorative —
  nothing up there collides with anything. The plane flies under the bunting
  and over the rooftops, since the bunting is a nearer layer and would
  otherwise slice the banner.

## v0.3.1

- Trimmed the closing lines from the title screen's "Why this exists" note.

## v0.3.0

- **Removed the random explosions.** They fired every 1.5–4s with no cause and
  no tell, which read as the game glitching rather than as a joke. Dynamite is
  now the only thing that explodes, and it always has a visible source.
- **Baguette swings ~67% faster** — cooldown 20 → 12 frames, 3/sec → 5/sec — to
  match how much harder the geese push back in v0.2.0.
- **Hold to keep swinging.** The swing was edge-triggered, so every hit needed
  its own keypress. Holding `J` or the mouse button now swings continuously.
  Swing duration is matched to the cooldown so arcs chain back-to-back instead
  of cutting each other off.

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
