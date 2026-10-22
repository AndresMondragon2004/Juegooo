import Phaser from 'phaser';
import { DEFAULT_AIRPLANE_CONFIG } from '../config/airplaneConfig';
import { ROUND_CONFIG } from '../config/roundConfig';
import { AirplaneModel } from '../core/airplane/AirplaneModel';
import { RecordStore } from '../core/game/RecordStore';
import { RoundController } from '../core/game/RoundController';
import { UnifiedInputManager } from '../input/UnifiedInputManager';
import { AirplaneRenderer } from '../rendering/AirplaneRenderer';
import { AirplaneExplosion } from '../rendering/AirplaneExplosion';
import { CameraController } from '../rendering/CameraController';
import { InfiniteBackground } from '../rendering/InfiniteBackground';
import { MissileManager, AirplaneHitEvent, MissilesCollidedEvent } from '../core/missile/MissileManager';
import { GameUI } from '../ui/GameUI';

export class GameScene extends Phaser.Scene {
  private airplaneModel!: AirplaneModel;
  private airplaneRenderer!: AirplaneRenderer;
  private cameraController!: CameraController;
  private background!: InfiniteBackground;
  private inputManager?: UnifiedInputManager;
  private missileManager!: MissileManager;
  private readonly records = new RecordStore();
  private round!: RoundController;
  private ui!: GameUI;
  private explosion?: AirplaneExplosion;
  private deathElapsed = 0;
  private skipNextStep = true;
  private cleaned = true;

  constructor() { super({ key: 'GameScene' }); }

  public create(data: { autoStart?: boolean } = {}): void {
    this.cleaned = false;
    this.deathElapsed = 0;
    this.skipNextStep = true;
    this.explosion = undefined;
    this.round = new RoundController(this.records);
    this.airplaneModel = new AirplaneModel(0, 0, -Math.PI / 2, DEFAULT_AIRPLANE_CONFIG);
    this.background = new InfiniteBackground(this);
    this.airplaneRenderer = new AirplaneRenderer(this);
    this.cameraController = new CameraController(this.cameras.main, 0, 0, DEFAULT_AIRPLANE_CONFIG);
    this.airplaneRenderer.update(this.airplaneModel.getState(), 0, null);
    this.background.update(0, this.airplaneModel.angle, this.airplaneModel.speed);
    this.missileManager = new MissileManager(this);
    this.input.enabled = false;
    this.ui = new GameUI({
      start: () => this.startRound(), pause: () => this.pauseRound(),
      resume: () => this.resumeRound(), restart: () => {
        if (this.round.state === 'GAME_OVER') this.scene.restart({ autoStart: true });
      },
    });
    this.events.on('missilesCollided', this.onMissilesCollided, this);
    this.events.on('airplaneHit', this.onAirplaneHit, this);
    this.scale.on('resize', this.onResize, this);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('keydown', this.onPauseKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanUp, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanUp, this);
    if (data.autoStart) this.startRound();
    this.ui.render(this.round, false);
  }

  private activateControls(): void {
    this.input.enabled = true;
    this.inputManager = new UnifiedInputManager(this, DEFAULT_AIRPLANE_CONFIG.touchDeadzone);
    // Discard the UI/visibility transition frame; never catch up wall-clock time.
    this.skipNextStep = true;
  }
  private deactivateControls(): void {
    this.input.enabled = false;
    this.inputManager?.destroy();
    this.inputManager = undefined;
  }
  private startRound(): void {
    if (!document.hidden && this.round.start()) {
      this.activateControls(); this.ui.render(this.round, false);
    }
  }
  private pauseRound(): void {
    if (this.round.pause()) {
      this.deactivateControls(); this.ui.render(this.round, false);
    }
  }
  private resumeRound(): void {
    if (!document.hidden && this.round.resume()) {
      this.activateControls(); this.ui.render(this.round, false);
    }
  }
  private readonly onVisibility = (): void => {
    if (document.hidden) this.pauseRound();
  };
  private readonly onBlur = (): void => this.pauseRound();
  private readonly onPauseKey = (event: KeyboardEvent): void => {
    if (event.repeat || !['p', 'escape'].includes(event.key.toLowerCase())) return;
    if (this.round.state === 'PLAYING') { event.preventDefault(); this.pauseRound(); }
    else if (this.round.state === 'PAUSED') { event.preventDefault(); this.resumeRound(); }
  };
  private onMissilesCollided(event: MissilesCollidedEvent): void { this.round.missilesCollided(event); }
  private onAirplaneHit(event: AirplaneHitEvent): void {
    if (!this.round.finish(event.simulationTime)) return;
    this.deactivateControls();
    this.airplaneModel.setPosition(event.planeX, event.planeY);
    this.airplaneRenderer.hide();
    this.explosion = new AirplaneExplosion(this, event.planeX, event.planeY);
    this.deathElapsed = 0;
  }
  private onResize(gameSize: Phaser.Structs.Size): void {
    this.cameras.main.setSize(gameSize.width, gameSize.height);
    this.background.update(0, this.airplaneModel.angle, this.airplaneModel.speed);
  }

  public override update(_time: number, delta: number): void {
    const dt = Math.max(0, Math.min(delta / 1000, 0.1));
    if (dt <= 0 || this.cleaned) return;
    if (this.round.state === 'GAME_OVER') {
      this.deathElapsed += dt;
      this.explosion?.update(dt);
      if (this.deathElapsed >= ROUND_CONFIG.airplaneExplosionDuration && this.explosion) {
        this.explosion.destroy(); this.explosion = undefined;
      }
      this.missileManager.updateEffects(dt);
      this.ui.render(this.round, this.deathElapsed >= ROUND_CONFIG.resultsDelay);
      return;
    }
    if (this.round.state !== 'PLAYING') return;
    if (this.skipNextStep) { this.skipNextStep = false; return; }
    const planePos = { x: this.airplaneModel.x, y: this.airplaneModel.y };
    const command = this.inputManager!.getCommand(planePos);
    this.airplaneModel.update(dt, command);
    const planeState = this.airplaneModel.getState();
    this.cameraController.update(planeState, dt);
    this.background.update(dt, planeState.angle, planeState.speed);
    this.airplaneRenderer.update(planeState, dt, this.inputManager!.getTouchManager().getTargetWorldPosition());
    const view = this.cameras.main.worldView;
    this.missileManager.update(dt, { x: planeState.x, y: planeState.y }, {
      left: view.x, right: view.right, top: view.y, bottom: view.bottom,
    }, planePos);
    // Fatal contact advances/finalizes the controller at the exact swept timestamp.
    this.round.advanceTo(this.missileManager.simulationTime);
    this.ui.render(this.round, false);
  }

  private cleanUp(): void {
    if (this.cleaned) return;
    this.cleaned = true;
    this.events.off(Phaser.Scenes.Events.SHUTDOWN, this.cleanUp, this);
    this.events.off(Phaser.Scenes.Events.DESTROY, this.cleanUp, this);
    this.events.off('missilesCollided', this.onMissilesCollided, this);
    this.events.off('airplaneHit', this.onAirplaneHit, this);
    this.scale.off('resize', this.onResize, this);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('keydown', this.onPauseKey);
    this.deactivateControls();
    this.ui?.destroy(); this.explosion?.destroy(); this.explosion = undefined;
    this.airplaneRenderer?.destroy(); this.background?.destroy(); this.missileManager?.destroy();
  }
}
