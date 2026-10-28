import { describe, expect, it } from 'vitest';
import type { InputState } from '@retroverse/shared';
import type { GameEngine } from './base';
import { createTableGame, DiceGame, GolfGame, PoolGame, SignalGame, TABLE_IDS } from './table';
const players = [
  { id: 'a', name: 'Amber' },
  { id: 'b', name: 'Blue' },
  { id: 'c', name: 'Cyan' },
  { id: 'd', name: 'Dune' },
];
let sequence = 0;
function action(game: GameEngine, id: string, now: number, extra: Partial<InputState> = {}) {
  const base = { up: false, down: false, left: false, right: false, angle: 0, ...extra };
  game.input(id, { ...base, seq: ++sequence, fire: false }, now);
  game.input(id, { ...base, seq: ++sequence, fire: true }, now);
  return game.step(now);
}
function advance(game: GameEngine, from: number, to: number) {
  for (let now = from; now <= to; now += 40) game.step(now);
}

describe('Homebound Dice', () => {
  it('requires six to leave yard and gives a bonus roll, while rejecting another player action', () => {
    const game = new DiceGame(players.slice(0, 2), 0, 120000, () => 6);
    action(game, 'b', 40);
    expect(game.state.info?.phase).toBe('roll');
    action(game, 'a', 80);
    expect(game.state.info?.round).toBe(6);
    action(game, 'a', 120, { choice: 0 });
    expect(game.tokens.get('a')![0]).toBe(0);
    expect(game.state.info?.turnId).toBe('a');
    expect(game.state.info?.phase).toBe('roll');
  });
  it('captures opposing tokens on unsafe squares and passes the turn', () => {
    const game = new DiceGame(players.slice(0, 2), 0, 120000, () => 2);
    game.tokens.get('a')![0] = 0;
    game.tokens.get('b')![0] = 41;
    action(game, 'a', 40);
    action(game, 'a', 80, { choice: 0 });
    expect(game.tokens.get('a')![0]).toBe(2);
    expect(game.tokens.get('b')![0]).toBe(-1);
    expect(game.state.info?.turnId).toBe('b');
  });
  it('protects safe squares and forbids overshooting home', () => {
    const game = new DiceGame(players.slice(0, 2), 0, 120000, () => 2);
    game.tokens.get('a')![0] = 6;
    game.tokens.get('b')![0] = 47;
    action(game, 'a', 40);
    action(game, 'a', 80, { choice: 0 });
    expect(game.tokens.get('b')![0]).toBe(47);
    const exact = new DiceGame(players.slice(0, 2), 0, 120000, () => 2);
    exact.tokens.get('a')![0] = 56;
    action(exact, 'a', 40);
    expect(exact.tokens.get('a')![0]).toBe(56);
    expect(exact.state.info?.turnId).toBe('b');
  });
  it('ends when all four tokens reach exact home and cleans up departed turns', () => {
    const game = new DiceGame(players.slice(0, 2), 0, 120000, () => 1);
    game.tokens.set('a', [57, 57, 57, 56]);
    action(game, 'a', 40);
    expect(action(game, 'a', 80, { choice: 3 })).toBe(true);
    expect(game.state.winnerIds).toEqual(['a']);
    expect(game.state.info?.phase).toBe('finished');
    const disconnect = new DiceGame(players.slice(0, 3), 0, 120000);
    disconnect.removePlayer('a');
    expect(disconnect.state.info?.turnId).toBe('b');
    expect(disconnect.tokens.has('a')).toBe(false);
  });
  it('passes an inactive turn after the server deadline', () => {
    const game = new DiceGame(players.slice(0, 2), 0, 120000);
    game.step(15001);
    expect(game.state.info?.turnId).toBe('b');
  });
});

