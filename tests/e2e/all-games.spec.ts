import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { GAMES } from '@retroverse/shared';
import { observeClient } from './observed-client';

for (const game of GAMES) {
  test(`${game.name}: independent guests launch, control, synchronize and finish`, async ({
    browser,
  }) => {
    const contexts: BrowserContext[] = [];
    try {
      const clients: { page: Page; observed: ReturnType<typeof observeClient> }[] = [];
      for (let index = 0; index < game.minPlayers; index++) {
        const context = await browser.newContext();
        contexts.push(context);
        await context.addInitScript((index) => {
          localStorage.setItem('retroverse.name', `Guest ${index + 1}`);
          localStorage.setItem('retroverse.mute', 'true');
        }, index);
        const page = await context.newPage();
        const observed = observeClient(page);
        clients.push({ page, observed });
        await page.goto('/#/room');
        await expect.poll(() => observed.playerId).not.toBe('');
      }
      const host = clients[0];
      await host.page.getByLabel('Game', { exact: true }).selectOption(game.id);
      await host.page.getByRole('button', { name: 'Create room', exact: true }).click();
      await expect(host.page.getByTestId('room-code')).toBeVisible();
      const code = host.observed.room!.code;
      expect(host.observed.room!.gameId).toBe(game.id);
      for (const friend of clients.slice(1)) {
        await friend.page.getByLabel('Room code', { exact: true }).fill(code);
        await friend.page.getByRole('button', { name: 'Join room', exact: true }).click();
        await expect.poll(() => friend.observed.room?.gameId).toBe(game.id);
      }
      for (const client of clients)
        await client.page.getByRole('button', { name: 'Ready up', exact: true }).click();
      await expect(
        host.page.getByRole('button', { name: 'Start match', exact: true }),
      ).toBeEnabled();
      await host.page.getByRole('button', { name: 'Start match', exact: true }).click();
      for (const client of clients) {
        await expect(client.page.getByTestId('game-screen')).toBeVisible();
        await expect(
          client.page.getByRole('heading', { name: game.name, exact: true }),
        ).toBeVisible();
        await expect(client.page.locator('canvas')).toBeVisible();
      }
      await expect.poll(() => clients[1].observed.state?.gameId).toBe(game.id);
      if (game.id !== 'neon-arena') {
        expect(host.observed.state?.objects?.length).toBeGreaterThan(0);
        expect(host.observed.state?.info?.message).toBeTruthy();
      }
      const canvas = host.page.locator('canvas');
      await canvas.click({ position: { x: 150, y: 100 } });
      await host.page.keyboard.down('d');
      await host.page.keyboard.down(' ');
      await expect
        .poll(
          () =>
            clients[1].observed.state?.players.find((p) => p.id === host.observed.playerId)
              ?.lastSeq ?? -1,
        )
        .toBeGreaterThan(0);
      await host.page.keyboard.up(' ');
      await host.page.keyboard.up('d');
      // No test-side game-state injection: results must arrive from the live timer/rules.
      for (const client of clients)
        await expect(client.page.getByTestId('match-results')).toBeVisible({ timeout: 20000 });
      for (const client of clients) {
        expect(client.observed.room?.status).toBe('finished');
        expect(client.observed.room?.match?.winnerIds).toEqual(
          host.observed.room?.match?.winnerIds,
        );
        expect(client.observed.pageErrors).toEqual([]);
        expect(client.observed.consoleErrors).toEqual([]);
        expect(client.observed.messages.filter((m) => m.type === 'error')).toEqual([]);
      }
    } finally {
      await Promise.all(contexts.map((context) => context.close()));
    }
  });
}
