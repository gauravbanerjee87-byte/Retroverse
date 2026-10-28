import { describe, expect, it } from 'vitest';
import type { InputState } from '@retroverse/shared';
import { ACTION_IDS, createActionGame } from './action';
import type { GameEngine } from './base';
const players = [
  { id: 'a', name: 'Cyan' },
  { id: 'b', name: 'Rose' },
];
const neutral: InputState = {
  seq: 0,
  up: false,
  down: false,
  left: false,
  right: false,
  angle: 0,
  fire: false,
};
function input(
  game: GameEngine,
  id: string,
  seq: number,
  now: number,
  changes: Partial<InputState> = {},
) {
  game.input(id, { ...neutral, ...changes, seq }, now);
}
function advance(game: GameEngine, start: number, end: number, action?: (now: number) => void) {
  for (let t = start; t <= end; t += 40) {
    action?.(t);
    if (game.step(t)) return t;
  }
  return end;
}

describe('original action-game engine registration', () => {
  it.each(ACTION_IDS)('%s has its own game state, useful objects and a terminal result', (id) => {
    const game = createActionGame(id, players, 0, 10000);
    game.step(40);
    expect(game.state.gameId).toBe(id);
    expect(game.state.objects!.length).toBeGreaterThan(0);
    expect(game.state.info!.message.length).toBeGreaterThan(30);
    expect(game.step(10001)).toBe(true);
    expect(game.step(10002)).toBe(false);
    expect(game.state.info!.phase).toBe('finished');
  });
});

describe('cooperative rescue and creature ranges', () => {
  it('awards hostile hits but penalizes civilian fire and team health', () => {
    const game = createActionGame('vector-patrol', players, 0, 60000);
    game.step(40);
    const hostile = game.state.objects!.find((o) => o.kind === 'target')!;
    input(game, 'a', 1, 80, { fire: true, targetX: hostile.x, targetY: hostile.y });
    game.step(80);
    expect(game.state.players[0].score).toBe(10);
    const civilian = game.state.objects!.find((o) => o.kind === 'pickup')!;
    game.state.players[0].score = 30;
    input(game, 'a', 2, 400, { fire: true, targetX: civilian.x, targetY: civilian.y });
    game.step(400);
    expect(game.state.players[0].score).toBe(15);
    expect(game.state.players[0].health).toBe(95);
    expect(game.state.players[1].health).toBe(95);
  });
  it('completes three rescue scenes for the whole cooperative squad, not just the highest scorer', () => {
    const game = createActionGame('vector-patrol', players, 0, 60000);
    game.step(40);
    let seq = 0,
      finished = false;
    for (let now = 80; now <= 20000; now += 40) {
      const target = game.state.objects!.find((o) => o.kind === 'target');
      input(game, 'a', ++seq, now, { fire: !!target, targetX: target?.x, targetY: target?.y });
      if (game.step(now)) {
        finished = true;
        break;
      }
    }
    expect(finished).toBe(true);
    expect(game.state.players[0].score).toBe(120);
    expect(game.state.players[1].score).toBe(0);
    expect(game.state.winnerIds).toEqual(['a', 'b']);
  });
  it('limits a held trigger to six shots and reloads before another hit', () => {
    const game = createActionGame('vector-patrol', players, 0, 60000);
    game.step(40);
    for (let n = 0; n < 6; n++) {
      input(game, 'a', n + 1, 80 + n * 280, { fire: true, targetX: 950, targetY: 580 });
      game.step(80 + n * 280);
    }
    const target = game.state.objects!.find((o) => o.kind === 'target')!;
    input(game, 'a', 8, 1800, { fire: true, targetX: target.x, targetY: target.y });
    game.step(1800);
    expect(game.state.players[0].score).toBe(0);
    input(game, 'a', 9, 2480);
    game.step(2480);
    const current = game.state.objects!.find((o) => o.kind === 'target')!;
    input(game, 'a', 10, 2520, { fire: true, targetX: current.x, targetY: current.y });
    game.step(2520);
    expect(game.state.players[0].score).toBe(10);
  });
  it('advancing creatures damage the squad and coop timeout is a failure, not a score win', () => {
    const game = createActionGame('midnight-outbreak', players, 0, 60000);
    game.step(40);
    const target = game.state.objects!.find((o) => o.kind === 'target')!;
    const y = target.y;
    advance(game, 80, 1040);
    expect(game.state.objects!.find((o) => o.id === target.id)!.y).toBeGreaterThan(y);
    target.y = 490;
    game.step(1080);
    expect(game.state.players.every((p) => p.health === 82)).toBe(true);
    game.step(60001);
    expect(game.state.winnerIds).toEqual([]);
  });
});

