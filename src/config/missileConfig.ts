export interface MissileConfig {
  /** Linear forward speed in pixels per second (~10-20% faster than airplane base 250 px/s) */
  speed: number;
  /** Maximum angular velocity in radians per second (~115 deg/s, lower than airplane's 270 deg/s) */
  maxAngularVelocity: number;
  /** Collision radius of the missile in world pixels */
  collisionRadius: number;
  /** Collision radius of the airplane in world pixels */
  airplaneCollisionRadius: number;
  /** Duration of active homing pursuit with thruster on (in seconds) */
  fuelDuration: number;
  /** Duration of unguided ballistic flight after fuel exhaustion (in seconds) */
  ballisticDuration: number;
  /** Duration of visual destruction/disintegration sequence before removal (in seconds) */
  destroyingDuration: number;
  /** Seconds to wait before spawning a new missile after the previous one is retired/exhausted */
  spawnCooldown: number;
  /** Distance margin beyond the visible viewport edge where missiles can spawn (pixels) */
  spawnMargin: number;
  /** Distance threshold from player beyond which a lost off-screen missile is retired (pixels) */
  maxRetireDistance: number;
  /** Safety margin beyond viewport edge to ensure missile is completely invisible before distance retirement */
  retireScreenMargin: number;
  /** Backward-compatible alias for fuelDuration */
  lifetime?: number;
}

export const DEFAULT_MISSILE_CONFIG: MissileConfig = {
  speed: 290,               // ~16% faster than airplane (250 px/s)
  maxAngularVelocity: 2.0,  // ~114.6 deg/s — allows evasive maneuvers
  collisionRadius: 10,
  airplaneCollisionRadius: 14,
  fuelDuration: 8.5,         // 8.5s active homing
  ballisticDuration: 1.5,    // 1.5s straight unguided coast
  destroyingDuration: 0.45,  // 0.45s explosion sequence
  spawnCooldown: 2.0,        // 2.0s after retirement before next missile
  spawnMargin: 80,           // Spawns 80px beyond the camera boundary
  maxRetireDistance: 1800,   // Retire off-screen missiles beyond this distance
  retireScreenMargin: 100    // Extra viewport margin to prevent visible disappearance
};

// ─────────────────────────────────────────────────────────────────
// Spawn quality thresholds (referenced by MissileManager / tests)
// ─────────────────────────────────────────────────────────────────

/**
 * Maximum fraction of fuelDuration the missile may spend approaching the
 * viewport before entering. Spawns requiring more than this fraction of fuel
 * to reach the visible area are rejected as "ineffective".
 *
 * At speed=290 and fuelDuration=8.5:
 *   max distance for approach = 290 × 8.5 × 0.55 ≈ 1354 px
 * Desktop viewport half-diagonal ≈ 700 px → always reachable.
 * Mobile portrait viewport half-diagonal ≈ 470 px → always reachable.
 */
export const SPAWN_MAX_APPROACH_FUEL_FRACTION = 0.55;

/** Minimum spawn distance from the player in pixels (avoid unfair instant-kill spawns). */
export const SPAWN_MIN_DISTANCE_FROM_PLAYER = 180;

/** Maximum attempts to find a valid spawn position before using the fallback. */
export const SPAWN_MAX_ATTEMPTS = 14;

// ─────────────────────────────────────────────────────────────────
// Threat scaling progression
// ─────────────────────────────────────────────────────────────────

/** Defines one step in the missile pressure curve. */
export interface MissileProgressStage {
  /** Elapsed game time (seconds) when this stage activates. */
  time: number;
  /** Maximum number of simultaneously active missiles. */
  maxMissiles: number;
}

export const MISSILE_PROGRESSION: MissileProgressStage[] = [
  { time: 0,  maxMissiles: 1 },
  { time: 20, maxMissiles: 2 },
  { time: 45, maxMissiles: 3 },
  { time: 80, maxMissiles: 4 },
];
