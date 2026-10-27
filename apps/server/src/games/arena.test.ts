import { describe, expect, it } from 'vitest';
import { ARENA, type InputState } from '@retroverse/shared';
import { Arena } from './arena';

const players = [
  { id: 'a', name: 'Ada' },
  { id: 'b', name: 'Ben' },
];
const input = (seq: number, overrides: Partial<InputState> = {}): InputState => ({
  seq,
  up: false,
  down: false,
  left: false,
  right: false,
  angle: 0,
  fire: false,
  ...overrides,
});

describe('authoritative Neon Arena', () => {
  it('moves at bounded speed, normalizes diagonals and respects boundaries', () => {
    const arena = new Arena(players, 0, 10000);
    const a = arena.state.players[0];
    arena.input('a', input(1, { right: true, down: true }), 0);
    arena.step(40);
    expect(Math.hypot(a.x - 100, a.y - 100)).toBeCloseTo(ARENA.speed / ARENA.tickRate);
    a.x = 16;
    a.y = 16;
    arena.input('a', input(2, { left: true, up: true }), 40);
    arena.step(80);
    expect(a.x).toBe(16);
    expect(a.y).toBe(16);
  });

  it('rejects stale and duplicate inputs and expires held controls', () => {
    const arena = new Arena(players, 0, 10000);
    expect(arena.input('a', input(3, { right: true }), 0)).toBe(true);
    expect(arena.input('a', input(3, { left: true }), 10)).toBe(false);
    expect(arena.input('a', input(2, { left: true }), 20)).toBe(false);
    arena.step(40);
    const before = arena.state.players[0].x;
    arena.step(300);
    expect(arena.state.players[0].x).toBe(before);
    expect(arena.input('unknown', input(4), 300)).toBe(false);
  });

  it('blocks movement and bullets at arena cover', () => {
    const arena = new Arena(players, 0, 10000);
    const [a, b] = arena.state.players;
    a.x = 200;
    a.y = 175;
    b.x = 350;
    b.y = 175;
    for (let frame = 1; frame <= 30; frame++) {
      const now = frame * 40;
      arena.input('a', input(frame, { right: true, fire: true }), now);
      arena.step(now);
    }
    expect(a.x).toBeLessThanOrEqual(204);
    expect(b.health).toBe(100);
  });

  it('applies exactly 25 damage per collision and does not hit the shooter', () => {
    const arena = new Arena(players, 0, 10000);
    const [a, b] = arena.state.players;
    a.x = 100;
    a.y = 100;
    b.x = 170;
    b.y = 100;
    arena.input('a', input(1, { fire: true }), 0);
    arena.step(40);
    arena.clearInput('a');
    arena.step(80);
    arena.step(120);
    expect(b.health).toBe(75);
    expect(a.health).toBe(100);
    expect(a.score).toBe(0);
    expect(arena.state.bullets).toHaveLength(0);
  });

  it('calculates damage and knockout scoring on the server, then respawns', () => {
    const arena = new Arena(players, 0, 10000);
    const [a, b] = arena.state.players;
    a.x = 100;
    a.y = 100;
    b.x = 170;
    b.y = 100;
    let now = 0;
    while (b.health > 0 && now < 2000) {
      now += 40;
      arena.input('a', input(now, { fire: true }), now);
      arena.step(now);
    }
    expect(b.health).toBe(0);
    expect(b.deaths).toBe(1);
    expect(a.score).toBe(1);
    expect(arena.state.kills).toHaveLength(1);
    const respawnAt = b.respawnAt;
    arena.clearInput('a');
    arena.step(respawnAt - 1);
    expect(b.health).toBe(0);
    arena.step(respawnAt);
    expect(b.health).toBe(100);
    expect(b.respawnAt).toBe(0);
  });

  it('enforces firing cooldown and cleans input and projectiles for removed players', () => {
    const arena = new Arena(players, 0, 10000);
    for (let frame = 1; frame <= 5; frame++) {
      arena.input('a', input(frame, { fire: true }), frame * 40);
      arena.step(frame * 40);
    }
    expect(arena.state.bullets).toHaveLength(1);
    arena.removePlayer('a');
    expect(arena.state.players.map((p) => p.id)).toEqual(['b']);
    expect(arena.state.bullets).toHaveLength(0);
  });

  it('caps delayed steps so server stalls cannot teleport players', () => {
    const arena = new Arena(players, 0, 10000);
    arena.input('a', input(1, { right: true }), 500);
    arena.step(500);
    expect(arena.state.players[0].x).toBeCloseTo(108.8);
  });

  it('determines a winner or shared tie only once and freezes the match', () => {
    const arena = new Arena(players, 0, 1000);
    expect(arena.step(1000)).toBe(true);
    expect(arena.state.winnerIds).toEqual(['a', 'b']);
    expect(arena.step(1040)).toBe(false);
    expect(arena.input('a', input(1), 1040)).toBe(false);
    const solo = new Arena(players, 0, 1000);
    solo.state.players[1].score = 2;
    solo.step(1000);
    expect(solo.state.winnerIds).toEqual(['b']);
  });
});
