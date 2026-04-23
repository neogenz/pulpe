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
  output,
  type WritableSignal,
} from '@angular/core';
import { provideRouter, ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import type {
  SupportedCurrency,
  TemplateLine,
  TransactionKind,
} from 'pulpe-shared';
import { type BudgetTemplateDetailViewModel } from './services/template-details-store';
import { BudgetTemplatesStore } from '../services/budget-templates-store';
import { TemplateDetailsStore } from './services/template-details-store';
import { TemplateLineStore } from './services/template-line-store';
import { PulpeTitleStrategy } from '@core/routing/title-strategy';
import { BudgetApi } from '@core/budget/budget-api';
import { TransactionLabelPipe } from '@ui/transaction-display';
import { UserSettingsStore } from '@core/user-settings';
import { BaseLoading } from '@ui/loading';
import { ConfirmationDialog } from '@ui/dialogs/confirmation-dialog';
import { TemplateLinesGrid } from './components/template-lines-grid';
import { EditTemplateLineDialog } from './components/edit-template-line-dialog';
import {
  createMockBudgetTemplate,
  createMockTemplateLine,
} from '@app/testing/mock-factories';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';

registerLocaleData(localeDeCH, 'de-CH');

@Component({
  selector: 'pulpe-template-lines-grid',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class StubTemplateLinesGrid {
  readonly lines = input.required<readonly TemplateLine[]>();
  readonly currency = input<SupportedCurrency>('CHF');
  readonly edit = output<TemplateLine>();
  readonly delete = output<string>();
  readonly add = output<void>();
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

const mockLines: TemplateLine[] = [
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

// --- Shared mutable mock TemplateDetailsStore ---

const storeTemplateDetails: WritableSignal<BudgetTemplateDetailViewModel | null> =
  signal(mockTemplateDetails);
const storeIsLoading = signal(false);
const storeError: WritableSignal<unknown> = signal(null);

const storeTemplateLines = computed(
  () => storeTemplateDetails()?.transactions ?? [],
);

const storeTotals = computed(() =>
  storeTemplateLines().reduce(
    (acc, line: TemplateLine) => {
      if (line.kind === 'income') acc.income += line.amount;
      else if (line.kind === 'expense') acc.expense += line.amount;
      else if (line.kind === 'saving') acc.savings += line.amount;
      return acc;
    },
    { income: 0, expense: 0, savings: 0 },
  ),
);

const storeNetBalance = computed(() => {
  const t = storeTotals();
  return t.income - t.expense - t.savings;
});

const mockStore = {
  templateDetails: storeTemplateDetails,
  isLoading: storeIsLoading,
  error: storeError,
  hasValue: computed(() => !!storeTemplateDetails()),
  template: computed(() => storeTemplateDetails()?.template ?? null),
  templateLines: storeTemplateLines,
  totals: storeTotals,
  netBalance: storeNetBalance,
  initializeTemplateId: vi.fn(),
  reloadTemplateDetails: vi.fn(),
  checkUsage: vi.fn(),
  rawDetails: computed(() => storeTemplateDetails()),
  setDetails: vi.fn(),
};

const mockTemplateLineStore = {
  createLine: vi
    .fn<(templateId: string, input: unknown) => Promise<void>>()
    .mockResolvedValue(undefined),
  updateLine: vi
    .fn<(templateId: string, lineId: string, input: unknown) => Promise<void>>()
    .mockResolvedValue(undefined),
  deleteLine: vi
    .fn<(templateId: string, lineId: string) => Promise<void>>()
    .mockResolvedValue(undefined),
  isLoading: signal(false),
};

const mockDialog = { open: vi.fn() };
const mockBudgetTemplatesStore = {
  confirmAndDeleteTemplate: vi
    .fn<
      (
        templateId: string,
        templateName: string,
      ) => Promise<'deleted' | 'cancelled' | 'cancelled-due-to-usage' | 'error'>
    >()
    .mockResolvedValue('cancelled'),
};
const mockTitleStrategy = { setTitle: vi.fn() };
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
        ...provideTranslocoForTest(),
        provideRouter([]),
        TransactionLabelPipe,
        { provide: ActivatedRoute, useValue: mockRoute },
        { provide: TemplateDetailsStore, useValue: mockStore },
        { provide: TemplateLineStore, useValue: mockTemplateLineStore },
        { provide: MatDialog, useValue: mockDialog },
        { provide: BudgetTemplatesStore, useValue: mockBudgetTemplatesStore },
        { provide: PulpeTitleStrategy, useValue: mockTitleStrategy },
        { provide: BudgetApi, useValue: mockBudgetApi },
        {
          provide: UserSettingsStore,
          useValue: { currency: signal('CHF') },
        },
      ],
    })
      .overrideComponent(TemplateDetail, {
        remove: { imports: [TemplateLinesGrid, BaseLoading] },
      })
      .overrideComponent(TemplateDetail, {
        add: {
          imports: [StubTemplateLinesGrid, StubBaseLoading],
          providers: [
            { provide: TemplateDetailsStore, useValue: mockStore },
            { provide: TemplateLineStore, useValue: mockTemplateLineStore },
          ],
        },
      });

    const fixture = TestBed.createComponent(TemplateDetail);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    storeTemplateDetails.set(mockTemplateDetails);
    storeIsLoading.set(false);
    storeError.set(null);
    mockBudgetTemplatesStore.confirmAndDeleteTemplate.mockResolvedValue(
      'cancelled',
    );
    mockTemplateLineStore.createLine.mockResolvedValue(undefined);
    mockTemplateLineStore.updateLine.mockResolvedValue(undefined);
    mockTemplateLineStore.deleteLine.mockResolvedValue(undefined);
    mockRoute.snapshot.paramMap.get.mockImplementation((key: string) =>
      key === 'templateId' ? 'template-123' : null,
    );
    mockDialog.open.mockReturnValue({ afterClosed: () => of(null) });
  });

  describe('Initialization', () => {
    it('should call initializeTemplateId with route param on ngOnInit', async () => {
      const fixture = await createFixture();
      mockStore.initializeTemplateId.mockClear();

      fixture.componentInstance.ngOnInit();

      expect(mockStore.initializeTemplateId).toHaveBeenCalledWith(
        'template-123',
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

  describe('Store computed state', () => {
    it('should compute totals from template lines grouped by kind', async () => {
      await createFixture();

      expect(mockStore.totals()).toEqual({
        income: 5000,
        expense: 1200,
        savings: 800,
      });
    });

    it('should compute net balance as income minus expense minus savings', async () => {
      await createFixture();

      expect(mockStore.netBalance()).toBe(3000);
    });

    it('should return zero totals when template lines are empty', async () => {
      storeTemplateDetails.set({ template: mockTemplate, transactions: [] });
      await createFixture();

      expect(mockStore.totals()).toEqual({
        income: 0,
        expense: 0,
        savings: 0,
      });
      expect(mockStore.netBalance()).toBe(0);
    });
  });

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

    it('should render delete button when data is loaded', async () => {
      const fixture = await createFixture();
      const el = fixture.nativeElement as HTMLElement;

      expect(
        el.querySelector('[data-testid="delete-template-detail-button"]'),
      ).toBeTruthy();
    });

    it('should render the template-lines-grid', async () => {
      const fixture = await createFixture();
      const gridDebugEl = fixture.debugElement.query(
        By.directive(StubTemplateLinesGrid),
      );

      expect(gridDebugEl).toBeTruthy();
    });

    it('should render the FAB button to add a new line', async () => {
      const fixture = await createFixture();
      const el = fixture.nativeElement as HTMLElement;

      const fab = el.querySelector('[data-testid="add-template-line-fab"]');
      expect(fab).toBeTruthy();
    });
  });

  describe('Hero hybride', () => {
    it('should apply primary-container background when net balance is positive', async () => {
      storeTemplateDetails.set({
        template: mockTemplate,
        transactions: mockLines,
      });
      const fixture = await createFixture();
      const el = fixture.nativeElement as HTMLElement;

      const hero = el.querySelector(
        '[data-testid="template-hero-subtitle"]',
      )?.parentElement;
      expect(hero?.classList.contains('bg-primary-container')).toBe(true);
      expect(hero?.classList.contains('bg-error-container')).toBe(false);
    });

    it('should render comfortable subtitle when net balance is positive', async () => {
      storeTemplateDetails.set({
        template: mockTemplate,
        transactions: mockLines,
      });
      const fixture = await createFixture();
      const el = fixture.nativeElement as HTMLElement;

      const subtitle = el.querySelector(
        '[data-testid="template-hero-subtitle"]',
      );
      expect(subtitle?.textContent).toContain('marge');
    });

    it('should apply error-container background when net balance is negative', async () => {
      const deficitLines: TemplateLine[] = [
        createMockTemplateLine({
          id: 'd1',
          name: 'Revenu',
          amount: 100,
          kind: 'income',
        }),
        createMockTemplateLine({
          id: 'd2',
          name: 'Grosse dépense',
          amount: 500,
          kind: 'expense',
        }),
      ];
      storeTemplateDetails.set({
        template: mockTemplate,
        transactions: deficitLines,
      });
      const fixture = await createFixture();
      const el = fixture.nativeElement as HTMLElement;

      const hero = el.querySelector(
        '[data-testid="template-hero-subtitle"]',
      )?.parentElement;
      expect(hero?.classList.contains('bg-error-container')).toBe(true);
      expect(hero?.classList.contains('bg-primary-container')).toBe(false);
    });

    it('should render deficit subtitle when net balance is negative', async () => {
      const deficitLines: TemplateLine[] = [
        createMockTemplateLine({
          id: 'd1',
          name: 'Revenu',
          amount: 100,
          kind: 'income',
        }),
        createMockTemplateLine({
          id: 'd2',
          name: 'Grosse dépense',
          amount: 500,
          kind: 'expense',
        }),
      ];
      storeTemplateDetails.set({
        template: mockTemplate,
        transactions: deficitLines,
      });
      const fixture = await createFixture();
      const el = fixture.nativeElement as HTMLElement;

      const subtitle = el.querySelector(
        '[data-testid="template-hero-subtitle"]',
      );
      expect(subtitle?.textContent).toContain('serré');
    });
  });

  describe('Navigation', () => {
    it('should navigate to budget templates list on navigateBack', async () => {
      const fixture = await createFixture();
      const router = TestBed.inject(Router);
      vi.spyOn(router, 'navigate').mockResolvedValue(true);

      fixture.componentInstance.navigateBack();

      expect(router.navigate).toHaveBeenCalledWith(['/', 'budget-templates']);
    });
  });

  describe('handleAddLine', () => {
    it('should do nothing when templateId is null', async () => {
      mockRoute.snapshot.paramMap.get.mockReturnValue(null);
      const fixture = await createFixture();

      await fixture.componentInstance.handleAddLine();

      expect(mockDialog.open).not.toHaveBeenCalled();
      expect(mockTemplateLineStore.createLine).not.toHaveBeenCalled();
    });

    it('should do nothing when template is null', async () => {
      storeTemplateDetails.set(null);
      const fixture = await createFixture();

      await fixture.componentInstance.handleAddLine();

      expect(mockDialog.open).not.toHaveBeenCalled();
      expect(mockTemplateLineStore.createLine).not.toHaveBeenCalled();
    });

    it('should open EditTemplateLineDialog without a line (create mode)', async () => {
      const fixture = await createFixture();

      await fixture.componentInstance.handleAddLine();

      expect(mockDialog.open).toHaveBeenCalledOnce();
      const [dialogComponent, config] = mockDialog.open.mock.calls[0];
      expect(dialogComponent).toBe(EditTemplateLineDialog);
      expect(config.data.line).toBeUndefined();
      expect(config.data.templateName).toBe('Mon Modèle');
    });

    it('should call createLine when dialog returns a result', async () => {
      const dialogResult = {
        name: 'New line',
        amount: 100,
        kind: 'expense' as TransactionKind,
      };
      mockDialog.open.mockReturnValue({ afterClosed: () => of(dialogResult) });

      const fixture = await createFixture();
      await fixture.componentInstance.handleAddLine();

      expect(mockTemplateLineStore.createLine).toHaveBeenCalledWith(
        'template-123',
        dialogResult,
      );
    });

    it('should not call createLine when dialog is cancelled', async () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of(null) });

      const fixture = await createFixture();
      await fixture.componentInstance.handleAddLine();

      expect(mockTemplateLineStore.createLine).not.toHaveBeenCalled();
    });
  });

  describe('handleEditLine', () => {
    it('should do nothing when templateId is null', async () => {
      mockRoute.snapshot.paramMap.get.mockReturnValue(null);
      const fixture = await createFixture();

      await fixture.componentInstance.handleEditLine(mockLines[0]);

      expect(mockDialog.open).not.toHaveBeenCalled();
      expect(mockTemplateLineStore.updateLine).not.toHaveBeenCalled();
    });

    it('should do nothing when template is null', async () => {
      storeTemplateDetails.set(null);
      const fixture = await createFixture();

      await fixture.componentInstance.handleEditLine(mockLines[0]);

      expect(mockDialog.open).not.toHaveBeenCalled();
      expect(mockTemplateLineStore.updateLine).not.toHaveBeenCalled();
    });

    it('should open EditTemplateLineDialog with the existing line (edit mode)', async () => {
      const fixture = await createFixture();

      await fixture.componentInstance.handleEditLine(mockLines[0]);

      expect(mockDialog.open).toHaveBeenCalledOnce();
      const [dialogComponent, config] = mockDialog.open.mock.calls[0];
      expect(dialogComponent).toBe(EditTemplateLineDialog);
      expect(config.data.line).toEqual(mockLines[0]);
      expect(config.data.templateName).toBe('Mon Modèle');
    });

    it('should call updateLine with the line id when dialog returns a result', async () => {
      const dialogResult = {
        name: 'Updated',
        amount: 999,
        kind: 'income' as TransactionKind,
      };
      mockDialog.open.mockReturnValue({ afterClosed: () => of(dialogResult) });

      const fixture = await createFixture();
      await fixture.componentInstance.handleEditLine(mockLines[0]);

      expect(mockTemplateLineStore.updateLine).toHaveBeenCalledWith(
        'template-123',
        'line-1',
        dialogResult,
      );
    });

    it('should not call updateLine when dialog is cancelled', async () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of(null) });

      const fixture = await createFixture();
      await fixture.componentInstance.handleEditLine(mockLines[0]);

      expect(mockTemplateLineStore.updateLine).not.toHaveBeenCalled();
    });
  });

  describe('handleDeleteLine', () => {
    it('should do nothing when templateId is null', async () => {
      mockRoute.snapshot.paramMap.get.mockReturnValue(null);
      const fixture = await createFixture();

      await fixture.componentInstance.handleDeleteLine('line-1');

      expect(mockDialog.open).not.toHaveBeenCalled();
      expect(mockTemplateLineStore.deleteLine).not.toHaveBeenCalled();
    });

    it('should do nothing when the line is not found', async () => {
      const fixture = await createFixture();

      await fixture.componentInstance.handleDeleteLine('unknown-id');

      expect(mockDialog.open).not.toHaveBeenCalled();
      expect(mockTemplateLineStore.deleteLine).not.toHaveBeenCalled();
    });

    it('should open ConfirmationDialog with warn color', async () => {
      const fixture = await createFixture();

      await fixture.componentInstance.handleDeleteLine('line-1');

      expect(mockDialog.open).toHaveBeenCalledOnce();
      const [dialogComponent, config] = mockDialog.open.mock.calls[0];
      expect(dialogComponent).toBe(ConfirmationDialog);
      expect(config.data.title).toBe('Supprimer cette prévision ?');
      expect(config.data.message).toBe(
        'Cette prévision sera retirée du modèle — continuer ?',
      );
      expect(config.data.confirmColor).toBe('warn');
    });

    it('should call deleteLine when confirmation is accepted', async () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of(true) });

      const fixture = await createFixture();
      await fixture.componentInstance.handleDeleteLine('line-1');

      expect(mockTemplateLineStore.deleteLine).toHaveBeenCalledWith(
        'template-123',
        'line-1',
      );
    });

    it('should not call deleteLine when confirmation is cancelled', async () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of(false) });

      const fixture = await createFixture();
      await fixture.componentInstance.handleDeleteLine('line-1');

      expect(mockTemplateLineStore.deleteLine).not.toHaveBeenCalled();
    });
  });

  describe('deleteTemplate', () => {
    it('should not call the store when template is null', async () => {
      storeTemplateDetails.set(null);
      const fixture = await createFixture();

      await fixture.componentInstance.deleteTemplate();

      expect(
        mockBudgetTemplatesStore.confirmAndDeleteTemplate,
      ).not.toHaveBeenCalled();
    });

    it('should delegate to the store with templateId and name', async () => {
      const fixture = await createFixture();

      await fixture.componentInstance.deleteTemplate();

      expect(
        mockBudgetTemplatesStore.confirmAndDeleteTemplate,
      ).toHaveBeenCalledWith('template-123', 'Mon Modèle');
    });

    it('should navigate back when store returns "deleted"', async () => {
      mockBudgetTemplatesStore.confirmAndDeleteTemplate.mockResolvedValue(
        'deleted',
      );

      const fixture = await createFixture();
      const router = TestBed.inject(Router);
      vi.spyOn(router, 'navigate').mockResolvedValue(true);

      await fixture.componentInstance.deleteTemplate();

      expect(router.navigate).toHaveBeenCalledWith(['/', 'budget-templates']);
    });

    it('should not navigate when store returns "cancelled"', async () => {
      mockBudgetTemplatesStore.confirmAndDeleteTemplate.mockResolvedValue(
        'cancelled',
      );

      const fixture = await createFixture();
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      await fixture.componentInstance.deleteTemplate();

      expect(navigateSpy).not.toHaveBeenCalled();
    });

    it('should not navigate when store returns "cancelled-due-to-usage"', async () => {
      mockBudgetTemplatesStore.confirmAndDeleteTemplate.mockResolvedValue(
        'cancelled-due-to-usage',
      );

      const fixture = await createFixture();
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      await fixture.componentInstance.deleteTemplate();

      expect(navigateSpy).not.toHaveBeenCalled();
    });

    it('should not navigate when store returns "error"', async () => {
      mockBudgetTemplatesStore.confirmAndDeleteTemplate.mockResolvedValue(
        'error',
      );

      const fixture = await createFixture();
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      await fixture.componentInstance.deleteTemplate();

      expect(navigateSpy).not.toHaveBeenCalled();
    });
  });
});
