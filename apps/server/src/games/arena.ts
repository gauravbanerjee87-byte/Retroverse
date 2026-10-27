import {
  ARENA,
  OBSTACLES,
  type ArenaPlayer,
  type Bullet,
  type InputState,
  type MatchState,
} from '@retroverse/shared';

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
const SPAWNS = [
  { x: 100, y: 100 },
  { x: 860, y: 500 },
  { x: 860, y: 100 },
  { x: 100, y: 500 },
  { x: 100, y: 300 },
  { x: 860, y: 300 },
  { x: 480, y: 100 },
  { x: 480, y: 500 },
];
const INPUT_TIMEOUT_MS = 250;
const STEP_MS = 1000 / ARENA.tickRate;

/** Earliest segment/circle intersection, as a fraction of the segment length. */
function hitCircle(
  x: number,
  y: number,
  dx: number,
  dy: number,
  cx: number,
  cy: number,
  r: number,
): number | null {
  const ox = x - cx;
  const oy = y - cy;
  const c = ox * ox + oy * oy - r * r;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy;
  if (a === 0) return null;
  const b = 2 * (ox * dx + oy * dy);
  const d = b * b - 4 * a * c;
  if (d < 0) return null;
  const t = (-b - Math.sqrt(d)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}

/** Swept AABB test prevents fast projectiles passing through narrow cover. */
function hitBox(
  x: number,
  y: number,
  dx: number,
  dy: number,
  box: { x: number; y: number; width: number; height: number },
  padding: number,
): number | null {
  let near = 0;
  let far = 1;
  for (const [p, d, lo, hi] of [
    [x, dx, box.x - padding, box.x + box.width + padding],
    [y, dy, box.y - padding, box.y + box.height + padding],
  ]) {
    if (d === 0) {
      if (p < lo || p > hi) return null;
    } else {
      const t1 = (lo - p) / d;
      const t2 = (hi - p) / d;
      near = Math.max(near, Math.min(t1, t2));
      far = Math.min(far, Math.max(t1, t2));
      if (near > far) return null;
    }
  }
  return near;
}

function blocked(x: number, y: number): boolean {
  return OBSTACLES.some((b) => {
    const cx = Math.max(b.x, Math.min(x, b.x + b.width));
    const cy = Math.max(b.y, Math.min(y, b.y + b.height));
    return (x - cx) ** 2 + (y - cy) ** 2 < ARENA.playerRadius ** 2;
  });
}

/** All positions, collisions, health, scores and winners are owned by this simulation. */
export class Arena {
  readonly state: MatchState;
  private readonly inputs = new Map<string, { value: InputState; receivedAt: number }>();
  private readonly lastShot = new Map<string, number>();
  private lastStep: number;
  private serial = 0;
  private finished = false;

  constructor(players: { id: string; name: string }[], now: number, durationMs: number) {
    this.lastStep = now;
    this.state = {
      tick: 0,
      startedAt: now,
      endsAt: now + durationMs,
      winnerIds: [],
      kills: [],
      bullets: [],
      players: players.map((p, i) => ({
        ...p,
        ...SPAWNS[i % SPAWNS.length],
        angle: 0,
        health: 100,
        score: 0,
        deaths: 0,
        respawnAt: 0,
        lastSeq: -1,
        color: COLORS[i % COLORS.length],
      })),
    };
  }

  input(id: string, input: InputState, now = Date.now()): boolean {
    const player = this.state.players.find((p) => p.id === id);
    if (!player || this.finished || input.seq <= player.lastSeq) return false;
    player.lastSeq = input.seq;
    this.inputs.set(id, { value: { ...input }, receivedAt: now });
    return true;
  }

  clearInput(id: string): void {
    this.inputs.delete(id);
  }

  removePlayer(id: string): void {
    this.clearInput(id);
    this.lastShot.delete(id);
    this.state.players = this.state.players.filter((p) => p.id !== id);
    this.state.bullets = this.state.bullets.filter((b) => b.ownerId !== id);
  }

  /** One capped fixed-rate step. Returns true only on the transition to finished. */
  step(now: number): boolean {
    if (this.finished) return false;
    if (now >= this.state.endsAt) {
      this.finished = true;
      const best = Math.max(...this.state.players.map((p) => p.score));
      this.state.winnerIds = this.state.players.filter((p) => p.score === best).map((p) => p.id);
      this.state.bullets = [];
      this.inputs.clear();
      return true;
    }
    const elapsed = Math.max(0, Math.min(now - this.lastStep, STEP_MS));
    if (elapsed === 0) return false;
    this.lastStep = now;
    const dt = elapsed / 1000;
    this.state.tick++;
    for (const player of this.state.players) {
      if (player.health <= 0) {
        if (now >= player.respawnAt) this.respawn(player);
        else continue;
      }
      const received = this.inputs.get(player.id);
      if (!received || now - received.receivedAt > INPUT_TIMEOUT_MS) continue;
      const input = received.value;
      player.angle = input.angle;
      let dx = Number(input.right) - Number(input.left);
      let dy = Number(input.down) - Number(input.up);
      const length = Math.hypot(dx, dy) || 1;
      dx = (dx / length) * ARENA.speed * dt;
      dy = (dy / length) * ARENA.speed * dt;
      const r = ARENA.playerRadius;
      const nextX = Math.max(r, Math.min(ARENA.width - r, player.x + dx));
      const nextY = Math.max(r, Math.min(ARENA.height - r, player.y + dy));
      // Resolve axes separately so players slide along cover instead of sticking.
      if (!blocked(nextX, player.y)) player.x = nextX;
      if (!blocked(player.x, nextY)) player.y = nextY;
      if (input.fire && now - (this.lastShot.get(player.id) ?? -Infinity) >= ARENA.fireInterval) {
        this.fire(player, now);
      }
    }
    this.advanceBullets(dt, now);
    return false;
  }

  private fire(player: ArenaPlayer, now: number): void {
    if (this.state.bullets.length >= 128) return;
    this.lastShot.set(player.id, now);
    // Spawn at the centre: the owner is excluded from collision. This avoids
    // teleporting the muzzle through cover immediately beside the player.
    this.state.bullets.push({
      id: `b${++this.serial}`,
      ownerId: player.id,
      x: player.x,
      y: player.y,
      vx: Math.cos(player.angle) * ARENA.bulletSpeed,
      vy: Math.sin(player.angle) * ARENA.bulletSpeed,
      life: 1.8,
    });
  }

  private advanceBullets(dt: number, now: number): void {
    const surviving: Bullet[] = [];
    for (const bullet of this.state.bullets) {
      const dx = bullet.vx * dt;
      const dy = bullet.vy * dt;
      let nearest = 2;
      let target: ArenaPlayer | undefined;
      for (const obstacle of OBSTACLES) {
        const t = hitBox(bullet.x, bullet.y, dx, dy, obstacle, ARENA.bulletRadius);
        if (t !== null && t < nearest) nearest = t;
      }
      for (const player of this.state.players) {
        if (player.id === bullet.ownerId || player.health <= 0) continue;
        const t = hitCircle(
          bullet.x,
          bullet.y,
          dx,
          dy,
          player.x,
          player.y,
          ARENA.playerRadius + ARENA.bulletRadius,
        );
        if (t !== null && t < nearest) {
          nearest = t;
          target = player;
        }
      }
      if (nearest <= 1) {
        if (target) this.damage(target, bullet.ownerId, now);
        continue;
      }
      bullet.x += dx;
      bullet.y += dy;
      bullet.life -= dt;
      if (
        bullet.life > 0 &&
        bullet.x >= 0 &&
        bullet.y >= 0 &&
        bullet.x <= ARENA.width &&
        bullet.y <= ARENA.height
      )
        surviving.push(bullet);
    }
    this.state.bullets = surviving;
  }

  private damage(victim: ArenaPlayer, ownerId: string, now: number): void {
    victim.health = Math.max(0, victim.health - ARENA.damage);
    if (victim.health > 0) return;
    victim.deaths++;
    victim.respawnAt = now + ARENA.respawnMs;
    this.clearInput(victim.id);
    const owner = this.state.players.find((p) => p.id === ownerId);
    if (owner) owner.score++;
    this.state.kills.push({
      id: `k${++this.serial}`,
      killer: owner?.name ?? 'Disconnected player',
      victim: victim.name,
      at: now,
    });
    this.state.kills = this.state.kills.slice(-8);
  }

  private respawn(player: ArenaPlayer): void {
    const others = this.state.players.filter((p) => p.id !== player.id && p.health > 0);
    // Prefer the spawn with greatest distance from a living opponent.
    const spawn = [...SPAWNS].sort((a, b) => {
      const distance = (p: { x: number; y: number }) =>
        Math.min(...others.map((o) => (o.x - p.x) ** 2 + (o.y - p.y) ** 2), Infinity);
      return distance(b) - distance(a);
    })[0];
    player.x = spawn.x;
    player.y = spawn.y;
    player.health = 100;
    player.respawnAt = 0;
  }
}
