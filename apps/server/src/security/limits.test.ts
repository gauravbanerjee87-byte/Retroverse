import { describe, expect, it } from 'vitest';
import { parseClientMessage } from '@retroverse/shared';
import { generateRoomCode } from '../rooms/manager';
import { TokenBucket } from './limits';
describe('protocol and abuse boundaries', () => {
  it('uses unpredictable 48-bit invite codes without collisions in a sample', () => {
    const codes = Array.from({ length: 1000 }, () => generateRoomCode());
    expect(new Set(codes).size).toBe(1000);
    expect(codes.every((c) => /^[A-F0-9]{12}$/.test(c))).toBe(true);
  });
  it('rejects malformed messages, unknown fields, invalid names and client health injection', () => {
    for (const raw of [
      '{',
      JSON.stringify({ type: 'hello', version: 2, name: 'Player' }),
      JSON.stringify({ type: 'hello', version: 1, name: '<script>' }),
      JSON.stringify({
        type: 'input',
        input: {
          seq: 1,
          up: false,
          down: false,
          left: false,
          right: false,
          angle: 0,
          fire: false,
          health: 100,
        },
      }),
      JSON.stringify({ type: 'join', code: '000' }),
    ])
      expect(parseClientMessage(raw).success).toBe(false);
    expect(
      parseClientMessage(JSON.stringify({ type: 'hello', version: 1, name: 'Player 1' })).success,
    ).toBe(true);
  });
  it('enforces burst bounds, refill rate and no clock rollback refill', () => {
    const bucket = new TokenBucket(2, 2, 1000);
    expect(bucket.take(1000)).toBe(true);
    expect(bucket.take(1000)).toBe(true);
    expect(bucket.take(1000)).toBe(false);
    expect(bucket.take(900)).toBe(false);
    expect(bucket.take(1500)).toBe(true);
    expect(bucket.take(1500)).toBe(false);
  });
});
