import type { ArenaPlayer, Bullet, WorldObject } from '@retroverse/shared';
import { ArcadeGame, distance, type GameEngine, type Participant } from './base';

export const ACTION_IDS = [
  'vector-patrol',
  'breach-protocol',
  'midnight-outbreak',
  'shadow-relay',
  'pulse-clash',
  'fuse-frenzy',
  'glimmer-maze',
] as const;
const within = (p: { x: number; y: number }, b: WorldObject, r = 0) =>
  p.x + r >= b.x &&
  p.x - r <= b.x + (b.width ?? 0) &&
  p.y + r >= b.y &&
  p.y - r <= b.y + (b.height ?? 0);
function segmentHit(b: Bullet, p: { x: number; y: number }, dt: number, r = 20) {
  const dx = b.vx * dt,
    dy = b.vy * dt;
  const t = Math.max(
    0,
    Math.min(1, ((p.x - b.x) * dx + (p.y - b.y) * dy) / (dx * dx + dy * dy || 1)),
  );
  return Math.hypot(b.x + t * dx - p.x, b.y + t * dy - p.y) < r;
}

/** An original moving-target rescue range and an advancing-creature survival range. */
class Gallery extends ArcadeGame {
  private readonly outbreak: boolean;
  private readonly shots = new Map<string, { at: number; ammo: number; reload: number }>();
  private nextWave: number;
  private wave = 0;
  private defeated = 0;
  private readonly targets: WorldObject[] = [];
  private readonly movement = new Map<string, { baseX: number; born: number; attack: number }>();
  constructor(players: Participant[], now: number, duration: number, gameId: string) {
    super(players, now, duration, gameId);
    this.outbreak = gameId === 'midnight-outbreak';
    this.nextWave = now;
    this.state.players.forEach((p, i) => {
      p.x = 160 + i * 220;
      p.y = 540;
    });
    this.state.info = {
      label: 'Rescues / hits',
      goal: this.outbreak ? 24 : 12,
      message: this.outbreak
        ? 'Aim and hold click to stop advancing creatures. Six shots, then automatic reload. Survive three waves together.'
        : 'Aim and hold click at magenta hostiles. Green civilians must survive. Six shots, then automatic reload. Clear three rescue scenes.',
      phase: 'wave',
      round: 1,
    };
    this.spawn(now);
  }
  private spawn(now: number) {
    this.wave++;
    const amount = this.outbreak ? 8 : 6;
    for (let i = 0; i < amount; i++) {
      const civilian = !this.outbreak && i % 3 === 2;
      const t = this.object(
        civilian ? 'pickup' : 'target',
        110 + i * (740 / amount),
        100 + (i % 2) * 100,
        {
          radius: civilian ? 22 : 25,
          color: civilian ? '#81f7ad' : this.outbreak ? '#cf8aff' : '#fa53b8',
          label: civilian ? 'CIVILIAN' : this.outbreak ? 'CREATURE' : 'HOSTILE',
          value: civilian ? 0 : 1,
        },
      );
      this.targets.push(t);
      this.movement.set(t.id, { baseX: t.x, born: now, attack: now + 5000 + i * 500 });
    }
    this.state.info!.round = this.wave;
    this.nextWave = Infinity;
  }
  protected update(dt: number, now: number) {
    this.state.bullets = this.state.bullets.filter((b) => (b.life -= dt) > 0);
    for (const target of [...this.targets]) {
      const move = this.movement.get(target.id)!;
      target.x = move.baseX + Math.sin((now - move.born) / 700) * 38;
      if (this.outbreak) {
        target.y += dt * (20 + this.wave * 7);
        if (target.y > 480) {
          this.hurtTeam(18);
          this.removeTarget(target);
        }
      } else if (target.kind === 'target' && now >= move.attack) {
        this.hurtTeam(8);
        move.attack = now + 2800;
      }
    }
    for (const p of this.state.players) {
      if (p.health <= 0) continue;
      const input = this.read(p.id, now);
      p.angle = input.angle;
      let weapon = this.shots.get(p.id);
      if (!weapon) {
        weapon = { at: -Infinity, ammo: 6, reload: 0 };
        this.shots.set(p.id, weapon);
      }
      if (weapon.reload && now >= weapon.reload) {
        weapon.ammo = 6;
        weapon.reload = 0;
      }
      if (input.fire && !weapon.reload && now - weapon.at >= 260) {
        weapon.at = now;
        weapon.ammo--;
        const aim = {
          x: input.targetX ?? p.x + Math.cos(input.angle) * 450,
          y: input.targetY ?? p.y + Math.sin(input.angle) * 450,
        };
        this.state.bullets.push({
          id: `s${++this.serial}`,
          ownerId: p.id,
          x: aim.x,
          y: aim.y,
          vx: 0,
          vy: 0,
          life: 0.12,
        });
        const hit = this.targets.find((t) => distance(t, aim) < (t.radius ?? 25));
        if (hit) {
          if (hit.kind === 'pickup') {
            p.score = Math.max(0, p.score - 15);
            this.hurtTeam(5);
          } else {
            p.score += 10;
            this.defeated++;
          }
          this.removeTarget(hit);
        }
        if (weapon.ammo === 0) weapon.reload = now + 1000;
      }
    }
    if (this.state.players.every((p) => p.health <= 0)) {
      this.state.info!.message = 'The squad was overwhelmed. Rematch to try again.';
      this.finish([]);
      return;
    }
    const hostiles = this.targets.some((t) => t.kind === 'target');
    if (!hostiles && this.nextWave === Infinity) {
      this.targets.length = 0;
      this.movement.clear();
      this.nextWave = now + 1200;
    }
    if (now >= this.nextWave) {
      if (this.wave >= 3) {
        this.state.info!.message = 'All three encounters cleared. The whole squad wins.';
        this.finish(this.state.players.filter((p) => p.health > 0).map((p) => p.id));
      } else this.spawn(now);
    }
    this.state.objects = [
      this.object('zone', 30, 30, {
        width: 900,
        height: 460,
        color: '#17243b',
        label: `SCENE ${this.wave} · ${this.defeated} hostile hits`,
      }),
      ...this.targets,
    ];
  }
  private hurtTeam(amount: number) {
    for (const p of this.state.players) p.health = Math.max(0, p.health - amount);
  }
  private removeTarget(target: WorldObject) {
    const i = this.targets.indexOf(target);
    if (i >= 0) this.targets.splice(i, 1);
    this.movement.delete(target.id);
  }
  protected expired() {
    this.state.info!.message = 'Time expired before all scenes were cleared.';
    this.finish([]);
  }
}

