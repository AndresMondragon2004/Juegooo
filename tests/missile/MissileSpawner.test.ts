import { describe, it, expect } from 'vitest';
import {
  calculateMissileSpawn,
  CameraViewportBounds,
  isMissileEligibleForRetirement,
  isOutsideCameraViewport
} from '../../src/core/missile/MissileSpawner';
import { shortestAngleDiff } from '../../src/core/math/angleUtils';

describe('MissileSpawner', () => {
  describe('spawn outside viewport across resolutions', () => {
    it('always spawns outside the visible viewport in desktop landscape (1280x720)', () => {
      const desktopViewport: CameraViewportBounds = {
        left: -640,
        right: 640,
        top: -360,
        bottom: 360
      };
      const playerPos = { x: 0, y: 0 };
      const margin = 120;

      for (let edge = 0; edge < 4; edge++) {
        const spawn = calculateMissileSpawn(desktopViewport, playerPos, margin, edge, 0.5, 0);

        const isOutsideX = spawn.x <= desktopViewport.left - margin || spawn.x >= desktopViewport.right + margin;
        const isOutsideY = spawn.y <= desktopViewport.top - margin || spawn.y >= desktopViewport.bottom + margin;
        expect(isOutsideX || isOutsideY).toBe(true);

        const distFromPlayer = Math.hypot(spawn.x - playerPos.x, spawn.y - playerPos.y);
        expect(distFromPlayer).toBeGreaterThan(margin);

        const directAngle = Math.atan2(playerPos.y - spawn.y, playerPos.x - spawn.x);
        expect(Math.abs(shortestAngleDiff(spawn.angle, directAngle))).toBeLessThan(0.1);
      }
    });

    it('always spawns outside the visible viewport in mobile portrait (390x844)', () => {
      const mobileViewport: CameraViewportBounds = {
        left: -195,
        right: 195,
        top: -422,
        bottom: 422
      };
      const playerPos = { x: 50, y: -80 };
      const margin = 100;

      for (let edge = 0; edge < 4; edge++) {
        const spawn = calculateMissileSpawn(mobileViewport, playerPos, margin, edge, 0.3, 0);

        const isOutsideX = spawn.x <= mobileViewport.left - margin || spawn.x >= mobileViewport.right + margin;
        const isOutsideY = spawn.y <= mobileViewport.top - margin || spawn.y >= mobileViewport.bottom + margin;
        expect(isOutsideX || isOutsideY).toBe(true);

        const distFromPlayer = Math.hypot(spawn.x - playerPos.x, spawn.y - playerPos.y);
        expect(distFromPlayer).toBeGreaterThan(margin);
      }
    });

    it('always spawns outside the visible viewport in mobile landscape (844x390)', () => {
      const mobileLandscapeViewport: CameraViewportBounds = {
        left: -422,
        right: 422,
        top: -195,
        bottom: 195
      };
      const playerPos = { x: 0, y: 0 };
      const margin = 110;

      for (let edge = 0; edge < 4; edge++) {
        const spawn = calculateMissileSpawn(mobileLandscapeViewport, playerPos, margin, edge, 0.7, 0);

        const isOutsideX = spawn.x <= mobileLandscapeViewport.left - margin || spawn.x >= mobileLandscapeViewport.right + margin;
        const isOutsideY = spawn.y <= mobileLandscapeViewport.top - margin || spawn.y >= mobileLandscapeViewport.bottom + margin;
        expect(isOutsideX || isOutsideY).toBe(true);
      }
    });
  });

  describe('distance retirement with visible screen protection', () => {
    const viewport: CameraViewportBounds = {
      left: 0,
      right: 1280,
      top: 0,
      bottom: 720
    };
    const playerPos = { x: 640, y: 360 };
    const maxDistance = 1600;
    const screenMargin = 100;

    it('does NOT retire a missile while it is visible on-screen, even if beyond maxDistance', () => {
      // In a very large resolution / zoom scenario where missile is inside viewport
      const visibleMissilePos = { x: 700, y: 400 };

      // Case 1: distance <= maxDistance, inside screen
      expect(
        isMissileEligibleForRetirement(visibleMissilePos, playerPos, viewport, maxDistance, screenMargin)
      ).toBe(false);

      // Case 2: artificial test where distance > maxDistance (say maxDistance was 50), but inside screen
      expect(
        isMissileEligibleForRetirement(visibleMissilePos, playerPos, viewport, 20, screenMargin)
      ).toBe(false);
    });

    it('does NOT retire a missile if distance <= maxDistance even if offscreen', () => {
      // Missile just off-screen (e.g. at x = 1450, y = 360), distance = 810 < 1600
      const offscreenNearMissile = { x: 1450, y: 360 };
      expect(isOutsideCameraViewport(offscreenNearMissile, viewport, screenMargin)).toBe(true);
      expect(
        isMissileEligibleForRetirement(offscreenNearMissile, playerPos, viewport, maxDistance, screenMargin)
      ).toBe(false);
    });

    it('retires a missile only when BOTH beyond maxDistance AND safely off-screen', () => {
      // Far off-screen missile (dist = 2000 > 1600, outside viewport)
      const farOffscreenMissile = { x: 2640, y: 360 };
      expect(isOutsideCameraViewport(farOffscreenMissile, viewport, screenMargin)).toBe(true);
      expect(
        isMissileEligibleForRetirement(farOffscreenMissile, playerPos, viewport, maxDistance, screenMargin)
      ).toBe(true);
    });
  });
});
