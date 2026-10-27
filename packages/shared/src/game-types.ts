export const ARENA = {
  width: 960,
  height: 600,
  playerRadius: 16,
  bulletRadius: 5,
  speed: 220,
  bulletSpeed: 560,
  damage: 25,
  fireInterval: 240,
  respawnMs: 1800,
  tickRate: 25,
  broadcastRate: 12.5,
} as const;
export const OBSTACLES = [
  { x: 220, y: 160, width: 100, height: 36 },
  { x: 640, y: 404, width: 100, height: 36 },
  { x: 455, y: 260, width: 50, height: 80 },
] as const;
export interface InputState {
  seq: number;
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  angle: number;
  fire: boolean;
}
export interface ArenaPlayer {
  id: string;
  name: string;
  x: number;
  y: number;
  angle: number;
  health: number;
  score: number;
  deaths: number;
  respawnAt: number;
  lastSeq: number;
  color: string;
}
export interface Bullet {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}
export interface KillEvent {
  id: string;
  killer: string;
  victim: string;
  at: number;
}
export interface MatchState {
  tick: number;
  players: ArenaPlayer[];
  bullets: Bullet[];
  endsAt: number;
  startedAt: number;
  kills: KillEvent[];
  winnerIds: string[];
}
export interface RoomPlayer {
  id: string;
  name: string;
  ready: boolean;
  connected: boolean;
}
export interface RoomView {
  code: string;
  hostId: string;
  visibility: 'private' | 'public';
  status: 'waiting' | 'playing' | 'finished';
  players: RoomPlayer[];
  capacity: number;
  match: MatchState | null;
}
export interface MatchRecord {
  id: string;
  roomCode: string;
  endedAt: number;
  players: { id: string; name: string; score: number; deaths: number }[];
  winnerIds: string[];
}
export interface LeaderboardEntry {
  id: string;
  name: string;
  wins: number;
  kills: number;
  matches: number;
}
