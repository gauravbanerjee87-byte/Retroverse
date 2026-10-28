import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import {
  GAMES,
  clientMessageSchema,
  type ClientMessage,
  type ServerMessage,
} from '@retroverse/shared';
import { createGameServer } from './server';
import { createGameEngine, IMPLEMENTED_GAME_IDS } from './games/arcade/registry';

const apps: ReturnType<typeof createGameServer>[] = [];
const sockets: WebSocket[] = [];
afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.terminate();
  for (const app of apps.splice(0)) await app.close();
});
async function setup() {
  const app = createGameServer({ port: 0, silent: true, matchSeconds: 0.45 });
  apps.push(app);
  await app.listen();
  return app;
}
async function client(app: ReturnType<typeof createGameServer>, index: number) {
  const socket = new WebSocket(`ws://127.0.0.1:${app.port}/ws`);
  sockets.push(socket);
  const messages: ServerMessage[] = [];
  socket.on('message', (raw) => messages.push(JSON.parse(raw.toString()) as ServerMessage));
  await new Promise<void>((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });
  function send(message: ClientMessage) {
    socket.send(JSON.stringify(message));
  }
  async function wait<T extends ServerMessage['type']>(
    type: T,
    predicate: (m: Extract<ServerMessage, { type: T }>) => boolean = () => true,
  ) {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const found = messages.find(
        (m) => m.type === type && predicate(m as Extract<ServerMessage, { type: T }>),
      );
      if (found) return found as Extract<ServerMessage, { type: T }>;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    throw new Error(
      `Timed out waiting for ${type}: ${messages
        .filter((m) => m.type === 'error')
        .map((m) => JSON.stringify(m))
        .join(',')}`,
    );
  }
  send({ type: 'hello', version: 1, name: `Guest ${index}` });
  const welcome = await wait('welcome');
  return { socket, messages, send, wait, welcome };
}

