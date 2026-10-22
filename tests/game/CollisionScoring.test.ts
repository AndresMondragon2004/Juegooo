import { describe, it, expect, vi } from 'vitest';
import EventEmitter from 'eventemitter3';
import type Phaser from 'phaser';
import { MissileManager, AirplaneHitEvent, MissilesCollidedEvent } from '../../src/core/missile/MissileManager';
import { DEFAULT_MISSILE_CONFIG } from '../../src/config/missileConfig';
import { RoundController } from '../../src/core/game/RoundController';
import { RecordStore } from '../../src/core/game/RecordStore';
vi.mock('../../src/rendering/MissileRenderer', () => ({ MissileRenderer: class {
  update = vi.fn(); updateEffects = vi.fn(); destroy = vi.fn(); triggerImpact = vi.fn(); triggerMutualImpact = vi.fn();
} }));
const plane = { x: 0, y: 0 };
const viewport = { left: -640, right: 640, top: -360, bottom: 360 };
function fixture() {
  const events = new EventEmitter();
  const manager = new MissileManager({ events } as unknown as Phaser.Scene, {
    ...DEFAULT_MISSILE_CONFIG, speed: 0, fuelDuration: 1000, ballisticDuration: 1000, spawnCooldown: 0.01,
  });
  manager.update(80, plane, viewport);
  for (let i = 0; i < 3; i++) manager.update(0.01, plane, viewport);
  expect(manager.activeEntries).toHaveLength(4);
  const round = new RoundController(new RecordStore(() => undefined)); round.start(); round.advanceTo(manager.simulationTime);
  const log: string[] = [];
  events.on('missilesCollided', (e: MissilesCollidedEvent) => { log.push('mutual'); round.missilesCollided(e); });
  events.on('airplaneHit', (e: AirplaneHitEvent) => { log.push('airplane'); round.finish(e.simulationTime); });
  manager.activeEntries.forEach((e, i) => e.model.reset(500 + i * 100, 500, 0, { speed: 0 }));
  return { manager, events, round, log };
}

describe('chronological scoring with real MissileManager', () => {
  it.each([false,true])('counts earlier mutual contact and finalizes at sub-frame hit (reverse=%s)', reverse => {
    const { manager, events, round, log } = fixture();
    const entries = manager.activeEntries;
    entries[0].model.reset(-30, 200, 0, { speed: 1000 });
    entries[1].model.reset(30, 200, Math.PI, { speed: 1000 });
    entries[2].model.reset(0, -50, Math.PI/2, { speed: 1000 });
    if (reverse) (manager as unknown as { entries: unknown[] }).entries.reverse();
    const before = manager.simulationTime;
    const hits: AirplaneHitEvent[] = []; events.on('airplaneHit', e => hits.push(e));
    manager.update(0.1, plane, viewport);
    expect(log).toEqual(['mutual','airplane']);
    expect(hits).toHaveLength(1); expect(hits[0].fraction).toBeCloseTo(0.26);
    expect(round.stats.time).toBeCloseTo(before+0.026);
    expect(round.stats).toMatchObject({ score: Math.floor((before+0.026)*10)+100, collisions: 1, destroyedMissiles: 2 });
    expect(manager.simulationTime).toBeCloseTo(round.stats.time);
    const frozen = round.stats;
    manager.update(10, plane, viewport); expect(log).toEqual(['mutual','airplane']); expect(round.stats).toEqual(frozen);
    manager.destroy();
  });
  it('does not resolve or reward mutual contact later than fatal hit', () => {
    const { manager, round, log } = fixture(); const entries = manager.activeEntries;
    entries[0].model.reset(-60, 200, 0, { speed: 1000 });
    entries[1].model.reset(60, 200, Math.PI, { speed: 1000 });
    entries[2].model.reset(0,-50,Math.PI/2,{speed:1000});
    manager.update(0.1,plane,viewport);
    expect(log).toEqual(['airplane']); expect(round.stats.collisions).toBe(0);
    expect(entries[0].model.canCollide).toBe(true); expect(entries[1].model.canCollide).toBe(true);
    manager.destroy();
  });
  it('awards independent mutual pair in exact tie before fatal airplane contact', () => {
    const { manager, round, log } = fixture(); const entries = manager.activeEntries;
    entries[0].model.reset(200,200,0,{speed:0}); entries[1].model.reset(200,200,0,{speed:0});
    entries[2].model.reset(0,0,0,{speed:0});
    manager.update(0.1,plane,viewport);
    expect(log).toEqual(['mutual','airplane']); expect(round.stats.collisions).toBe(1);
    manager.destroy();
  });
  it('same two missiles colliding beside plane consume one mutual pair without killing player', () => {
    const { manager, round, log } = fixture(); const entries = manager.activeEntries;
    entries[0].model.reset(0,0,0,{speed:0}); entries[1].model.reset(0,0,0,{speed:0});
    manager.update(0.1,plane,viewport);
    expect(log).toEqual(['mutual']); expect(round.state).toBe('PLAYING'); expect(round.stats.collisions).toBe(1);
    manager.destroy();
  });
  it('fuel expiry and retirement do not award points', () => {
    const { manager, round, log } = fixture();
    manager.activeEntries.forEach((e,i) => e.model.reset(200+i*100,100,0,
      {speed:0,fuelDuration:0.01,ballisticDuration:0.01,destroyingDuration:0.01}));
    for (let i = 0; i < 4; i++) { manager.update(0.01,plane,viewport); round.advanceTo(manager.simulationTime); }
    expect(log).toEqual([]); expect(round.stats.collisions).toBe(0);
    expect(round.stats.score).toBe(Math.floor(round.stats.time*10+1e-8));
    manager.destroy();
  });
});
