import type { ArenaPlayer, WorldObject } from '@retroverse/shared';
import { ArcadeGame, distance, type GameEngine, type Participant } from './base';

export const CASUAL_IDS = [
  'stack-surge',
  'pixel-serpent',
  'orbit-marbles',
  'paddle-pulse',
  'bloom-arena',
  'coil-circuit',
] as const;
const PALETTE = ['#55e2ef', '#f66caf', '#ba92ff', '#ffd36a', '#84efad'];
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function rotatePiece(piece: number[][]): number[][] {
  return piece[0].map((_, x) => piece.map((row) => row[x]).reverse());
}
export function clearFullRows(board: number[][]): number {
  const width = board[0].length;
  const remaining = board.filter((row) => row.some((cell) => cell === 0));
  const count = board.length - remaining.length;
  board.splice(
    0,
    board.length,
    ...Array.from({ length: count }, () => Array<number>(width).fill(0)),
    ...remaining,
  );
  return count;
}
interface FallingBoard {
  cells: number[][];
  piece: number[][];
  x: number;
  y: number;
  serial: number;
  fall: number;
  move: number;
  rotate: boolean;
  alive: boolean;
}
const PIECES = [
  [[1, 1, 1, 1]],
  [
    [1, 1],
    [1, 1],
  ],
  [
    [0, 1, 0],
    [1, 1, 1],
  ],
  [
    [1, 0],
    [1, 0],
    [1, 1],
  ],
  [
    [0, 1, 1],
    [1, 1, 0],
  ],
];
export class StackSurge extends ArcadeGame {
  private boards = new Map<string, FallingBoard>();
  constructor(players: Participant[], now: number, duration: number) {
    super(players, now, duration, 'stack-surge');
    this.state.info = {
      label: 'Points',
      message:
        '←/→ move · ↑ rotate · ↓ soft drop · Click / Space hard drop. Clear full rows; survive the stack.',
    };
    for (const [i, p] of this.state.players.entries()) {
      p.x = 240 + i * 480;
      p.y = 35;
      this.boards.set(p.id, {
        cells: Array.from({ length: 20 }, () => Array<number>(10).fill(0)),
        piece: PIECES[0].map((r) => [...r]),
        x: 3,
        y: 0,
        serial: 0,
        fall: 0,
        move: 0,
        rotate: false,
        alive: true,
      });
    }
    this.render();
  }
  private fits(b: FallingBoard, piece = b.piece, x = b.x, y = b.y) {
    return piece.every((row, dy) =>
      row.every(
        (cell, dx) =>
          !cell ||
          (x + dx >= 0 &&
            x + dx < 10 &&
            y + dy < 20 &&
            (y + dy < 0 || b.cells[y + dy][x + dx] === 0)),
      ),
    );
  }
  private lock(p: ArenaPlayer, b: FallingBoard) {
    for (const [dy, row] of b.piece.entries())
      for (const [dx, cell] of row.entries())
        if (cell && b.y + dy >= 0) b.cells[b.y + dy][b.x + dx] = (b.serial % 5) + 1;
    const rows = clearFullRows(b.cells);
    p.score += [0, 100, 300, 500, 800][rows] ?? rows * 200;
    b.serial++;
    b.piece = PIECES[b.serial % PIECES.length].map((row) => [...row]);
    b.x = 3;
    b.y = 0;
    b.fall = 0;
    if (!this.fits(b)) {
      b.alive = false;
      p.health = 0;
      p.deaths++;
    }
  }
  protected update(dt: number, now: number) {
    for (const p of this.state.players) {
      const b = this.boards.get(p.id)!;
      if (!b.alive) continue;
      const input = this.read(p.id, now);
      b.move -= dt;
      b.fall += dt;
      const direction = Number(input.right) - Number(input.left);
      if (direction && b.move <= 0) {
        if (this.fits(b, b.piece, b.x + direction, b.y)) b.x += direction;
        b.move = 0.13;
      }
      if (input.up && !b.rotate) {
        const rotated = rotatePiece(b.piece);
        for (const offset of [0, -1, 1, -2, 2])
          if (this.fits(b, rotated, b.x + offset, b.y)) {
            b.piece = rotated;
            b.x += offset;
            break;
          }
      }
      b.rotate = input.up;
      if (this.pressed(p.id)) {
        while (this.fits(b, b.piece, b.x, b.y + 1)) {
          b.y++;
          p.score++;
        }
        this.lock(p, b);
      } else if (b.fall >= (input.down ? 0.045 : 0.55)) {
        b.fall = 0;
        if (this.fits(b, b.piece, b.x, b.y + 1)) b.y++;
        else this.lock(p, b);
      }
    }
    const living = this.state.players.filter((p) => this.boards.get(p.id)?.alive);
    if (living.length === 0) this.finish();
    else if (this.state.players.length > 1 && living.length === 1)
      this.finish(living.map((p) => p.id));
    this.render();
  }
  private render() {
    const objects: WorldObject[] = [];
    for (const [i, p] of this.state.players.entries()) {
      const b = this.boards.get(p.id)!;
      const left = 120 + i * 480;
      objects.push(
        this.object('zone', left - 3, 65, {
          width: 246,
          height: 486,
          color: '#15243a',
          label: p.name,
        }),
      );
      for (let y = 0; y < 20; y++)
        for (let x = 0; x < 10; x++)
          if (b.cells[y][x])
            objects.push(
              this.object('tile', left + x * 24, 68 + y * 24, {
                width: 22,
                height: 22,
                color: PALETTE[(b.cells[y][x] - 1) % 5],
                ownerId: p.id,
              }),
            );
      if (b.alive)
        for (const [dy, row] of b.piece.entries())
          for (const [dx, cell] of row.entries())
            if (cell)
              objects.push(
                this.object('tile', left + (b.x + dx) * 24, 68 + (b.y + dy) * 24, {
                  width: 22,
                  height: 22,
                  color: p.color,
                  ownerId: p.id,
                }),
              );
    }
    this.state.objects = objects;
  }
}

