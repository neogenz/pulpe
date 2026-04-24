import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import type {
  TemplateLine,
  TemplateLinesBulkOperationsResponse,
  TemplateLinesPropagationSummary,
  BudgetTemplate,
} from 'pulpe-shared';
import { BudgetApi } from '@core/budget/budget-api';
import { BudgetTemplatesApi } from '@core/budget-template/budget-templates-api';
import { Logger } from '@core/logging/logger';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import {
  TemplateLineStore,
  type TemplateLineFormInput,
} from './template-line-store';
import { TemplateDetailsStore } from './template-details-store';

const TEMPLATE_ID = 'template-1';

const mockTemplate: BudgetTemplate = {
  id: TEMPLATE_ID,
  name: 'Template 1',
  description: 'Test',
  isDefault: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

function createLine(overrides: Partial<TemplateLine> = {}): TemplateLine {
  return {
    id: 'line-1',
    templateId: TEMPLATE_ID,
    name: 'Salary',
    amount: 3000,
    kind: 'income',
    recurrence: 'fixed',
    description: '',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    originalAmount: null,
    originalCurrency: null,
    targetCurrency: null,
    exchangeRate: null,
    ...overrides,
  } as TemplateLine;
}

function createPropagation(
  overrides: Partial<TemplateLinesPropagationSummary> = {},
): TemplateLinesPropagationSummary {
  return {
    mode: 'template-only',
    affectedBudgetIds: [],
    affectedBudgetsCount: 0,
    ...overrides,
  };
}

function createBulkResponse(
  overrides: Partial<TemplateLinesBulkOperationsResponse['data']> = {},
): TemplateLinesBulkOperationsResponse {
  return {
    success: true,
    data: {
      created: [],
      updated: [],
      deleted: [],
      propagation: null,
      ...overrides,
    },
  };
}

describe('TemplateLineStore', () => {
  let store: TemplateLineStore;
  let linesSignal: ReturnType<typeof signal<TemplateLine[]>>;
  let viewModelSignal: ReturnType<
    typeof signal<
      { template: BudgetTemplate; transactions: TemplateLine[] } | undefined
    >
  >;
  let templatesApiMock: {
    bulkOperationsTemplateLines$: ReturnType<typeof vi.fn>;
    cache: Record<string, unknown>;
  };
  let budgetApiMock: { cache: { invalidate: ReturnType<typeof vi.fn> } };
  let detailsStoreMock: {
    template: () => BudgetTemplate | null;
    templateLines: () => TemplateLine[];
    rawDetails: ReturnType<typeof vi.fn>;
    setDetails: ReturnType<typeof vi.fn>;
    reloadTemplateDetails: ReturnType<typeof vi.fn>;
  };

  const input: TemplateLineFormInput = {
    name: 'Groceries',
    amount: 400,
    kind: 'expense',
  };

  beforeEach(() => {
    linesSignal = signal<TemplateLine[]>([createLine()]);
    viewModelSignal = signal<
      { template: BudgetTemplate; transactions: TemplateLine[] } | undefined
    >({ template: mockTemplate, transactions: linesSignal() });

    templatesApiMock = {
      bulkOperationsTemplateLines$: vi.fn(),
      cache: {
        version: signal(0),
        get: vi.fn().mockReturnValue(null),
        set: vi.fn(),
        has: vi.fn().mockReturnValue(false),
        invalidate: vi.fn(),
        deduplicate: vi.fn((_key: string[], fn: () => Promise<unknown>) =>
          fn(),
        ),
        prefetch: vi.fn(),
        clear: vi.fn(),
        clearDirty: vi.fn(),
      },
    };

    budgetApiMock = {
      cache: { invalidate: vi.fn() },
    };

    detailsStoreMock = {
      template: () => mockTemplate,
      templateLines: () => linesSignal(),
      rawDetails: vi.fn(() => viewModelSignal()),
      setDetails: vi.fn((details) => {
        viewModelSignal.set(details);
        linesSignal.set(details.transactions);
      }),
      reloadTemplateDetails: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
        TemplateLineStore,
        {
          provide: BudgetTemplatesApi,
          useValue: templatesApiMock as unknown as BudgetTemplatesApi,
        },
        { provide: BudgetApi, useValue: budgetApiMock },
        { provide: TemplateDetailsStore, useValue: detailsStoreMock },
        {
          provide: Logger,
          useValue: {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
          },
        },
      ],
    });

    store = TestBed.inject(TemplateLineStore);
  });

  describe('createLine', () => {
    it('should optimistically insert a line and replace the temp ID on success', async () => {
      const created = createLine({
        id: 'line-new',
        name: input.name,
        amount: input.amount,
        kind: 'expense',
      });
      templatesApiMock.bulkOperationsTemplateLines$.mockReturnValue(
        of(createBulkResponse({ created: [created] })),
      );

      const initialCount = linesSignal().length;

      const response = await store.createLine(TEMPLATE_ID, input, false);

      const lines = linesSignal();
      expect(lines).toHaveLength(initialCount + 1);
      expect(lines.find((line) => line.id === 'line-new')?.name).toBe(
        input.name,
      );
      expect(lines.every((line) => !line.id.startsWith('temp-'))).toBe(true);
      expect(response?.data.created[0]?.id).toBe('line-new');
      expect(budgetApiMock.cache.invalidate).not.toHaveBeenCalled();
    });

    it('should forward propagateToBudgets=true and invalidate budget cache on propagation', async () => {
      templatesApiMock.bulkOperationsTemplateLines$.mockReturnValue(
        of(
          createBulkResponse({
            created: [createLine({ id: 'line-new' })],
            propagation: createPropagation({
              mode: 'propagate',
              affectedBudgetsCount: 2,
              affectedBudgetIds: ['budget-1', 'budget-2'],
            }),
          }),
        ),
      );

      await store.createLine(TEMPLATE_ID, input, true);

      const [, payload] =
        templatesApiMock.bulkOperationsTemplateLines$.mock.calls[0];
      expect(payload.propagateToBudgets).toBe(true);
      expect(budgetApiMock.cache.invalidate).toHaveBeenCalledWith(['budget']);
    });

    it('should reload template details when the mutation fails', async () => {
      templatesApiMock.bulkOperationsTemplateLines$.mockReturnValue(
        throwError(() => new Error('boom')),
      );

      const response = await store.createLine(TEMPLATE_ID, input, false);

      expect(response).toBeUndefined();
      expect(detailsStoreMock.reloadTemplateDetails).toHaveBeenCalled();
    });
  });

  describe('updateLine', () => {
    it('should patch only the targeted line and replace it with the server response', async () => {
      linesSignal.set([
        createLine({ id: 'line-a', name: 'A', amount: 100 }),
        createLine({ id: 'line-b', name: 'B', amount: 200 }),
      ]);
      viewModelSignal.set({
        template: mockTemplate,
        transactions: linesSignal(),
      });

      const updated = createLine({
        id: 'line-b',
        name: 'B-updated',
        amount: 250,
      });
      templatesApiMock.bulkOperationsTemplateLines$.mockReturnValue(
        of(createBulkResponse({ updated: [updated] })),
      );

      await store.updateLine(
        TEMPLATE_ID,
        'line-b',
        {
          name: 'B-updated',
          amount: 250,
          kind: 'income',
        },
        false,
      );

      const lines = linesSignal();
      expect(lines.find((line) => line.id === 'line-a')?.name).toBe('A');
      expect(lines.find((line) => line.id === 'line-b')).toEqual(updated);
    });

    it('should reload when the update mutation fails', async () => {
      templatesApiMock.bulkOperationsTemplateLines$.mockReturnValue(
        throwError(() => new Error('nope')),
      );

      await store.updateLine(
        TEMPLATE_ID,
        'line-1',
        {
          name: 'X',
          amount: 1,
          kind: 'expense',
        },
        false,
      );

      expect(detailsStoreMock.reloadTemplateDetails).toHaveBeenCalled();
    });
  });

  describe('deleteLine', () => {
    it('should optimistically remove the targeted line', async () => {
      linesSignal.set([
        createLine({ id: 'line-a' }),
        createLine({ id: 'line-b' }),
      ]);
      viewModelSignal.set({
        template: mockTemplate,
        transactions: linesSignal(),
      });

      templatesApiMock.bulkOperationsTemplateLines$.mockReturnValue(
        of(createBulkResponse({ deleted: ['line-b'] })),
      );

      await store.deleteLine(TEMPLATE_ID, 'line-b', false);

      expect(linesSignal().map((line) => line.id)).toEqual(['line-a']);
    });

    it('should reload when the delete mutation fails', async () => {
      templatesApiMock.bulkOperationsTemplateLines$.mockReturnValue(
        throwError(() => new Error('nope')),
      );

      await store.deleteLine(TEMPLATE_ID, 'line-1', false);

      expect(detailsStoreMock.reloadTemplateDetails).toHaveBeenCalled();
    });
  });
});
