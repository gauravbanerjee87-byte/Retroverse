import {
  PROTOCOL_VERSION,
  type ClientMessage,
  type MatchState,
  type RoomView,
  type ServerMessage,
} from '@retroverse/shared';
export interface ConnectionView {
  status: 'connecting' | 'connected' | 'reconnecting' | 'offline';
  playerId: string;
  name: string;
  room: RoomView | null;
  queued: number | null;
  error: string | null;
  latency: number | null;
  hud: MatchState | null;
  secret: string | null;
}
export function recentGames(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem('retroverse.recent') || '[]');
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}
const initialName =
  localStorage.getItem('retroverse.name') || `Player-${Math.floor(Math.random() * 900 + 100)}`;
class Network {
  socket: WebSocket | null = null;
  state: MatchState | null = null;
  view: ConnectionView = {
    status: 'connecting',
    playerId: '',
    name: initialName,
    room: null,
    queued: null,
    error: null,
    latency: null,
    hud: null,
    secret: null,
  };
  listeners = new Set<() => void>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private attempts = 0;
  private lastHud = 0;
  private seq = 0;
  private welcomed = false;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  snapshot = () => this.view;
  private publish(update: Partial<ConnectionView>) {
    this.view = { ...this.view, ...update };
    this.listeners.forEach((fn) => fn());
  }
  clearError() {
    this.publish({ error: null });
  }
  connect = () => {
    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)
    )
      return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.publish({ status: this.attempts ? 'reconnecting' : 'connecting' });
    const endpoint = new URL('/ws', window.location.href);
    endpoint.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(endpoint);
    this.socket = ws;
    this.welcomed = false;
    ws.onopen = () => {
      const token = sessionStorage.getItem('retroverse.token');
      ws.send(
        JSON.stringify({
          type: 'hello',
          version: PROTOCOL_VERSION,
          name: this.view.name,
          ...(token ? { token } : {}),
        }),
      );
      this.heartbeat = setInterval(() => this.send({ type: 'ping', at: Date.now() }), 10000);
    };
    ws.onmessage = (event) => {
      let message: ServerMessage;
      try {
        message = JSON.parse(String(event.data)) as ServerMessage;
      } catch {
        this.publish({ error: 'The server sent an unreadable response.' });
        return;
      }
      switch (message.type) {
        case 'welcome':
          this.welcomed = true;
          this.attempts = 0;
          this.state = null;
          sessionStorage.setItem('retroverse.token', message.token);
          sessionStorage.setItem('retroverse.playerId', message.playerId);
          this.publish({
            status: 'connected',
            playerId: message.playerId,
            name: message.name,
            room: null,
            hud: null,
            queued: null,
            error: null,
            secret: null,
          });
          break;
        case 'room':
          this.state = message.room.match;
          this.publish({
            room: message.room,
            queued: null,
            hud: this.state,
            error: null,
            ...(message.room.status === 'waiting' ? { secret: null } : {}),
          });
          if (message.room.status === 'playing') {
            const recent = recentGames();
            const gameId = message.room.gameId || 'neon-arena';
            localStorage.setItem(
              'retroverse.recent',
              JSON.stringify([gameId, ...recent.filter((id) => id !== gameId)].slice(0, 25)),
            );
          }
          location.hash = '#/room';
          break;
        case 'secret':
          this.publish({ secret: message.text });
          break;
        case 'state':
          this.state = message.state;
          if (performance.now() - this.lastHud > 180) {
            this.lastHud = performance.now();
            this.publish({ hud: message.state });
          }
          break;
        case 'finished':
          this.state = message.room.match;
          this.publish({ room: message.room, hud: this.state });
          break;
        case 'left':
          this.state = null;
          this.publish({ room: null, hud: null, queued: null, secret: null });
          location.hash = '#/library';
          break;
        case 'queued':
          this.publish({ queued: message.position, error: null });
          if (!location.hash.startsWith('#/matchmaking')) location.hash = '#/matchmaking';
          break;
        case 'queue_cancelled':
          this.publish({ queued: null });
          break;
        case 'pong':
          this.publish({ latency: Math.max(0, Date.now() - message.at) });
          break;
        case 'error':
          if (message.code === 'INVALID_SESSION' || message.code === 'SESSION_EXPIRED')
            sessionStorage.removeItem('retroverse.token');
          this.publish({ error: message.message });
          break;
      }
    };
    ws.onerror = () =>
      this.publish({
        error: 'Connection unavailable. Check that the RetroVerse server is running.',
      });
    ws.onclose = (event) => {
      this.welcomed = false;
      if (this.heartbeat) clearInterval(this.heartbeat);
      if (event.code === 4001) {
        this.publish({
          status: 'offline',
          error:
            'This guest session is active in another tab. Use a fresh browser context for a second player.',
        });
        sessionStorage.removeItem('retroverse.token');
        return;
      }
      this.attempts++;
      this.publish({ status: this.attempts > 8 ? 'offline' : 'reconnecting' });
      if (this.attempts <= 8)
        this.reconnectTimer = setTimeout(
          this.connect,
          Math.min(8000, 500 * 2 ** (this.attempts - 1)),
        );
    };
  };
  send(message: ClientMessage) {
    if (this.socket?.readyState !== WebSocket.OPEN || !this.welcomed) {
      this.publish({ error: 'Wait for the server connection, then try again.' });
      return false;
    }
    this.socket.send(JSON.stringify(message));
    return true;
  }
  input(input: Omit<Extract<ClientMessage, { type: 'input' }>['input'], 'seq'>) {
    if (this.view.status !== 'connected') return;
    const acknowledged = this.state?.players.find((p) => p.id === this.view.playerId)?.lastSeq || 0;
    this.seq = Math.max(this.seq + 1, acknowledged + 1);
    this.send({ type: 'input', input: { ...input, seq: this.seq } });
  }
  setName(name: string) {
    localStorage.setItem('retroverse.name', name);
    this.publish({ name });
    this.socket?.close(1000, 'Updating display name');
  }
}
export const network = new Network();
