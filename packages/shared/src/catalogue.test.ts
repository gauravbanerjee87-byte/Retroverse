import { describe, expect, it } from 'vitest';
import { CATEGORIES, GAME_COLLECTIONS, GAMES } from './catalogue';

describe('requested original game catalogue', () => {
  it('contains exactly 25 distinct playable games', () => {
    expect(GAMES).toHaveLength(25);
    expect(new Set(GAMES.map((game) => game.id)).size).toBe(25);
    expect(new Set(GAMES.map((game) => game.name.toLowerCase())).size).toBe(25);
    expect(GAMES.every((game) => game.status === 'playable')).toBe(true);
    expect(GAMES.filter((game) => game.status === 'planned')).toHaveLength(0);
  });

  it('gives all 25 games equal high priority', () => {
    const prioritized = GAMES.filter((game) => game.priority === 'high');
    expect(prioritized).toHaveLength(25);
    expect(GAMES.every((game) => game.fidelity === 'prototype')).toBe(true);
    expect(prioritized[0]).toMatchObject({
      name: 'Asphalt Rivals',
      genre: 'Racing',
      artwork: 'motorcycle',
      minPlayers: 2,
      maxPlayers: 8,
      status: 'playable',
      featured: true,
    });
  });

  it('provides controls, modes and supported player limits for every implementation', () => {
    for (const game of GAMES) {
      expect(game.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(CATEGORIES).toContain(game.genre);
      expect(GAME_COLLECTIONS).toContain(game.collection);
      expect(game.description.length).toBeGreaterThan(30);
      expect(game.minPlayers).toBeGreaterThanOrEqual(1);
      expect(game.minPlayers).toBeLessThanOrEqual(game.maxPlayers);
      expect(game.maxPlayers).toBeLessThanOrEqual(8);
      expect(game.multiplayer).toBe(game.maxPlayers > 1);
      expect(game.controls.length).toBeGreaterThan(0);
      expect(game.modes.length).toBeGreaterThan(0);
      expect(game.instructions.length).toBeGreaterThan(0);
      expect(game.engine).toBe('Phaser 3');
      expect(game.version).toBe('0.2.0');
    }
  });

  it('uses original titles instead of the requested proprietary reference names', () => {
    const names = GAMES.map((game) => game.name.toLowerCase());
    for (const reference of [
      'Road Rash',
      'Virtua Cop 2',
      'Midtown Madness 2',
      'Counter-Strike 1.6',
      'GTA: Vice City',
      'Need for Speed: Most Wanted',
      'The House of the Dead 2',
      'Project I.G.I.',
      'Tekken 3',
      'Bomberman',
      'Zuma',
      'Pong',
    ]) {
      expect(names).not.toContain(reference.toLowerCase());
    }
  });
});
