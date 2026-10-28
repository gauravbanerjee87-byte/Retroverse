import type { ArenaPlayer, WorldObject } from '@retroverse/shared';
import { ArcadeGame, distance, type GameEngine, type Participant } from './base';

export const RACING_IDS = [
  'asphalt-rivals',
  'metro-roam',
  'sunset-borough',
  'night-circuit',
  'pocket-drift',
  'tumble-circuit',
  'rooftop-rush',
] as const;
type RacingId = (typeof RACING_IDS)[number];
const GATES = [
  { x: 120, y: 100 },
  { x: 840, y: 100 },
  { x: 840, y: 500 },
  { x: 120, y: 500 },
];
const CITY_POINTS = [
  { x: 120, y: 90 },
  { x: 480, y: 90 },
  { x: 840, y: 90 },
  { x: 840, y: 300 },
  { x: 840, y: 510 },
  { x: 480, y: 510 },
  { x: 120, y: 510 },
  { x: 120, y: 300 },
  { x: 480, y: 300 },
];
const overlaps = (p: { x: number; y: number }, w: WorldObject, radius = 14) =>
  p.x + radius > w.x &&
  p.x - radius < w.x + (w.width ?? 0) &&
  p.y + radius > w.y &&
  p.y - radius < w.y + (w.height ?? 0);

