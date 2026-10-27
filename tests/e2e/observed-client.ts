import type { Page } from '@playwright/test';
import type { MatchState, RoomView, ServerMessage } from '@retroverse/shared';

/** Observe real frames received by this browser; never shares state between clients. */
export function observeClient(page: Page) {
  const observed = {
    playerId: '',
    room: null as RoomView | null,
    state: null as MatchState | null,
    snapshots: [] as MatchState[],
    messages: [] as ServerMessage[],
    pageErrors: [] as string[],
    consoleErrors: [] as string[],
  };
  page.on('pageerror', (error) => observed.pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') observed.consoleErrors.push(message.text());
  });
  page.on('websocket', (socket) => {
    socket.on('framereceived', ({ payload }) => {
      try {
        const message = JSON.parse(payload.toString()) as ServerMessage;
        observed.messages.push(message);
        if (message.type === 'welcome') observed.playerId = message.playerId;
        if (message.type === 'room' || message.type === 'finished') {
          observed.room = message.room;
          if (message.room.match) observed.state = message.room.match;
        }
        if (message.type === 'state') {
          observed.state = message.state;
          observed.snapshots.push(message.state);
        }
      } catch {
        // Vite's HMR connection also uses WebSocket; only JSON game messages matter.
      }
    });
  });
  return observed;
}
