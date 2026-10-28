import { expect, test, type Browser, type BrowserContext } from '@playwright/test';
import { observeClient } from './observed-client';

async function guest(browser: Browser, name: string) {
  const context = await browser.newContext();
  await context.addInitScript((displayName) => {
    localStorage.setItem('retroverse.name', displayName);
    localStorage.setItem('retroverse.mute', 'true');
  }, name);
  const page = await context.newPage();
  const observed = observeClient(page);
  return { context, page, observed };
}

test('home, full library search, original names, and mobile navigation', async ({ page }) => {
  const observed = observeClient(page);
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: /Play a little\.\s*Stay a while\./ }),
  ).toBeVisible();
  await page.goto('/#/library');
  await expect(page.getByRole('heading', { name: /library/i })).toBeVisible();
  await page.getByRole('searchbox').fill('no-such-game-91827');
  await expect(page.getByText(/no games/i)).toBeVisible();
  await page.getByRole('searchbox').fill('Prism');
  await expect(page.getByRole('heading', { name: 'Prism Skirmish', exact: true })).toBeVisible();
  await page.getByRole('searchbox').fill('Night Circuit');
  await expect(page.getByRole('heading', { name: 'Night Circuit', exact: true })).toBeVisible();
  await expect(page.getByText('PLAYABLE NOW', { exact: true }).first()).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/settings');
  await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  expect(overflow).toBe(false);
  expect(observed.pageErrors).toEqual([]);
  expect(observed.consoleErrors).toEqual([]);
});

