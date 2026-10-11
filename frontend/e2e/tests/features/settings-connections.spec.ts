import { test, expect } from '../../fixtures/test-fixtures';

for (const width of [375, 1280]) {
  test(`guides assistant setup from settings at ${width}px`, async ({
    authenticatedPage: page,
  }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/v1/mcp/connections', (route) =>
      route.fulfill({ json: { success: true, data: [] } }),
    );
    await page.goto('/settings');
    await page.getByTestId('connections-settings-link').click();
    const guide = page.getByRole('region', { name: 'Brancher un assistant' });
    await expect(guide).toBeVisible();
    await expect(page.getByTestId('connections-empty')).toBeVisible();
    const chatgpt = guide.getByRole('link', { name: 'Ouvrir ChatGPT' });
    const claude = guide.getByRole('link', { name: 'Ouvrir Claude' });
    await expect(chatgpt).toHaveAttribute(
      'href',
      'https://chatgpt.com/plugins',
    );
    await expect(claude).toHaveAttribute(
      'href',
      /connectorUrl=http%3A%2F%2Flocalhost%3A3000%2Fmcp/,
    );
    await expect(claude).toHaveAttribute('target', '_blank');
    for (const client of ['chatgpt', 'claude']) {
      const summary = guide.getByTestId(`setup-steps-${client}`);
      const details = summary.locator('..');
      await expect(details).not.toHaveAttribute('open');
      await summary.focus();
      await page.keyboard.press('Enter');
      await expect(details).toHaveAttribute('open');
      await page.keyboard.press('Enter');
      await expect(details).not.toHaveAttribute('open');
    }
    await guide.getByRole('button', { name: 'Copier l’adresse' }).focus();
    await page.keyboard.press('Enter');
    await expect(guide.getByRole('status')).toHaveText('Adresse copiée.');
    await page.getByTestId('page-title').scrollIntoViewIfNeeded();
    await page.screenshot({
      path: testInfo.outputPath(`setup-${width}.png`),
      fullPage: true,
    });
    const box = await guide.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    expect(errors).toEqual([]);
  });

  test(`keeps connected assistant controls accessible with long history at ${width}px`, async ({
    authenticatedPage: page,
  }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const id = '11111111-1111-4111-8111-111111111111';
    const entries = Array.from({ length: 50 }, (_, index) => ({
      tool: index < 2 ? 'toggle_check' : 'add_movement',
      outcome: 'ok',
      createdAt: '2026-10-10T09:42:00.000Z',
    }));
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/v1/mcp/connections', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: [
            {
              id,
              clientName: 'ChatGPT',
              mode: 'read_write',
              authorizedAt: '2026-10-10T09:00:00.000Z',
            },
          ],
        },
      }),
    );
    await page.route(`**/api/v1/mcp/connections/${id}/activity?*`, (route) => {
      const limit = Number(
        new URL(route.request().url()).searchParams.get('limit'),
      );
      return route.fulfill({
        json: { success: true, data: entries.slice(0, limit) },
      });
    });
    await page.goto('/settings/connections');
    const card = page.getByTestId('connection-card');
    const guide = page.getByTestId('connection-setup');
    await expect(
      page.getByRole('heading', { name: 'Assistants connectés' }),
    ).toBeVisible();
    expect((await card.boundingBox())!.y).toBeLessThan(
      (await guide.boundingBox())!.y,
    );
    await page.screenshot({
      path: testInfo.outputPath(`connected-collapsed-${width}.png`),
      fullPage: true,
    });
    const toggle = card.getByTestId('connection-load-activity');
    await toggle.click();
    await expect(card.getByTestId('connection-activity-row')).toHaveCount(5);
    await card.getByTestId('connection-see-all').click();
    await expect(card.getByTestId('connection-activity-row')).toHaveCount(50);
    const history = card.getByTestId('connection-activity');
    expect(
      await history.evaluate(
        (element) => element.scrollHeight > element.clientHeight,
      ),
    ).toBe(true);
    await page.getByTestId('page-title').scrollIntoViewIfNeeded();
    await expect(card.getByTestId('connection-revoke-button')).toBeInViewport();
    await page.screenshot({
      path: testInfo.outputPath(`connected-${width}.png`),
      fullPage: true,
    });
    await card.getByTestId('connection-show-less').click();
    await expect(card.getByTestId('connection-activity-row')).toHaveCount(5);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(history).toBeHidden();
    expect(errors).toEqual([]);
  });
}