describe('Corner Pocket physics and rules', () => {
  it('sets up a full 15-object-ball table and enforces shooting turns', () => {
    const game = new PoolGame(players.slice(0, 2), 0, 120000);
    expect(game.balls.filter((b) => b.active)).toHaveLength(16);
    action(game, 'b', 40, { targetX: 900, targetY: 300 });
    expect(game.balls[0].vx).toBe(0);
    action(game, 'a', 80, { targetX: 900, targetY: 300 });
    expect(game.balls[0].vx).toBeGreaterThan(0);
    advance(game, 120, 1500);
    expect(game.balls.some((b) => b.id !== 0 && (Math.abs(b.vx) > 0 || Math.abs(b.vy) > 0))).toBe(
      true,
    );
  });
  it('resolves cue scratches as a foul and offers legal ball-in-hand placement', () => {
    const game = new PoolGame(players.slice(0, 2), 0, 120000);
    Object.assign(game.balls[0], { x: 90, y: 100 });
    action(game, 'a', 40, { targetX: 60, targetY: 70 });
    advance(game, 80, 2000);
    expect(game.state.info?.turnId).toBe('b');
    expect(game.state.info?.phase).toBe('ball-in-hand');
    action(game, 'b', 2040, { targetX: 700, targetY: 300 });
    expect(game.state.info?.phase).toBe('ball-in-hand');
    action(game, 'b', 2080, { targetX: 300, targetY: 200 });
    expect(game.balls[0].x).toBe(300);
    expect(game.state.info?.phase).toBe('aiming');
  });
  it('awards an early eight-ball loss to the opponent', () => {
    const game = new PoolGame(players.slice(0, 2), 0, 120000);
    const black = game.balls.find((b) => b.id === 8)!;
    Object.assign(game.balls[0], { x: 145, y: 145 });
    Object.assign(black, { x: 100, y: 100 });
    action(game, 'a', 40, { targetX: 10, targetY: 10 });
    advance(game, 80, 6000);
    expect(game.state.winnerIds).toEqual(['b']);
    expect(game.state.info?.phase).toBe('finished');
  });
  it('assigns groups from a legal pocket and permits the eight only on a later cleared-table shot', () => {
    const game = new PoolGame(players.slice(0, 2), 0, 120000);
    Object.assign(game.balls[0], { x: 150, y: 150 });
    Object.assign(
      game.balls.find((b) => b.id === 1)!,
      { x: 100, y: 100 },
    );
    action(game, 'a', 40, { targetX: 10, targetY: 10 });
    advance(game, 80, 6000);
    expect(game.balls.find((b) => b.id === 1)!.active).toBe(false);
    expect(game.state.info?.teams?.a).toBe('solids');
    expect(game.state.info?.turnId).toBe('a');
    for (const ball of game.balls) if (ball.id >= 2 && ball.id <= 7) ball.active = false;
    Object.assign(game.balls[0], { x: 145, y: 145, vx: 0, vy: 0 });
    Object.assign(
      game.balls.find((b) => b.id === 8)!,
      { x: 100, y: 100, vx: 0, vy: 0 },
    );
    action(game, 'a', 6040, { targetX: 10, targetY: 10 });
    advance(game, 6080, 12000);
    expect(game.state.winnerIds).toEqual(['a']);
  });
  it('advances a timed-out shot and safely handles disconnect', () => {
    const game = new PoolGame(players.slice(0, 2), 0, 120000);
    game.step(20001);
    expect(game.state.info?.turnId).toBe('b');
    game.removePlayer('b');
    expect(game.step(20041)).toBe(true);
    expect(game.state.winnerIds).toEqual(['a']);
  });
});

