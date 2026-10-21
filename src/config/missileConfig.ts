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
  /** Seconds to wait before spawning a new missile after retirement */
  spawnCooldown: number;
  /** Spawn distance margin beyond the visible camera viewport in pixels */
  spawnMargin: number;
  /** Distance threshold from player beyond which a lost off-screen missile is retired */
  maxRetireDistance: number;
  /** Safety margin beyond viewport edge to ensure missile is completely invisible before distance retirement */
  retireScreenMargin: number;
  /** Backward-compatible alias for fuelDuration */
  lifetime?: number;
}

export const DEFAULT_MISSILE_CONFIG: MissileConfig = {
  speed: 290, // ~16% faster than airplane (250 px/s)
  maxAngularVelocity: 2.0, // ~114.6 deg/s (allows evasive maneuvers by out-turning it)
  collisionRadius: 10,
  airplaneCollisionRadius: 14,
  fuelDuration: 8.5, // 8.5s active homing with engine on
  ballisticDuration: 1.5, // 1.5s straight unguided flight with engine cut out
  destroyingDuration: 0.45, // 0.45s discrete disintegration/explosion sequence
  spawnCooldown: 2.2, // 2.2s after complete retirement before next spawn
  spawnMargin: 120, // Spawns 120px beyond visible camera bounds
  maxRetireDistance: 1600, // Distance threshold for off-screen retirement
  retireScreenMargin: 100 // Extra margin outside camera view to guarantee 0 visible disappearance
};
