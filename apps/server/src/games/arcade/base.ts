import {
  ARENA,
  type ArenaPlayer,
  type InputState,
  type MatchState,
  type WorldObject,
} from '@retroverse/shared';
export interface GameEngine {
  readonly state: MatchState;
  input(id: string, input: InputState, now?: number): boolean;
  clearInput(id: string): void;
  removePlayer(id: string): void;
  step(now: number): boolean;
  privateInfo?(id: string): string | undefined;
}
export type Participant = { id: string; name: string };
const COLORS = [
  '#27e4ec',
  '#fa53b8',
  '#b397ff',
  '#ffd477',
  '#81f7ad',
  '#ff8c6b',
  '#7caaff',
  '#efefef',
];
export abstract class ArcadeGame implements GameEngine {
  readonly state: MatchState;
  protected readonly inputs = new Map<string, { value: InputState; at: number }>();
  private edges = new Set<string>();
  private lastStep: number;
  private ended = false;
  private reported = false;
  protected serial = 0;
  constructor(players: Participant[], now: number, duration: number, gameId: string) {
    this.lastStep = now;
    this.state = {
      gameId,
      tick: 0,
      players: players.map((p, i) => ({
        ...p,
        x: 100 + i * 90,
        y: 300,
        angle: 0,
        health: 100,
        score: 0,
        deaths: 0,
        respawnAt: 0,
        lastSeq: -1,
        color: COLORS[i % 8],
      })),
      bullets: [],
      objects: [],
      startedAt: now,
      endsAt: now + duration,
      kills: [],
      winnerIds: [],
      info: {
        label: 'Score',
        message: 'Move with WASD / arrows. Click or Space for the primary action.',
      },
    };
  }
  input(id: string, input: InputState, now = Date.now()) {
    const p = this.state.players.find((p) => p.id === id);
    if (!p || this.ended || input.seq <= p.lastSeq) return false;
    p.lastSeq = input.seq;
    if (input.fire && !this.inputs.get(id)?.value.fire) this.edges.add(id);
    this.inputs.set(id, { value: { ...input }, at: now });
    return true;
  }
  clearInput(id: string) {
    this.inputs.delete(id);
    this.edges.delete(id);
  }
  removePlayer(id: string) {
    this.clearInput(id);
    this.state.players = this.state.players.filter((p) => p.id !== id);
    this.state.bullets = this.state.bullets.filter((b) => b.ownerId !== id);
  }
  protected read(id: string, now: number): InputState {
    const entry = this.inputs.get(id);
    return entry && now - entry.at < 300
      ? entry.value
      : {
          seq: 0,
          up: false,
          down: false,
          left: false,
          right: false,
          angle: entry?.value.angle ?? 0,
          fire: false,
        };
  }
  protected pressed(id: string) {
    const pressed = this.edges.has(id);
    this.edges.delete(id);
    return pressed;
  }
  protected move(p: ArenaPlayer, dt: number, now: number, speed = 200, walls: WorldObject[] = []) {
    const input = this.read(p.id, now);
    p.angle = input.angle;
    const dx = Number(input.right) - Number(input.left),
      dy = Number(input.down) - Number(input.up),
      length = Math.hypot(dx, dy) || 1;
    const blocked = (x: number, y: number) =>
      walls.some(
        (w) =>
          x + 14 > w.x &&
          x - 14 < w.x + (w.width ?? 0) &&
          y + 14 > w.y &&
          y - 14 < w.y + (w.height ?? 0),
      );
    const x = Math.max(18, Math.min(942, p.x + (dx / length) * speed * dt)),
      y = Math.max(18, Math.min(582, p.y + (dy / length) * speed * dt));
    if (!blocked(x, p.y)) p.x = x;
    if (!blocked(p.x, y)) p.y = y;
  }
  protected object(
    kind: WorldObject['kind'],
    x: number,
    y: number,
    rest: Partial<WorldObject> = {},
  ): WorldObject {
    return { id: `o${++this.serial}`, kind, x, y, ...rest };
  }
  protected finish(winnerIds?: string[]) {
    if (this.ended) return;
    this.ended = true;
    const best = Math.max(...this.state.players.map((p) => p.score));
    this.state.winnerIds =
      winnerIds ?? this.state.players.filter((p) => p.score === best).map((p) => p.id);
    this.state.info = { ...this.state.info!, phase: 'finished' };
    this.state.bullets = [];
  }
  protected expired() {
    this.finish();
  }
  step(now: number) {
    if (this.reported) return false;
    if (!this.ended) {
      const dt = Math.max(0, Math.min(0.08, (now - this.lastStep) / 1000));
      this.lastStep = now;
      if (now >= this.state.endsAt) this.expired();
      else if (dt > 0) {
        this.state.tick++;
        this.update(dt, now);
      }
    }
    if (this.ended) {
      this.reported = true;
      return true;
    }
    return false;
  }
  protected abstract update(dt: number, now: number): void;
}
export const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
export const bounds = { width: ARENA.width, height: ARENA.height };
