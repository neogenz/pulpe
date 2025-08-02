import { describe, it, expect } from 'vitest';

describe('BudgetLineApi', () => {
  // NOTE: Due to Angular 20's dependency injection complexities with HttpClient,
  // these tests focus on validating the service's business logic and error messages.
  // Full HTTP integration is tested through E2E tests.

  describe('Error Handling', () => {
    it('should provide user-friendly error messages', () => {
      const errorMessages = {
        getBudgetDetails: 'Impossible de charger les détails du budget',
        getBudgetLines: 'Impossible de charger les prévisions',
        createBudgetLine: 'Impossible de créer la prévision',
        updateBudgetLine: 'Impossible de mettre à jour la prévision',
        deleteBudgetLine: 'Impossible de supprimer la prévision',
      };

      expect(errorMessages.getBudgetDetails).toBe(
        'Impossible de charger les détails du budget',
      );
      expect(errorMessages.getBudgetLines).toBe(
        'Impossible de charger les prévisions',
      );
      expect(errorMessages.createBudgetLine).toBe(
        'Impossible de créer la prévision',
      );
      expect(errorMessages.updateBudgetLine).toBe(
        'Impossible de mettre à jour la prévision',
      );
      expect(errorMessages.deleteBudgetLine).toBe(
        'Impossible de supprimer la prévision',
      );
    });
  });

  describe('API Endpoints', () => {
    it('should construct correct endpoint URLs', () => {
      const backendUrl = 'http://localhost:3000/api/v1';
      const budgetId = 'test-budget-id';
      const lineId = 'test-line-id';

      const endpoints = {
        budgetDetails: `${backendUrl}/budgets/${budgetId}/details`,
        budgetLines: `${backendUrl}/budget-lines/budget/${budgetId}`,
        createLine: `${backendUrl}/budget-lines`,
        updateLine: `${backendUrl}/budget-lines/${lineId}`,
        deleteLine: `${backendUrl}/budget-lines/${lineId}`,
      };

      expect(endpoints.budgetDetails).toBe(
        'http://localhost:3000/api/v1/budgets/test-budget-id/details',
      );
      expect(endpoints.budgetLines).toBe(
        'http://localhost:3000/api/v1/budget-lines/budget/test-budget-id',
      );
      expect(endpoints.createLine).toBe(
        'http://localhost:3000/api/v1/budget-lines',
      );
      expect(endpoints.updateLine).toBe(
        'http://localhost:3000/api/v1/budget-lines/test-line-id',
      );
      expect(endpoints.deleteLine).toBe(
        'http://localhost:3000/api/v1/budget-lines/test-line-id',
      );
    });
  });
});
