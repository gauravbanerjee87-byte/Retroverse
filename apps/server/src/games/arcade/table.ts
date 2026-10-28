import { randomInt } from 'node:crypto';
import type { WorldObject } from '@retroverse/shared';
import { ArcadeGame, distance, type GameEngine, type Participant } from './base';

export const TABLE_IDS = [
  'homebound-dice',
  'corner-pocket',
  'hidden-signal',
  'orbit-putt',
] as const;
const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
const trackPoint = (cell: number) => ({
  x: 480 + Math.cos((cell / 52) * Math.PI * 2 - Math.PI / 2) * 230,
  y: 300 + Math.sin((cell / 52) * Math.PI * 2 - Math.PI / 2) * 230,
});

export class DiceGame extends ArcadeGame {
  readonly tokens = new Map<string, number[]>();
  private readonly order: string[];
  private turn = 0;
  private die = 0;
  private deadline: number;
  constructor(
    players: Participant[],
    now: number,
    duration: number,
    private readonly roll = () => randomInt(1, 7),
  ) {
    super(players, now, duration, 'homebound-dice');
    this.order = players.map((p) => p.id);
    this.deadline = now + 15000;
    for (const p of players) this.tokens.set(p.id, [-1, -1, -1, -1]);
    this.state.info = {
      label: 'Progress',
      phase: 'roll',
      turnId: players[0]?.id,
      message:
        'Current player: click or Space to roll. Roll six to leave the yard. Then choose a legal token.',
    };
    this.publish();
  }
  private get current() {
    return this.state.players[this.turn % this.state.players.length];
  }
  private legal(id: string, index: number) {
    const progress = this.tokens.get(id)?.[index];
    return (
      progress !== undefined &&
      progress < 57 &&
      (progress === -1 ? this.die === 6 : progress + this.die <= 57)
    );
  }
  private next(now: number) {
    this.turn = (this.turn + 1) % Math.max(1, this.state.players.length);
    this.die = 0;
    this.deadline = now + 15000;
  }
  protected update(_dt: number, now: number) {
    if (!this.current) {
      this.finish([]);
      return;
    }
    const active = this.current;
    for (const p of this.state.players) {
      if (!this.pressed(p.id) || p.id !== active.id) continue;
      const input = this.read(p.id, now);
      if (this.die === 0) {
        this.die = this.roll();
        if (![0, 1, 2, 3].some((i) => this.legal(p.id, i))) {
          this.state.info!.message = `${p.name} rolled ${this.die}; no legal move. Turn passes.`;
          this.next(now);
        } else
          this.state.info!.message = `${p.name} rolled ${this.die}. Choose token 1–4. Exact roll required to reach home.`;
      } else if (input.choice !== undefined && input.choice < 4 && this.legal(p.id, input.choice)) {
        const tokens = this.tokens.get(p.id)!;
        tokens[input.choice] = tokens[input.choice] === -1 ? 0 : tokens[input.choice] + this.die;
        const progress = tokens[input.choice];
        if (progress < 52) {
          const global = (progress + this.order.indexOf(p.id) * 13) % 52;
          if (!SAFE.has(global))
            for (const rival of this.state.players) {
              if (rival.id === p.id) continue;
              const enemy = this.tokens.get(rival.id)!;
              for (let t = 0; t < 4; t++)
                if (
                  enemy[t] >= 0 &&
                  enemy[t] < 52 &&
                  (enemy[t] + this.order.indexOf(rival.id) * 13) % 52 === global
                )
                  enemy[t] = -1;
            }
        }
        if (tokens.every((v) => v === 57)) {
          this.publish();
          this.finish([p.id]);
          return;
        }
        if (this.die === 6) {
          this.die = 0;
          this.deadline = now + 15000;
          this.state.info!.message = `${p.name} moved. Six earns another roll.`;
        } else this.next(now);
      } else
        this.state.info!.message = 'That token cannot move on this roll. Choose another token.';
    }
    if (now >= this.deadline) {
      this.state.info!.message = 'Turn timed out and passed.';
      this.next(now);
    }
    this.publish();
  }
  private publish() {
    const objects: WorldObject[] = Array.from({ length: 52 }, (_, i) =>
      this.object('tile', trackPoint(i).x - 10, trackPoint(i).y - 10, {
        width: 20,
        height: 20,
        color: SAFE.has(i) ? '#436f70' : '#263449',
        label: SAFE.has(i) ? 'SAFE' : undefined,
      }),
    );
    for (const p of this.state.players) {
      const seat = this.order.indexOf(p.id);
      const angle = (seat / 4) * Math.PI * 2 - Math.PI / 2;
      const tokens = this.tokens.get(p.id)!;
      for (let i = 0; i < 4; i++) {
        const progress = tokens[i];
        let point;
        if (progress === -1)
          point = {
            x: 480 + Math.cos(angle) * 320 + (i % 2) * 22,
            y: 300 + Math.sin(angle) * 265 + Math.floor(i / 2) * 22,
          };
        else if (progress >= 52) {
          const r = (57 - progress) * 28;
          point = {
            x: 480 + Math.cos(angle) * r + (i % 2) * 6,
            y: 300 + Math.sin(angle) * r + Math.floor(i / 2) * 6,
          };
        } else point = trackPoint((progress + seat * 13) % 52);
        objects.push({
          id: `token-${p.id}-${i}`,
          kind: 'ball',
          ...point,
          radius: 9,
          color: p.color,
          ownerId: p.id,
          value: i,
          label: `${i + 1}${progress === 57 ? ' HOME' : ''}`,
        });
      }
      p.score = tokens.reduce((sum, v) => sum + (v === 57 ? 100 : Math.max(0, v)), 0);
      p.x = 480 + Math.cos(angle) * 300;
      p.y = 300 + Math.sin(angle) * 245;
    }
    this.state.objects = objects;
    this.state.info = {
      ...this.state.info!,
      phase:
        this.state.info?.phase === 'finished' ? 'finished' : this.die ? 'choose-token' : 'roll',
      turnId: this.current?.id,
      round: this.die,
      goal: 4,
    };
  }
  override removePlayer(id: string) {
    const before = this.current?.id;
    const at = this.state.players.findIndex((p) => p.id === id);
    super.removePlayer(id);
    this.tokens.delete(id);
    if (at < this.turn) this.turn--;
    if (before === id) {
      this.turn %= Math.max(1, this.state.players.length);
      this.die = 0;
    }
    this.publish();
  }
}

