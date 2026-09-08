import { test, expect } from '../../fixtures/test-fixtures';

for (const width of [375, 1280]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`empty states stay quiet and usable at ${width}px in ${colorScheme}`, async ({
      authenticatedPage: page,
    }, testInfo) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      await page.route('**/api/v1/budget-templates', (route) =>
        route.fulfill({ json: { success: true, data: [] } }),
      );

      for (const [path, testId] of [
        ['/settings/tags', 'tags-empty'],
        ['/budget-templates', 'empty-state'],
        ['/savings-goals', 'savings-goals-empty'],
      ]) {
        await page.goto(path);
        const empty = page.getByTestId(testId);
        await expect(empty).toBeVisible();
        await expect(empty.getByRole('heading', { level: 2 })).toBeVisible();
        await expect(empty.locator('mat-icon, mat-card')).toHaveCount(0);
        await expect(empty).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
        await expect(empty).toHaveCSS('border-top-width', '0px');
        await expect(empty).toHaveCSS('padding-top', '64px');
        const box = await empty.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
        await page.screenshot({
          path: testInfo.outputPath(`${testId}-${width}-${colorScheme}.png`),
          fullPage: true,
        });
      }

      const create = page
        .getByTestId('savings-goals-empty')
        .getByRole('button');
      await create.focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('dialog')).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
}
