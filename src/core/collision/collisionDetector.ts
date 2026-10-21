/**
 * Circular collision detection and impact event tracking.
 * Engine-agnostic for comprehensive unit testing.
 */

export interface CircleCollider {
  x: number;
  y: number;
  radius: number;
}

/**
 * Checks whether two circular colliders intersect.
 */
export function checkCircleCollision(
  posA: { x: number; y: number },
  radiusA: number,
  posB: { x: number; y: number },
  radiusB: number
): boolean {
  const dx = posA.x - posB.x;
  const dy = posA.y - posB.y;
  const distSq = dx * dx + dy * dy;
  const combinedRadius = radiusA + radiusB;
  return distSq <= combinedRadius * combinedRadius;
}

/**
 * Ensures an impact event is triggered and recorded exactly once per missile.
 */
export class ImpactTracker {
  private impactedIds: Set<string> = new Set();

  /**
   * Attempts to register an impact for a given missile.
   * Returns true only the very first time an impact is recorded for this missile ID.
   */
  public registerImpact(missileId: string): boolean {
    if (this.impactedIds.has(missileId)) {
      return false;
    }
    this.impactedIds.add(missileId);
    return true;
  }

  public hasImpacted(missileId: string): boolean {
    return this.impactedIds.has(missileId);
  }

  public clear(missileId?: string): void {
    if (missileId) {
      this.impactedIds.delete(missileId);
    } else {
      this.impactedIds.clear();
    }
  }
}
