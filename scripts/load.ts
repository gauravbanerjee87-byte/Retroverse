/** Bounded local workload, not a production capacity benchmark. No external service needed. */
import { performance } from 'node:perf_hooks';
import { WebSocket } from 'ws';
import { createGameServer } from '../apps/server/src/server';
import { PROTOCOL_VERSION, type ClientMessage, type ServerMessage } from '@retroverse/shared';

type Received = { message: ServerMessage; at: number };
class LoadClient {
  readonly messages: Received[] = [];
  readonly socket: WebSocket;
  readonly pingTimes: number[] = [];
  stateCount = 0;
  bytes = 0;
  constructor(
    url: string,
    readonly index: number,
  ) {
    this.socket = new WebSocket(url);
    this.socket.on('message', (raw) => {
      this.bytes += Buffer.byteLength(raw.toString());
      const message = JSON.parse(raw.toString()) as ServerMessage;
      this.messages.push({ message, at: performance.now() });
      if (this.messages.length > 200) this.messages.shift();
      if (message.type === 'state') this.stateCount++;
      if (message.type === 'pong') this.pingTimes.push(Date.now() - message.at);
    });
  }
  send(message: ClientMessage) {
    this.socket.send(JSON.stringify(message));
  }
  async connect() {
    await new Promise<void>((resolve, reject) => {
      this.socket.once('open', resolve);
      this.socket.once('error', reject);
    });
    this.send({ type: 'hello', version: PROTOCOL_VERSION, name: `Load ${this.index}` });
    await this.wait((m) => m.type === 'welcome');
  }
  async wait(predicate: (message: ServerMessage) => boolean, since = 0) {
    const end = performance.now() + 5000;
    while (performance.now() < end) {
      const result = this.messages.find((entry) => entry.at >= since && predicate(entry.message));
      if (result) return result.message;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`Timed out waiting for client ${this.index}`);
  }
}

async function run(players: number) {
  const server = createGameServer({ port: 0, host: '127.0.0.1', matchSeconds: 20 });
  const clients: LoadClient[] = [];
  let timer: ReturnType<typeof setInterval> | undefined;
  try {
    const port = await server.listen();
    for (let index = 0; index < players; index++) {
      const client = new LoadClient(`ws://127.0.0.1:${port}/ws`, index);
      clients.push(client);
      await client.connect();
    }
    clients[0].send({ type: 'create', capacity: players });
    const created = await clients[0].wait((m) => m.type === 'room');
    if (created.type !== 'room') throw new Error('Expected room');
    for (const client of clients.slice(1)) {
      client.send({ type: 'join', code: created.room.code });
      await client.wait((m) => m.type === 'room');
    }
    const readyAt = performance.now();
    for (const client of clients) client.send({ type: 'ready', ready: true });
    await clients[0].wait(
      (m) =>
        m.type === 'room' &&
        m.room.players.length === players &&
        m.room.players.every((p) => p.ready),
      readyAt,
    );
    clients[0].send({ type: 'start' });
    await Promise.all(
      clients.map((c) => c.wait((m) => m.type === 'room' && m.room.status === 'playing')),
    );
    let seq = 0;
    const start = performance.now();
    const baseline = process.cpuUsage();
    timer = setInterval(() => {
      seq++;
      for (const client of clients) {
        client.send({
          type: 'input',
          input: {
            seq,
            up: seq % 100 < 25,
            right: seq % 100 >= 25 && seq % 100 < 50,
            down: seq % 100 >= 50 && seq % 100 < 75,
            left: seq % 100 >= 75,
            angle: Math.sin(seq / 20) * Math.PI,
            fire: true,
          },
        });
        if (seq % 25 === 0) client.send({ type: 'ping', at: Date.now() });
      }
    }, 40);
    await new Promise((resolve) => setTimeout(resolve, 4000));
    clearInterval(timer);
    timer = undefined;
    const elapsedMs = performance.now() - start;
    const cpu = process.cpuUsage(baseline);
    const errors = clients.flatMap((client) =>
      client.messages.filter((m) => m.message.type === 'error'),
    );
    if (errors.length) throw new Error(JSON.stringify(errors));
    if (clients.some((c) => c.stateCount < 30 || c.pingTimes.length === 0))
      throw new Error('Missing broadcasts or heartbeat replies under load');
    const rtts = clients.flatMap((c) => c.pingTimes).sort((a, b) => a - b);
    console.log(
      JSON.stringify({
        players,
        elapsedMs: Math.round(elapsedMs),
        inputMessages: seq * players,
        snapshotsPerClient: clients.map((c) => c.stateCount),
        receivedBytes: clients.reduce((sum, c) => sum + c.bytes, 0),
        pingRttP95Ms: rtts[Math.floor(rtts.length * 0.95)],
        cpuMs: Math.round((cpu.user + cpu.system) / 1000),
        rssMiB: Math.round(process.memoryUsage().rss / 1024 / 1024),
        errors: errors.length,
      }),
    );
  } finally {
    if (timer) clearInterval(timer);
    for (const client of clients) client.socket.terminate();
    await server.close();
  }
}
for (const count of [2, 4, 8]) await run(count);
