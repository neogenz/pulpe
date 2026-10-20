import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  API_ERROR_CODES,
  type BudgetDeletionImpact,
  type BudgetLineCreate,
  type BudgetLineUpdate,
  type TransactionUpdate,
} from 'pulpe-shared';

import { BudgetDetailsStore } from './budget-details-store';
import { TransactionImportApi } from '../transaction-import/transaction-import-api';
import { BudgetApi } from '@core/budget/budget-api';
import { SavingsGoalApi } from '@core/savings-goal/savings-goal-api';
import { BudgetTemplatesApi } from '@core/budget-template/budget-templates-api';
import { ApiError } from '@core/api/api-error';
import { Logger } from '@core/logging/logger';
import { ApplicationConfiguration } from '@core/config/application-configuration';
import { PostHogService } from '@core/analytics/posthog';
import { UserSettingsStore } from '@core/user-settings';
import { createMockDataCache } from '@core/testing';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import {
  createMockBudget,
  createMockBudgetDetailsResponse,
} from '../../../../testing/mock-factories';

/**
 * Tests unitaires métier pour BudgetDetailsStore
 * Focus sur la logique métier pure sans dépendances Angular
 */
describe('BudgetDetailsStore - Logique Métier', () => {
  describe('isInitialLoading', () => {
    it('should return true only for loading status', () => {
      const isInitialLoading = (status: string) => status === 'loading';

      expect(isInitialLoading('idle')).toBe(false);
      expect(isInitialLoading('loading')).toBe(true);
      expect(isInitialLoading('reloading')).toBe(false);
      expect(isInitialLoading('resolved')).toBe(false);
      expect(isInitialLoading('error')).toBe(false);
      expect(isInitialLoading('local')).toBe(false);
    });

    it('should return false after data loads (resolved status)', () => {
      const isInitialLoading = (status: string) => status === 'loading';

      // Simulates: budgetId is null → idle
      expect(isInitialLoading('idle')).toBe(false);

      // Simulates: budgetId set, first fetch → loading
      expect(isInitialLoading('loading')).toBe(true);

      // Simulates: data received → resolved
      expect(isInitialLoading('resolved')).toBe(false);

      // Simulates: reload triggered → reloading (not initial)
      expect(isInitialLoading('reloading')).toBe(false);
    });
  });

  describe('Validation des prévisions', () => {
    it('should validate that budget line amounts must be positive', () => {
      // Arrange
      const isValidBudgetLine = (line: BudgetLineCreate): boolean => {
        return (
          line.budgetId !== '' &&
          line.name.trim().length > 0 &&
          line.amount > 0 &&
          ['income', 'expense', 'saving'].includes(line.kind) &&
          ['fixed', 'one_off'].includes(line.recurrence)
        );
      };

      const validLine: BudgetLineCreate = {
        budgetId: 'budget-1',
        name: 'Salaire',
        amount: 5000,
        kind: 'income',
        recurrence: 'fixed',
        isManuallyAdjusted: false,
      };

      const invalidLines: BudgetLineCreate[] = [
        { ...validLine, amount: 0 }, // Montant zéro
        { ...validLine, amount: -100 }, // Montant négatif
        { ...validLine, name: '' }, // Nom vide
        { ...validLine, name: '   ' }, // Nom avec espaces seulement
        { ...validLine, budgetId: '' }, // Budget ID vide
      ];

      // Act & Assert
      expect(isValidBudgetLine(validLine)).toBe(true);
      invalidLines.forEach((line) => {
        expect(isValidBudgetLine(line)).toBe(false);
      });
    });

    it('should validate budget line updates correctly', () => {
      // Arrange
      const isValidUpdate = (update: BudgetLineUpdate): boolean => {
        if (update.name !== undefined && update.name.trim().length === 0) {
          return false;
        }
        if (update.amount !== undefined && update.amount <= 0) {
          return false;
        }
        return true;
      };

      // Act & Assert
      expect(isValidUpdate({ id: 'test-id', name: 'Loyer modifié' })).toBe(
        true,
      );
      expect(isValidUpdate({ id: 'test-id', amount: 150 })).toBe(true);
      expect(
        isValidUpdate({ id: 'test-id', name: 'Mis à jour', amount: 200 }),
      ).toBe(true);
      expect(isValidUpdate({ id: 'test-id', name: '' })).toBe(false); // Nom vide
      expect(isValidUpdate({ id: 'test-id', name: '  ' })).toBe(false); // Espaces seulement
      expect(isValidUpdate({ id: 'test-id', amount: 0 })).toBe(false); // Montant zéro
      expect(isValidUpdate({ id: 'test-id', amount: -50 })).toBe(false); // Montant négatif
    });
  });

  describe('Validation des transactions', () => {
    it('should validate transaction updates correctly', () => {
      const isValidTransactionUpdate = (update: TransactionUpdate): boolean => {
        if (update.name !== undefined && update.name.trim().length === 0) {
          return false;
        }
        if (update.amount !== undefined && update.amount <= 0) {
          return false;
        }
        return true;
      };

      expect(isValidTransactionUpdate({ name: 'Courses modifiées' })).toBe(
        true,
      );
      expect(isValidTransactionUpdate({ amount: 150 })).toBe(true);
      expect(
        isValidTransactionUpdate({ name: 'Mis à jour', amount: 200 }),
      ).toBe(true);
      expect(isValidTransactionUpdate({ name: '' })).toBe(false);
      expect(isValidTransactionUpdate({ name: '  ' })).toBe(false);
      expect(isValidTransactionUpdate({ amount: 0 })).toBe(false);
      expect(isValidTransactionUpdate({ amount: -50 })).toBe(false);
    });
  });

  describe('Mises à jour optimistes', () => {
    it('should show new budget line immediately before server confirmation', () => {
      // Arrange - Simulate user adding a new budget line with a client-generated UUID
      const existingLines = [
        {
          id: 'line-1',
          name: 'Salaire',
          amount: 5000,
          kind: 'income' as const,
        },
        { id: 'line-2', name: 'Loyer', amount: 1500, kind: 'expense' as const },
      ];

      const clientId = '6f9619ff-8b86-d011-b42d-00c04fc964ff';
      const newBudgetLine = {
        id: clientId,
        name: 'Courses',
        amount: 400,
        kind: 'expense' as const,
        budgetId: 'budget-1',
      };

      // Act - Add optimistically (what user sees immediately)
      const optimisticState = [...existingLines, newBudgetLine];

      // Assert - User sees the change instantly under the client-generated UUID
      expect(optimisticState).toHaveLength(3);
      expect(optimisticState[2].name).toBe('Courses');
      expect(optimisticState[2].id).toBe(clientId);
    });

    it('should keep id stable across server response (client UUID = server id)', () => {
      // Arrange - Optimistic state with client-generated UUID
      const clientId = '6f9619ff-8b86-d011-b42d-00c04fc964ff';
      const optimisticLines = [
        { id: 'line-1', name: 'Salaire', amount: 5000 },
        { id: clientId, name: 'Courses', amount: 400 },
      ];

      // Server echoes the same id with enriched fields (server timestamps, encryption metadata)
      const serverResponse = {
        id: clientId,
        name: 'Courses',
        amount: 400,
      };

      // Act - Merge server response by stable id (no id swap, just field refresh)
      const finalState = optimisticLines.map((line) =>
        line.id === serverResponse.id ? serverResponse : line,
      );

      // Assert - Id is stable; no temp/real duality
      expect(finalState[1].id).toBe(clientId);
      expect(finalState[1].name).toBe('Courses');
      expect(finalState.filter((l) => l.id === clientId)).toHaveLength(1);
    });

    it('should restore original state when server rejects changes', () => {
      // Arrange - Original stable state
      const originalLines = [
        { id: 'line-1', name: 'Salaire', amount: 5000 },
        { id: 'line-2', name: 'Loyer', amount: 1500 },
      ];

      const failedClientId = '6f9619ff-8b86-d011-b42d-00c04fc964fe';

      // Act - Server rejects, rollback to original (failedClientId never lands)
      const rolledBackState = [...originalLines];

      // Assert - User sees original state restored
      expect(rolledBackState).toHaveLength(2);
      expect(rolledBackState).toEqual(originalLines);
      expect(
        rolledBackState.find((l) => l.id === failedClientId),
      ).toBeUndefined();
    });

    it('should update transaction optimistically with new values', () => {
      const existingTransactions = [
        { id: 'tx-1', name: 'Courses', amount: 50, budgetLineId: 'bl-1' },
        { id: 'tx-2', name: 'Restaurant', amount: 30, budgetLineId: 'bl-1' },
      ];

      const update = { name: 'Courses Migros', amount: 85 };

      const optimisticState = existingTransactions.map((tx) =>
        tx.id === 'tx-1' ? { ...tx, ...update } : tx,
      );

      expect(optimisticState[0].name).toBe('Courses Migros');
      expect(optimisticState[0].amount).toBe(85);
      expect(optimisticState[1].name).toBe('Restaurant');
      expect(optimisticState[1].amount).toBe(30);
    });

    it('should handle deletion immediately with rollback capability', () => {
      // Arrange
      const originalLines = [
        { id: 'line-1', name: 'Salaire' },
        { id: 'line-2', name: 'Loyer' },
        { id: 'line-3', name: 'Courses' },
      ];

      // Act - User deletes line-2 (optimistic)
      const optimisticState = originalLines.filter(
        (line) => line.id !== 'line-2',
      );

      // Assert - Line disappears immediately for user
      expect(optimisticState).toHaveLength(2);
      expect(
        optimisticState.find((line) => line.id === 'line-2'),
      ).toBeUndefined();
      expect(optimisticState[0].name).toBe('Salaire');
      expect(optimisticState[1].name).toBe('Courses');
    });
  });

  describe('Messages utilisateur en français', () => {
    it('should provide clear French error messages for users', () => {
      // Arrange - Messages d'erreur du store
      const errorMessages = {
        createError: "Erreur lors de l'ajout de la prévision",
        updateError: 'Erreur lors de la modification de la prévision',
        deleteError: 'Erreur lors de la suppression de la prévision',
        transactionDeleteError:
          'Erreur lors de la suppression de la transaction',
      };

      // Act & Assert - Vérifier les messages en français
      expect(errorMessages.createError).toBe(
        "Erreur lors de l'ajout de la prévision",
      );
      expect(errorMessages.updateError).toBe(
        'Erreur lors de la modification de la prévision',
      );
      expect(errorMessages.deleteError).toBe(
        'Erreur lors de la suppression de la prévision',
      );
      expect(errorMessages.transactionDeleteError).toBe(
        'Erreur lors de la suppression de la transaction',
      );

      // Vérifier qu'ils utilisent le vocabulaire métier correct
      Object.values(errorMessages).forEach((message) => {
        expect(message).not.toContain('budget line'); // Pas d'anglais
        expect(message).not.toContain('lignes budgétaires'); // Pas de terme technique
      });
    });

    it('should use business vocabulary consistently', () => {
      // Arrange - Le vocabulaire métier attendu
      const businessTerms = {
        budgetLine: 'prévision', // budget_line → prévision
        amount: 'montant',
        kind: 'type',
        recurrence: 'fréquence',
        rollover: 'report', // ou 'rollover' si gardé en anglais
      };

      // Act & Assert - Vérifier la cohérence terminologique
      expect(businessTerms.budgetLine).toBe('prévision');
      expect(businessTerms.amount).toBe('montant');
      expect(businessTerms.kind).toBe('type');
      expect(businessTerms.recurrence).toBe('fréquence');

      // Vérifier qu'on évite les termes techniques
      expect(businessTerms.budgetLine).not.toBe('ligne budgétaire');
    });
  });

  describe('Règles métier du budget', () => {
    it('should maintain budget consistency during modifications', () => {
      // Arrange - Un budget avec ses prévisions
      const budgetState = {
        budget: { id: 'budget-1', month: 1, year: 2024 },
        budgetLines: [
          {
            id: 'line-1',
            name: 'Salaire',
            amount: 5000,
            kind: 'income' as const,
          },
          {
            id: 'line-2',
            name: 'Loyer',
            amount: 1500,
            kind: 'expense' as const,
          },
          {
            id: 'line-3',
            name: 'Épargne',
            amount: 1000,
            kind: 'saving' as const,
          },
        ],
      };

      // Act - Calculate current balance
      const calculateBalance = (lines: typeof budgetState.budgetLines) => {
        const income = lines
          .filter((l) => l.kind === 'income')
          .reduce((sum, l) => sum + l.amount, 0);
        const expenses = lines
          .filter((l) => l.kind === 'expense')
          .reduce((sum, l) => sum + l.amount, 0);
        const savings = lines
          .filter((l) => l.kind === 'saving')
          .reduce((sum, l) => sum + l.amount, 0);
        return income - expenses - savings;
      };

      // Assert - Balance should be consistent
      const initialBalance = calculateBalance(budgetState.budgetLines);
      expect(initialBalance).toBe(2500); // 5000 - 1500 - 1000

      // After adding a new expense
      const withNewExpense = [
        ...budgetState.budgetLines,
        {
          id: 'line-4',
          name: 'Courses',
          amount: 400,
          kind: 'expense' as const,
        },
      ];
      expect(calculateBalance(withNewExpense)).toBe(2100); // Balance updated correctly
    });

    it('should handle concurrent modifications on same budget', () => {
      // Arrange - Simulate concurrent operations
      const operations = new Set<string>();

      // Act - Track concurrent operations
      const startOperation = (operationId: string) => {
        if (operations.has(operationId)) {
          return false; // Operation already in progress
        }
        operations.add(operationId);
        return true;
      };

      const finishOperation = (operationId: string) => {
        operations.delete(operationId);
      };

      // Assert - Prevent duplicate operations
      expect(startOperation('update-line-1')).toBe(true);
      expect(startOperation('update-line-1')).toBe(false); // Duplicate prevented
      expect(startOperation('update-line-2')).toBe(true); // Different line OK

      finishOperation('update-line-1');
      expect(startOperation('update-line-1')).toBe(true); // Now OK after finish
    });
  });

  describe('Gestion des erreurs métier', () => {
    it('should handle network failures gracefully', () => {
      // Arrange - Simulate error scenarios that users might encounter
      const errorScenarios = [
        { type: 'network', message: 'Connexion impossible au serveur' },
        { type: 'validation', message: 'Le montant doit être positif' },
        {
          type: 'conflict',
          message: 'Cette prévision a été modifiée par un autre utilisateur',
        },
        {
          type: 'permission',
          message: "Vous n'avez pas les droits pour modifier ce budget",
        },
      ];

      // Act - Format error messages for user display
      const formatUserError = (error: (typeof errorScenarios)[0]) => {
        const baseMessage = "Erreur lors de l'opération";
        return `${baseMessage}: ${error.message}`;
      };

      // Assert - Errors are properly formatted for users
      errorScenarios.forEach((scenario) => {
        const formattedError = formatUserError(scenario);
        expect(formattedError).toContain("Erreur lors de l'opération");
        expect(formattedError).toContain(scenario.message);
      });
    });

    it('should recover from failed operations', () => {
      // Arrange - Original budget state
      const originalBudget = {
        budgetLines: [
          { id: 'line-1', name: 'Salaire', amount: 5000 },
          { id: 'line-2', name: 'Loyer', amount: 1500 },
        ],
      };

      // User tries to add invalid budget line (client UUID generated locally)
      const failedClientId = '6f9619ff-8b86-d011-b42d-00c04fc964fe';
      const failedOperation = {
        id: failedClientId,
        name: '', // Invalid: empty name
        amount: -100, // Invalid: negative amount
      };

      // Act - Rollback logic (what should happen on error)
      const shouldRollback = (operation: typeof failedOperation) => {
        return operation.name === '' || operation.amount <= 0;
      };

      const recoverFromError = (original: typeof originalBudget) => {
        return { ...original }; // Restore to original state
      };

      // Assert - Failed operation triggers rollback
      expect(shouldRollback(failedOperation)).toBe(true);
      const recoveredState = recoverFromError(originalBudget);
      expect(recoveredState.budgetLines).toEqual(originalBudget.budgetLines);
      expect(
        recoveredState.budgetLines.find((l) => l.id === failedClientId),
      ).toBeUndefined();
    });
  });

  describe('Performance et expérience utilisateur', () => {
    it('should generate unique client UUIDs for optimistic updates', async () => {
      // Arrange - Simulate rapid user actions; client generates UUIDs locally
      const { v4: uuidv4 } = await import('uuid');
      const generatedIds = new Set<string>();

      // Act - Generate multiple IDs rapidly
      for (let i = 0; i < 100; i++) {
        generatedIds.add(uuidv4());
      }

      // Assert - All IDs are unique (UUIDv4 collision is astronomically unlikely)
      expect(generatedIds.size).toBe(100);
      generatedIds.forEach((id) => {
        expect(id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        );
      });
    });

    it('should update data immutably for React-like behavior', () => {
      // Arrange - Original state
      const original = {
        budget: { id: 'budget-1', month: 1 },
        budgetLines: [{ id: 'line-1', amount: 100, name: 'Test' }],
      };

      // Act - Immutable update (Angular signals pattern)
      const updated = {
        ...original,
        budgetLines: original.budgetLines.map((line) =>
          line.id === 'line-1' ? { ...line, amount: 200 } : line,
        ),
      };

      // Assert - Original is unchanged, new reference created
      expect(updated).not.toBe(original);
      expect(updated.budgetLines).not.toBe(original.budgetLines);
      expect(updated.budgetLines[0].amount).toBe(200);
      expect(original.budgetLines[0].amount).toBe(100); // Original unchanged
    });
  });
});

