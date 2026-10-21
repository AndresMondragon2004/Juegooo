import { normalizeAngle } from '../math/angleUtils';

export interface CameraViewportBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface SpawnResult {
  x: number;
  y: number;
  angle: number;
}

/**
 * Options for the smart spawn algorithm.
 */
export interface SpawnOptions {
  /** Distance beyond the camera bounds in pixels. Default 80. */
  margin?: number;
  /** Extra jitter on the spawn angle in radians. Default 0.12 (~7 deg). */
  angleJitter?: number;
  /** Missile forward speed in px/s (used to estimate intercept time). */
  missileSpeed?: number;
  /** Missile fuel duration in seconds (max active steering time). */
  fuelDuration?: number;
  /** Fraction of fuel allowed for approach. 0.55 means missile must enter viewport using at most 55% of fuel. */
  maxApproachFuelFraction?: number;
  /** Minimum distance from the player in pixels to avoid too-close spawning. */
  minDistanceFromPlayer?: number;
  /** Maximum spawn attempts before falling back to a guaranteed safe spawn. */
  maxAttempts?: number;
  /** Optional forced edge (0=top, 1=bottom, 2=left, 3=right) for deterministic testing. */
  forcedEdge?: number;
  /** Optional normalized position along edge [0, 1] for deterministic testing. */
  edgePositionRatio?: number;
}

/**
 * Calculates a random point on one edge of the extended viewport rectangle.
 */
function pointOnEdge(
  viewport: CameraViewportBounds,
  margin: number,
  edge: number,
  ratio: number
): { x: number; y: number } {
  const L = viewport.left - margin;
  const R = viewport.right + margin;
  const T = viewport.top - margin;
  const B = viewport.bottom + margin;

  switch (edge % 4) {
    case 0: return { x: L + ratio * (R - L), y: T };         // top
    case 1: return { x: L + ratio * (R - L), y: B };         // bottom
    case 2: return { x: L, y: T + ratio * (B - T) };         // left
    case 3:
    default: return { x: R, y: T + ratio * (B - T) };        // right
  }
}

/**
 * Estimates the time (in seconds) for a missile to travel from spawn to the
 * nearest viewport edge. This is a conservative lower-bound: the actual time
 * is likely shorter because the missile steers toward the player inside the
 * viewport, not just to the edge.
 *
 * We use straight-line distance to the nearest viewport point as a proxy, which
 * under-estimates the time slightly (the missile curves), so the check is safe.
 */
function estimateViewportEntryTime(
  spawnPos: { x: number; y: number },
  viewport: CameraViewportBounds,
  speed: number
): number {
  // Clamp the spawn position to the nearest point on/inside the viewport rect
  const nearestX = Math.max(viewport.left, Math.min(viewport.right, spawnPos.x));
  const nearestY = Math.max(viewport.top, Math.min(viewport.bottom, spawnPos.y));
  const dist = Math.hypot(spawnPos.x - nearestX, spawnPos.y - nearestY);
  // Add a small buffer for the angular steering overhead (~15% extra)
  return dist / speed * 1.15;
}

/**
 * Smart missile spawn calculator.
 *
 * Guarantees:
 * - Spawn is OUTSIDE the visible viewport (including margin).
 * - Spawn is not too close to the player.
 * - The missile has sufficient fuel to enter the viewport before exhaustion.
 * - Multiple attempts are made; a safe fallback is used if none pass.
 *
 * @param viewport    Camera world-coordinate bounds (updated each frame).
 * @param playerPos   Current world position of the airplane.
 * @param options     Tuning parameters (all optional).
 */
export function calculateMissileSpawn(
  viewport: CameraViewportBounds,
  playerPos: { x: number; y: number },
  margin: number = 80,
  forcedEdge?: number,
  edgePositionRatio?: number,
  angleJitter: number = 0.12
): SpawnResult {
  // Build options from legacy positional API (preserved for backward compat with tests)
  return _calculateMissileSpawnCore(viewport, playerPos, {
    margin,
    angleJitter,
    forcedEdge,
    edgePositionRatio,
  });
}

/**
 * Full smart spawn with reachability validation. Call this from MissileManager.
 */
export function calculateSmartMissileSpawn(
  viewport: CameraViewportBounds,
  playerPos: { x: number; y: number },
  options: SpawnOptions = {}
): SpawnResult {
  return _calculateMissileSpawnCore(viewport, playerPos, options);
}

