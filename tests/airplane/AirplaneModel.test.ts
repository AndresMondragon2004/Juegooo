import { describe, it, expect } from 'vitest';
import { AirplaneModel } from '../../src/core/airplane/AirplaneModel';
import { DEFAULT_AIRPLANE_CONFIG } from '../../src/config/airplaneConfig';

describe('AirplaneModel', () => {
  it('moves constantly forward at configured speed without stopping', () => {
    // Start at (0, 0), facing directly right (angle = 0)
    const plane = new AirplaneModel(0, 0, 0, {
      ...DEFAULT_AIRPLANE_CONFIG,
      speed: 100
    });

    plane.update(1.0, { type: 'none' });

    expect(plane.x).toBeCloseTo(100);
    expect(plane.y).toBeCloseTo(0);
    expect(plane.angle).toBeCloseTo(0);
  });

  it('retains heading when input is none', () => {
    const initialAngle = Math.PI / 4; // 45 degrees
    const plane = new AirplaneModel(0, 0, initialAngle, DEFAULT_AIRPLANE_CONFIG);

    plane.update(0.5, { type: 'none' });
    expect(plane.angle).toBeCloseTo(initialAngle);

    plane.update(0.5, { type: 'none' });
    expect(plane.angle).toBeCloseTo(initialAngle);
  });

  it('turns progressively using relative keyboard commands based on dt and maxAngularVelocity', () => {
    const maxAngularVel = Math.PI; // 180 deg / s
    const plane = new AirplaneModel(0, 0, 0, {
      ...DEFAULT_AIRPLANE_CONFIG,
      maxAngularVelocity: maxAngularVel
    });

    // Turn right (+1) for 0.5 seconds -> should rotate by +PI/2
    plane.update(0.5, { type: 'relative', direction: 1 });
    expect(plane.angle).toBeCloseTo(Math.PI / 2);

    // Turn left (-1) for 0.25 seconds -> should rotate by -PI/4 -> result PI/4
    plane.update(0.25, { type: 'relative', direction: -1 });
    expect(plane.angle).toBeCloseTo(Math.PI / 4);
  });

  it('turns towards target angle progressively without teleporting', () => {
    const maxAngularVel = 1.0; // 1 rad/s
    const plane = new AirplaneModel(0, 0, 0, {
      ...DEFAULT_AIRPLANE_CONFIG,
      maxAngularVelocity: maxAngularVel
    });

    // Target is 2.0 rad, dt is 0.5s -> max step is 0.5 rad
    plane.update(0.5, { type: 'targetAngle', angle: 2.0 });
    expect(plane.angle).toBeCloseTo(0.5);

    // Continue for another 1.0s -> max step 1.0 rad -> angle = 1.5
    plane.update(1.0, { type: 'targetAngle', angle: 2.0 });
    expect(plane.angle).toBeCloseTo(1.5);

    // Step by 1.0s again -> distance is 0.5 to target 2.0 -> clamps exactly at target 2.0
    plane.update(1.0, { type: 'targetAngle', angle: 2.0 });
    expect(plane.angle).toBeCloseTo(2.0);
  });

  it('is frame-rate independent over the same total duration with constant input', () => {
    const config = { ...DEFAULT_AIRPLANE_CONFIG, speed: 200, maxAngularVelocity: 2.0 };

    // Case A: 1 big step of 1.0s
    const planeA = new AirplaneModel(0, 0, 0, config);
    planeA.update(1.0, { type: 'none' });

    // Case B: 10 small steps of 0.1s
    const planeB = new AirplaneModel(0, 0, 0, config);
    for (let i = 0; i < 10; i++) {
      planeB.update(0.1, { type: 'none' });
    }

    expect(planeA.x).toBeCloseTo(planeB.x);
    expect(planeA.y).toBeCloseTo(planeB.y);
    expect(planeA.angle).toBeCloseTo(planeB.angle);
  });
});
