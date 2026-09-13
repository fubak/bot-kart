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
  brake: 30,
  // Off-throttle deceleration (coast drag + rolling resistance).
  drag: 6,

  // Steering: rad/s at full lock, scaled by speedFactor(v).
  steerRate: 2.6,
  // Speed below which steering fades to near-zero (can't turn when parked).
  steerMinSpeed: 0.8,
  // Full steering effectiveness speed; fades above this (high-speed stability).
  steerFullSpeed: 10,
  // Steering input slew — rad/s-rate the virtual wheel approaches the stick
  // target; kills binary dart-twitch (critic: instant full-lock felt twitchy).
  steerSlew: 7,

  // Grip: fraction of lateral velocity removed per second (exp model).
  grip: 9,
  driftGrip: 1.6, // much lower lateral grip while drifting → slip angle
  driftSteerMul: 1.45, // drift turns sharper but looser

  // Drift → mini-turbo: charge seconds needed per boost tier.
  driftChargeTier: [0.9, 1.9],
  boostSpeed: 9, // added m/s during boost
  boostTime: [0.7, 1.4], // boost duration per tier
  boostAccel: 26,
  // Above maxSpeed (boost end, downhill), bleed back instead of hard-clamping.
  overSpeedDecay: 32,

  // Wall collision response — contact-EPISODE model: impact penalty once per
  // wall entry, scaled by how hard we hit; sustained contact only slides.
  wallBounce: 0.3, // restitution into the road on impact
  wallImpactLoss: 0.5, // fraction of OUTWARD speed kept... see Kart.ts
  wallScrub: 0.6, // per-second velocity scrub while grinding along the wall
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
