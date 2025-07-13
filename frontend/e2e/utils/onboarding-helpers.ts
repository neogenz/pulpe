import { Page, expect } from '@playwright/test';
import { OnboardingPage, OnboardingData } from '../pages/onboarding.page';
import { 
  validOnboardingData, 
  generateValidOnboardingData,
  registrationStepsTestData 
} from '../fixtures/onboarding-test-data';

/**
 * Helper utilities for onboarding E2E tests
 * Provides reusable functions for common onboarding test scenarios
 */

export class OnboardingTestHelpers {
  constructor(private page: Page) {}

  /**
   * Sets up a complete successful registration flow with all API mocks
   */
  async setupSuccessfulRegistrationFlow(onboardingPage: OnboardingPage): Promise<void> {
    await onboardingPage.mockSuccessfulRegistration();
    await onboardingPage.mockTemplateCreation();
    await onboardingPage.mockBudgetCreation();
  }

  /**
   * Prepopulates localStorage with test data for quick test setup
   */
  async prepopulateOnboardingData(
    onboardingPage: OnboardingPage, 
    data: OnboardingData = validOnboardingData
  ): Promise<void> {
    await this.page.evaluate((testData) => {
      localStorage.setItem('pulpe-onboarding-data', JSON.stringify({
        onboardingData: testData,
        processState: {
          currentStep: 'authentication',
          completedSteps: [],
          templateId: undefined
        }
      }));
    }, data);
  }

  /**
   * Simulates a partial completion state for testing recovery scenarios
   */
  async setupPartialCompletionState(
    onboardingPage: OnboardingPage,
    completedSteps: string[] = ['authentication'],
    currentStep: string = 'template_creation',
    templateId?: string
  ): Promise<void> {
    await this.page.evaluate((state) => {
      const existingData = JSON.parse(localStorage.getItem('pulpe-onboarding-data') || '{}');
      existingData.processState = {
        currentStep: state.currentStep,
        completedSteps: state.completedSteps,
        templateId: state.templateId
      };
      localStorage.setItem('pulpe-onboarding-data', JSON.stringify(existingData));
    }, { completedSteps, currentStep, templateId });
  }

  /**
   * Simulates network conditions for testing error scenarios
   */
  async setupNetworkConditions(
    onboardingPage: OnboardingPage,
    condition: 'slow' | 'offline' | 'intermittent'
  ): Promise<void> {
    switch (condition) {
      case 'slow':
        await this.page.route('**/*', async (route) => {
          await new Promise(resolve => setTimeout(resolve, 2000));
          await route.continue();
        });
        break;
      
      case 'offline':
        await this.page.route('**/*', (route) => {
          route.abort('failed');
        });
        break;
      
      case 'intermittent':
        let requestCount = 0;
        await this.page.route('**/*', async (route) => {
          requestCount++;
          if (requestCount % 3 === 0) {
            route.abort('failed');
          } else {
            await route.continue();
          }
        });
        break;
    }
  }

  /**
   * Fills the entire onboarding flow with valid data for quick testing
   */
  async fillCompleteOnboardingFlow(
    onboardingPage: OnboardingPage,
    data: OnboardingData = validOnboardingData
  ): Promise<void> {
    await onboardingPage.goto();
    await onboardingPage.completeOnboardingFlow(data);
  }

  /**
   * Validates that all form data matches expected values
   */
  async validateFormData(
    onboardingPage: OnboardingPage,
    expectedData: Partial<OnboardingData>
  ): Promise<void> {
    if (expectedData.firstName) {
      await onboardingPage.gotoStep('personal-info');
      await expect(onboardingPage.firstNameInput).toHaveValue(expectedData.firstName);
    }

    if (expectedData.monthlyIncome !== undefined) {
      await onboardingPage.gotoStep('income');
      await expect(onboardingPage.monthlyIncomeInput).toHaveValue(expectedData.monthlyIncome.toString());
    }

    if (expectedData.housingCosts !== undefined) {
      await onboardingPage.gotoStep('housing');
      await expect(onboardingPage.housingCostsInput).toHaveValue(expectedData.housingCosts.toString());
    }

    if (expectedData.email) {
      await onboardingPage.gotoStep('registration');
      await expect(onboardingPage.emailInput).toHaveValue(expectedData.email);
    }
  }

