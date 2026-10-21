import { describe, it, expect } from 'vitest';
import { approachAngle, normalizeAngle, shortestAngleDiff } from '../../src/core/math/angleUtils';

describe('angleUtils', () => {
  describe('normalizeAngle', () => {
    it('keeps angles within [-PI, PI) unchanged', () => {
      expect(normalizeAngle(0)).toBeCloseTo(0);
      expect(normalizeAngle(1)).toBeCloseTo(1);
      expect(normalizeAngle(-1)).toBeCloseTo(-1);
      expect(normalizeAngle(-Math.PI / 2)).toBeCloseTo(-Math.PI / 2);
    });

    it('wraps angles greater than PI', () => {
      // 3 * PI / 2 should wrap to -PI / 2
      expect(normalizeAngle((3 * Math.PI) / 2)).toBeCloseTo(-Math.PI / 2);
      // 2 * PI should wrap to 0
      expect(normalizeAngle(2 * Math.PI)).toBeCloseTo(0);
      // 4 * PI should wrap to 0
      expect(normalizeAngle(4 * Math.PI)).toBeCloseTo(0);
    });

    it('wraps angles less than -PI', () => {
      // -3 * PI / 2 should wrap to PI / 2
      expect(normalizeAngle((-3 * Math.PI) / 2)).toBeCloseTo(Math.PI / 2);
      // -2 * PI should wrap to 0
      expect(normalizeAngle(-2 * Math.PI)).toBeCloseTo(0);
    });
  });

  describe('shortestAngleDiff', () => {
    it('returns positive for clockwise shortest path', () => {
      // From 0 to PI/2 is +PI/2
      expect(shortestAngleDiff(0, Math.PI / 2)).toBeCloseTo(Math.PI / 2);
    });

    it('returns negative for counter-clockwise shortest path', () => {
      // From 0 to -PI/2 is -PI/2
      expect(shortestAngleDiff(0, -Math.PI / 2)).toBeCloseTo(-Math.PI / 2);
    });

    it('chooses the shortest path across the 180 / -180 boundary', () => {
      // From 170 deg (approx 2.967 rad) to -170 deg (-2.967 rad)
      // Turning clockwise across boundary is +20 deg (~0.349 rad)
      const from = (170 * Math.PI) / 180;
      const to = (-170 * Math.PI) / 180;
      const diff = shortestAngleDiff(from, to);
      expect(diff).toBeCloseTo((20 * Math.PI) / 180);
    });
  });

  describe('approachAngle', () => {
    it('approaches target without overshooting when distance < maxStep', () => {
      const current = 0;
      const target = 0.1;
      const maxStep = 0.5;
      expect(approachAngle(current, target, maxStep)).toBeCloseTo(target);
    });

    it('moves exactly maxStep towards target when distance > maxStep', () => {
      const current = 0;
      const target = 1.0;
      const maxStep = 0.2;
      expect(approachAngle(current, target, maxStep)).toBeCloseTo(0.2);
    });

    it('correctly crosses the PI / -PI seam', () => {
      const current = Math.PI - 0.1;
      const target = -Math.PI + 0.1;
      const maxStep = 0.15;
      const next = approachAngle(current, target, maxStep);
      // Diff is +0.2 rad clockwise, so next should be current + 0.15 = PI + 0.05 -> -PI + 0.05
      const expected = normalizeAngle(current + 0.15);
      expect(next).toBeCloseTo(expected);
    });
  });
});