interface GridSnake {
  body: { x: number; y: number }[];
  dx: number;
  dy: number;
  nextDx: number;
  nextDy: number;
  clock: number;
  alive: boolean;
  respawn: number;
}
export class PixelSerpent extends ArcadeGame {
  private snakes = new Map<string, GridSnake>();
  private food: WorldObject[] = [];
  constructor(players: Participant[], now: number, duration: number) {
    super(players, now, duration, 'pixel-serpent');
    this.state.info = {
      label: 'Fruit',
      message:
        'Arrows / WASD steer. Click / Space accelerates. Eat fruit; avoid walls and every snake body.',
    };
    for (const [i, p] of this.state.players.entries()) this.spawn(p, i);
    for (let i = 0; i < 20; i++)
      this.food.push(
        this.object('pickup', 60 + ((i * 137) % 840), 60 + ((i * 83) % 480), {
          radius: 7,
          color: PALETTE[i % 5],
        }),
      );
    this.render();
  }
  override removePlayer(id: string) {
    super.removePlayer(id);
    this.snakes.delete(id);
    this.render();
  }
  private spawn(p: ArenaPlayer, i: number) {
    const x = 5 + (i % 4) * 9,
      y = 5 + Math.floor(i / 4) * 10;
    p.health = 100;
    p.x = x * 20 + 10;
    p.y = y * 20 + 10;
    this.snakes.set(p.id, {
      body: [
        { x, y },
        { x: x - 1, y },
        { x: x - 2, y },
      ],
      dx: 1,
      dy: 0,
      nextDx: 1,
      nextDy: 0,
      clock: 0,
      alive: true,
      respawn: 0,
    });
  }
  protected update(dt: number, now: number) {
    for (const [i, p] of this.state.players.entries()) {
      const s = this.snakes.get(p.id)!;
      if (!s.alive) {
        if (now >= s.respawn) this.spawn(p, i);
        continue;
      }
      const input = this.read(p.id, now);
      if (input.up && s.dy !== 1) {
        s.nextDx = 0;
        s.nextDy = -1;
      } else if (input.down && s.dy !== -1) {
        s.nextDx = 0;
        s.nextDy = 1;
      } else if (input.left && s.dx !== 1) {
        s.nextDx = -1;
        s.nextDy = 0;
      } else if (input.right && s.dx !== -1) {
        s.nextDx = 1;
        s.nextDy = 0;
      }
      s.clock += dt;
      if (s.clock < (input.fire ? 0.085 : 0.15)) continue;
      s.clock = 0;
      s.dx = s.nextDx;
      s.dy = s.nextDy;
      const head = { x: s.body[0].x + s.dx, y: s.body[0].y + s.dy };
      const collision =
        head.x < 1 ||
        head.x >= 47 ||
        head.y < 2 ||
        head.y >= 28 ||
        [...this.snakes.values()].some(
          (other) =>
            other.alive &&
            (other === s ? other.body.slice(0, -1) : other.body).some(
              (part) => part.x === head.x && part.y === head.y,
            ),
        );
      if (collision) {
        s.alive = false;
        s.respawn = now + 1400;
        p.health = 0;
        p.deaths++;
        continue;
      }
      s.body.unshift(head);
      p.x = head.x * 20 + 10;
      p.y = head.y * 20 + 10;
      p.angle = Math.atan2(s.dy, s.dx);
      const at = this.food.findIndex((f) => distance(p, f) < 18);
      if (at >= 0) {
        p.score++;
        this.food[at].x = 30 + ((this.serial * 137) % 900);
        this.food[at].y = 50 + ((this.serial++ * 83) % 500);
        if (s.body.length > 70) s.body.pop();
      } else s.body.pop();
    }
    this.render();
  }
  private render() {
    this.state.objects = [...this.food];
    for (const p of this.state.players) {
      const s = this.snakes.get(p.id)!;
      if (s.alive)
        for (const b of s.body.slice(1))
          this.state.objects.push(
            this.object('trail', b.x * 20 + 2, b.y * 20 + 2, {
              width: 16,
              height: 16,
              color: p.color,
              ownerId: p.id,
            }),
          );
    }
    this.state.objects.unshift(
      this.object('zone', 20, 40, {
        width: 920,
        height: 520,
        color: '#15243a',
        label: 'Keep inside the grid',
      }),
    );
  }
}

