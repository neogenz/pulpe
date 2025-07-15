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

export const INVALID_EMAILS = [
  'invalid-email',
  '@test.com',
  'test@',
  'test.com',
  'test@.com',
  'test.@test.com',
  '', // Email vide
] as const;

export const VALID_EMAILS = [
  'valid@example.com',
  'user.name@example.org',
  'test+tag@example.co.uk',
] as const;

export const TEST_PASSWORDS = {
  VALID: 'ValidPassword123!',
  WEAK: '123',
  EMPTY: '',
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
  FIXED_EXPENSE: {
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

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '**/auth/login',
    LOGOUT: '**/auth/logout',
    REGISTER: '**/auth/register',
  },
  API: {
    BUDGET: '**/api/budget',
    TRANSACTIONS: '**/api/transactions',
    USER: '**/api/user',
  },
} as const;
