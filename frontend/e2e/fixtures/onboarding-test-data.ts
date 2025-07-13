import { OnboardingData } from '../pages/onboarding.page';

export const validOnboardingData: OnboardingData = {
  firstName: 'Jean',
  email: 'jean.dupont@example.com',
  monthlyIncome: 3500,
  housingCosts: 800,
  healthInsurance: 45,
  phonePlan: 25,
  transportCosts: 150,
  leasingCredit: 300,
  password: 'SecurePass123!'
};

export const minimalValidData: OnboardingData = {
  firstName: 'Alice',
  email: 'alice@test.com',
  monthlyIncome: 2000,
  housingCosts: 0,
  healthInsurance: 0,
  phonePlan: 0,
  transportCosts: 0,
  leasingCredit: 0,
  password: 'Password123'
};

export const highIncomeData: OnboardingData = {
  firstName: 'Pierre',
  email: 'pierre.martin@enterprise.com',
  monthlyIncome: 8000,
  housingCosts: 2000,
  healthInsurance: 120,
  phonePlan: 80,
  transportCosts: 500,
  leasingCredit: 800,
  password: 'ComplexPass456!'
};

export const invalidEmails = [
  'invalid-email',
  '@example.com',
  'user@',
  'user space@example.com',
  'user..double@example.com'
];

export const invalidPasswords = [
  '123', // Too short
  'password', // No uppercase/numbers
  'PASSWORD', // No lowercase/numbers
  '12345678', // No letters
  'Pass123' // Too short
];

export const validPasswords = [
  'Password123',
  'SecurePass456!',
  'MyStrongPassword1',
  'Test@123456789'
];

export const edgeCaseData = {
  longFirstName: 'Jean-Baptiste-Emmanuel-Maximiliano-Francisco-José',
  specialCharEmail: 'test+special@sub-domain.example-site.org',
  zeroIncome: 0,
  highIncome: 999999,
  negativeValues: -100
};

export const formFieldTestData = {
  firstName: {
    valid: ['Jean', 'Marie-Claire', 'José', 'Anne-Sophie'],
    invalid: ['', '  ', '123Jean', 'Jean@']
  },
  email: {
    valid: [
      'user@example.com',
      'test.email@domain.org',
      'user+tag@example.co.uk'
    ],
    invalid: invalidEmails
  },
  password: {
    valid: validPasswords,
    invalid: invalidPasswords
  },
  numericValues: {
    valid: [0, 100, 1000, 5000, 999999],
    invalid: [-1, -100, 'abc', '12.34.56']
  }
};

export const registrationStepsTestData = {
  authenticationSuccess: {
    success: true,
    user: { id: 'user-123', email: 'test@example.com' }
  },
  authenticationFailure: {
    success: false,
    error: 'Email already exists'
  },
  templateCreationSuccess: {
    success: true,
    data: {
      template: {
        id: 'template-456',
        name: 'Mois Standard',
        description: 'Template personnel de Jean'
      }
    }
  },
  templateCreationFailure: {
    success: false,
    error: 'Failed to create template'
  },
  budgetCreationSuccess: {
    success: true,
    data: {
      budget: {
        id: 'budget-789',
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        templateId: 'template-456'
      }
    }
  },
  budgetCreationFailure: {
    success: false,
    error: 'Failed to create budget'
  }
};

export const localStorageTestData = {
  completeData: {
    onboardingData: validOnboardingData,
    processState: {
      currentStep: 'authentication',
      completedSteps: [],
      templateId: undefined
    }
  },
  partialData: {
    onboardingData: {
      firstName: 'John',
      email: 'john@test.com',
      monthlyIncome: 3000,
      housingCosts: null,
      healthInsurance: null,
      phonePlan: null,
      transportCosts: null,
      leasingCredit: null
    },
    processState: {
      currentStep: 'housing',
      completedSteps: ['authentication'],
      templateId: 'template-123'
    }
  },
  corruptedData: {
    invalidJson: '{"incomplete": json',
    emptyObject: {},
    nullData: null
  }
};

export const networkErrorScenarios = {
  timeout: 'timeout',
  serverError: 'server-error',
  networkFailure: 'network-failure',
  forbidden: 'forbidden',
  tooManyRequests: 'too-many-requests'
};

export const responsiveTestData = {
  viewports: [
    { name: 'Mobile', width: 375, height: 667 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Desktop', width: 1280, height: 720 },
    { name: 'Large Desktop', width: 1920, height: 1080 }
  ]
};

export const accessibilityTestData = {
  keyboardNavigation: {
    tabOrder: ['firstName', 'email', 'password', 'next-button'],
    enterKey: 'submit-form',
    escapeKey: 'cancel-form'
  },
  screenReader: {
    labels: ['Email', 'Mot de passe', 'Prénom'],
    errorMessages: ['Email invalide', 'Mot de passe trop court'],
    successMessages: ['Compte créé avec succès']
  }
};

export const performanceTestData = {
  animationDuration: 1000, // ms
  navigationTimeout: 5000, // ms
  apiTimeout: 10000, // ms
  formSubmissionDelay: 2000 // ms
};

// Helper functions for test data generation
export function generateRandomEmail(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `test-${timestamp}-${random}@example.com`;
}

export function generateRandomFirstName(): string {
  const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Emma', 'Frank', 'Grace', 'Henry'];
  return names[Math.floor(Math.random() * names.length)];
}

export function generateValidOnboardingData(): OnboardingData {
  return {
    firstName: generateRandomFirstName(),
    email: generateRandomEmail(),
    monthlyIncome: Math.floor(Math.random() * 5000) + 2000,
    housingCosts: Math.floor(Math.random() * 1000) + 500,
    healthInsurance: Math.floor(Math.random() * 100) + 30,
    phonePlan: Math.floor(Math.random() * 50) + 20,
    transportCosts: Math.floor(Math.random() * 200) + 50,
    leasingCredit: Math.floor(Math.random() * 500) + 200,
    password: 'GeneratedPass123!'
  };
}

export function createOnboardingDataVariant(
  baseData: OnboardingData,
  overrides: Partial<OnboardingData>
): OnboardingData {
  return { ...baseData, ...overrides };
}