/** Ordered gates and an impassable infield make the circuit an actual race. */
class CircuitRace extends ArcadeGame {
  private progress = new Map<string, number>();
  private strikes = new Map<string, number>();
  private boostUntil = new Map<string, number>();
  private boostReady = new Map<string, number>();
  private drift = new Map<string, number>();
  private driftHeld = new Set<string>();
  private pickupReady = new Map<string, number>();
  private pursuerIndex = [1, 3];
  private pursuitHitReady = new Map<string, number>();
  private pursuers = [
    { x: 840, y: 100 },
    { x: 120, y: 500 },
  ];
  private walls: WorldObject[];
  private targetGates: number;
  constructor(
    players: Participant[],
    now: number,
    duration: number,
    private game: RacingId,
  ) {
    super(players, now, duration, game);
    this.targetGates = game === 'pocket-drift' ? 8 : 12;
    this.walls = [
      this.object('wall', 235, 205, {
        width: 490,
        height: 190,
        color: '#182c32',
        label: 'INFIELD — NO SHORTCUTS',
      }),
    ];
    this.state.players.forEach((p, i) => {
      p.x = 115 + (i % 3) * 28;
      p.y = 100 + Math.floor(i / 3) * 30;
      this.progress.set(p.id, 0);
    });
    this.state.info = {
      label: 'Gates',
      goal: this.targetGates,
      message:
        game === 'asphalt-rivals'
          ? 'WASD / arrows to ride. Click / Space to strike a nearby rival. Pass gates 2 → 3 → 4 → 1 in order; three laps wins.'
          : game === 'pocket-drift'
            ? 'WASD / arrows to steer. Hold Click / Space to drift; release after charging for a turbo. Collect boost stars. Two laps wins.'
            : 'WASD / arrows to drive. Click / Space for a timed boost. Avoid pursuit cars; pass numbered gates in order. Three laps wins.',
    };
    this.draw(now);
  }
  private draw(now: number) {
    const road = this.object('zone', 35, 35, {
      id: 'road',
      width: 890,
      height: 530,
      color: '#182333',
      label: '',
    });
    const gates = GATES.map((g, i) =>
      this.object('zone', g.x - 42, g.y - 42, {
        id: `gate-${i}`,
        width: 84,
        height: 84,
        color: '#244451',
        label: `GATE ${i + 1}`,
      }),
    );
    const markers = this.state.players.map((p) => {
      const next = (this.progress.get(p.id) ?? 0) + 1;
      const gate = GATES[next % 4];
      return this.object('marker', gate.x, gate.y, {
        id: `next-${p.id}`,
        radius: 8,
        color: p.color,
        label: `${p.name}: ${next}/${this.targetGates}`,
      });
    });
    const extras: WorldObject[] = [];
    if (this.game === 'pocket-drift')
      for (const [i, point] of [
        { x: 480, y: 100 },
        { x: 840, y: 300 },
        { x: 480, y: 500 },
        { x: 120, y: 300 },
      ].entries())
        if (now >= (this.pickupReady.get(`boost-${i}`) ?? 0))
          extras.push(
            this.object('pickup', point.x, point.y, {
              id: `boost-${i}`,
              radius: 12,
              color: '#ffd477',
              label: 'TURBO',
            }),
          );
    if (this.game === 'night-circuit')
      this.pursuers.forEach((p, i) =>
        extras.push(
          this.object('hazard', p.x, p.y, {
            id: `pursuit-${i}`,
            radius: 17,
            color: '#ff6b83',
            label: 'PURSUIT',
          }),
        ),
      );
    this.state.objects = [road, ...this.walls, ...gates, ...extras, ...markers];
  }
  protected update(dt: number, now: number) {
    for (const p of this.state.players) {
      const input = this.read(p.id, now);
      if (p.respawnAt > now) continue;
      if (p.health <= 0) {
        const last = GATES[(this.progress.get(p.id) ?? 0) % 4];
        p.x = last.x;
        p.y = last.y;
        p.health = 100;
        p.respawnAt = 0;
      }
      if (
        this.game === 'night-circuit' &&
        this.pressed(p.id) &&
        now >= (this.boostReady.get(p.id) ?? 0)
      ) {
        this.boostUntil.set(p.id, now + 1200);
        this.boostReady.set(p.id, now + 4500);
      }
      if (this.game === 'pocket-drift') {
        if (input.fire && (input.left || input.right || input.up || input.down)) {
          this.driftHeld.add(p.id);
          this.drift.set(p.id, Math.min(1.5, (this.drift.get(p.id) ?? 0) + dt));
        } else if (this.driftHeld.delete(p.id)) {
          if ((this.drift.get(p.id) ?? 0) > 0.65) this.boostUntil.set(p.id, now + 1300);
          this.drift.set(p.id, 0);
        }
      }
      const boosting = now < (this.boostUntil.get(p.id) ?? 0);
      const speed = boosting ? 330 : this.game === 'pocket-drift' && input.fire ? 155 : 220;
      const old = { x: p.x, y: p.y };
      this.move(p, dt, now, speed, this.walls);
      if (distance(old, p) > 0.01) p.angle = Math.atan2(p.y - old.y, p.x - old.x);
      const progress = this.progress.get(p.id) ?? 0,
        next = GATES[(progress + 1) % 4];
      if (distance(p, next) < 50) {
        this.progress.set(p.id, progress + 1);
        p.score = progress + 1;
        if (p.score >= this.targetGates) {
          this.finish([p.id]);
          return;
        }
      }
      if (
        this.game === 'asphalt-rivals' &&
        this.pressed(p.id) &&
        now >= (this.strikes.get(p.id) ?? 0)
      ) {
        this.strikes.set(p.id, now + 650);
        for (const rival of this.state.players)
          if (rival.id !== p.id && rival.health > 0 && distance(p, rival) < 65) {
            rival.health = Math.max(0, rival.health - 35);
            if (!rival.health) {
              rival.deaths++;
              rival.respawnAt = now + 900;
              this.state.kills.push({
                id: `crash-${++this.serial}`,
                killer: p.name,
                victim: rival.name,
                at: now,
              });
              this.state.kills = this.state.kills.slice(-8);
            }
          }
      }
      if (this.game === 'pocket-drift')
        for (const pickup of this.state.objects ?? [])
          if (
            pickup.kind === 'pickup' &&
            now >= (this.pickupReady.get(pickup.id) ?? 0) &&
            distance(p, pickup) < 28
          ) {
            this.boostUntil.set(p.id, now + 1600);
            this.pickupReady.set(pickup.id, now + 6000);
          }
    }
    if (this.game === 'night-circuit')
      this.pursuers.forEach((car, i) => {
        const target = GATES[(this.pursuerIndex[i] + 1) % 4];
        const d = distance(car, target);
        if (d < 10) this.pursuerIndex[i] = (this.pursuerIndex[i] + 1) % 4;
        else {
          car.x += ((target.x - car.x) / d) * 190 * dt;
          car.y += ((target.y - car.y) / d) * 190 * dt;
        }
        for (const p of this.state.players)
          if (
            p.health > 0 &&
            p.respawnAt <= now &&
            distance(p, car) < 30 &&
            now >= (this.pursuitHitReady.get(p.id) ?? 0)
          ) {
            this.pursuitHitReady.set(p.id, now + 500);
            p.health = Math.max(0, p.health - 22);
            this.boostUntil.set(p.id, 0);
            if (!p.health) {
              p.deaths++;
              p.respawnAt = now + 800;
            } else {
              p.x = Math.max(20, Math.min(940, p.x + (p.x - car.x) * 0.4));
              p.y = Math.max(20, Math.min(580, p.y + (p.y - car.y) * 0.4));
            }
          }
      });
    this.draw(now);
  }
}