interface PhysicalBall {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  active: boolean;
}
const POCKETS = [
  { x: 65, y: 75 },
  { x: 480, y: 75 },
  { x: 895, y: 75 },
  { x: 65, y: 525 },
  { x: 480, y: 525 },
  { x: 895, y: 525 },
];

export class PoolGame extends ArcadeGame {
  readonly balls: PhysicalBall[] = [];
  private turn = 0;
  private groups = new Map<string, 'solids' | 'stripes'>();
  private moving = false;
  private ballInHand = false;
  private potted: number[] = [];
  private firstHit: number | null = null;
  private requiredFirst: 'open' | 'solids' | 'stripes' | 'eight' = 'open';
  private ownRemainingAtStart = 7;
  private deadline: number;
  constructor(players: Participant[], now: number, duration: number) {
    super(players, now, duration, 'corner-pocket');
    this.deadline = now + 20000;
    this.balls.push({ id: 0, x: 260, y: 300, vx: 0, vy: 0, active: true });
    const rack = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15];
    let n = 0;
    for (let row = 0; row < 5; row++)
      for (let j = 0; j <= row; j++)
        this.balls.push({
          id: rack[n++],
          x: 650 + row * 18,
          y: 300 + (j - row / 2) * 21,
          vx: 0,
          vy: 0,
          active: true,
        });
    this.state.info = {
      label: 'Balls cleared',
      phase: 'aiming',
      turnId: players[0]?.id,
      message:
        'Aim from the white cue ball and click/Space. Aim distance sets power. Clear your group, then legally pocket black 8.',
    };
    this.publish();
  }
  private get current() {
    return this.state.players[this.turn % this.state.players.length];
  }
  private get cue() {
    return this.balls[0];
  }
  private group(id: number) {
    return id < 8 ? 'solids' : 'stripes';
  }
  private next(now: number, foul = false) {
    this.turn = (this.turn + 1) % Math.max(1, this.state.players.length);
    this.deadline = now + 20000;
    this.ballInHand = foul;
    if (foul) {
      this.cue.active = true;
      this.cue.x = 260;
      this.cue.y = 300;
      this.cue.vx = 0;
      this.cue.vy = 0;
    }
  }
  protected update(dt: number, now: number) {
    if (this.state.players.length < 2) {
      this.finish(this.state.players.map((p) => p.id));
      return;
    }
    for (const p of this.state.players) {
      if (!this.pressed(p.id) || p.id !== this.current?.id || this.moving) continue;
      const input = this.read(p.id, now);
      if (this.ballInHand) {
        const x = input.targetX ?? 260,
          y = input.targetY ?? 300;
        if (
          x > 85 &&
          x < 875 &&
          y > 95 &&
          y < 505 &&
          !this.balls.some((b) => b.id !== 0 && b.active && Math.hypot(b.x - x, b.y - y) < 22)
        ) {
          this.cue.x = x;
          this.cue.y = y;
          this.ballInHand = false;
          this.state.info!.message = 'Cue placed. Aim and click again to shoot.';
        } else this.state.info!.message = 'Place the cue on a clear point inside the table.';
      } else {
        const dx = (input.targetX ?? this.cue.x + Math.cos(input.angle) * 250) - this.cue.x,
          dy = (input.targetY ?? this.cue.y + Math.sin(input.angle) * 250) - this.cue.y;
        const length = Math.hypot(dx, dy);
        if (length < 8) continue;
        const power = Math.min(760, Math.max(90, length * 1.8));
        this.cue.vx = (dx / length) * power;
        this.cue.vy = (dy / length) * power;
        this.moving = true;
        this.potted = [];
        this.firstHit = null;
        const group = this.groups.get(p.id);
        this.ownRemainingAtStart = group
          ? this.balls.filter(
              (b) => b.active && b.id !== 0 && b.id !== 8 && this.group(b.id) === group,
            ).length
          : 7;
        this.requiredFirst = group ? (this.ownRemainingAtStart === 0 ? 'eight' : group) : 'open';
        this.state.info!.message = 'Shot in motion. Wait for the balls to settle.';
      }
    }
    if (this.moving) {
      for (let step = 0; step < 4; step++) this.physics(dt / 4);
      if (this.balls.every((b) => !b.active || Math.hypot(b.vx, b.vy) < 5)) this.settle(now);
    } else if (now >= this.deadline) {
      this.state.info!.message = 'Shot timer expired. Opponent receives ball in hand.';
      this.next(now, true);
    }
    this.publish();
  }
  private physics(dt: number) {
    for (const b of this.balls) {
      if (!b.active) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      const drag = Math.exp(-1.45 * dt);
      b.vx *= drag;
      b.vy *= drag;
      if (POCKETS.some((p) => distance(p, b) < 24)) {
        b.active = false;
        b.vx = b.vy = 0;
        this.potted.push(b.id);
        continue;
      }
      if (b.x < 76) {
        b.x = 76;
        b.vx = Math.abs(b.vx) * 0.9;
      }
      if (b.x > 884) {
        b.x = 884;
        b.vx = -Math.abs(b.vx) * 0.9;
      }
      if (b.y < 86) {
        b.y = 86;
        b.vy = Math.abs(b.vy) * 0.9;
      }
      if (b.y > 514) {
        b.y = 514;
        b.vy = -Math.abs(b.vy) * 0.9;
      }
      if (Math.hypot(b.vx, b.vy) < 5) b.vx = b.vy = 0;
    }
    const active = this.balls.filter((b) => b.active);
    for (let i = 0; i < active.length; i++)
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i],
          b = active[j],
          dx = b.x - a.x,
          dy = b.y - a.y,
          d = Math.hypot(dx, dy);
        if (d >= 20 || d < 0.001) continue;
        const nx = dx / d,
          ny = dy / d,
          overlap = (20 - d) / 2;
        a.x -= nx * overlap;
        a.y -= ny * overlap;
        b.x += nx * overlap;
        b.y += ny * overlap;
        const approach = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (approach < 0) {
          a.vx += approach * nx;
          a.vy += approach * ny;
          b.vx -= approach * nx;
          b.vy -= approach * ny;
          if (this.firstHit === null && (a.id === 0 || b.id === 0))
            this.firstHit = a.id === 0 ? b.id : a.id;
        }
      }
  }
  private settle(now: number) {
    this.moving = false;
    const player = this.current;
    if (!player) return;
    const group = this.groups.get(player.id);
    const illegalFirst =
      this.firstHit === null ||
      (this.requiredFirst === 'open' && this.firstHit === 8) ||
      (this.requiredFirst === 'eight' && this.firstHit !== 8) ||
      ((this.requiredFirst === 'solids' || this.requiredFirst === 'stripes') &&
        (this.firstHit === 8 || this.group(this.firstHit) !== this.requiredFirst));
    const foul = this.potted.includes(0) || !!illegalFirst;
    if (this.potted.includes(8)) {
      const won = !!group && this.ownRemainingAtStart === 0 && !foul;
      this.state.info!.message = won
        ? `${player.name} legally pocketed the eight ball.`
        : `${player.name} pocketed the eight ball illegally.`;
      this.publish();
      this.finish(
        won ? [player.id] : this.state.players.filter((p) => p.id !== player.id).map((p) => p.id),
      );
      return;
    }
    const first = this.potted.find((id) => id !== 0 && id !== 8);
    if (!group && first !== undefined && !foul) {
      const assigned = this.group(first);
      this.groups.set(player.id, assigned);
      for (const other of this.state.players)
        if (other.id !== player.id)
          this.groups.set(other.id, assigned === 'solids' ? 'stripes' : 'solids');
    }
    const own = this.groups.get(player.id);
    const keeps =
      !foul && own && this.potted.some((id) => id !== 0 && id !== 8 && this.group(id) === own);
    if (!keeps) this.next(now, foul);
    else this.deadline = now + 20000;
    this.state.info!.message = foul
      ? 'Foul: next player places the cue ball before shooting.'
      : keeps
        ? 'Ball pocketed: shoot again.'
        : 'No legal pocket: turn passes.';
  }
  private publish() {
    const objects: WorldObject[] = [
      this.object('zone', 65, 75, {
        width: 830,
        height: 450,
        color: '#173d3d',
        label: 'CORNER POCKET',
      }),
      ...POCKETS.map((p) => this.object('zone', p.x, p.y, { radius: 24, color: '#03060e' })),
    ];
    for (const b of this.balls)
      if (b.active)
        objects.push({
          id: `pool-${b.id}`,
          kind: 'ball',
          x: b.x,
          y: b.y,
          radius: 10,
          color: b.id === 0 ? '#f2f3ff' : b.id === 8 ? '#181c2e' : b.id < 8 ? '#f5c76c' : '#d496fa',
          label: String(b.id || 'CUE'),
          value: b.id,
        });
    for (const p of this.state.players) {
      const g = this.groups.get(p.id);
      p.score = g
        ? 7 -
          this.balls.filter((b) => b.active && b.id !== 0 && b.id !== 8 && this.group(b.id) === g)
            .length
        : 0;
      p.x = this.cue.x;
      p.y = this.cue.y;
    }
    this.state.objects = objects;
    this.state.info = {
      ...this.state.info!,
      phase:
        this.state.info?.phase === 'finished'
          ? 'finished'
          : this.moving
            ? 'moving'
            : this.ballInHand
              ? 'ball-in-hand'
              : 'aiming',
      turnId: this.current?.id,
      teams: Object.fromEntries(this.groups),
    };
  }
  override removePlayer(id: string) {
    super.removePlayer(id);
    this.groups.delete(id);
    this.turn %= Math.max(1, this.state.players.length);
    this.publish();
  }
}