interface Marble {
  distance: number;
  color: number;
}
interface MarbleShot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: number;
  ownerId: string;
}
export class OrbitMarbles extends ArcadeGame {
  private chain: Marble[] = Array.from({ length: 18 }, (_, i) => ({
    distance: 30 + i * 29,
    color: Math.floor(i / 2) % 4,
  }));
  private shots: MarbleShot[] = [];
  private nextColors = new Map<string, number>();
  private breach = 0;
  constructor(players: Participant[], now: number, duration: number) {
    super(players, now, duration, 'orbit-marbles');
    this.state.info = {
      label: 'Matched',
      message:
        'Aim with the mouse, click / Space to launch. Match 3+ adjacent colors before the chain reaches the gate.',
    };
    for (const [i, p] of this.state.players.entries()) {
      p.x = 260 + i * 380;
      p.y = 520;
      this.nextColors.set(p.id, i % 4);
    }
    this.render();
  }
  private point(d: number) {
    return { x: 80 + Math.min(800, d), y: 180 + Math.sin(d / 120) * 80 };
  }
  protected update(dt: number, now: number) {
    for (const p of this.state.players) {
      const input = this.read(p.id, now);
      p.angle = input.angle;
      if (this.pressed(p.id) && this.shots.length < 12) {
        const color = this.nextColors.get(p.id)!;
        this.shots.push({
          x: p.x,
          y: p.y,
          vx: Math.cos(input.angle) * 620,
          vy: Math.sin(input.angle) * 620,
          color,
          ownerId: p.id,
        });
        this.nextColors.set(p.id, (color + 1) % 4);
      }
    }
    for (const marble of this.chain) marble.distance += dt * (8 + this.breach * 2);
    const remaining: MarbleShot[] = [];
    for (const shot of this.shots) {
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      const at = this.chain.findIndex((m) => distance(this.point(m.distance), shot) < 23);
      if (at < 0) {
        if (shot.x > 0 && shot.x < 960 && shot.y > 0 && shot.y < 600) remaining.push(shot);
        continue;
      }
      const insertAt = at + 1;
      this.chain.splice(insertAt, 0, { distance: this.chain[at].distance + 14, color: shot.color });
      let low = insertAt,
        high = insertAt;
      while (low > 0 && this.chain[low - 1].color === shot.color) low--;
      while (high + 1 < this.chain.length && this.chain[high + 1].color === shot.color) high++;
      if (high - low + 1 >= 3) {
        const removed = this.chain.splice(low, high - low + 1);
        const p = this.state.players.find((p) => p.id === shot.ownerId);
        if (p) p.score += removed.length;
      }
      // Keep chain ordered and compact after inserting/removing a marble.
      for (let i = 1; i < this.chain.length; i++)
        this.chain[i].distance = this.chain[i - 1].distance + 29;
    }
    this.shots = remaining;
    if (this.chain.some((m) => m.distance >= 800)) {
      this.breach++;
      for (const p of this.state.players) p.health = Math.max(0, p.health - 25);
      this.chain = Array.from({ length: 12 }, (_, i) => ({
        distance: 10 + i * 29,
        color: Math.floor(i / 2) % 4,
      }));
      if (this.breach >= 4) this.finish();
    }
    if (!this.chain.length) this.finish();
    this.render();
  }
  private render() {
    const path = Array.from({ length: 41 }, (_, i) =>
      this.object('trail', this.point(i * 20).x, this.point(i * 20).y, {
        radius: 3,
        color: '#3d5979',
      }),
    );
    this.state.objects = [
      ...path,
      ...this.chain.map((m) =>
        this.object('ball', this.point(m.distance).x, this.point(m.distance).y, {
          radius: 13,
          color: PALETTE[m.color],
        }),
      ),
      ...this.shots.map((s) =>
        this.object('ball', s.x, s.y, { radius: 8, color: PALETTE[s.color] }),
      ),
      this.object('finish', 880, this.point(800).y, {
        radius: 24,
        color: '#f66caf',
        label: 'GATE',
      }),
    ];
    for (const p of this.state.players)
      this.state.objects.push(
        this.object('marker', p.x, p.y + 30, {
          radius: 9,
          color: PALETTE[this.nextColors.get(p.id)!],
          label: 'Next',
        }),
      );
  }
}

