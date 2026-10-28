import { Arena } from '../arena';
import type { GameEngine, Participant } from './base';
import { RACING_IDS, createRacingGame } from './racing';
import { ACTION_IDS, createActionGame } from './action';
import { CASUAL_IDS, createCasualGame } from './casual';
import { TABLE_IDS, createTableGame } from './table';

export const IMPLEMENTED_GAME_IDS: readonly string[] = [
  'neon-arena',
  ...RACING_IDS,
  ...ACTION_IDS,
  ...CASUAL_IDS,
  ...TABLE_IDS,
];
export function createGameEngine(
  gameId: string,
  players: Participant[],
  now: number,
  duration: number,
): GameEngine {
  if (gameId === 'neon-arena') {
    const arena = new Arena(players, now, duration);
    arena.state.gameId = gameId;
    return arena;
  }
  if ((RACING_IDS as readonly string[]).includes(gameId))
    return createRacingGame(gameId, players, now, duration);
  if ((ACTION_IDS as readonly string[]).includes(gameId))
    return createActionGame(gameId, players, now, duration);
  if ((CASUAL_IDS as readonly string[]).includes(gameId))
    return createCasualGame(gameId, players, now, duration);
  if ((TABLE_IDS as readonly string[]).includes(gameId))
    return createTableGame(gameId, players, now, duration);
  throw new Error('No registered game engine');
}
