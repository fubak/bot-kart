// Centralized tuning — all gameplay/camera constants live here (spec §48).
// Units: meters, seconds, radians. World scale: 1 unit = 1 m (ADR-002).

export const SIM = {
  fixedDt: 1 / 120,
  maxFrameDt: 0.1, // clamp huge deltas (tab refocus) to avoid spiral of death
} as const;

export const KART = {
  // Dimensions (ADR-002)
  width: 1.6,
  length: 2.6,
  wheelRadius: 0.225,

  // Speed (m/s). ~28 m/s ≈ 100 km/h game-feel top speed.
  maxSpeed: 28,
  reverseSpeed: 6,
  accel: 18,
  launchMul: 1.35, // extra accel while fwdSpeed < launchSpeed (start snap)
  launchSpeed: 6,
  brake: 30,
  // Off-throttle deceleration (coast drag + rolling resistance).
  drag: 6,

  // Elevation: vertical gravity (snappier than real — arcade airtime over
  // crests) and the force of slope gravity along the heading.
  gravity: 22,
  slopeForce: 11,

  // Steering: rad/s at full lock, scaled by speedFactor(v).
  steerRate: 2.6,
  // Speed below which steering fades to near-zero (can't turn when parked).
  steerMinSpeed: 0.8,
  // Full steering effectiveness speed; fades above this (high-speed stability).
  steerFullSpeed: 10,
  // Asymmetric input slew — fast attack (critic: first ~60ms gave <40% lock,
  // corrections a beat late), softer release (keeps taps gentle).
  steerAttack: 11,
  steerRelease: 7,

  // Grip: fraction of lateral velocity removed per second (exp model).
  grip: 9,
  driftGrip: 1.6, // much lower lateral grip while drifting → slip angle
  driftSteerMul: 1.45, // drift turns sharper but looser
  // Drift arc model: velocity vector is rotated by this fraction of the yaw
  // delta each step — the kart carves an arc instead of spinning through its
  // own velocity (critic: held drift → slip 62–80°, speed collapse).
  driftVelFollow: 0.62,
  // Held slip ceiling: heading may lead velocity by at most this (rad); the
  // drift settles into a held slide, not a spin-out.
  driftMaxSlip: 0.55,
  // Speed retention while drifting — exp decay rate on velocity (~0.16/s
  // keeps ~83% through a 1.2 s hold).
  driftScrub: 0.16,
  // Minimum forward speed to ENTER / SUSTAIN a drift, and to accrue charge
  // (kills the parking-lot-donut exploit that maxed tier-2 at 20 km/h).
  driftEnterSpeed: 12,
  driftSustainSpeed: 10,
  driftChargeSpeed: 12,

  // Drift → mini-turbo: charge seconds needed per boost tier. Real corners
  // sustain ~0.6 s of drift (critic: 0.9 s tier-1 never fired in a race).
  driftChargeTier: [0.45, 1.1],
  boostSpeed: 9, // added m/s during boost
  boostTime: [0.7, 1.4], // boost duration per tier
  boostAccel: 26,
  // Above maxSpeed (boost end, downhill), bleed back instead of hard-clamping.
  overSpeedDecay: 32,

  // Wall collision response — contact-EPISODE model: impact penalty once per
  // wall entry, scaled by how hard we hit; sustained contact only slides.
  wallBounce: 0.15, // restitution into the road (low — no backward rebound)
  wallImpactLoss: 0.5, // fraction of speed lost at max impact (scaled by hit)
  wallScrub: 3.2, // per-second velocity scrub while grinding along the wall
  wallGrindCap: 0.7, // fraction of maxSpeed while grinding — contact costs you

  // Off-road (gravel shortcut aprons): heavy drag + rumble — shorter path,
  // slower surface. The route decision is real.
  gravelDrag: 9, // extra deceleration while on gravel
  gravelMaxSpeed: 15, // hard cap on gravel (~54 km/h vs 100 on asphalt)
} as const;