/** A shared city map, with distinct exploration and pickup/delivery rule sets. */
class CityDrive extends ArcadeGame {
  private reached = new Map<string, number>();
  private carrying = new Set<string>();
  private walls: WorldObject[];
  constructor(
    players: Participant[],
    now: number,
    duration: number,
    private delivery: boolean,
  ) {
    super(players, now, duration, delivery ? 'sunset-borough' : 'metro-roam');
    this.walls = [
      { x: 235, y: 170 },
      { x: 590, y: 170 },
      { x: 235, y: 350 },
      { x: 590, y: 350 },
    ].map((p, i) =>
      this.object('wall', p.x, p.y, {
        width: 135,
        height: 100,
        color: '#29364e',
        label: ['MARKET', 'STATION', 'ARCADE', 'DEPOT'][i],
      }),
    );
    this.state.players.forEach((p, i) => {
      p.x = 90 + i * 28;
      p.y = 90;
      this.reached.set(p.id, i);
    });
    this.state.info = {
      label: delivery ? 'Deliveries' : 'Checkpoints',
      goal: delivery ? 5 : 10,
      message: delivery
        ? 'WASD / arrows drive. At your colored parcel marker press Click / Space to collect, then drive to your destination and press again. Complete five deliveries.'
        : 'WASD / arrows explore the city. Reach your colored checkpoint to discover the next district. Hold Click / Space for precision braking. Ten checkpoints wins.',
    };
    this.draw();
  }
  private target(p: ArenaPlayer) {
    const n = this.reached.get(p.id) ?? 0;
    return CITY_POINTS[
      (n + (this.delivery && this.carrying.has(p.id) ? 4 : 1)) % CITY_POINTS.length
    ];
  }
  private draw() {
    this.state.objects = [
      this.object('zone', 35, 35, { id: 'city-road', width: 890, height: 530, color: '#142837' }),
      ...this.walls,
      ...this.state.players.map((p) => {
        const point = this.target(p);
        return this.object('zone', point.x - 26, point.y - 26, {
          id: `mission-${p.id}`,
          width: 52,
          height: 52,
          color: p.color,
          ownerId: p.id,
          label: this.delivery ? (this.carrying.has(p.id) ? 'DELIVER' : 'COLLECT') : 'CHECKPOINT',
        });
      }),
    ];
  }
  protected update(dt: number, now: number) {
    for (const p of this.state.players) {
      const input = this.read(p.id, now);
      const old = { x: p.x, y: p.y };
      this.move(p, dt, now, !this.delivery && input.fire ? 90 : 210, this.walls);
      if (distance(old, p) > 0.01) p.angle = Math.atan2(p.y - old.y, p.x - old.x);
      const action = this.pressed(p.id);
      if (distance(p, this.target(p)) > 45) continue;
      if (this.delivery) {
        if (!action) continue;
        if (this.carrying.has(p.id)) {
          this.carrying.delete(p.id);
          p.score++;
          this.reached.set(p.id, (this.reached.get(p.id) ?? 0) + 3);
        } else this.carrying.add(p.id);
      } else {
        p.score++;
        this.reached.set(p.id, (this.reached.get(p.id) ?? 0) + 2);
      }
      if (p.score >= (this.delivery ? 5 : 10)) {
        this.finish([p.id]);
        return;
      }
    }
    this.draw();
  }
}

