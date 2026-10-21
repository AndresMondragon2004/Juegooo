/**
 * Tests for MissileManager: multi-missile lifecycle, progression, and spawn quality.
 * FASE 0B.2.1
 */
import { describe, it, expect } from 'vitest';
import { MissileModel } from '../../src/core/missile/MissileModel';
import {
  calculateSmartMissileSpawn,
  calculateMissileSpawn,
  isOutsideCameraViewport,
  isMissileEligibleForRetirement,
  CameraViewportBounds
} from '../../src/core/missile/MissileSpawner';
import {
  DEFAULT_MISSILE_CONFIG,
  MISSILE_PROGRESSION,
  SPAWN_MAX_APPROACH_FUEL_FRACTION,
  SPAWN_MIN_DISTANCE_FROM_PLAYER,
} from '../../src/config/missileConfig';

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

/** Viewports for the three required resolutions. */
const VIEWPORTS = {
  mobilePortrait: { left: -195, right: 195, top: -422, bottom: 422 } as CameraViewportBounds,
  mobileLandscape: { left: -422, right: 422, top: -195, bottom: 195 } as CameraViewportBounds,
  desktop: { left: -640, right: 640, top: -360, bottom: 360 } as CameraViewportBounds,
};

const PLAYER_ORIGIN = { x: 0, y: 0 };

/** Seeded PRNG (mulberry32) for reproducible random tests. */
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s += 0x6D2B79F5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Advance a MissileModel by `seconds` in small fixed steps. */
function stepMissile(missile: MissileModel, target: { x: number; y: number }, seconds: number, step = 0.016): void {
  let remaining = seconds;
  while (remaining > 0) {
    const dt = Math.min(step, remaining);
    missile.update(dt, target);
    remaining -= dt;
  }
}

/**
 * Estimate time (s) for a point to reach the nearest viewport edge at given speed.
 * (Mirror of the internal logic in MissileSpawner for test assertions.)
 */
function estimateEntryTime(pos: { x: number; y: number }, viewport: CameraViewportBounds, speed: number): number {
  const nearestX = Math.max(viewport.left, Math.min(viewport.right, pos.x));
  const nearestY = Math.max(viewport.top, Math.min(viewport.bottom, pos.y));
  const dist = Math.hypot(pos.x - nearestX, pos.y - nearestY);
  return dist / speed * 1.15;
}