export const CAMERA = {
  distance: 7.0,
  // Camera closes in at top speed so the kart stays readable (critic: ~13 m
  // effective stand-off at speed shrank the kart).
  distanceSpeedTrim: 1.4,
  height: 3.2,
  lookAhead: 9.0, // meters ahead of kart along its heading
  posDamp: 7.0, // exp damping rate for position
  lookDamp: 9.0, // exp damping rate for look target
  fovBase: 60,
  fovSpeed: 14, // +fov at maxSpeed
  fovBoost: 8, // extra +fov while boosting
  shakeTime: 0.28, // wall-impact shake duration (s)
  shakeAmp: 0.35, // wall-impact positional jitter (m)
  // Velocity lead on the follow target — compensates posDamp lag so the kart
  // doesn't shrink at speed (critic: measured follow dist grew 7.7→9.9 m).
  speedLead: 0.13,
} as const;

export const TRACK = {
  roadHalfWidth: 6, // 12 m road
  samples: 1024, // centerline lookup resolution
  wallHeight: 0.55,
  gravelWidth: 3.4, // gravel apron extends this far past the road edge
} as const;

export const RACE = {
  laps: 3,
  countdown: 3.0, // seconds of input-locked 3-2-1 before GO
} as const;

// Set dressing (src/game/Props.ts, driven from Track.ts) — per-theme scatter
// density and the lateral band props live in. Everything is instanced;
// counts below are per-track instance targets, tuned to ~2-3× the wave-6
// prop density while keeping net draw calls in single digits per theme.
export const SCENERY = {
  // Lateral band from centerline: [bandMin, bandMax] on both sides of the
  // road, plus infield clusters inside the loop. `margin` is the minimum
  // clearance past the drivable edge on the NEAREST leg (includes gravel
  // aprons) — folded layouts put parallel legs inside the band, so every
  // candidate is re-tested against the whole centerline, not just its
  // source sample.
  bandMin: TRACK.roadHalfWidth + 1.5,
  bandMax: TRACK.roadHalfWidth + 45,
  margin: 1.5,

  pastoral: {
    tallFlowers: 150,  // stem + blossom pairs, meadow depth
    bushes: 120,       // rounded shrubs, infield-weighted
    hayBales: 44,
    orchardTrees: 46,  // round-canopy second species vs the pines
    fenceRuns: 5,      // wooden fence stretches, posts + 2 rails
    fenceLenMin: 40,   // run length range in centerline samples (~0.55 m each)
    fenceLenMax: 85,
  },
  ridge: {
    strataSlabs: 96,   // tilted layered rock plates
    cairns: 34,        // 3-stone stacked trail markers
    scrub: 150,        // dry tuft cones
    snags: 30,         // dead trunk spikes
  },
  neon: {
    gates: 4,          // emissive bars spanning the road on straights
    signs: 18,         // glow boards on posts (two emissive colors)
    holoColumns: 40,   // thin light strips, infield-weighted
    crates: 56,        // dark tech boxes, some stacked
    studs: 120,        // low runway-style light studs
  },
} as const;

// Post-processing (src/core/PostFX.ts) — render-side only, never touches
// the fixed-dt sim. Chain: RenderPass → UnrealBloomPass (linear HDR) →
// OutputPass (ACES tonemap + sRGB, reads renderer.toneMapping) → GradePass
// (vignette + micro-grade + speed-gated chromatic edge, in display space).
export const POSTFX = {
  // Multisample the composer's HDR target — renderer.render() to canvas had
  // antialias:true; without samples the pipeline loses that MSAA.
  samples: 4,
  bloom: {
    // Luminosity high-pass gate on LINEAR pre-tonemap luminance: 1.0 keeps
    // lit diffuse (checker ~0.7, sky ~0.5-0.7, dimmed clouds ~0.85) under
    // the gate — only true HDR sources bloom: emissive pylons/rails/boxes/
    // pads (intensity ≥2), additive sprite stacks, sun/moon disc.
    threshold: 1.0,
    strength: 0.32,
    radius: 0.35,
  },
  grade: {
    vignette: 0.3, // corner dimming depth (0 = off, 1 = black corners)
    vignetteStart: 0.4, // radial start of falloff (0 center → ~1.41 corner)
    saturation: 1.06, // gentle color lift — production grade, not a filter
    contrast: 1.03,
  },
  speedFx: {
    // Chromatic edge at top speed: ramps in past `start` fraction of
    // KART.maxSpeed; uAberration is the max UV shift at screen corners.
    // critic9: 0.0045 @ 0.72 read as anaglyph-3D fringing well inside the
    // frame — halved and pushed to the top ~18% of the speed range.
    start: 0.82,
    aberration: 0.002,
    ease: 5, // per-second approach rate — smooth engage/disengage
  },
} as const;

