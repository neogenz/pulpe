import type {
  BudgetLine,
  Transaction,
  Budget,
  BudgetTemplate,
  TemplateLine,
} from '@pulpe/shared';

// ============================================================================
// Default Mock Objects
// ============================================================================

const defaultBudgetLine: BudgetLine = {
  id: 'budget-line-1',
  budgetId: 'budget-1',
  templateLineId: null,
  savingsGoalId: null,
  name: 'Test Budget Line',
  amount: 1000,
  kind: 'expense',
  recurrence: 'fixed',
  isManuallyAdjusted: false,
  checkedAt: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const defaultTransaction: Transaction = {
  id: 'transaction-1',
  budgetId: 'budget-1',
  budgetLineId: null,
  name: 'Test Transaction',
  amount: 100,
  kind: 'expense',
  transactionDate: '2024-01-01',
  category: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const defaultBudget: Budget = {
  id: 'budget-1',
  month: 1,
  year: 2024,
  description: 'Test Budget',
  userId: 'user-1',
  templateId: 'template-1',
  endingBalance: 0,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const defaultBudgetTemplate: BudgetTemplate = {
  id: 'template-1',
  name: 'Test Template',
  description: 'A test template',
  userId: 'user-1',
  isDefault: false,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const defaultTemplateLine: TemplateLine = {
  id: 'template-line-1',
  templateId: 'template-1',
  name: 'Test Template Line',
  amount: 1000,
  kind: 'expense',
  recurrence: 'fixed',
  description: 'Test template line description',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

// ============================================================================
// Mock Factory Functions
// ============================================================================

/**
 * Creates a mock BudgetLine with type-safe overrides
 * @param overrides Partial BudgetLine properties to override defaults
 * @returns Complete BudgetLine object
 */
export function createMockBudgetLine(
  overrides?: Partial<BudgetLine>,
): BudgetLine {
  return { ...defaultBudgetLine, ...overrides };
}

/**
 * Creates a mock Transaction with type-safe overrides
 * @param overrides Partial Transaction properties to override defaults
 * @returns Complete Transaction object
 */
export function createMockTransaction(
  overrides?: Partial<Transaction>,
): Transaction {
  return { ...defaultTransaction, ...overrides };
}

/**
 * Creates a mock Budget with type-safe overrides
 * @param overrides Partial Budget properties to override defaults
 * @returns Complete Budget object
 */
export function createMockBudget(overrides?: Partial<Budget>): Budget {
  return { ...defaultBudget, ...overrides };
}

/**
 * Creates a mock BudgetTemplate with type-safe overrides
 * @param overrides Partial BudgetTemplate properties to override defaults
 * @returns Complete BudgetTemplate object
 */
export function createMockBudgetTemplate(
  overrides?: Partial<BudgetTemplate>,
): BudgetTemplate {
  return { ...defaultBudgetTemplate, ...overrides };
}

/**
 * Creates a mock TemplateLine with type-safe overrides
 * @param overrides Partial TemplateLine properties to override defaults
 * @returns Complete TemplateLine object
 */
export function createMockTemplateLine(
  overrides?: Partial<TemplateLine>,
): TemplateLine {
  return { ...defaultTemplateLine, ...overrides };
}

// ============================================================================
// Convenience Factory Functions
// ============================================================================

/**
 * Creates multiple mock BudgetLines with sequential IDs
 * @param count Number of budget lines to create
 * @param baseOverrides Base properties to apply to all lines
 * @returns Array of BudgetLine objects
 */
export function createMockBudgetLines(
  count: number,
  baseOverrides?: Partial<BudgetLine>,
): BudgetLine[] {
  return Array.from({ length: count }, (_, index) =>
    createMockBudgetLine({
      ...baseOverrides,
      id: `budget-line-${index + 1}`,
      name: `Budget Line ${index + 1}`,
    }),
  );
}

/**
 * Creates multiple mock Transactions with sequential IDs
 * @param count Number of transactions to create
 * @param baseOverrides Base properties to apply to all transactions
 * @returns Array of Transaction objects
 */
export function createMockTransactions(
  count: number,
  baseOverrides?: Partial<Transaction>,
): Transaction[] {
  return Array.from({ length: count }, (_, index) =>
    createMockTransaction({
      ...baseOverrides,
      id: `transaction-${index + 1}`,
      name: `Transaction ${index + 1}`,
    }),
  );
}

/**
 * Creates multiple mock TemplateLines with sequential IDs
 * @param count Number of template lines to create
 * @param baseOverrides Base properties to apply to all lines
 * @returns Array of TemplateLine objects
 */
export function createMockTemplateLines(
  count: number,
  baseOverrides?: Partial<TemplateLine>,
): TemplateLine[] {
  return Array.from({ length: count }, (_, index) =>
    createMockTemplateLine({
      ...baseOverrides,
      id: `template-line-${index + 1}`,
      name: `Template Line ${index + 1}`,
    }),
  );
}

// ============================================================================
// Specialized Factory Functions
// ============================================================================

/**
 * Creates a mock rollover BudgetLine with isRollover property
 * This creates a special rollover line that cannot be edited
 * @param overrides Additional properties to override
 * @returns BudgetLine configured as a rollover line with isRollover flag
 */
export function createMockRolloverBudgetLine(
  overrides?: Partial<BudgetLine & { isRollover: boolean }>,
): BudgetLine & { isRollover: true } {
  const line = createMockBudgetLine({
    name: 'rollover_12_2024',
    kind: 'income',
    recurrence: 'one_off',
    ...overrides,
  });

  return {
    ...line,
    isRollover: true as const,
  };
}

/**
 * Creates a mock out-of-budget Transaction
 * @param overrides Additional properties to override
 * @returns Transaction configured as out-of-budget
 */
export function createMockOutOfBudgetTransaction(
  overrides?: Partial<Transaction>,
): Transaction {
  return createMockTransaction({
    name: 'Emergency Expense',
    ...overrides,
  });
}

/**
 * Creates a complete mock BudgetDetails response structure
 * @param overrides Properties to override in the response
 * @returns Complete BudgetDetailsResponse structure
 */
export function createMockBudgetDetailsResponse(overrides?: {
  budget?: Partial<Budget>;
  budgetLines?: BudgetLine[];
  transactions?: Transaction[];
}) {
  const budget = createMockBudget(overrides?.budget);
  const budgetLines = overrides?.budgetLines || [
    createMockBudgetLine({
      id: 'line-1',
      budgetId: budget.id,
      name: 'Salary',
      amount: 5000,
      kind: 'income',
    }),
    createMockBudgetLine({
      id: 'line-2',
      budgetId: budget.id,
      name: 'Rent',
      amount: 1500,
      kind: 'expense',
    }),
  ];
  const transactions = overrides?.transactions || [
    createMockTransaction({
      id: 'tx-1',
      budgetId: budget.id,
      name: 'Groceries',
      amount: 50,
      kind: 'expense',
      transactionDate: '2024-01-05',
    }),
  ];

  return {
    success: true as const,
    data: {
      budget,
      budgetLines,
      transactions,
    },
  };
}
