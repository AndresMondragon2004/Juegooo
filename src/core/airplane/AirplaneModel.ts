import { AirplaneConfig } from '../../config/airplaneConfig';
import { SteerCommand } from '../../input/IInputManager';
import { approachAngle, normalizeAngle } from '../math/angleUtils';

export interface AirplaneState {
  x: number;
  y: number;
  /** Heading angle in radians, standard polar (0 = right, PI/2 = down in screen coords) */
  angle: number;
  speed: number;
}

export class AirplaneModel {
  private _x: number;
  private _y: number;
  private _angle: number;
  private _config: AirplaneConfig;

  constructor(initialX: number = 0, initialY: number = 0, initialAngle: number = -Math.PI / 2, config: AirplaneConfig) {
    this._x = initialX;
    this._y = initialY;
    this._angle = normalizeAngle(initialAngle);
    this._config = { ...config };
  }

  public get x(): number {
    return this._x;
  }

  public get y(): number {
    return this._y;
  }

  public get angle(): number {
    return this._angle;
  }

  public get speed(): number {
    return this._config.speed;
  }

  public get config(): AirplaneConfig {
    return this._config;
  }

  public setConfig(newConfig: Partial<AirplaneConfig>): void {
    this._config = { ...this._config, ...newConfig };
  }

  public getState(): AirplaneState {
    return {
      x: this._x,
      y: this._y,
      angle: this._angle,
      speed: this._config.speed
    };
  }

  public setPosition(x: number, y: number): void {
    this._x = x;
    this._y = y;
  }

  public setAngle(angle: number): void {
    this._angle = normalizeAngle(angle);
  }

  /**
   * Updates airplane physics by dt seconds.
   * Frame-rate independent: integrates continuous forward translation and progressive rotation.
   *
   * @param dt Delta time in seconds.
   * @param command Steering intent.
   */
  public update(dt: number, command: SteerCommand): void {
    if (dt <= 0) return;

    // 1. Process steering command
    if (command.type === 'relative') {
      const angularDelta = command.direction * this._config.maxAngularVelocity * dt;
      this._angle = normalizeAngle(this._angle + angularDelta);
    } else if (command.type === 'targetAngle') {
      const maxStep = this._config.maxAngularVelocity * dt;
      this._angle = approachAngle(this._angle, command.angle, maxStep);
    }
    // If command.type === 'none', angle remains unchanged (requirement 7)

    // 2. Continuous forward motion at constant speed (requirements 1 & 2)
    const forwardX = Math.cos(this._angle);
    const forwardY = Math.sin(this._angle);

    this._x += forwardX * this._config.speed * dt;
    this._y += forwardY * this._config.speed * dt;
  }
}
