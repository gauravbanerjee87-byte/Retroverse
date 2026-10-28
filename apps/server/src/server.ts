import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import { ARENA, GAMES, parseClientMessage, PROTOCOL_VERSION } from '@retroverse/shared';
import { readConfig, type ServerConfig } from './config/index';
import { ProtocolError, RoomManager, type Session } from './rooms/manager';
import { TokenBucket } from './security/limits';

const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};
export function createGameServer(overrides: Partial<ServerConfig> = {}) {
  const config = { ...readConfig(), ...overrides };
  if (!overrides.staticDir)
    config.staticDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../web/dist');
  const manager = new RoomManager(config);
  const log = (event: string, data: Record<string, unknown> = {}) => {
    if (!config.silent)
      console.log(JSON.stringify({ time: new Date().toISOString(), event, ...data }));
  };
  let closing = false;
  const httpServer = createServer((req, res) => {
    void handleHttp(req, res).catch(() => {
      if (!res.headersSent) json(res, 500, { error: 'Internal server error' });
      else res.end();
    });
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096, perMessageDeflate: false });
  const ipCounts = new Map<string, number>();
  const live = new WeakSet<WebSocket>();
  const httpLimits = new Map<string, { bucket: TokenBucket; at: number }>();
  const headers = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'Content-Security-Policy':
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:; media-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    'X-Frame-Options': 'DENY',
    ...(config.production
      ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' }
      : {}),
  };
  function json(res: ServerResponse, status: number, body: unknown) {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify(body));
  }
  async function handleHttp(req: IncomingMessage, res: ServerResponse) {
    for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
    if (req.headers.origin && config.origins.includes(req.headers.origin))
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
    res.setHeader('Vary', 'Origin');
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      json(res, 405, { error: 'Method not allowed' });
      return;
    }
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      const ip = req.socket.remoteAddress ?? 'unknown';
      let entry = httpLimits.get(ip);
      if (!entry) {
        if (httpLimits.size > 2000) {
          json(res, 503, { error: 'Server busy' });
          return;
        }
        entry = { bucket: new TokenBucket(10, 30), at: Date.now() };
        httpLimits.set(ip, entry);
      }
      entry.at = Date.now();
      if (!entry.bucket.take()) {
        json(res, 429, { error: 'Too many requests' });
        return;
      }
      if (url.pathname === '/api/health') {
        json(res, closing ? 503 : 200, {
          status: closing ? 'stopping' : 'ok',
          protocol: PROTOCOL_VERSION,
        });
        return;
      }
      if (url.pathname === '/api/stats') {
        json(res, 200, {
          onlinePlayers: [...manager.sessions.values()].filter((s) => s.socket).length,
          rooms: manager.rooms.size,
          queuedPlayers: manager.queue.length,
        });
        return;
      }
      const gameId = url.searchParams.get('gameId');
      if (
        (url.pathname === '/api/leaderboard' || url.pathname === '/api/history') &&
        gameId !== null &&
        !GAMES.some((game) => game.id === gameId)
      ) {
        json(res, 400, { error: 'Invalid game identifier' });
        return;
      }
      if (url.pathname === '/api/leaderboard') {
        json(res, 200, { entries: manager.leaderboard(gameId ?? undefined) });
        return;
      }
      if (url.pathname === '/api/history') {
        const id = url.searchParams.get('playerId');
        if (id && !/^[a-f0-9-]{36}$/.test(id)) {
          json(res, 400, { error: 'Invalid player identifier' });
          return;
        }
        json(res, 200, {
          matches: manager.history
            .filter(
              (m) =>
                (!gameId || m.gameId === gameId) && (!id || m.players.some((p) => p.id === id)),
            )
            .slice(0, 50)
            .map((m) => ({ ...m, roomCode: '' })),
        });
        return;
      }
      json(res, 404, { error: 'Unknown endpoint' });
      return;
    }
    let pathname: string;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      json(res, 400, { error: 'Invalid path' });
      return;
    }
    const root = resolve(config.staticDir);
    let path = resolve(root, '.' + pathname);
    if (!path.startsWith(root + sep) && path !== root) {
      json(res, 403, { error: 'Forbidden' });
      return;
    }
    if (pathname.split('/').some((part) => part.startsWith('.'))) {
      json(res, 403, { error: 'Forbidden' });
      return;
    }
    try {
      if ((await stat(path)).isDirectory()) path = resolve(path, 'index.html');
      await stat(path);
    } catch {
      if (extname(pathname)) {
        json(res, 404, { error: 'Not found' });
        return;
      }
      path = resolve(root, 'index.html');
    }
    try {
      const contents = await readFile(path);
      res.writeHead(200, {
        'Content-Type': mime[extname(path)] ?? 'application/octet-stream',
        'Cache-Control': pathname.startsWith('/assets/')
          ? 'public,max-age=31536000,immutable'
          : 'no-cache',
      });
      res.end(req.method === 'HEAD' ? undefined : contents);
    } catch {
      json(res, 404, {
        error: 'Frontend not built. Run npm run build or use the Vite development server.',
      });
    }
  }
  httpServer.on('upgrade', (req, socket, head) => {
    const reject = (code: number) => {
      socket.end(`HTTP/1.1 ${code} Rejected\r\nConnection: close\r\n\r\n`);
    };
    if (closing) {
      reject(503);
      return;
    }
    if (req.url !== '/ws') {
      reject(404);
      return;
    }
    const origin = req.headers.origin;
    if ((config.production && !origin) || (origin && !config.origins.includes(origin))) {
      reject(403);
      return;
    }
    const ip = req.socket.remoteAddress ?? 'unknown';
    if (
      wss.clients.size >= config.maxConnections ||
      (ipCounts.get(ip) ?? 0) >= config.maxConnectionsPerIp
    ) {
      reject(429);
      return;
    }
    try {
      wss.handleUpgrade(req, socket, head, (ws) => {
        ipCounts.set(ip, (ipCounts.get(ip) ?? 0) + 1);
        wss.emit('connection', ws, req);
      });
    } catch {
      socket.destroy();
    }
  });
  wss.on('connection', (socket, req) => {
    const ip = req.socket.remoteAddress ?? 'unknown';
    const total = new TokenBucket(60, 120),
      input = new TokenBucket(35, 50),
      control = new TokenBucket(8, 16);
    let session: Session | undefined;
    let strikes = 0;
    live.add(socket);
    const helloDeadline = setTimeout(() => {
      if (!session) socket.close(4000, 'Session handshake timeout');
    }, 5000);
    const error = (code: string, message: string) => {
      if (socket.readyState === WebSocket.OPEN)
        socket.send(JSON.stringify({ type: 'error', code, message }));
    };
    socket.on('pong', () => live.add(socket));
    socket.on('error', () => {
      /* close event performs cleanup; never log payloads or tokens */
    });
    socket.on('message', (raw, isBinary) => {
      if (closing) return;
      if (!total.take()) {
        error('RATE_LIMITED', 'Too many messages.');
        socket.close(4008, 'Rate limit');
        return;
      }
      const parsed = !isBinary ? parseClientMessage(raw.toString()) : { success: false as const };
      if (!parsed.success) {
        error('INVALID_MESSAGE', 'Invalid message or protocol version.');
        if (++strikes >= 5) socket.close(4002, 'Invalid messages');
        return;
      }
      const message = parsed.data;
      if (!(message.type === 'input' ? input : control).take()) {
        error('RATE_LIMITED', 'Slow down and try again.');
        return;
      }
      try {
        if (message.type === 'hello') {
          if (session)
            throw new ProtocolError('ALREADY_AUTHENTICATED', 'Session is already initialized.');
          session = manager.authenticate(socket, message.name, message.token);
          clearTimeout(helloDeadline);
          return;
        }
        if (!session)
          throw new ProtocolError('HELLO_REQUIRED', 'Initialize your guest session first.');
        if (session.socket !== socket) {
          socket.close(4001, 'Session resumed elsewhere');
          return;
        }
        manager.dispatch(session, message);
      } catch (err) {
        if (err instanceof ProtocolError) error(err.code, err.message);
        else {
          log('request_error');
          error('INTERNAL_ERROR', 'Unable to process this request.');
        }
      }
    });
    socket.on('close', () => {
      clearTimeout(helloDeadline);
      ipCounts.set(ip, Math.max(0, (ipCounts.get(ip) ?? 1) - 1));
      if (ipCounts.get(ip) === 0) ipCounts.delete(ip);
      if (session) manager.disconnect(session, socket);
    });
  });
  let tick: ReturnType<typeof setInterval> | undefined;
  let cleanup: ReturnType<typeof setInterval> | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  return {
    manager,
    httpServer,
    wss,
    get port() {
      const address = httpServer.address();
      return typeof address === 'object' && address ? address.port : 0;
    },
    async listen(): Promise<number> {
      await new Promise<void>((resolveListen, reject) => {
        httpServer.once('error', reject);
        httpServer.listen(config.port, config.host, () => {
          httpServer.off('error', reject);
          resolveListen();
        });
      });
      tick = setInterval(() => manager.tick(), 1000 / ARENA.tickRate);
      cleanup = setInterval(() => {
        manager.cleanup();
        for (const [ip, entry] of httpLimits)
          if (Date.now() - entry.at > 60000) httpLimits.delete(ip);
      }, 1000);
      heartbeat = setInterval(() => {
        for (const socket of wss.clients) {
          if (!live.has(socket)) {
            socket.terminate();
            continue;
          }
          live.delete(socket);
          socket.ping();
        }
      }, 15000);
      const address = httpServer.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      log('server_listening', { port, host: config.host });
      return port;
    },
    async close(): Promise<void> {
      if (closing) return;
      closing = true;
      clearInterval(tick);
      clearInterval(cleanup);
      clearInterval(heartbeat);
      for (const socket of wss.clients) socket.close(1001, 'Server shutting down');
      const timeout = setTimeout(() => {
        for (const socket of wss.clients) socket.terminate();
      }, 500);
      await Promise.all([
        new Promise<void>((resolveClose) => wss.close(() => resolveClose())),
        new Promise<void>((resolveClose) => {
          httpServer.close(() => resolveClose());
          httpServer.closeIdleConnections();
        }),
      ]);
      clearTimeout(timeout);
      log('server_stopped');
    },
  };
}
