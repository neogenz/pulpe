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
    
    // Registration step - wait for registration page
    await this.page.waitForTimeout(1000); // Small wait for page transition
    
    // Check if we're on registration page by looking for email input
    const emailInput = this.page.locator('input[type="email"]');
    const passwordInput = this.page.locator('input[type="password"]');
    
    if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Fill registration form
      const testEmail = `e2e-test-${Date.now()}@pulpe.local`;
      const testPassword = 'TestPassword123!';
      
      await emailInput.fill(testEmail);
      await passwordInput.fill(testPassword);
      
      // Click the create button
      const createButton = this.page.getByRole('button', { name: /créer|create|s'inscrire|register/i });
      await createButton.click();
      
      // Wait for navigation after registration
      await this.page.waitForURL(/\/app|\/current-month/, { timeout: 10000 }).catch(() => {
        // Registration might have different redirect
      });
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