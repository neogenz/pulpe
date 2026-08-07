import { test, expect } from '../../fixtures/test-fixtures';

test.describe('Product tour accessibility', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    await expect(authenticatedPage.getByTestId('dashboard-page')).toBeVisible();
  });

  test('should expose dialog semantics and contain keyboard focus', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.emulateMedia({ reducedMotion: 'reduce' });
    const menuTrigger = authenticatedPage.getByTestId('user-menu-trigger');
    await menuTrigger.focus();
    await authenticatedPage.keyboard.press('Enter');
    await authenticatedPage.keyboard.press('ArrowDown');
    await authenticatedPage.keyboard.press('ArrowDown');
    await expect(
      authenticatedPage.getByTestId('page-tour-button'),
    ).toBeFocused();
    await authenticatedPage.keyboard.press('Enter');

    const dialog = authenticatedPage.getByRole('dialog');
    const closeButton = dialog.getByRole('button', { name: 'Fermer' });
    await expect(dialog).toHaveAccessibleName("Ton mois en un coup d'œil");
    await expect(dialog).toHaveAccessibleDescription(/Commence ici/);
    await expect(dialog).toContainText('Étape 1 sur 3');
    await expect(closeButton).toBeFocused();
    await expect
      .poll(() =>
        closeButton.evaluate((button) => getComputedStyle(button).outlineStyle),
      )
      .not.toBe('none');

    for (const key of ['Shift+Tab', 'Tab']) {
      await authenticatedPage.keyboard.press(key);
      expect(
        await authenticatedPage.evaluate(() => {
          const focused = document.activeElement;
          const activeTarget = document.querySelector('.driver-active-element');
          const popover = document.querySelector('[role="dialog"]');
          return (
            !!focused &&
            (!!popover?.contains(focused) || !!activeTarget?.contains(focused))
          );
        }),
      ).toBe(true);
    }

    await authenticatedPage.keyboard.press('ArrowRight');
    await expect(dialog).toHaveAccessibleName('Commence par ce qui bouge');
    await authenticatedPage.keyboard.press('ArrowLeft');
    await expect(dialog).toHaveAccessibleName("Ton mois en un coup d'œil");
    await authenticatedPage.keyboard.press('Escape');

    await expect(dialog).not.toBeVisible();
    await expect(menuTrigger).toBeFocused();
  });

  test('should complete the tour with the keyboard and restore focus', async ({
    authenticatedPage,
  }) => {
    const menuTrigger = authenticatedPage.getByTestId('user-menu-trigger');
    await menuTrigger.focus();
    await authenticatedPage.keyboard.press('Enter');
    await authenticatedPage.keyboard.press('ArrowDown');
    await authenticatedPage.keyboard.press('ArrowDown');
    await authenticatedPage.keyboard.press('Enter');

    const dialog = authenticatedPage.getByRole('dialog');
    for (const [progress, buttonName] of [
      ['Étape 1 sur 3', 'Suivant'],
      ['Étape 2 sur 3', 'Suivant'],
      ['Étape 3 sur 3', 'Terminer'],
    ] as const) {
      await expect(dialog).toContainText(progress);
      await dialog.evaluate(async (element) => {
        await Promise.all(
          element
            .getAnimations({ subtree: true })
            .map((animation) => animation.finished),
        );
      });
      const button = dialog.getByRole('button', { name: buttonName });
      await button.focus();
      await expect(button).toBeFocused();
      await authenticatedPage.keyboard.press('Enter');
    }

    await expect(dialog).not.toBeVisible();
    await expect(menuTrigger).toBeFocused();
  });
});