class Breach extends ArcadeGame {
  private readonly walls: WorldObject[];
  private readonly teams: Record<string, string> = {};
  private readonly shotAt = new Map<string, number>();
  private roundStart: number;
  private restartAt = 0;
  private round = 1;
  private plant = 0;
  private defuse = 0;
  private detonatesAt = 0;
  private readonly site: WorldObject;
  constructor(players: Participant[], now: number, duration: number, id: string) {
    super(players, now, duration, id);
    this.roundStart = now;
    this.walls = [
      this.object('wall', 260, 100, { width: 70, height: 170 }),
      this.object('wall', 260, 350, { width: 70, height: 150 }),
      this.object('wall', 600, 80, { width: 70, height: 180 }),
      this.object('wall', 600, 360, { width: 70, height: 160 }),
    ];
    this.site = this.object('zone', 420, 245, {
      width: 120,
      height: 110,
      color: '#6b3e64',
      label: 'RELAY SITE',
    });
    this.state.players.forEach((p, i) => {
      this.teams[p.id] = i % 2 ? 'Defenders' : 'Attackers';
    });
    this.reset(now);
  }
  private reset(now: number) {
    this.roundStart = now;
    this.plant = 0;
    this.defuse = 0;
    this.detonatesAt = 0;
    this.state.bullets = [];
    this.site.label = 'RELAY SITE';
    this.site.color = '#6b3e64';
    this.state.players.forEach((p, i) => {
      p.health = 100;
      p.x = this.teams[p.id] === 'Attackers' ? 85 : 875;
      p.y = 140 + (Math.floor(i / 2) % 4) * 95;
    });
    this.state.info = {
      label: 'Rounds won',
      teams: this.teams,
      round: this.round,
      phase: 'round',
      message:
        'WASD move, aim and hold click to fire. Attackers occupy relay for 3s to plant; defenders occupy for 3s to defuse. Cover blocks shots.',
    };
  }
  protected update(dt: number, now: number) {
    if (this.restartAt) {
      if (now >= this.restartAt) {
        this.restartAt = 0;
        this.round++;
        this.reset(now);
      }
      return;
    }
    for (const p of this.state.players) {
      if (p.health <= 0) continue;
      this.move(p, dt, now, 175, this.walls);
      const input = this.read(p.id, now);
      if (input.fire && now - (this.shotAt.get(p.id) ?? -Infinity) > 340) {
        this.shotAt.set(p.id, now);
        this.state.bullets.push({
          id: `b${++this.serial}`,
          ownerId: p.id,
          x: p.x,
          y: p.y,
          vx: Math.cos(input.angle) * 550,
          vy: Math.sin(input.angle) * 550,
          life: 1.7,
        });
      }
    }
    this.state.bullets = this.state.bullets.filter((b) => {
      b.life -= dt;
      const next = { x: b.x + b.vx * dt, y: b.y + b.vy * dt };
      if (b.life <= 0 || this.walls.some((w) => within(next, w, 5))) return false;
      const target = this.state.players.find(
        (p) => p.health > 0 && this.teams[p.id] !== this.teams[b.ownerId] && segmentHit(b, p, dt),
      );
      if (target) {
        target.health = Math.max(0, target.health - 34);
        if (!target.health) target.deaths++;
        return false;
      }
      b.x = next.x;
      b.y = next.y;
      return b.x > 0 && b.x < 960 && b.y > 0 && b.y < 600;
    });
    const live = (team: string) =>
      this.state.players.filter((p) => p.health > 0 && this.teams[p.id] === team);
    const attackers = live('Attackers'),
      defenders = live('Defenders');
    const inside = (p: ArenaPlayer) => within(p, this.site);
    if (!this.detonatesAt) {
      this.plant = attackers.some(inside) && !defenders.some(inside) ? this.plant + dt : 0;
      if (this.plant >= 3) {
        this.detonatesAt = now + 12000;
        this.site.label = 'PLANTED · DEFENDERS OCCUPY TO DEFUSE';
        this.site.color = '#e24b88';
      }
    } else {
      this.defuse = defenders.some(inside) && !attackers.some(inside) ? this.defuse + dt : 0;
      if (this.defuse >= 3) {
        this.award('Defenders', now);
        return;
      }
      if (now >= this.detonatesAt) {
        this.award('Attackers', now);
        return;
      }
    }
    if (!defenders.length) this.award('Attackers', now);
    else if (!attackers.length && !this.detonatesAt) this.award('Defenders', now);
    else if (now - this.roundStart > 25000 && !this.detonatesAt) this.award('Defenders', now);
    this.state.objects = [...this.walls, this.site];
  }
  private award(team: string, now: number) {
    for (const p of this.state.players) if (this.teams[p.id] === team) p.score++;
    this.state.info!.message = `${team} win round ${this.round}.`;
    if (this.state.players.some((p) => p.score >= 3)) {
      this.finish(this.state.players.filter((p) => this.teams[p.id] === team).map((p) => p.id));
      return;
    }
    this.restartAt = now + 1500;
  }
  protected expired() {
    const best = Math.max(...this.state.players.map((p) => p.score));
    const teams = new Set(
      this.state.players.filter((p) => p.score === best).map((p) => this.teams[p.id]),
    );
    this.finish(this.state.players.filter((p) => teams.has(this.teams[p.id])).map((p) => p.id));
  }
}

