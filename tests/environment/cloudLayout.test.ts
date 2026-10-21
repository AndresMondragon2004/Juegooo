import { describe, it, expect } from 'vitest';
import {
  getCloudsInArea,
  calculateMinDistance,
  DEFAULT_NATURAL_CLOUD_CONFIG,
  getCellCloud
} from '../../src/core/environment/cloudLayout';

describe('naturalCloudLayout', () => {
  it('guarantees strictly maintained minimum distance (>= 220px) between every pair of clouds', () => {
    // Sample a large area (e.g. 3000 x 3000 px)
    const clouds = getCloudsInArea(0, 0, 3000, 3000, DEFAULT_NATURAL_CLOUD_CONFIG);
    expect(clouds.length).toBeGreaterThan(10);

    const minDist = calculateMinDistance(clouds);
    const expectedMin = DEFAULT_NATURAL_CLOUD_CONFIG.cellSize - 2 * DEFAULT_NATURAL_CLOUD_CONFIG.maxJitter;
    expect(minDist).toBeGreaterThanOrEqual(expectedMin);
    expect(expectedMin).toBe(220);
  });

  it('provides a sparse, natural occupancy (~40-45%) leaving vast open sky', () => {
    const totalCells = 100; // 10 x 10 grid
    let occupiedCount = 0;
    for (let gy = 0; gy < 10; gy++) {
      for (let gx = 0; gx < 10; gx++) {
        if (getCellCloud(gx, gy, DEFAULT_NATURAL_CLOUD_CONFIG) !== null) {
          occupiedCount++;
        }
      }
    }
    const occupancyRatio = occupiedCount / totalCells;
    // Expected around 0.42 (allow reasonable statistical range [0.30, 0.55])
    expect(occupancyRatio).toBeGreaterThanOrEqual(0.30);
    expect(occupancyRatio).toBeLessThanOrEqual(0.55);
  });

  it('produces varied cloud variants (cumulus, stratus, wispy)', () => {
    const clouds = getCloudsInArea(-2000, -2000, 2000, 2000);
    const variants = new Set(clouds.map((c) => c.variant));

    expect(variants.has('cumulus')).toBe(true);
    expect(variants.has('stratus')).toBe(true);
    expect(variants.has('wispy')).toBe(true);
  });

  it('is strictly deterministic across calls', () => {
    const cloudsA = getCloudsInArea(-1000, -1000, 1000, 1000);
    const cloudsB = getCloudsInArea(-1000, -1000, 1000, 1000);

    expect(cloudsA.length).toBe(cloudsB.length);
    for (let i = 0; i < cloudsA.length; i++) {
      expect(cloudsA[i].cellKey).toBe(cloudsB[i].cellKey);
      expect(cloudsA[i].worldX).toBe(cloudsB[i].worldX);
      expect(cloudsA[i].worldY).toBe(cloudsB[i].worldY);
      expect(cloudsA[i].variant).toBe(cloudsB[i].variant);
      expect(cloudsA[i].scale).toBe(cloudsB[i].scale);
    }
  });
});
