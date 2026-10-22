// src/core/missile/MissileManager.ts
import type Phaser from 'phaser';
import { resolveMissileContacts, CollisionContact } from '../collision/collisionDetector';
import { MissileModel } from './MissileModel';
import { MissileRenderer } from '../../rendering/MissileRenderer';
import {
  calculateSmartMissileSpawn,
  isMissileEligibleForRetirement,
  CameraViewportBounds
} from './MissileSpawner';
import { DEFAULT_MISSILE_CONFIG, MISSILE_PROGRESSION, MissileConfig } from '../../config/missileConfig';

/** A single active missile entry: model + renderer paired together. */
interface MissileEntry {
  model: MissileModel;
  renderer: MissileRenderer;
  /** Set when the missile has completed its DESTROYING sequence and renderer has been cleaned up. */
  retired: boolean;
}

/**
 * Manages a pool of simultaneously active missiles.
 *
 * Responsibilities:
 * - Spawn missiles outside the visible viewport at safe distances.
 * - Enforce concurrent missile cap via MISSILE_PROGRESSION.
 * - Retire missiles that have gone inactive or are too far off-screen.
 * - Detect missiles that are no longer an effective threat (e.g. fuel spent
 *   far outside screen) and retire them early so the slot can be reused.
 * - Guarantee no long gaps in threat presence due to saturated-but-ineffective slots.
 */
export interface MissilesCollidedEvent {
  missileIds: [string, string];
  x: number;
  y: number;
  simulationTime: number;
  type: 'mutual';
}

export interface AirplaneHitEvent {
  missileId: string;
  x: number;
  y: number;
  planeX: number;
  planeY: number;
  simulationTime: number;
  fraction: number;
  type: 'airplane';
}

export class MissileManager {
  private stopped = false;
  private scene: Phaser.Scene;
  private entries: MissileEntry[] = [];
  private spawnCooldownTimer: number;
  private elapsedTime: number = 0;
  private nextId: number = 1;
  private config: MissileConfig;

  constructor(scene: Phaser.Scene, config: MissileConfig = DEFAULT_MISSILE_CONFIG) {
    this.scene = scene;
    this.config = config;
    // Brief initial cooldown before the very first missile appears
    this.spawnCooldownTimer = config.spawnCooldown;
  }

  // ──────────────────────────────────────────────────
  // Public API for GameScene
  // ──────────────────────────────────────────────────

  /**
   * Call once per frame from GameScene.update().
   * Returns the list of active entries for external collision handling.
   */
  public update(
    dt: number,
    playerPos: { x: number; y: number },
    viewport: CameraViewportBounds,
    previousPlayerPos = playerPos
  ): void {
    if (dt <= 0 || this.stopped) return;
    this.elapsedTime += dt;

    // 1. Retire missiles that have completed their lifecycle or are ineffective
    this._retireIneligibleMissiles(playerPos, viewport);

    // 2. Determine how many slots are currently occupied
    const maxMissiles = this._getCurrentMaxMissiles();
    const activeCount = this.entries.length;

    // 3. Advance spawn timer and spawn if below the cap
    if (activeCount < maxMissiles) {
      this.spawnCooldownTimer -= dt;
      if (this.spawnCooldownTimer <= 0) {
        this._spawnMissile(viewport, playerPos);
        this.spawnCooldownTimer = this.config.spawnCooldown;
      }
    } else {
      // If at cap, don't let the timer run negative (would cause immediate spawn on free slot)
      this.spawnCooldownTimer = Math.max(this.spawnCooldownTimer, 0);
    }

    // Snapshot the same time interval for all participants before simulation.
    const snapshots = this.entries.map(({ model }) => ({
      id: model.id, previousX: model.x, previousY: model.y,
      x: model.x, y: model.y, radius: model.collisionRadius,
      canCollide: model.canCollide,
      collidableUntil: model.isBallistic ? Math.min(1, model.ballisticRemaining / dt) : 1,
    }));
    for (let i = 0; i < this.entries.length; i++) {
      const model = this.entries[i].model;
      model.update(dt, playerPos);
      snapshots[i].x = model.x;
      snapshots[i].y = model.y;
      // A ballistic missile expiring during this step only collides before expiry.
    }
    const contacts = resolveMissileContacts(snapshots, {
      ...playerPos, previousX: previousPlayerPos.x, previousY: previousPlayerPos.y,
      radius: this.config.airplaneCollisionRadius,
    });
    for (const contact of contacts) {
      this.resolveContact(contact, dt);
      if (contact.type === 'airplane') {
        const event: AirplaneHitEvent = {
          missileId: contact.ids[0], x: contact.x, y: contact.y,
          planeX: previousPlayerPos.x + (playerPos.x - previousPlayerPos.x) * contact.fraction,
          planeY: previousPlayerPos.y + (playerPos.y - previousPlayerPos.y) * contact.fraction,
          simulationTime: this.elapsedTime - dt + contact.fraction * dt,
          fraction: contact.fraction, type: 'airplane',
        };
        this.stopped = true;
        this.elapsedTime = event.simulationTime;
        this.scene.events.emit('airplaneHit', event);
        break; // No rewards or impacts after the fatal contact, including later ties.
      }
    }
    for (const entry of this.entries) entry.renderer.update(entry.model, dt);
  }

