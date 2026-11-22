import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LOCALE_ID,
  provideZonelessChangeDetection,
  signal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, Subject, throwError } from 'rxjs';
import {
  ANALYTICS_EVENTS,
  type Asset,
  type ReconciliationContext,
  type UpdateReconciliationState,
} from 'pulpe-shared';

import {
  createMockBudgetLine,
  createMockTransaction,
} from '@app/testing/mock-factories';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { PostHogService } from '@core/analytics/posthog';
import { AssetApi } from '@core/asset/asset-api';
import { BudgetApi } from '@core/budget/budget-api';
import { ReconciliationApi } from '@core/reconciliation/reconciliation-api';
import { STORAGE_KEYS } from '@core/storage';
import { createMockDataCache } from '@core/testing';
import { UserSettingsStore } from '@core/user-settings';
import {
  ReconcileAccountsDialog,
  type RealizedPosition,
  type ReconcileAccountsDialogData,
  type ReconcileLedger,
} from './reconcile-accounts-dialog';
import { money } from './reconcile-compare-step';
import { ReconcileReasonsSheet } from './reconcile-reasons-sheet';
import type { AddAccountSheetData } from './reconcile-add-account-sheet';
import { ReconcileSheet } from './reconcile-sheet';

const REALIZED: RealizedPosition = { balance: 1499.99, available: 900 };
const BUDGET_ID = '66666666-6666-4666-8666-666666666666';
const CONTEXT: ReconciliationContext = {
  startingAmount: 0,
  hasCompletedComparison: true,
  priorCorrection: 0,
  priorItems: [],
};
const ASSURANCE = createMockBudgetLine({
  id: 'line-assurance',
  name: 'Assurance',
  amount: 100,
});
const ESSENCE = createMockTransaction({
  id: 'tx-essence',
  name: 'Essence',
  amount: 60,
  transactionDate: '2026-11-18T10:00:00+01:00',
});
const PRIVATE_ACCOUNT_NAME = 'Compte Zébulon';
const UBS_ID = '11111111-1111-4111-8111-111111111111';
const POSTFINANCE_ID = '22222222-2222-4222-8222-222222222222';

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function linkedAsset(overrides: Partial<Asset>): Asset {
  return {
    id: UBS_ID,
    categoryId: '33333333-3333-4333-8333-333333333333',
    name: 'Compte UBS',
    currency: 'CHF',
    direction: 'own',
    inPulpe: true,
    archivedAt: null,
    latestValue: 12000,
    latestRecordedAt: daysAgo(3),
    convertedValue: 12000,
    suggestion: null,
    ...overrides,
  };
}

const CATEGORY_ID = '33333333-3333-4333-8333-333333333333';
const REVOLUT_ID = '44444444-4444-4444-8444-444444444444';
const UBS = linkedAsset({});
const POSTFINANCE = linkedAsset({
  id: POSTFINANCE_ID,
  name: 'Compte PostFinance',
  latestValue: 1902.1,
  latestRecordedAt: daysAgo(1),
});
const REVOLUT = linkedAsset({
  id: REVOLUT_ID,
  name: 'Revolut',
  inPulpe: false,
});

