import { randomBytes, randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';
import type {
  ClientMessage,
  InputState,
  LeaderboardEntry,
  MatchRecord,
  RoomView,
  ServerMessage,
} from '@retroverse/shared';
import { PROTOCOL_VERSION } from '@retroverse/shared';
import { Arena } from '../games/arena';
import type { ServerConfig } from '../config/index';

export interface Session {
  id: string;
  token: string;
  name: string;
  socket?: WebSocket;
  roomCode?: string;
  disconnectedAt?: number;
  touchedAt: number;
}
interface Room {
  code: string;
  hostId: string;
  capacity: number;
  visibility: 'private' | 'public';
  status: RoomView['status'];
  members: Map<string, boolean>;
  arena: Arena | null;
  departed: MatchRecord['players'];
  createdAt: number;
  lastActivity: number;
}
export const generateRoomCode = (): string => randomBytes(6).toString('hex').toUpperCase();
export class ProtocolError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export class RoomManager {
  readonly sessions = new Map<string, Session>();
  readonly rooms = new Map<string, Room>();
  readonly queue: string[] = [];
  readonly history: MatchRecord[] = [];
  constructor(readonly config: ServerConfig) {}
  send(session: Session, message: ServerMessage) {
    if (session.socket?.readyState === WebSocket.OPEN) {
      if (session.socket.bufferedAmount > 262144) {
        session.socket.terminate();
        return;
      }
      session.socket.send(JSON.stringify(message));
    }
  }
  authenticate(socket: WebSocket, name: string, token?: string): Session {
    const now = Date.now();
    let session = token ? this.sessions.get(token) : undefined;
    const resumed = !!session;
    if (!session) {
      if (this.sessions.size >= this.config.maxSessions)
        throw new ProtocolError('SERVER_BUSY', 'Guest capacity reached. Try again later.');
      session = { id: randomUUID(), token: randomBytes(32).toString('hex'), name, touchedAt: now };
      this.sessions.set(session.token, session);
    }
    const oldSocket = session.socket;
    session.socket = socket;
    session.name = name;
    session.touchedAt = now;
    session.disconnectedAt = undefined;
    if (oldSocket && oldSocket !== socket) oldSocket.close(4001, 'Session resumed elsewhere');
    this.send(session, {
      type: 'welcome',
      version: PROTOCOL_VERSION,
      playerId: session.id,
      token: session.token,
      name: session.name,
      resumed,
    });
    if (session.roomCode) {
      const room = this.rooms.get(session.roomCode);
      if (room) this.broadcastRoom(room);
      else session.roomCode = undefined;
    }
    return session;
  }
  dispatch(session: Session, message: Exclude<ClientMessage, { type: 'hello' }>) {
    session.touchedAt = Date.now();
    switch (message.type) {
      case 'create':
        this.create(session, message.capacity);
        return;
      case 'join':
        this.join(session, message.code);
        return;
      case 'leave':
        this.leave(session);
        this.send(session, { type: 'left' });
        return;
      case 'queue':
        this.enqueue(session);
        return;
      case 'cancel_queue':
        this.cancelQueue(session);
        this.send(session, { type: 'queue_cancelled' });
        return;
      case 'ping':
        this.send(session, { type: 'pong', at: message.at, serverTime: Date.now() });
        return;
      case 'input':
        this.input(session, message.input);
        return;
      case 'ready': {
        const room = this.memberRoom(session);
        if (room.status !== 'waiting')
          throw new ProtocolError('ROOM_STATE', 'Ready status can only change in the lobby.');
        room.members.set(session.id, message.ready);
        room.lastActivity = Date.now();
        this.broadcastRoom(room);
        return;
      }
      case 'start': {
        const room = this.memberRoom(session);
        this.requireHost(room, session);
        if (room.status !== 'waiting')
          throw new ProtocolError('ROOM_STATE', 'This room is not waiting.');
        const members = this.members(room);
        if (members.length < 2 || members.some((s) => !s.socket || !room.members.get(s.id)))
          throw new ProtocolError('NOT_READY', 'At least two connected players must all be ready.');
        this.start(room);
        return;
      }
      case 'rematch': {
        const room = this.memberRoom(session);
        this.requireHost(room, session);
        if (room.status !== 'finished')
          throw new ProtocolError('ROOM_STATE', 'Finish the current match first.');
        room.status = 'waiting';
        room.arena = null;
        room.lastActivity = Date.now();
        for (const id of room.members.keys()) room.members.set(id, false);
        this.broadcastRoom(room);
        return;
      }
    }
  }
  private assertAvailable(session: Session) {
    if (session.roomCode)
      throw new ProtocolError('ALREADY_IN_ROOM', 'Leave your current room first.');
    if (this.queue.includes(session.id))
      throw new ProtocolError('ALREADY_QUEUED', 'Cancel matchmaking before joining a room.');
  }
  create(session: Session, capacity: number, visibility: 'private' | 'public' = 'private'): Room {
    this.assertAvailable(session);
    if (this.rooms.size >= this.config.maxRooms)
      throw new ProtocolError('SERVER_BUSY', 'Room capacity reached. Try again later.');
    let code = generateRoomCode();
    while (this.rooms.has(code)) code = generateRoomCode();
    const room: Room = {
      code,
      hostId: session.id,
      capacity,
      visibility,
      status: 'waiting',
      members: new Map([[session.id, false]]),
      arena: null,
      departed: [],
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };
    this.rooms.set(code, room);
    session.roomCode = code;
    this.broadcastRoom(room);
    return room;
  }
  join(session: Session, code: string) {
    this.assertAvailable(session);
    const room = this.rooms.get(code);
    if (!room) throw new ProtocolError('ROOM_NOT_FOUND', 'Room not found or expired.');
    if (room.status !== 'waiting')
      throw new ProtocolError('ROOM_STARTED', 'This match has already started.');
    if (room.members.size >= room.capacity)
      throw new ProtocolError('ROOM_FULL', 'This room is full.');
    room.members.set(session.id, false);
    session.roomCode = code;
    room.lastActivity = Date.now();
    this.broadcastRoom(room);
  }
  private start(room: Room) {
    room.status = 'playing';
    room.lastActivity = Date.now();
    room.departed = [];
    room.arena = new Arena(
      this.members(room).map(({ id, name }) => ({ id, name })),
      Date.now(),
      this.config.matchSeconds * 1000,
    );
    this.broadcastRoom(room);
  }
  enqueue(session: Session) {
    this.assertAvailable(session);
    if (this.queue.length >= 200)
      throw new ProtocolError('QUEUE_FULL', 'Matchmaking is busy. Try again later.');
    if (this.rooms.size >= this.config.maxRooms)
      throw new ProtocolError('SERVER_BUSY', 'Room capacity reached. Try again later.');
    this.queue.push(session.id);
    this.send(session, { type: 'queued', position: this.queue.length });
    this.matchQueue();
  }
  private matchQueue() {
    while (this.queue.length >= 2 && this.rooms.size < this.config.maxRooms) {
      const ids = this.queue.splice(0, 2);
      const pair = ids
        .map((id) => this.byId(id))
        .filter((s): s is Session => !!s?.socket && !s.roomCode);
      if (pair.length !== 2) {
        for (const s of pair) this.queue.unshift(s.id);
        continue;
      }
      const room = this.create(pair[0], 2, 'public');
      this.join(pair[1], room.code);
      for (const id of room.members.keys()) room.members.set(id, true);
      this.start(room);
    }
    this.queue.forEach((id, i) => {
      const s = this.byId(id);
      if (s) this.send(s, { type: 'queued', position: i + 1 });
    });
  }
  cancelQueue(session: Session) {
    const at = this.queue.indexOf(session.id);
    if (at >= 0) this.queue.splice(at, 1);
  }
  private input(session: Session, input: InputState) {
    const room = this.memberRoom(session);
    if (room.status !== 'playing' || !room.arena)
      throw new ProtocolError('NO_MATCH', 'No active match.');
    room.arena.input(session.id, input);
  }
  private memberRoom(session: Session): Room {
    const room = session.roomCode ? this.rooms.get(session.roomCode) : undefined;
    if (!room || !room.members.has(session.id))
      throw new ProtocolError('NOT_IN_ROOM', 'Join a room first.');
    return room;
  }
  private requireHost(room: Room, session: Session) {
    if (room.hostId !== session.id)
      throw new ProtocolError('HOST_ONLY', 'Only the host can do that.');
  }
  leave(session: Session) {
    this.cancelQueue(session);
    const room = session.roomCode ? this.rooms.get(session.roomCode) : undefined;
    session.roomCode = undefined;
    if (!room) return;
    if (room.status === 'playing') {
      const player = room.arena?.state.players.find((p) => p.id === session.id);
      if (player)
        room.departed.push({
          id: player.id,
          name: player.name,
          score: player.score,
          deaths: player.deaths,
        });
    }
    room.members.delete(session.id);
    room.arena?.removePlayer(session.id);
    room.lastActivity = Date.now();
    if (!room.members.size) {
      this.rooms.delete(room.code);
      return;
    }
    if (room.hostId === session.id)
      room.hostId = this.members(room).find((s) => s.socket)?.id ?? [...room.members.keys()][0];
    this.broadcastRoom(room);
  }
  disconnect(session: Session, socket: WebSocket) {
    if (session.socket !== socket) return;
    session.socket = undefined;
    session.disconnectedAt = Date.now();
    session.touchedAt = Date.now();
    this.cancelQueue(session);
    const room = session.roomCode ? this.rooms.get(session.roomCode) : undefined;
    if (room) {
      room.arena?.clearInput(session.id);
      if (room.status === 'waiting') room.members.set(session.id, false);
      this.broadcastRoom(room);
    }
  }
  tick(now = Date.now()) {
    for (const room of this.rooms.values()) {
      if (room.status !== 'playing' || !room.arena) continue;
      if (room.arena.step(now)) this.finish(room, now);
      else if (room.arena.state.tick % 2 === 0)
        this.broadcast(room, { type: 'state', state: room.arena.state });
    }
  }
  cleanup(now = Date.now()) {
    for (const [token, s] of this.sessions) {
      if (!s.socket && s.disconnectedAt && now - s.disconnectedAt >= this.config.disconnectGraceMs)
        this.leave(s);
      if (!s.socket && now - s.touchedAt >= this.config.sessionTtlMs) {
        this.leave(s);
        this.sessions.delete(token);
      }
    }
    for (const room of this.rooms.values()) {
      if (room.status !== 'playing' && now - room.lastActivity > this.config.roomTtlMs) {
        for (const s of this.members(room)) {
          s.roomCode = undefined;
          this.send(s, { type: 'left' });
        }
        this.rooms.delete(room.code);
      }
    }
    this.matchQueue();
  }
  private finish(room: Room, now: number) {
    const state = room.arena!.state;
    room.status = 'finished';
    room.lastActivity = now;
    const record: MatchRecord = {
      id: randomUUID(),
      roomCode: room.code,
      endedAt: now,
      players: [
        ...state.players.map(({ id, name, score, deaths }) => ({ id, name, score, deaths })),
        ...room.departed,
      ],
      winnerIds: [...state.winnerIds],
    };
    this.history.unshift(record);
    if (this.history.length > 200) this.history.length = 200;
    this.broadcast(room, { type: 'finished', room: this.view(room), record });
  }
  leaderboard(): LeaderboardEntry[] {
    const entries = new Map<string, LeaderboardEntry>();
    for (const match of this.history)
      for (const player of match.players) {
        const entry = entries.get(player.id) ?? {
          id: player.id,
          name: player.name,
          wins: 0,
          kills: 0,
          matches: 0,
        };
        entry.matches++;
        entry.kills += player.score;
        if (match.winnerIds.includes(player.id)) entry.wins++;
        entries.set(player.id, entry);
      }
    return [...entries.values()]
      .sort((a, b) => b.wins - a.wins || b.kills - a.kills || a.name.localeCompare(b.name))
      .slice(0, 100);
  }
  view(room: Room): RoomView {
    return {
      code: room.code,
      hostId: room.hostId,
      capacity: room.capacity,
      visibility: room.visibility,
      status: room.status,
      players: this.members(room).map((s) => ({
        id: s.id,
        name: s.name,
        ready: room.members.get(s.id) ?? false,
        connected: !!s.socket,
      })),
      match: room.arena?.state ?? null,
    };
  }
  private members(room: Room): Session[] {
    return [...room.members.keys()].map((id) => this.byId(id)).filter((s): s is Session => !!s);
  }
  private byId(id: string): Session | undefined {
    return [...this.sessions.values()].find((s) => s.id === id);
  }
  private broadcast(room: Room, message: ServerMessage) {
    const payload = JSON.stringify(message);
    for (const s of this.members(room))
      if (s.socket?.readyState === WebSocket.OPEN) {
        if (s.socket.bufferedAmount > 262144) s.socket.terminate();
        else s.socket.send(payload);
      }
  }
  private broadcastRoom(room: Room) {
    this.broadcast(room, { type: 'room', room: this.view(room) });
  }
}
