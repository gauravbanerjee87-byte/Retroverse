import Phaser from 'phaser';
import { ARENA, OBSTACLES } from '@retroverse/shared';
import { network } from '../services/network';
import { ArenaInput } from './input';
import { ArcadeSound } from './sound';
export class ArenaScene extends Phaser.Scene {
  private art!: Phaser.GameObjects.Graphics;
  private labels = new Map<string, Phaser.GameObjects.Text>();
  private positions = new Map<string, { x: number; y: number }>();
  private previousBullets = new Set<string>();
  controls!: ArenaInput;
  private soundEffects = new ArcadeSound();
  constructor() {
    super('NeonArena');
  }
  create() {
    const grid = this.add.graphics();
    grid.fillStyle(0x0b1423);
    grid.fillRect(0, 0, ARENA.width, ARENA.height);
    grid.lineStyle(1, 0x1c2a40, 0.7);
    for (let x = 0; x <= ARENA.width; x += 40) grid.lineBetween(x, 0, x, ARENA.height);
    for (let y = 0; y <= ARENA.height; y += 40) grid.lineBetween(0, y, ARENA.width, y);
    grid.lineStyle(3, 0x53778b);
    grid.strokeRect(3, 3, ARENA.width - 6, ARENA.height - 6);
    for (const obstacle of OBSTACLES) {
      grid.fillStyle(0x1d2d45);
      grid.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
      grid.lineStyle(2, 0x7973ac);
      grid.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
      grid.lineStyle(2, 0xa5a2d6, 0.4);
      grid.lineBetween(
        obstacle.x + 5,
        obstacle.y + 5,
        obstacle.x + obstacle.width - 5,
        obstacle.y + 5,
      );
    }
    this.add
      .text(ARENA.width / 2, 25, 'R E T R O V E R S E   /   N E O N   A R E N A', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#51647d',
      })
      .setOrigin(0.5);
    this.art = this.add.graphics();
    this.controls = new ArenaInput();
    this.game.canvas.setAttribute(
      'aria-label',
      'Neon Arena. Move with WASD or arrows, aim with mouse, hold left mouse to shoot.',
    );
    this.game.canvas.tabIndex = 0;
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const me = network.state?.players.find((p) => p.id === network.view.playerId);
      if (me) this.controls.angle = Math.atan2(pointer.y - me.y, pointer.x - me.x);
    });
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.game.canvas.focus();
      this.soundEffects.unlock();
      if (pointer.leftButtonDown()) this.controls.firing = true;
    });
    this.input.on('pointerup', () => {
      this.controls.firing = false;
    });
    this.input.on('gameout', () => {
      this.controls.firing = false;
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.controls.destroy();
      this.soundEffects.destroy();
      this.labels.clear();
      this.positions.clear();
    });
  }
  update(_time: number, delta: number) {
    const state = network.state;
    if (!state) return;
    const me = state.players.find((p) => p.id === network.view.playerId);
    if (me) {
      const pointer = this.input.activePointer;
      this.controls.angle = Math.atan2(pointer.y - me.y, pointer.x - me.x);
    }
    const graphics = this.art;
    graphics.clear();
    const blend = Math.min(1, delta / 65);
    const ids = new Set(state.players.map((p) => p.id));
    for (const [id, label] of this.labels) {
      if (!ids.has(id)) {
        label.destroy();
        this.labels.delete(id);
        this.positions.delete(id);
      }
    }
    for (const player of state.players) {
      const previous = this.positions.get(player.id) || { x: player.x, y: player.y };
      // Visual interpolation only. Positions, hits and scores always come from the server.
      const teleport = Math.hypot(previous.x - player.x, previous.y - player.y) > 180;
      const x = teleport ? player.x : previous.x + (player.x - previous.x) * blend;
      const y = teleport ? player.y : previous.y + (player.y - previous.y) * blend;
      this.positions.set(player.id, { x, y });
      let label = this.labels.get(player.id);
      if (!label) {
        label = this.add
          .text(x, y - 30, '', {
            fontFamily: 'system-ui',
            fontSize: '11px',
            color: '#d3deef',
            backgroundColor: '#0b1423aa',
            padding: { x: 4, y: 2 },
          })
          .setOrigin(0.5);
        this.labels.set(player.id, label);
      }
      label
        .setText(`${player.name}${player.id === network.view.playerId ? ' · YOU' : ''}`)
        .setPosition(x, y - 31)
        .setAlpha(player.health > 0 ? 1 : 0.4);
      if (player.health <= 0) {
        graphics.lineStyle(2, 0x8e6a9e, 0.5);
        graphics.strokeCircle(x, y, 20);
        continue;
      }
      const color = Phaser.Display.Color.HexStringToColor(player.color).color;
      const reduced = localStorage.getItem('retroverse.reduced') === 'true';
      if (!reduced) {
        graphics.fillStyle(color, 0.06);
        graphics.fillCircle(x, y, 27);
      }
      graphics.fillStyle(0x122234);
      graphics.fillCircle(x, y, ARENA.playerRadius);
      graphics.lineStyle(3, color);
      graphics.strokeCircle(x, y, ARENA.playerRadius);
      graphics.fillStyle(color);
      graphics.fillCircle(x, y, 5);
      graphics.lineStyle(6, color);
      graphics.lineBetween(
        x + Math.cos(player.angle) * 9,
        y + Math.sin(player.angle) * 9,
        x + Math.cos(player.angle) * 25,
        y + Math.sin(player.angle) * 25,
      );
      graphics.fillStyle(0x36283e);
      graphics.fillRect(x - 17, y + 24, 34, 3);
      graphics.fillStyle(color);
      graphics.fillRect(x - 17, y + 24, (34 * player.health) / 100, 3);
    }
    const nextBullets = new Set<string>();
    for (const bullet of state.bullets) {
      const owner = state.players.find((p) => p.id === bullet.ownerId);
      const color = owner ? Phaser.Display.Color.HexStringToColor(owner.color).color : 0xe8dcff;
      graphics.fillStyle(color);
      graphics.fillCircle(bullet.x, bullet.y, ARENA.bulletRadius);
      nextBullets.add(bullet.id);
      if (!this.previousBullets.has(bullet.id) && bullet.ownerId === network.view.playerId)
        this.soundEffects.play();
    }
    this.previousBullets = nextBullets;
  }
}
