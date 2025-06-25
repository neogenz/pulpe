export const TEST_USERS = {
  VALID_USER: {
    email: 'test@example.com',
    password: 'Test123!@#',
    firstName: 'Test',
    lastName: 'User',
  },
  INVALID_USER: {
    email: 'invalid@example.com',
    password: 'wrongpassword',
  },
} as const;

export const TEST_BUDGET_DATA = {
  MONTHLY_INCOME: 5000,
  HOUSING: {
    rent: 1200,
    utilities: 200,
  },
  TRANSPORT: {
    publicTransport: 80,
    carInsurance: 120,
  },
  HEALTH_INSURANCE: 350,
  PHONE_PLAN: 49,
} as const;

export const TEST_TRANSACTIONS = {
  EXPENSE: {
    amount: 45.5,
    description: 'Supermarché Migros',
    category: 'Alimentation',
    date: new Date().toISOString().split('T')[0],
  },
  INCOME: {
    amount: 5000,
    description: 'Salaire mensuel',
    category: 'Revenus',
    date: new Date().toISOString().split('T')[0],
  },
} as const;
