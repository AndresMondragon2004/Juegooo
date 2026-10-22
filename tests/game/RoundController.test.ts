import { describe, it, expect } from 'vitest';
import { RoundController } from '../../src/core/game/RoundController';
import { ScoreSystem, formatSurvivalTime } from '../../src/core/game/ScoreSystem';
import { RecordStore, RecordStorage } from '../../src/core/game/RecordStore';
import { ROUND_CONFIG } from '../../src/config/roundConfig';
import type { MissilesCollidedEvent } from '../../src/core/missile/MissileManager';
const collision = (time = 1, ids: [string, string] = ['a', 'b']): MissilesCollidedEvent =>
  ({ missileIds: ids, simulationTime: time, x: 0, y: 0, type: 'mutual' });
const store = () => {
  const data = new Map<string, string>();
  const storage: RecordStorage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); } };
  return { storage, data, records: new RecordStore(() => storage) };
};
const round = () => new RoundController(store().records);

describe('round state and scoring', () => {
  it('starts in MENU with frozen zero statistics', () => {
    const r = round(); r.advanceTo(50); r.missilesCollided(collision());
    expect(r.state).toBe('MENU'); expect(r.stats).toMatchObject({ time: 0, score: 0, collisions: 0 });
  });
  it('starts MENU -> PLAYING only once', () => {
    const r = round(); expect(r.start()).toBe(true); expect(r.start()).toBe(false); expect(r.state).toBe('PLAYING');
  });
  it('uses simulation seconds and floors fractional survival points', () => {
    const r = round(); r.start(); r.advanceTo(1.29);
    expect(r.stats.time).toBeCloseTo(1.29); expect(r.stats.score).toBe(12);
  });
  it('awards 100 points, one collision and two destroyed missiles', () => {
    const r = round(); r.start(); r.missilesCollided(collision(2));
    expect(r.stats).toMatchObject({ time: 2, score: 120, collisions: 1, destroyedMissiles: 2 });
  });
  it('does not count duplicate, reversed or overlapping missile IDs', () => {
    const r = round(); r.start(); r.missilesCollided(collision());
    r.missilesCollided(collision(5)); r.missilesCollided(collision(6, ['b','a'])); r.missilesCollided(collision(7, ['a','c']));
    expect(r.stats).toMatchObject({ time: 1, score: 110, collisions: 1, destroyedMissiles: 2 });
  });
  it('rejects a self collision', () => { const score = new ScoreSystem(); expect(score.registerCollision(collision(0, ['a','a']))).toBe(false); });
  it('accumulates distinct pairs consistently', () => {
    const r = round(); r.start(); r.missilesCollided(collision()); r.missilesCollided(collision(2, ['c','d']));
    expect(r.stats).toMatchObject({ score: 220, collisions: 2, destroyedMissiles: 4 });
  });
  it('freezes all stats and rejects impacts while paused', () => {
    const r = round(); r.start(); r.advanceTo(4); r.pause();
    const before = r.stats; r.advanceTo(100); r.missilesCollided(collision(100));
    expect(r.finish(100)).toBe(false); expect(r.stats).toEqual(before); expect(r.pause()).toBe(false);
  });
  it('resumes using simulation timestamps without wall-clock catch-up', () => {
    const r = round(); r.start(); r.advanceTo(4); r.pause(); r.advanceTo(600);
    expect(r.resume()).toBe(true); r.advanceTo(4.016);
    expect(r.stats.time).toBeCloseTo(4.016); expect(r.stats.score).toBe(40); expect(r.resume()).toBe(false);
  });
  it('transitions PLAYING -> GAME_OVER once at exact contact time', () => {
    const r = round(); r.start(); r.advanceTo(1); expect(r.finish(1.025)).toBe(true);
    expect(r.state).toBe('GAME_OVER'); expect(r.stats.time).toBeCloseTo(1.025);
    expect(r.finish(50)).toBe(false);
  });
  it('freezes final stats and ignores all later collisions and time', () => {
    const r = round(); r.start(); r.missilesCollided(collision(0.5)); r.finish(0.75);
    const before = r.stats; r.missilesCollided(collision(0.8, ['c','d'])); r.advanceTo(100); r.pause(); r.resume();
    expect(r.stats).toEqual(before); expect(r.stats.score).toBe(107); expect(Object.isFrozen(r.stats)).toBe(true);
  });
  it('retains rewards before death but none after, including same-time events delivered after death', () => {
    const r = round(); r.start(); r.missilesCollided(collision(1)); r.finish(1);
    r.missilesCollided(collision(1, ['c','d'])); expect(r.stats.score).toBe(110);
  });
  it('restart resets time, score, IDs, stats and new-record indicator', () => {
    const r = round(); r.start(); r.missilesCollided(collision(3)); r.finish(4); r.start();
    expect(r.stats).toMatchObject({ time: 0, score: 0, collisions: 0, destroyedMissiles: 0, best: 140, newRecord: false });
    r.missilesCollided(collision(1)); expect(r.stats.collisions).toBe(1);
  });
  it('survives five consecutive rounds without duplicated rewards and preserves record', () => {
    const r = round();
    for (let i = 0; i < 5; i++) { r.start(); r.missilesCollided(collision(1)); r.finish(2); expect(r.stats.score).toBe(120); }
    expect(r.stats.best).toBe(120); expect(r.stats.newRecord).toBe(false);
  });
  it('automatically pauses when hidden and never resumes automatically', () => {
    const r = round(); r.start(); r.visibilityChanged(true); expect(r.state).toBe('PAUSED');
    r.visibilityChanged(false); expect(r.state).toBe('PAUSED');
  });
  it('does not change MENU or GAME_OVER on visibility changes', () => {
    const r = round(); r.visibilityChanged(true); expect(r.state).toBe('MENU');
    r.start(); r.finish(0); r.visibilityChanged(true); expect(r.state).toBe('GAME_OVER');
  });
  it.each([1/120,1/60,1/30,0.1])('scores consistently with dt=%s', dt => {
    const r = round(); r.start(); for (let i = 1; i <= Math.round(3/dt); i++) r.advanceTo(i*dt);
    r.finish(3); expect(r.stats.score).toBe(30);
  });
  it('formats minutes:seconds by flooring seconds for HUD and results', () => {
    expect(formatSurvivalTime(0)).toBe('00:00'); expect(formatSurvivalTime(61.99)).toBe('01:01');
    expect(formatSurvivalTime(6000)).toBe('100:00');
  });
});

