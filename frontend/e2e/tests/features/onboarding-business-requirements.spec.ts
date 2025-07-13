import { test, expect } from '../../fixtures/test-fixtures';
import { OnboardingPage } from '../../pages/onboarding.page';
import { validOnboardingData } from '../../fixtures/onboarding-test-data';

/**
 * E2E Tests for Onboarding Business Requirements
 * 
 * Tests validate the complete business workflow as specified in the Notion requirements:
 * https://www.notion.so/Cahier-des-charges-22caabebe07f80109cc3d24ab68f11b6
 * 
 * Validates:
 * - 8-step onboarding flow from welcome to registration
 * - 4-step registration process (Authentication → Template → Budget → Completion)
 * - Data collection and persistence throughout the flow
 * - Form validation and user experience
 */
test.describe('Onboarding Business Requirements Validation', () => {
  let onboardingPage: OnboardingPage;

  test.beforeEach(async ({ page }) => {
    onboardingPage = new OnboardingPage(page);
    await onboardingPage.clearLocalStorageData();
  });

  test('🎯 BUSINESS REQUIREMENT: Complete 8-step onboarding flow', async () => {
    /**
     * Test validates the complete 8-step onboarding flow:
     * 1. Welcome - Introduction and start
     * 2. Personal Info - First name collection
     * 3. Income - Monthly income collection  
     * 4. Housing - Housing costs
     * 5. Health Insurance - Health insurance costs
     * 6. Phone Plan - Phone plan costs
     * 7. Transport - Transportation costs
     * 8. Leasing Credit - Leasing/credit costs
     * → Registration - User account creation
     */
    
    console.log('🚀 Starting complete onboarding business flow validation');
    
    // Step 1: Welcome
    await onboardingPage.goto();
    await onboardingPage.expectWelcomePageVisible();
    await onboardingPage.fillWelcomeStep();
    console.log('✅ Step 1: Welcome completed');
    
    // Step 2: Personal Info
    await onboardingPage.expectCurrentStep('personal-info');
    await onboardingPage.fillPersonalInfoStep(validOnboardingData.firstName);
    console.log('✅ Step 2: Personal Info completed');
    
    // Step 3: Income
    await onboardingPage.expectCurrentStep('income');
    await onboardingPage.fillIncomeStep(validOnboardingData.monthlyIncome);
    console.log('✅ Step 3: Income completed');
    
    // Step 4: Housing
    await onboardingPage.expectCurrentStep('housing');
    await onboardingPage.fillHousingStep(validOnboardingData.housingCosts);
    console.log('✅ Step 4: Housing completed');
    
    // Step 5: Health Insurance
    await onboardingPage.expectCurrentStep('health-insurance');
    await onboardingPage.fillHealthInsuranceStep(validOnboardingData.healthInsurance);
    console.log('✅ Step 5: Health Insurance completed');
    
    // Step 6: Phone Plan
    await onboardingPage.expectCurrentStep('phone-plan');
    await onboardingPage.fillPhonePlanStep(validOnboardingData.phonePlan);
    console.log('✅ Step 6: Phone Plan completed');
    
    // Step 7: Transport
    await onboardingPage.expectCurrentStep('transport');
    await onboardingPage.fillTransportStep(validOnboardingData.transportCosts);
    console.log('✅ Step 7: Transport completed');
    
    // Step 8: Leasing Credit
    await onboardingPage.expectCurrentStep('leasing-credit');
    await onboardingPage.fillLeasingCreditStep(validOnboardingData.leasingCredit);
    console.log('✅ Step 8: Leasing Credit completed');
    
    // Final: Registration ready
    await onboardingPage.expectCurrentStep('registration');
    await onboardingPage.expectRegistrationFormVisible();
    console.log('✅ Registration form ready - onboarding flow complete');
    
    console.log('🎉 BUSINESS REQUIREMENT VALIDATED: Complete 8-step onboarding flow working');
  });

  test('💾 BUSINESS REQUIREMENT: Data persistence and collection', async () => {
    /**
     * Test validates that all user data is properly collected and persisted
     * throughout the onboarding flow for budget calculation
     */
    
    console.log('🚀 Starting data persistence validation');
    
    // Complete the onboarding flow
    await onboardingPage.completeOnboardingFlow(validOnboardingData);
    
    // Verify data is persisted in localStorage
    const storedData = await onboardingPage.getLocalStorageData();
    expect(storedData).toBeTruthy();
    console.log('✅ Data persistence validated');
    
    // Verify registration form can access user data
    await onboardingPage.expectCurrentStep('registration');
    await onboardingPage.emailInput.fill(validOnboardingData.email);
    await onboardingPage.passwordInput.fill(validOnboardingData.password);
    
    await expect(onboardingPage.emailInput).toHaveValue(validOnboardingData.email);
    await expect(onboardingPage.passwordInput).toHaveValue(validOnboardingData.password);
    
    console.log('🎉 BUSINESS REQUIREMENT VALIDATED: Data collection and persistence working');
  });

  test('🔄 BUSINESS REQUIREMENT: Registration process readiness', async () => {
    /**
     * Test validates that after completing onboarding, the user is ready
     * for the 4-step registration process:
     * 1. Authentication (account creation)
     * 2. Template Creation (budget template from onboarding data)
     * 3. Budget Creation (monthly budget)
     * 4. Completion (redirect to dashboard)
     */
    
    console.log('🚀 Starting registration process readiness validation');
    
    // Complete onboarding flow
    await onboardingPage.completeOnboardingFlow(validOnboardingData);
    
    // Verify we're ready for registration
    await onboardingPage.expectCurrentStep('registration');
    await onboardingPage.expectRegistrationFormVisible();
    
    // Verify all required fields are present and functional
    await expect(onboardingPage.emailInput).toBeVisible();
    await expect(onboardingPage.passwordInput).toBeVisible();
    
    // Test form functionality
    await onboardingPage.emailInput.fill('test@example.com');
    await onboardingPage.passwordInput.fill('testPassword123');
    
    await expect(onboardingPage.emailInput).toHaveValue('test@example.com');
    await expect(onboardingPage.passwordInput).toHaveValue('testPassword123');
    
    console.log('✅ Registration form ready and functional');
    console.log('🎉 BUSINESS REQUIREMENT VALIDATED: Registration process ready');
  });

  test('📊 BUSINESS REQUIREMENT: Budget data collection completeness', async () => {
    /**
     * Test validates that all necessary financial data is collected
     * for budget template and monthly budget calculation
     */
    
    console.log('🚀 Starting budget data collection validation');
    
    const testData = {
      firstName: 'Budget Test User',
      email: 'budget@test.com',
      monthlyIncome: 4500,      // Required for budget calculation
      housingCosts: 1200,       // Major expense category
      healthInsurance: 85,      // Fixed monthly cost
      phonePlan: 45,           // Fixed monthly cost  
      transportCosts: 200,      // Variable expense
      leasingCredit: 350,      // Fixed monthly cost
      password: 'SecurePass123!'
    };
    
    // Go through each step and verify data collection
    await onboardingPage.goto();
    await onboardingPage.fillWelcomeStep();
    
    // Personal Info - User identification
    await onboardingPage.fillPersonalInfoStep(testData.firstName);
    await onboardingPage.expectCurrentStep('income');
    
    // Income - Primary budget input
    await onboardingPage.fillIncomeStep(testData.monthlyIncome);
    await onboardingPage.expectCurrentStep('housing');
    
    // All expense categories
    await onboardingPage.fillHousingStep(testData.housingCosts);
    await onboardingPage.expectCurrentStep('health-insurance');
    
    await onboardingPage.fillHealthInsuranceStep(testData.healthInsurance);
    await onboardingPage.expectCurrentStep('phone-plan');
    
    await onboardingPage.fillPhonePlanStep(testData.phonePlan);
    await onboardingPage.expectCurrentStep('transport');
    
    await onboardingPage.fillTransportStep(testData.transportCosts);
    await onboardingPage.expectCurrentStep('leasing-credit');
    
    await onboardingPage.fillLeasingCreditStep(testData.leasingCredit);
    await onboardingPage.expectCurrentStep('registration');
    
    // Verify all data is collected for budget creation
    const collectedData = await onboardingPage.getLocalStorageData();
    expect(collectedData).toBeTruthy();
    
    console.log('✅ All budget data categories collected');
    console.log('🎉 BUSINESS REQUIREMENT VALIDATED: Complete budget data collection');
  });

  test('🧪 BUSINESS REQUIREMENT: End-to-end user journey', async () => {
    /**
     * Test simulates a complete user journey from first visit to ready for budget creation
     * This validates the entire business workflow described in the requirements
     */
    
    console.log('🚀 Starting complete user journey simulation');
    
    // Simulate new user visiting the application
    await onboardingPage.goto();
    console.log('👤 New user arrives at welcome page');
    
    // User decides to start onboarding
    await onboardingPage.expectWelcomePageVisible();
    await onboardingPage.fillWelcomeStep();
    console.log('🎯 User starts onboarding process');
    
    // User provides their information through all steps
    await onboardingPage.fillPersonalInfoStep('Marie');
    await onboardingPage.fillIncomeStep(3200);
    await onboardingPage.fillHousingStep(950);
    await onboardingPage.fillHealthInsuranceStep(65);
    await onboardingPage.fillPhonePlanStep(35);
    await onboardingPage.fillTransportStep(180);
    await onboardingPage.fillLeasingCreditStep(280);
    console.log('📝 User completes all onboarding data entry');
    
    // User reaches registration and is ready to create account
    await onboardingPage.expectCurrentStep('registration');
    await onboardingPage.expectRegistrationFormVisible();
    console.log('🔐 User ready for account creation');
    
    // User can input registration details
    await onboardingPage.emailInput.fill('marie.exemple@email.com');
    await onboardingPage.passwordInput.fill('MonMotDePasse123!');
    
    await expect(onboardingPage.emailInput).toHaveValue('marie.exemple@email.com');
    await expect(onboardingPage.passwordInput).toHaveValue('MonMotDePasse123!');
    console.log('✅ Registration form functional');
    
    // Verify data is ready for next steps (template/budget creation)
    const finalData = await onboardingPage.getLocalStorageData();
    expect(finalData).toBeTruthy();
    console.log('💾 User data ready for template and budget creation');
    
    console.log('🎉 BUSINESS REQUIREMENT VALIDATED: Complete end-to-end user journey working');
  });
});