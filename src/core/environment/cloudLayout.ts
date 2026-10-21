/**
 * Natural infinite cloud generation system.
 * Uses a sparse procedural 2D hash grid to produce organic, non-repeating cloud distributions
 * with guaranteed minimum separation and no visible lattice patterns.
 */

export type CloudVariant = 'cumulus' | 'stratus' | 'wispy';

export interface CellCloudData {
  cellKey: string;
  gx: number;
  gy: number;
  worldX: number;
  worldY: number;
  variant: CloudVariant;
  scale: number;
  baseAlpha: number;
}

export interface NaturalCloudConfig {
  cellSize: number;
  occupancyProbability: number;
  maxJitter: number;
}

export const DEFAULT_NATURAL_CLOUD_CONFIG: NaturalCloudConfig = {
  cellSize: 420,
  occupancyProbability: 0.42, // ~42% of cells have a cloud, ~58% open clear sky
  maxJitter: 100 // Guarantees min center distance >= cellSize - 2 * maxJitter = 220px
};

/**
 * Deterministic pseudo-random hash generator for 2D grid coordinates.
 * Returns a value in [0, 1).
 */
export function hash2D(gx: number, gy: number, seed: number = 0): number {
  const n = Math.sin(gx * 374761.393 + gy * 668265.263 + seed * 144269.504) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * Evaluates whether a cell at grid coordinate (gx, gy) contains a cloud,
 * and if so, returns its deterministic physical and visual properties.
 */
export function getCellCloud(
  gx: number,
  gy: number,
  config: NaturalCloudConfig = DEFAULT_NATURAL_CLOUD_CONFIG
): CellCloudData | null {
  const spawnRoll = hash2D(gx, gy, 1);
  if (spawnRoll >= config.occupancyProbability) {
    return null; // Empty sky cell
  }

  // 1. Choose variant
  const variantRoll = hash2D(gx, gy, 2);
  let variant: CloudVariant = 'cumulus';
  if (variantRoll < 0.40) {
    variant = 'cumulus';   // Classic puffy cloud
  } else if (variantRoll < 0.75) {
    variant = 'stratus';   // Elongated horizontal cloud
  } else {
    variant = 'wispy';     // Small airy wisp
  }

  // 2. Spatial jitter within safe cell bounds
  const jitterX = (hash2D(gx, gy, 3) - 0.5) * 2 * config.maxJitter;
  const jitterY = (hash2D(gx, gy, 4) - 0.5) * 2 * config.maxJitter;

  const worldX = (gx + 0.5) * config.cellSize + jitterX;
  const worldY = (gy + 0.5) * config.cellSize + jitterY;

  // 3. Scale and opacity based on variant
  let scale = 0.8;
  let baseAlpha = 0.28;

  if (variant === 'cumulus') {
    scale = 0.70 + hash2D(gx, gy, 5) * 0.45; // 0.70 - 1.15
    baseAlpha = 0.22 + hash2D(gx, gy, 6) * 0.14; // 0.22 - 0.36
  } else if (variant === 'stratus') {
    scale = 0.75 + hash2D(gx, gy, 5) * 0.40; // 0.75 - 1.15
    baseAlpha = 0.18 + hash2D(gx, gy, 6) * 0.12; // 0.18 - 0.30
  } else {
    scale = 0.60 + hash2D(gx, gy, 5) * 0.35; // 0.60 - 0.95
    baseAlpha = 0.16 + hash2D(gx, gy, 6) * 0.12; // 0.16 - 0.28
  }

  return {
    cellKey: `${gx}_${gy}`,
    gx,
    gy,
    worldX,
    worldY,
    variant,
    scale,
    baseAlpha
  };
}

/**
 * Returns all active clouds located within the world-space bounding box.
 */
export function getCloudsInArea(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  config: NaturalCloudConfig = DEFAULT_NATURAL_CLOUD_CONFIG
): CellCloudData[] {
  const minGx = Math.floor(minX / config.cellSize);
  const maxGx = Math.floor(maxX / config.cellSize);
  const minGy = Math.floor(minY / config.cellSize);
  const maxGy = Math.floor(maxY / config.cellSize);

  const clouds: CellCloudData[] = [];
  for (let gy = minGy; gy <= maxGy; gy++) {
    for (let gx = minGx; gx <= maxGx; gx++) {
      const cloud = getCellCloud(gx, gy, config);
      if (cloud) {
        clouds.push(cloud);
      }
    }
  }
  return clouds;
}

/**
 * Calculates the minimum Euclidean distance between all pairs of clouds.
 */
export function calculateMinDistance(clouds: CellCloudData[]): number {
  if (clouds.length < 2) return Number.POSITIVE_INFINITY;
  let minDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < clouds.length; i++) {
    for (let j = i + 1; j < clouds.length; j++) {
      const dx = clouds[i].worldX - clouds[j].worldX;
      const dy = clouds[i].worldY - clouds[j].worldY;
      const d = Math.hypot(dx, dy);
      if (d < minDist) {
        minDist = d;
      }
    }
  }
  return minDist;
}
