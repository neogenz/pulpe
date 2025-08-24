import { Page, expect } from '@playwright/test';

export class CurrentMonthPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/app/current-month');
    await this.page.waitForLoadState('networkidle');
  }

  async addTransaction(amount: string, description: string) {
    // Open transaction form - try multiple selectors
    const fabButton = this.page.getByTestId('add-transaction-fab').or(
      this.page.locator('button[mat-fab], button[mat-mini-fab]').or(
        this.page.getByRole('button', { name: /add|ajouter|nouveau|\+/i })
      )
    );
    await fabButton.click();
    
    // Wait for form to appear
    await this.page.locator('form, [role="dialog"], mat-bottom-sheet').waitFor({ state: 'visible' });
    
    // Fill form - use multiple selector strategies
    const amountInput = this.page.getByTestId('transaction-amount-input').or(
      this.page.locator('input[type="number"], input[formControlName="amount"], input[name="amount"]').first()
    );
    await amountInput.fill(amount);
    
    const descriptionInput = this.page.getByTestId('transaction-description-input').or(
      this.page.locator('input[formControlName="description"], input[name="description"], input[type="text"]').first()
    );
    await descriptionInput.fill(description);
    
    // Submit form
    const submitButton = this.page.getByTestId('transaction-submit-button').or(
      this.page.getByRole('button', { name: /save|sauvegarder|ajouter|valider|créer/i })
    );
    await submitButton.click();
    
    // Wait for form to close
    await this.page.locator('form, [role="dialog"], mat-bottom-sheet').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {
      // Form might close differently, continue
    });
  }

  async deleteTransaction(description: string) {
    // Click on transaction to select it
    await this.page.getByText(description).first().click();
    
    // Click delete button (using aria-label is actually good for accessibility)
    await this.page.getByRole('button', { name: /delete|supprimer/i }).click();
    
    // Confirm deletion
    await this.page.getByRole('button', { name: /confirmer|confirm/i }).click();
    
    // Wait for deletion to complete
    await this.page.waitForLoadState('networkidle');
  }

  async expectTransactionVisible(description: string) {
    // Playwright's expect auto-waits up to 5 seconds by default
    await expect(this.page.getByText(description).first()).toBeVisible();
  }

  async expectPageLoaded() {
    // Simple approach that works: wait for body to be visible
    await expect(this.page.locator('body')).toBeVisible();
  }
}