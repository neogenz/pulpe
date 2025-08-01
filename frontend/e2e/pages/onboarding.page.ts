import { Page, expect, Locator } from '@playwright/test';

export interface OnboardingData {
  firstName: string;
  email: string;
  monthlyIncome: number;
  housingCosts: number;
  healthInsurance: number;
  phonePlan: number;
  transportCosts: number;
  leasingCredit: number;
  password: string;
}

export class OnboardingPage {
  readonly page: Page;

  // Page elements
  readonly startButton: Locator;
  readonly nextButton: Locator;
  readonly previousButton: Locator;
  readonly finishButton: Locator;
  readonly firstNameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly passwordVisibilityToggle: Locator;
  readonly monthlyIncomeInput: Locator;
  readonly housingCostsInput: Locator;
  readonly healthInsuranceInput: Locator;
  readonly phonePlanInput: Locator;
  readonly transportCostsInput: Locator;
  readonly leasingCreditInput: Locator;
  readonly errorMessage: Locator;
  readonly successMessage: Locator;
  readonly loadingIndicator: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // Initialize locators using data-testid attributes
    this.startButton = page.getByTestId('welcome-start-button');
    this.nextButton = page.getByTestId('next-button');
    this.previousButton = page.getByTestId('previous-button');
    this.finishButton = page.locator('button:has-text("Créer le compte"), button:has-text("Terminer"), button:has-text("Créer le template"), button:has-text("Créer le budget"), button:has-text("Finaliser")');
    
    // Form inputs
    this.firstNameInput = page.getByTestId('first-name-input');
    this.emailInput = page.getByTestId('email-input');
    this.passwordInput = page.getByTestId('password-input');
    this.passwordVisibilityToggle = page.getByTestId('password-visibility-toggle');
    this.monthlyIncomeInput = page.getByTestId('monthly-income-input');
    this.housingCostsInput = page.getByTestId('housing-costs-input');
    this.healthInsuranceInput = page.getByTestId('health-insurance-input');
    this.phonePlanInput = page.getByTestId('phone-plan-input');
    this.transportCostsInput = page.getByTestId('transport-costs-input');
    this.leasingCreditInput = page.getByTestId('leasing-credit-input');
    
