import { describe, it, expect } from 'vitest';
import { MissileModel } from '../../src/core/missile/MissileModel';
import { DEFAULT_MISSILE_CONFIG } from '../../src/config/missileConfig';

describe('MissileModel Lifecycle and Kinematics', () => {
  // Test 1: Persecución hacia una posición objetivo (HOMING)
  it('steers progressively towards the target position during HOMING state', () => {
    const missile = new MissileModel('test-1', 0, 0, 0, {
      ...DEFAULT_MISSILE_CONFIG,
      maxAngularVelocity: 1.0,
      speed: 100,
      fuelDuration: 5.0
    });

    expect(missile.state).toBe('HOMING');
    expect(missile.isHoming).toBe(true);

    missile.update(0.5, { x: 0, y: 100 });
    // Angle turns towards PI/2 by maxAngularVelocity * dt = 0.5 rad
    expect(missile.angle).toBeCloseTo(0.5);

    missile.update(1.0, { x: 0, y: 100 });
    expect(missile.angle).toBeCloseTo(1.5);
  });

  // Test 2: Transición de HOMING a BALLISTIC al agotarse el combustible
  it('transitions from HOMING to BALLISTIC when fuel is exhausted', () => {
    const missile = new MissileModel('test-2', 0, 0, 0, {
      ...DEFAULT_MISSILE_CONFIG,
      fuelDuration: 2.0,
      ballisticDuration: 1.0,
      destroyingDuration: 0.5
    });

    expect(missile.state).toBe('HOMING');

    // Run for 1.5s -> still HOMING
    missile.update(1.5, { x: 100, y: 0 });
    expect(missile.state).toBe('HOMING');
    expect(missile.fuelRemaining).toBeCloseTo(0.5);

    // Run for another 0.6s -> fuel expires -> transitions to BALLISTIC
    missile.update(0.6, { x: 100, y: 0 });
    expect(missile.state).toBe('BALLISTIC');
    expect(missile.isBallistic).toBe(true);
    expect(missile.fuelRemaining).toBe(0);
  });

  // Test 3: Ausencia de corrección de rumbo durante la fase BALLISTIC
  it('does NOT correct heading towards target during BALLISTIC flight', () => {
    const missile = new MissileModel('test-3', 0, 0, 0.4, {
      ...DEFAULT_MISSILE_CONFIG,
      fuelDuration: 1.0,
      ballisticDuration: 2.0,
      maxAngularVelocity: 3.0
    });

    // Exhaust fuel
    missile.update(1.05, { x: 100, y: 0 });
    expect(missile.state).toBe('BALLISTIC');

    const angleAtBurnout = missile.angle;

    // During ballistic flight, target is at 90 degrees (y=1000), but missile MUST NOT steer
    missile.update(0.5, { x: 0, y: 1000 });
    expect(missile.state).toBe('BALLISTIC');
    expect(missile.angle).toBeCloseTo(angleAtBurnout); // Angle is strictly unchanged!

    missile.update(0.5, { x: -1000, y: -1000 });
    expect(missile.angle).toBeCloseTo(angleAtBurnout); // Still unchanged
  });

  // Test 4: Transición de BALLISTIC a DESTROYING
  it('transitions from BALLISTIC to DESTROYING when ballistic duration expires', () => {
    const missile = new MissileModel('test-4', 0, 0, 0, {
      ...DEFAULT_MISSILE_CONFIG,
      fuelDuration: 1.0,
      ballisticDuration: 1.5,
      destroyingDuration: 0.45
    });

    // Advance through fuel (1.0s) and ballistic (1.5s)
    missile.update(1.0, { x: 100, y: 0 });
    expect(missile.state).toBe('BALLISTIC');

    missile.update(1.55, { x: 100, y: 0 });
    expect(missile.state).toBe('DESTROYING');
    expect(missile.isDestroying).toBe(true);
  });

  // Test 5: Transición de DESTROYING a INACTIVE (retirada definitiva)
  it('transitions from DESTROYING to INACTIVE after destruction sequence completes', () => {
    const missile = new MissileModel('test-5', 0, 0, 0, {
      ...DEFAULT_MISSILE_CONFIG,
      fuelDuration: 1.0,
      ballisticDuration: 1.0,
      destroyingDuration: 0.4
    });

    // Step 1: Exhaust fuel -> enters BALLISTIC
    missile.update(1.05, { x: 100, y: 0 });
    expect(missile.state).toBe('BALLISTIC');

    // Step 2: Exhaust ballistic flight -> enters DESTROYING
    missile.update(1.05, { x: 100, y: 0 });
    expect(missile.state).toBe('DESTROYING');
    expect(missile.isActive).toBe(true);

    // Step 3: Complete destruction sequence (0.4s) -> enters INACTIVE
    missile.update(0.45, { x: 100, y: 0 });
    expect(missile.state).toBe('INACTIVE');
    expect(missile.isInactive).toBe(true);
    expect(missile.isActive).toBe(false);
  });

  // Test 6: Impacto directo transiciona a DESTROYING
  it('transitions directly to DESTROYING on impact while canCollide is true', () => {
    const missile = new MissileModel('test-6', 0, 0, 0, {
      ...DEFAULT_MISSILE_CONFIG,
      fuelDuration: 5.0,
      destroyingDuration: 0.4
    });

    expect(missile.canCollide).toBe(true);
    missile.impact();

    expect(missile.state).toBe('DESTROYING');
    expect(missile.canCollide).toBe(false); // Cannot collide while exploding
  });

  // Test 7: Respeto del límite angular de giro en HOMING
  it('strictly respects the maximum angular velocity limit per time step', () => {
    const maxAngVel = 1.5; // rad/s
    const missile = new MissileModel('test-7', 0, 0, 0, {
      ...DEFAULT_MISSILE_CONFIG,
      maxAngularVelocity: maxAngVel,
      fuelDuration: 5.0
    });

    const dt = 0.2;
    missile.update(dt, { x: 0, y: 1000 });

    const maxExpectedDelta = maxAngVel * dt; // 0.3 rad
    expect(missile.angle).toBeCloseTo(maxExpectedDelta);
  });

  // Test 8: Cruce de límites -PI y +PI sin giros erráticos
  it('smoothly crosses the -PI / +PI seam without erratic full rotations', () => {
    const missile = new MissileModel('test-8', 0, 0, 3.1, {
      ...DEFAULT_MISSILE_CONFIG,
      maxAngularVelocity: 2.0,
      fuelDuration: 5.0
    });

    const targetX = -100;
    const targetY = Math.tan(-3.1) * -100;
    missile.update(0.1, { x: targetX, y: targetY });

    expect(missile.angle).toBeLessThan(0);
    expect(missile.angle).toBeCloseTo(-3.1, 1);
  });

  // Test 9: Independencia de framerate
  it('is frame-rate independent over the same total duration in HOMING', () => {
    const config = { ...DEFAULT_MISSILE_CONFIG, speed: 200, maxAngularVelocity: 1.5, fuelDuration: 5.0 };

    // Case A: 1 step of 0.6s
    const missileA = new MissileModel('test-9a', 0, 0, 0, config);
    missileA.update(0.6, { x: 300, y: 0 });

    // Case B: 6 steps of 0.1s
    const missileB = new MissileModel('test-9b', 0, 0, 0, config);
    for (let i = 0; i < 6; i++) {
      missileB.update(0.1, { x: 300, y: 0 });
    }

    expect(missileA.x).toBeCloseTo(missileB.x);
    expect(missileA.y).toBeCloseTo(missileB.y);
    expect(missileA.angle).toBeCloseTo(missileB.angle);
  });

  // Test 10: Limpieza y reutilización de recursos mediante reset()
  it('supports retirement and clean reset/reuse for subsequent spawns', () => {
    const missile = new MissileModel('test-10', 100, 100, 0, {
      ...DEFAULT_MISSILE_CONFIG,
      fuelDuration: 8.0,
      ballisticDuration: 1.5
    });

    missile.retire();
    expect(missile.isInactive).toBe(true);

    // Reset missile at new spawn location (-200, -300) facing PI/4
    missile.reset(-200, -300, Math.PI / 4);

    expect(missile.isHoming).toBe(true);
    expect(missile.state).toBe('HOMING');
    expect(missile.x).toBe(-200);
    expect(missile.y).toBe(-300);
    expect(missile.angle).toBeCloseTo(Math.PI / 4);
    expect(missile.fuelRemaining).toBeCloseTo(8.0);
    expect(missile.ballisticRemaining).toBeCloseTo(1.5);
  });

  // Test 11: Coincidencia de posiciones (sin NaN)
  it('safely handles coincident or near-coincident positions without producing NaN', () => {
    const initialAngle = 1.23;
    const missile = new MissileModel('test-11', 50, 50, initialAngle, DEFAULT_MISSILE_CONFIG);

    missile.update(0.1, { x: 50, y: 50 });

    expect(Number.isNaN(missile.x)).toBe(false);
    expect(Number.isNaN(missile.y)).toBe(false);
    expect(Number.isNaN(missile.angle)).toBe(false);
    expect(missile.angle).toBeCloseTo(initialAngle);
  });
});
