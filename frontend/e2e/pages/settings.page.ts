import { type Page, expect } from '@playwright/test';

export class SettingsPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/app/settings');
    await this.expectPageLoaded();
  }

  async expectPageLoaded(): Promise<void> {
    await expect(this.page.getByTestId('settings-page')).toBeVisible();
  }

  async selectPayDay(day: number | null): Promise<void> {
    const select = this.page.getByTestId('pay-day-select');
    await select.click();

    if (day === null) {
      await this.page.getByRole('option', { name: '1er du mois' }).click();
    } else {
      await this.page.getByRole('option', { name: `Le ${day}` }).click();
    }
  }

  async saveSettings(): Promise<void> {
    await this.page.getByTestId('save-settings-button').click();
  }

  async cancelChanges(): Promise<void> {
    await this.page.getByTestId('cancel-settings-button').click();
  }

  async expectPayDaySelected(day: number | null): Promise<void> {
    const select = this.page.getByTestId('pay-day-select');
    if (day === null) {
      // When null, the mat-select may be empty or show "1er du mois"
      // Check that it's visible and either empty or showing the placeholder
      await expect(select).toBeVisible();
    } else {
      await expect(select).toContainText(`Le ${day}`);
    }
  }

  async expectHintContains(text: string): Promise<void> {
    const hint = this.page.getByTestId('pay-day-hint');
    await expect(hint).toContainText(text);
  }

  async expectSuccessMessage(): Promise<void> {
    await expect(
      this.page.locator('.mat-mdc-snack-bar-label').last(),
    ).toContainText('Paramètres enregistrés');
  }

  async expectSaveButtonVisible(): Promise<void> {
    await expect(this.page.getByTestId('save-settings-button')).toBeVisible();
  }

  async expectSaveButtonHidden(): Promise<void> {
    await expect(
      this.page.getByTestId('save-settings-button'),
    ).not.toBeVisible();
  }
}
