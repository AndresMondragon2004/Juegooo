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
 * Calculates a spawn position strictly outside the visible camera viewport,
 * oriented towards the player so it enters view smoothly under its own movement.
 *
 * @param viewport Camera world coordinates bounds.
 * @param playerPos Current world coordinates of the airplane.
 * @param margin Distance beyond the camera bounds in pixels (default 120px).
 * @param forcedEdge Optional edge selector for deterministic testing (0=top, 1=bottom, 2=left, 3=right).
 * @param edgePositionRatio Optional normalized position along edge [0, 1] for testing.
 * @param angleJitter Optional angular spread in radians (default 0.15 rad / ~8.5 deg).
 */
export function calculateMissileSpawn(
  viewport: CameraViewportBounds,
  playerPos: { x: number; y: number },
  margin: number = 120,
  forcedEdge?: number,
  edgePositionRatio?: number,
  angleJitter: number = 0.15
): SpawnResult {
  const spawnLeft = viewport.left - margin;
  const spawnRight = viewport.right + margin;
  const spawnTop = viewport.top - margin;
  const spawnBottom = viewport.bottom + margin;

  const edge = forcedEdge !== undefined ? (forcedEdge % 4) : Math.floor(Math.random() * 4);
  const ratio = edgePositionRatio !== undefined ? Math.max(0, Math.min(1, edgePositionRatio)) : Math.random();

  let spawnX = 0;
  let spawnY = 0;

  switch (edge) {
    case 0: // Top edge
      spawnX = spawnLeft + ratio * (spawnRight - spawnLeft);
      spawnY = spawnTop;
      break;
    case 1: // Bottom edge
      spawnX = spawnLeft + ratio * (spawnRight - spawnLeft);
      spawnY = spawnBottom;
      break;
    case 2: // Left edge
      spawnX = spawnLeft;
      spawnY = spawnTop + ratio * (spawnBottom - spawnTop);
      break;
    case 3: // Right edge
    default:
      spawnX = spawnRight;
      spawnY = spawnTop + ratio * (spawnBottom - spawnTop);
      break;
  }

  // Calculate angle towards the player with subtle variance
  const dx = playerPos.x - spawnX;
  const dy = playerPos.y - spawnY;
  const baseAngle = Math.atan2(dy, dx);
  const jitter = (Math.random() - 0.5) * 2 * angleJitter;
  const finalAngle = normalizeAngle(baseAngle + jitter);

  return {
    x: spawnX,
    y: spawnY,
    angle: finalAngle
  };
}

/**
 * Checks whether a missile is outside the visible camera viewport (including safety margin).
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

  // Must also be verified to be completely outside camera view
  return isOutsideCameraViewport(missilePos, viewport, screenMargin);
}
