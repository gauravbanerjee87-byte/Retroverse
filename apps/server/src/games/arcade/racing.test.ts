import { describe, expect, it } from 'vitest';
import { createRacingGame, RACING_IDS } from './racing';
import type { InputState } from '@retroverse/shared';
const players = [
  { id: 'a', name: 'Ada' },
  { id: 'b', name: 'Ben' },
];
const input = (seq: number, changes: Partial<InputState> = {}): InputState => ({
  seq,
  up: false,
  down: false,
  left: false,
  right: false,
  angle: 0,
  fire: false,
  ...changes,
});
describe('original racing, driving and platform games', () => {
  it.each(RACING_IDS)('%s has a live world and authoritative controls', (id) => {
    const game = createRacingGame(id, players, 0, 10000);
    const before = game.state.players[0].x;
    game.input('a', input(1, { right: true }), 0);
    game.step(40);
    expect(game.state.players[0].x).toBeGreaterThan(before);
    expect(game.state.objects?.length).toBeGreaterThan(0);
    expect(game.state.gameId).toBe(id);
    expect(game.input('a', input(1, { left: true }), 40)).toBe(false);
    expect(game.state.players[1].score).toBe(0);
    expect(game.step(10000)).toBe(true);
    expect(game.state.info?.phase).toBe('finished');
    expect(game.step(10040)).toBe(false);
  });
  it('requires motorcycle checkpoints in sequence and ends after three full laps', () => {
    const game = createRacingGame('asphalt-rivals', players, 0, 100000);
    const p = game.state.players[0];
    p.x = 120;
    p.y = 500;
    game.step(40);
    expect(p.score).toBe(0);
    const gates = [
      { x: 840, y: 100 },
      { x: 840, y: 500 },
      { x: 120, y: 500 },
      { x: 120, y: 100 },
    ];
    for (let i = 0; i < 12; i++) {
      Object.assign(p, gates[i % 4]);
      game.step(80 + i * 40);
      expect(p.score).toBe(i + 1);
    }
    expect(game.state.winnerIds).toEqual(['a']);
  });
  it('motorcycle strikes damage only nearby rivals and crashes respawn at last gate', () => {
    const game = createRacingGame('asphalt-rivals', players, 0, 10000);
    const [a, b] = game.state.players;
    a.x = 120;
    a.y = 100;
    b.x = 150;
    b.y = 100;
    for (let n = 0; n < 3; n++) {
      const now = 40 + n * 700;
      game.input('a', input(n * 2, { fire: false }), now);
      game.input('a', input(n * 2 + 1, { fire: true }), now);
      game.step(now);
    }
    expect(b.health).toBe(0);
    expect(b.deaths).toBe(1);
    expect(game.state.kills).toHaveLength(1);
    game.step(2500);
    expect(b.health).toBe(100);
    expect(b.x).toBe(120);
    expect(b.y).toBe(100);
  });
  it('city delivery requires two deliberate interactions at separate locations', () => {
    const game = createRacingGame('sunset-borough', players, 0, 10000);
    const p = game.state.players[0];
    const marker = () => game.state.objects!.find((o) => o.ownerId === 'a')!;
    const pickup = marker();
    p.x = pickup.x + 26;
    p.y = pickup.y + 26;
    game.step(40);
    expect(p.score).toBe(0);
    game.input('a', input(1, { fire: true }), 80);
    game.step(80);
    expect(marker().label).toBe('DELIVER');
    expect(p.score).toBe(0);
    const target = marker();
    p.x = target.x + 26;
    p.y = target.y + 26;
    game.step(120);
    expect(p.score).toBe(0);
    game.input('a', input(2), 160);
    game.input('a', input(3, { fire: true }), 160);
    game.step(160);
    expect(p.score).toBe(1);
    expect(marker().label).toBe('COLLECT');
  });
  it('city buildings block driving and a checkpoint advances only once', () => {
    const game = createRacingGame('metro-roam', players, 0, 10000);
    const p = game.state.players[0];
    p.x = 220;
    p.y = 210;
    game.input('a', input(1, { right: true }), 40);
    game.step(40);
    expect(p.x).toBe(220);
    const target = game.state.objects!.find((o) => o.ownerId === 'a')!;
    p.x = target.x + 26;
    p.y = target.y + 26;
    game.clearInput('a');
    game.step(80);
    expect(p.score).toBe(1);
    game.step(120);
    expect(p.score).toBe(1);
  });
  it('roof race has gravity, grounded jumps and a reachable raised finish', () => {
    const game = createRacingGame('rooftop-rush', players, 0, 10000);
    const p = game.state.players[0];
    game.input('a', input(1, { fire: true }), 0);
    game.step(40);
    expect(p.y).toBeLessThan(544);
    const afterJump = p.y;
    game.input('a', input(2), 40);
    game.input('a', input(3, { fire: true }), 40);
    game.step(80);
    expect(afterJump - p.y).toBeLessThan(19);
    Object.assign(p, { x: 860, y: 190 });
    game.clearInput('a');
    expect(game.step(120)).toBe(true);
    expect(game.state.winnerIds).toEqual(['a']);
  });
  it('party traps return a player to a checkpoint and record a fall', () => {
    const game = createRacingGame('tumble-circuit', players, 0, 10000);
    const p = game.state.players[0];
    const trap = game.state.objects!.find((o) => o.id === 'trap-a')!;
    p.x = trap.x;
    p.y = trap.y;
    game.step(40);
    expect(p.deaths).toBe(1);
    expect(p.x).toBe(330);
  });
  it('kart boost pickups make a measurable speed difference', () => {
    const game = createRacingGame('pocket-drift', players, 0, 10000);
    const p = game.state.players[0];
    p.x = 480;
    p.y = 100;
    game.step(40);
    game.input('a', input(1, { right: true }), 40);
    const start = p.x;
    game.step(80);
    expect(p.x - start).toBeGreaterThan(12);
    expect(game.state.objects!.filter((o) => o.kind === 'pickup')).toHaveLength(3);
  });
});