export class SignalGame extends ArcadeGame {
  private readonly saboteur: string;
  private phase: 'tasks' | 'voting' = 'tasks';
  private readonly completed = new Map<string, Set<number>>();
  private readonly lastAction = new Map<string, number>();
  private readonly votes = new Map<string, string | null>();
  private readonly meetings = new Map<string, number>();
  private lastMeeting: number;
  private meetingEnds = 0;
  private readonly stations = [
    { x: 140, y: 140 },
    { x: 820, y: 140 },
    { x: 480, y: 480 },
  ];
  constructor(
    players: Participant[],
    now: number,
    duration: number,
    choose = (count: number) => randomInt(count),
  ) {
    super(players, now, duration, 'hidden-signal');
    this.saboteur = players[choose(players.length)]?.id ?? '';
    this.lastMeeting = now - 10000;
    for (const [p, i] of this.state.players.entries()) {
      i.x = 180 + (p % 4) * 190;
      i.y = 240 + Math.floor(p / 4) * 120;
      this.completed.set(i.id, new Set());
      this.meetings.set(i.id, 2);
    }
    this.state.info = {
      label: 'Tasks',
      phase: 'tasks',
      goal: 3,
      message:
        'Complete tasks at three stations with Space/click. Call a meeting to vote. Your private role is shown only to you.',
    };
    this.publish();
  }
  private living() {
    return this.state.players.filter((p) => p.health > 0);
  }
  private crew() {
    return this.state.players.filter((p) => p.id !== this.saboteur);
  }
  privateInfo(id: string) {
    if (!this.state.players.some((p) => p.id === id)) return undefined;
    return id === this.saboteur
      ? 'SABOTEUR: blend in, fake tasks, and press Space/click near another player to eliminate them (4 second cooldown). Survive votes.'
      : 'CREW: visit all three task stations and press Space/click once at each. Find the saboteur through observation and meetings.';
  }
  protected update(dt: number, now: number) {
    for (const p of this.state.players) {
      const action = this.pressed(p.id);
      if (p.health <= 0) continue;
      if (this.phase === 'tasks') this.move(p, dt, now, 180);
      if (!action) continue;
      const input = this.read(p.id, now);
      if (this.phase === 'voting') {
        if (this.votes.has(p.id)) continue;
        if (input.choice === 9) this.votes.set(p.id, null);
        else if (input.choice !== undefined && input.choice < 8) {
          const target = this.state.players[input.choice];
          if (target?.health > 0) this.votes.set(p.id, target.id);
        }
      } else if (input.choice === 8) {
        if (now - this.lastMeeting >= 10000 && (this.meetings.get(p.id) ?? 0) > 0) {
          this.meetings.set(p.id, this.meetings.get(p.id)! - 1);
          this.phase = 'voting';
          this.meetingEnds = now + 12000;
          this.lastMeeting = now;
          this.votes.clear();
          this.state.info!.message = `${p.name} called a meeting. Each living guest votes once; ties and skip votes eject nobody.`;
        }
      } else if (now - (this.lastAction.get(p.id) ?? -Infinity) >= 650) {
        if (
          p.id === this.saboteur &&
          now - (this.lastAction.get(`kill-${p.id}`) ?? -Infinity) >= 4000
        ) {
          const victim = this.crew()
            .filter((other) => other.health > 0 && distance(p, other) < 42)
            .sort((a, b) => distance(p, a) - distance(p, b))[0];
          if (victim) {
            victim.health = 0;
            victim.deaths++;
            this.lastAction.set(`kill-${p.id}`, now);
            this.lastAction.set(p.id, now);
            this.state.info!.message = `${victim.name} was eliminated. Call a meeting if you saw suspicious behavior.`;
            continue;
          }
        }
        const station = this.stations.findIndex((s) => distance(s, p) < 45);
        if (station >= 0) {
          this.completed.get(p.id)!.add(station);
          p.score = this.completed.get(p.id)!.size;
          this.lastAction.set(p.id, now);
          this.state.info!.message = `${p.name} interacted with a task station.`;
        }
      }
    }
    if (
      this.phase === 'voting' &&
      (now >= this.meetingEnds || this.living().every((p) => this.votes.has(p.id)))
    )
      this.tally();
    const saboteur = this.state.players.find((p) => p.id === this.saboteur);
    if (!saboteur || saboteur.health <= 0) this.finish(this.crew().map((p) => p.id));
    else if (this.crew().filter((p) => p.health > 0).length <= 1) this.finish([this.saboteur]);
    else if (
      this.crew()
        .filter((p) => p.health > 0)
        .every((p) => this.completed.get(p.id)!.size === 3)
    )
      this.finish(this.crew().map((p) => p.id));
    this.publish();
  }
  private tally() {
    const totals = new Map<string, number>();
    let skip = 0;
    for (const target of this.votes.values())
      if (target) totals.set(target, (totals.get(target) ?? 0) + 1);
      else skip++;
    const sorted = [...totals].sort((a, b) => b[1] - a[1]);
    const best = sorted[0];
    if (best && best[1] > skip && best[1] > (sorted[1]?.[1] ?? 0)) {
      const eliminated = this.state.players.find((p) => p.id === best[0]);
      if (eliminated) {
        eliminated.health = 0;
        eliminated.deaths++;
        this.state.info!.message = `${eliminated.name} was voted out.`;
      }
    } else this.state.info!.message = 'No ejection: votes tied or the group skipped.';
    this.phase = 'tasks';
    this.votes.clear();
  }
  protected override expired() {
    const saboteur = this.state.players.find((p) => p.id === this.saboteur && p.health > 0);
    this.finish(saboteur ? [saboteur.id] : this.crew().map((p) => p.id));
  }
  private publish() {
    this.state.objects = this.stations.map((s, i) => ({
      id: `task-${i}`,
      kind: 'target',
      ...s,
      radius: 28,
      color: '#62d6c4',
      label: `TASK ${i + 1}`,
      value: i,
    }));
    this.state.info = {
      ...this.state.info!,
      phase: this.state.info?.phase === 'finished' ? 'finished' : this.phase,
      round: this.phase === 'voting' ? this.votes.size : undefined,
    };
  }
  override removePlayer(id: string) {
    super.removePlayer(id);
    this.completed.delete(id);
    this.votes.delete(id);
    this.publish();
  }
}