/** Side-view gravity, solid platforms, grounded jumping and server-owned race results. */
class PlatformRace extends ArcadeGame {
  private velocity = new Map<string, number>();
  private grounded = new Set<string>();
  private checkpoints = new Map<string, number>();
  private lastHit = new Map<string, number>();
  private platforms: WorldObject[];
  private hazards: WorldObject[] = [];
  constructor(
    players: Participant[],
    now: number,
    duration: number,
    private rooftop: boolean,
  ) {
    super(players, now, duration, rooftop ? 'rooftop-rush' : 'tumble-circuit');
    this.platforms = [
      this.object('wall', 0, 560, { id: 'ground', width: 960, height: 40, color: '#273d51' }),
    ];
    if (rooftop)
      this.platforms.push(
        ...[
          { x: 85, y: 495, width: 130 },
          { x: 255, y: 425, width: 110 },
          { x: 425, y: 355, width: 110 },
          { x: 595, y: 285, width: 110 },
          { x: 765, y: 215, width: 130 },
        ].map((p, i) =>
          this.object('wall', p.x, p.y, {
            id: `roof-${i}`,
            width: p.width,
            height: 20,
            color: '#555381',
            label: `ROOF ${i + 1}`,
          }),
        ),
      );
    else
      this.platforms.push(
        ...[
          { x: 230, y: 495, width: 90 },
          { x: 470, y: 495, width: 110 },
          { x: 730, y: 495, width: 85 },
        ].map((p, i) =>
          this.object('wall', p.x, p.y, {
            id: `ledge-${i}`,
            width: p.width,
            height: 20,
            color: '#65517d',
          }),
        ),
      );
    this.state.players.forEach((p) => {
      p.x = 45;
      p.y = 544;
      this.grounded.add(p.id);
      this.velocity.set(p.id, 0);
      this.checkpoints.set(p.id, 0);
    });
    this.state.info = {
      label: rooftop ? 'Climb' : 'Progress',
      goal: rooftop ? 40 : 1000,
      message: rooftop
        ? 'A/D or ←/→ run. W / ↑ / Click / Space jumps when grounded. Land on each rooftop and reach the glowing finish on the highest roof.'
        : 'A/D or ←/→ run. W / ↑ / Click / Space jumps. Pass both checkpoint rings and reach the finish. Moving traps return you to your last checkpoint.',
    };
    this.draw(now);
  }
  private draw(now: number) {
    this.hazards = this.rooftop
      ? []
      : [
          this.object('hazard', 365, 530 - Math.sin((now - this.state.startedAt) / 600) * 35, {
            id: 'trap-a',
            radius: 18,
            color: '#ff668d',
            label: 'TRAP',
          }),
          this.object('hazard', 640 + Math.sin((now - this.state.startedAt) / 800) * 45, 535, {
            id: 'trap-b',
            radius: 19,
            color: '#ff9d5d',
            label: 'TRAP',
          }),
        ];
    this.state.objects = [
      ...this.platforms,
      ...this.hazards,
      ...(this.rooftop
        ? []
        : [
            this.object('zone', 315, 430, {
              id: 'check-a',
              width: 45,
              height: 130,
              color: '#3b806a',
              label: 'CHECK 1',
            }),
            this.object('zone', 665, 430, {
              id: 'check-b',
              width: 45,
              height: 130,
              color: '#3b806a',
              label: 'CHECK 2',
            }),
          ]),
      this.object('finish', this.rooftop ? 845 : 905, this.rooftop ? 155 : 470, {
        id: 'finish',
        width: 45,
        height: 90,
        color: '#77f2cc',
        label: 'FINISH',
      }),
    ];
  }
  protected update(dt: number, now: number) {
    this.draw(now);
    for (const p of this.state.players) {
      const input = this.read(p.id, now);
      const direction = Number(input.right) - Number(input.left);
      if ((this.pressed(p.id) || input.up) && this.grounded.has(p.id)) {
        this.velocity.set(p.id, -460);
        this.grounded.delete(p.id);
      }
      p.angle = direction < 0 ? Math.PI : 0;
      const nextX = Math.max(16, Math.min(944, p.x + direction * 200 * dt));
      // Horizontal collision matters for building sides as well as top landings.
      if (!this.platforms.some((w) => w.id !== 'ground' && overlaps({ x: nextX, y: p.y }, w)))
        p.x = nextX;
      const vy = (this.velocity.get(p.id) ?? 0) + 980 * dt;
      const oldY = p.y;
      let nextY = p.y + vy * dt;
      let nextVelocity = vy;
      this.grounded.delete(p.id);
      let landed = false;
      for (const platform of this.platforms) {
        if (p.x + 13 <= platform.x || p.x - 13 >= platform.x + (platform.width ?? 0)) continue;
        if (vy >= 0 && oldY + 16 <= platform.y + 1 && nextY + 16 >= platform.y) {
          nextY = Math.min(nextY, platform.y - 16);
          landed = true;
          this.grounded.add(p.id);
        } else if (
          vy < 0 &&
          oldY - 16 >= platform.y + (platform.height ?? 0) &&
          nextY - 16 <= platform.y + (platform.height ?? 0)
        ) {
          nextY = platform.y + (platform.height ?? 0) + 16;
          nextVelocity = 0;
        }
      }
      p.y = nextY;
      this.velocity.set(p.id, landed ? 0 : nextVelocity);
      if (this.rooftop) {
        p.score = Math.max(p.score, Math.floor((544 - p.y) / 10) + Math.floor(p.x / 100));
        if (p.x > 835 && p.y < 215) {
          p.score = 100;
          this.finish([p.id]);
          return;
        }
      } else {
        let checkpoint = this.checkpoints.get(p.id) ?? 0;
        if (checkpoint === 0 && p.x >= 315) checkpoint = 1;
        if (checkpoint === 1 && p.x >= 665) checkpoint = 2;
        this.checkpoints.set(p.id, checkpoint);
        p.score = Math.max(0, Math.floor(((p.x - 45) / 855) * 999));
        if (this.hazards.some((h) => distance(p, h) < 33) && now >= (this.lastHit.get(p.id) ?? 0)) {
          p.deaths++;
          p.x = [45, 330, 680][checkpoint];
          p.y = 440;
          this.velocity.set(p.id, 0);
          this.lastHit.set(p.id, now + 1000);
        }
        if (checkpoint === 2 && p.x > 900) {
          p.score = 1000;
          this.finish([p.id]);
          return;
        }
      }
      if (p.y > 600) {
        p.x = 45;
        p.y = 544;
        this.velocity.set(p.id, 0);
        p.deaths++;
      }
    }
  }
}

export function createRacingGame(
  gameId: string,
  players: Participant[],
  now: number,
  duration: number,
): GameEngine {
  if (gameId === 'asphalt-rivals' || gameId === 'pocket-drift' || gameId === 'night-circuit')
    return new CircuitRace(players, now, duration, gameId);
  if (gameId === 'metro-roam' || gameId === 'sunset-borough')
    return new CityDrive(players, now, duration, gameId === 'sunset-borough');
  if (gameId === 'tumble-circuit' || gameId === 'rooftop-rush')
    return new PlatformRace(players, now, duration, gameId === 'rooftop-rush');
  throw new Error(`Unsupported racing game: ${gameId}`);
}