// AI drivers (src/game/AiDriver.ts) — pure-pursuit centerline following with
// curvature-aware speed control and hold-to-drift on tight corners.
export const AI = {
  // Lookahead (m): grows with forward speed, clamped by lookaheadMax.
  lookaheadBase: 7,
  lookaheadPerSpeed: 0.55,
  lookaheadMax: 26,
  // Heading-error → steer P gain (rad of error → -1..1 stick).
  steerGain: 2.4,

  // Corner speed model: vTarget = sqrt(cornerAccel * turnRadius).
  cornerAccel: 26, // m/s² lateral budget — raise for faster cornering
  cornerMinSpeed: 8, // never slow below this for a corner (m/s)
  // Brake only when speed exceeds target*brakeMargin; pressure ramps up over
  // brakeBand m/s of overspeed so light overshoot gets a light tap.
  brakeMargin: 1.05,
  brakeBand: 6,
  brakeMin: 0.25,
  // Braking horizon = max(lookahead*brakeLookMul, speed*brakeTimeAhead); the
  // worst curvature found at these horizon fractions sets the target speed.
  // 1.3 s at 28 m/s ≈ 36 m — enough to reach hairpin speed before a V-kink
  // on a fast section (NN frac ~0.58 clipped walls at 1.1 s).
  brakeLookMul: 1.4,
  brakeTimeAhead: 1.3,
  curveSampleFracs: [0.2, 0.35, 0.5, 0.65, 0.8, 1.0],

  // Off-line rejoin: beyond this |lateral| (m) shrink the lookahead so the bot
  // turns back to the centerline instead of cutting across the corner.
  rejoinLateral: 3.5,
  rejoinLookMul: 0.5,

  // Drift: enter when the near-lookahead corner radius (m) is tighter than
  // driftEnterRadius and speed > driftMinSpeed; release once it opens past
  // driftExitRadius (hysteresis) or driftMaxTime expires (long sweepers).
  // driftMinSpeed must exceed KART.driftEnterSpeed (12) or requests never latch.
  driftEnterRadius: 17,
  driftExitRadius: 30,
  driftMinSpeed: 13,
  driftMaxTime: 2.4,
  // Wall margin: release the drift when the slide arc reaches the barrier —
  // compares driftWallMargin against |lateral + latVel*driftWallMarginTime|
  // (position projected forward by slide velocity, so it fires ~0.4s early).
  driftWallMargin: 4.4,
  driftWallMarginTime: 0.45,
  // While drifting: steer = pursuit*driftPursuitMul + driftDir*driftSteerBias —
  // holds the slide but lets the pursuit term modulate the line.
  driftPursuitMul: 0.6,
  driftSteerBias: 0.4,
  // S-curve guard: release drift if the corner bends opposite the drift dir
  // by more than this tangent angle (rad).
  driftFlipAngle: 0.15,

  // Traffic: a kart within blockLat of our line, 2..blockAhead m in front,
  // blocks us — lift the throttle (no endless push-trains) and, after
  // overtakeTime blocked, sidestep overtakeBias m toward the freer side.
  blockAhead: 10,
  blockLat: 2.4,
  blockThrottle: 0.55,
  overtakeTime: 0.8,
  overtakeBias: 2.8,

  // Rubber-band: AI pace assist vs the player's race score — trailing bots
  // get a real top-speed edge, runaway leaders ease off. Compresses the
  // pack so positions actually swap (critic: field read as processional).
  // critic10 D8: gain 0.004→0.006, up 0.08→0.14 — best-lap spread ran
  // ~22s vs ~45s (≈2×); with AiDriver now honoring the assist cap the
  // deeper reserve pulls stragglers back toward ~1.3–1.5× leader pace.
  rubberBandGain: 0.006, // assist per score-point of gap (≈ per ~3 m)
  rubberBandUp: 0.14, // trailing: up to +14% top speed
  rubberBandDown: 0.05, // leading: up to -5%

  // Ink item: splat duration — victim's vision is degraded this long.
  inkDuration: 4,
} as const;
