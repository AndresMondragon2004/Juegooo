import Phaser from 'phaser';
import { DEFAULT_AIRPLANE_CONFIG } from '../config/airplaneConfig';
import { DEFAULT_MISSILE_CONFIG } from '../config/missileConfig';
import { AirplaneModel } from '../core/airplane/AirplaneModel';
import { checkCircleCollision, ImpactTracker } from '../core/collision/collisionDetector';
import { MissileModel } from '../core/missile/MissileModel';
import { calculateMissileSpawn, isMissileEligibleForRetirement } from '../core/missile/MissileSpawner';
import { UnifiedInputManager } from '../input/UnifiedInputManager';
import { AirplaneRenderer } from '../rendering/AirplaneRenderer';
import { CameraController } from '../rendering/CameraController';
import { InfiniteBackground } from '../rendering/InfiniteBackground';
import { MissileRenderer } from '../rendering/MissileRenderer';

export class GameScene extends Phaser.Scene {
  private airplaneModel!: AirplaneModel;
  private airplaneRenderer!: AirplaneRenderer;
  private cameraController!: CameraController;
  private background!: InfiniteBackground;
  private inputManager!: UnifiedInputManager;

  // Missile pursuit and lifecycle systems
  private missileModel!: MissileModel;
  private missileRenderer!: MissileRenderer;
  private impactTracker!: ImpactTracker;
  private missileSpawnCooldownTimer: number = 1.8; // Initial brief delay before first missile
  private previousMissileState: string = 'INACTIVE';

  constructor() {
    super({ key: 'GameScene' });
  }

  public create(): void {
    // 1. Initialize airplane model facing upwards (-90 deg / -PI/2)
    const startX = 0;
    const startY = 0;
    const initialHeading = -Math.PI / 2;
    this.airplaneModel = new AirplaneModel(startX, startY, initialHeading, DEFAULT_AIRPLANE_CONFIG);

    // 2. Initialize rendering systems
    this.background = new InfiniteBackground(this);
    this.airplaneRenderer = new AirplaneRenderer(this);

    // 3. Initialize camera controller
    this.cameraController = new CameraController(
      this.cameras.main,
      startX,
      startY,
      DEFAULT_AIRPLANE_CONFIG
    );

    // 4. Initialize input system (keyboard + touch drag)
    this.inputManager = new UnifiedInputManager(this, DEFAULT_AIRPLANE_CONFIG.touchDeadzone);

    // 5. Initialize missile and collision tracking
    this.impactTracker = new ImpactTracker();
    this.missileModel = new MissileModel('missile-1', -9999, -9999, 0, DEFAULT_MISSILE_CONFIG);
    this.missileModel.retire(); // Starts inactive until cooldown expires
    this.previousMissileState = this.missileModel.state;
    this.missileRenderer = new MissileRenderer(this);

    // Handle clean resize and teardown
    this.scale.on('resize', this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanUp, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanUp, this);
  }

  private onResize(gameSize: Phaser.Structs.Size): void {
    this.cameras.main.setSize(gameSize.width, gameSize.height);
  }

  public override update(_time: number, delta: number): void {
    // Safeguard against browser tab switching or hitch spikes
    const dt = Math.min(delta / 1000, 0.1);
    if (dt <= 0) return;

    const planePos = { x: this.airplaneModel.x, y: this.airplaneModel.y };

    // 1. Poll input intent
    const command = this.inputManager.getCommand(planePos);

    // 2. Step airplane simulation
    this.airplaneModel.update(dt, command);

    // 3. Update camera smooth tracking and safe zone
    const planeState = this.airplaneModel.getState();
    this.cameraController.update(planeState, dt);

    // 4. Update infinite background references around camera view
    this.background.update(dt, planeState.angle, planeState.speed);

    // 5. Update airplane visual presentation & touch indicator
    const targetPos = this.inputManager.getTouchManager().getTargetWorldPosition();
    this.airplaneRenderer.update(planeState, dt, targetPos);

    // 6. Manage missile lifecycle, pursuit, and collision
    this.updateMissile(dt, planePos);
  }

  private updateMissile(dt: number, planePos: { x: number; y: number }): void {
    const camera = this.cameras.main;
    const viewportBounds = {
      left: camera.worldView.x,
      right: camera.worldView.right,
      top: camera.worldView.y,
      bottom: camera.worldView.bottom
    };

    if (this.missileModel.isActive) {
      const stateBefore = this.missileModel.state;

      // 1. Step missile kinematics and lifecycle state machine
      this.missileModel.update(dt, planePos);

      // Detect transition to DESTROYING from burnout (not impact)
      if (stateBefore === 'BALLISTIC' && this.missileModel.isDestroying) {
        this.missileRenderer.triggerBurnout(this.missileModel.x, this.missileModel.y);
      }

      const missilePos = { x: this.missileModel.x, y: this.missileModel.y };

      // 2. Check collision against airplane (only when in HOMING or BALLISTIC)
      if (this.missileModel.canCollide) {
        const isColliding = checkCircleCollision(
          planePos,
          DEFAULT_MISSILE_CONFIG.airplaneCollisionRadius,
          missilePos,
          this.missileModel.collisionRadius
        );

        if (isColliding) {
          // Register single impact event
          if (this.impactTracker.registerImpact(this.missileModel.id)) {
            this.missileRenderer.triggerImpact(missilePos.x, missilePos.y);
            this.missileModel.impact(); // Enters DESTROYING state
          }
        }
      }

      // 3. Safe distance retirement:
      // Strictly guaranteed to NEVER retire while visible on screen
      if (
        isMissileEligibleForRetirement(
          missilePos,
          planePos,
          viewportBounds,
          DEFAULT_MISSILE_CONFIG.maxRetireDistance,
          DEFAULT_MISSILE_CONFIG.retireScreenMargin
        )
      ) {
        this.missileModel.retire();
      }

      // Check if missile just transitioned to INACTIVE to arm respawn cooldown
      if (this.missileModel.isInactive && this.previousMissileState !== 'INACTIVE') {
        this.missileSpawnCooldownTimer = DEFAULT_MISSILE_CONFIG.spawnCooldown;
      }
    } else {
      // Missile inactive: advance respawn cooldown timer
      this.missileSpawnCooldownTimer -= dt;
      if (this.missileSpawnCooldownTimer <= 0) {
        this.spawnNewMissile(planePos, viewportBounds);
      }
    }

    this.previousMissileState = this.missileModel.state;

    // Update missile visual representation
    this.missileRenderer.update(this.missileModel, dt);
  }

  private spawnNewMissile(
    planePos: { x: number; y: number },
    viewportBounds: { left: number; right: number; top: number; bottom: number }
  ): void {
    const spawn = calculateMissileSpawn(
      viewportBounds,
      planePos,
      DEFAULT_MISSILE_CONFIG.spawnMargin
    );

    this.missileModel.reset(spawn.x, spawn.y, spawn.angle);
    this.impactTracker.clear(this.missileModel.id);
  }

  private cleanUp(): void {
    this.inputManager?.destroy();
    this.airplaneRenderer?.destroy();
    this.background?.destroy();
    this.missileRenderer?.destroy();
  }
}
