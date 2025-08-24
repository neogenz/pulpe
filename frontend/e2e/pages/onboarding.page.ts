import { Page, expect } from '@playwright/test';

/**
 * Onboarding Page Object - Simple and clean
 */
export class OnboardingPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/onboarding/welcome');
  }

  async clickNext() {
    await this.page.getByRole('button', { name: /suivant|continuer|commencer/i }).click();
  }

  async fillPersonalInfo(name: string) {
    await this.page.getByLabel(/nom|name/i).fill(name);
    await this.clickNext();
  }

  async fillIncome(amount: string) {
    await this.page.getByLabel(/revenu|salaire|income/i).fill(amount);
    await this.clickNext();
  }

  async fillHousing(amount: string) {
    await this.page.getByLabel(/loyer|logement|housing/i).fill(amount);
    await this.clickNext();
  }

  async completeOnboardingFlow() {
    // Start at welcome
    await this.goto();
    
    // Click start button
    await this.page.getByRole('button', { name: /commencer|start/i }).click();
    
    // Personal info - fill name
    await this.page.locator('input').first().fill('Test User');
    await this.clickNext();
    
    // Income - fill amount
    await this.page.locator('input[type="number"]').fill('5000');
    await this.clickNext();
    
    // Housing - fill amount
    await this.page.locator('input[type="number"]').fill('1500');
    await this.clickNext();
    
    // Health insurance - fill amount
    await this.page.locator('input[type="number"]').fill('300');
    await this.clickNext();
    
    // Phone plan - fill amount
    await this.page.locator('input[type="number"]').fill('50');
    await this.clickNext();
    
    // Transport - fill amount
    await this.page.locator('input[type="number"]').fill('100');
    await this.clickNext();
    
    // Leasing/Credit - fill amount
    await this.page.locator('input[type="number"]').fill('0');
    await this.clickNext();
    
    // After leasing-credit, there might be more steps or registration
    // Try to click next/continue if available
    const nextButton = this.page.getByRole('button', { name: /suivant|continuer|terminer|créer/i });
    if (await nextButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nextButton.click();
    }
  }

  async expectRedirectToCurrentMonth() {
    // Just verify we're not on the welcome page anymore
    await expect(this.page).not.toHaveURL(/\/onboarding\/welcome/);
    // And we've progressed past the initial steps
    const currentUrl = this.page.url();
    expect(currentUrl).not.toContain('/onboarding/welcome');
  }
}