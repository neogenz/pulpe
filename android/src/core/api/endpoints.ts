/**
 * Paths relative to `EXPO_PUBLIC_API_BASE_URL`, which already carries the
 * `/api/v1` prefix — same contract as `Endpoints.swift`, where each case is
 * appended to `AppConfiguration.apiBaseURL`.
 *
 * Only the HTTP method varies per call site, so it stays at the call site: the
 * Swift enum has to carry it because the endpoint value is what gets executed.
 */
export const ENDPOINTS = {
  validateSession: "/auth/validate",

  userProfile: "/users/me",
  userProfileUpdate: "/users/profile",
  userAccount: "/users/account",
  userSettings: "/users/settings",

  tags: "/tags",
  tag: (id: string) => `/tags/${id}`,

  budgets: "/budgets",
  budgetsGenerate: "/budgets/generate",
  budget: (id: string) => `/budgets/${id}`,
  budgetDetails: (id: string) => `/budgets/${id}/details`,
  budgetsExport: "/budgets/export",

  budgetLines: "/budget-lines",
  budgetLine: (id: string) => `/budget-lines/${id}`,
  budgetLineToggle: (id: string) => `/budget-lines/${id}/toggle-check`,
  budgetLinePostpone: (id: string) => `/budget-lines/${id}/postpone`,
  budgetLineResetFromTemplate: (id: string) =>
    `/budget-lines/${id}/reset-from-template`,
  budgetLinesSpread: "/budget-lines/spread",
  budgetLinesSpreadOccurrences: (spreadGroupId: string) =>
    `/budget-lines/spread/${spreadGroupId}`,
  budgetLineSpreadFromLine: (id: string) => `/budget-lines/${id}/spread`,
  budgetLinesSavingsWithdrawal: "/budget-lines/savings-withdrawal",
  budgetLinesSavingsWithdrawalGroup: (groupId: string) =>
    `/budget-lines/savings-withdrawal/${groupId}`,

  transactions: "/transactions",
  transaction: (id: string) => `/transactions/${id}`,
  transactionsByBudget: (budgetId: string) =>
    `/transactions/budget/${budgetId}`,
  transactionToggle: (id: string) => `/transactions/${id}/toggle-check`,
  transactionPostpone: (id: string) => `/transactions/${id}/postpone`,
  transactionSpreadFromTransaction: (id: string) =>
    `/transactions/${id}/spread`,

  templates: "/budget-templates",
  template: (id: string) => `/budget-templates/${id}`,
  templateUsage: (id: string) => `/budget-templates/${id}/usage`,
  templateFromOnboarding: "/budget-templates/from-onboarding",
  templateLines: (templateId: string) =>
    `/budget-templates/${templateId}/lines`,
  templateLine: (templateId: string, lineId: string) =>
    `/budget-templates/${templateId}/lines/${lineId}`,
  templateLinesBulk: (templateId: string) =>
    `/budget-templates/${templateId}/lines/bulk-operations`,

  savingsGoals: "/savings-goals",
  savingsGoal: (id: string) => `/savings-goals/${id}`,
  savingsGoalProgress: (id: string) => `/savings-goals/${id}/progress`,
  savingsGoalContributions: (id: string) =>
    `/savings-goals/${id}/contributions`,
  savingsGoalPlan: (id: string) => `/savings-goals/${id}/plan`,
  savingsGoalFutureLines: (id: string) => `/savings-goals/${id}/future-lines`,
  savingsGoalGenerationStop: (id: string) =>
    `/savings-goals/${id}/generation-stop`,
  savingsGoalDeletionImpact: (id: string) =>
    `/savings-goals/${id}/deletion-impact`,
  savingsGoalDeletion: (id: string) => `/savings-goals/${id}/deletion`,
  savingsGoalWithdrawalOptions: "/savings-goals/withdrawal-options",
  savingsGoalWithdrawals: (id: string) => `/savings-goals/${id}/withdrawals`,

  currencyRate: "/currency/rate",

  appVersion: "/app/version",
  whatsNewAndroid: "/whats-new/android",

  encryptionVaultStatus: "/encryption/vault-status",
  encryptionSalt: "/encryption/salt",
  encryptionValidateKey: "/encryption/validate-key",
  encryptionSetupRecovery: "/encryption/setup-recovery",
  encryptionRegenerateRecovery: "/encryption/regenerate-recovery",
  encryptionRecover: "/encryption/recover",
  encryptionVerifyRecoveryKey: "/encryption/verify-recovery-key",
  encryptionChangePin: "/encryption/change-pin",
} as const;