describe('Hidden Signal private roles and voting', () => {
  it('keeps role assignments out of public snapshots and spawns eight players inside bounds', () => {
    const roster = Array.from({ length: 8 }, (_, i) => ({ id: String(i), name: `Player ${i}` }));
    const game = new SignalGame(roster, 0, 120000, () => 0);
    expect(game.privateInfo('0')).toMatch(/^SABOTEUR/);
    expect(game.privateInfo('1')).toMatch(/^CREW/);
    expect(game.privateInfo('missing')).toBeUndefined();
    expect(JSON.stringify(game.state)).not.toContain('SABOTEUR');
    expect(game.state.players.every((p) => p.x > 0 && p.x < 960 && p.y > 0 && p.y < 600)).toBe(
      true,
    );
  });
  it('requires real station interactions and prevents repeating a task for more score', () => {
    const game = new SignalGame(players, 0, 120000, () => 0);
    const crew = game.state.players[1];
    crew.x = 140;
    crew.y = 140;
    action(game, 'b', 40);
    expect(crew.score).toBe(1);
    action(game, 'b', 800);
    expect(crew.score).toBe(1);
    crew.x = 820;
    crew.y = 140;
    action(game, 'b', 1500);
    expect(crew.score).toBe(2);
  });
  it('applies proximity eliminations with cooldown and determines the saboteur win', () => {
    const game = new SignalGame(players, 0, 120000, () => 0);
    const [a, b, c] = game.state.players;
    a.x = 300;
    a.y = 300;
    b.x = 310;
    b.y = 300;
    c.x = 320;
    c.y = 300;
    action(game, 'a', 40);
    expect(b.health).toBe(0);
    action(game, 'a', 800);
    expect(c.health).toBe(100);
    expect(action(game, 'a', 4200)).toBe(true);
    expect(game.state.winnerIds).toEqual(['a']);
    expect(game.state.info?.phase).toBe('finished');
  });
  it('accepts one vote per living guest and awards a crew win when the saboteur is ejected', () => {
    const game = new SignalGame(players, 0, 120000, () => 0);
    action(game, 'b', 40, { choice: 8 });
    expect(game.state.info?.phase).toBe('voting');
    action(game, 'a', 80, { choice: 9 });
    action(game, 'b', 120, { choice: 0 });
    action(game, 'b', 160, { choice: 3 });
    action(game, 'c', 200, { choice: 0 });
    expect(action(game, 'd', 240, { choice: 0 })).toBe(true);
    expect(game.state.players[0].health).toBe(0);
    expect(game.state.winnerIds).toEqual(['b', 'c', 'd']);
  });
  it('resolves tied votes without an ejection and handles departed secret roles', () => {
    const game = new SignalGame(players, 0, 120000, () => 0);
    action(game, 'b', 40, { choice: 8 });
    action(game, 'a', 80, { choice: 1 });
    action(game, 'b', 120, { choice: 0 });
    action(game, 'c', 160, { choice: 9 });
    action(game, 'd', 200, { choice: 9 });
    expect(game.state.players.every((p) => p.health === 100)).toBe(true);
    expect(game.state.info?.phase).toBe('tasks');
    game.removePlayer('a');
    expect(game.step(240)).toBe(true);
    expect(game.state.winnerIds).toEqual(['b', 'c', 'd']);
  });
});

describe('Orbit Putt turn-based golf', () => {
  it('moves only the active ball, counts server strokes, and passes after settling', () => {
    const game = new GolfGame(players.slice(0, 2), 0, 120000);
    const start = game.balls.get('a')!.x;
    action(game, 'b', 40, { targetX: 320, targetY: 440 });
    expect(game.strokes.get('b')).toBe(0);
    action(game, 'a', 80, { targetX: 320, targetY: 440 });
    expect(game.balls.get('a')!.x).toBeGreaterThan(start);
    expect(game.strokes.get('a')).toBe(1);
    expect(game.state.players[0].score).toBe(-1);
    advance(game, 120, 6000);
    expect(game.state.info?.turnId).toBe('b');
  });
  it('detects a slow putt into the cup and progresses after both players finish a hole', () => {
    const game = new GolfGame(players.slice(0, 2), 0, 120000);
    Object.assign(game.balls.get('a')!, { x: 790, y: 130 });
    action(game, 'a', 40, { targetX: 820, targetY: 130 });
    advance(game, 80, 600);
    expect(game.balls.get('a')!.holed).toBe(true);
    expect(game.state.info?.turnId).toBe('b');
    Object.assign(game.balls.get('b')!, { x: 790, y: 130 });
    action(game, 'b', 640, { targetX: 820, targetY: 130 });
    advance(game, 680, 1200);
    expect(game.state.info?.round).toBe(2);
    expect(game.balls.get('a')!.holed).toBe(false);
  });
  it('uses completed holes and proximity for timeout results instead of rewarding zero-shot inactivity', () => {
    const game = new GolfGame(players.slice(0, 2), 0, 500);
    Object.assign(game.balls.get('a')!, { x: 790, y: 130 });
    game.strokes.set('a', 2);
    expect(game.step(501)).toBe(true);
    expect(game.state.winnerIds).toEqual(['a']);
    expect(game.state.info?.phase).toBe('finished');
  });
  it('penalizes inactive turns and removes disconnected balls', () => {
    const game = new GolfGame(players.slice(0, 3), 0, 120000);
    game.step(20001);
    expect(game.strokes.get('a')).toBe(1);
    expect(game.state.info?.turnId).toBe('b');
    game.removePlayer('b');
    expect(game.balls.has('b')).toBe(false);
    expect(game.state.info?.turnId).toBe('c');
  });
});

describe('table game factory', () => {
  it.each(TABLE_IDS)('constructs %s with its own authoritative objects', (id) => {
    const game = createTableGame(id, players, 0, 120000);
    expect(game.state.gameId).toBe(id);
    expect(game.state.objects!.length).toBeGreaterThan(0);
  });
});
