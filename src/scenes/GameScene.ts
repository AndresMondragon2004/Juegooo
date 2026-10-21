import Phaser from 'phaser';
import { DEFAULT_AIRPLANE_CONFIG } from '../config/airplaneConfig';
import { AirplaneModel } from '../core/airplane/AirplaneModel';
import { UnifiedInputManager } from '../input/UnifiedInputManager';
import { AirplaneRenderer } from '../rendering/AirplaneRenderer';
import { CameraController } from '../rendering/CameraController';
import { InfiniteBackground } from '../rendering/InfiniteBackground';
import { MissileManager } from '../core/missile/MissileManager';


export class GameScene extends Phaser.Scene {
  private airplaneModel!: AirplaneModel;
  private airplaneRenderer!: AirplaneRenderer;
  private cameraController!: CameraController;
  private background!: InfiniteBackground;
  private inputManager!: UnifiedInputManager;

  // Missile management
  private missileManager!: MissileManager;

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
    this.missileManager = new MissileManager(this);

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

    // 6. Update missiles and handle collisions
    const viewport = {
      left: this.cameras.main.worldView.x,
      right: this.cameras.main.worldView.right,
      top: this.cameras.main.worldView.y,
      bottom: this.cameras.main.worldView.bottom,
    };
    this.missileManager.update(dt, { x: planeState.x, y: planeState.y }, viewport, planePos);
  }



  private cleanUp(): void {
    this.inputManager?.destroy();
    this.airplaneRenderer?.destroy();
    this.background?.destroy();
    this.missileManager?.destroy();
  }
}