describe('record persistence', () => {
  it('saves a versioned key and recovers across controller instances', () => {
    const s = store(); const r = new RoundController(s.records); r.start(); r.finish(12.39);
    expect(s.data.get(ROUND_CONFIG.recordKey)).toBe('123');
    expect(new RecordStore(() => s.storage).value).toBe(123); expect(r.stats.newRecord).toBe(true);
  });
  it('never overwrites a higher existing or externally updated record', () => {
    const s = store(); s.records.save(100); s.records.save(2); expect(s.records.value).toBe(100);
    s.data.set(ROUND_CONFIG.recordKey, '300'); s.records.save(200); expect(s.data.get(ROUND_CONFIG.recordKey)).toBe('300');
  });
  it.each(['nope', '-1', 'Infinity', '1.5', '9007199254740992'])('ignores invalid stored value %s', value => {
    const s = store(); s.data.set(ROUND_CONFIG.recordKey, value); expect(new RecordStore(() => s.storage).value).toBe(0);
  });
  it('continues playing when accessing localStorage throws', () => {
    const records = new RecordStore(() => { throw new Error('SecurityError'); });
    const r = new RoundController(records); r.start(); r.finish(10); r.start(); expect(r.stats.best).toBe(100);
  });
  it('does not label a lower score as new record when another tab raised the best', () => {
    const s = store(); const r = new RoundController(s.records); r.start();
    s.data.set(ROUND_CONFIG.recordKey, '500'); r.finish(20);
    expect(r.stats).toMatchObject({ score: 200, best: 500, newRecord: false });
  });
  it('retains session record when writes fail', () => {
    const records = new RecordStore(() => ({ getItem: () => null, setItem: () => { throw new Error('QuotaExceeded'); } }));
    records.save(200); expect(records.save(20)).toBe(200);
  });
});