describe('courses completed through real controls', () => {
  it('motorcycle riders can complete three laps from spawn without teleporting', () => {
    const game = createRacingGame('asphalt-rivals', players, 0, 100000);
    const p = game.state.players[0];
    const gates = [
      { x: 840, y: 100 },
      { x: 840, y: 500 },
      { x: 120, y: 500 },
      { x: 120, y: 100 },
    ];
    let finished = false;
    for (let seq = 1; seq <= 2000 && !finished; seq++) {
      const target = gates[p.score % gates.length];
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      game.input(
        'a',
        input(seq, { right: dx > 6, left: dx < -6, down: dy > 6, up: dy < -6 }),
        seq * 40,
      );
      finished = game.step(seq * 40);
    }
    expect(finished).toBe(true);
    expect(p.score).toBe(12);
    expect(game.state.winnerIds).toEqual(['a']);
  });
  it('the rooftop finish is reachable from spawn with grounded jumps', () => {
    const game = createRacingGame('rooftop-rush', players, 0, 100000);
    const p = game.state.players[0];
    const stages = [
      { takeoff: 55, target: 190, ground: 544 },
      { takeoff: 195, target: 325, ground: 479 },
      { takeoff: 345, target: 495, ground: 409 },
      { takeoff: 515, target: 665, ground: 339 },
      { takeoff: 685, target: 835, ground: 269 },
    ];
    let stage = 0;
    let jumped = false;
    let finished = false;
    for (let seq = 1; seq < 1500 && !finished; seq++) {
      const current = stages[stage];
      if (!current) {
        game.input('a', input(seq, { right: true }), seq * 40);
        finished = game.step(seq * 40);
        continue;
      }
      if (
        jumped &&
        p.y < current.ground - 40 &&
        Math.abs(p.y - [479, 409, 339, 269, 199][stage]) < 0.1
      ) {
        stage++;
        jumped = false;
      }
      const plan = stages[stage];
      if (!plan) {
        game.input('a', input(seq, { right: true }), seq * 40);
        finished = game.step(seq * 40);
        continue;
      }
      const onGround = Math.abs(p.y - plan.ground) < 0.1;
      const shouldJump = !jumped && onGround && p.x >= plan.takeoff - 4;
      if (shouldJump) jumped = true;
      const target = jumped ? plan.target : plan.takeoff;
      game.input(
        'a',
        input(seq, { right: p.x < target - 2, left: p.x > target + 2, fire: shouldJump }),
        seq * 40,
      );
      finished = game.step(seq * 40);
    }
    expect({ finished, stage, x: p.x, y: p.y }).toMatchObject({ finished: true });
    expect(game.state.winnerIds).toEqual(['a']);
  });
  it('pursuit damage has a half-second immunity window', () => {
    const game = createRacingGame('night-circuit', players, 0, 10000);
    const p = game.state.players[0];
    p.x = 840;
    p.y = 100;
    game.step(40);
    expect(p.health).toBe(78);
    for (let tick = 2; tick <= 6; tick++) {
      const car = game.state.objects!.find((o) => o.id === 'pursuit-0')!;
      p.x = car.x;
      p.y = car.y;
      game.step(tick * 40);
    }
    expect(p.health).toBe(78);
  });
});