describe('tactical relay rounds', () => {
  it('requires a three-second uncontested plant and defender presence can defuse', () => {
    const game = createActionGame('breach-protocol', players, 0, 60000);
    const [attacker, defender] = game.state.players;
    attacker.x = 460;
    attacker.y = 300;
    advance(game, 40, 3040);
    expect(game.state.objects!.find((o) => o.label?.startsWith('PLANTED'))).toBeDefined();
    attacker.x = 90;
    attacker.y = 90;
    defender.x = 460;
    defender.y = 300;
    advance(game, 3080, 6120);
    expect(defender.score).toBe(1);
    expect(attacker.score).toBe(0);
  });
  it('server projectiles eliminate a rival and award the whole winning team a round', () => {
    const game = createActionGame(
      'breach-protocol',
      [...players, { id: 'c', name: 'Blue' }],
      0,
      60000,
    );
    const [a, b, c] = game.state.players;
    a.x = 100;
    a.y = 300;
    b.x = 240;
    b.y = 300;
    c.x = 100;
    c.y = 450;
    let seq = 0;
    advance(game, 40, 1600, (now) => input(game, 'a', ++seq, now, { fire: true, angle: 0 }));
    expect(b.health).toBe(0);
    expect(a.score).toBe(1);
    expect(c.score).toBe(1);
  });
});

describe('stealth intel extraction', () => {
  it('collects mission intel and only wins after the surviving squad reaches extraction', () => {
    const game = createActionGame('shadow-relay', players, 0, 60000);
    game.step(40);
    let now = 80;
    for (const intel of [...game.state.objects!.filter((o) => o.kind === 'pickup')]) {
      game.state.players[0].x = intel.x;
      game.state.players[0].y = intel.y;
      game.step(now);
      now += 40;
    }
    expect(game.state.players[0].score).toBe(100);
    expect(game.state.info!.phase).toBe('extract');
    expect(game.state.winnerIds).toEqual([]);
    game.state.players.forEach((p) => {
      p.x = 70;
      p.y = 260;
    });
    expect(game.step(now)).toBe(true);
    expect(game.state.winnerIds).toEqual(['a', 'b']);
  });
  it('patrol detection damages a visible player but hard cover blocks the ray', () => {
    const game = createActionGame('shadow-relay', players, 0, 60000);
    game.step(40);
    const guard = game.state.objects!.find((o) => o.kind === 'hazard')!;
    const p = game.state.players[0];
    p.x = guard.x + Math.cos(guard.value ?? 0) * 65;
    p.y = guard.y + Math.sin(guard.value ?? 0) * 65;
    game.step(80);
    expect(p.health).toBe(80);
    const covered = createActionGame('shadow-relay', players, 0, 60000);
    // Guard zero faces right toward this player, but the central 80px wall intercepts its sight ray.
    covered.state.players[0].x = 521;
    covered.state.players[0].y = 365;
    covered.step(80);
    expect(covered.state.players[0].health).toBe(100);
    covered.step(60001);
    expect(covered.state.winnerIds).toEqual([]);
  });
});