export class PaddlePulse extends ArcadeGame {
  private ball = { x: 480, y: 300, vx: 0, vy: 0 };
  private serveId: string;
  constructor(players: Participant[], now: number, duration: number) {
    super(players, now, duration, 'paddle-pulse');
    this.serveId = players[0].id;
    for (const [i, p] of this.state.players.entries()) {
      p.x = i ? 910 : 50;
      p.y = 300;
    }
    this.state.info = {
      label: 'Goals',
      message: 'W/S or ↑/↓ move your paddle. Click / Space to serve. First to 7 wins.',
      turnId: this.serveId,
      goal: 7,
    };
    this.render();
  }
  override removePlayer(id: string) {
    super.removePlayer(id);
    if (this.state.players.length <= 1) this.finish(this.state.players.map((p) => p.id));
    else if (this.serveId === id) this.serveId = this.state.players[0].id;
    this.render();
  }
  protected update(dt: number, now: number) {
    for (const p of this.state.players) {
      const input = this.read(p.id, now);
      p.y = clamp(p.y + (Number(input.down) - Number(input.up)) * 320 * dt, 95, 505);
      const servePressed = this.pressed(p.id);
      if (!this.ball.vx && p.id === this.serveId && servePressed) {
        this.ball.vx = p.x < 480 ? 310 : -310;
        this.ball.vy = 90;
      }
    }
    this.ball.x += this.ball.vx * dt;
    this.ball.y += this.ball.vy * dt;
    if (this.ball.y < 50) {
      this.ball.y = 50;
      this.ball.vy = Math.abs(this.ball.vy);
    }
    if (this.ball.y > 550) {
      this.ball.y = 550;
      this.ball.vy = -Math.abs(this.ball.vy);
    }
    for (const p of this.state.players) {
      if (
        Math.abs(this.ball.x - p.x) < 20 &&
        Math.abs(this.ball.y - p.y) < 60 &&
        ((p.x < 480 && this.ball.vx < 0) || (p.x > 480 && this.ball.vx > 0))
      ) {
        this.ball.x = p.x + (p.x < 480 ? 21 : -21);
        this.ball.vx = (p.x < 480 ? 1 : -1) * Math.min(650, Math.abs(this.ball.vx) * 1.08);
        this.ball.vy = (this.ball.y - p.y) * 6;
      }
    }
    if (this.ball.x < 15 || this.ball.x > 945) {
      const scorer = this.state.players.find((p) => (this.ball.x < 15 ? p.x > 480 : p.x < 480));
      const loser = this.state.players.find((p) => p !== scorer);
      if (scorer) {
        scorer.score++;
        if (scorer.score >= 7) this.finish([scorer.id]);
      }
      this.serveId = loser?.id ?? this.state.players[0]?.id;
      this.ball = { x: 480, y: 300, vx: 0, vy: 0 };
      this.state.info!.turnId = this.serveId;
    }
    this.render();
  }
  private render() {
    this.state.objects = [
      this.object('zone', 20, 40, { width: 920, height: 520, color: '#12273a' }),
      this.object('ball', this.ball.x, this.ball.y, { radius: 9, color: '#f8f1cd' }),
      ...this.state.players.map((p) =>
        this.object('wall', p.x - 8, p.y - 52, {
          width: 16,
          height: 104,
          color: p.color,
          ownerId: p.id,
        }),
      ),
    ];
  }
}

