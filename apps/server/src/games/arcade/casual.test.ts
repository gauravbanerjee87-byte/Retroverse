import { describe, expect, it } from 'vitest';
import type { InputState } from '@retroverse/shared';
import { CASUAL_IDS, clearFullRows, createCasualGame, rotatePiece } from './casual';
const participants = [
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

describe('six server-authoritative casual games', () => {
  it.each(CASUAL_IDS)('%s exposes a real world and completes with server winners', (id) => {
    const game = createCasualGame(id, participants, 0, 10000);
    expect(game.state.gameId).toBe(id);
    expect(game.state.objects!.length).toBeGreaterThan(0);
    expect(game.input('intruder', input(1), 0)).toBe(false);
    expect(game.step(10001)).toBe(true);
    expect(game.state.winnerIds.length).toBeGreaterThan(0);
    expect(game.step(10040)).toBe(false);
    expect(game.input('a', input(2), 10001)).toBe(false);
  });
  it('rotates a falling piece and clears only full rows, retaining partially filled rows', () => {
    expect(
      rotatePiece([
        [1, 0],
        [1, 1],
        [1, 0],
      ]),
    ).toEqual([
      [1, 1, 1],
      [0, 1, 0],
    ]);
    const board = [
      [0, 0, 0],
      [1, 0, 1],
      [2, 2, 2],
      [3, 3, 3],
    ];
    expect(clearFullRows(board)).toBe(2);
    expect(board).toEqual([
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
      [1, 0, 1],
    ]);
  });
  it('hard-drops and locks a falling piece, then spawns the next shape', () => {
    const game = createCasualGame('stack-surge', participants, 0, 10000);
    const first = game.state.objects!.filter((o) => o.kind === 'tile' && o.ownerId === 'a');
    game.input('a', input(1, { fire: true }), 0);
    game.step(40);
    expect(game.state.players[0].score).toBeGreaterThan(0);
    const tiles = game.state.objects!.filter((o) => o.kind === 'tile' && o.ownerId === 'a');
    expect(tiles.length).toBeGreaterThan(first.length);
    expect(tiles.some((t) => t.y > 480)).toBe(true);
    expect(tiles.some((t) => t.y < 120)).toBe(true);
    const score = game.state.players[0].score;
    game.step(80);
    expect(game.state.players[0].score).toBe(score);
  });
  it('grid snake consumes food, grows a body, rejects reversal and crashes at walls', () => {
    const game = createCasualGame('pixel-serpent', participants, 0, 10000);
    const fruit = game.state.objects!.find((o) => o.kind === 'pickup')!;
    fruit.x = 130;
    fruit.y = 110;
    for (let frame = 1; frame <= 4; frame++) {
      game.input('a', input(frame, { right: true }), frame * 40);
      game.step(frame * 40);
    }
    expect(game.state.players[0].score).toBe(1);
    expect(game.state.objects!.filter((o) => o.kind === 'trail' && o.ownerId === 'a').length).toBe(
      3,
    );
    const x = game.state.players[0].x;
    for (let frame = 5; frame <= 8; frame++) {
      game.input('a', input(frame, { left: true }), frame * 40);
      game.step(frame * 40);
    }
    expect(game.state.players[0].x).toBeGreaterThan(x);
    let deaths = 0;
    for (let frame = 9; frame <= 220; frame++) {
      game.input('a', input(frame, { right: true }), frame * 40);
      game.step(frame * 40);
      deaths = game.state.players[0].deaths;
      if (deaths) break;
    }
    expect(deaths).toBe(1);
  });
  it('accelerating into a rival snake body causes a collision before the arena edge', () => {
    const game = createCasualGame('pixel-serpent', participants, 0, 10000);
    let collided = false;
    for (let frame = 1; frame <= 90; frame++) {
      game.input('a', input(frame, { right: true, fire: true }), frame * 40);
      game.step(frame * 40);
      if (game.state.players[0].deaths > 0) {
        collided = true;
        expect(game.state.players[0].x).toBeLessThan(900);
        break;
      }
    }
    expect(collided).toBe(true);
  });
  it('removed grid snakes leave no invisible collision body behind', () => {
    const game = createCasualGame('pixel-serpent', participants, 0, 10000);
    game.removePlayer('b');
    for (let frame = 1; frame <= 60; frame++) {
      game.input('a', input(frame, { right: true }), frame * 40);
      game.step(frame * 40);
    }
    expect(game.state.players[0].x).toBeGreaterThan(350);
    expect(game.state.players[0].deaths).toBe(0);
  });
  it('a departed pong participant forfeits to the remaining player', () => {
    const game = createCasualGame('paddle-pulse', participants, 0, 10000);
    game.removePlayer('a');
    expect(game.step(40)).toBe(true);
    expect(game.state.winnerIds).toEqual(['b']);
  });
  it('colored chain shots match a pair and award server-owned points', () => {
    const game = createCasualGame('orbit-marbles', participants, 0, 10000);
    const first = game.state.objects!.find((o) => o.kind === 'ball' && o.color === '#55e2ef')!;
    const p = game.state.players[0];
    const angle = Math.atan2(first.y - p.y, first.x - p.x);
    game.input('a', input(1, { angle, fire: true }), 0);
    game.step(40);
    for (let frame = 2; frame <= 30; frame++) game.step(frame * 40);
    expect(p.score).toBeGreaterThanOrEqual(3);
    expect(game.state.objects!.filter((o) => o.kind === 'ball').length).toBeLessThan(18);
  });
  it('pong serves a moving ball, bounds paddles and awards a missed goal', () => {
    const game = createCasualGame('paddle-pulse', participants, 0, 20000);
    game.input('a', input(1, { fire: true }), 0);
    game.step(40);
    expect(game.state.objects!.find((o) => o.kind === 'ball')!.x).toBeGreaterThan(480);
    for (let frame = 2; frame < 180; frame++) {
      const now = frame * 40;
      game.input('b', input(frame, { up: true }), now);
      game.step(now);
      if (game.state.players.some((p) => p.score > 0)) break;
    }
    expect(game.state.players[1].y).toBeGreaterThanOrEqual(95);
    expect(game.state.players.reduce((n, p) => n + p.score, 0)).toBe(1);
    expect(game.state.info!.turnId).toBe('b');
  });
  it('cells gain mass on food, absorb smaller rivals, and give victims a respawn', () => {
    const game = createCasualGame('bloom-arena', participants, 0, 10000);
    const [a, b] = game.state.players;
    for (const food of game.state.objects!.filter((o) => o.kind === 'pickup')) {
      food.x = a.x;
      food.y = a.y;
    }
    game.step(40);
    expect(a.score).toBeGreaterThan(40);
    b.x = a.x;
    b.y = a.y;
    game.step(80);
    expect(b.health).toBe(0);
    expect(b.deaths).toBe(1);
    expect(b.respawnAt).toBeGreaterThan(80);
    expect(a.score).toBeGreaterThan(65);
    game.step(2000);
    expect(b.health).toBe(100);
  });
  it('coil snakes steer continuously and grow after collecting energy', () => {
    const game = createCasualGame('coil-circuit', participants, 0, 10000);
    const p = game.state.players[0];
    const energy = game.state.objects!.find((o) => o.kind === 'pickup')!;
    energy.x = p.x + 6;
    energy.y = p.y;
    game.input('a', input(1, { angle: Math.PI / 2 }), 0);
    game.step(40);
    expect(p.score).toBe(2);
    expect(p.x).toBeGreaterThan(100);
    expect(p.y).toBeGreaterThan(130);
    expect(p.angle).toBeLessThan(Math.PI / 2);
    game.input('a', input(2, { angle: Math.PI / 2 }), 40);
    game.step(80);
    expect(game.state.objects!.some((o) => o.kind === 'trail' && o.ownerId === 'a')).toBe(true);
  });
});
