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
    await chatgpt.focus();
    await page.keyboard.press('Tab');
    await expect(claude).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(
      guide.getByRole('button', { name: 'Copier l’adresse' }),
    ).toBeFocused();
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
}
