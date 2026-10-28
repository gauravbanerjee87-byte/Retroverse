import Phaser from 'phaser';
import { ARENA, OBSTACLES, GAMES, type WorldObject } from '@retroverse/shared';
import { network } from '../services/network';
import { ArenaInput } from './input';
import { ArcadeSound } from './sound';
const VEHICLES = new Set([
  'asphalt-rivals',
  'metro-roam',
  'sunset-borough',
  'night-circuit',
  'pocket-drift',
]);
const HIDDEN_AVATARS = new Set([
  'stack-surge',
  'paddle-pulse',
  'homebound-dice',
  'corner-pocket',
  'orbit-putt',
  'bloom-arena',
]);
const PALETTE: Record<WorldObject['kind'], number> = {
  wall: 0x42516e,
  target: 0xf977ac,
  pickup: 0x84efbb,
  hazard: 0xf2607b,
  ball: 0xe9f7ff,
  zone: 0x4e768d,
  tile: 0x9a79dc,
  trail: 0x72dbe4,
  bomb: 0xffb96e,
  finish: 0xa3f2cc,
  marker: 0x86c8de,
};
export class ArenaScene extends Phaser.Scene {
  private art!: Phaser.GameObjects.Graphics;
  private disposed = false;
  private labels = new Map<string, Phaser.GameObjects.Text>();
  private positions = new Map<string, { x: number; y: number }>();
  private previousBullets = new Set<string>();
  controls!: ArenaInput;
  private soundEffects = new ArcadeSound();
  constructor() {
    super('RetroVerseArcade');
  }
  create() {
    if (this.disposed) return;
    const gameId = network.view.room?.gameId || network.state?.gameId || 'neon-arena';
    const game = GAMES.find((g) => g.id === gameId);
    const grid = this.add.graphics();
    grid.fillStyle(['corner-pocket', 'orbit-putt'].includes(gameId) ? 0x0e2a27 : 0x0b1423);
    grid.fillRect(0, 0, ARENA.width, ARENA.height);
    grid.lineStyle(1, 0x25374d, 0.45);
    for (let x = 0; x <= ARENA.width; x += 40) grid.lineBetween(x, 0, x, ARENA.height);
    for (let y = 0; y <= ARENA.height; y += 40) grid.lineBetween(0, y, ARENA.width, y);
    grid.lineStyle(3, 0x53778b);
    grid.strokeRect(3, 3, ARENA.width - 6, ARENA.height - 6);
    if (gameId === 'neon-arena')
      for (const o of OBSTACLES) {
        grid.fillStyle(0x1d2d45);
        grid.fillRect(o.x, o.y, o.width, o.height);
        grid.lineStyle(2, 0x7973ac);
        grid.strokeRect(o.x, o.y, o.width, o.height);
      }
    this.add
      .text(ARENA.width / 2, 12, `RETROVERSE / ${(game?.name || 'ARCADE').toUpperCase()}`, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#71839c',
      })
      .setOrigin(0.5, 0);
    this.art = this.add.graphics();
    this.controls = new ArenaInput();
    this.game.canvas.setAttribute(
      'aria-label',
      `${game?.name || 'RetroVerse game'}. Keyboard movement, mouse aim, click or Space for action. Instructions appear beside the canvas.`,
    );
    this.game.canvas.tabIndex = 0;
    const aim = (pointer: Phaser.Input.Pointer) => {
      this.controls.targetX = pointer.x;
      this.controls.targetY = pointer.y;
      const me = network.state?.players.find((p) => p.id === network.view.playerId);
      if (me) this.controls.angle = Math.atan2(pointer.y - me.y, pointer.x - me.x);
    };
    this.input.on('pointermove', aim);
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.game.canvas.focus();
      this.soundEffects.unlock();
      aim(pointer);
      if (pointer.leftButtonDown()) {
        this.controls.firing = true;
        this.controls.action();
      }
    });
    this.input.on('pointerup', () => {
      this.controls.firing = false;
    });
    this.input.on('gameout', () => {
      this.controls.firing = false;
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.dispose());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.dispose());
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.controls?.destroy();
    this.soundEffects.destroy();
    this.labels.clear();
    this.positions.clear();
  }
  private label(id: string, text: string, x: number, y: number, color = '#e2e9f5', size = '11px') {
    let label = this.labels.get(id);
    if (!label) {
      label = this.add
        .text(x, y, text, {
          fontFamily: 'system-ui',
          fontSize: size,
          color,
          backgroundColor: '#091421b0',
          padding: { x: 3, y: 1 },
        })
        .setOrigin(0.5);
      this.labels.set(id, label);
    }
    label.setText(text).setPosition(x, y).setColor(color);
    return label;
  }
  private renderObject(object: WorldObject, active: Set<string>) {
    const g = this.art,
      color = object.color
        ? Phaser.Display.Color.HexStringToColor(object.color).color
        : PALETTE[object.kind];
    const rect = object.width !== undefined && object.height !== undefined;
    const radius = object.radius ?? 10;
    g.fillStyle(color, object.kind === 'zone' ? 0.22 : object.kind === 'marker' ? 0.12 : 0.9);
    g.lineStyle(object.kind === 'finish' ? 3 : 1, color, 0.95);
    if (rect) {
      g.fillRect(object.x, object.y, object.width!, object.height!);
      g.strokeRect(object.x, object.y, object.width!, object.height!);
    } else {
      g.fillCircle(object.x, object.y, radius);
      g.strokeCircle(object.x, object.y, radius);
    }
    if (object.kind === 'bomb') {
      g.lineStyle(2, 0xffe1a3);
      g.lineBetween(object.x, object.y - radius, object.x + 5, object.y - radius - 9);
    }
    if (object.kind === 'finish' && rect) {
      for (let x = 0; x < (object.width ?? 0); x += 12)
        for (let y = 0; y < (object.height ?? 0); y += 12)
          if ((x + y) % 24 === 0) {
            g.fillStyle(0x111c29, 0.7);
            g.fillRect(
              object.x + x,
              object.y + y,
              Math.min(12, object.width! - x),
              Math.min(12, object.height! - y),
            );
          }
    }
    if (object.label) {
      const key = `object:${object.id}`;
      active.add(key);
      this.label(
        key,
        object.label,
        object.x + (rect ? object.width! / 2 : 0),
        object.y + (rect ? object.height! / 2 : 0),
        object.kind === 'hazard' ? '#fff2f4' : '#eff5ff',
        object.kind === 'tile' ? '10px' : '11px',
      );
    }
  }
  update(_time: number, delta: number) {
    const state = network.state;
    if (this.disposed || !state || !this.art) return;
    const gameId = state.gameId || network.view.room?.gameId || 'neon-arena';
    const me = state.players.find((p) => p.id === network.view.playerId),
      pointer = this.input.activePointer;
    if (me) {
      this.controls.angle = Math.atan2(pointer.y - me.y, pointer.x - me.x);
      this.controls.targetX = pointer.x;
      this.controls.targetY = pointer.y;
    }
    this.art.clear();
    const active = new Set<string>();
    for (const object of state.objects || []) this.renderObject(object, active);
    const blend = Math.min(1, delta / 65);
    if (!HIDDEN_AVATARS.has(gameId))
      for (const player of state.players) {
        const previous = this.positions.get(player.id) || player;
        const teleport = Math.hypot(previous.x - player.x, previous.y - player.y) > 180;
        const x = teleport ? player.x : previous.x + (player.x - previous.x) * blend,
          y = teleport ? player.y : previous.y + (player.y - previous.y) * blend;
        this.positions.set(player.id, { x, y });
        const key = `player:${player.id}`;
        active.add(key);
        this.label(
          key,
          `${player.name}${player.id === network.view.playerId ? ' · YOU' : ''}`,
          x,
          y - 31,
        ).setAlpha(player.health > 0 ? 1 : 0.5);
        const color = Phaser.Display.Color.HexStringToColor(player.color).color;
        if (player.health <= 0) {
          this.art.lineStyle(2, color, 0.4);
          this.art.strokeCircle(x, y, 20);
          continue;
        }
        if (VEHICLES.has(gameId)) {
          const motorcycle = gameId === 'asphalt-rivals',
            a = player.angle,
            length = motorcycle ? 22 : 25,
            width = motorcycle ? 8 : 14;
          const corners = [
            [-length, -width],
            [length, -width],
            [length, width],
            [-length, width],
          ].map(([dx, dy]) => ({
            x: x + Math.cos(a) * dx - Math.sin(a) * dy,
            y: y + Math.sin(a) * dx + Math.cos(a) * dy,
          }));
          this.art.fillStyle(color);
          this.art.fillPoints(corners, true);
          this.art.lineStyle(2, 0xe5ffff);
          this.art.strokePoints(corners, true);
          this.art.fillStyle(0x102035);
          this.art.fillCircle(x + Math.cos(a) * 8, y + Math.sin(a) * 8, motorcycle ? 5 : 9);
        } else if (['pulse-clash', 'rooftop-rush', 'tumble-circuit'].includes(gameId)) {
          this.art.fillStyle(color);
          this.art.fillCircle(x, y - 12, 8);
          this.art.fillRect(x - 8, y - 4, 16, 20);
          this.art.lineStyle(4, color);
          this.art.lineBetween(x - 4, y + 16, x - 10, y + 25);
          this.art.lineBetween(x + 4, y + 16, x + 10, y + 25);
        } else {
          const radius =
            gameId === 'bloom-arena'
              ? Math.min(56, 16 + Math.sqrt(Math.max(0, player.score)) * 1.2)
              : ARENA.playerRadius;
          this.art.fillStyle(0x122234);
          this.art.fillCircle(x, y, radius);
          this.art.lineStyle(3, color);
          this.art.strokeCircle(x, y, radius);
          this.art.fillStyle(color);
          this.art.fillCircle(x, y, 5);
          this.art.lineStyle(4, color);
          this.art.lineBetween(
            x + Math.cos(player.angle) * 9,
            y + Math.sin(player.angle) * 9,
            x + Math.cos(player.angle) * 25,
            y + Math.sin(player.angle) * 25,
          );
        }
        if (!['pixel-serpent', 'coil-circuit', 'bloom-arena', 'stack-surge'].includes(gameId)) {
          this.art.fillStyle(0x36283e);
          this.art.fillRect(x - 17, y + 29, 34, 3);
          this.art.fillStyle(color);
          this.art.fillRect(x - 17, y + 29, Math.max(0, (34 * player.health) / 100), 3);
        }
      }
    const next = new Set<string>();
    for (const bullet of state.bullets) {
      const owner = state.players.find((p) => p.id === bullet.ownerId);
      const color = owner ? Phaser.Display.Color.HexStringToColor(owner.color).color : 0xe8dcff;
      this.art.fillStyle(color);
      this.art.fillCircle(bullet.x, bullet.y, ARENA.bulletRadius);
      next.add(bullet.id);
      if (!this.previousBullets.has(bullet.id) && bullet.ownerId === network.view.playerId)
        this.soundEffects.play();
    }
    this.previousBullets = next;
    for (const [id, label] of this.labels)
      if (!active.has(id)) {
        label.destroy();
        this.labels.delete(id);
      }
    for (const id of this.positions.keys())
      if (!state.players.some((p) => p.id === id)) this.positions.delete(id);
    if (
      [
        'vector-patrol',
        'midnight-outbreak',
        'orbit-marbles',
        'corner-pocket',
        'orbit-putt',
      ].includes(gameId)
    ) {
      this.art.lineStyle(1, 0xe2ffff, 0.7);
      this.art.strokeCircle(pointer.x, pointer.y, 10);
      this.art.lineBetween(pointer.x - 15, pointer.y, pointer.x + 15, pointer.y);
      this.art.lineBetween(pointer.x, pointer.y - 15, pointer.x, pointer.y + 15);
    }
  }
}