test('two independent guests join a private room, synchronize movement and shooting, finish and rematch', async ({
  browser,
}) => {
  const contexts: BrowserContext[] = [];
  try {
    const host = await guest(browser, 'Atlas');
    contexts.push(host.context);
    const friend = await guest(browser, 'Nova');
    contexts.push(friend.context);
    await Promise.all([host.page.goto('/#/room'), friend.page.goto('/#/room')]);
    await expect.poll(() => host.observed.playerId).not.toBe('');
    await expect.poll(() => friend.observed.playerId).not.toBe('');
    expect(host.observed.playerId).not.toBe(friend.observed.playerId);
    await host.page.getByRole('button', { name: 'Create room', exact: true }).click();
    await expect(host.page.getByTestId('room-code')).toBeVisible();
    const code = host.observed.room?.code;
    expect(code).toMatch(/^[A-F0-9]{12}$/);
    await friend.page.getByLabel('Room code', { exact: true }).fill(code!);
    await friend.page.getByRole('button', { name: 'Join room', exact: true }).click();
    await expect.poll(() => friend.observed.room?.players.length).toBe(2);
    await host.page.getByRole('button', { name: 'Ready up', exact: true }).click();
    await friend.page.getByRole('button', { name: 'Ready up', exact: true }).click();
    await expect(host.page.getByRole('button', { name: 'Start match', exact: true })).toBeEnabled();
    await host.page.getByRole('button', { name: 'Start match', exact: true }).click();
    await Promise.all([
      expect(host.page.getByTestId('game-screen')).toBeVisible(),
      expect(friend.page.getByTestId('game-screen')).toBeVisible(),
    ]);
    const canvas = host.page.locator('canvas');
    await expect(canvas).toBeVisible();
    await expect.poll(() => host.observed.state?.players.length).toBe(2);
    const initialX = host.observed.state!.players.find((p) => p.id === host.observed.playerId)!.x;
    await canvas.click({ position: { x: 50, y: 50 } });
    await host.page.keyboard.down('d');
    await expect
      .poll(() => friend.observed.state?.players.find((p) => p.id === host.observed.playerId)?.x)
      .toBeGreaterThan(initialX + 30);
    await host.page.keyboard.up('d');
    const arena = await canvas.boundingBox();
    expect(arena).not.toBeNull();
    await host.page.mouse.move(arena!.x + arena!.width * 0.85, arena!.y + arena!.height * 0.2);
    await host.page.mouse.down();
    await expect
      .poll(() =>
        friend.observed.snapshots.some((s) =>
          s.bullets.some((b) => b.ownerId === host.observed.playerId),
        ),
      )
      .toBe(true);
    await host.page.mouse.up();
    // Match results come from the authoritative server's configured short timer.
    await Promise.all([
      expect(host.page.getByTestId('match-results')).toBeVisible({ timeout: 20_000 }),
      expect(friend.page.getByTestId('match-results')).toBeVisible({ timeout: 20_000 }),
    ]);
    expect(host.observed.room?.status).toBe('finished');
    expect(friend.observed.room?.match?.winnerIds).toEqual(host.observed.room?.match?.winnerIds);
    await host.page.getByRole('button', { name: /rematch/i }).click();
    await expect(host.page.getByRole('button', { name: 'Ready up', exact: true })).toBeVisible();
    await expect.poll(() => friend.observed.room?.status).toBe('waiting');
    await host.page.getByRole('button', { name: 'Leave room', exact: true }).click();
    await expect(host.page.getByRole('heading', { name: /library/i })).toBeVisible();
    expect(host.observed.pageErrors).toEqual([]);
    expect(friend.observed.pageErrors).toEqual([]);
    expect(host.observed.consoleErrors).toEqual([]);
    expect(friend.observed.consoleErrors).toEqual([]);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

test('public queue can be cancelled and then pairs distinct browser guests', async ({
  browser,
}) => {
  const contexts: BrowserContext[] = [];
  try {
    const first = await guest(browser, 'Cyan');
    contexts.push(first.context);
    const second = await guest(browser, 'Magenta');
    contexts.push(second.context);
    await first.page.goto('/#/matchmaking');
    await expect.poll(() => first.observed.playerId).not.toBe('');
    await first.page.getByRole('button', { name: 'Find match', exact: true }).click();
    await expect(
      first.page.getByRole('button', { name: 'Cancel search', exact: true }),
    ).toBeVisible();
    await first.page.getByRole('button', { name: 'Cancel search', exact: true }).click();
    await expect(first.page.getByRole('button', { name: 'Find match', exact: true })).toBeVisible();
    await first.page.getByRole('button', { name: 'Find match', exact: true }).click();
    await second.page.goto('/#/matchmaking');
    await expect.poll(() => second.observed.playerId).not.toBe('');
    await second.page.getByRole('button', { name: 'Find match', exact: true }).click();
    await Promise.all([
      expect(first.page.getByTestId('game-screen')).toBeVisible(),
      expect(second.page.getByTestId('game-screen')).toBeVisible(),
    ]);
    expect(first.observed.room?.visibility).toBe('public');
    expect(first.observed.room?.code).toBe(second.observed.room?.code);
    expect(new Set(first.observed.room?.players.map((p) => p.id)).size).toBe(2);
    await Promise.all([
      expect(first.page.getByTestId('match-results')).toBeVisible({ timeout: 20_000 }),
      expect(second.page.getByTestId('match-results')).toBeVisible({ timeout: 20_000 }),
    ]);
    expect(first.observed.pageErrors).toEqual([]);
    expect(second.observed.pageErrors).toEqual([]);
    expect(first.observed.consoleErrors).toEqual([]);
    expect(second.observed.consoleErrors).toEqual([]);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

test('invitation URL prefills a room and guest identity survives a reload', async ({ browser }) => {
  const contexts: BrowserContext[] = [];
  try {
    const host = await guest(browser, 'InviteHost');
    contexts.push(host.context);
    const invited = await guest(browser, 'InviteGuest');
    contexts.push(invited.context);
    await host.page.goto('/#/room');
    await expect.poll(() => host.observed.playerId).not.toBe('');
    await host.page.getByRole('button', { name: 'Create room', exact: true }).click();
    await expect(host.page.getByTestId('room-code')).toBeVisible();
    const code = host.observed.room!.code;
    await invited.page.goto(`/?room=${code}#/room`);
    await expect(invited.page.getByLabel('Room code', { exact: true })).toHaveValue(code);
    await expect(
      invited.page.getByRole('button', { name: 'Join room', exact: true }),
    ).toBeEnabled();
    await invited.page.getByRole('button', { name: 'Join room', exact: true }).click();
    await expect.poll(() => invited.observed.room?.players.length).toBe(2);
    const guestId = invited.observed.playerId;
    await invited.page.reload();
    await expect(invited.page.getByTestId('room-code')).toHaveText(code);
    await expect
      .poll(() =>
        invited.observed.messages.some((message) => message.type === 'welcome' && message.resumed),
      )
      .toBe(true);
    expect(invited.observed.playerId).toBe(guestId);
    await expect
      .poll(() => host.observed.room?.players.find((player) => player.id === guestId)?.connected)
      .toBe(true);
    expect(invited.observed.pageErrors).toEqual([]);
    expect(invited.observed.consoleErrors).toEqual([]);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