class Stealth extends ArcadeGame {
  private readonly walls: WorldObject[];
  private readonly intel: WorldObject[];
  private readonly guards: WorldObject[];
  private readonly lastHurt = new Map<string, number>();
  private gathered = 0;
  constructor(players: Participant[], now: number, duration: number, id: string) {
    super(players, now, duration, id);
    this.walls = [
      this.object('wall', 210, 130, { width: 70, height: 260 }),
      this.object('wall', 440, 220, { width: 80, height: 220 }),
      this.object('wall', 690, 80, { width: 60, height: 220 }),
    ];
    this.intel = [
      [330, 110],
      [820, 100],
      [840, 470],
      [340, 490],
    ].map(([x, y]) =>
      this.object('pickup', x, y, { radius: 15, color: '#79f7c1', label: 'INTEL' }),
    );
    this.guards = [
      [370, 300],
      [610, 160],
      [760, 430],
    ].map(([x, y]) =>
      this.object('hazard', x, y, { radius: 18, color: '#f58b7b', label: 'GUARD' }),
    );
    this.state.players.forEach((p, i) => {
      p.x = 70;
      p.y = 230 + i * 55;
    });
    this.state.info = {
      label: 'Intel collected',
      goal: 4,
      message:
        'WASD to scout. Avoid red patrols and their forward detection zones. Collect four intel caches, then everyone reaches green extraction.',
      phase: 'infiltrate',
    };
  }
  protected update(dt: number, now: number) {
    for (let i = 0; i < this.guards.length; i++) {
      const g = this.guards[i];
      g.x = [370, 610, 760][i] + Math.sin((now - this.state.startedAt) / 1800 + i) * 65;
      g.y = [300, 160, 430][i] + Math.cos((now - this.state.startedAt) / 2200 + i) * 65;
      g.value = (now - this.state.startedAt) / 1600 + i;
    }
    for (const p of this.state.players) {
      if (p.health <= 0) continue;
      const input = this.read(p.id, now);
      this.move(p, dt, now, input.fire ? 95 : 185, this.walls);
      for (const intel of [...this.intel])
        if (distance(p, intel) < 30) {
          this.intel.splice(this.intel.indexOf(intel), 1);
          this.gathered++;
          p.score += 25;
        }
      for (const guard of this.guards) {
        const angle = Math.atan2(p.y - guard.y, p.x - guard.x),
          diff = Math.atan2(
            Math.sin(angle - (guard.value ?? 0)),
            Math.cos(angle - (guard.value ?? 0)),
          );
        const visible =
          distance(p, guard) < 150 &&
          Math.abs(diff) < 0.7 &&
          !this.walls.some((w) => {
            for (let t = 0.1; t < 1; t += 0.1)
              if (within({ x: guard.x + (p.x - guard.x) * t, y: guard.y + (p.y - guard.y) * t }, w))
                return true;
            return false;
          });
        if (visible && now - (this.lastHurt.get(p.id) ?? -Infinity) > 900) {
          this.lastHurt.set(p.id, now);
          p.health = Math.max(0, p.health - 20);
          p.score = Math.max(0, p.score - 5);
        }
      }
    }
    const living = this.state.players.filter((p) => p.health > 0);
    if (!living.length) {
      this.state.info!.message = 'The squad was detected. Mission failed.';
      this.finish([]);
      return;
    }
    const extraction = this.object('finish', 25, 215, {
      width: 100,
      height: 200,
      color: '#27875c',
      label: this.gathered === 4 ? 'EXTRACT HERE' : 'EXTRACTION LOCKED',
    });
    if (this.gathered === 4 && living.every((p) => within(p, extraction))) {
      this.state.info!.message = 'Intel recovered. Squad extraction complete.';
      this.finish(living.map((p) => p.id));
      return;
    }
    this.state.info!.phase = this.gathered === 4 ? 'extract' : 'infiltrate';
    this.state.objects = [
      ...this.walls,
      extraction,
      ...this.intel,
      ...this.guards,
      ...this.guards.map((g) =>
        this.object('zone', g.x + Math.cos(g.value ?? 0) * 70, g.y + Math.sin(g.value ?? 0) * 70, {
          radius: 65,
          color: '#b9383844',
          label: 'DETECTION',
        }),
      ),
    ];
  }
  protected expired() {
    this.state.info!.message = 'Extraction time expired.';
    this.finish([]);
  }
}

