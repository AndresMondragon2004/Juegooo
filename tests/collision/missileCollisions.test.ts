import { describe, it, expect, vi } from 'vitest';
import { resolveMissileContacts, sweepCircles, CollisionMissile } from '../../src/core/collision/collisionDetector';
import { MissileModel } from '../../src/core/missile/MissileModel';
import { DEFAULT_MISSILE_CONFIG as config } from '../../src/config/missileConfig';
const plane = { x: 5000, y: 5000, previousX: 5000, previousY: 5000, radius: 14 };
const m = (id: string, x: number, y: number, endX = x, endY = y, radius = 10): CollisionMissile =>
  ({ id, previousX: x, previousY: y, x: endX, y: endY, radius, canCollide: true });

describe('continuous missile collisions', () => {
  it('detects frontal tunneling at first contact', () => {
    const events = resolveMissileContacts([m('a', -30, 0, 30), m('b', 30, 0, -30)], plane);
    expect(events).toHaveLength(1);
    expect(events[0].fraction).toBeCloseTo(1 / 3);
    expect(events[0].x).toBeCloseTo(0);
  });
  it('detects lateral contact', () => expect(sweepCircles(m('a', -30, 0, 30), m('b', 0, -30, 0, 30))).not.toBeNull());
  it('uses different radii and inclusive tangency', () => {
    expect(sweepCircles(m('a', 0, 0, 0, 0, 3), m('b', 10, 0, 10, 0, 7))).toBe(0);
    expect(sweepCircles(m('a', 0, 0, 0, 0, 3), m('b', 10.01, 0, 10.01, 0, 7))).toBeNull();
  });
  it('rejects separated parallel trajectories', () => expect(sweepCircles(m('a', 0, 0, 100), m('b', 0, 21, 100, 21))).toBeNull());
  it('rejects paths crossing at different times', () => expect(sweepCircles(m('a', -100, 0, 100, 0, 1), m('b', 0, -20, 0, 180, 1))).toBeNull());
  it.each(['HOMING', 'BALLISTIC', 'DESTROYING', 'INACTIVE'] as const)('respects %s lifecycle', state => {
    const model = new MissileModel('a', 0, 0, 0, { ...config, speed: 0, fuelDuration: 0.01 });
    if (state === 'BALLISTIC') model.update(0.01, plane);
    if (state === 'DESTROYING') model.impact();
    if (state === 'INACTIVE') model.retire();
    expect(resolveMissileContacts([{ ...m('a', 0, 0), canCollide: model.canCollide }, m('b', 0, 0)], plane)).toHaveLength(model.canCollide ? 1 : 0);
  });
  it('resolves triple ties independently of array order', () => {
    for (const ids of [['c','a','b'], ['b','c','a'], ['a','b','c']]) {
      expect(resolveMissileContacts(ids.map(id => m(id, 0, 0)), plane).map(e => e.ids)).toEqual([['a','b']]);
    }
  });
  it('prioritizes mutual contact over airplane in exact ties', () => {
    expect(resolveMissileContacts([m('a', 0, 0), m('b', 0, 0)], { ...plane, x: 0, y: 0, previousX: 0, previousY: 0 }).map(e => e.type)).toEqual(['mutual']);
  });
  it('prioritizes earlier airplane contact', () => {
    const events = resolveMissileContacts([m('a', 0, 0, 100), m('b', 100, 0)], { ...plane, previousX: 0, previousY: 0, x: 0, y: 0 });
    expect(events.map(e => e.type)).toEqual(['airplane']);
  });
  it('excludes contacts after ballistic expiry', () => {
    expect(resolveMissileContacts([{ ...m('a', -100, 0, 100), collidableUntil: 0.1 }, m('b', 0, 0)], plane)).toEqual([]);
  });
  it.each([1/120, 1/60, 1/30, 0.1])('detects same first contact with dt=%s', dt => {
    let time = 0;
    let contactTime = -1;
    while (time < 1) {
      const events = resolveMissileContacts([m('a', -100 + 200*time, 0, -100 + 200*(time+dt)), m('b', 100-200*time, 0, 100-200*(time+dt))], plane);
      if (events.length) { contactTime = time + events[0].fraction * dt; break; }
      time += dt;
    }
    expect(contactTime).toBeCloseTo(0.45, 8);
  });
  it('reset permits a new destruction cycle without residual state', () => {
    const model = new MissileModel(); model.impact(); model.update(1, plane); model.reset(100, 200, 0);
    expect(model.canCollide).toBe(true); expect(model.destroyingRemaining).toBe(config.destroyingDuration);
    model.impact(); expect(model.isDestroying).toBe(true);
  });
});

vi.mock('../../src/rendering/MissileRenderer', () => ({ MissileRenderer: class {
  update = vi.fn(); destroy = vi.fn(); triggerImpact = vi.fn(); triggerMutualImpact = vi.fn();
} }));
import { MissileManager } from '../../src/core/missile/MissileManager';
import type Phaser from 'phaser';
describe('real MissileManager integration', () => {
  it('destroys both once, renders explosion, frees resources, spawns unique replacements and retains progression', () => {
    const emit = vi.fn();
    const manager = new MissileManager({ events: { emit } } as unknown as Phaser.Scene, { ...config, speed: 0 });
    const vp = { left: -640, right: 640, top: -360, bottom: 360 };
    manager.update(20, { x: 0, y: 0 }, vp);
    manager.update(2, { x: 0, y: 0 }, vp);
    expect(manager.activeEntries).toHaveLength(2);
    const entries = manager.activeEntries;
    entries.forEach(e => e.model.reset(100, 100, 0));
    manager.update(0.016, { x: 0, y: 0 }, vp);
    expect(entries.every(e => e.model.isDestroying && !e.model.canCollide)).toBe(true);
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit.mock.calls[0][0]).toBe('missilesCollided');
    expect(emit.mock.calls[0][1]).toMatchObject({ missileIds: ['missile-1','missile-2'], x: 100, y: 100, type: 'mutual' });
    expect(entries[0].renderer.triggerMutualImpact).toHaveBeenCalledTimes(1);
    manager.update(0.1, { x: 0, y: 0 }, vp);
    expect(emit).toHaveBeenCalledTimes(1);
    expect(entries[0].renderer.destroy).not.toHaveBeenCalled();
    manager.update(0.5, { x: 0, y: 0 }, vp);
    manager.update(0.016, { x: 0, y: 0 }, vp);
    expect(manager.activeEntries).toHaveLength(0);
    entries.forEach(e => expect(e.renderer.destroy).toHaveBeenCalledTimes(1));
    manager.update(2, { x: 0, y: 0 }, vp);
    expect(manager.activeEntries[0].model.id).toBe('missile-3');
    expect(manager.activeEntries[0].model.canCollide).toBe(true);
    manager.destroy(); expect(manager.activeEntries).toHaveLength(0);
  });
});
