import { test, expect } from '../../fixtures/test-fixtures';
import { TEST_CONFIG } from '../../config/test-config';

test.describe('Automatic feedback across web screens', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.addInitScript((userId) => {
      if (localStorage.getItem('pulpe-feedback-prompt')) return;
      localStorage.setItem(
        'pulpe-feedback-prompt',
        JSON.stringify({
          version: 1,
          updatedAt: new Date().toISOString(),
          data: {
            [userId]: {
              activeDayCount: 2,
              lastActiveDay: '2026-01-01',
              lastPromptedAtActiveDayCount: null,
              promptCount: 0,
              hasSubmitted: false,
            },
          },
        }),
      );
    }, TEST_CONFIG.USER.ID);
    await page.route('**/feedback/status', (route) =>
      route.fulfill({ json: { hasSubmitted: false } }),
    );
  });

  for (const path of [
    `/budget/${TEST_CONFIG.BUDGETS.CURRENT_MONTH.id}`,
    '/settings',
  ]) {
    test(`invites on ${path} without visiting the dashboard`, async ({
      authenticatedPage: page,
    }) => {
      await page.goto(path);
      const dialog = page.getByTestId('feedback-dialog');
      await expect(dialog).toBeVisible();
      await expect(page).toHaveURL(path);
      await dialog.getByTestId('later-button').click();
      await expect(dialog).toBeHidden();

      // A different screen on the same active day must not invite again.
      await page.goto('/budget');
      await expect(page.getByTestId('desktop-navigation')).toBeVisible();
      await expect(dialog).toBeHidden();
      const state = await page.evaluate((userId) => {
        const entry = JSON.parse(
          localStorage.getItem('pulpe-feedback-prompt')!,
        );
        return entry.data[userId];
      }, TEST_CONFIG.USER.ID);
      expect(state.activeDayCount).toBe(3);
      expect(state.promptCount).toBe(1);
    });
  }

  test('a missing dashboard introduction does not block other screens', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/budget');
    const dialog = page.getByTestId('feedback-dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByTestId('later-button').click();

    await page.evaluate((userId) => {
      localStorage.removeItem('pulpe-tour-intro');
      const entry = JSON.parse(localStorage.getItem('pulpe-feedback-prompt')!);
      entry.data[userId].activeDayCount += 3;
      localStorage.setItem('pulpe-feedback-prompt', JSON.stringify(entry));
    }, TEST_CONFIG.USER.ID);

    // Navigate within the app so the auth fixture does not restore the tour state.
    await page.getByTestId('user-menu-trigger').click();
    await page.getByTestId('settings-link').click();
    await expect(page).toHaveURL('/settings');
    await expect(dialog).toBeVisible();
  });
});
