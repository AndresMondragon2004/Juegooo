// @vitest-environment jsdom
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import EventEmitter from 'eventemitter3';
import type { AirplaneModel } from '../../src/core/airplane/AirplaneModel';
import type { MissileManager } from '../../src/core/missile/MissileManager';
import type { RoundController } from '../../src/core/game/RoundController';

vi.mock('phaser', () => ({ default: {
  Scene: class {
    events = new EventEmitter();
    scale = new EventEmitter();
    game = { canvas: document.createElement('canvas') };
    input = Object.assign(new EventEmitter(), {
      enabled: false,
      keyboard: {
        keys: new Map<number, { keyCode: number; isDown: boolean }>(),
        addKey(code: number) {
          if (!this.keys.has(code)) this.keys.set(code, { keyCode: code, isDown: false });
          return this.keys.get(code);
        },
        removeKey(key: { keyCode: number }) { this.keys.delete(key.keyCode); },
      },
    });
    cameras = { main: {
      width: 390, height: 844, centerOn: vi.fn(), setSize: vi.fn(),
      worldView: { x: -195, y: -422, right: 195, bottom: 422 },
      getWorldPoint: (x: number, y: number) => ({ x, y }),
    } };
    scene = { restart: vi.fn() };
  },
  Scenes: { Events: { SHUTDOWN: 'shutdown', DESTROY: 'destroy' } },
  Input: { Keyboard: { KeyCodes: { A: 65, D: 68, LEFT: 37, RIGHT: 39 } } },
} }));
vi.mock('../../src/rendering/AirplaneRenderer', () => ({ AirplaneRenderer: class {
  update = vi.fn(); destroy = vi.fn(); hide = vi.fn();
} }));
vi.mock('../../src/rendering/AirplaneExplosion', () => ({ AirplaneExplosion: class {
  update = vi.fn(); destroy = vi.fn();
} }));
vi.mock('../../src/rendering/InfiniteBackground', () => ({ InfiniteBackground: class {
  update = vi.fn(); destroy = vi.fn();
} }));
vi.mock('../../src/rendering/MissileRenderer', () => ({ MissileRenderer: class {
  update = vi.fn(); updateEffects = vi.fn(); destroy = vi.fn(); triggerImpact = vi.fn(); triggerMutualImpact = vi.fn();
} }));
import { GameScene } from '../../src/scenes/GameScene';
interface Internals {
  round: RoundController;
  missileManager: MissileManager;
  airplaneModel: AirplaneModel;
  explosion?: { destroy: ReturnType<typeof vi.fn> };
}
const internals = (scene: GameScene) => scene as unknown as Internals;
const primary = () => document.querySelector<HTMLButtonElement>('.primary-button')!;
const visible = (selector: string) => !document.querySelector<HTMLElement>(selector)!.hidden;
const tick = (scene: GameScene, n = 1, delta = 100) => { for (let i = 0; i < n; i++) scene.update(0, delta); };
const start = (scene: GameScene) => { primary().click(); tick(scene); };
const fatalMissile = (scene: GameScene) => {
  const { missileManager, airplaneModel } = internals(scene);
  const entry = missileManager.activeEntries[0];
  entry.model.reset(airplaneModel.x, airplaneModel.y, 0, { speed: 0 });
  return entry;
};
let scene: GameScene;
beforeEach(() => {
  document.body.innerHTML = '<div id="game-container"></div>';
  localStorage.clear();
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  scene = new GameScene(); scene.create();
});
afterEach(() => { scene.events.emit('shutdown'); vi.restoreAllMocks(); });

