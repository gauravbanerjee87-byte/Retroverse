import { z } from 'zod';
import { GAMES } from './catalogue';
const gameId = z.string().refine((id) => GAMES.some((game) => game.id === id), 'Unknown game');
import type { MatchRecord, MatchState, RoomView } from './game-types';
export const PROTOCOL_VERSION = 1;
const name = z
  .string()
  .trim()
  .min(2)
  .max(20)
  .regex(/^[\p{L}\p{N} _-]+$/u, 'Use letters, numbers, spaces, underscores or hyphens');
const code = z.string().regex(/^[A-F0-9]{12}$/);
export const inputSchema = z
  .object({
    seq: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    up: z.boolean(),
    down: z.boolean(),
    left: z.boolean(),
    right: z.boolean(),
    angle: z
      .number()
      .finite()
      .min(-Math.PI * 2)
      .max(Math.PI * 2),
    fire: z.boolean(),
    targetX: z.number().finite().min(0).max(960).optional(),
    targetY: z.number().finite().min(0).max(600).optional(),
    choice: z.number().int().min(0).max(15).optional(),
  })
  .strict();
export const clientMessageSchema = z
  .discriminatedUnion('type', [
    z
      .object({
        type: z.literal('hello'),
        version: z.literal(PROTOCOL_VERSION),
        name,
        token: z
          .string()
          .regex(/^[a-f0-9]{64}$/)
          .optional(),
      })
      .strict(),
    z
      .object({
        type: z.literal('create'),
        capacity: z.number().int().min(2).max(8).optional(),
        gameId: gameId.optional(),
      })
      .strict(),
    z.object({ type: z.literal('join'), code }).strict(),
    z.object({ type: z.literal('leave') }).strict(),
    z.object({ type: z.literal('ready'), ready: z.boolean() }).strict(),
    z.object({ type: z.literal('start') }).strict(),
    z.object({ type: z.literal('rematch') }).strict(),
    z
      .object({
        type: z.literal('queue'),
        gameId,
        mode: z.enum(['deathmatch', 'arcade']),
      })
      .strict(),
    z.object({ type: z.literal('cancel_queue') }).strict(),
    z.object({ type: z.literal('input'), input: inputSchema }).strict(),
    z.object({ type: z.literal('ping'), at: z.number().finite() }).strict(),
  ])
  .refine(
    (message) =>
      message.type !== 'queue' ||
      message.mode === (message.gameId === 'neon-arena' ? 'deathmatch' : 'arcade'),
    'Mode is not available for this game',
  );
export type ClientMessage = z.infer<typeof clientMessageSchema>;
export type ServerMessage =
  | {
      type: 'welcome';
      version: number;
      playerId: string;
      token: string;
      name: string;
      resumed: boolean;
    }
  | { type: 'secret'; text: string }
  | { type: 'room'; room: RoomView }
  | { type: 'state'; state: MatchState }
  | { type: 'finished'; room: RoomView; record: MatchRecord }
  | { type: 'left' }
  | { type: 'queued'; position: number }
  | { type: 'queue_cancelled' }
  | { type: 'pong'; at: number; serverTime: number }
  | { type: 'error'; code: string; message: string };
