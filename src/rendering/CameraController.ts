import Phaser from 'phaser';
import { AirplaneConfig } from '../config/airplaneConfig';
import { AirplaneState } from '../core/airplane/AirplaneModel';
import { lerp } from '../core/math/angleUtils';

export class CameraController {
  private camera: Phaser.Cameras.Scene2D.Camera;
  private currentX: number;
  private currentY: number;
  private currentLookaheadX: number = 0;
  private currentLookaheadY: number = 0;
  private config: AirplaneConfig;

  constructor(camera: Phaser.Cameras.Scene2D.Camera, initialX: number, initialY: number, config: AirplaneConfig) {
    this.camera = camera;
    this.config = config;
    this.currentX = initialX;
    this.currentY = initialY;
    this.camera.centerOn(initialX, initialY);
  }

  public getCenterX(): number {
    return this.currentX;
  }

  public getCenterY(): number {
    return this.currentY;
  }

  /**
   * Updates camera following logic.
   * Prioritizes keeping the airplane centered in all directions.
   *
   * @param airplaneState Current state of the aircraft.
   * @param dt Frame delta time in seconds.
   */
  public update(airplaneState: AirplaneState, dt: number): void {
    if (dt <= 0) return;

    // 1. Calculate lookahead (if configured, else 0 for strictly centered camera)
    if (this.config.cameraLookaheadDistance > 0) {
      const targetLeadX = Math.cos(airplaneState.angle) * this.config.cameraLookaheadDistance;
      const targetLeadY = Math.sin(airplaneState.angle) * this.config.cameraLookaheadDistance;
      const lookaheadFactor = 1 - Math.exp(-this.config.cameraLookaheadLerp * 60 * dt);
      this.currentLookaheadX = lerp(this.currentLookaheadX, targetLeadX, lookaheadFactor);
      this.currentLookaheadY = lerp(this.currentLookaheadY, targetLeadY, lookaheadFactor);
    } else {
      this.currentLookaheadX = 0;
      this.currentLookaheadY = 0;
    }

    // 2. Desired camera center
    const desiredCenterX = airplaneState.x + this.currentLookaheadX;
    const desiredCenterY = airplaneState.y + this.currentLookaheadY;

    // 3. Smooth tracking
    const followFactor = 1 - Math.exp(-this.config.cameraLerp * 60 * dt);
    this.currentX = lerp(this.currentX, desiredCenterX, followFactor);
    this.currentY = lerp(this.currentY, desiredCenterY, followFactor);

    // 4. Safe Zone Clamping (adapts dynamically to viewport dimensions)
    const halfWidth = this.camera.width * 0.5;
    const halfHeight = this.camera.height * 0.5;
    const maxAllowedOffsetX = halfWidth * this.config.cameraSafeZoneFraction;
    const maxAllowedOffsetY = halfHeight * this.config.cameraSafeZoneFraction;

    const diffX = airplaneState.x - this.currentX;
    const diffY = airplaneState.y - this.currentY;

    if (Math.abs(diffX) > maxAllowedOffsetX) {
      this.currentX = airplaneState.x - Math.sign(diffX) * maxAllowedOffsetX;
    }
    if (Math.abs(diffY) > maxAllowedOffsetY) {
      this.currentY = airplaneState.y - Math.sign(diffY) * maxAllowedOffsetY;
    }

    // 5. Apply to camera without any rotation (always upright)
    this.camera.centerOn(this.currentX, this.currentY);
  }
}