  /**
   * Simulates different failure scenarios at each registration step
   */
  async setupRegistrationFailure(
    onboardingPage: OnboardingPage,
    failureStep: 'authentication' | 'template' | 'budget',
    errorMessage: string = 'Test error'
  ): Promise<void> {
    switch (failureStep) {
      case 'authentication':
        await onboardingPage.mockFailedRegistration(errorMessage);
        break;
      
      case 'template':
        await onboardingPage.mockSuccessfulRegistration();
        void onboardingPage.page.route('**/templates/from-onboarding', (route) => {
          void route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({ success: false, error: errorMessage })
          });
        });
        break;
      
      case 'budget':
        await onboardingPage.mockSuccessfulRegistration();
        await onboardingPage.mockTemplateCreation();
        void onboardingPage.page.route('**/budgets', (route) => {
          void route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({ success: false, error: errorMessage })
          });
        });
        break;
    }
  }

  /**
   * Waits for and validates specific UI states during the onboarding process
   */
  async waitForOnboardingState(
    onboardingPage: OnboardingPage,
    state: 'loading' | 'error' | 'success' | 'auth-completed' | 'template-progress' | 'budget-progress'
  ): Promise<void> {
    switch (state) {
      case 'loading':
        await onboardingPage.expectLoadingState();
        break;
      
      case 'error':
        await onboardingPage.expectErrorMessage();
        break;
      
      case 'success':
        await onboardingPage.expectSuccessMessage();
        break;
      
      case 'auth-completed':
        await onboardingPage.expectAuthenticationCompleted();
        break;
      
      case 'template-progress':
        await onboardingPage.expectTemplateCreationInProgress();
        break;
      
      case 'budget-progress':
        await onboardingPage.expectBudgetCreationInProgress();
        break;
    }
  }

  /**
   * Simulates browser storage manipulation for testing edge cases
   */
  async manipulateStorage(
    action: 'corrupt' | 'clear' | 'partial' | 'invalid-json'
  ): Promise<void> {
    switch (action) {
      case 'corrupt':
        await this.page.evaluate(() => {
          localStorage.setItem('pulpe-onboarding-data', '{"corrupted": true, "missing');
        });
        break;
      
      case 'clear':
        await this.page.evaluate(() => {
          localStorage.removeItem('pulpe-onboarding-data');
        });
        break;
      
      case 'partial':
        await this.page.evaluate(() => {
          localStorage.setItem('pulpe-onboarding-data', JSON.stringify({
            onboardingData: { firstName: 'Partial' },
            processState: null
          }));
        });
        break;
      
      case 'invalid-json':
        await this.page.evaluate(() => {
          localStorage.setItem('pulpe-onboarding-data', 'not-json-at-all');
        });
        break;
    }
  }

  /**
   * Creates test scenarios for responsive testing
   */
  async testResponsiveNavigation(
    onboardingPage: OnboardingPage,
    viewport: { width: number; height: number }
  ): Promise<void> {
    await this.page.setViewportSize(viewport);
    
    await onboardingPage.goto();
    await onboardingPage.expectWelcomePageVisible();
    
    // Test basic navigation on this viewport
    await onboardingPage.clickStart();
    await onboardingPage.expectCurrentStep('personal-info');
    
    await onboardingPage.firstNameInput.fill('ResponsiveTest');
    await onboardingPage.clickNext();
    await onboardingPage.expectCurrentStep('housing');
  }

  /**
   * Generates test data variations for comprehensive testing
   */
  generateTestDataVariations(): OnboardingData[] {
    return [
      validOnboardingData,
      generateValidOnboardingData(),
      {
        ...validOnboardingData,
        firstName: 'José-María',
        email: 'test+special@domain-with-hyphens.co.uk',
        monthlyIncome: 0
      },
      {
        ...validOnboardingData,
        firstName: 'VeryLongFirstNameThatTestsLimits',
        monthlyIncome: 999999,
        housingCosts: 0
      }
    ];
  }

  /**
   * Validates accessibility requirements
   */
  async validateAccessibility(onboardingPage: OnboardingPage): Promise<void> {
    // Check for proper form labels
    await onboardingPage.gotoStep('registration');
    
    const emailLabel = this.page.locator('label:has-text("Email")');
    const passwordLabel = this.page.locator('label:has-text("Mot de passe")');
    
    await expect(emailLabel).toBeVisible();
    await expect(passwordLabel).toBeVisible();
    
    // Check for error message accessibility
    await onboardingPage.emailInput.fill('invalid');
    await onboardingPage.emailInput.blur();
    
    const errorMessage = this.page.locator('.mat-error');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toHaveAttribute('role', 'alert');
  }

  /**
   * Simulates keyboard-only navigation for accessibility testing
   */
  async testKeyboardNavigation(onboardingPage: OnboardingPage): Promise<void> {
    await onboardingPage.gotoStep('personal-info');
    
    // Tab to first name field
    await this.page.keyboard.press('Tab');
    await expect(onboardingPage.firstNameInput).toBeFocused();
    
    // Type name and tab to next button
    await this.page.keyboard.type('KeyboardUser');
    await this.page.keyboard.press('Tab');
    await expect(onboardingPage.nextButton).toBeFocused();
    
    // Press Enter to submit
    await this.page.keyboard.press('Enter');
    await onboardingPage.expectCurrentStep('housing');
  }

  /**
   * Monitors and validates API calls during onboarding
   */
  async monitorApiCalls(
    onboardingPage: OnboardingPage,
    expectedCalls: string[]
  ): Promise<string[]> {
    const apiCalls: string[] = [];
    
    await this.page.route('**/api/**', (route) => {
      apiCalls.push(route.request().url());
      void route.continue();
    });
    
    return apiCalls;
  }

  /**
   * Validates performance metrics during onboarding
   */
  async measurePerformance(onboardingPage: OnboardingPage): Promise<{
    navigationTime: number;
    loadTime: number;
    formSubmissionTime: number;
  }> {
    const startTime = Date.now();
    
    await onboardingPage.goto();
    const loadTime = Date.now() - startTime;
    
    const navStartTime = Date.now();
    await onboardingPage.clickStart();
    await onboardingPage.expectCurrentStep('personal-info');
    const navigationTime = Date.now() - navStartTime;
    
    const submitStartTime = Date.now();
    await onboardingPage.firstNameInput.fill('PerfTest');
    await onboardingPage.clickNext();
    await onboardingPage.expectCurrentStep('housing');
    const formSubmissionTime = Date.now() - submitStartTime;
    
    return {
      navigationTime,
      loadTime,
      formSubmissionTime
    };
  }

  /**
   * Cleanup helper for test teardown
   */
  async cleanup(onboardingPage: OnboardingPage): Promise<void> {
    await onboardingPage.clearLocalStorageData();
    await this.page.unrouteAll();
  }
}