describe('one-on-one fighter', () => {
  it('jumps with gravity, blocks damage, and rewards timed combos', () => {
    const game = createActionGame('pulse-clash', players, 0, 60000);
    const [a, b] = game.state.players;
    a.x = 400;
    b.x = 460;
    input(game, 'a', 1, 40, { up: true });
    game.step(40);
    expect(a.y).toBeLessThan(490);
    advance(game, 80, 1000);
    expect(a.y).toBe(490);
    a.x = 400;
    b.x = 460;
    input(game, 'b', 1, 1040, { down: true });
    input(game, 'a', 2, 1040, { fire: true });
    game.step(1040);
    const blocked = 100 - b.health;
    expect(blocked).toBeGreaterThan(0);
    expect(blocked).toBeLessThan(9);
    input(game, 'b', 2, 1400);
    input(game, 'a', 3, 1400, { fire: true });
    game.step(1400);
    expect(100 - b.health - blocked).toBe(17);
  });
  it('awards knockout rounds and ends after three wins', () => {
    const game = createActionGame('pulse-clash', players, 0, 60000);
    let now = 40,
      seq = 0;
    for (let round = 0; round < 3; round++) {
      const [a, b] = game.state.players;
      a.x = 400;
      b.x = 460;
      b.health = 1;
      input(game, 'a', ++seq, now, { fire: true });
      game.step(now);
      expect(a.score).toBe(round + 1);
      if (round < 2) {
        now += 1040;
        game.step(now);
        now += 400;
      }
    }
    expect(game.state.winnerIds).toEqual(['a']);
  });
});

describe('tile bomb arena', () => {
  it('a timed placement eliminates the owner if they fail to escape', () => {
    const game = createActionGame('fuse-frenzy', players, 0, 60000);
    input(game, 'a', 1, 40, { fire: true });
    game.step(40);
    expect(game.state.objects!.filter((o) => o.kind === 'bomb')).toHaveLength(1);
    advance(game, 80, 2080);
    expect(game.state.players[0].health).toBe(0);
    expect(game.state.winnerIds).toEqual(['b']);
  });
  it('crates stop blast propagation and destroyed crates award points', () => {
    const game = createActionGame('fuse-frenzy', players, 0, 60000);
    game.step(40);
    const crate = game.state.objects!.find((o) => o.label === 'CRATE')!;
    const p = game.state.players[0];
    p.x = crate.x - 24;
    p.y = crate.y + 24;
    input(game, 'a', 1, 80, { fire: true });
    game.step(80);
    p.x = 144;
    p.y = 108;
    const q = game.state.players[1];
    q.x = crate.x + 72;
    q.y = crate.y + 24;
    advance(game, 120, 2120);
    expect(game.state.objects!.some((o) => o.id === crate.id)).toBe(false);
    expect(p.score).toBeGreaterThanOrEqual(10);
    expect(q.health).toBe(100);
  });
});

describe('maze survival', () => {
  it('collects sparks, blocks wall movement, and requires score to exit', () => {
    const game = createActionGame('glimmer-maze', players, 0, 60000);
    game.step(40);
    const p = game.state.players[0];
    p.x = 900;
    p.y = 520;
    game.step(80);
    expect(game.state.winnerIds).toEqual([]);
    let now = 120;
    for (const pellet of game.state.objects!.filter((o) => o.kind === 'pickup').slice(0, 5)) {
      p.x = pellet.x;
      p.y = pellet.y;
      game.step(now);
      now += 40;
    }
    expect(p.score).toBe(50);
    p.x = 900;
    p.y = 520;
    expect(game.step(now)).toBe(true);
    expect(game.state.winnerIds).toEqual(['a']);
  });
  it('sentinel contact costs points and health and death causes a delayed respawn', () => {
    const game = createActionGame('glimmer-maze', players, 0, 60000);
    game.step(40);
    const p = game.state.players[0];
    p.score = 20;
    p.health = 25;
    const enemy = game.state.objects!.find((o) => o.kind === 'hazard')!;
    p.x = enemy.x;
    p.y = enemy.y;
    game.step(80);
    expect(p.score).toBe(10);
    expect(p.health).toBe(0);
    game.step(1320);
    expect(p.health).toBe(100);
    expect(p.x).toBe(60);
  });
});
