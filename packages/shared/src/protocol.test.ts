import { describe, expect, it } from 'vitest';
import { clientMessageSchema, PROTOCOL_VERSION } from './protocol';
import { parseClientMessage } from './validation';
import { GAMES } from './catalogue';

const validInput = {
  type: 'input',
  input: { seq: 1, up: false, down: false, left: true, right: false, fire: true, angle: 0 },
};
describe('versioned protocol trust boundary', () => {
  it('accepts supported hello and strict movement input', () => {
    expect(
      clientMessageSchema.safeParse({ type: 'hello', version: PROTOCOL_VERSION, name: 'Player 01' })
        .success,
    ).toBe(true);
    expect(clientMessageSchema.safeParse(validInput).success).toBe(true);
  });
  it.each([
    { type: 'hello', version: 999, name: 'Player' },
    { type: 'hello', version: PROTOCOL_VERSION, name: '<script>' },
    { type: 'join', code: '0000' },
    { type: 'create', capacity: 9 },
    { ...validInput, score: 999 },
    { type: 'input', input: { ...validInput.input, seq: -1 } },
    { type: 'input', input: { ...validInput.input, angle: Infinity } },
    { type: 'input', input: { ...validInput.input, x: 500 } },
    { type: 'queue', gameId: 'night-circuit', mode: 'deathmatch' },
  ])('rejects invalid and authoritative fields: %j', (message) => {
    expect(clientMessageSchema.safeParse(message).success).toBe(false);
  });
  it('safely rejects invalid JSON and null', () => {
    expect(parseClientMessage('{bad').success).toBe(false);
    expect(parseClientMessage('null').success).toBe(false);
  });
});
describe('honest game catalogue', () => {
  it('exposes one actual implementation and unique identities', () => {
    expect(GAMES.filter((g) => g.status === 'playable').map((g) => g.id)).toEqual(['neon-arena']);
    expect(new Set(GAMES.map((g) => g.id)).size).toBe(GAMES.length);
    for (const game of GAMES) {
      expect(game.minPlayers).toBeLessThanOrEqual(game.maxPlayers);
      if (game.status === 'playable') {
        expect(game.instructions.length).toBeGreaterThan(0);
        expect(game.modes.length).toBeGreaterThan(0);
      }
    }
  });
});