    // Messages and indicators
    this.errorMessage = page.getByTestId('error-message');
    this.successMessage = page.locator('.bg-green-50, .bg-blue-50, [data-testid="success"]');
    this.loadingIndicator = page.locator('.loading, .spinner, mat-progress-spinner, [data-testid="loading-spinner"]');
  }

  // Navigation methods
  async goto() {
    await this.page.goto('/onboarding/welcome');
    await this.page.waitForLoadState('networkidle');
  }

  async gotoStep(step: string) {
    await this.page.goto(`/onboarding/${step}`);
    await this.page.waitForLoadState('networkidle');
  }

  async clickStart() {
    await this.startButton.click();
    await this.waitForNavigation();
  }

  async clickNext() {
    await this.nextButton.click();
    await this.waitForNavigation();
  }

  async clickPrevious() {
    await this.previousButton.click();
    await this.waitForNavigation();
  }

  async clickFinish() {
    await this.finishButton.click();
  }

  // Step-specific form filling methods
  async fillWelcomeStep() {
    await this.expectWelcomePageVisible();
    await this.clickStart();
  }

  async fillPersonalInfoStep(firstName: string) {
    await this.expectCurrentStep('personal-info');
    
    // Wait for Angular to fully load
    await this.page.waitForLoadState('networkidle');
    // Wait removed - rely on Playwright's auto-waiting
    
    // Initially, the Next button should be disabled
    await this.expectNextButtonDisabled();
    
    // Fill the input field to ensure data is captured for the onboarding store
    await this.firstNameInput.click();
    await this.firstNameInput.clear();
    await this.firstNameInput.pressSequentially(firstName, { delay: 100 });
    
    // Verify the input contains the expected value
    await expect(this.firstNameInput).toHaveValue(firstName);
    
    // Wait for Angular to process the input and enable the button
    // Wait removed - rely on Playwright's auto-waiting
    
    // Now the Next button should be enabled
    await this.expectNextButtonEnabled();
    
    // Click the Next button to navigate (real user interaction)
    await this.clickNext();
  }

  async fillIncomeStep(monthlyIncome: number) {
    await this.expectCurrentStep('income');
    
    // Initially, the Next button should be disabled
    await this.expectNextButtonDisabled();
    
    // Fill the currency input
    await this.monthlyIncomeInput.fill(monthlyIncome.toString());
    // Wait removed - rely on Playwright's auto-waiting
    
    // Verify input value
    await expect(this.monthlyIncomeInput).toHaveValue(monthlyIncome.toString());
    
    // Now the Next button should be enabled
    await this.expectNextButtonEnabled();
    
    // Click the Next button to navigate
    await this.clickNext();
  }

  async fillHousingStep(housingCosts: number) {
    await this.expectCurrentStep('housing');
    
    // For optional fields, the Next button should be enabled by default (null/0 are valid)
    await this.expectNextButtonEnabled();
    
    await this.housingCostsInput.fill(housingCosts.toString());
    // Wait removed - rely on Playwright's auto-waiting
    
    await expect(this.housingCostsInput).toHaveValue(housingCosts.toString());
    
    // Button should remain enabled
    await this.expectNextButtonEnabled();
    
    // Click the Next button to navigate
    await this.clickNext();
  }

  async fillHealthInsuranceStep(healthInsurance: number) {
    await this.expectCurrentStep('health-insurance');
    
    // For optional fields, the Next button should be enabled by default (null/0 are valid)
    await this.expectNextButtonEnabled();
    
    await this.healthInsuranceInput.fill(healthInsurance.toString());
    // Wait removed - rely on Playwright's auto-waiting
    
    await expect(this.healthInsuranceInput).toHaveValue(healthInsurance.toString());
    
    // Button should remain enabled
    await this.expectNextButtonEnabled();
    
    // Click the Next button to navigate
    await this.clickNext();
  }

  async fillPhonePlanStep(phonePlan: number) {
    await this.expectCurrentStep('phone-plan');
    
    // For optional fields, the Next button should be enabled by default (null/0 are valid)
    await this.expectNextButtonEnabled();
    
    await this.phonePlanInput.fill(phonePlan.toString());
    // Wait removed - rely on Playwright's auto-waiting
    
    await expect(this.phonePlanInput).toHaveValue(phonePlan.toString());
    
    // Button should remain enabled
    await this.expectNextButtonEnabled();
    
    // Click the Next button to navigate
    await this.clickNext();
  }

  async fillTransportStep(transportCosts: number) {
    await this.expectCurrentStep('transport');
    
    // For optional fields, the Next button should be enabled by default (null/0 are valid)
    await this.expectNextButtonEnabled();
    
    await this.transportCostsInput.fill(transportCosts.toString());
    // Wait removed - rely on Playwright's auto-waiting
    
    await expect(this.transportCostsInput).toHaveValue(transportCosts.toString());
    
    // Button should remain enabled
    await this.expectNextButtonEnabled();
    
    // Click the Next button to navigate
    await this.clickNext();
  }

  async fillLeasingCreditStep(leasingCredit: number) {
    await this.expectCurrentStep('leasing-credit');
    
    // For optional fields, the Next button should be enabled by default (null/0 are valid)
    await this.expectNextButtonEnabled();
    
    await this.leasingCreditInput.fill(leasingCredit.toString());
    // Wait removed - rely on Playwright's auto-waiting
    
    await expect(this.leasingCreditInput).toHaveValue(leasingCredit.toString());
    
    // Button should remain enabled
    await this.expectNextButtonEnabled();
    
    // Click the Next button to navigate
    await this.clickNext();
  }

  async fillRegistrationStep(email: string, password: string) {
    await this.expectCurrentStep('registration');
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    // Wait removed - rely on Playwright's auto-waiting
    
    // Verify the inputs contain the expected values
    await expect(this.emailInput).toHaveValue(email);
    await expect(this.passwordInput).toHaveValue(password);
    
    // The registration step uses a submit button with data-testid="submit-button"
    const submitButton = this.page.getByTestId('submit-button');
    await expect(submitButton).toBeEnabled();
    await submitButton.click();
  }

  // Complete workflow method - goes through all steps but doesn't submit registration
  async completeOnboardingFlow(data: OnboardingData) {
    await this.fillWelcomeStep();
    await this.fillPersonalInfoStep(data.firstName);
    await this.fillIncomeStep(data.monthlyIncome);
    await this.fillHousingStep(data.housingCosts);
    await this.fillHealthInsuranceStep(data.healthInsurance);
    await this.fillPhonePlanStep(data.phonePlan);
    await this.fillTransportStep(data.transportCosts);
    await this.fillLeasingCreditStep(data.leasingCredit);
    // Don't submit registration - just navigate to it
    await this.expectCurrentStep('registration');
  }

  // Minimal workflow to access registration (only required fields)
  async navigateToRegistrationWithMinimalData() {
    await this.goto();
    await this.fillWelcomeStep();
    await this.fillPersonalInfoStep('Test User');
    await this.fillIncomeStep(5000);
    // Skip optional steps
    await this.gotoStep('registration');
  }

  // Validation and assertion methods
  async expectPageLoaded() {
    await expect(this.page.locator('body')).toBeVisible({ timeout: 10000 });
  }

  async expectWelcomePageVisible() {
    await expect(this.page.locator('h1:has-text("Bienvenue dans Pulpe")')).toBeVisible();
    await expect(this.startButton).toBeVisible();
  }

  async expectCurrentStep(step: string) {
    await expect(this.page).toHaveURL(new RegExp(`/onboarding/${step}`));
    await this.expectPageLoaded();
  }

  async expectValidationErrors() {
    const hasErrors = await this.errorMessage.count() > 0;
    const isNextDisabled = await this.nextButton.isDisabled();
    expect(hasErrors || isNextDisabled).toBeTruthy();
  }

  async expectNoValidationErrors() {
    await expect(this.errorMessage).toHaveCount(0);
  }

  async expectNextButtonEnabled() {
    await expect(this.nextButton).toBeEnabled();
  }

  async expectNextButtonDisabled() {
    await expect(this.nextButton).toBeDisabled();
  }

  async expectSuccessMessage() {
    await expect(this.successMessage).toBeVisible();
  }

  async expectErrorMessage(message?: string) {
    await expect(this.errorMessage).toBeVisible();
    if (message) {
      await expect(this.errorMessage).toContainText(message);
    }
  }

  async expectRegistrationFormVisible() {
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
  }

  async expectLoadingState() {
    await expect(this.loadingIndicator).toBeVisible();
  }

  async expectRedirectToCurrentMonth() {
    await expect(this.page).toHaveURL(new RegExp('/current-month'));
  }

  // Authentication state methods
  async expectAuthenticationCompleted() {
    await expect(this.page.locator('text=Compte créé avec succès')).toBeVisible();
  }

  async expectTemplateCreationInProgress() {
    await expect(this.finishButton).toContainText('Créer le template');
  }

  async expectBudgetCreationInProgress() {
    await expect(this.finishButton).toContainText('Créer le budget');
  }

  async expectCompletionInProgress() {
    await expect(this.finishButton).toContainText('Finaliser');
  }

  // Data persistence methods
  async getLocalStorageData(): Promise<unknown> {
    return await this.page.evaluate(() => {
      const data = localStorage.getItem('pulpe-onboarding-data');
      return data ? JSON.parse(data) : null;
    });
  }

  async clearLocalStorageData() {
    await this.page.evaluate(() => {
      localStorage.removeItem('pulpe-onboarding-data');
    });
  }

  // Utility methods
  async waitForNavigation() {
    await this.page.waitForLoadState('networkidle', { timeout: 10000 });
  }

  async expectUrl(urlPattern: string | RegExp) {
    await expect(this.page).toHaveURL(urlPattern);
  }

  async togglePasswordVisibility() {
    await this.passwordVisibilityToggle.click();
  }

  async expectPasswordVisible() {
    await expect(this.passwordInput).toHaveAttribute('type', 'text');
  }

  async expectPasswordHidden() {
    await expect(this.passwordInput).toHaveAttribute('type', 'password');
  }

  // Form validation helpers
  async expectEmailValidation() {
    await this.emailInput.fill('invalid-email');
    await expect(this.page.locator('.mat-error')).toBeVisible();
  }

  async expectPasswordValidation() {
    await this.passwordInput.fill('123');
    await expect(this.page.locator('mat-hint:has-text("8 caractères")')).toBeVisible();
  }

  async expectRequiredFieldValidation(input: Locator) {
    await input.fill('');
    await input.blur();
    await expect(this.page.locator('.mat-error')).toBeVisible();
  }

  // Progress tracking helpers
  async expectStepProgress() {
    // If there's a progress indicator, validate it
    const progressIndicator = this.page.locator('[data-testid="progress"], .progress');
    if (await progressIndicator.count() > 0) {
      await expect(progressIndicator).toBeVisible();
    }
  }

  // API mocking helpers for registration process
  async mockSuccessfulRegistration() {
    await this.page.route('**/auth/signup', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, user: { id: '123', email: 'test@test.com' } })
      });
    });
  }

  async mockFailedRegistration(errorMessage = 'Email already exists') {
    await this.page.route('**/auth/signup', (route) => {
      void route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: errorMessage })
      });
    });
  }

  async mockTemplateCreation() {
    await this.page.route('**/templates/from-onboarding', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          success: true, 
          data: { 
            template: { 
              id: 'template-123',
              name: 'Mois Standard'
            }
          }
        })
      });
    });
  }

  async mockBudgetCreation() {
    await this.page.route('**/budgets', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          success: true, 
          data: { 
            budget: { 
              id: 'budget-123',
              month: new Date().getMonth() + 1,
              year: new Date().getFullYear()
            }
          }
        })
      });
    });
  }

  async mockNetworkError() {
    await this.page.route('**/auth/signup', (route) => {
      void route.abort('failed');
    });
  }
}