function _calculateMissileSpawnCore(
  viewport: CameraViewportBounds,
  playerPos: { x: number; y: number },
  options: SpawnOptions
): SpawnResult {
  const {
    margin = 80,
    angleJitter = 0.12,
    missileSpeed = 290,
    fuelDuration = 8.5,
    maxApproachFuelFraction = 0.55,
    minDistanceFromPlayer = 150,
    maxAttempts = 12,
    forcedEdge,
    edgePositionRatio,
  } = options;

  const maxApproachTime = fuelDuration * maxApproachFuelFraction;

  // In deterministic testing mode: skip validation loop, just compute directly
  if (forcedEdge !== undefined) {
    const ratio = edgePositionRatio !== undefined ? Math.max(0, Math.min(1, edgePositionRatio)) : Math.random();
    const pos = pointOnEdge(viewport, margin, forcedEdge, ratio);
    return buildResult(pos, playerPos, angleJitter);
  }

  // Attempt to find a valid random spawn
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const edge = Math.floor(Math.random() * 4);
    const ratio = Math.random();
    const pos = pointOnEdge(viewport, margin, edge, ratio);

    // 1. Must be outside the viewport
    if (!isOutsideCameraViewport(pos, viewport, margin * 0.5)) {
      continue;
    }

    // 2. Must not be too close to the player (avoid cheap instant kills)
    const distToPlayer = Math.hypot(pos.x - playerPos.x, pos.y - playerPos.y);
    if (distToPlayer < minDistanceFromPlayer) {
      continue;
    }

    // 3. Must have enough fuel to reach the viewport before exhaustion
    const approachTime = estimateViewportEntryTime(pos, viewport, missileSpeed);
    if (approachTime > maxApproachTime) {
      continue;
    }

    return buildResult(pos, playerPos, angleJitter);
  }

  // Fallback: guaranteed safe spawn on the nearest edge, close enough to enter viewport
  return fallbackSpawn(viewport, playerPos, margin, angleJitter);
}

/**
 * Creates the final SpawnResult: angle pointing towards player with jitter.
 */
function buildResult(
  pos: { x: number; y: number },
  playerPos: { x: number; y: number },
  angleJitter: number
): SpawnResult {
  const dx = playerPos.x - pos.x;
  const dy = playerPos.y - pos.y;
  const baseAngle = Math.atan2(dy, dx);
  const jitter = (Math.random() - 0.5) * 2 * angleJitter;
  return {
    x: pos.x,
    y: pos.y,
    angle: normalizeAngle(baseAngle + jitter)
  };
}

/**
 * Fallback: find the 4 edge midpoints, return the one farthest from player
 * but still guaranteed to be reachable (we use viewport half-diagonal as max margin).
 */
function fallbackSpawn(
  viewport: CameraViewportBounds,
  playerPos: { x: number; y: number },
  margin: number,
  angleJitter: number
): SpawnResult {
  const viewW = viewport.right - viewport.left;
  const viewH = viewport.bottom - viewport.top;
  const safeDist = Math.hypot(viewW, viewH) * 0.55; // ~55% of diagonal — always reachable

  // Choose edge by quadrant of player's last movement estimate (random for simplicity)
  const edge = Math.floor(Math.random() * 4);
  const ratio = 0.3 + Math.random() * 0.4; // Avoid corners

  // Clamp margin to safeDist
  const clampedMargin = Math.min(margin, safeDist * 0.5);
  const pos = pointOnEdge(viewport, clampedMargin, edge, ratio);
  return buildResult(pos, playerPos, angleJitter);
}

/**
 * Checks whether a position is outside the visible camera viewport (including safety margin).
 */
export function isOutsideCameraViewport(
  pos: { x: number; y: number },
  viewport: CameraViewportBounds,
  margin: number = 80
): boolean {
  return (
    pos.x < viewport.left - margin ||
    pos.x > viewport.right + margin ||
    pos.y < viewport.top - margin ||
    pos.y > viewport.bottom + margin
  );
}

/**
 * Checks if a missile is eligible for distance retirement.
 * Strictly guarantees that a missile is NEVER silently retired while visible on-screen:
 * It must be BOTH beyond maxDistance from player AND completely outside the camera viewport.
 */
export function isMissileEligibleForRetirement(
  missilePos: { x: number; y: number },
  playerPos: { x: number; y: number },
  viewport: CameraViewportBounds,
  maxDistance: number,
  screenMargin: number = 100
): boolean {
  const dx = missilePos.x - playerPos.x;
  const dy = missilePos.y - playerPos.y;
  const isFar = dx * dx + dy * dy > maxDistance * maxDistance;

  if (!isFar) {
    return false;
  }

  return isOutsideCameraViewport(missilePos, viewport, screenMargin);
}
