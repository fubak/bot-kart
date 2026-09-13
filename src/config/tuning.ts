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

  // Drift → mini-turbo: charge seconds needed per boost tier.
  driftChargeTier: [0.9, 1.9],
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
} as const;

export const RACE = {
  laps: 3,
  countdown: 3.0, // seconds of input-locked 3-2-1 before GO
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
  cornerAccel: 23, // m/s² lateral budget — raise for faster cornering
  cornerMinSpeed: 8, // never slow below this for a corner (m/s)
  // Brake only when speed exceeds target*brakeMargin; pressure ramps up over
  // brakeBand m/s of overspeed so light overshoot gets a light tap.
  brakeMargin: 1.05,
  brakeBand: 6,
  brakeMin: 0.25,
  // Braking horizon = max(lookahead*brakeLookMul, speed*brakeTimeAhead); the
  // worst curvature found at these horizon fractions sets the target speed.
  brakeLookMul: 1.4,
  brakeTimeAhead: 1.25,
  curveSampleFracs: [0.35, 0.7, 1.0],

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
  // While drifting: steer = pursuit*driftPursuitMul + driftDir*driftSteerBias —
  // holds the slide but lets the pursuit term modulate the line.
  driftPursuitMul: 0.6,
  driftSteerBias: 0.5,
  // S-curve guard: release drift if the corner bends opposite the drift dir
  // by more than this tangent angle (rad).
  driftFlipAngle: 0.15,
} as const;