/**
 * Factory function to create OnboardingTestHelpers instance
 */
export function createOnboardingHelpers(page: Page): OnboardingTestHelpers {
  return new OnboardingTestHelpers(page);
}

/**
 * Common test patterns for onboarding tests
 */
export const OnboardingTestPatterns = {
  /**
   * Complete happy path test pattern
   */
  async happyPath(page: Page): Promise<void> {
    const onboardingPage = new OnboardingPage(page);
    const helpers = createOnboardingHelpers(page);
    
    await helpers.setupSuccessfulRegistrationFlow(onboardingPage);
    await helpers.fillCompleteOnboardingFlow(onboardingPage);
    await onboardingPage.expectRedirectToCurrentMonth();
    await helpers.cleanup(onboardingPage);
  },

  /**
   * Form validation test pattern
   */
  async formValidation(page: Page): Promise<void> {
    const onboardingPage = new OnboardingPage(page);
    const helpers = createOnboardingHelpers(page);
    
    await onboardingPage.gotoStep('registration');
    
    // Test invalid inputs
    await onboardingPage.emailInput.fill('invalid');
    await onboardingPage.passwordInput.fill('123');
    await onboardingPage.expectNextButtonDisabled();
    
    // Test valid inputs
    await onboardingPage.emailInput.fill('valid@example.com');
    await onboardingPage.passwordInput.fill('ValidPass123');
    await onboardingPage.expectNextButtonEnabled();
    
    await helpers.cleanup(onboardingPage);
  },

  /**
   * State persistence test pattern
   */
  async statePersistence(page: Page): Promise<void> {
    const onboardingPage = new OnboardingPage(page);
    const helpers = createOnboardingHelpers(page);
    
    const testData = generateValidOnboardingData();
    await helpers.prepopulateOnboardingData(onboardingPage, testData);
    
    await onboardingPage.gotoStep('personal-info');
    await helpers.validateFormData(onboardingPage, testData);
    
    await helpers.cleanup(onboardingPage);
  },

  /**
   * Error recovery test pattern
   */
  async errorRecovery(page: Page): Promise<void> {
    const onboardingPage = new OnboardingPage(page);
    const helpers = createOnboardingHelpers(page);
    
    await helpers.prepopulateOnboardingData(onboardingPage);
    await helpers.setupRegistrationFailure(onboardingPage, 'authentication', 'Test error');
    
    await onboardingPage.gotoStep('registration');
    await onboardingPage.fillRegistrationStep(validOnboardingData.email, validOnboardingData.password);
    
    await helpers.waitForOnboardingState(onboardingPage, 'error');
    await helpers.cleanup(onboardingPage);
  }
};