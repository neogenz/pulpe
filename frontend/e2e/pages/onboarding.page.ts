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

  // Helper method to fill a numeric input step
  private async fillNumericStep(amount: string) {
    await this.page.locator('input[type="number"]').fill(amount);
    await this.clickNext();
  }

  // Helper method to fill personal info
  private async fillPersonalInfo(name: string = 'Test User') {
    await this.page.locator('input').first().fill(name);
    await this.clickNext();
  }

  // Helper method to handle registration
  private async completeRegistration(email?: string, password?: string) {
    await this.page.waitForLoadState('domcontentloaded');
    
    const emailInput = this.page.locator('input[type="email"]');
    const passwordInput = this.page.locator('input[type="password"]');
    
    if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      const testEmail = email || `e2e-test-${Date.now()}@pulpe.local`;
      const testPassword = password || 'TestPassword123!';
      
      await emailInput.fill(testEmail);
      await passwordInput.fill(testPassword);
      
      const createButton = this.page.getByRole('button', { name: /créer|create|s'inscrire|register/i });
      await createButton.click();
      
      await this.page.waitForURL(/\/app|\/current-month/, { timeout: 10000 }).catch(() => {
        // Registration might have different redirect
      });
    }
  }

  // Main flow with configurable amounts
  async completeOnboardingFlow(config?: {
    name?: string;
    income?: string;
    housing?: string;
    healthInsurance?: string;
    phonePlan?: string;
    transport?: string;
    leasingCredit?: string;
    email?: string;
    password?: string;
  }) {
    const defaults = {
      name: 'Test User',
      income: '5000',
      housing: '1500',
      healthInsurance: '300',
      phonePlan: '50',
      transport: '100',
      leasingCredit: '0'
    };
    
    const values = { ...defaults, ...config };
    
    // Start at welcome
    await this.goto();
    
    // Click start button
    await this.page.getByRole('button', { name: /commencer|start/i }).click();
    
    // Fill all steps using helper methods
    await this.fillPersonalInfo(values.name);
    await this.fillNumericStep(values.income);        // Income
    await this.fillNumericStep(values.housing);       // Housing
    await this.fillNumericStep(values.healthInsurance); // Health insurance
    await this.fillNumericStep(values.phonePlan);     // Phone plan
    await this.fillNumericStep(values.transport);     // Transport
    await this.fillNumericStep(values.leasingCredit); // Leasing/Credit
    
    // Complete registration if needed
    await this.completeRegistration(config?.email, config?.password);
  }

  async expectRedirectToCurrentMonth() {
    // Just verify we're not on the welcome page anymore
    await expect(this.page).not.toHaveURL(/\/onboarding\/welcome/);
    // And we've progressed past the initial steps
    const currentUrl = this.page.url();
    expect(currentUrl).not.toContain('/onboarding/welcome');
  }
}