describe('multi-game authoritative transport', () => {
  it('registers exactly one concrete server engine for every catalogue identity', () => {
    expect(new Set(IMPLEMENTED_GAME_IDS).size).toBe(25);
    expect([...IMPLEMENTED_GAME_IDS].sort()).toEqual(GAMES.map((game) => game.id).sort());
    expect(
      clientMessageSchema.safeParse({ type: 'create', gameId: 'unregistered', capacity: 2 })
        .success,
    ).toBe(false);
    expect(
      clientMessageSchema.safeParse({ type: 'queue', gameId: 'night-circuit', mode: 'deathmatch' })
        .success,
    ).toBe(false);
    expect(
      clientMessageSchema.safeParse({
        type: 'input',
        input: {
          seq: 0,
          up: false,
          down: false,
          left: false,
          right: false,
          angle: 0,
          fire: true,
          targetX: 99999,
        },
      }).success,
    ).toBe(false);
  });
  it('keeps snapshots bounded and finite at every advertised maximum room capacity', () => {
    for (const game of GAMES) {
      const participants = Array.from({ length: game.maxPlayers }, (_, i) => ({
        id: `p${i}`,
        name: `Player ${i}`,
      }));
      const engine = createGameEngine(game.id, participants, 0, 20000);
      for (let tick = 1; tick <= 400; tick++) {
        const now = tick * 40;
        for (const [index, participant] of participants.entries())
          engine.input(
            participant.id,
            {
              seq: tick,
              up: tick % 100 < 25,
              down: tick % 100 >= 50 && tick % 100 < 75,
              left: tick % 100 >= 75,
              right: tick % 100 >= 25 && tick % 100 < 50,
              angle: Math.sin(tick / 20) * Math.PI,
              fire: tick % 4 < 2,
              targetX: 80 + index * 100,
              targetY: 300,
              choice: index % 4,
            },
            now,
          );
        if (engine.step(now)) break;
        expect(
          engine.state.players.every((player) =>
            [player.x, player.y, player.health, player.score].every(Number.isFinite),
          ),
          game.id,
        ).toBe(true);
        expect(engine.state.objects?.length ?? 0, game.id).toBeLessThan(1600);
        if (tick % 50 === 0)
          expect(Buffer.byteLength(JSON.stringify(engine.state)), game.id).toBeLessThan(262144);
      }
    }
  });
  it.each(GAMES)(
    '$name creates, joins, starts, accepts input, broadcasts, and records authoritative completion',
    async (game) => {
      const app = await setup();
      const members = [];
      for (let index = 0; index < game.minPlayers; index++) members.push(await client(app, index));
      const host = members[0];
      host.send({ type: 'create', gameId: game.id, capacity: game.minPlayers });
      const created = await host.wait('room');
      expect(created.room.gameId).toBe(game.id);
      for (const member of members.slice(1)) {
        member.send({ type: 'join', code: created.room.code });
        await member.wait('room');
      }
      for (const member of members) member.send({ type: 'ready', ready: true });
      await host.wait(
        'room',
        (m) => m.room.players.length === game.minPlayers && m.room.players.every((p) => p.ready),
      );
      host.send({ type: 'start' });
      for (const member of members) {
        const started = await member.wait('room', (m) => m.room.status === 'playing');
        expect(started.room.match?.gameId).toBe(game.id);
        member.send({
          type: 'input',
          input: {
            seq: 1,
            up: false,
            down: false,
            left: false,
            right: true,
            angle: 0,
            fire: true,
            targetX: 600,
            targetY: 300,
            choice: 0,
          },
        });
      }
      const snapshot = await host.wait('state', (message) => message.state.tick > 0);
      expect(snapshot.state.players).toHaveLength(game.minPlayers);
      expect(snapshot.state.tick).toBeGreaterThan(0);
      expect(snapshot.state.gameId).toBe(game.id);
      const result = await host.wait('finished');
      expect(result.record.gameId).toBe(game.id);
      expect(result.record.players).toHaveLength(game.minPlayers);
      expect(
        result.record.winnerIds.every((id) => result.record.players.some((p) => p.id === id)),
      ).toBe(true);
      expect(host.messages.filter((m) => m.type === 'error')).toEqual([]);
      const finalState = structuredClone(app.manager.rooms.get(result.room.code)?.arena?.state);
      const afterFinish = host.messages.length;
      host.send({
        type: 'input',
        input: { seq: 2, up: true, down: false, left: false, right: false, angle: 0, fire: true },
      });
      host.send({ type: 'ping', at: 987654321 });
      await host.wait('pong', (m) => m.at === 987654321);
      expect(host.messages.slice(afterFinish).filter((m) => m.type === 'error')).toEqual([]);
      expect(app.manager.rooms.get(result.room.code)?.arena?.state).toEqual(finalState);
      const history = await (await fetch(`http://127.0.0.1:${app.port}/api/history`)).json();
      expect(history.matches[0].gameId).toBe(game.id);
      expect(history.matches[0].roomCode).toBe('');
    },
  );
  it('keeps incompatible public queues separate and waits for all four deduction players', async () => {
    const app = await setup();
    const group = [];
    for (let i = 0; i < 8; i++) group.push(await client(app, i));
    group[0].send({ type: 'queue', gameId: 'asphalt-rivals', mode: 'arcade' });
    group[1].send({ type: 'queue', gameId: 'corner-pocket', mode: 'arcade' });
    await group[0].wait('queued');
    await group[1].wait('queued');
    expect(app.manager.rooms.size).toBe(0);
    group[2].send({ type: 'queue', gameId: 'asphalt-rivals', mode: 'arcade' });
    const race = await group[0].wait('room', (m) => m.room.status === 'playing');
    expect(race.room.gameId).toBe('asphalt-rivals');
    expect(group[1].messages.some((m) => m.type === 'room')).toBe(false);
    group[3].send({ type: 'queue', gameId: 'corner-pocket', mode: 'arcade' });
    expect((await group[1].wait('room', (m) => m.room.status === 'playing')).room.gameId).toBe(
      'corner-pocket',
    );
    for (const member of group.slice(4, 7)) {
      member.send({ type: 'queue', gameId: 'hidden-signal', mode: 'arcade' });
      await member.wait('queued');
    }
    expect(group[4].messages.some((m) => m.type === 'room')).toBe(false);
    group[7].send({ type: 'queue', gameId: 'hidden-signal', mode: 'arcade' });
    const deduction = await group[4].wait('room', (m) => m.room.status === 'playing');
    expect(deduction.room.players).toHaveLength(4);
    const secrets = await Promise.all(group.slice(4).map((member) => member.wait('secret')));
    expect(secrets.every((secret) => secret.text.length > 0)).toBe(true);
    expect(deduction.room.match?.info).not.toHaveProperty('roles');
  });
  it('filters history and rankings by game without mixing unrelated scores', async () => {
    const app = await setup();
    const base = `http://127.0.0.1:${app.port}`;
    const player = {
      id: '00000000-0000-0000-0000-000000000000',
      name: 'Guest',
      score: 2,
      deaths: 0,
    };
    app.manager.history.push({
      id: 'race',
      gameId: 'asphalt-rivals',
      roomCode: 'SECRET',
      endedAt: 1,
      players: [player],
      winnerIds: [player.id],
    });
    app.manager.history.push({
      id: 'pool',
      gameId: 'corner-pocket',
      roomCode: 'SECRET',
      endedAt: 2,
      players: [{ ...player, score: 99 }],
      winnerIds: [player.id],
    });
    const board = await (await fetch(`${base}/api/leaderboard?gameId=asphalt-rivals`)).json();
    expect(board.entries).toHaveLength(1);
    expect(board.entries[0].kills).toBe(2);
    expect(board.entries[0].matches).toBe(1);
    const history = await (
      await fetch(`${base}/api/history?gameId=corner-pocket&playerId=${player.id}`)
    ).json();
    expect(history.matches.map((match: { id: string }) => match.id)).toEqual(['pool']);
    expect(history.matches[0].roomCode).toBe('');
    expect((await fetch(`${base}/api/history?gameId=unknown`)).status).toBe(400);
    expect((await fetch(`${base}/api/leaderboard?gameId=unknown`)).status).toBe(400);
  });
  it.each(['paddle-pulse', 'vector-patrol'])(
    'ends %s when a participant explicitly leaves without giving co-op a free win',
    async (gameId) => {
      const app = await setup();
      const host = await client(app, 0),
        guest = await client(app, 1);
      host.send({ type: 'create', gameId, capacity: 2 });
      const created = await host.wait('room');
      guest.send({ type: 'join', code: created.room.code });
      await guest.wait('room');
      host.send({ type: 'ready', ready: true });
      guest.send({ type: 'ready', ready: true });
      await host.wait(
        'room',
        (m) => m.room.players.length === 2 && m.room.players.every((p) => p.ready),
      );
      host.send({ type: 'start' });
      await guest.wait('room', (m) => m.room.status === 'playing');
      guest.send({ type: 'leave' });
      await guest.wait('left');
      const result = await host.wait('finished');
      expect(result.record.players).toHaveLength(2);
      expect(result.record.winnerIds).toEqual(
        gameId === 'vector-patrol' ? [] : [host.welcome.playerId],
      );
    },
  );
  it('enforces each game capacity and minimum ready count', async () => {
    const app = await setup();
    const host = await client(app, 0);
    host.send({ type: 'create', gameId: 'corner-pocket', capacity: 8 });
    expect((await host.wait('error')).code).toBe('CAPACITY');
    host.send({ type: 'create', gameId: 'hidden-signal', capacity: 4 });
    await host.wait('room');
    host.send({ type: 'ready', ready: true });
    host.send({ type: 'start' });
    expect((await host.wait('error', (m) => m.code === 'NOT_READY')).message).toContain('4');
  });
});
