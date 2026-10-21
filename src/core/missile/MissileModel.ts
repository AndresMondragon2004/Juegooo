import { MissileConfig, DEFAULT_MISSILE_CONFIG } from '../../config/missileConfig';
import { approachAngle, normalizeAngle } from '../math/angleUtils';

export type MissileLifecycleState = 'HOMING' | 'BALLISTIC' | 'DESTROYING' | 'INACTIVE';

export class MissileModel {
  public readonly id: string;
  private _x: number;
  private _y: number;
  private _angle: number;
  private _speed: number;
  private _maxAngularVelocity: number;
  private _collisionRadius: number;

  // Lifecycle timers
  private _fuelRemaining: number;
  private _ballisticRemaining: number;
  private _destroyingRemaining: number;
  private _state: MissileLifecycleState;
  private _config: MissileConfig;

  constructor(
    id: string = 'missile-1',
    initialX: number = 0,
    initialY: number = 0,
    initialAngle: number = 0,
    config: MissileConfig = DEFAULT_MISSILE_CONFIG
  ) {
    this.id = id;
    this._x = initialX;
    this._y = initialY;
    this._angle = normalizeAngle(initialAngle);
    this._config = { ...config };
    this._speed = config.speed;
    this._maxAngularVelocity = config.maxAngularVelocity;
    this._collisionRadius = config.collisionRadius;

    const initialFuel = config.fuelDuration ?? config.lifetime ?? 8.5;
    this._fuelRemaining = initialFuel;
    this._ballisticRemaining = config.ballisticDuration;
    this._destroyingRemaining = config.destroyingDuration;
    this._state = 'HOMING';
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
    return this._speed;
  }

  public get maxAngularVelocity(): number {
    return this._maxAngularVelocity;
  }

  public get collisionRadius(): number {
    return this._collisionRadius;
  }

  public get state(): MissileLifecycleState {
    return this._state;
  }

  public get fuelRemaining(): number {
    return this._fuelRemaining;
  }

  public get ballisticRemaining(): number {
    return this._ballisticRemaining;
  }

  public get destroyingRemaining(): number {
    return this._destroyingRemaining;
  }

  /**
   * Alias for fuelRemaining for backward compatibility.
   */
  public get lifetime(): number {
    return this._fuelRemaining;
  }

  public get isHoming(): boolean {
    return this._state === 'HOMING';
  }

  public get isBallistic(): boolean {
    return this._state === 'BALLISTIC';
  }

  public get isDestroying(): boolean {
    return this._state === 'DESTROYING';
  }

  public get isInactive(): boolean {
    return this._state === 'INACTIVE';
  }

  /**
   * Active as long as it is physically in the game world (homing, ballistic, or in destruction sequence).
   */
  public get isActive(): boolean {
    return this._state !== 'INACTIVE';
  }

  /**
   * Indicates whether the missile can collide with targets (only while homing or ballistic).
   */
  public get canCollide(): boolean {
    return this._state === 'HOMING' || this._state === 'BALLISTIC';
  }

  /**
   * Updates missile homing kinematics and lifecycle state machine.
   * Completely frame-rate independent.
   *
   * @param dt Delta time in seconds.
   * @param target Current target world position (e.g. airplane center).
   */
  public update(dt: number, target: { x: number; y: number }): void {
    if (this._state === 'INACTIVE' || dt <= 0) {
      return;
    }

    if (this._state === 'HOMING') {
      // 1. Consume fuel
      this._fuelRemaining -= dt;

      // 2. Calculate steering towards target
      const dx = target.x - this._x;
      const dy = target.y - this._y;
      const distSq = dx * dx + dy * dy;

      if (distSq > 0.0001) {
        const desiredAngle = Math.atan2(dy, dx);
        const maxStep = this._maxAngularVelocity * dt;
        this._angle = approachAngle(this._angle, desiredAngle, maxStep);
      }

      // 3. Move forward at constant speed
      this._x += Math.cos(this._angle) * this._speed * dt;
      this._y += Math.sin(this._angle) * this._speed * dt;

      // Check transition: fuel exhaustion -> BALLISTIC
      if (this._fuelRemaining <= 0) {
        this._fuelRemaining = 0;
        this._state = 'BALLISTIC';
        this._ballisticRemaining = this._config.ballisticDuration;
      }
    } else if (this._state === 'BALLISTIC') {
      // 1. Advance ballistic timer
      this._ballisticRemaining -= dt;

      // 2. NO STEERING: angle remains unchanged, continues forward along trajectory
      this._x += Math.cos(this._angle) * this._speed * dt;
      this._y += Math.sin(this._angle) * this._speed * dt;

      // Check transition: ballistic flight finished -> DESTROYING
      if (this._ballisticRemaining <= 0) {
        this._ballisticRemaining = 0;
        this._state = 'DESTROYING';
        this._destroyingRemaining = this._config.destroyingDuration;
      }
    } else if (this._state === 'DESTROYING') {
      // 1. Advance destruction animation timer
      this._destroyingRemaining -= dt;

      // 2. Slight forward deceleration with remaining inertia
      const residualSpeed = this._speed * 0.35;
      this._x += Math.cos(this._angle) * residualSpeed * dt;
      this._y += Math.sin(this._angle) * residualSpeed * dt;

      // Check transition: destruction sequence completed -> INACTIVE
      if (this._destroyingRemaining <= 0) {
        this._destroyingRemaining = 0;
        this._state = 'INACTIVE';
      }
    }
  }

  /**
   * Triggers collision impact: immediately enters DESTROYING state.
   */
  public impact(position?: { x: number; y: number }, beforeExpiry = false): void {
    if (this.canCollide || (beforeExpiry && this.isDestroying)) {
      if (position) { this._x = position.x; this._y = position.y; }
      this._state = 'DESTROYING';
      this._destroyingRemaining = this._config.destroyingDuration;
    }
  }

  public get destructionDuration(): number { return this._config.destroyingDuration; }

  /**
   * Retires the missile directly (e.g. when completely off-screen beyond max distance).
   */
  public retire(): void {
    this._state = 'INACTIVE';
    this._fuelRemaining = 0;
    this._ballisticRemaining = 0;
    this._destroyingRemaining = 0;
  }

  /**
   * Resets and reactivates the missile at a new spawn location.
   */
  public reset(
    x: number,
    y: number,
    angle: number,
    config: Partial<MissileConfig> = {}
  ): void {
    this._x = x;
    this._y = y;
    this._angle = normalizeAngle(angle);

    if (config.speed !== undefined) this._speed = config.speed;
    if (config.maxAngularVelocity !== undefined) this._maxAngularVelocity = config.maxAngularVelocity;
    if (config.collisionRadius !== undefined) this._collisionRadius = config.collisionRadius;
    if (config.fuelDuration !== undefined) {
      this._config.fuelDuration = config.fuelDuration;
    }
    if (config.ballisticDuration !== undefined) {
      this._config.ballisticDuration = config.ballisticDuration;
    }
    if (config.destroyingDuration !== undefined) {
      this._config.destroyingDuration = config.destroyingDuration;
    }

    const fuel = config.fuelDuration ?? config.lifetime ?? this._config.fuelDuration;
    this._fuelRemaining = fuel;
    this._ballisticRemaining = this._config.ballisticDuration;
    this._destroyingRemaining = this._config.destroyingDuration;
    this._state = 'HOMING';
  }
}