class Fighter extends ArcadeGame {
  private readonly vy = new Map<string, number>();
  private readonly attacks = new Map<string, { at: number; combo: number }>();
  private round = 1;
  private resetAt = 0;
  constructor(players: Participant[], now: number, duration: number, id: string) {
    super(players, now, duration, id);
    this.reset();
  }
  private reset() {
    this.state.players.forEach((p, i) => {
      p.x = i ? 700 : 260;
      p.y = 490;
      p.health = 100;
      this.vy.set(p.id, 0);
    });
    this.state.info = {
      label: 'Rounds won',
      round: this.round,
      message:
        'A/D move, W/Up jumps. Hold S/Down to block on the ground. Click/Space punches; timed repeated hits build a three-hit combo. First to three rounds wins.',
    };
    this.state.objects = [
      this.object('wall', 40, 510, {
        width: 880,
        height: 35,
        color: '#7553a1',
        label: 'PULSE RING',
      }),
    ];
  }
  protected update(dt: number, now: number) {
    if (this.resetAt) {
      if (now >= this.resetAt) {
        this.resetAt = 0;
        this.round++;
        this.reset();
      }
      return;
    }
    for (const p of this.state.players) {
      const input = this.read(p.id, now);
      const grounded = p.y >= 490;
      p.x = Math.max(
        60,
        Math.min(900, p.x + (Number(input.right) - Number(input.left)) * 230 * dt),
      );
      let velocity = this.vy.get(p.id) ?? 0;
      if (grounded && input.up) velocity = -420;
      velocity += 1000 * dt;
      p.y = Math.min(490, p.y + velocity * dt);
      if (p.y === 490) velocity = 0;
      this.vy.set(p.id, velocity);
      const opponent = this.state.players.find((q) => q.id !== p.id);
      if (!opponent) continue;
      p.angle = opponent.x < p.x ? Math.PI : 0;
      const prior = this.attacks.get(p.id) ?? { at: -Infinity, combo: 0 };
      if (input.fire && now - prior.at >= 330) {
        const combo = now - prior.at < 650 ? (prior.combo % 3) + 1 : 1;
        this.attacks.set(p.id, { at: now, combo });
        this.state.objects = this.state.objects!.filter((o) => o.kind === 'wall');
        this.state.objects.push(
          this.object('zone', p.x + (opponent.x > p.x ? 34 : -54), p.y - 20, {
            width: 45,
            height: 40,
            color: '#f7c16d',
            label: `COMBO ${combo}`,
          }),
        );
        if (Math.abs(p.x - opponent.x) < 95 && Math.abs(p.y - opponent.y) < 60) {
          const blocked = this.read(opponent.id, now).down && opponent.y >= 490;
          opponent.health = Math.max(
            0,
            opponent.health - Math.round((9 + combo * 4) * (blocked ? 0.25 : 1)),
          );
          opponent.x = Math.max(60, Math.min(900, opponent.x + (opponent.x > p.x ? 14 : -14)));
          if (!opponent.health) {
            p.score++;
            opponent.deaths++;
            if (p.score >= 3) this.finish([p.id]);
            else this.resetAt = now + 1000;
            return;
          }
        }
      }
    }
  }
}