export class BloomArena extends ArcadeGame {
  private mass = new Map<string, number>();
  private food: WorldObject[] = [];
  private dash = new Map<string, number>();
  constructor(players: Participant[], now: number, duration: number) {
    super(players, now, duration, 'bloom-arena');
    this.state.info = {
      label: 'Mass',
      message:
        'WASD / arrows glide. Eat motes, outgrow rivals, and absorb smaller cells. Click / Space dashes at a mass cost.',
    };
    for (const [i, p] of this.state.players.entries()) {
      p.x = 140 + (i % 4) * 220;
      p.y = 130 + Math.floor(i / 4) * 300;
      this.mass.set(p.id, 20);
    }
    for (let i = 0; i < 65; i++)
      this.food.push(
        this.object('pickup', 40 + ((i * 137) % 880), 60 + ((i * 83) % 480), {
          radius: 4,
          color: PALETTE[i % 5],
        }),
      );
    this.render();
  }
  protected update(dt: number, now: number) {
    for (const p of this.state.players) {
      let mass = this.mass.get(p.id)!;
      if (p.health <= 0) {
        if (now >= p.respawnAt) {
          p.health = 100;
          mass = 20;
          p.x = 60 + ((this.serial * 137) % 840);
          p.y = 80 + ((this.serial++ * 83) % 440);
        } else continue;
      }
      this.mass.set(p.id, mass);
      const input = this.read(p.id, now);
      if (this.pressed(p.id) && mass > 22) {
        mass -= 2;
        this.dash.set(p.id, now + 350);
        this.mass.set(p.id, mass);
      }
      this.move(
        p,
        dt,
        now,
        (this.dash.get(p.id) ?? 0) > now ? 360 : Math.max(90, 220 - Math.sqrt(mass) * 5),
      );
      p.angle = input.angle;
      const radius = 10 + Math.sqrt(mass) * 2;
      for (const f of this.food)
        if (distance(p, f) < radius + 4) {
          mass++;
          f.x = 30 + ((this.serial * 137) % 900);
          f.y = 50 + ((this.serial++ * 83) % 500);
        }
      this.mass.set(p.id, mass);
      p.score = mass;
    }
    for (const p of this.state.players)
      for (const q of this.state.players) {
        if (p === q || p.health <= 0 || q.health <= 0) continue;
        const pm = this.mass.get(p.id)!,
          qm = this.mass.get(q.id)!;
        if (pm > qm * 1.3 && distance(p, q) < 10 + Math.sqrt(pm) * 1.7) {
          this.mass.set(p.id, pm + Math.floor(qm * 0.65));
          p.score = this.mass.get(p.id)!;
          q.health = 0;
          q.deaths++;
          q.respawnAt = now + 1800;
          this.mass.set(q.id, 20);
        }
      }
    this.render();
  }
  private render() {
    this.state.objects = [...this.food];
    for (const p of this.state.players)
      if (p.health > 0)
        this.state.objects.push(
          this.object('ball', p.x, p.y, {
            radius: 10 + Math.sqrt(this.mass.get(p.id)!) * 2,
            color: p.color,
            ownerId: p.id,
            label: String(this.mass.get(p.id)),
          }),
        );
  }
}