// ─────────────────────────────────────────────────────────────────
// 1. Spawn always outside the viewport (3 resolutions)
// ─────────────────────────────────────────────────────────────────
describe('MissileSpawner — spawn outside viewport', () => {
  const RUNS = 40; // Use many random trials

  for (const [label, viewport] of Object.entries(VIEWPORTS)) {
    it(`spawns outside viewport [${label}] for ${RUNS} random attempts`, () => {
      const rng = makeRng(0xDEADBEEF);
      const origRandom = Math.random;
      Math.random = rng;

      try {
        for (let i = 0; i < RUNS; i++) {
          const spawn = calculateSmartMissileSpawn(viewport, PLAYER_ORIGIN, {
            margin: DEFAULT_MISSILE_CONFIG.spawnMargin,
            missileSpeed: DEFAULT_MISSILE_CONFIG.speed,
            fuelDuration: DEFAULT_MISSILE_CONFIG.fuelDuration,
            maxApproachFuelFraction: SPAWN_MAX_APPROACH_FUEL_FRACTION,
            minDistanceFromPlayer: SPAWN_MIN_DISTANCE_FROM_PLAYER,
          });

          const outside = isOutsideCameraViewport(spawn, viewport, 0);
          expect(outside).toBe(true);
        }
      } finally {
        Math.random = origRandom;
      }
    });
  }

  it('legacy calculateMissileSpawn always spawns outside viewport in all 4 edges [1280×720]', () => {
    const vp = VIEWPORTS.desktop;
    for (let edge = 0; edge < 4; edge++) {
      const spawn = calculateMissileSpawn(vp, PLAYER_ORIGIN, 80, edge, 0.5, 0);
      expect(isOutsideCameraViewport(spawn, vp, 0)).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────
// 2. Minimum safe distance from player
// ─────────────────────────────────────────────────────────────────
describe('MissileSpawner — minimum distance from player', () => {
  it('spawn is never too close to the player (≥ minDistanceFromPlayer)', () => {
    const rng = makeRng(0xCAFEBABE);
    const origRandom = Math.random;
    Math.random = rng;

    try {
      for (const [, viewport] of Object.entries(VIEWPORTS)) {
        for (let i = 0; i < 30; i++) {
          const player = { x: 50, y: -80 };
          const spawn = calculateSmartMissileSpawn(viewport, player, {
            margin: 80,
            minDistanceFromPlayer: SPAWN_MIN_DISTANCE_FROM_PLAYER,
            missileSpeed: DEFAULT_MISSILE_CONFIG.speed,
            fuelDuration: DEFAULT_MISSILE_CONFIG.fuelDuration,
            maxApproachFuelFraction: SPAWN_MAX_APPROACH_FUEL_FRACTION,
          });
          const dist = Math.hypot(spawn.x - player.x, spawn.y - player.y);
          expect(dist).toBeGreaterThanOrEqual(SPAWN_MIN_DISTANCE_FROM_PLAYER);
        }
      }
    } finally {
      Math.random = origRandom;
    }
  });
});

// ─────────────────────────────────────────────────────────────────
// 3. Estimated viewport entry time must be within fuel budget
// ─────────────────────────────────────────────────────────────────
describe('MissileSpawner — viewport entry time within fuel', () => {
  const maxApproachTime = DEFAULT_MISSILE_CONFIG.fuelDuration * SPAWN_MAX_APPROACH_FUEL_FRACTION;

  for (const [label, viewport] of Object.entries(VIEWPORTS)) {
    it(`spawn entry time ≤ ${maxApproachTime.toFixed(1)}s [${label}]`, () => {
      const rng = makeRng(0xABCD1234);
      const origRandom = Math.random;
      Math.random = rng;

      try {
        for (let i = 0; i < 30; i++) {
          const spawn = calculateSmartMissileSpawn(viewport, PLAYER_ORIGIN, {
            margin: 80,
            missileSpeed: DEFAULT_MISSILE_CONFIG.speed,
            fuelDuration: DEFAULT_MISSILE_CONFIG.fuelDuration,
            maxApproachFuelFraction: SPAWN_MAX_APPROACH_FUEL_FRACTION,
            minDistanceFromPlayer: SPAWN_MIN_DISTANCE_FROM_PLAYER,
          });
          const entryTime = estimateEntryTime(spawn, viewport, DEFAULT_MISSILE_CONFIG.speed);
          expect(entryTime).toBeLessThanOrEqual(maxApproachTime + 0.01); // tiny float tolerance
        }
      } finally {
        Math.random = origRandom;
      }
    });
  }
});

// ─────────────────────────────────────────────────────────────────
// 4. Rejection of ineffective spawn positions (unit test of logic)
// ─────────────────────────────────────────────────────────────────
describe('MissileSpawner — ineffective spawn rejection', () => {
  it('a spawn 3000px away from the viewport center is too far to reach in time', () => {
    const vp = VIEWPORTS.desktop; // half-diag ≈ 730 px
    const farPos = { x: 4000, y: 0 }; // clearly outside reachable range

    const entryTime = estimateEntryTime(farPos, vp, DEFAULT_MISSILE_CONFIG.speed);
    const budget = DEFAULT_MISSILE_CONFIG.fuelDuration * SPAWN_MAX_APPROACH_FUEL_FRACTION;
    // This position should FAIL the budget test
    expect(entryTime).toBeGreaterThan(budget);
  });

  it('a spawn 300px beyond the right edge is reachable in time', () => {
    const vp = VIEWPORTS.desktop;
    const closePos = { x: vp.right + 300, y: 0 };

    const entryTime = estimateEntryTime(closePos, vp, DEFAULT_MISSILE_CONFIG.speed);
    const budget = DEFAULT_MISSILE_CONFIG.fuelDuration * SPAWN_MAX_APPROACH_FUEL_FRACTION;
    expect(entryTime).toBeLessThan(budget);
  });
});

// ─────────────────────────────────────────────────────────────────
// 5. Missile state independence (no shared state between instances)
// ─────────────────────────────────────────────────────────────────
describe('MissileModel — state independence', () => {
  it('two missiles evolve independently without state bleeding', () => {
    const m1 = new MissileModel('m1', 0, 0, 0, DEFAULT_MISSILE_CONFIG);
    const m2 = new MissileModel('m2', 500, 500, Math.PI, DEFAULT_MISSILE_CONFIG);

    const target = { x: 300, y: 300 };

    stepMissile(m1, target, 3.0);
    stepMissile(m2, target, 1.0);

    expect(m1.state).toBe('HOMING');
    expect(m2.state).toBe('HOMING');

    // Their positions must differ — they started at different spots
    expect(m1.x).not.toBeCloseTo(m2.x, 1);
    expect(m1.y).not.toBeCloseTo(m2.y, 1);

    // Their fuel must differ — one has been running 3x longer
    expect(m1.fuelRemaining).toBeLessThan(m2.fuelRemaining);
  });
});

// ─────────────────────────────────────────────────────────────────
// 6. Missile completes full lifecycle and becomes INACTIVE
// ─────────────────────────────────────────────────────────────────
describe('MissileModel — full lifecycle completion', () => {
  it('missile transitions HOMING → BALLISTIC → DESTROYING → INACTIVE', () => {
    const config = { ...DEFAULT_MISSILE_CONFIG, fuelDuration: 0.5, ballisticDuration: 0.3, destroyingDuration: 0.2 };
    const m = new MissileModel('m1', 0, 0, 0, config);
    const target = { x: 1000, y: 0 };

    expect(m.state).toBe('HOMING');

    stepMissile(m, target, 0.6); // past fuel
    expect(m.state).toBe('BALLISTIC');

    stepMissile(m, target, 0.35); // past ballistic
    expect(m.state).toBe('DESTROYING');

    stepMissile(m, target, 0.25); // past destroying
    expect(m.state).toBe('INACTIVE');
  });

  it('missile slot is reuable after becoming INACTIVE', () => {
    const config = { ...DEFAULT_MISSILE_CONFIG, fuelDuration: 0.2, ballisticDuration: 0.1, destroyingDuration: 0.1 };
    const m = new MissileModel('reusable', 0, 0, 0, config);

    stepMissile(m, { x: 0, y: 0 }, 0.5); // let it exhaust
    expect(m.isInactive).toBe(true);

    // Reset without providing new config: missile restores its own stored fuelDuration (0.2)
    m.reset(100, 200, Math.PI / 4);
    expect(m.state).toBe('HOMING');
    expect(m.fuelRemaining).toBeCloseTo(config.fuelDuration, 2); // 0.2 — its stored config
    expect(m.x).toBe(100);
    expect(m.y).toBe(200);
  });

  it('missile slot resets to a custom config fuel when provided', () => {
    const config = { ...DEFAULT_MISSILE_CONFIG, fuelDuration: 0.2, ballisticDuration: 0.1, destroyingDuration: 0.1 };
    const m = new MissileModel('reusable2', 0, 0, 0, config);

    stepMissile(m, { x: 0, y: 0 }, 0.5);
    expect(m.isInactive).toBe(true);

    // Reset with explicit new fuelDuration matching DEFAULT
    m.reset(0, 0, 0, { fuelDuration: DEFAULT_MISSILE_CONFIG.fuelDuration });
    expect(m.state).toBe('HOMING');
    expect(m.fuelRemaining).toBeCloseTo(DEFAULT_MISSILE_CONFIG.fuelDuration, 1);
  });
});

// ─────────────────────────────────────────────────────────────────
// 7. Progression: max missile count increases over time
// ─────────────────────────────────────────────────────────────────
describe('MISSILE_PROGRESSION — threat scaling', () => {
  function maxMissilesAt(elapsedSeconds: number): number {
    let max = 1;
    for (const stage of MISSILE_PROGRESSION) {
      if (elapsedSeconds >= stage.time) max = stage.maxMissiles;
      else break;
    }
    return max;
  }

  it('starts at 1 missile', () => expect(maxMissilesAt(0)).toBe(1));
  it('reaches 2 at t=20s', () => expect(maxMissilesAt(20)).toBe(2));
  it('reaches 3 at t=45s', () => expect(maxMissilesAt(45)).toBe(3));
  it('reaches 4 at t=80s', () => expect(maxMissilesAt(80)).toBe(4));
  it('stays at 1 just before t=20s', () => expect(maxMissilesAt(19.9)).toBe(1));
  it('stays at 2 just before t=45s', () => expect(maxMissilesAt(44.9)).toBe(2));
});

// ─────────────────────────────────────────────────────────────────
// 8. Spawn angle points towards the player
// ─────────────────────────────────────────────────────────────────
describe('MissileSpawner — spawn angle orientation', () => {
  it('spawn angle points generally toward the player (within ±0.2 rad with jitter=0)', () => {
    const vp = VIEWPORTS.desktop;
    for (let edge = 0; edge < 4; edge++) {
      const player = { x: 0, y: 0 };
      const spawn = calculateMissileSpawn(vp, player, 80, edge, 0.5, 0);
      const directAngle = Math.atan2(player.y - spawn.y, player.x - spawn.x);
      const diff = Math.abs(spawn.angle - directAngle);
      const normalized = diff > Math.PI ? Math.PI * 2 - diff : diff;
      expect(normalized).toBeLessThan(0.2);
    }
  });
});

// ─────────────────────────────────────────────────────────────────
// 9. Spawn with moving player (non-origin positions)
// ─────────────────────────────────────────────────────────────────
describe('MissileSpawner — non-stationary player', () => {
  it('spawns correctly when player is far from origin', () => {
    const rng = makeRng(0x12345678);
    const origRandom = Math.random;
    Math.random = rng;

    try {
      // Player at 5000, 3000 (deep in the infinite world)
      const player = { x: 5000, y: 3000 };
      // Viewport follows the player
      const vp: CameraViewportBounds = {
        left: player.x - 640,
        right: player.x + 640,
        top: player.y - 360,
        bottom: player.y + 360,
      };

      for (let i = 0; i < 20; i++) {
        const spawn = calculateSmartMissileSpawn(vp, player, {
          margin: 80,
          missileSpeed: DEFAULT_MISSILE_CONFIG.speed,
          fuelDuration: DEFAULT_MISSILE_CONFIG.fuelDuration,
          maxApproachFuelFraction: SPAWN_MAX_APPROACH_FUEL_FRACTION,
          minDistanceFromPlayer: SPAWN_MIN_DISTANCE_FROM_PLAYER,
        });

        expect(isOutsideCameraViewport(spawn, vp, 0)).toBe(true);
        const dist = Math.hypot(spawn.x - player.x, spawn.y - player.y);
        expect(dist).toBeGreaterThanOrEqual(SPAWN_MIN_DISTANCE_FROM_PLAYER);
      }
    } finally {
      Math.random = origRandom;
    }
  });
});

// ─────────────────────────────────────────────────────────────────
// 10. Multi-cycle simulation: no long gaps between threats
// ─────────────────────────────────────────────────────────────────
describe('Multi-missile simulation — no sustained threat gaps', () => {
  /**
   * Simulates the MissileManager logic (without Phaser) for a set duration
   * and records whether there was any active missile each frame.
   */
  it('has at most one gap > 5s without any missile (single missile stage)', () => {
    // We'll simulate the manager logic in pure TS: spawn, step, retire.
    const config = { ...DEFAULT_MISSILE_CONFIG, fuelDuration: 2.0, ballisticDuration: 0.5, destroyingDuration: 0.2 };
    const vp = VIEWPORTS.desktop;
    const player = PLAYER_ORIGIN;

    let elapsedTime = 0;
    let spawnTimer = config.spawnCooldown;
    let missile: MissileModel | null = null;
    let gapTime = 0;
    let maxGap = 0;
    const SIM_DURATION = 40; // seconds
    const DT = 0.016;

    const rng = makeRng(0x5EED1234);
    const origRandom = Math.random;
    Math.random = rng;

    try {
      while (elapsedTime < SIM_DURATION) {
        elapsedTime += DT;

        // Retire inactive missile
        if (missile !== null && missile.isInactive) {
          missile = null;
          spawnTimer = config.spawnCooldown;
        }

        // Spawn if slot free
        if (missile === null) {
          spawnTimer -= DT;
          if (spawnTimer <= 0) {
            const spawn = calculateSmartMissileSpawn(vp, player, {
              margin: 80,
              missileSpeed: config.speed,
              fuelDuration: config.fuelDuration,
              maxApproachFuelFraction: SPAWN_MAX_APPROACH_FUEL_FRACTION,
              minDistanceFromPlayer: SPAWN_MIN_DISTANCE_FROM_PLAYER,
            });
            missile = new MissileModel(`m-sim`, spawn.x, spawn.y, spawn.angle, config);
            spawnTimer = config.spawnCooldown;
          }
        }

        // Step missile
        if (missile !== null) {
          missile.update(DT, player);
          gapTime = 0;
        } else {
          gapTime += DT;
          maxGap = Math.max(maxGap, gapTime);
        }
      }
    } finally {
      Math.random = origRandom;
    }

    // We should never have a gap longer than spawnCooldown + a full missile lifetime + a margin
    const maxAllowedGap = config.spawnCooldown + config.fuelDuration + config.ballisticDuration + 0.5;
    expect(maxGap).toBeLessThan(maxAllowedGap);
  });
});

// ─────────────────────────────────────────────────────────────────
// 11. Missile behavior with sharp heading changes
// ─────────────────────────────────────────────────────────────────
describe('MissileModel — sharp player heading changes', () => {
  it('missile steers toward updated target position after player turns sharply', () => {
    const m = new MissileModel('m1', -400, 0, 0, DEFAULT_MISSILE_CONFIG); // starts left of player

    const target1 = { x: 0, y: 0 };
    stepMissile(m, target1, 1.0);

    // Player suddenly moves far downward (simulates a tight turn)
    const target2 = { x: 0, y: 600 };
    stepMissile(m, target2, 2.0);

    // Missile should now be angled toward the new target
    const angleToTarget2 = Math.atan2(target2.y - m.y, target2.x - m.x);
    const angleDiff = Math.abs(m.angle - angleToTarget2);
    const normalized = angleDiff > Math.PI ? Math.PI * 2 - angleDiff : angleDiff;

    // Should be steering in the right direction (within 60 deg, given angular velocity constraint)
    expect(normalized).toBeLessThan(Math.PI / 3);
  });
});

// ─────────────────────────────────────────────────────────────────
// 12. Distance retirement never hides visible missiles
// ─────────────────────────────────────────────────────────────────
describe('isMissileEligibleForRetirement — visibility guarantee', () => {
  const vp = VIEWPORTS.desktop;
  const player = PLAYER_ORIGIN;
  const maxDist = DEFAULT_MISSILE_CONFIG.maxRetireDistance;
  const screenMargin = DEFAULT_MISSILE_CONFIG.retireScreenMargin;

  it('does not retire a missile inside the viewport even if past maxDist', () => {
    const insidePos = { x: 0, y: 0 }; // right on player = inside viewport
    expect(isMissileEligibleForRetirement(insidePos, player, vp, 1, screenMargin)).toBe(false);
  });

  it('does not retire a missile near-but-outside viewport if distance < maxDist', () => {
    const nearPos = { x: vp.right + 50, y: 0 }; // just outside right edge
    // Distance from player ≈ 690 px < maxDist
    expect(isMissileEligibleForRetirement(nearPos, player, vp, maxDist, screenMargin)).toBe(false);
  });

  it('retires a missile that is far away AND outside the viewport', () => {
    const farPos = { x: vp.right + 2500, y: 0 };
    expect(isMissileEligibleForRetirement(farPos, player, vp, maxDist, screenMargin)).toBe(true);
  });
});