interface TimedBomb {
  object: WorldObject;
  at: number;
  owner: string;
  cx: number;
  cy: number;
}
class Bombs extends ArcadeGame {
  private readonly walls: WorldObject[] = [];
  private readonly crates: WorldObject[] = [];
  private readonly bombs: TimedBomb[] = [];
  private readonly flames: { object: WorldObject; until: number }[] = [];
  private readonly grace = new Map<string, number>();
  private readonly tile = 48;
  constructor(players: Participant[], now: number, duration: number, id: string) {
    super(players, now, duration, id);
    for (let y = 0; y < 11; y++)
      for (let x = 0; x < 17; x++) {
        const point = { x: 72 + x * 48, y: 36 + y * 48 };
        if (!x || !y || x === 16 || y === 10 || (x % 2 === 0 && y % 2 === 0))
          this.walls.push(
            this.object('wall', point.x, point.y, { width: 48, height: 48, color: '#465071' }),
          );
        else if ((x + y) % 3 === 0 && !((x < 4 || x > 12) && (y < 4 || y > 6)))
          this.crates.push(
            this.object('wall', point.x, point.y, {
              width: 48,
              height: 48,
              color: '#98633d',
              label: 'CRATE',
            }),
          );
      }
    const spawns = [
      [1, 1],
      [15, 9],
      [15, 1],
      [1, 9],
      [7, 1],
      [7, 9],
      [1, 5],
      [15, 5],
    ];
    this.state.players.forEach((p, i) => {
      p.x = 72 + spawns[i % 8][0] * 48 + 24;
      p.y = 36 + spawns[i % 8][1] * 48 + 24;
    });
    this.state.info = {
      label: 'Blast score',
      message:
        'Move with WASD. Click/Space places a 2-second bomb. Blasts travel three tiles, break crates, chain bombs, and eliminate players. Last survivor wins.',
    };
  }
  protected update(dt: number, now: number) {
    for (const p of this.state.players) {
      if (p.health <= 0) continue;
      this.move(p, dt, now, 170, [...this.walls, ...this.crates]);
      if (this.pressed(p.id) && this.bombs.filter((b) => b.owner === p.id).length < 2) {
        const cx = Math.floor((p.x - 72) / 48),
          cy = Math.floor((p.y - 36) / 48);
        if (!this.bombs.some((b) => b.cx === cx && b.cy === cy))
          this.bombs.push({
            object: this.object('bomb', 72 + cx * 48 + 24, 36 + cy * 48 + 24, {
              radius: 16,
              color: '#ef82c6',
              label: '2s',
              ownerId: p.id,
            }),
            at: now + 2000,
            owner: p.id,
            cx,
            cy,
          });
      }
    }
    let pending = this.bombs.find((b) => b.at <= now);
    let guard = 0;
    while (pending && guard++ < 16) {
      this.explode(pending, now);
      pending = this.bombs.find((b) => b.at <= now);
    }
    for (const flame of this.flames) {
      if (flame.until < now) continue;
      for (const p of this.state.players)
        if (
          p.health > 0 &&
          within(p, flame.object, 10) &&
          now - (this.grace.get(p.id) ?? -Infinity) > 400
        ) {
          p.health = 0;
          p.deaths++;
          this.grace.set(p.id, now);
          const owner = this.state.players.find((q) => q.id === flame.object.ownerId);
          if (owner && owner.id !== p.id) owner.score += 100;
        }
    }
    for (let i = this.flames.length - 1; i >= 0; i--)
      if (this.flames[i].until < now) this.flames.splice(i, 1);
    const alive = this.state.players.filter((p) => p.health > 0);
    if (alive.length <= 1) {
      if (alive[0]) alive[0].score += 500;
      this.finish(alive.map((p) => p.id));
    }
    this.state.objects = [
      ...this.walls,
      ...this.crates,
      ...this.bombs.map((b) => {
        b.object.label = `${Math.max(0, (b.at - now) / 1000).toFixed(1)}s`;
        return b.object;
      }),
      ...this.flames.map((f) => f.object),
    ];
  }
  private explode(bomb: TimedBomb, now: number) {
    this.bombs.splice(this.bombs.indexOf(bomb), 1);
    const burn = (cx: number, cy: number) => {
      const x = 72 + cx * 48,
        y = 36 + cy * 48;
      if (this.walls.some((w) => w.x === x && w.y === y)) return false;
      this.flames.push({
        object: this.object('hazard', x, y, {
          width: 48,
          height: 48,
          color: '#ffb657',
          ownerId: bomb.owner,
        }),
        until: now + 500,
      });
      const crate = this.crates.find((w) => w.x === x && w.y === y);
      if (crate) {
        this.crates.splice(this.crates.indexOf(crate), 1);
        const p = this.state.players.find((p) => p.id === bomb.owner);
        if (p) p.score += 10;
        return false;
      }
      for (const other of this.bombs) if (other.cx === cx && other.cy === cy) other.at = now;
      return true;
    };
    burn(bomb.cx, bomb.cy);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ])
      for (let n = 1; n <= 3; n++) if (!burn(bomb.cx + dx * n, bomb.cy + dy * n)) break;
  }
}