interface GolfBall {
  x: number;
  y: number;
  vx: number;
  vy: number;
  holed: boolean;
}
const COURSES = [
  {
    start: { x: 150, y: 440 },
    cup: { x: 810, y: 130 },
    walls: [
      { x: 360, y: 230, width: 45, height: 210 },
      { x: 610, y: 100, width: 45, height: 190 },
    ],
  },
  {
    start: { x: 130, y: 120 },
    cup: { x: 820, y: 460 },
    walls: [
      { x: 300, y: 60, width: 40, height: 300 },
      { x: 610, y: 240, width: 40, height: 300 },
    ],
  },
  {
    start: { x: 160, y: 300 },
    cup: { x: 820, y: 300 },
    walls: [
      { x: 380, y: 60, width: 40, height: 190 },
      { x: 380, y: 350, width: 40, height: 190 },
      { x: 610, y: 200, width: 40, height: 200 },
    ],
  },
];
export class GolfGame extends ArcadeGame {
  readonly balls = new Map<string, GolfBall>();
  readonly strokes = new Map<string, number>();
  private readonly completed = new Map<string, number>();
  private turn = 0;
  private hole = 0;
  private moving = false;
  private deadline: number;
  constructor(players: Participant[], now: number, duration: number) {
    super(players, now, duration, 'orbit-putt');
    this.deadline = now + 20000;
    for (const p of players) {
      this.strokes.set(p.id, 0);
      this.completed.set(p.id, 0);
    }
    this.resetHole();
    this.state.info = {
      label: 'Strokes (negative score)',
      phase: 'aiming',
      turnId: players[0]?.id,
      round: 1,
      goal: 3,
      message:
        'Take turns: aim from your ball, then click or Space. Aim distance sets power. Lowest total strokes wins after three holes.',
    };
    this.publish();
  }
  private get current() {
    return this.state.players[this.turn % this.state.players.length];
  }
  private resetHole() {
    for (const p of this.state.players)
      this.balls.set(p.id, { ...COURSES[this.hole].start, vx: 0, vy: 0, holed: false });
    this.moving = false;
    this.turn = 0;
  }
  private next(now: number) {
    const active = this.state.players;
    if (!active.length) {
      this.finish([]);
      return;
    }
    if (active.every((p) => this.balls.get(p.id)!.holed)) {
      if (this.hole === COURSES.length - 1) {
        const least = Math.min(...active.map((p) => this.strokes.get(p.id)!));
        this.finish(active.filter((p) => this.strokes.get(p.id) === least).map((p) => p.id));
        return;
      }
      this.hole++;
      this.resetHole();
      this.state.info!.message = `Hole ${this.hole + 1}. Lowest total strokes wins.`;
    } else
      for (let i = 0; i < active.length; i++) {
        this.turn = (this.turn + 1) % active.length;
        if (!this.balls.get(this.current.id)!.holed) break;
      }
    this.deadline = now + 20000;
  }
  protected update(dt: number, now: number) {
    if (!this.current) {
      this.finish([]);
      return;
    }
    for (const p of this.state.players) {
      if (!this.pressed(p.id) || p.id !== this.current.id || this.moving) continue;
      const ball = this.balls.get(p.id)!;
      const input = this.read(p.id, now);
      const dx = (input.targetX ?? ball.x + Math.cos(input.angle) * 200) - ball.x,
        dy = (input.targetY ?? ball.y + Math.sin(input.angle) * 200) - ball.y;
      const len = Math.hypot(dx, dy);
      if (len < 5) continue;
      const power = Math.max(80, Math.min(600, len * 1.5));
      ball.vx = (dx / len) * power;
      ball.vy = (dy / len) * power;
      this.strokes.set(p.id, this.strokes.get(p.id)! + 1);
      this.moving = true;
      this.state.info!.message = `${p.name}'s ball is moving. Wait for it to settle.`;
    }
    if (this.moving) {
      const ball = this.balls.get(this.current.id)!;
      for (let step = 0; step < 4; step++) this.physics(ball, dt / 4);
      if (ball.holed || Math.hypot(ball.vx, ball.vy) < 7) {
        ball.vx = ball.vy = 0;
        this.moving = false;
        this.next(now);
      }
    } else if (now >= this.deadline) {
      this.strokes.set(this.current.id, this.strokes.get(this.current.id)! + 1);
      this.state.info!.message = 'Turn timed out: one penalty stroke and play passes.';
      this.next(now);
    }
    this.publish();
  }
  private physics(ball: GolfBall, dt: number) {
    if (ball.holed) return;
    const before = { x: ball.x, y: ball.y };
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    const drag = Math.exp(-1.35 * dt);
    ball.vx *= drag;
    ball.vy *= drag;
    const cup = COURSES[this.hole].cup;
    if (distance(ball, cup) < 17 && Math.hypot(ball.vx, ball.vy) < 190) {
      ball.holed = true;
      ball.x = cup.x;
      ball.y = cup.y;
      ball.vx = ball.vy = 0;
      this.completed.set(this.current.id, this.completed.get(this.current.id)! + 1);
      return;
    }
    if (ball.x < 60) {
      ball.x = 60;
      ball.vx = Math.abs(ball.vx) * 0.75;
    }
    if (ball.x > 900) {
      ball.x = 900;
      ball.vx = -Math.abs(ball.vx) * 0.75;
    }
    if (ball.y < 60) {
      ball.y = 60;
      ball.vy = Math.abs(ball.vy) * 0.75;
    }
    if (ball.y > 540) {
      ball.y = 540;
      ball.vy = -Math.abs(ball.vy) * 0.75;
    }
    for (const wall of COURSES[this.hole].walls) {
      if (
        ball.x + 9 > wall.x &&
        ball.x - 9 < wall.x + wall.width &&
        ball.y + 9 > wall.y &&
        ball.y - 9 < wall.y + wall.height
      ) {
        if (before.x + 9 <= wall.x) {
          ball.x = wall.x - 9;
          ball.vx = -Math.abs(ball.vx) * 0.75;
        } else if (before.x - 9 >= wall.x + wall.width) {
          ball.x = wall.x + wall.width + 9;
          ball.vx = Math.abs(ball.vx) * 0.75;
        } else if (before.y < wall.y) {
          ball.y = wall.y - 9;
          ball.vy = -Math.abs(ball.vy) * 0.75;
        } else {
          ball.y = wall.y + wall.height + 9;
          ball.vy = Math.abs(ball.vy) * 0.75;
        }
      }
    }
  }
  protected override expired() {
    const players = this.state.players;
    const maxHoles = Math.max(...players.map((p) => this.completed.get(p.id) ?? 0));
    const eligible = players.filter((p) => (this.completed.get(p.id) ?? 0) === maxHoles);
    const bestDistance = Math.min(
      ...eligible.map((p) => distance(this.balls.get(p.id)!, COURSES[this.hole].cup)),
    );
    const nearest = eligible.filter(
      (p) => distance(this.balls.get(p.id)!, COURSES[this.hole].cup) <= bestDistance + 0.01,
    );
    const least = Math.min(...nearest.map((p) => this.strokes.get(p.id)!));
    this.finish(nearest.filter((p) => this.strokes.get(p.id) === least).map((p) => p.id));
  }
  private publish() {
    const course = COURSES[this.hole];
    this.state.objects = [
      this.object('zone', 50, 50, {
        width: 860,
        height: 500,
        color: '#163c39',
        label: `HOLE ${this.hole + 1}`,
      }),
      ...course.walls.map((w) =>
        this.object('wall', w.x, w.y, { width: w.width, height: w.height, color: '#58727b' }),
      ),
      this.object('finish', course.cup.x, course.cup.y, {
        radius: 17,
        color: '#02060e',
        label: 'CUP',
      }),
    ];
    for (const p of this.state.players) {
      const ball = this.balls.get(p.id)!;
      p.x = ball.x;
      p.y = ball.y;
      p.score = -(this.strokes.get(p.id) ?? 0);
      this.state.objects.push({
        id: `golf-${p.id}`,
        kind: 'ball',
        x: ball.x,
        y: ball.y,
        radius: 9,
        color: p.color,
        ownerId: p.id,
        label: ball.holed ? 'HOLED' : p.name,
      });
    }
    this.state.info = {
      ...this.state.info!,
      phase: this.state.info?.phase === 'finished' ? 'finished' : this.moving ? 'moving' : 'aiming',
      turnId: this.current?.id,
      round: this.hole + 1,
    };
  }
  override removePlayer(id: string) {
    super.removePlayer(id);
    this.balls.delete(id);
    this.strokes.delete(id);
    this.completed.delete(id);
    this.turn %= Math.max(1, this.state.players.length);
    this.moving = false;
    this.publish();
  }
}

export function createTableGame(
  id: string,
  players: Participant[],
  now: number,
  duration: number,
): GameEngine {
  if (id === 'homebound-dice') return new DiceGame(players, now, duration);
  if (id === 'corner-pocket') return new PoolGame(players, now, duration);
  if (id === 'hidden-signal') return new SignalGame(players, now, duration);
  if (id === 'orbit-putt') return new GolfGame(players, now, duration);
  throw new Error(`Unknown tabletop game: ${id}`);
}