describe('scene round lifecycle with real simulation and DOM UI', () => {
  it('MENU never moves, spawns or scores and start activates controls', () => {
    tick(scene, 100);
    expect(internals(scene).round.state).toBe('MENU');
    expect(internals(scene).airplaneModel.y).toBe(0);
    expect(internals(scene).missileManager.activeEntries).toHaveLength(0);
    expect(internals(scene).round.stats.time).toBe(0);
    expect(visible('.round-overlay')).toBe(true);
    start(scene); tick(scene);
    expect(internals(scene).round.state).toBe('PLAYING');
    expect(internals(scene).airplaneModel.y).toBeCloseTo(-25);
    expect(visible('.flight-hud')).toBe(true); expect(visible('.round-overlay')).toBe(false);
  });
  it('pauses with the HUD, freezes model, difficulty and score, resumes without a jump', () => {
    start(scene); tick(scene, 25);
    const { airplaneModel, missileManager, round } = internals(scene);
    document.querySelector<HTMLButtonElement>('.pause-button')!.click();
    const plane = airplaneModel.getState(); const stats = round.stats;
    const missiles = missileManager.activeEntries.map(e => ({ x: e.model.x, y: e.model.y, fuel: e.model.fuelRemaining }));
    tick(scene, 60, 10000);
    expect(airplaneModel.getState()).toEqual(plane); expect(round.stats).toEqual(stats);
    expect(missileManager.activeEntries.map(e => ({ x: e.model.x, y: e.model.y, fuel: e.model.fuelRemaining }))).toEqual(missiles);
    primary().click(); tick(scene, 1, 10000);
    expect(airplaneModel.getState()).toEqual(plane);
    tick(scene); expect(round.stats.time).toBeCloseTo(stats.time + 0.1);
  });
  it.each(['p','Escape'])('toggles pause with %s and ignores key repetition', key => {
    start(scene); window.dispatchEvent(new KeyboardEvent('keydown', { key }));
    expect(internals(scene).round.state).toBe('PAUSED');
    window.dispatchEvent(new KeyboardEvent('keydown', { key, repeat: true }));
    expect(internals(scene).round.state).toBe('PAUSED');
    window.dispatchEvent(new KeyboardEvent('keydown', { key })); expect(internals(scene).round.state).toBe('PLAYING');
  });
  it('pauses when hidden, does not auto resume, and rejects hidden resume', () => {
    start(scene);
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange')); expect(internals(scene).round.state).toBe('PAUSED');
    primary().click(); expect(internals(scene).round.state).toBe('PAUSED');
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange')); expect(internals(scene).round.state).toBe('PAUSED');
    primary().click(); expect(internals(scene).round.state).toBe('PLAYING');
  });
  it('pauses on browser blur without automatically resuming', () => {
    start(scene); window.dispatchEvent(new Event('blur')); expect(internals(scene).round.state).toBe('PAUSED');
    window.dispatchEvent(new Event('focus')); expect(internals(scene).round.state).toBe('PAUSED');
  });
  it('real airplane contact ends round once, animates, shows frozen results and saves record', () => {
    start(scene); tick(scene, 21); fatalMissile(scene);
    const hit = vi.fn(); scene.events.on('airplaneHit', hit);
    tick(scene);
    const { round, missileManager } = internals(scene);
    expect(round.state).toBe('GAME_OVER'); expect(hit).toHaveBeenCalledTimes(1);
    expect(round.stats.time).toBeCloseTo(2.1);
    expect(round.stats.score).toBe(21); expect(round.stats.collisions).toBe(0);
    expect(visible('.round-overlay')).toBe(false);
    const explosion = internals(scene).explosion!;
    const stats = round.stats; const missileCount = missileManager.activeEntries.length;
    tick(scene, 15);
    expect(round.stats).toEqual(stats); expect(missileManager.activeEntries).toHaveLength(missileCount);
    expect(visible('.round-overlay')).toBe(true); expect(primary().textContent).toBe('Volver a jugar');
    expect(document.querySelector('[data-value="score"]')!.textContent).toBe('21');
    expect(document.querySelector('[data-value="time"]')!.textContent).toBe('00:02');
    expect(visible('.record-badge')).toBe(true); expect(explosion.destroy).toHaveBeenCalledTimes(1);
    expect(internals(scene).explosion).toBeUndefined();
  });
  it('restarts five times with clean models, timers, UI, controls and one listener per event', () => {
    const oldModels = [];
    for (let i = 0; i < 5; i++) {
      if (i === 0) start(scene); else tick(scene);
      tick(scene, 21); const missile = fatalMissile(scene); oldModels.push(missile.model);
      tick(scene); tick(scene, 10);
      primary().click(); expect(scene.scene.restart).toHaveBeenCalledWith({ autoStart: true });
      // Phaser dispatches shutdown and then calls create on the same scene instance.
      scene.events.emit('shutdown');
      expect(missile.renderer.destroy).toHaveBeenCalledTimes(1);
      expect(internals(scene).missileManager.activeEntries).toHaveLength(0);
      scene.create({ autoStart: true });
      expect(document.querySelectorAll('.game-ui')).toHaveLength(1);
      expect(scene.events.listenerCount('airplaneHit')).toBe(1);
      expect(scene.events.listenerCount('missilesCollided')).toBe(1);
      expect(scene.events.listenerCount('destroy')).toBe(1);
      expect(scene.scale.listenerCount('resize')).toBe(1);
      expect(internals(scene).round.stats).toMatchObject({ time: 0, score: 0, collisions: 0, best: 21 });
      expect(internals(scene).airplaneModel.getState()).toMatchObject({ x: 0, y: 0, angle: -Math.PI/2 });
      expect(internals(scene).missileManager.activeEntries).toHaveLength(0);
      tick(scene); tick(scene, 19);
      expect(internals(scene).missileManager.activeEntries).toHaveLength(0);
      // Reset for the next round without changing the verified state above.
      scene.events.emit('shutdown'); scene.create({ autoStart: true });
    }
    expect(new Set(oldModels).size).toBe(5);
  });
  it('recreates fresh keyboard keys and clears touch gesture across repeated pause cycles', () => {
    start(scene);
    const input = scene.input as unknown as EventEmitter & { keyboard: { keys: Map<number, { isDown: boolean }> } };
    for (let i = 0; i < 5; i++) {
      const oldKey = input.keyboard.keys.get(65)!; oldKey.isDown = true;
      input.emit('pointerdown', { primaryDown: true, x: 10, y: 20 });
      document.querySelector<HTMLButtonElement>('.pause-button')!.click();
      expect(input.keyboard.keys.size).toBe(0); expect(input.listenerCount('pointerdown')).toBe(0);
      primary().click();
      expect(input.keyboard.keys.size).toBe(4); expect(input.keyboard.keys.get(65)).not.toBe(oldKey);
      expect(input.keyboard.keys.get(65)!.isDown).toBe(false); expect(input.listenerCount('pointerdown')).toBe(1);
    }
  });
  it('UI interactions do not bubble as flight input', () => {
    const handler = vi.fn(); document.addEventListener('pointerdown', handler);
    primary().dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(handler).not.toHaveBeenCalled(); document.removeEventListener('pointerdown', handler);
  });
  it.each([[390,844],[844,390],[1280,720]])('retains all results and accessible controls at %sx%s (DOM only)', (width,height) => {
    Object.defineProperty(window,'innerWidth',{ configurable:true,value:width });
    Object.defineProperty(window,'innerHeight',{ configurable:true,value:height });
    scene.scale.emit('resize', { width,height }); start(scene); tick(scene,21); fatalMissile(scene); tick(scene,12);
    expect(visible('.round-overlay')).toBe(true);
    expect(document.querySelectorAll('.round-stats dd')).toHaveLength(4);
    expect(primary().textContent).toBe('Volver a jugar');
    expect(document.querySelector('[aria-label="Pausar partida"]')).not.toBeNull();
    // jsdom verifies content/lifecycle, not pixel layout or media-query rendering.
  });
  it('shutdown is idempotent and removes DOM and global listener effects', () => {
    start(scene); const controller = internals(scene).round;
    scene.events.emit('shutdown'); scene.events.emit('destroy');
    window.dispatchEvent(new KeyboardEvent('keydown',{key:'p'}));
    expect(controller.state).toBe('PLAYING');
    expect(document.querySelector('.game-ui')).toBeNull(); expect(scene.events.listenerCount('airplaneHit')).toBe(0);
    expect(scene.scale.listenerCount('resize')).toBe(0);
  });
});