interface Coil {
  body: { x: number; y: number }[];
  length: number;
  sample: number;
  respawn: number;
}
export class CoilCircuit extends ArcadeGame {
  private coils = new Map<string, Coil>();
  private energy: WorldObject[] = [];
  constructor(players: Participant[], now: number, duration: number) {
    super(players, now, duration, 'coil-circuit');
    this.state.info = {
      label: 'Energy',
      message:
        'Aim with the mouse to steer continuously. Hold click / Space to boost and spend energy. Avoid rival trails and walls.',
    };
    for (const [i, p] of this.state.players.entries()) {
      p.x = 100 + (i % 4) * 220;
      p.y = 130 + Math.floor(i / 4) * 280;
      p.angle = i % 2 ? Math.PI : 0;
      this.coils.set(p.id, { body: [{ x: p.x, y: p.y }], length: 24, sample: 0, respawn: 0 });
    }
    for (let i = 0; i < 45; i++)
      this.energy.push(
        this.object('pickup', 40 + ((i * 137) % 880), 60 + ((i * 83) % 480), {
          radius: 5,
          color: PALETTE[i % 5],
        }),
      );
    this.render();
  }
  protected update(dt: number, now: number) {
    for (const [i, p] of this.state.players.entries()) {
      const c = this.coils.get(p.id)!;
      if (p.health <= 0) {
        if (now < c.respawn) continue;
        p.health = 100;
        p.x = 100 + (i % 4) * 220;
        p.y = 130 + Math.floor(i / 4) * 280;
        c.body = [{ x: p.x, y: p.y }];
        c.length = 24;
      }
      const input = this.read(p.id, now);
      let difference = input.angle - p.angle;
      while (difference > Math.PI) difference -= Math.PI * 2;
      while (difference < -Math.PI) difference += Math.PI * 2;
      p.angle += clamp(difference, -dt * 4, dt * 4);
      const boost = input.fire && p.score > 0;
      const speed = boost ? 230 : 135;
      p.x += Math.cos(p.angle) * speed * dt;
      p.y += Math.sin(p.angle) * speed * dt;
      c.sample += dt;
      if (c.sample >= 0.06) {
        c.sample = 0;
        c.body.unshift({ x: p.x, y: p.y });
        if (c.body.length > c.length) c.body.pop();
        if (boost) {
          p.score = Math.max(0, p.score - 1);
          c.length = Math.max(24, c.length - 1);
        }
      }
      const hit =
        p.x < 16 ||
        p.x > 944 ||
        p.y < 45 ||
        p.y > 584 ||
        this.state.players.some(
          (other) =>
            other !== p &&
            other.health > 0 &&
            (this.coils.get(other.id)?.body.some((part) => distance(p, part) < 13) ?? false),
        );
      if (hit) {
        p.health = 0;
        p.deaths++;
        c.respawn = now + 1500;
        for (const part of c.body.filter((_, i) => i % 6 === 0).slice(0, 12)) {
          if (this.energy.length < 100)
            this.energy.push(
              this.object('pickup', clamp(part.x, 20, 940), clamp(part.y, 45, 580), {
                radius: 5,
                color: p.color,
              }),
            );
        }
        c.body = [];
        continue;
      }
      for (const f of this.energy)
        if (distance(p, f) < 19) {
          p.score += 2;
          c.length = Math.min(100, c.length + 3);
          f.x = 30 + ((this.serial * 137) % 900);
          f.y = 50 + ((this.serial++ * 83) % 500);
        }
    }
    this.render();
  }
  private render() {
    this.state.objects = [...this.energy];
    for (const p of this.state.players)
      if (p.health > 0)
        for (const part of this.coils.get(p.id)!.body.slice(1))
          this.state.objects.push(
            this.object('trail', part.x, part.y, { radius: 8, color: p.color, ownerId: p.id }),
          );
  }
}

export function createCasualGame(
  gameId: string,
  participants: Participant[],
  now: number,
  duration: number,
): GameEngine {
  switch (gameId) {
    case 'stack-surge':
      return new StackSurge(participants, now, duration);
    case 'pixel-serpent':
      return new PixelSerpent(participants, now, duration);
    case 'orbit-marbles':
      return new OrbitMarbles(participants, now, duration);
    case 'paddle-pulse':
      return new PaddlePulse(participants, now, duration);
    case 'bloom-arena':
      return new BloomArena(participants, now, duration);
    case 'coil-circuit':
      return new CoilCircuit(participants, now, duration);
    default:
      throw new Error(`Unsupported casual game: ${gameId}`);
  }
}
