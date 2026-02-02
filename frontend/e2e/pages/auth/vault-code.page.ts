import { expect, type Page } from '@playwright/test';

export class VaultCodePage {
  constructor(private readonly page: Page) {}

  // --- Navigation ---

  async gotoSetup() {
    await this.page.goto('/setup-vault-code', { waitUntil: 'domcontentloaded' });
    await expect(this.page.getByTestId('setup-vault-code-page')).toBeVisible();
  }

  async gotoEnter() {
    await this.page.goto('/enter-vault-code', { waitUntil: 'domcontentloaded' });
    await expect(this.page.getByTestId('enter-vault-code-page')).toBeVisible();
  }

  async gotoRecover() {
    await this.page.goto('/recover-vault-code', { waitUntil: 'domcontentloaded' });
    await expect(this.page.getByTestId('recover-vault-code-page')).toBeVisible();
  }

  // --- Form interactions ---

  async fillVaultCode(code: string) {
    await this.page.getByTestId('vault-code-input').fill(code);
  }

  async fillConfirmCode(code: string) {
    await this.page.getByTestId('confirm-vault-code-input').fill(code);
  }

  async fillRecoveryKey(key: string) {
    await this.page.getByTestId('recovery-key-input').fill(key);
  }

  async fillNewVaultCode(code: string) {
    await this.page.getByTestId('new-vault-code-input').fill(code);
  }

  async toggleRememberDevice() {
    await this.page.getByTestId('remember-device-checkbox').click();
  }

  async submitSetup() {
    await this.page.getByTestId('setup-vault-code-submit-button').click();
  }

  async submitEnter() {
    await this.page.getByTestId('enter-vault-code-submit-button').click();
  }

  async submitRecover() {
    await this.page.getByTestId('recover-vault-code-submit-button').click();
  }

  async clickLostCodeLink() {
    await this.page.getByTestId('lost-code-link').click();
  }

  // --- Recovery key dialog ---

  async expectRecoveryKeyDialogVisible() {
    await expect(this.page.getByTestId('recovery-key-dialog')).toBeVisible();
  }

  async expectRecoveryKeyDisplayed(key: string) {
    await expect(this.page.getByTestId('recovery-key-display')).toContainText(key);
  }

  async confirmRecoveryKey(key: string) {
    await this.page.getByTestId('recovery-key-confirm-input').fill(key);
    await this.page.getByTestId('recovery-key-confirm-button').click();
  }

  // --- Assertions ---

  async expectOnPage(page: 'setup' | 'enter' | 'recover') {
    const testIdMap = {
      setup: 'setup-vault-code-page',
      enter: 'enter-vault-code-page',
      recover: 'recover-vault-code-page',
    } as const;
    await expect(this.page.getByTestId(testIdMap[page])).toBeVisible();
  }

  async expectUrl(path: string) {
    await expect(this.page).toHaveURL(new RegExp(path));
  }

  async expectErrorVisible(text: string | RegExp) {
    await expect(this.page.locator('mat-error').first()).toContainText(text);
  }
}
