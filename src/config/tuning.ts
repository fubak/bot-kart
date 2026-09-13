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

  // Grip: fraction of lateral velocity removed per second (exp model).
  grip: 9,
  driftGrip: 1.6, // much lower lateral grip while drifting → slip angle
  driftSteerMul: 1.45, // drift turns sharper but looser

  // Drift → mini-turbo: charge seconds needed per boost tier.
  driftChargeTier: [0.9, 1.9],
  boostSpeed: 9, // added m/s during boost
  boostTime: [0.7, 1.4], // boost duration per tier
  boostAccel: 26,

  // Wall collision response.
  wallBounce: 0.35, // restitution into the road
  wallSpeedLoss: 0.55, // fraction of speed kept after wall hit
} as const;

export const CAMERA = {
  distance: 7.5,
  height: 3.4,
  lookAhead: 6.0, // meters ahead of kart along its heading
  posDamp: 5.0, // exp damping rate for position
  lookDamp: 9.0, // exp damping rate for look target
  fovBase: 60,
  fovSpeed: 14, // +fov at maxSpeed
  fovBoost: 8, // extra +fov while boosting
} as const;

export const TRACK = {
  roadHalfWidth: 6, // 12 m road
  samples: 1024, // centerline lookup resolution
  wallHeight: 0.55,
} as const;