class Maze extends ArcadeGame {
  private readonly walls: WorldObject[] = [];
  private readonly pellets: WorldObject[] = [];
  private readonly enemies: WorldObject[] = [];
  private readonly hurt = new Map<string, number>();
  private readonly exit: WorldObject;
  constructor(players: Participant[], now: number, duration: number, id: string) {
    super(players, now, duration, id);
    // Independent walls with gaps form readable corridors; no proprietary map.
    for (const x of [190, 390, 590, 790])
      for (const [y, h] of [
        [30, 170],
        [280, 100],
        [460, 110],
      ])
        this.walls.push(this.object('wall', x, y, { width: 32, height: h, color: '#584895' }));
    for (const y of [100, 230, 420, 540])
      for (const x of [90, 285, 485, 685, 885])
        this.pellets.push(this.object('pickup', x, y, { radius: 9, color: '#ffe18c', value: 10 }));
    for (let i = 0; i < 3; i++)
      this.enemies.push(
        this.object('hazard', 300 + i * 210, 235, {
          radius: 18,
          color: '#f66b9c',
          label: 'SENTINEL',
        }),
      );
    this.exit = this.object('finish', 880, 470, {
      width: 65,
      height: 100,
      color: '#285b4a',
      label: 'EXIT · NEED 50',
    });
    this.state.players.forEach((p, i) => {
      p.x = 60;
      p.y = 70 + i * 55;
    });
    this.state.info = {
      label: 'Maze points',
      goal: 50,
      message:
        'WASD through the corridors. Collect sparks for 10 points each. Sentinels steal health and 10 points. Reach the green exit with at least 50 points to win.',
    };
  }
  protected update(dt: number, now: number) {
    for (let i = 0; i < this.enemies.length; i++) {
      this.enemies[i].y = 230 + Math.sin((now - this.state.startedAt) / 1600 + i) * 160;
      this.enemies[i].x = 300 + i * 210 + Math.cos((now - this.state.startedAt) / 2100 + i) * 35;
    }
    for (const p of this.state.players) {
      if (p.health <= 0) {
        if (now >= p.respawnAt) {
          p.health = 100;
          p.x = 60;
          p.y = 70;
        } else continue;
      }
      this.move(p, dt, now, 175, this.walls);
      for (const pellet of [...this.pellets])
        if (distance(p, pellet) < 25) {
          p.score += 10;
          this.pellets.splice(this.pellets.indexOf(pellet), 1);
        }
      if (
        this.enemies.some((e) => distance(e, p) < 32) &&
        now - (this.hurt.get(p.id) ?? -Infinity) > 900
      ) {
        this.hurt.set(p.id, now);
        p.health = Math.max(0, p.health - 25);
        p.score = Math.max(0, p.score - 10);
        if (p.health === 0) {
          p.deaths++;
          p.respawnAt = now + 1200;
        }
      }
      if (p.score >= 50 && within(p, this.exit)) {
        p.score += 50;
        this.finish([p.id]);
      }
    }
    this.state.objects = [...this.walls, ...this.pellets, ...this.enemies, this.exit];
  }
}

export function createActionGame(
  gameId: string,
  players: Participant[],
  now: number,
  duration: number,
): GameEngine {
  switch (gameId) {
    case 'vector-patrol':
    case 'midnight-outbreak':
      return new Gallery(players, now, duration, gameId);
    case 'breach-protocol':
      return new Breach(players, now, duration, gameId);
    case 'shadow-relay':
      return new Stealth(players, now, duration, gameId);
    case 'pulse-clash':
      return new Fighter(players, now, duration, gameId);
    case 'fuse-frenzy':
      return new Bombs(players, now, duration, gameId);
    case 'glimmer-maze':
      return new Maze(players, now, duration, gameId);
    default:
      throw new Error(`Unknown action game: ${gameId}`);
  }
}