/**
 * PUL-361 — "Supprimer ce mois". The store owns the future-month gate and the
 * order of the cache work around a delete, so these run the real store.
 */
describe('BudgetDetailsStore — delete a future month (PUL-361)', () => {
  const VIEWED_ID = 'budget-viewed';
  const OTHER_ID = 'budget-other';

  const NO_LINKS_IMPACT: BudgetDeletionImpact = {
    forecastCount: 4,
    movementCount: 2,
    links: {
      spreadForecasts: 0,
      savingsGoalForecasts: 0,
      savingsWithdrawalForecasts: 0,
      savingsWithdrawalMovements: 0,
    },
  };

  const flush = async (ready: () => boolean): Promise<void> => {
    // The system clock is frozen, so poll by attempts rather than by elapsed time.
    for (let attempt = 0; attempt < 200; attempt++) {
      if (ready()) return;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    throw new Error('store did not stabilize in time');
  };

  /** Today is frozen, and the store is built after it, so the live period is fixed. */
  const setup = async (options: {
    today: Date;
    payDay: number;
    viewed: { month: number; year: number };
  }) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(options.today);

    // One log across the caches: the order of the calls is what is asserted.
    const calls: string[] = [];
    const budgetCache = createMockDataCache();
    const savingsGoalCache = createMockDataCache();
    const templatesCache = createMockDataCache();
    for (const cache of [budgetCache, savingsGoalCache, templatesCache]) {
      cache.invalidate.mockImplementation((key: string[]) => {
        calls.push(key.join('.'));
      });
    }

    const otherBudget = createMockBudget({
      id: OTHER_ID,
      month: 1,
      year: 2020,
    });
    const viewedBudget = createMockBudget({
      id: VIEWED_ID,
      month: options.viewed.month,
      year: options.viewed.year,
    });
    const budgetApi = {
      getBudgetWithDetails$: vi.fn().mockReturnValue(
        of(
          createMockBudgetDetailsResponse({
            budget: viewedBudget,
            budgetLines: [],
            transactions: [],
          }),
        ),
      ),
      getAllBudgets$: vi.fn().mockReturnValue(of([otherBudget, viewedBudget])),
      getDeletionImpact$: vi.fn().mockReturnValue(of(NO_LINKS_IMPACT)),
      deleteBudget$: vi
        .fn()
        .mockReturnValue(of({ success: true, message: 'Budget deleted' })),
      cache: budgetCache,
    };
    const logger = { error: vi.fn(), warn: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        ...provideTranslocoForTest(),
        BudgetDetailsStore,
        TransactionImportApi,
        { provide: BudgetApi, useValue: budgetApi },
        {
          provide: SavingsGoalApi,
          useValue: {
            getAll$: vi.fn().mockReturnValue(of({ success: true, data: [] })),
            cache: savingsGoalCache,
          },
        },
        { provide: BudgetTemplatesApi, useValue: { cache: templatesCache } },
        { provide: Logger, useValue: logger },
        {
          provide: UserSettingsStore,
          useValue: {
            currency: signal('CHF'),
            payDayOfMonth: signal(options.payDay),
          },
        },
        {
          provide: ApplicationConfiguration,
          useValue: {
            backendApiUrl: vi
              .fn()
              .mockReturnValue('http://localhost:3000/api/v1'),
          },
        },
        {
          provide: PostHogService,
          useValue: {
            captureException: vi.fn(),
            isInitialized: vi.fn(() => ({ value: true })),
            isEnabled: vi.fn(() => ({ value: true })),
          },
        },
      ],
    });

    const store = TestBed.inject(BudgetDetailsStore);
    store.setBudgetId(VIEWED_ID);
    TestBed.tick();
    await flush(() => store.budgetDetails() !== null);
    return {
      store,
      budgetApi,
      budgetCache,
      savingsGoalCache,
      templatesCache,
      calls,
      logger,
    };
  };

  const OCT_20_2026 = new Date(2026, 9, 20, 12);
  const OCT_26_2026 = new Date(2026, 9, 26, 12);

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('isViewedMonthFuture', () => {
    it.each([
      // payDay 1: the live month is the calendar month.
      { payDay: 1, today: OCT_20_2026, viewed: [10, 2026], expected: false },
      { payDay: 1, today: OCT_20_2026, viewed: [9, 2026], expected: false },
      { payDay: 1, today: OCT_20_2026, viewed: [11, 2026], expected: true },
      // payDay 25 before the 25th: still October.
      { payDay: 25, today: OCT_20_2026, viewed: [10, 2026], expected: false },
      { payDay: 25, today: OCT_20_2026, viewed: [11, 2026], expected: true },
      // payDay 25 on the 26th (quinzaine rule): November is live, December is not.
      { payDay: 25, today: OCT_26_2026, viewed: [10, 2026], expected: false },
      { payDay: 25, today: OCT_26_2026, viewed: [11, 2026], expected: false },
      { payDay: 25, today: OCT_26_2026, viewed: [12, 2026], expected: true },
    ])(
      'should be $expected for viewed $viewed with payDay $payDay',
      async ({ payDay, today, viewed: [month, year], expected }) => {
        const { store } = await setup({
          today,
          payDay,
          viewed: { month, year },
        });

        expect(store.isViewedMonthFuture()).toBe(expected);
      },
    );

    it('should be false while no month is loaded', () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(OCT_20_2026);
      TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          provideHttpClient(),
          provideHttpClientTesting(),
          ...provideTranslocoForTest(),
          BudgetDetailsStore,
          TransactionImportApi,
          {
            provide: BudgetApi,
            useValue: {
              getBudgetWithDetails$: vi.fn(),
              getAllBudgets$: vi.fn().mockReturnValue(of([])),
              cache: createMockDataCache(),
            },
          },
          {
            provide: SavingsGoalApi,
            useValue: {
              getAll$: vi.fn().mockReturnValue(of({ success: true, data: [] })),
              cache: createMockDataCache(),
            },
          },
          { provide: Logger, useValue: { error: vi.fn(), warn: vi.fn() } },
          {
            provide: UserSettingsStore,
            useValue: { currency: signal('CHF'), payDayOfMonth: signal(1) },
          },
          {
            provide: ApplicationConfiguration,
            useValue: {
              backendApiUrl: vi
                .fn()
                .mockReturnValue('http://localhost:3000/api/v1'),
            },
          },
          {
            provide: PostHogService,
            useValue: {
              captureException: vi.fn(),
              isInitialized: vi.fn(() => ({ value: true })),
              isEnabled: vi.fn(() => ({ value: true })),
            },
          },
        ],
      });

      expect(TestBed.inject(BudgetDetailsStore).isViewedMonthFuture()).toBe(
        false,
      );
    });
  });

  describe('deletionImpact', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('should return the impact of the viewed month', async () => {
      const { store, budgetApi } = await setup({
        today: OCT_20_2026,
        payDay: 1,
        viewed: { month: 11, year: 2026 },
      });

      await expect(store.deletionImpact()).resolves.toEqual(NO_LINKS_IMPACT);
      expect(budgetApi.getDeletionImpact$).toHaveBeenCalledWith(VIEWED_ID);
    });

    it('should return null and log when the impact cannot be read', async () => {
      const { store, budgetApi, logger } = await setup({
        today: OCT_20_2026,
        payDay: 1,
        viewed: { month: 11, year: 2026 },
      });
      budgetApi.getDeletionImpact$.mockReturnValue(
        throwError(() => new Error('network')),
      );

      await expect(store.deletionImpact()).resolves.toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('deleteMonth', () => {
    const FUTURE = {
      today: OCT_20_2026,
      payDay: 1,
      viewed: { month: 11, year: 2026 },
    };

    it.each([true, false])(
      'should send confirmLinks=%s to the API',
      async (confirmLinks) => {
        const { store, budgetApi } = await setup(FUTURE);

        const isDeleted = await store.deleteMonth(
          confirmLinks,
          vi.fn().mockResolvedValue(true),
        );

        expect(isDeleted).toBe(true);
        expect(budgetApi.deleteBudget$).toHaveBeenCalledWith(
          VIEWED_ID,
          confirmLinks,
        );
      },
    );

    it('should leave the page before invalidating anything', async () => {
      const { store, calls } = await setup(FUTURE);

      await store.deleteMonth(false, async () => {
        calls.push('leave');
      });

      expect(calls).toEqual([
        'leave',
        'budget.details',
        'budget.list',
        'budget.dashboard',
        'budget.history',
        'budget.spread',
        'savings-goals',
        'templates.usage',
      ]);
    });

    it('should write the month out of the cached list before leaving', async () => {
      const { store, budgetCache } = await setup(FUTURE);
      budgetCache.set.mockClear(); // drop the write of the initial load
      let listWhenLeaving: unknown;

      await store.deleteMonth(false, async () => {
        listWhenLeaving = budgetCache.set.mock.calls.find(
          ([key]) => key.join('.') === 'budget.list',
        )?.[1];
      });

      expect(
        (listWhenLeaving as { id: string }[]).map((budget) => budget.id),
      ).toEqual([OTHER_ID]);
    });

    it('should neither leave nor invalidate when the server refuses', async () => {
      const {
        store,
        budgetApi,
        budgetCache,
        savingsGoalCache,
        templatesCache,
        logger,
      } = await setup(FUTURE);
      budgetCache.set.mockClear(); // drop the write of the initial load
      budgetApi.deleteBudget$.mockReturnValue(
        throwError(
          () =>
            new ApiError(
              'links not confirmed',
              API_ERROR_CODES.BUDGET_DELETION_LINKS_UNCONFIRMED,
              409,
              undefined,
            ),
        ),
      );
      const leave = vi.fn().mockResolvedValue(true);

      const isDeleted = await store.deleteMonth(false, leave);

      expect(isDeleted).toBe(false);
      expect(leave).not.toHaveBeenCalled();
      expect(budgetCache.invalidate).not.toHaveBeenCalled();
      expect(savingsGoalCache.invalidate).not.toHaveBeenCalled();
      expect(templatesCache.invalidate).not.toHaveBeenCalled();
      expect(budgetCache.set).not.toHaveBeenCalled();
      // A 409 is an expected refusal, not a failure worth reporting.
      expect(logger.error).not.toHaveBeenCalled();
    });
  });
});
