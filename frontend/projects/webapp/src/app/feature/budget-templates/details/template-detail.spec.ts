import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerLocaleData } from '@angular/common';
import localeDeCH from '@angular/common/locales/de-CH';
import { TestBed } from '@angular/core/testing';
import {
  provideZonelessChangeDetection,
  signal,
  computed,
  Component,
  ChangeDetectionStrategy,
  input,
  type WritableSignal,
} from '@angular/core';
import { provideRouter, ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import type { BudgetTemplateDetailViewModel } from '../services/budget-templates-api';
import { BudgetTemplatesApi } from '../services/budget-templates-api';
import { TemplateDetailsStore } from './services/template-details-store';
import { PulpeTitleStrategy } from '@core/routing/title-strategy';
import { Logger } from '@core/logging/logger';
import { BudgetInvalidationService } from '@core/budget/budget-invalidation.service';
import { BudgetApi } from '@core/budget/budget-api';
import { TransactionLabelPipe } from '@ui/transaction-display';
import { BaseLoading } from '@ui/loading';
import { TransactionsTable, EditTransactionsDialog } from './components';
import {
  createMockBudgetTemplate,
  createMockTemplateLine,
} from '@app/testing/mock-factories';

registerLocaleData(localeDeCH, 'de-CH');

@Component({
  selector: 'pulpe-transactions-table',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class StubTransactionsTable {
  readonly entries = input.required<unknown[]>();
}

@Component({
  selector: 'pulpe-base-loading',
  template: '<div [attr.data-testid]="testId()"></div>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class StubBaseLoading {
  readonly message = input.required<string>();
  readonly size = input<string>('medium');
  readonly fullHeight = input(false);
  readonly testId = input<string>('loading-container');
}

// --- Shared mock data ---

const mockTemplate = createMockBudgetTemplate({
  id: 'template-123',
  name: 'Mon Modèle',
});

const mockLines = [
  createMockTemplateLine({
    id: 'line-1',
    name: 'Salaire',
    amount: 5000,
    kind: 'income',
    createdAt: '2024-01-01T00:00:00Z',
  }),
  createMockTemplateLine({
    id: 'line-2',
    name: 'Loyer',
    amount: 1200,
    kind: 'expense',
    createdAt: '2024-01-02T00:00:00Z',
  }),
  createMockTemplateLine({
    id: 'line-3',
    name: 'Épargne',
    amount: 800,
    kind: 'saving',
    createdAt: '2024-01-03T00:00:00Z',
  }),
];

const mockTemplateDetails: BudgetTemplateDetailViewModel = {
  template: mockTemplate,
  transactions: mockLines,
};

// --- Shared mutable mock store ---

const storeTemplateDetails: WritableSignal<BudgetTemplateDetailViewModel | null> =
  signal(mockTemplateDetails);
const storeIsLoading = signal(false);
const storeError: WritableSignal<unknown> = signal(null);

const mockStore = {
  templateDetails: storeTemplateDetails,
  isLoading: storeIsLoading,
  error: storeError,
  hasValue: computed(() => !!storeTemplateDetails()),
  template: computed(() => storeTemplateDetails()?.template ?? null),
  transactions: computed(() => storeTemplateDetails()?.transactions ?? []),
  templateLines: computed(() => storeTemplateDetails()?.transactions ?? []),
  initializeTemplateId: vi.fn(),
  reloadTemplateDetails: vi.fn(),
};

const mockDialog = { open: vi.fn() };
const mockSnackBar = { open: vi.fn() };
const mockBudgetTemplatesApi = { checkUsage$: vi.fn(), delete$: vi.fn() };
const mockTitleStrategy = { setTitle: vi.fn() };
const mockLogger = { error: vi.fn() };
const mockBudgetInvalidationService = {
  invalidate: vi.fn(),
  version: signal(0).asReadonly(),
};
const mockBudgetApi = { cache: { invalidate: vi.fn() } };
const mockRoute = {
  snapshot: {
    paramMap: {
      get: vi.fn((key: string) =>
        key === 'templateId' ? 'template-123' : null,
      ),
    },
  },
};

describe('TemplateDetail', () => {
  async function createFixture() {
    const TemplateDetail = (await import('./template-detail')).default;

    TestBed.configureTestingModule({
      imports: [TemplateDetail, NoopAnimationsModule],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        TransactionLabelPipe,
        { provide: ActivatedRoute, useValue: mockRoute },
        { provide: TemplateDetailsStore, useValue: mockStore },
        { provide: MatDialog, useValue: mockDialog },
        { provide: MatSnackBar, useValue: mockSnackBar },
        { provide: BudgetTemplatesApi, useValue: mockBudgetTemplatesApi },
        { provide: PulpeTitleStrategy, useValue: mockTitleStrategy },
        { provide: Logger, useValue: mockLogger },
        {
          provide: BudgetInvalidationService,
          useValue: mockBudgetInvalidationService,
        },
        { provide: BudgetApi, useValue: mockBudgetApi },
      ],
    })
      .overrideComponent(TemplateDetail, {
        remove: { imports: [TransactionsTable, BaseLoading] },
      })
      .overrideComponent(TemplateDetail, {
        add: {
          imports: [StubTransactionsTable, StubBaseLoading],
          providers: [
            { provide: TemplateDetailsStore, useValue: mockStore },
            { provide: MatSnackBar, useValue: mockSnackBar },
          ],
        },
      });

    const fixture = TestBed.createComponent(TemplateDetail);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mutable signals to defaults
    storeTemplateDetails.set(mockTemplateDetails);
    storeIsLoading.set(false);
    storeError.set(null);
    // Default route returns template-123
    mockRoute.snapshot.paramMap.get.mockImplementation((key: string) =>
      key === 'templateId' ? 'template-123' : null,
    );
    mockDialog.open.mockReturnValue({ afterClosed: () => of(null) });
  });

  // ─── Initialization ───

  describe('Initialization', () => {
    it('should call initializeTemplateId with route param on ngOnInit', async () => {
      const fixture = await createFixture();
      mockStore.initializeTemplateId.mockClear();

      fixture.componentInstance.ngOnInit();

      expect(mockStore.initializeTemplateId).toHaveBeenCalledWith(
        'template-123',
        undefined,
      );
    });

    it('should not call initializeTemplateId when templateId is null', async () => {
      mockRoute.snapshot.paramMap.get.mockReturnValue(null);
      const fixture = await createFixture();
      mockStore.initializeTemplateId.mockClear();

      fixture.componentInstance.ngOnInit();

      expect(mockStore.initializeTemplateId).not.toHaveBeenCalled();
    });
  });

  // ─── Computed State ───

  describe('Computed State', () => {
    it('should sort entries by kind then createdAt', async () => {
      const fixture = await createFixture();
      const descriptions = fixture.componentInstance
        .entries()
        .map((e: { description: string }) => e.description);

      // income first, then saving, then expense
      expect(descriptions).toEqual(['Salaire', 'Épargne', 'Loyer']);
    });

    it('should map template lines to FinancialEntry with correct amounts', async () => {
      const fixture = await createFixture();
      const entries = fixture.componentInstance.entries();

      expect(entries[0]).toEqual({
        description: 'Salaire',
        spent: 0,
        earned: 5000,
        saved: 0,
        total: 5000,
      });
      expect(entries[1]).toEqual({
        description: 'Épargne',
        spent: 0,
        earned: 0,
        saved: 800,
        total: 0,
      });
      expect(entries[2]).toEqual({
        description: 'Loyer',
        spent: 1200,
        earned: 0,
        saved: 0,
        total: -1200,
      });
    });

    it('should calculate totals from entries', async () => {
      const fixture = await createFixture();
      expect(fixture.componentInstance.totals()).toEqual({
        income: 5000,
        expense: 1200,
        savings: 800,
      });
    });

    it('should calculate net balance as income minus expense minus savings', async () => {
      const fixture = await createFixture();
      // 5000 - 1200 - 800 = 3000
      expect(fixture.componentInstance.netBalance()).toBe(3000);
    });

    it('should return empty entries when transactions are empty', async () => {
      storeTemplateDetails.set({ template: mockTemplate, transactions: [] });
      const fixture = await createFixture();

      expect(fixture.componentInstance.entries()).toEqual([]);
      expect(fixture.componentInstance.totals()).toEqual({
        income: 0,
        expense: 0,
        savings: 0,
      });
    });
  });

  // ─── Rendering ───

  describe('Rendering', () => {
    it('should display template name in page title', async () => {
      const fixture = await createFixture();
      const el = fixture.nativeElement as HTMLElement;

      expect(
        el.querySelector('[data-testid="page-title"]')?.textContent?.trim(),
      ).toContain('Mon Modèle');
    });

    it('should show loading state when store is loading', async () => {
      storeIsLoading.set(true);
      storeTemplateDetails.set(null);
      const fixture = await createFixture();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;

      expect(el.querySelector('pulpe-base-loading')).toBeTruthy();
      expect(el.querySelector('[data-testid="page-title"]')).toBeFalsy();
    });

    it('should show error state when store has error', async () => {
      storeError.set(new Error('fail'));
      storeTemplateDetails.set(null);
      const fixture = await createFixture();
      const el = fixture.nativeElement as HTMLElement;

      expect(el.querySelector('[role="alert"]')).toBeTruthy();
    });

    it('should render edit and delete buttons when data is loaded', async () => {
      const fixture = await createFixture();
      const el = fixture.nativeElement as HTMLElement;

      expect(
        el.querySelector('[data-testid="template-detail-edit-button"]'),
      ).toBeTruthy();
      expect(
        el.querySelector('[data-testid="delete-template-detail-button"]'),
      ).toBeTruthy();
    });
  });

  // ─── Navigation ───

  describe('Navigation', () => {
    it('should navigate to budget templates list on navigateBack', async () => {
      const fixture = await createFixture();
      const router = TestBed.inject(Router);
      vi.spyOn(router, 'navigate').mockResolvedValue(true);

      fixture.componentInstance.navigateBack();

      expect(router.navigate).toHaveBeenCalledWith(['/', 'budget-templates']);
    });
  });

  // ─── Edit Template (SCENARIOS 4.4) ───

  describe('Edit Template', () => {
    it('should not open dialog when template is null', async () => {
      storeTemplateDetails.set(null);
      const fixture = await createFixture();

      fixture.componentInstance.editTemplate();

      expect(mockDialog.open).not.toHaveBeenCalled();
    });

    it('should open EditTransactionsDialog with correct data', async () => {
      const fixture = await createFixture();

      fixture.componentInstance.editTemplate();

      expect(mockDialog.open).toHaveBeenCalledOnce();
      const [dialogComponent, config] = mockDialog.open.mock.calls[0];
      expect(dialogComponent).toBe(EditTransactionsDialog);
      expect(config.data.templateName).toBe('Mon Modèle');
      expect(config.data.templateId).toBe('template-123');
      expect(config.data.transactions).toHaveLength(3);
      expect(config.data.originalTemplateLines).toEqual(mockLines);
      expect(config.width).toBe('90vw');
    });

    it('should reload store and invalidate budgets on propagation mode propagate', async () => {
      mockDialog.open.mockReturnValue({
        afterClosed: () =>
          of({
            saved: true,
            propagation: {
              mode: 'propagate',
              affectedBudgetIds: ['b1'],
              affectedBudgetsCount: 1,
            },
          }),
      });

      const fixture = await createFixture();
      fixture.componentInstance.editTemplate();

      expect(mockStore.reloadTemplateDetails).toHaveBeenCalledOnce();
      expect(mockBudgetInvalidationService.invalidate).toHaveBeenCalledOnce();
      expect(mockBudgetApi.cache.invalidate).toHaveBeenCalledWith(['budget']);
    });

    it('should reload store but not invalidate budgets on template-only mode', async () => {
      mockDialog.open.mockReturnValue({
        afterClosed: () =>
          of({
            saved: true,
            propagation: {
              mode: 'template-only',
              affectedBudgetIds: [],
              affectedBudgetsCount: 0,
            },
          }),
      });

      const fixture = await createFixture();
      fixture.componentInstance.editTemplate();

      expect(mockStore.reloadTemplateDetails).toHaveBeenCalledOnce();
      expect(mockBudgetInvalidationService.invalidate).not.toHaveBeenCalled();
      expect(mockBudgetApi.cache.invalidate).not.toHaveBeenCalled();
    });

    it('should show no-modification message when propagation is null', async () => {
      mockDialog.open.mockReturnValue({
        afterClosed: () => of({ saved: true, propagation: null }),
      });

      const fixture = await createFixture();
      fixture.componentInstance.editTemplate();

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Aucune modification à enregistrer',
        undefined,
        { duration: 4000 },
      );
      expect(mockStore.reloadTemplateDetails).not.toHaveBeenCalled();
    });

    it('should log error when dialog returns error result', async () => {
      mockDialog.open.mockReturnValue({
        afterClosed: () => of({ saved: false, error: 'Something failed' }),
      });

      const fixture = await createFixture();
      fixture.componentInstance.editTemplate();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Erreur lors de la sauvegarde:',
        'Something failed',
      );
    });

    it('should do nothing when dialog is cancelled', async () => {
      const fixture = await createFixture();
      fixture.componentInstance.editTemplate();

      expect(mockSnackBar.open).not.toHaveBeenCalled();
      expect(mockStore.reloadTemplateDetails).not.toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });

  // ─── Success Messages ───

  describe('Success Messages', () => {
    it('should show plural message when multiple budgets affected', async () => {
      mockDialog.open.mockReturnValue({
        afterClosed: () =>
          of({
            saved: true,
            propagation: {
              mode: 'propagate',
              affectedBudgetIds: ['b1', 'b2'],
              affectedBudgetsCount: 2,
            },
          }),
      });

      const fixture = await createFixture();
      fixture.componentInstance.editTemplate();

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Modèle et budgets futurs mis à jour (2 budgets ajustés)',
        undefined,
        { duration: 4000 },
      );
    });

    it('should show template-only message when propagate mode but zero affected budgets', async () => {
      mockDialog.open.mockReturnValue({
        afterClosed: () =>
          of({
            saved: true,
            propagation: {
              mode: 'propagate',
              affectedBudgetIds: [],
              affectedBudgetsCount: 0,
            },
          }),
      });

      const fixture = await createFixture();
      fixture.componentInstance.editTemplate();

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Modèle mis à jour (budgets non modifiés).',
        undefined,
        { duration: 4000 },
      );
    });
  });

  // ─── Delete Template (SCENARIOS 4.5) ───

  describe('Delete Template', () => {
    it('should not proceed when template is null', async () => {
      storeTemplateDetails.set(null);
      const fixture = await createFixture();

      await fixture.componentInstance.deleteTemplate();

      expect(mockBudgetTemplatesApi.checkUsage$).not.toHaveBeenCalled();
    });

    it('should open usage dialog when template is in use', async () => {
      const usageResponse = {
        data: {
          isUsed: true,
          budgets: [{ id: 'b1', month: 3, year: 2024 }],
        },
      };
      mockBudgetTemplatesApi.checkUsage$.mockReturnValue(of(usageResponse));

      const mockDialogInstance = { setUsageData: vi.fn() };
      mockDialog.open.mockReturnValue({
        componentInstance: mockDialogInstance,
        afterClosed: () => of(null),
      });

      const fixture = await createFixture();
      await fixture.componentInstance.deleteTemplate();

      expect(mockBudgetTemplatesApi.checkUsage$).toHaveBeenCalledWith(
        'template-123',
      );
      expect(mockDialogInstance.setUsageData).toHaveBeenCalledWith(
        usageResponse.data.budgets,
      );
    });

    it('should open confirmation dialog when template is not in use', async () => {
      mockBudgetTemplatesApi.checkUsage$.mockReturnValue(
        of({ data: { isUsed: false, budgets: [] } }),
      );
      mockDialog.open.mockReturnValue({ afterClosed: () => of(false) });

      const fixture = await createFixture();
      await fixture.componentInstance.deleteTemplate();

      expect(mockBudgetTemplatesApi.checkUsage$).toHaveBeenCalledWith(
        'template-123',
      );
      expect(mockDialog.open).toHaveBeenCalled();
    });

    it('should delete and navigate back when confirmed', async () => {
      mockBudgetTemplatesApi.checkUsage$.mockReturnValue(
        of({ data: { isUsed: false, budgets: [] } }),
      );
      mockBudgetTemplatesApi.delete$.mockReturnValue(of({}));
      mockDialog.open.mockReturnValue({ afterClosed: () => of(true) });

      const fixture = await createFixture();
      const router = TestBed.inject(Router);
      vi.spyOn(router, 'navigate').mockResolvedValue(true);

      await fixture.componentInstance.deleteTemplate();

      expect(mockBudgetTemplatesApi.delete$).toHaveBeenCalledWith(
        'template-123',
      );
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Modèle supprimé avec succès',
        undefined,
        { duration: 3000 },
      );
      expect(router.navigate).toHaveBeenCalledWith(['/', 'budget-templates']);
    });

    it('should show error snackbar when deletion fails', async () => {
      mockBudgetTemplatesApi.checkUsage$.mockReturnValue(
        of({ data: { isUsed: false, budgets: [] } }),
      );
      mockBudgetTemplatesApi.delete$.mockReturnValue(
        throwError(() => new Error('Network error')),
      );
      mockDialog.open.mockReturnValue({ afterClosed: () => of(true) });

      const fixture = await createFixture();
      await fixture.componentInstance.deleteTemplate();

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Une erreur est survenue lors de la suppression',
        'Fermer',
        { duration: 5000 },
      );
    });

    it('should show error snackbar when usage check fails', async () => {
      mockBudgetTemplatesApi.checkUsage$.mockReturnValue(
        throwError(() => new Error('API error')),
      );

      const fixture = await createFixture();
      await fixture.componentInstance.deleteTemplate();

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Une erreur est survenue lors de la vérification',
        'Fermer',
        { duration: 5000 },
      );
    });
  });
});