async function setup(
  options: {
    realized?: RealizedPosition;
    ledger?: ReconcileLedger;
    checkItem?: ReconcileAccountsDialogData['checkItem'];
    /** What the server says about past comparisons; `'error'` refuses it. */
    context?: ReconciliationContext | 'error';
    recordAdjustment?: ReconcileAccountsDialogData['recordAdjustment'];
    /** My accounts in « Mon patrimoine »; left out, the feature is off. */
    accounts?: Asset[];
    recordSnapshots?: AssetApi['recordSnapshots$'];
    showGuide?: boolean;
    /** Names and sides remembered on this device. */
    free?: { name: string; side: 'own' | 'owe' }[];
    /** What the starting-amount editor or the reasons sheet answers. */
    sheetAnswer?: number | string;
    payDayOfMonth?: number;
  } = {},
) {
  localStorage.clear();
  if (options.free) {
    localStorage.setItem(
      STORAGE_KEYS.RECONCILE_FREE_ACCOUNTS,
      JSON.stringify({
        version: 1,
        data: options.free,
        updatedAt: new Date().toISOString(),
      }),
    );
  }
  const backdropClick = new Subject<MouseEvent>();
  const keydownEvents = new Subject<KeyboardEvent>();
  const dialogRef = {
    close: vi.fn(),
    backdropClick: () => backdropClick,
    keydownEvents: () => keydownEvents,
  };
  const postHog = { captureEvent: vi.fn() };
  const realized = signal<RealizedPosition | null>(
    options.realized ?? REALIZED,
  );
  const ledger = signal<ReconcileLedger | null>(
    options.ledger ?? { budgetLines: [], transactions: [] },
  );
  const data: ReconcileAccountsDialogData = {
    budgetId: BUDGET_ID,
    realized,
    ledger,
    checkItem: options.checkItem ?? vi.fn().mockResolvedValue(undefined),
    currency: signal('CHF'),
    recordAdjustment:
      options.recordAdjustment ?? vi.fn().mockResolvedValue(true),
    viewItemsToCheck: vi.fn(),
    netWorth: options.accounts
      ? {
          items: options.accounts,
          categories: [{ id: CATEGORY_ID, name: 'Comptes', total: 0 }],
        }
      : null,
    showGuide: options.showGuide ?? false,
  };
  const assetApi = {
    cache: createMockDataCache(),
    update$: vi.fn(() => of({ success: true as const, data: UBS })),
    create$: vi.fn(() => of({ success: true as const, data: UBS })),
    createCategory$: vi.fn(),
    recordSnapshots$: vi.fn(
      options.recordSnapshots ??
        (() =>
          of({
            success: true as const,
            data: { recordedAt: '2026-11-03T10:00:00.000Z' },
          })),
    ),
  };
  const reconciliationApi = {
    getContext$: vi.fn(() =>
      options.context === 'error'
        ? throwError(() => new Error('offline'))
        : of({ success: true as const, data: options.context ?? CONTEXT }),
    ),
    // Answers like the server: the stored state once the patch applies.
    updateState$: vi.fn((patch: UpdateReconciliationState) =>
      of({
        success: true as const,
        data: {
          startingAmount:
            patch.startingAmount ??
            (typeof options.context === 'object' ? options.context : CONTEXT)
              .startingAmount,
          hasCompletedComparison: true,
        },
      }),
    ),
  };
  const sheet = {
    open: vi.fn(() => Promise.resolve(options.sheetAnswer)),
  };
  const budgetApi = {
    cache: createMockDataCache(),
    toggleTransactionCheck$: vi.fn(() => of({ success: true as const })),
    toggleBudgetLineCheck$: vi.fn(() => of({ success: true as const })),
  };
  const snackBar = { open: vi.fn() };

  TestBed.configureTestingModule({
    imports: [ReconcileAccountsDialog],
    providers: [
      provideZonelessChangeDetection(),
      ...provideTranslocoForTest(),
      { provide: LOCALE_ID, useValue: 'fr-CH' },
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: PostHogService, useValue: postHog },
      { provide: AssetApi, useValue: assetApi },
      { provide: ReconciliationApi, useValue: reconciliationApi },
      { provide: BudgetApi, useValue: budgetApi },
      { provide: MatSnackBar, useValue: snackBar },
      { provide: ReconcileSheet, useValue: sheet },
      {
        provide: UserSettingsStore,
        useValue: {
          payDayOfMonth: signal(options.payDayOfMonth ?? null),
          currency: signal('CHF'),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(ReconcileAccountsDialog);
  fixture.detectChanges();
  await fixture.whenStable();
  const host = fixture.nativeElement as HTMLElement;

  // A macrotask first, so a settled write has run its continuation.
  const render = async () => {
    await new Promise((settle) => setTimeout(settle));
    fixture.detectChanges();
    await fixture.whenStable();
  };
  const byTestId = <T extends HTMLElement = HTMLElement>(id: string) =>
    host.querySelector<T>(`[data-testid="${id}"]`);
  const allByTestId = <T extends HTMLElement = HTMLElement>(id: string) =>
    Array.from(host.querySelectorAll<T>(`[data-testid="${id}"]`));
  const type = async (input: HTMLElement | null | undefined, value: string) => {
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('input not rendered');
    }
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await render();
  };
  const click = async (element: HTMLElement | null | undefined) => {
    if (!element) throw new Error('element not rendered');
    element.click();
    await render();
  };

  return {
    fixture,
    host,
    dialogRef,
    data,
    realized,
    ledger,
    postHog,
    assetApi,
    reconciliationApi,
    budgetApi,
    snackBar,
    sheet,
    backdropClick,
    keydownEvents,
    render,
    byTestId,
    allByTestId,
    type,
    click,
  };
}

async function compare(
  view: Awaited<ReturnType<typeof setup>>,
  ...amounts: string[]
) {
  for (const [index, amount] of amounts.entries()) {
    await view.type(view.allByTestId('reconcile-amount-input')[index], amount);
  }
  await view.click(view.byTestId('reconcile-next-button'));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => (resolve = settle));
  return { promise, resolve };
}

// What session replay serializes: the attributes and text of every element
// outside a `ph-no-capture` subtree, which posthog-js blocks whole.
function recordedValues(host: HTMLElement): string[] {
  return [host, ...Array.from(host.querySelectorAll('*'))]
    .filter((element) => !element.closest('.ph-no-capture'))
    .flatMap((element) => [
      ...Array.from(element.attributes, (attribute) => attribute.value),
      ...Array.from(element.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent ?? ''),
    ]);
}

describe('ReconcileAccountsDialog', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  describe('the guide', () => {
    it('should start on step 1 when the guide was already seen', async () => {
      const view = await setup();

      expect(view.byTestId('reconcile-guide')).toBeNull();
      expect(view.byTestId('reconcile-accounts-step')).not.toBeNull();
      expect(view.host.classList).not.toContain('guide-open');
    });

    it('should start on the guide the first time, then land on step 1 from « Comparer maintenant »', async () => {
      const view = await setup({ showGuide: true });

      expect(view.byTestId('reconcile-guide')).not.toBeNull();
      expect(view.host.classList).toContain('guide-open');
      expect(view.postHog.captureEvent).toHaveBeenCalledWith(
        ANALYTICS_EVENTS.ACCOUNT_RECONCILIATION_GUIDE_VIEWED,
        { source: 'auto' },
      );

      await view.click(view.byTestId('reconcile-guide-primary'));
      await view.click(view.byTestId('reconcile-guide-primary'));
      await view.click(view.byTestId('reconcile-guide-primary'));

      expect(view.byTestId('reconcile-guide')).toBeNull();
      expect(view.host.classList).not.toContain('guide-open');
      expect(view.byTestId('reconcile-accounts-step')).not.toBeNull();
    });

    it('should not leave the replayed guide on a repeated Escape keydown', async () => {
      const view = await setup();
      await view.click(view.byTestId('reconcile-guide-help-button'));

      view.keydownEvents.next(
        new KeyboardEvent('keydown', { key: 'Escape', repeat: true }),
      );
      await view.render();

      expect(view.byTestId('reconcile-guide')).not.toBeNull();
      expect(view.dialogRef.close).not.toHaveBeenCalled();
    });

    it('should replay from « ? » on the step it came from, typed values kept', async () => {
      const view = await setup();
      await view.type(view.byTestId('reconcile-amount-input'), '890');
      await view.click(view.byTestId('reconcile-next-button'));
      expect(view.byTestId('reconcile-compare-step')).not.toBeNull();

      await view.click(view.byTestId('reconcile-guide-help-button'));
      expect(view.postHog.captureEvent).toHaveBeenCalledWith(
        ANALYTICS_EVENTS.ACCOUNT_RECONCILIATION_GUIDE_VIEWED,
        { source: 'help' },
      );
      await view.click(view.byTestId('reconcile-guide-skip'));

      expect(view.byTestId('reconcile-guide')).toBeNull();
      expect(view.byTestId('reconcile-compare-step')).not.toBeNull();
      await view.click(view.byTestId('reconcile-back-button'));
      expect(
        view.byTestId<HTMLInputElement>('reconcile-amount-input')?.value,
      ).toBe('890');
      expect(view.dialogRef.close).not.toHaveBeenCalled();
    });

    it('should go back to the step, values kept, on Escape or backdrop when replayed from « ? »', async () => {
      const view = await setup();
      await view.type(view.byTestId('reconcile-amount-input'), '890');
      await view.click(view.byTestId('reconcile-guide-help-button'));

      view.keydownEvents.next(new KeyboardEvent('keydown', { key: 'Escape' }));
      await view.render();
      expect(view.byTestId('reconcile-guide')).toBeNull();
      expect(view.dialogRef.close).not.toHaveBeenCalled();

      await view.click(view.byTestId('reconcile-guide-help-button'));
      view.backdropClick.next(new MouseEvent('click'));
      await view.render();
      expect(view.byTestId('reconcile-guide')).toBeNull();
      expect(view.dialogRef.close).not.toHaveBeenCalled();
      expect(
        view.byTestId<HTMLInputElement>('reconcile-amount-input')?.value,
      ).toBe('890');
    });

    it('should close the whole dialog on Escape when the guide opened by itself', async () => {
      const view = await setup({ showGuide: true });

      view.keydownEvents.next(new KeyboardEvent('keydown', { key: 'Escape' }));
      await view.render();

      expect(view.dialogRef.close).toHaveBeenCalledTimes(1);
    });

    it('should name the dialog « Comparer avec mes comptes » and the help button for screen readers', async () => {
      const view = await setup();

      expect(view.host.querySelector('h2')?.textContent?.trim()).toBe(
        'Comparer avec mes comptes',
      );
      expect(
        view
          .byTestId('reconcile-guide-help-button')
          ?.getAttribute('aria-label'),
      ).toBe('Revoir le guide');
    });
  });

  describe('step 1 — the accounts', () => {
    it('should have no way back, only the close button, and ask « Étape 1 sur 2 »', async () => {
      const view = await setup();

      expect(view.byTestId('reconcile-back-button')).toBeNull();
      expect(view.byTestId('reconcile-step-heading')?.textContent).toContain(
        "Combien as-tu aujourd'hui ?",
      );
      expect(view.byTestId('reconcile-accounts-step')?.textContent).toContain(
        'Étape 1 sur 2',
      );
      await view.click(view.byTestId('reconcile-close-button'));
      expect(view.dialogRef.close).toHaveBeenCalledTimes(1);
      expect(view.data.recordAdjustment).not.toHaveBeenCalled();
    });

    it('should start with a single empty amount and keep « Comparer » disabled until it reads', async () => {
      const view = await setup();

      expect(view.allByTestId('reconcile-amount-input')).toHaveLength(1);
      const next = view.byTestId<HTMLButtonElement>('reconcile-next-button');
      expect(next?.textContent).toContain('Comparer');
      expect(next?.disabled).toBe(true);

      await view.type(view.byTestId('reconcile-amount-input'), '12.');
      expect(next?.disabled).toBe(true);

      await view.type(view.byTestId('reconcile-amount-input'), '1250.40');
      expect(next?.disabled).toBe(false);
    });

    it('should total what I have minus what I owe, and say so only with a « Je dois » row', async () => {
      const view = await setup({
        free: [
          { name: 'Revolut', side: 'own' },
          { name: 'Carte', side: 'owe' },
        ],
      });
      expect(view.byTestId('reconcile-total-breakdown')).toBeNull();
      await view.type(view.allByTestId('reconcile-amount-input')[0], '1000');
      await view.type(view.allByTestId('reconcile-amount-input')[1], '800');

      expect(view.byTestId('reconcile-total')?.textContent).toContain('200.00');
      expect(
        view
          .byTestId('reconcile-total-breakdown')
          ?.textContent?.replace(/\s+/g, ' '),
      ).toContain('1’000.00 CHF − 800.00 CHF que tu dois');
      // « Masquer les montants » blurs the two amounts, never « que tu dois ».
      const breakdown = view.byTestId('reconcile-total-breakdown');
      expect(breakdown?.closest('.ph-no-capture')).toBeNull();
      expect(
        Array.from(
          breakdown?.querySelectorAll('.ph-no-capture') ?? [],
          (element) => element.textContent,
        ),
      ).toEqual([money(1000, 'CHF'), money(800, 'CHF')]);
    });

    it('should count each « Je dois » row against the total as a magnitude', async () => {
      const view = await setup({
        free: [
          { name: 'Revolut', side: 'own' },
          { name: 'Carte', side: 'owe' },
          { name: 'Klarna', side: 'owe' },
        ],
      });
      await view.type(view.allByTestId('reconcile-amount-input')[0], '3000');
      await view.type(view.allByTestId('reconcile-amount-input')[1], '800');
      await view.type(view.allByTestId('reconcile-amount-input')[2], '-200');

      expect(view.byTestId('reconcile-total')?.textContent).toContain(
        '2’000.00',
      );
      expect(
        view
          .byTestId('reconcile-total-breakdown')
          ?.textContent?.replace(/\s+/g, ' '),
      ).toContain('3’000.00 CHF − 1’000.00 CHF que tu dois');
    });

    it('should show the card help until a « Je dois » row exists, and focus its name', async () => {
      const view = await setup();
      expect(view.byTestId('reconcile-card-help')).not.toBeNull();

      await view.click(view.byTestId('reconcile-add-owe-help-button'));

      expect(view.byTestId('reconcile-card-help')).toBeNull();
      const names = view.allByTestId('reconcile-label-input');
      expect(names).toHaveLength(2);
      expect(document.activeElement).toBe(names[1]);
      expect(view.allByTestId('reconcile-side-owe-radio')[1]).toHaveProperty(
        'checked',
        true,
      );
    });

    it('should remove a row through a button that names it, leaving Mon patrimoine alone', async () => {
      const view = await setup({
        accounts: [UBS],
        free: [{ name: 'Revolut', side: 'own' }],
      });
      expect(
        view
          .allByTestId('reconcile-remove-button')
          .map((button) => button.getAttribute('aria-label')),
      ).toEqual([
        'Retirer Compte UBS de la liste',
        'Retirer Revolut de la liste',
      ]);

      await view.click(view.allByTestId('reconcile-remove-button')[0]);

      expect(view.allByTestId('reconcile-account-row')).toHaveLength(1);
      expect(view.assetApi.update$).not.toHaveBeenCalled();
      expect(view.assetApi.recordSnapshots$).not.toHaveBeenCalled();
    });

    it('should keep account names out of everything session replay records', async () => {
      const view = await setup({
        accounts: [UBS],
        free: [{ name: PRIVATE_ACCOUNT_NAME, side: 'own' }],
      });

      expect(
        view.allByTestId('reconcile-label-input')[0].closest('.ph-no-capture'),
      ).not.toBeNull();
      expect(
        recordedValues(view.host).filter(
          (value) =>
            value.includes(PRIVATE_ACCOUNT_NAME) ||
            value.includes('Compte UBS'),
        ),
      ).toEqual([]);
    });

    it('should refuse an unreadable amount and keep the total back', async () => {
      const view = await setup();
      const amount = view.byTestId<HTMLInputElement>('reconcile-amount-input');
      await view.type(amount, '-80');
      expect(view.byTestId('reconcile-total')?.textContent).toContain('-80.00');

      await view.type(amount, '12abc');
      amount?.dispatchEvent(new Event('blur'));
      await view.render();

      expect(view.host.textContent).toContain(
        'Saisis un montant comme 1250.40 ou -80',
      );
      expect(view.byTestId('reconcile-total')?.textContent).not.toContain(
        '-80.00',
      );
      expect(
        view.byTestId<HTMLButtonElement>('reconcile-next-button')?.disabled,
      ).toBe(true);
    });

    it('should remember the names and sides of free rows on « Comparer », never their amounts', async () => {
      const view = await setup({ free: [{ name: 'Revolut', side: 'own' }] });
      await view.type(view.allByTestId('reconcile-amount-input')[0], '1000');

      await view.click(view.byTestId('reconcile-next-button'));

      const stored = localStorage.getItem(STORAGE_KEYS.RECONCILE_FREE_ACCOUNTS);
      expect(stored).toContain('Revolut');
      expect(stored).not.toContain('1000');
    });

    it('should forget a removed free row at the next « Comparer », and keep nothing when step 1 is abandoned', async () => {
      const view = await setup({
        free: [
          { name: 'Revolut', side: 'own' },
          { name: 'Klarna', side: 'owe' },
        ],
      });
      await view.type(view.allByTestId('reconcile-amount-input')[0], '10');
      await view.click(view.allByTestId('reconcile-remove-button')[1]);
      await view.click(view.byTestId('reconcile-close-button'));
      expect(
        localStorage.getItem(STORAGE_KEYS.RECONCILE_FREE_ACCOUNTS),
      ).toContain('Klarna');

      await view.click(view.byTestId('reconcile-next-button'));

      const stored = localStorage.getItem(STORAGE_KEYS.RECONCILE_FREE_ACCOUNTS);
      expect(stored).toContain('Revolut');
      expect(stored).not.toContain('Klarna');
    });

    it('should open on the remembered free rows with empty amounts', async () => {
      const view = await setup({
        free: [
          { name: 'Revolut', side: 'own' },
          { name: 'Klarna', side: 'owe' },
        ],
      });

      expect(
        view
          .allByTestId<HTMLInputElement>('reconcile-label-input')
          .map((input) => input.value),
      ).toEqual(['Revolut', 'Klarna']);
      expect(
        view
          .allByTestId<HTMLInputElement>('reconcile-amount-input')
          .map((input) => input.value),
      ).toEqual(['', '']);
    });
  });

  describe('step 2 — the comparison', () => {
    it('should read the context of the budget and title the gap', async () => {
      const view = await setup({ realized: { ...REALIZED, balance: 1050 } });
      await compare(view, '950');

      expect(view.reconciliationApi.getContext$).toHaveBeenCalledWith(
        BUDGET_ID,
      );
      expect(view.byTestId('reconcile-step-heading')?.textContent).toContain(
        'Tes comptes ont 100.00 CHF de moins que Pulpe',
      );
      expect(view.byTestId('reconcile-close-button')).toBeNull();
    });

    it('should move focus to the heading of each step it reaches, scroll reset', async () => {
      const view = await setup();
      const content = view.host.querySelector(
        'mat-dialog-content',
      ) as HTMLElement;
      const scrollTo = vi.fn();
      content.scrollTo = scrollTo;
      await compare(view, '1500');

      expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
      expect(document.activeElement).toBe(
        view.byTestId('reconcile-step-heading'),
      );

      await view.click(view.byTestId('reconcile-back-button'));

      expect(document.activeElement?.textContent).toContain(
        "Combien as-tu aujourd'hui ?",
      );
    });

    it('should keep the typed accounts when going back to step 1', async () => {
      const view = await setup({ free: [{ name: 'Joint', side: 'own' }] });
      await compare(view, '1500');

      await view.click(view.byTestId('reconcile-back-button'));

      expect(
        view.byTestId<HTMLInputElement>('reconcile-amount-input')?.value,
      ).toBe('1500');
      expect(
        view.byTestId<HTMLInputElement>('reconcile-label-input')?.value,
      ).toBe('Joint');
      expect(view.dialogRef.close).not.toHaveBeenCalled();
    });

    it('should show an error with « Réessayer » and nothing to write when the context fails', async () => {
      const view = await setup({ context: 'error' });
      await compare(view, '1500');

      expect(view.byTestId('reconcile-context-error')?.textContent).toContain(
        "Impossible de comparer pour l'instant.",
      );
      expect(view.byTestId('reconcile-record-button')).toBeNull();
      expect(view.byTestId('reconcile-finish-button')).toBeNull();
      expect(view.byTestId('reconcile-leave-button')).toBeNull();

      const answer = new Subject<{ success: true; data: typeof CONTEXT }>();
      view.reconciliationApi.getContext$.mockReturnValue(answer);
      // Not `click()`: the read still out keeps the fixture unstable.
      view.byTestId('reconcile-retry-button')?.click();
      view.fixture.detectChanges();
      expect(view.byTestId('reconcile-context-error')).toBeNull();

      answer.next({ success: true, data: CONTEXT });
      answer.complete();
      await view.render();

      expect(view.byTestId('reconcile-record-button')).not.toBeNull();
      expect(document.activeElement).toBe(
        view.byTestId('reconcile-step-heading'),
      );
      await view.click(view.byTestId('reconcile-back-button'));
      expect(
        view.byTestId<HTMLInputElement>('reconcile-amount-input')?.value,
      ).toBe('1500');
      expect(view.data.recordAdjustment).not.toHaveBeenCalled();
    });
  });

  describe('suggestions', () => {
    it('should check a movement of the month through the page, then strike the old figure', async () => {
      const view = await setup({
        realized: { ...REALIZED, balance: 1050 },
        ledger: { budgetLines: [ASSURANCE], transactions: [ESSENCE] },
      });
      await compare(view, '950');
      expect(
        view
          .allByTestId('reconcile-suggestion')
          .map((row) => row.textContent?.replace(/\s+/g, ' ').trim()),
      ).toEqual([
        expect.stringContaining('Assurance'),
        expect.stringContaining('Essence'),
      ]);

      await view.click(view.allByTestId('reconcile-suggestion')[1]);
      expect(view.data.checkItem).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'transaction', id: 'tx-essence' }),
      );
      // The page applies the check: its figures move.
      view.realized.set({ ...REALIZED, balance: 990 });
      view.ledger.set({
        budgetLines: [ASSURANCE],
        transactions: [{ ...ESSENCE, checkedAt: '2026-11-20T10:00:00Z' }],
      });
      await view.render();

      expect(view.byTestId('reconcile-compared-before')?.textContent).toBe(
        '1’050.00 CHF',
      );
      expect(view.byTestId('reconcile-found')?.textContent).toContain(
        '60.00 CHF trouvés',
      );
      expect(view.byTestId('reconcile-step-heading')?.textContent).toContain(
        '40.00 CHF de moins',
      );
    });

    it('should keep the struck figure but drop « trouvés » when the starting amount changes', async () => {
      const view = await setup({
        realized: { ...REALIZED, balance: 1050 },
        ledger: { budgetLines: [ASSURANCE], transactions: [ESSENCE] },
        context: { ...CONTEXT, startingAmount: 3000 },
      });
      await compare(view, '3950');
      await view.click(view.allByTestId('reconcile-suggestion')[1]);
      view.realized.set({ ...REALIZED, balance: 990 });
      view.ledger.set({
        budgetLines: [ASSURANCE],
        transactions: [{ ...ESSENCE, checkedAt: '2026-11-20T10:00:00Z' }],
      });
      await view.render();
      expect(view.byTestId('reconcile-found')).not.toBeNull();

      view.sheet.open.mockResolvedValueOnce(2980);
      await view.click(view.byTestId('reconcile-starting-amount-button'));
      await view.render();

      expect(view.reconciliationApi.updateState$).toHaveBeenCalledWith({
        startingAmount: 2980,
      });
      expect(view.byTestId('reconcile-compared-before')?.textContent).toBe(
        money(1050, 'CHF'),
      );
      expect(view.byTestId('reconcile-found')).toBeNull();
    });

    // The API toggles: a second press while the first is out would uncheck the item.
    it('should make one check when a suggestion is pressed twice while its check is out', async () => {
      const view = await setup({
        realized: { ...REALIZED, balance: 1050 },
        ledger: { budgetLines: [ASSURANCE], transactions: [ESSENCE] },
        checkItem: vi.fn(() => new Promise<void>(() => undefined)),
      });
      await compare(view, '950');

      await view.click(view.allByTestId('reconcile-suggestion')[1]);
      await view.click(view.allByTestId('reconcile-suggestion')[1]);

      expect(view.data.checkItem).toHaveBeenCalledTimes(1);
    });

    it('should check a previous month item through the API and read the context again', async () => {
      const prior: ReconciliationContext = {
        ...CONTEXT,
        priorItems: [
          {
            id: '12121212-1212-4121-8121-121212121212',
            source: 'budgetLine',
            budgetId: '13131313-1313-4131-8131-131313131313',
            name: 'Pharmacie',
            amount: 40,
            kind: 'expense',
            monthsAgo: 1,
            effect: -40,
          },
        ],
      };
      const view = await setup({
        realized: { ...REALIZED, balance: 1050 },
        context: prior,
      });
      await compare(view, '1010');
      expect(view.byTestId('reconcile-suggestion-detail')?.textContent).toBe(
        'Mois dernier',
      );
      view.reconciliationApi.getContext$.mockReturnValue(
        of({
          success: true as const,
          data: { ...CONTEXT, priorCorrection: -40 },
        }),
      );

      await view.click(view.byTestId('reconcile-suggestion'));

      expect(view.budgetApi.toggleBudgetLineCheck$).toHaveBeenCalledWith(
        prior.priorItems[0].id,
      );
      expect(view.data.checkItem).not.toHaveBeenCalled();
      expect(view.reconciliationApi.getContext$).toHaveBeenCalledTimes(2);
      expect(view.byTestId('reconcile-step-heading')?.textContent).toContain(
        'Pareil des deux côtés',
      );
    });

    // Pulpe 1 050.00 + 40.00 left unchecked before, the accounts 940.00: two
    // checks of 60.00 and 40.00 leave 50.00 to find.
    it('should keep the figure from before the first check, and add up what each check found', async () => {
      const pharmacie = {
        ...ESSENCE,
        id: 'tx-pharmacie',
        name: 'Pharmacie',
        amount: 40,
      };
      const view = await setup({
        realized: { ...REALIZED, balance: 1050 },
        ledger: { budgetLines: [], transactions: [ESSENCE, pharmacie] },
        context: { ...CONTEXT, priorCorrection: 40 },
      });
      await compare(view, '940');
      const checkRow = async (name: string) =>
        view.click(
          view
            .allByTestId('reconcile-suggestion')
            .find((row) => row.textContent?.includes(name)),
        );

      await checkRow('Essence');
      view.realized.set({ ...REALIZED, balance: 990 });
      view.ledger.set({
        budgetLines: [],
        transactions: [
          { ...ESSENCE, checkedAt: '2026-11-20T10:00:00Z' },
          pharmacie,
        ],
      });
      await view.render();
      await checkRow('Pharmacie');
      view.realized.set({ ...REALIZED, balance: 950 });
      view.ledger.set({
        budgetLines: [],
        transactions: [
          { ...ESSENCE, checkedAt: '2026-11-20T10:00:00Z' },
          { ...pharmacie, checkedAt: '2026-11-20T10:05:00Z' },
        ],
      });
      await view.render();

      expect(view.data.checkItem).toHaveBeenCalledTimes(2);
      expect(view.byTestId('reconcile-step-heading')?.textContent).toContain(
        `${money(50, 'CHF')} de moins`,
      );
      expect(view.byTestId('reconcile-compared')?.textContent).toBe(
        money(950, 'CHF'),
      );
      expect(view.byTestId('reconcile-compared-before')?.textContent).toBe(
        money(1050, 'CHF'),
      );
      expect(view.byTestId('reconcile-found')?.textContent).toContain(
        `${money(100, 'CHF')} trouvés`,
      );
      expect(
        view.byTestId('reconcile-prior-correction')?.textContent?.trim(),
      ).toBe(`+${money(40, 'CHF')} pas coché les mois d'avant`);
    });

    // The month's balance did not move: only the « pas coché » line did.
    it('should leave the figure unstruck when a previous month item is checked', async () => {
      const view = await setup({
        realized: { ...REALIZED, balance: 1050 },
        context: {
          ...CONTEXT,
          priorItems: [
            {
              id: '12121212-1212-4121-8121-121212121212',
              source: 'budgetLine',
              budgetId: '13131313-1313-4131-8131-131313131313',
              name: 'Pharmacie',
              amount: 40,
              kind: 'expense',
              monthsAgo: 1,
              effect: -40,
            },
          ],
        },
      });
      await compare(view, '1000');
      expect(view.byTestId('reconcile-prior-correction')).toBeNull();
      view.reconciliationApi.getContext$.mockReturnValue(
        of({
          success: true as const,
          data: { ...CONTEXT, priorCorrection: -40 },
        }),
      );

      await view.click(view.byTestId('reconcile-suggestion'));

      expect(view.byTestId('reconcile-compared-before')).toBeNull();
      expect(view.byTestId('reconcile-compared')?.textContent).toBe(
        money(1050, 'CHF'),
      );
      expect(
        view.byTestId('reconcile-prior-correction')?.textContent?.trim(),
      ).toBe(`−${money(40, 'CHF')} pas coché les mois d'avant`);
      expect(view.byTestId('reconcile-found')?.textContent).toContain(
        `${money(40, 'CHF')} trouvés`,
      );
    });

    it('should hand the focus to the heading when reading the context again fails after a check', async () => {
      const prior: ReconciliationContext = {
        ...CONTEXT,
        priorItems: [
          {
            id: '12121212-1212-4121-8121-121212121212',
            source: 'transaction',
            budgetId: '13131313-1313-4131-8131-131313131313',
            name: 'Pharmacie',
            amount: 40,
            kind: 'expense',
            monthsAgo: 1,
            effect: -40,
          },
        ],
      };
      const view = await setup({
        realized: { ...REALIZED, balance: 1050 },
        context: prior,
      });
      await compare(view, '1010');
      view.reconciliationApi.getContext$
        .mockReturnValueOnce(throwError(() => new Error('offline')))
        .mockReturnValue(
          of({
            success: true as const,
            data: { ...CONTEXT, priorCorrection: -40 },
          }),
        );

      await view.click(view.byTestId('reconcile-suggestion'));

      expect(view.reconciliationApi.getContext$).toHaveBeenCalledTimes(3);
      expect(document.activeElement).toBe(
        view.byTestId('reconcile-step-heading'),
      );
    });

    it('should hand the focus to the error heading when the context stays unreadable after a check', async () => {
      const prior: ReconciliationContext = {
        ...CONTEXT,
        priorItems: [
          {
            id: '12121212-1212-4121-8121-121212121212',
            source: 'transaction',
            budgetId: '13131313-1313-4131-8131-131313131313',
            name: 'Pharmacie',
            amount: 40,
            kind: 'expense',
            monthsAgo: 1,
            effect: -40,
          },
        ],
      };
      const view = await setup({
        realized: { ...REALIZED, balance: 1050 },
        context: prior,
      });
      await compare(view, '1010');
      view.reconciliationApi.getContext$.mockReturnValue(
        throwError(() => new Error('offline')),
      );
      view.byTestId('reconcile-suggestion')?.focus();

      await view.click(view.byTestId('reconcile-suggestion'));

      const error = view.byTestId('reconcile-context-error');
      expect(error).not.toBeNull();
      expect(document.activeElement).toBe(
        error?.querySelector('.step-heading'),
      );
      expect(view.byTestId('reconcile-retry-button')).not.toBeNull();
    });

    it('should read the context again after a failed previous month check, so a check that landed is not offered again', async () => {
      const prior: ReconciliationContext = {
        ...CONTEXT,
        priorItems: [
          {
            id: '12121212-1212-4121-8121-121212121212',
            source: 'transaction',
            budgetId: '13131313-1313-4131-8131-131313131313',
            name: 'Pharmacie',
            amount: 40,
            kind: 'expense',
            monthsAgo: 1,
            effect: -40,
          },
        ],
      };
      const view = await setup({
        realized: { ...REALIZED, balance: 1050 },
        context: prior,
      });
      await compare(view, '1010');
      view.budgetApi.toggleTransactionCheck$.mockReturnValue(
        throwError(() => new Error('response lost')),
      );
      view.reconciliationApi.getContext$.mockReturnValue(
        of({
          success: true as const,
          data: { ...CONTEXT, priorCorrection: -40 },
        }),
      );

      await view.click(view.byTestId('reconcile-suggestion'));

      expect(view.snackBar.open).toHaveBeenCalledWith(
        expect.any(String),
        'Fermer',
        expect.objectContaining({ verticalPosition: 'top' }),
      );
      expect(view.reconciliationApi.getContext$).toHaveBeenCalledTimes(2);
      expect(view.byTestId('reconcile-suggestion')).toBeNull();
      expect(view.byTestId('reconcile-step-heading')?.textContent).toContain(
        'Pareil des deux côtés',
      );
    });

    it('should open the items still to check', async () => {
      const view = await setup({
        realized: { ...REALIZED, balance: 1050 },
        ledger: {
          budgetLines: [ASSURANCE, { ...ASSURANCE, id: 'line-2', amount: 200 }],
          transactions: [ESSENCE, { ...ESSENCE, id: 'tx-2', amount: 250 }],
        },
      });
      await compare(view, '950');

      const link = view.byTestId('reconcile-view-items-button');
      expect(link?.textContent).toContain('Voir les 2 autres à cocher');
      await view.click(link);
      expect(view.dialogRef.close).toHaveBeenCalledTimes(1);
      expect(view.data.viewItemsToCheck).toHaveBeenCalledTimes(1);
    });

    it('should complete with nothing noted on « Laisser comme ça »', async () => {
      const view = await setup({
        realized: { ...REALIZED, balance: 1050 },
        ledger: { budgetLines: [], transactions: [ESSENCE] },
      });
      await compare(view, '950');

      await view.click(view.byTestId('reconcile-leave-button'));

      expect(view.postHog.captureEvent).toHaveBeenCalledWith(
        'account_reconciliation_completed',
        { adjustment_kind: 'none' },
      );
      expect(view.reconciliationApi.updateState$).toHaveBeenCalledWith({
        completed: true,
      });
      expect(view.data.recordAdjustment).not.toHaveBeenCalled();
      expect(view.dialogRef.close).toHaveBeenCalledTimes(1);
    });

    it('should speak of the card and remove the « Je dois » rows from the comparison', async () => {
      const view = await setup({
        realized: { ...REALIZED, balance: 1050 },
        ledger: { budgetLines: [], transactions: [ESSENCE] },
        free: [
          { name: 'UBS', side: 'own' },
          { name: 'Visa', side: 'owe' },
        ],
      });
      await compare(view, '1750', '800');

      expect(view.byTestId('reconcile-compare-step')?.textContent).toContain(
        'Coche les achats faits avec ta carte.',
      );
      // From the keyboard: the button holds the focus when it is pressed.
      view.byTestId('reconcile-remove-owe-button')?.focus();
      await view.click(view.byTestId('reconcile-remove-owe-button'));

      expect(view.byTestId('reconcile-step-heading')?.textContent).toContain(
        'Tes comptes ont 700.00 CHF de plus que Pulpe',
      );
      // The button left with the focus: the heading takes it.
      expect(document.activeElement).toBe(
        view.byTestId('reconcile-step-heading'),
      );
      await view.click(view.byTestId('reconcile-back-button'));
      expect(view.allByTestId('reconcile-amount-input')).toHaveLength(1);
    });

    // Owing 0 still offers it: the card row is what makes the lead speak of the card.
    it.each(['200', '0'])(
      'should offer to remove the card when it is the only account (owing %s), then go back to the balances',
      async (owed) => {
        const view = await setup({
          realized: { ...REALIZED, balance: 1050 },
          ledger: { budgetLines: [], transactions: [ESSENCE] },
          free: [{ name: 'Visa', side: 'owe' }],
        });
        await compare(view, owed);

        await view.click(view.byTestId('reconcile-remove-owe-button'));

        expect(view.byTestId('reconcile-compare-step')).toBeNull();
        expect(view.byTestId('reconcile-accounts-step')).not.toBeNull();
      },
    );

    it('should drop what was found but keep the struck figure once removing « Je dois » moves the accounts total', async () => {
      const pharmacie = { ...ESSENCE, id: 'tx-pharmacie', amount: 40 };
      const view = await setup({
        realized: { ...REALIZED, balance: 1050 },
        ledger: { budgetLines: [], transactions: [ESSENCE, pharmacie] },
        free: [
          { name: 'UBS', side: 'own' },
          { name: 'Visa', side: 'owe' },
        ],
      });
      await compare(view, '1750', '800');
      await view.click(
        view
          .allByTestId('reconcile-suggestion')
          .find((row) => row.textContent?.includes('Essence')),
      );
      view.realized.set({ ...REALIZED, balance: 990 });
      view.ledger.set({
        budgetLines: [],
        transactions: [
          { ...ESSENCE, checkedAt: '2026-11-20T10:00:00Z' },
          pharmacie,
        ],
      });
      await view.render();
      expect(view.byTestId('reconcile-found')).not.toBeNull();

      await view.click(view.byTestId('reconcile-remove-owe-button'));

      expect(view.byTestId('reconcile-step-heading')?.textContent).toContain(
        'Tes comptes ont 760.00\u00a0CHF de plus que Pulpe',
      );
      expect(view.byTestId('reconcile-found')).toBeNull();
      // The checked balance did move: its old figure stays struck.
      expect(view.byTestId('reconcile-compared-before')?.textContent).toBe(
        money(1050, 'CHF'),
      );
    });
  });

  describe('gaps below and the noted entry', () => {
    // A saving is no expense: the button stops naming one, the card lead stays.
    it.each([
      { owe: false, lead: "Coche les dépenses et l'épargne" },
      { owe: true, lead: 'Coche les achats faits avec ta carte.' },
    ])(
      'should offer « Rien ne correspond » when a saving is suggested (« Je dois » row: $owe)',
      async ({ owe, lead }) => {
        const view = await setup({
          realized: { ...REALIZED, balance: 1050 },
          ledger: {
            budgetLines: [
              createMockBudgetLine({
                id: 'line-epargne',
                name: 'Épargne',
                amount: 100,
                kind: 'saving',
              }),
            ],
            transactions: [],
          },
          free: owe
            ? [
                { name: 'UBS', side: 'own' },
                { name: 'Visa', side: 'owe' },
              ]
            : undefined,
        });
        await compare(view, ...(owe ? ['1750', '800'] : ['950']));

        expect(view.byTestId('reconcile-compare-step')?.textContent).toContain(
          lead,
        );
        expect(
          view.byTestId('reconcile-dismiss-button')?.textContent?.trim(),
        ).toBe('Rien ne correspond');
        await view.click(view.byTestId('reconcile-dismiss-button'));
        expect(view.byTestId('reconcile-large-gap')).not.toBeNull();
      },
    );

    it('should speak of incomes when the accounts hold more, down to the small gap example', async () => {
      const view = await setup({
        realized: { ...REALIZED, balance: 900 },
        ledger: {
          budgetLines: [],
          transactions: [{ ...ESSENCE, kind: 'income', amount: 2 }],
        },
      });
      await compare(view, '902.40');
      expect(view.byTestId('reconcile-dismiss-button')?.textContent).toContain(
        'Aucun revenu ne correspond',
      );

      await view.click(view.byTestId('reconcile-dismiss-button'));
      expect(view.byTestId('reconcile-small-gap')?.textContent).toContain(
        'Café · payé 3.00 · noté 3.80',
      );
    });

    it('should offer the small gap once the suggestions are dismissed', async () => {
      const view = await setup({
        realized: { ...REALIZED, balance: 900 },
        ledger: {
          budgetLines: [],
          transactions: [{ ...ESSENCE, amount: 2 }],
        },
      });
      await compare(view, '897.60');
      expect(view.byTestId('reconcile-dismiss-button')?.textContent).toContain(
        'Aucune dépense ne correspond',
      );

      view.byTestId('reconcile-dismiss-button')?.focus();
      await view.click(view.byTestId('reconcile-dismiss-button'));
      expect(document.activeElement).toBe(
        view.byTestId('reconcile-step-heading'),
      );

      expect(view.byTestId('reconcile-small-gap')?.textContent).toContain(
        'Café · payé 3.80 · noté 3.00',
      );
      const record = view.byTestId('reconcile-record-button');
      expect(record?.textContent).toContain('Noter une dépense de 2.40 CHF');
      // « Masquer les montants » blurs the amount, never the action.
      expect(
        Array.from(
          record?.querySelectorAll('.ph-no-capture') ?? [],
          (element) => element.textContent,
        ),
      ).toEqual([money(2.4, 'CHF')]);
      expect(record?.closest('.ph-no-capture')).toBeNull();
      // One inline run: the button's flex layout would drop the space before the amount.
      expect(
        record?.querySelector('.ph-no-capture')?.parentElement?.textContent,
      ).toContain('Noter une dépense de');
      // The note masks its two amounts, never « Disponible ».
      const note = view.byTestId('reconcile-available-note');
      expect(note?.closest('.ph-no-capture')).toBeNull();
      expect(note?.querySelectorAll('.ph-no-capture')).toHaveLength(2);
      expect(view.byTestId('reconcile-available-note')?.textContent).toBe(
        'Disponible : 900.00 CHF → 897.60 CHF',
      );
    });

    it('should note « Écart avec mes comptes » once on a double tap, and complete once', async () => {
      const write = deferred<boolean>();
      const recordAdjustment = vi.fn(() => write.promise);
      const view = await setup({
        recordAdjustment,
        realized: { ...REALIZED, balance: 1020 },
      });
      await compare(view, '900');
      expect(view.byTestId('reconcile-large-gap')?.textContent).toContain(
        "Tu vois −120.00 CHF dans l'app de ta banque, mais pas dans Pulpe ?",
      );
      const button = view.byTestId<HTMLButtonElement>(
        'reconcile-record-button',
      );
      expect(button?.textContent).toContain(
        'Oui, noter une dépense de 120.00 CHF',
      );

      button?.click();
      button?.click();
      view.backdropClick.next(new MouseEvent('click'));
      write.resolve(true);
      await view.render();

      expect(recordAdjustment).toHaveBeenCalledTimes(1);
      expect(recordAdjustment).toHaveBeenCalledWith({
        name: 'Écart avec mes comptes',
        kind: 'expense',
        amount: 120,
      });
      expect(view.postHog.captureEvent).toHaveBeenCalledTimes(1);
      expect(view.postHog.captureEvent).toHaveBeenCalledWith(
        'account_reconciliation_completed',
        { adjustment_kind: 'expense' },
      );
      expect(view.reconciliationApi.updateState$).toHaveBeenCalledTimes(1);
      expect(view.dialogRef.close).toHaveBeenCalledTimes(1);
    });

    it('should keep the screen and complete nothing when the write is refused', async () => {
      const view = await setup({
        recordAdjustment: vi.fn().mockResolvedValue(false),
      });
      await compare(view, '1500');

      await view.click(view.byTestId('reconcile-record-button'));

      expect(
        view.byTestId<HTMLButtonElement>('reconcile-record-button')?.disabled,
      ).toBe(false);
      expect(view.postHog.captureEvent).not.toHaveBeenCalled();
      expect(view.reconciliationApi.updateState$).not.toHaveBeenCalled();
      expect(view.dialogRef.close).not.toHaveBeenCalled();
    });

    it('should never write a « Je dois » or a balance into the event', async () => {
      const view = await setup();
      await compare(view, '1500');

      await view.click(view.byTestId('reconcile-record-button'));

      expect(view.postHog.captureEvent.mock.calls).toEqual([
        ['account_reconciliation_completed', { adjustment_kind: 'income' }],
      ]);
    });
  });

  describe('matched', () => {
    it('should title matched alone and complete once on [Terminer]', async () => {
      const view = await setup({ realized: { balance: 1050, available: 900 } });
      await compare(view, '1050');

      expect(view.byTestId('reconcile-step-heading')?.textContent?.trim()).toBe(
        'Pareil des deux côtés',
      );
      expect(view.byTestId('reconcile-matched')?.textContent).toContain(
        'Encore prévu',
      );
      await view.click(view.byTestId('reconcile-finish-button'));
      await view.click(view.byTestId('reconcile-finish-button'));

      expect(view.postHog.captureEvent).toHaveBeenCalledTimes(1);
      expect(view.postHog.captureEvent).toHaveBeenCalledWith(
        'account_reconciliation_completed',
        { adjustment_kind: 'none' },
      );
      expect(view.reconciliationApi.updateState$).toHaveBeenCalledTimes(1);
      expect(view.data.recordAdjustment).not.toHaveBeenCalled();
    });

    it('should close on Escape or a click outside when nothing is pending', async () => {
      const view = await setup();

      view.keydownEvents.next(new KeyboardEvent('keydown', { key: 'Escape' }));
      view.backdropClick.next(new MouseEvent('click'));

      expect(view.dialogRef.close).toHaveBeenCalledTimes(2);
      expect(view.reconciliationApi.updateState$).not.toHaveBeenCalled();
    });
  });

  // Pulpe holds 900.00 checked, the accounts 4 000.00: 3 100.00 more.
  describe('money from before Pulpe', () => {
    const FIRST = { ...CONTEXT, hasCompletedComparison: false };
    const REALIZED_900 = { balance: 900, available: 900 };

    it("should store the gap on « Oui, c'était déjà là », complete once, then show matched", async () => {
      const view = await setup({ context: FIRST, realized: REALIZED_900 });
      await compare(view, '4000');
      expect(
        view.byTestId('reconcile-first-comparison')?.textContent,
      ).toContain('étaient là avant Pulpe ?');
      expect(view.host.textContent).toContain('Ton disponible ne change pas.');

      await view.click(view.byTestId('reconcile-keep-start-button'));

      expect(view.reconciliationApi.updateState$.mock.calls).toEqual([
        [{ startingAmount: 3100, completed: true }],
      ]);
      expect(view.byTestId('reconcile-step-heading')?.textContent?.trim()).toBe(
        'Pareil des deux côtés',
      );
      expect(document.activeElement).toBe(
        view.byTestId('reconcile-step-heading'),
      );
      expect(view.byTestId('reconcile-matched')?.textContent).toContain(
        "D'avant Pulpe",
      );
      expect(view.postHog.captureEvent).toHaveBeenCalledExactlyOnceWith(
        'account_reconciliation_completed',
        { adjustment_kind: 'none' },
      );

      // The completion is already in: [Terminer] only ends the dialog.
      await view.click(view.byTestId('reconcile-finish-button'));
      expect(view.dialogRef.close).toHaveBeenCalledTimes(1);
      expect(view.reconciliationApi.updateState$).toHaveBeenCalledTimes(1);
      expect(view.postHog.captureEvent).toHaveBeenCalledTimes(1);
    });

    it('should keep the question and complete nothing when the write is refused', async () => {
      const view = await setup({ context: FIRST, realized: REALIZED_900 });
      view.reconciliationApi.updateState$.mockReturnValueOnce(
        throwError(() => new Error('offline')),
      );
      await compare(view, '4000');

      await view.click(view.byTestId('reconcile-keep-start-button'));

      expect(view.snackBar.open).toHaveBeenCalledTimes(1);
      expect(view.byTestId('reconcile-first-comparison')).not.toBeNull();
      expect(view.postHog.captureEvent).not.toHaveBeenCalled();
    });

    it('should correct the amount from the figure, then reset it, one write per answer', async () => {
      const view = await setup({
        context: { ...CONTEXT, startingAmount: 3100 },
        realized: REALIZED_900,
        sheetAnswer: 3000,
      });
      await compare(view, '4000');
      const heading = () =>
        view.byTestId('reconcile-step-heading')?.textContent?.trim();
      expect(heading()).toBe('Pareil des deux côtés');

      await view.click(view.byTestId('reconcile-starting-amount-button'));
      await view.render();

      expect(view.sheet.open).toHaveBeenCalledWith(
        expect.anything(),
        { amount: 3100, currency: 'CHF' },
        "Argent d'avant Pulpe",
        expect.anything(),
      );
      expect(heading()).toBe(
        `Tes comptes ont ${money(100, 'CHF')} de plus que Pulpe`,
      );
      expect(view.byTestId('reconcile-compared')?.textContent).toBe(
        money(900, 'CHF'),
      );
      // The pencil is an icon ligature: only the words count.
      expect(
        view
          .byTestId('reconcile-starting-amount-button')
          ?.querySelector('.mdc-button__label')
          ?.textContent?.trim(),
      ).toBe(`+${money(3000, 'CHF')} d'avant Pulpe`);

      view.sheet.open.mockResolvedValueOnce(0);
      await view.click(view.byTestId('reconcile-starting-amount-button'));
      await view.render();

      expect(heading()).toBe(
        `Tes comptes ont ${money(3100, 'CHF')} de plus que Pulpe`,
      );
      expect(view.byTestId('reconcile-starting-amount-button')).toBeNull();
      expect(view.reconciliationApi.updateState$.mock.calls).toEqual([
        [{ startingAmount: 3000 }],
        [{ startingAmount: 0 }],
      ]);
    });

    it('should write nothing when the editor is left or the amount is unchanged', async () => {
      const view = await setup({
        context: { ...CONTEXT, startingAmount: 3100 },
        realized: REALIZED_900,
      });
      await compare(view, '4000');

      await view.click(view.byTestId('reconcile-starting-amount-button'));
      view.sheet.open.mockResolvedValueOnce(3100);
      await view.click(view.byTestId('reconcile-starting-amount-button'));
      await view.render();

      expect(view.sheet.open).toHaveBeenCalledTimes(2);
      expect(view.reconciliationApi.updateState$).not.toHaveBeenCalled();
    });
  });

  describe('writes and completion around money from before Pulpe', () => {
    const FIRST = { ...CONTEXT, hasCompletedComparison: false };
    const REALIZED_900 = { balance: 900, available: 900 };
    const heading = (view: Awaited<ReturnType<typeof setup>>) =>
      view.byTestId('reconcile-step-heading')?.textContent?.trim();

    // Accounts 4 100.00, Pulpe 900.00 + 3 100.00: the server stores 3 200.00, the answer is lost.
    it('should read the state again when the answer is lost, so a settled gap is not offered', async () => {
      const view = await setup({
        context: { ...CONTEXT, startingAmount: 3100 },
        realized: REALIZED_900,
        sheetAnswer: 3200,
      });
      await compare(view, '4100');
      expect(view.byTestId('reconcile-record-button')).not.toBeNull();
      view.reconciliationApi.updateState$.mockReturnValueOnce(
        throwError(() => new Error('answer lost')),
      );
      view.reconciliationApi.getContext$.mockReturnValue(
        of({
          success: true as const,
          data: { ...CONTEXT, startingAmount: 3200 },
        }),
      );

      await view.click(view.byTestId('reconcile-starting-amount-button'));
      await view.render();

      expect(view.snackBar.open).toHaveBeenCalledTimes(1);
      expect(heading(view)).toBe('Pareil des deux côtés');
      expect(view.byTestId('reconcile-record-button')).toBeNull();
    });

    it('should hold every exit while the money from before Pulpe is saved', async () => {
      const view = await setup({ context: FIRST, realized: REALIZED_900 });
      const answer = new Subject<{
        success: true;
        data: { startingAmount: number; hasCompletedComparison: boolean };
      }>();
      view.reconciliationApi.updateState$.mockReturnValueOnce(answer);
      await compare(view, '4000');

      await view.click(view.byTestId('reconcile-keep-start-button'));
      const back = view.byTestId<HTMLButtonElement>('reconcile-back-button');
      expect(back?.disabled).toBe(true);
      expect(
        view.byTestId<HTMLButtonElement>('reconcile-guide-help-button')
          ?.disabled,
      ).toBe(true);
      view.keydownEvents.next(new KeyboardEvent('keydown', { key: 'Escape' }));
      view.backdropClick.next(new MouseEvent('click'));
      expect(view.dialogRef.close).not.toHaveBeenCalled();

      answer.next({
        success: true,
        data: { startingAmount: 3100, hasCompletedComparison: true },
      });
      answer.complete();
      await view.render();

      expect(heading(view)).toBe('Pareil des deux côtés');
      expect(back?.disabled).toBe(false);
    });

    for (const exit of ['finish', 'escape'] as const) {
      it(`should save the balances once after « Oui », when leaving by ${exit}`, async () => {
        const view = await setup({
          context: FIRST,
          realized: REALIZED_900,
          accounts: [UBS],
        });
        await compare(view, '4000');

        await view.click(view.byTestId('reconcile-keep-start-button'));
        await view.render();
        expect(view.assetApi.recordSnapshots$).not.toHaveBeenCalled();

        if (exit === 'finish') {
          await view.click(view.byTestId('reconcile-finish-button'));
        } else {
          view.keydownEvents.next(
            new KeyboardEvent('keydown', { key: 'Escape' }),
          );
        }
        await view.render();

        expect(view.dialogRef.close).toHaveBeenCalledTimes(1);
        expect(view.assetApi.recordSnapshots$).toHaveBeenCalledExactlyOnceWith({
          items: [{ assetId: UBS_ID, value: 4000 }],
        });
      });
    }

    it('should save the balances once when the dialog goes without close(), as on browser back', async () => {
      const view = await setup({
        context: FIRST,
        realized: REALIZED_900,
        accounts: [UBS],
      });
      await compare(view, '4000');
      await view.click(view.byTestId('reconcile-keep-start-button'));

      view.fixture.destroy();

      expect(view.assetApi.recordSnapshots$).toHaveBeenCalledExactlyOnceWith({
        items: [{ assetId: UBS_ID, value: 4000 }],
      });
    });

    it('should save the balances once, as typed last, after two completed comparisons', async () => {
      const view = await setup({
        context: FIRST,
        realized: REALIZED_900,
        accounts: [UBS],
      });
      await compare(view, '4000');
      await view.click(view.byTestId('reconcile-keep-start-button'));
      view.reconciliationApi.getContext$.mockReturnValue(
        of({
          success: true as const,
          data: { ...CONTEXT, startingAmount: 3100 },
        }),
      );

      await view.click(view.byTestId('reconcile-back-button'));
      await compare(view, '4200');
      await view.click(view.byTestId('reconcile-leave-button'));

      expect(view.assetApi.recordSnapshots$).toHaveBeenCalledExactlyOnceWith({
        items: [{ assetId: UBS_ID, value: 4200 }],
      });
    });

    it('should complete a second comparison started from the back arrow on its own', async () => {
      const view = await setup({ context: FIRST, realized: REALIZED_900 });
      await compare(view, '4000');
      await view.click(view.byTestId('reconcile-keep-start-button'));
      view.reconciliationApi.getContext$.mockReturnValue(
        of({
          success: true as const,
          data: { ...CONTEXT, startingAmount: 3100 },
        }),
      );

      await view.click(view.byTestId('reconcile-back-button'));
      await compare(view, '4200');
      await view.click(view.byTestId('reconcile-leave-button'));

      expect(view.postHog.captureEvent).toHaveBeenCalledTimes(2);
      expect(view.reconciliationApi.updateState$.mock.calls).toEqual([
        [{ startingAmount: 3100, completed: true }],
        [{ completed: true }],
      ]);
    });
  });

  describe('more on the accounts', () => {
    it('should add one « Je dois » row on two presses before step 1 shows', async () => {
      const view = await setup({ realized: { balance: 900, available: 900 } });
      await compare(view, '1700');

      const button = view.byTestId('reconcile-card-owe-button');
      button?.click();
      button?.click();
      await view.render();

      expect(view.allByTestId('reconcile-label-input')).toHaveLength(2);
    });

    it('should go back to step 1 on a new « Je dois » row, its name focused', async () => {
      const view = await setup({ realized: { balance: 900, available: 900 } });
      await compare(view, '1700');
      expect(view.byTestId('reconcile-large-gap')?.textContent).toContain(
        'Tu vois +800.00',
      );

      await view.click(view.byTestId('reconcile-card-owe-button'));

      expect(view.byTestId('reconcile-accounts-step')).not.toBeNull();
      expect(
        view.allByTestId<HTMLInputElement>('reconcile-amount-input')[0]?.value,
      ).toBe('1700');
      const names = view.allByTestId('reconcile-label-input');
      expect(names).toHaveLength(2);
      expect(document.activeElement).toBe(names[1]);
      expect(view.byTestId('reconcile-card-help')).toBeNull();
    });
  });

  describe('other reasons', () => {
    const FIRST = { ...CONTEXT, hasCompletedComparison: false };
    const REALIZED_900 = { balance: 900, available: 900 };
    const heading = (view: Awaited<ReturnType<typeof setup>>) =>
      view.byTestId('reconcile-step-heading');
    // Courses 600.00 checked, 200.00 noted on it: the rest is still on the account.
    const GROCERIES = createMockBudgetLine({
      id: 'line-courses',
      name: 'Courses',
      amount: 600,
      checkedAt: '2026-11-02T10:00:00+01:00',
    });
    const LEDGER = {
      budgetLines: [GROCERIES],
      transactions: [
        createMockTransaction({
          id: 'tx-migros',
          amount: 200,
          budgetLineId: GROCERIES.id,
          checkedAt: '2026-11-03T10:00:00+01:00',
        }),
      ],
    };

    it('should open from « Non, autre chose » with the gap, the card question and the partly spent prévision', async () => {
      const view = await setup({
        context: FIRST,
        realized: REALIZED_900,
        ledger: LEDGER,
      });
      await compare(view, '4000');

      await view.click(view.byTestId('reconcile-reasons-button'));

      expect(
        view.byTestId('reconcile-reasons-button')?.textContent?.trim(),
      ).toBe('Non, autre chose');
      expect(view.sheet.open).toHaveBeenCalledExactlyOnceWith(
        ReconcileReasonsSheet,
        {
          gap: 3100,
          currency: 'CHF',
          hasOwe: false,
          partlySpent: {
            id: GROCERIES.id,
            name: 'Courses',
            amount: 600,
            spent: 200,
            left: 400,
          },
          note: { before: 900, after: 4000 },
        },
        'Autres raisons',
        expect.anything(),
      );
    });

    describe('from salary early', () => {
      beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(2026, 10, 23, 12));
      });
      afterEach(() => vi.useRealTimers());

      it('should offer them next to « Laisser comme ça »', async () => {
        const view = await setup({ realized: REALIZED_900, payDayOfMonth: 25 });
        await compare(view, '6900');
        expect(view.byTestId('reconcile-salary-early')).not.toBeNull();
        expect(view.byTestId('reconcile-leave-button')).not.toBeNull();

        await view.click(view.byTestId('reconcile-reasons-button'));

        expect(view.sheet.open).toHaveBeenCalledWith(
          ReconcileReasonsSheet,
          expect.objectContaining({ gap: 6000, partlySpent: null }),
          'Autres raisons',
          expect.anything(),
        );
      });
    });

    it('should note the gap as an income once, then complete once', async () => {
      const view = await setup({
        context: FIRST,
        realized: REALIZED_900,
        sheetAnswer: 'noteIncome',
      });
      await compare(view, '4000');

      await view.click(view.byTestId('reconcile-reasons-button'));

      expect(view.data.recordAdjustment).toHaveBeenCalledExactlyOnceWith({
        name: 'Écart avec mes comptes',
        kind: 'income',
        amount: 3100,
      });
      expect(view.postHog.captureEvent).toHaveBeenCalledExactlyOnceWith(
        ANALYTICS_EVENTS.ACCOUNT_RECONCILIATION_COMPLETED,
        { adjustment_kind: 'income' },
      );
      expect(view.reconciliationApi.updateState$.mock.calls).toEqual([
        [{ completed: true }],
      ]);
      expect(view.dialogRef.close).toHaveBeenCalledTimes(1);
    });

    it('should write nothing when the gap moved while the sheet was open', async () => {
      const view = await setup({ context: FIRST, realized: REALIZED_900 });
      await compare(view, '4000');
      view.sheet.open.mockImplementationOnce(() => {
        view.realized.set({ balance: 1000, available: 1000 });
        return Promise.resolve('noteIncome');
      });
      view.byTestId('reconcile-reasons-button')?.focus();

      await view.click(view.byTestId('reconcile-reasons-button'));

      expect(view.data.recordAdjustment).not.toHaveBeenCalled();
      expect(heading(view)?.textContent).toContain(money(3000, 'CHF'));
      expect(document.activeElement).toBe(heading(view));
    });

    it('should write nothing when an item now explains the same gap', async () => {
      const view = await setup({ context: FIRST, realized: REALIZED_900 });
      await compare(view, '4000');
      view.sheet.open.mockImplementationOnce(() => {
        view.ledger.set({
          budgetLines: [],
          transactions: [
            createMockTransaction({
              id: 'tx-prime',
              name: 'Prime',
              kind: 'income',
              amount: 3100,
            }),
          ],
        });
        return Promise.resolve('noteIncome');
      });
      view.byTestId('reconcile-reasons-button')?.focus();

      await view.click(view.byTestId('reconcile-reasons-button'));

      expect(view.data.recordAdjustment).not.toHaveBeenCalled();
      expect(view.allByTestId('reconcile-suggestion')).toHaveLength(1);
      expect(document.activeElement).toBe(heading(view));
    });

    it('should keep the screen, the focus on its heading, when the income is refused', async () => {
      const view = await setup({
        context: FIRST,
        realized: REALIZED_900,
        sheetAnswer: 'noteIncome',
        recordAdjustment: vi.fn().mockResolvedValue(false),
      });
      await compare(view, '4000');

      // The sheet hands the focus back to the button that opened it.
      view.byTestId('reconcile-reasons-button')?.focus();
      await view.click(view.byTestId('reconcile-reasons-button'));

      expect(view.byTestId('reconcile-first-comparison')).not.toBeNull();
      expect(document.activeElement).toBe(heading(view));
      expect(view.postHog.captureEvent).not.toHaveBeenCalled();
      expect(view.dialogRef.close).not.toHaveBeenCalled();
    });

    it('should go back to step 1 on « Revoir mes comptes », the amounts kept', async () => {
      const view = await setup({
        context: FIRST,
        realized: REALIZED_900,
        sheetAnswer: 'reviewAccounts',
      });
      await compare(view, '4000');

      await view.click(view.byTestId('reconcile-reasons-button'));

      expect(view.byTestId('reconcile-accounts-step')).not.toBeNull();
      expect(
        view.allByTestId<HTMLInputElement>('reconcile-amount-input')[0]?.value,
      ).toBe('4000');
      expect(document.activeElement).toBe(heading(view));
    });

    it('should add a « Je dois » row on step 1, its name focused', async () => {
      const view = await setup({
        context: FIRST,
        realized: REALIZED_900,
        sheetAnswer: 'addOwe',
      });
      await compare(view, '4000');

      await view.click(view.byTestId('reconcile-reasons-button'));

      const names = view.allByTestId('reconcile-label-input');
      expect(names).toHaveLength(2);
      expect(document.activeElement).toBe(names[1]);
    });

    it('should complete with nothing noted on « Laisser comme ça »', async () => {
      const view = await setup({
        context: FIRST,
        realized: REALIZED_900,
        sheetAnswer: 'leave',
      });
      await compare(view, '4000');

      await view.click(view.byTestId('reconcile-reasons-button'));

      expect(view.data.recordAdjustment).not.toHaveBeenCalled();
      expect(view.postHog.captureEvent).toHaveBeenCalledExactlyOnceWith(
        ANALYTICS_EVENTS.ACCOUNT_RECONCILIATION_COMPLETED,
        { adjustment_kind: 'none' },
      );
      expect(view.dialogRef.close).toHaveBeenCalledTimes(1);
    });

    it('should write nothing and hand the focus back to the heading when closed', async () => {
      const view = await setup({ context: FIRST, realized: REALIZED_900 });
      await compare(view, '4000');

      // The sheet hands the focus back to the button that opened it.
      view.byTestId('reconcile-reasons-button')?.focus();
      await view.click(view.byTestId('reconcile-reasons-button'));

      expect(view.data.recordAdjustment).not.toHaveBeenCalled();
      expect(view.reconciliationApi.updateState$).not.toHaveBeenCalled();
      expect(view.dialogRef.close).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(heading(view));
    });
  });

  describe('when the page no longer holds the month it opened on', () => {
    it('should close without writing or claiming anything', async () => {
      const view = await setup();
      await compare(view, '1500');

      view.realized.set(null);
      await view.render();

      expect(view.dialogRef.close).toHaveBeenCalledTimes(1);
      expect(view.data.recordAdjustment).not.toHaveBeenCalled();
      expect(view.postHog.captureEvent).not.toHaveBeenCalled();
    });

    it('should let a write already out settle on its own month, then close', async () => {
      const write = deferred<boolean>();
      const recordAdjustment = vi.fn(() => write.promise);
      const view = await setup({ recordAdjustment });
      await compare(view, '1500');
      await view.click(view.byTestId('reconcile-record-button'));

      view.realized.set(null);
      await view.render();
      expect(view.dialogRef.close).not.toHaveBeenCalled();

      write.resolve(false);
      await view.render();

      expect(recordAdjustment).toHaveBeenCalledTimes(1);
      expect(view.postHog.captureEvent).not.toHaveBeenCalled();
      expect(view.dialogRef.close).toHaveBeenCalledTimes(1);
    });
  });

  describe('accounts linked to « Mon patrimoine »', () => {
    // Types into the amount inputs by position, then compares.
    async function compareOn(
      view: Awaited<ReturnType<typeof setup>>,
      amounts: Record<number, string>,
    ) {
      for (const [index, amount] of Object.entries(amounts)) {
        await view.type(
          view.allByTestId('reconcile-amount-input')[Number(index)],
          amount,
        );
      }
      await view.click(view.byTestId('reconcile-next-button'));
    }

    it('should open on one row per followed item, own or owe, amount empty', async () => {
      const card = linkedAsset({
        id: '55555555-5555-4555-8555-555555555555',
        name: 'Carte Cembra',
        direction: 'owe',
      });
      const view = await setup({ accounts: [UBS, POSTFINANCE, REVOLUT, card] });

      expect(
        view
          .allByTestId('reconcile-row-name')
          .map((name) => name.textContent?.trim()),
      ).toEqual(['Compte UBS', 'Compte PostFinance', 'Carte Cembra']);
      expect(
        view
          .allByTestId('reconcile-row-side')
          .map((side) => side.textContent?.trim()),
      ).toEqual(["J'ai", "J'ai", 'Je dois']);
      expect(view.allByTestId('reconcile-label-input')).toHaveLength(0);
      expect(
        view
          .allByTestId<HTMLInputElement>('reconcile-amount-input')
          .map((input) => input.value),
      ).toEqual(['', '', '']);
      expect(view.host.textContent).toContain(
        'Mis à jour dans Mon patrimoine.',
      );
      expect(view.host.textContent).toContain(
        'Tout ce que tu dois, achats récents compris. Pas ta limite.',
      );
      expect(view.byTestId('reconcile-card-help')).toBeNull();
    });

    it('should hide the names of linked items from session replay', async () => {
      const view = await setup({ accounts: [UBS] });

      expect(
        recordedValues(view.host).filter((value) =>
          value.includes('Compte UBS'),
        ),
      ).toEqual([]);
    });

    it('should record one snapshot batch of the filled linked rows when the adjustment is recorded', async () => {
      const view = await setup({
        accounts: [UBS, POSTFINANCE],
        free: [{ name: 'Cash', side: 'own' }],
      });
      await compareOn(view, { 0: '12340', 2: '50' });

      await view.click(view.byTestId('reconcile-record-button'));

      expect(view.data.recordAdjustment).toHaveBeenCalledTimes(1);
      expect(view.assetApi.recordSnapshots$).toHaveBeenCalledTimes(1);
      expect(view.assetApi.recordSnapshots$).toHaveBeenCalledWith({
        items: [{ assetId: UBS_ID, value: 12340 }],
      });
      expect(view.assetApi.cache.invalidate).toHaveBeenCalledWith(['assets']);
      expect(view.snackBar.open).not.toHaveBeenCalled();
      expect(view.dialogRef.close).toHaveBeenCalledTimes(1);
    });

    it('should record the snapshots of an overdraft and of every filled linked row', async () => {
      const view = await setup({ accounts: [UBS, POSTFINANCE] });
      await compareOn(view, { 0: '100', 1: '-20.5' });

      await view.click(view.byTestId('reconcile-record-button'));

      expect(view.assetApi.recordSnapshots$).toHaveBeenCalledWith({
        items: [
          { assetId: UBS_ID, value: 100 },
          { assetId: POSTFINANCE_ID, value: -20.5 },
        ],
      });
    });

    it('should record the snapshots when the accounts are already up to date', async () => {
      const view = await setup({
        accounts: [UBS],
        realized: { ...REALIZED, balance: 12340 },
      });
      await compareOn(view, { 0: '12340' });

      await view.click(view.byTestId('reconcile-finish-button'));

      expect(view.data.recordAdjustment).not.toHaveBeenCalled();
      expect(view.assetApi.recordSnapshots$).toHaveBeenCalledWith({
        items: [{ assetId: UBS_ID, value: 12340 }],
      });
      expect(view.dialogRef.close).toHaveBeenCalledTimes(1);
    });

    it('should stop following an account whose row is removed, without a snapshot for it', async () => {
      const view = await setup({
        accounts: [UBS, POSTFINANCE],
        realized: { ...REALIZED, balance: 300 },
      });
      expect(
        view.byTestId('reconcile-remove-button')?.getAttribute('aria-label'),
      ).toBe('Retirer Compte UBS de la liste');
      await view.click(view.byTestId('reconcile-remove-button'));
      await compareOn(view, { 0: '300' });

      await view.click(view.byTestId('reconcile-finish-button'));
      await view.render();

      expect(view.assetApi.update$).toHaveBeenCalledTimes(1);
      expect(view.assetApi.update$).toHaveBeenCalledWith(UBS_ID, {
        inPulpe: false,
      });
      expect(view.assetApi.recordSnapshots$).toHaveBeenCalledWith({
        items: [{ assetId: POSTFINANCE_ID, value: 300 }],
      });
    });

    it('should record a « Je dois » card as typed, from its own side of the total', async () => {
      const card = linkedAsset({
        id: '55555555-5555-4555-8555-555555555555',
        name: 'Carte Cembra',
        direction: 'owe',
      });
      const view = await setup({
        accounts: [UBS, card],
        realized: { ...REALIZED, balance: 200 },
      });
      await compareOn(view, { 0: '1000', 1: '800' });

      await view.click(view.byTestId('reconcile-finish-button'));
      await view.render();

      expect(view.assetApi.recordSnapshots$).toHaveBeenCalledWith({
        items: [
          { assetId: UBS_ID, value: 1000 },
          { assetId: card.id, value: 800 },
        ],
      });
    });

    it('should create nothing in Mon patrimoine for a free row, whatever it holds', async () => {
      const view = await setup({
        free: [{ name: 'Neon', side: 'own' }],
        realized: { ...REALIZED, balance: 300 },
      });
      await compareOn(view, { 0: '300' });

      await view.click(view.byTestId('reconcile-finish-button'));
      await view.render();

      expect(view.assetApi.create$).not.toHaveBeenCalled();
      expect(view.assetApi.update$).not.toHaveBeenCalled();
      expect(view.assetApi.recordSnapshots$).not.toHaveBeenCalled();
    });

    it('should offer no select, no switch and no Mon patrimoine row when the feature is off', async () => {
      const view = await setup();

      expect(view.byTestId('reconcile-row-name')).toBeNull();
      expect(view.byTestId('reconcile-add-to-net-worth-toggle')).toBeNull();
    });

    it.each([
      ['not offer an item that a saving prévision', 'saving', ['Compte UBS']],
      [
        'keep offering an item that a non-saving prévision',
        'expense',
        ['Compte UBS', 'Compte PostFinance'],
      ],
    ] as const)(
      'should %s of the month points to',
      async (_title, kind, offered) => {
        const view = await setup({
          accounts: [UBS, POSTFINANCE],
          ledger: {
            budgetLines: [
              createMockBudgetLine({ kind, assetId: POSTFINANCE_ID }),
            ],
            transactions: [],
          },
        });
        // Both are followed, so listed: off the list, the add sheet may offer them again.
        for (const name of ['Compte UBS', 'Compte PostFinance']) {
          await view.click(
            view.host.querySelector<HTMLElement>(
              `[aria-label="Retirer ${name} de la liste"]`,
            ),
          );
        }
        await view.click(view.byTestId('reconcile-add-account-button'));

        // The add sheet is a double here: what it is handed is what it lists.
        const [, sheetData] = view.sheet.open.mock.calls.at(-1) as unknown as [
          unknown,
          AddAccountSheetData,
        ];
        expect(
          sheetData.groups.flatMap((group) =>
            group.items.map((asset) => asset.name),
          ),
        ).toEqual(offered);
      },
    );

    it('should write no snapshot when only free rows are filled', async () => {
      const view = await setup({
        accounts: [UBS],
        free: [{ name: 'Cash', side: 'own' }],
        realized: { ...REALIZED, balance: 50 },
      });
      await compareOn(view, { 1: '50' });

      await view.click(view.byTestId('reconcile-finish-button'));

      expect(view.assetApi.recordSnapshots$).not.toHaveBeenCalled();
      expect(view.dialogRef.close).toHaveBeenCalledTimes(1);
    });

    it('should end the same way and say so in a toast when the snapshots are not saved', async () => {
      const view = await setup({
        accounts: [UBS],
        recordSnapshots: () => throwError(() => new Error('offline')),
      });
      await compareOn(view, { 0: '1500' });

      await view.click(view.byTestId('reconcile-record-button'));

      expect(view.snackBar.open).toHaveBeenCalledTimes(1);
      expect(view.snackBar.open).toHaveBeenCalledWith(
        "Comparaison faite, mais je n'ai pas pu enregistrer tes soldes dans Mon patrimoine.",
        'Fermer',
        expect.objectContaining({ duration: 5000 }),
      );
      expect(view.postHog.captureEvent).toHaveBeenCalledWith(
        'account_reconciliation_completed',
        { adjustment_kind: 'income' },
      );
      expect(view.dialogRef.close).toHaveBeenCalledTimes(1);
    });

    it('should write no snapshot when the adjustment is refused', async () => {
      const view = await setup({
        accounts: [UBS],
        recordAdjustment: vi.fn().mockResolvedValue(false),
      });
      await compareOn(view, { 0: '1500' });

      await view.click(view.byTestId('reconcile-record-button'));

      expect(view.assetApi.recordSnapshots$).not.toHaveBeenCalled();
      expect(view.dialogRef.close).not.toHaveBeenCalled();
    });

    it('should write no snapshot when the close button leaves the first step', async () => {
      const view = await setup({ accounts: [UBS] });
      await view.type(view.byTestId('reconcile-amount-input'), '1500');

      await view.click(view.byTestId('reconcile-close-button'));

      expect(view.dialogRef.close).toHaveBeenCalledTimes(1);
      expect(view.assetApi.recordSnapshots$).not.toHaveBeenCalled();
    });

    it('should write no snapshot when the dialog is closed on step 2', async () => {
      const view = await setup({ accounts: [UBS] });
      await compareOn(view, { 0: '1500' });

      view.backdropClick.next(new MouseEvent('click'));
      view.keydownEvents.next(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(view.dialogRef.close).toHaveBeenCalled();
      expect(view.assetApi.recordSnapshots$).not.toHaveBeenCalled();
    });
  });
});