  private resolveContact(contact: CollisionContact, dt: number): void {
    const entries = contact.ids.map(id => this.entries.find(e => e.model.id === id)!);
    for (const entry of entries) entry.model.impact(contact, true);
    if (contact.type === 'mutual') {
      entries[0].renderer.triggerMutualImpact(contact.x, contact.y, this.config.destroyingDuration);
      const event: MissilesCollidedEvent = {
        missileIds: [contact.ids[0], contact.ids[1]], x: contact.x, y: contact.y,
        simulationTime: this.elapsedTime - dt + contact.fraction * dt, type: 'mutual',
      };
      this.scene.events.emit('missilesCollided', event);
    } else {
      entries[0].renderer.triggerImpact(contact.x, contact.y);
    }
  }

  public get simulationTime(): number { return this.elapsedTime; }

  /** Only cosmetics advance after death; no motion, spawning or collisions. */
  public updateEffects(dt: number): void {
    for (const entry of this.entries) entry.renderer.updateEffects(dt);
  }

  /** Live entries iterator for collision detection in GameScene. */
  public get activeEntries(): { model: MissileModel; renderer: MissileRenderer }[] {
    return this.entries.map(e => ({ model: e.model, renderer: e.renderer }));
  }

  /** Destroy all managed resources (called on scene shutdown). */
  public destroy(): void {
    for (const entry of this.entries) {
      entry.renderer.destroy();
    }
    this.entries = [];
  }

  // ──────────────────────────────────────────────────
  // Internal helpers
  // ──────────────────────────────────────────────────

  private _getCurrentMaxMissiles(): number {
    let max = 1;
    for (const stage of MISSILE_PROGRESSION) {
      if (this.elapsedTime >= stage.time) {
        max = stage.maxMissiles;
      } else {
        break;
      }
    }
    return max;
  }

  private _spawnMissile(viewport: CameraViewportBounds, playerPos: { x: number; y: number }): void {
    const spawn = calculateSmartMissileSpawn(viewport, playerPos, {
      margin: 80,
      angleJitter: 0.12,
      missileSpeed: this.config.speed,
      fuelDuration: this.config.fuelDuration,
      maxApproachFuelFraction: 0.55,
      minDistanceFromPlayer: 180,
      maxAttempts: 14,
    });

    const id = `missile-${this.nextId++}`;
    const model = new MissileModel(id, spawn.x, spawn.y, spawn.angle, this.config);
    const renderer = new MissileRenderer(this.scene);
    this.entries.push({ model, renderer, retired: false });
  }

  private _retireIneligibleMissiles(
    playerPos: { x: number; y: number },
    viewport: CameraViewportBounds
  ): void {
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const entry = this.entries[i];
      const missile = entry.model;

      // A. Natural lifecycle completion: INACTIVE
      if (missile.isInactive) {
        entry.renderer.destroy();
        this.entries.splice(i, 1);
        // Reset spawn timer so the next missile doesn't appear immediately
        this.spawnCooldownTimer = Math.max(this.spawnCooldownTimer, this.config.spawnCooldown);
        continue;
      }

      if (missile.isDestroying) continue;

      // B. Off-screen distance retirement (never while visible)
      if (
        isMissileEligibleForRetirement(
          { x: missile.x, y: missile.y },
          playerPos,
          viewport,
          this.config.maxRetireDistance,
          this.config.retireScreenMargin
        )
      ) {
        missile.retire();
        entry.renderer.destroy();
        this.entries.splice(i, 1);
        this.spawnCooldownTimer = Math.max(this.spawnCooldownTimer, this.config.spawnCooldown * 0.5);
        continue;
      }

      // C. Ineffective threat retirement:
      // If the missile is in HOMING state but has already spent >80% of fuel AND
      // is still completely outside the viewport, it will never be a real threat.
      // We retire it silently (off-screen → no visible pop).
      if (
        missile.isHoming &&
        missile.fuelRemaining < this.config.fuelDuration * 0.2 &&
        !this._isInOrNearViewport(missile.x, missile.y, viewport, 60)
      ) {
        missile.retire();
        entry.renderer.destroy();
        this.entries.splice(i, 1);
        // Slightly shorter cooldown — the slot was wasted, give player a new threat soon
        this.spawnCooldownTimer = Math.max(this.spawnCooldownTimer, this.config.spawnCooldown * 0.4);
        continue;
      }
    }
  }

  /** Returns true if the position is inside or within `margin` px of the viewport. */
  private _isInOrNearViewport(
    x: number,
    y: number,
    viewport: CameraViewportBounds,
    margin: number
  ): boolean {
    return (
      x >= viewport.left - margin &&
      x <= viewport.right + margin &&
      y >= viewport.top - margin &&
      y <= viewport.bottom + margin
    );
  }
}
