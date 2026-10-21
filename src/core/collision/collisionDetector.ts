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


export interface MovingCircle extends CircleCollider {
  previousX: number;
  previousY: number;
}

/** First contact in [0, 1], using simultaneous relative motion, not segment crossing. */
export function sweepCircles(a: MovingCircle, b: MovingCircle): number | null {
  const x = a.previousX - b.previousX;
  const y = a.previousY - b.previousY;
  const vx = a.x - a.previousX - (b.x - b.previousX);
  const vy = a.y - a.previousY - (b.y - b.previousY);
  const radius = a.radius + b.radius;
  const c = x * x + y * y - radius * radius;
  if (c <= 0) return 0;
  const speedSq = vx * vx + vy * vy;
  if (speedSq === 0) return null;
  const dot = x * vx + y * vy;
  if (dot >= 0) return null;
  const discriminant = dot * dot - speedSq * c;
  if (discriminant < 0) return null;
  const t = c / (-dot + Math.sqrt(discriminant));
  return t >= 0 && t <= 1 ? t : null;
}

export interface CollisionMissile extends MovingCircle {
  id: string;
  canCollide: boolean;
  collidableUntil?: number;
}
export interface CollisionContact {
  type: 'mutual' | 'airplane';
  ids: string[];
  fraction: number;
  x: number;
  y: number;
}

/** Chronological resolution; exact ties: mutual first, then lexical IDs.
 * Consumed missiles cannot hit again. A third missile survives a simultaneous
 * three-way contact; explosions never cause chain reactions.
 */
export function resolveMissileContacts(missiles: CollisionMissile[], plane: MovingCircle): CollisionContact[] {
  const ordered = missiles.filter(m => m.canCollide).slice().sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const candidates: CollisionContact[] = [];
  const add = (a: CollisionMissile, b: MovingCircle, type: CollisionContact['type'], ids: string[]) => {
    const fraction = sweepCircles(a, b);
    if (fraction === null || fraction > (a.collidableUntil ?? 1) ||
      ('collidableUntil' in b && fraction > ((b as CollisionMissile).collidableUntil ?? 1))) return;
    const ax = a.previousX + (a.x - a.previousX) * fraction;
    const ay = a.previousY + (a.y - a.previousY) * fraction;
    const bx = b.previousX + (b.x - b.previousX) * fraction;
    const by = b.previousY + (b.y - b.previousY) * fraction;
    const weight = a.radius / (a.radius + b.radius || 1);
    candidates.push({ type, ids, fraction, x: ax + (bx - ax) * weight, y: ay + (by - ay) * weight });
  };
  for (let i = 0; i < ordered.length; i++) {
    add(ordered[i], plane, 'airplane', [ordered[i].id]);
    for (let j = i + 1; j < ordered.length; j++) {
      add(ordered[i], ordered[j], 'mutual', [ordered[i].id, ordered[j].id]);
    }
  }
  candidates.sort((a, b) => a.fraction - b.fraction ||
    (a.type === b.type ? 0 : a.type === 'mutual' ? -1 : 1) ||
    (a.ids.join('/') < b.ids.join('/') ? -1 : 1));
  const consumed = new Set<string>();
  return candidates.filter(c => {
    if (c.ids.some(id => consumed.has(id))) return false;
    c.ids.forEach(id => consumed.add(id));
    return true;
  });
}
