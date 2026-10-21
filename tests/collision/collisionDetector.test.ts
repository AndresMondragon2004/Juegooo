import { describe, it, expect } from 'vitest';
import { checkCircleCollision, ImpactTracker } from '../../src/core/collision/collisionDetector';

describe('collisionDetector', () => {
  // Test 8: Detección de colisión avión-misil
  it('correctly detects circular collision when distance <= combined radii', () => {
    const planePos = { x: 100, y: 100 };
    const planeRadius = 14;
    const missileRadius = 10;

    // Inside collision range (dist = 20 <= 24)
    const collidingMissilePos = { x: 120, y: 100 };
    expect(checkCircleCollision(planePos, planeRadius, collidingMissilePos, missileRadius)).toBe(true);

    // Exact boundary (dist = 24 <= 24)
    const boundaryMissilePos = { x: 100, y: 124 };
    expect(checkCircleCollision(planePos, planeRadius, boundaryMissilePos, missileRadius)).toBe(true);

    // Outside collision range (dist = 25 > 24)
    const farMissilePos = { x: 100, y: 125 };
    expect(checkCircleCollision(planePos, planeRadius, farMissilePos, missileRadius)).toBe(false);
  });

  // Test 9: Registro único del impacto
  it('registers impact event exactly once per collision event', () => {
    const tracker = new ImpactTracker();
    const missileId = 'missile-omega';

    // First impact registration -> returns true
    expect(tracker.registerImpact(missileId)).toBe(true);
    expect(tracker.hasImpacted(missileId)).toBe(true);

    // Subsequent registration attempts for the same missile -> return false
    expect(tracker.registerImpact(missileId)).toBe(false);
    expect(tracker.registerImpact(missileId)).toBe(false);

    // Clearing the tracker allows new registration
    tracker.clear(missileId);
    expect(tracker.hasImpacted(missileId)).toBe(false);
    expect(tracker.registerImpact(missileId)).toBe(true);
  });
});
