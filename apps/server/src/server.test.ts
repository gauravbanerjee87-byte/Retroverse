import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { createConnection } from 'node:net';
import type { ClientMessage, ServerMessage } from '@retroverse/shared';
import { createGameServer } from './server';

const apps: ReturnType<typeof createGameServer>[] = [];
const sockets: WebSocket[] = [];
afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.terminate();
  for (const app of apps.splice(0)) await app.close();
});
async function setup(options: Parameters<typeof createGameServer>[0] = {}) {
  const app = createGameServer({ port: 0, silent: true, ...options });
  apps.push(app);
  await app.listen();
  return app;
}
async function connect(
  app: ReturnType<typeof createGameServer>,
  name = 'Player One',
  token?: string,
) {
  const ws = new WebSocket(`ws://127.0.0.1:${app.port}/ws`);
  sockets.push(ws);
  const pending: {
    predicate: (message: ServerMessage) => boolean;
    resolve: (message: ServerMessage) => void;
  }[] = [];
  const inbox: ServerMessage[] = [];
  ws.on('message', (raw) => {
    const message = JSON.parse(raw.toString()) as ServerMessage;
    const index = pending.findIndex((w) => w.predicate(message));
    if (index >= 0) pending.splice(index, 1)[0].resolve(message);
    else inbox.push(message);
  });
  const wait = <T extends ServerMessage['type']>(
    type: T,
    predicate: (message: Extract<ServerMessage, { type: T }>) => boolean = () => true,
  ): Promise<Extract<ServerMessage, { type: T }>> => {
    const check = (m: ServerMessage) =>
      m.type === type && predicate(m as Extract<ServerMessage, { type: T }>);
    const index = inbox.findIndex(check);
    if (index >= 0)
      return Promise.resolve(inbox.splice(index, 1)[0] as Extract<ServerMessage, { type: T }>);
    return new Promise((resolveWait, reject) => {
      const entry = {
        predicate: check,
        resolve: (m: ServerMessage) => {
          clearTimeout(timer);
          resolveWait(m as Extract<ServerMessage, { type: T }>);
        },
      };
      const timer = setTimeout(() => {
        const at = pending.indexOf(entry);
        if (at >= 0) pending.splice(at, 1);
        reject(new Error(`Timed out waiting for ${type}`));
      }, 5000);
      pending.push(entry);
    });
  };
  await new Promise<void>((r, j) => {
    ws.once('open', r);
    ws.once('error', j);
  });
  const send = (message: ClientMessage) => ws.send(JSON.stringify(message));
  send({ type: 'hello', version: 1, name, ...(token ? { token } : {}) });
  const welcome = await wait('welcome');
  return { ws, wait, send, welcome, inbox };
}
async function privateMatch(app: ReturnType<typeof createGameServer>) {
  const a = await connect(app);
  const b = await connect(app, 'Player Two');
  a.send({ type: 'create', capacity: 2 });
  const first = await a.wait('room');
  b.send({ type: 'join', code: first.room.code });
  await b.wait('room');
  a.send({ type: 'ready', ready: true });
  b.send({ type: 'ready', ready: true });
  await a.wait('room', (m) => m.room.players.length === 2 && m.room.players.every((p) => p.ready));
  a.send({ type: 'start' });
  await a.wait('room', (m) => m.room.status === 'playing');
  await b.wait('room', (m) => m.room.status === 'playing');
  return { a, b, code: first.room.code };
}
describe('real WebSocket server', () => {
  it('serves health, metrics and empty session history', async () => {
    const app = await setup();
    const base = `http://127.0.0.1:${app.port}`;
    expect(await (await fetch(`${base}/api/health`)).json()).toEqual({ status: 'ok', protocol: 1 });
    expect(await (await fetch(`${base}/api/stats`)).json()).toEqual({
      onlinePlayers: 0,
      rooms: 0,
      queuedPlayers: 0,
    });
    expect(await (await fetch(`${base}/api/leaderboard`)).json()).toEqual({ entries: [] });
    expect((await fetch(`${base}/api/history?playerId=bad`)).status).toBe(400);
  });
  it('enforces membership, capacity, readiness and host authorization', async () => {
    const app = await setup();
    const a = await connect(app);
    const b = await connect(app, 'Player Two');
    const c = await connect(app, 'Player Three');
    b.send({ type: 'join', code: '000000000000' });
    expect((await b.wait('error')).code).toBe('ROOM_NOT_FOUND');
    b.send({ type: 'start' });
    expect((await b.wait('error')).code).toBe('NOT_IN_ROOM');
    a.send({ type: 'create', capacity: 2 });
    const { room } = await a.wait('room');
    b.send({ type: 'join', code: room.code });
    await b.wait('room');
    c.send({ type: 'join', code: room.code });
    expect((await c.wait('error')).code).toBe('ROOM_FULL');
    b.send({ type: 'start' });
    expect((await b.wait('error')).code).toBe('HOST_ONLY');
    a.send({ type: 'start' });
    expect((await a.wait('error')).code).toBe('NOT_READY');
    a.send({ type: 'leave' });
    await a.wait('left');
    const migrated = await b.wait('room', (m) => m.room.players.length === 1);
    expect(migrated.room.hostId).toBe(b.welcome.playerId);
    b.send({ type: 'leave' });
    await b.wait('left');
    expect(app.manager.rooms.size).toBe(0);
  });
  it('runs authoritative movement, projectiles, damage, scoring, completion and rematch', async () => {
    const app = await setup({ matchSeconds: 2.1 });
    const { a, b, code } = await privateMatch(app);
    // Place both test participants in a clear lane; all actions and damage still go through real sockets/simulation.
    const arena = app.manager.rooms.get(code)!.arena!;
    const p = arena.state.players.find((p) => p.id === a.welcome.playerId)!;
    const q = arena.state.players.find((p) => p.id === b.welcome.playerId)!;
    p.x = 100;
    p.y = 100;
    q.x = 250;
    q.y = 100;
    let seq = 0;
    const move = { up: false, down: false, left: false, right: true, angle: 0, fire: false };
    a.send({ type: 'input', input: { seq: seq++, ...move } });
    const moved = await a.wait('state', (m) =>
      m.state.players.some((p) => p.id === a.welcome.playerId && p.x > 100),
    );
    expect(moved.state.players.find((p) => p.id === a.welcome.playerId)!.x).toBeLessThan(125);
    a.send({ type: 'input', input: { seq: 0, ...move, left: true, right: false } }); // stale input cannot rewind direction/ack.
    const timer = setInterval(
      () => a.send({ type: 'input', input: { seq: seq++, ...move, right: false, fire: true } }),
      80,
    );
    try {
      const damaged = await b.wait('state', (m) =>
        m.state.players.some((p) => p.id === b.welcome.playerId && p.health < 100),
      );
      expect(damaged.state.players.find((p) => p.id === b.welcome.playerId)!.health).toBeLessThan(
        100,
      );
      const scored = await a.wait('state', (m) =>
        m.state.players.some((p) => p.id === a.welcome.playerId && p.score === 1),
      );
      expect(scored.state.kills).toHaveLength(1);
    } finally {
      clearInterval(timer);
    }
    const result = await a.wait('finished');
    expect(result.record.winnerIds).toContain(a.welcome.playerId);
    expect(result.record.players.find((p) => p.id === a.welcome.playerId)!.score).toBe(1);
    expect(
      (
        await (
          await fetch(`http://127.0.0.1:${app.port}/api/history?playerId=${a.welcome.playerId}`)
        ).json()
      ).matches,
    ).toHaveLength(1);
    const publicHistory = await (await fetch(`http://127.0.0.1:${app.port}/api/history`)).json();
    expect(publicHistory.matches[0].roomCode).toBe('');
    a.send({ type: 'rematch' });
    const reset = await a.wait('room', (m) => m.room.status === 'waiting' && m.room.match === null);
    expect(reset.room.players.every((p) => !p.ready)).toBe(true);
  });
  it('pairs queued players once, rejects duplicates, and supports cancellation/disconnect', async () => {
    const app = await setup();
    const a = await connect(app);
    const b = await connect(app, 'Player Two');
    const queue = { type: 'queue', gameId: 'neon-arena', mode: 'deathmatch' } as const;
    a.send(queue);
    await a.wait('queued');
    a.send(queue);
    expect((await a.wait('error')).code).toBe('ALREADY_QUEUED');
    a.send({ type: 'cancel_queue' });
    await a.wait('queue_cancelled');
    expect(app.manager.queue).toHaveLength(0);
    a.send(queue);
    await a.wait('queued');
    b.send(queue);
    const one = await a.wait('room', (m) => m.room.status === 'playing');
    const two = await b.wait('room', (m) => m.room.status === 'playing');
    expect(one.room.code).toBe(two.room.code);
    expect(app.manager.queue).toHaveLength(0);
    expect(app.manager.rooms.size).toBe(1);
  });
  it('resumes a disconnected identity and expires abandoned room membership', async () => {
    const app = await setup({ disconnectGraceMs: 40 });
    const a = await connect(app);
    a.send({ type: 'create', capacity: 2 });
    const initial = await a.wait('room');
    a.ws.terminate();
    await new Promise((r) => setTimeout(r, 10));
    const resumed = await connect(app, 'Player One', a.welcome.token);
    expect(resumed.welcome.resumed).toBe(true);
    expect(resumed.welcome.playerId).toBe(a.welcome.playerId);
    expect((await resumed.wait('room')).room.code).toBe(initial.room.code);
    resumed.ws.terminate();
    await new Promise((r) => setTimeout(r, 60));
    app.manager.cleanup();
    expect(app.manager.rooms.size).toBe(0);
  });
  it('rejects malformed and binary payloads without mutating state and rejects origins', async () => {
    const app = await setup();
    const a = await connect(app);
    a.ws.send('{');
    expect((await a.wait('error')).code).toBe('INVALID_MESSAGE');
    a.ws.send(Buffer.from('hello'));
    expect((await a.wait('error')).code).toBe('INVALID_MESSAGE');
    expect(app.manager.rooms.size).toBe(0);
    const bad = new WebSocket(`ws://127.0.0.1:${app.port}/ws`, { origin: 'https://evil.invalid' });
    sockets.push(bad);
    const message = await new Promise<string>((resolve) =>
      bad.once('error', (e) => resolve(e.message)),
    );
    expect(message).toContain('403');
  });
  it('closes clients on graceful shutdown', async () => {
    const app = await setup();
    const a = await connect(app);
    const closed = new Promise<number>((resolve) => a.ws.once('close', (code) => resolve(code)));
    await app.close();
    expect(await closed).toBe(1001);
  });
  it('does not consume connection capacity on bad upgrades and enforces the active connection cap', async () => {
    const app = await setup({ maxConnectionsPerIp: 1 });
    for (let i = 0; i < 3; i++) {
      const response = await new Promise<string>((resolve) => {
        const socket = createConnection(app.port, '127.0.0.1', () =>
          socket.write(
            'GET /ws HTTP/1.1\r\nHost: localhost\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: bad\r\n\r\n',
          ),
        );
        let data = '';
        socket.on('data', (chunk) => (data += chunk));
        socket.on('close', () => resolve(data));
      });
      expect(response).toContain('400');
    }
    const a = await connect(app);
    const refused = new WebSocket(`ws://127.0.0.1:${app.port}/ws`);
    sockets.push(refused);
    const error = await new Promise<string>((resolve) =>
      refused.once('error', (e) => resolve(e.message)),
    );
    expect(error).toContain('429');
    a.ws.terminate();
    await new Promise((r) => setTimeout(r, 20));
    const b = await connect(app, 'Player Two');
    expect(b.welcome.playerId).toBeTruthy();
  });
  it('closes oversized payloads and rate limits control messages', async () => {
    const app = await setup();
    const a = await connect(app);
    const closed = new Promise<number>((resolve) => a.ws.once('close', (code) => resolve(code)));
    a.ws.send('x'.repeat(5000));
    expect(await closed).toBe(1009);
    const b = await connect(app, 'Player Two');
    for (let i = 0; i < 20; i++) b.send({ type: 'ping', at: i });
    expect((await b.wait('error', (m) => m.code === 'RATE_LIMITED')).message).toContain(
      'Slow down',
    );
  });
  it('expires idle rooms and disconnected sessions and rejects joining active matches', async () => {
    const app = await setup({ roomTtlMs: 20, sessionTtlMs: 20, disconnectGraceMs: 10 });
    const a = await connect(app);
    a.send({ type: 'create', capacity: 2 });
    await a.wait('room');
    app.manager.cleanup(Date.now() + 100);
    await a.wait('left');
    expect(app.manager.rooms.size).toBe(0);
    a.ws.terminate();
    await new Promise((r) => setTimeout(r, 10));
    app.manager.cleanup(Date.now() + 100);
    expect(app.manager.sessions.size).toBe(0);
    const active = await privateMatch(app);
    const c = await connect(app, 'Player Three');
    c.send({ type: 'join', code: active.code });
    expect((await c.wait('error')).code).toBe('ROOM_STARTED');
  });
  it('revokes the prior socket when a guest resumes on another connection', async () => {
    const app = await setup();
    const a = await connect(app);
    const closed = new Promise<number>((resolve) => a.ws.once('close', (code) => resolve(code)));
    const b = await connect(app, 'Player Renamed', a.welcome.token);
    expect(await closed).toBe(4001);
    expect(b.welcome.playerId).toBe(a.welcome.playerId);
    expect(b.welcome.name).toBe('Player Renamed');
    b.send({ type: 'create', capacity: 2 });
    expect((await b.wait('room')).room.players).toHaveLength(1);
  });
});
