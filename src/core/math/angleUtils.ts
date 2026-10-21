/**
 * Utility functions for 2D rotational mathematics and angular steering.
 * Completely engine-agnostic for robust unit testing.
 */

const TWO_PI = Math.PI * 2;

/**
 * Normalizes an angle in radians to the standard range [-PI, PI).
 */
export function normalizeAngle(angle: number): number {
  let a = (angle + Math.PI) % TWO_PI;
  if (a < 0) {
    a += TWO_PI;
  }
  return a - Math.PI;
}

/**
 * Computes the signed shortest angular difference from angle 'from' to angle 'to'.
 * Returns a value in [-PI, PI].
 * Positive means clockwise rotation (increasing angle in screen coords).
 * Negative means counter-clockwise rotation.
 */
export function shortestAngleDiff(from: number, to: number): number {
  return normalizeAngle(to - from);
}

/**
 * Approaches 'target' angle from 'current' angle by at most 'maxStep' radians,
 * along the shortest rotational path, preventing overshooting.
 */
export function approachAngle(current: number, target: number, maxStep: number): number {
  if (maxStep <= 0) {
    return normalizeAngle(current);
  }
  const diff = shortestAngleDiff(current, target);
  if (Math.abs(diff) <= maxStep) {
    return normalizeAngle(target);
  }
  return normalizeAngle(current + Math.sign(diff) * maxStep);
}

/**
 * Linear interpolation between two scalar numbers.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Clamps a number between min and max.
 */
export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}
