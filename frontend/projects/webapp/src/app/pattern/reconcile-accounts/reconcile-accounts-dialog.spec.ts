import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  getBudgetPeriodDates,
  type Asset,
  type BudgetPeriodDates,
} from 'pulpe-shared';

import {
  createMockBudgetLine,
  createMockTransaction,
} from '@app/testing/mock-factories';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { PostHogService } from '@core/analytics/posthog';
import { AssetApi } from '@core/asset/asset-api';
import { STORAGE_KEYS } from '@core/storage';
import { createMockDataCache } from '@core/testing';
import {
  ReconcileAccountsDialog,
  type RealizedPosition,
  type ReconcileAccountsDialogData,
  type ReconcileLedger,
} from './reconcile-accounts-dialog';

const REALIZED: RealizedPosition = {
  balance: 1499.99,
  checkedIncome: 5000,
  checkedOutflows: 3380.01,
  rollover: -120,
};
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
    pointTransaction?: ReconcileAccountsDialogData['pointTransaction'];
    periodDates?: BudgetPeriodDates;
    recordAdjustment?: ReconcileAccountsDialogData['recordAdjustment'];
    /** My accounts in « Mon patrimoine »; left out, the feature is off. */
    accounts?: Asset[];
    recordSnapshots?: AssetApi['recordSnapshots$'];
    showGuide?: boolean;
    /** Names and sides remembered on this device. */
    free?: { name: string; side: 'own' | 'owe' }[];
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
    realized,
    ledger,
    pointTransaction:
      options.pointTransaction ?? vi.fn().mockResolvedValue(undefined),
    currency: signal('CHF'),
    periodDates: signal(options.periodDates ?? getBudgetPeriodDates(6, 2025)),
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
      { provide: MatSnackBar, useValue: snackBar },
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
    snackBar,
    backdropClick,
    keydownEvents,
    render,
    byTestId,
    allByTestId,
    type,
    click,
  };
}

async function reachVerdict(
  view: Awaited<ReturnType<typeof setup>>,
  ...amounts: string[]
) {
  for (const [index, amount] of amounts.entries()) {
    await view.type(view.allByTestId('reconcile-amount-input')[index], amount);
  }
  await view.click(view.byTestId('reconcile-next-button'));
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
      expect(view.byTestId('reconcile-realized-step')).not.toBeNull();

      await view.click(view.byTestId('reconcile-guide-help-button'));
      expect(view.postHog.captureEvent).toHaveBeenCalledWith(
        ANALYTICS_EVENTS.ACCOUNT_RECONCILIATION_GUIDE_VIEWED,
        { source: 'help' },
      );
      await view.click(view.byTestId('reconcile-guide-skip'));

      expect(view.byTestId('reconcile-guide')).toBeNull();
      expect(view.byTestId('reconcile-realized-step')).not.toBeNull();
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

  describe('step 2 — the realized balance', () => {
    async function reachStep2(view: Awaited<ReturnType<typeof setup>>) {
      await view.type(view.byTestId('reconcile-amount-input'), '1500');
      await view.click(view.byTestId('reconcile-next-button'));
    }

    it('should show the realized balance and what makes it, with the period bounds off the calendar month', async () => {
      const view = await setup({
        periodDates: getBudgetPeriodDates(6, 2025, 27),
      });
      await reachStep2(view);

      const step = view.byTestId('reconcile-realized-step');
      expect(step).not.toBeNull();
      expect(view.byTestId('reconcile-period')?.textContent).toContain(
        'Du 27 mai au 26 juin',
      );
      expect(view.byTestId('reconcile-checked-income')?.textContent).toContain(
        '5’000.00',
      );
      expect(
        view.byTestId('reconcile-checked-outflows')?.textContent,
      ).toContain('3’380.01');
      expect(view.byTestId('reconcile-rollover')?.textContent).toContain(
        '-120.00',
      );
      expect(
        view.byTestId('reconcile-realized-balance')?.textContent,
      ).toContain('1’499.99');
    });

    it('should leave the period unnamed on a calendar month and open the items still to check', async () => {
      const view = await setup();
      await reachStep2(view);

      expect(view.byTestId('reconcile-period')).toBeNull();
      await view.click(view.byTestId('reconcile-view-items-button'));
      expect(view.dialogRef.close).toHaveBeenCalledTimes(1);
      expect(view.data.viewItemsToCheck).toHaveBeenCalledTimes(1);
      expect(view.data.recordAdjustment).not.toHaveBeenCalled();
    });

    it('should move focus to the heading of each step it reaches', async () => {
      const view = await setup();
      await reachStep2(view);

      expect(document.activeElement).toBe(
        view.byTestId('reconcile-step-heading'),
      );
      expect(document.activeElement?.textContent).toContain('Ton solde pointé');

      await view.click(view.byTestId('reconcile-back-button'));

      expect(document.activeElement?.textContent).toContain(
        "Combien as-tu aujourd'hui ?",
      );
    });

    it('should reset the content scroll when moving to another step', async () => {
      const view = await setup();
      const content = view.host.querySelector(
        'mat-dialog-content',
      ) as HTMLElement;
      const scrollTo = vi.fn();
      content.scrollTo = scrollTo;
      await reachStep2(view);

      expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
      expect(document.activeElement).toBe(
        view.byTestId('reconcile-step-heading'),
      );
    });

    it('should keep the typed accounts when going back to step 1', async () => {
      const view = await setup({ free: [{ name: 'Joint', side: 'own' }] });
      await view.type(view.byTestId('reconcile-amount-input'), '1500');
      await view.click(view.byTestId('reconcile-next-button'));

      await view.click(view.byTestId('reconcile-back-button'));

      expect(
        view.byTestId<HTMLInputElement>('reconcile-amount-input')?.value,
      ).toBe('1500');
      expect(
        view.byTestId<HTMLInputElement>('reconcile-label-input')?.value,
      ).toBe('Joint');
      expect(view.dialogRef.close).not.toHaveBeenCalled();
    });
  });

  describe('step 3 — the verdict', () => {
    it('should name what the accounts hold beyond the balance and offer a checked income', async () => {
      const view = await setup({
        free: [
          { name: 'Compte A', side: 'own' },
          { name: 'Compte B', side: 'own' },
        ],
      });
      await reachVerdict(view, '1000', '500');

      expect(view.byTestId('reconcile-verdict-title')?.textContent).toContain(
        'En plus sur tes comptes +0.01 CHF',
      );
      expect(view.byTestId('reconcile-verdict-message')?.textContent).toContain(
        "revenu d'ajustement de 0.01 CHF",
      );
      expect(
        view.byTestId<HTMLInputElement>('reconcile-adjustment-label-input')
          ?.value,
      ).toBe('Ajustement');
      expect(view.byTestId('reconcile-record-button')).not.toBeNull();
      expect(view.byTestId('reconcile-finish-button')).toBeNull();
    });

    it('should name what the accounts are missing, overdraft included, and offer an expense', async () => {
      const view = await setup({
        realized: { ...REALIZED, balance: 120.3 },
      });
      await reachVerdict(view, '-50');

      expect(view.byTestId('reconcile-verdict-title')?.textContent).toContain(
        'Manque sur tes comptes −170.30 CHF',
      );
      expect(view.byTestId('reconcile-verdict-message')?.textContent).toContain(
        "dépense d'ajustement de 170.30 CHF",
      );
    });

    it('should call the accounts up to date at the exact cent and record nothing', async () => {
      const view = await setup({
        realized: { ...REALIZED, balance: 0.1 + 0.2 },
      });
      await reachVerdict(view, '0.30');

      expect(view.byTestId('reconcile-verdict-title')?.textContent).toContain(
        'Tout est à jour',
      );
      expect(view.byTestId('reconcile-record-button')).toBeNull();
      expect(view.byTestId('reconcile-adjustment-label-input')).toBeNull();

      await view.click(view.byTestId('reconcile-finish-button'));

      expect(view.data.recordAdjustment).not.toHaveBeenCalled();
      expect(view.postHog.captureEvent).toHaveBeenCalledTimes(1);
      expect(view.postHog.captureEvent).toHaveBeenCalledWith(
        'account_reconciliation_completed',
        { adjustment_kind: 'none' },
      );
      expect(view.dialogRef.close).toHaveBeenCalledTimes(1);
    });

    it('should create nothing when closed on the verdict', async () => {
      const view = await setup();
      await reachVerdict(view, '1500');

      await view.click(view.byTestId('reconcile-close-button'));
      view.keydownEvents.next(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(view.dialogRef.close).toHaveBeenCalled();
      expect(view.data.recordAdjustment).not.toHaveBeenCalled();
      expect(view.postHog.captureEvent).not.toHaveBeenCalled();
    });
  });

  describe('movements to point before adjusting', () => {
    const SALARY_LINE = createMockBudgetLine({
      id: 'line-salary',
      name: 'Salaire',
      kind: 'income',
      amount: 814.93,
    });
    const BONUS = createMockTransaction({
      id: 'tx-bonus',
      name: 'Prime',
      kind: 'income',
      amount: 800,
    });
    const SALARY = createMockTransaction({
      id: 'tx-salary',
      budgetLineId: SALARY_LINE.id,
      name: 'Salaire novembre',
      kind: 'income',
      amount: 814.93,
    });

    it('should offer an unpointed movement with what would remain, and point it through the page', async () => {
      let settle = () => undefined as void;
      const pointTransaction = vi.fn(
        () => new Promise<void>((resolve) => (settle = resolve)),
      );
      const view = await setup({
        ledger: { budgetLines: [], transactions: [BONUS] },
        pointTransaction,
      });
      await reachVerdict(view, '2314.92');

      const rows = view.allByTestId('reconcile-candidate');
      expect(rows).toHaveLength(1);
      expect(rows[0].textContent).toContain('Prime');
      expect(
        view
          .byTestId('reconcile-candidate-detail')
          ?.textContent?.replace(/\s+/g, ' '),
      ).toContain('Hors prévision · il restera +14.93 CHF');
      expect(view.byTestId('reconcile-verdict-message')?.textContent).toContain(
        'compterait deux fois',
      );

      await view.click(view.byTestId('reconcile-candidate-point-button'));
      expect(pointTransaction).toHaveBeenCalledWith('tx-bonus');
      expect(
        view.byTestId<HTMLButtonElement>('reconcile-candidate-point-button')
          ?.disabled,
      ).toBe(true);
      expect(
        view.byTestId<HTMLButtonElement>('reconcile-record-button')?.disabled,
      ).toBe(true);

      // The page points it: the live balance and movements move together.
      view.realized.set({ ...REALIZED, balance: 2299.99 });
      view.ledger.set({
        budgetLines: [],
        transactions: [{ ...BONUS, checkedAt: '2025-06-10T00:00:00Z' }],
      });
      settle();
      await view.render();

      expect(view.byTestId('reconcile-candidates')).toBeNull();
      expect(view.byTestId('reconcile-verdict-title')?.textContent).toContain(
        '+14.93 CHF',
      );
    });

    it('should name the prévision of a movement that settles the gap exactly', async () => {
      const view = await setup({
        ledger: { budgetLines: [SALARY_LINE], transactions: [SALARY] },
      });
      await reachVerdict(view, '2314.92');

      expect(
        view
          .byTestId('reconcile-candidate-detail')
          ?.textContent?.replace(/\s+/g, ' '),
      ).toContain('Salaire · même montant');
    });

    it('should show no movement to point when none moves the balance toward the accounts', async () => {
      const view = await setup({
        ledger: {
          budgetLines: [],
          transactions: [{ ...BONUS, kind: 'expense' }],
        },
      });
      await reachVerdict(view, '2314.92');

      expect(view.byTestId('reconcile-record-button')).not.toBeNull();
      expect(view.byTestId('reconcile-candidates')).toBeNull();
      expect(
        view.byTestId('reconcile-verdict-message')?.textContent,
      ).not.toContain('compterait deux fois');
    });
  });

  describe('recording the adjustment', () => {
    it('should record one adjustment with the edited label and report completion once', async () => {
      const write = deferred<boolean>();
      const recordAdjustment = vi.fn(() => write.promise);
      const view = await setup({ recordAdjustment });
      await reachVerdict(view, '1500');
      await view.type(
        view.byTestId('reconcile-adjustment-label-input'),
        '  Écart banque  ',
      );

      await view.click(view.byTestId('reconcile-record-button'));
      await view.click(view.byTestId('reconcile-record-button'));

      expect(recordAdjustment).toHaveBeenCalledTimes(1);
      expect(recordAdjustment).toHaveBeenCalledWith({
        name: 'Écart banque',
        kind: 'income',
        amount: 0.01,
      });

      write.resolve(true);
      await view.render();

      expect(view.postHog.captureEvent).toHaveBeenCalledTimes(1);
      expect(view.postHog.captureEvent).toHaveBeenCalledWith(
        'account_reconciliation_completed',
        { adjustment_kind: 'income' },
      );
      expect(view.dialogRef.close).toHaveBeenCalledTimes(1);
    });

    it('should hold every exit while recording and keep the step and input after a refusal', async () => {
      const firstWrite = deferred<boolean>();
      const recordAdjustment = vi
        .fn<ReconcileAccountsDialogData['recordAdjustment']>()
        .mockImplementationOnce(() => firstWrite.promise)
        .mockResolvedValueOnce(true);
      const view = await setup({
        recordAdjustment,
        realized: { ...REALIZED, balance: 1600 },
      });
      await reachVerdict(view, '1500');
      const button = (id: string) => view.byTestId<HTMLButtonElement>(id);

      await view.click(button('reconcile-record-button'));

      expect(button('reconcile-record-button')?.disabled).toBe(true);
      expect(button('reconcile-back-button')?.disabled).toBe(true);
      expect(button('reconcile-close-button')?.disabled).toBe(true);
      view.backdropClick.next(new MouseEvent('click'));
      view.keydownEvents.next(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(view.dialogRef.close).not.toHaveBeenCalled();

      firstWrite.resolve(false);
      await view.render();

      expect(view.byTestId('reconcile-verdict-step')).not.toBeNull();
      expect(
        view.byTestId<HTMLInputElement>('reconcile-adjustment-label-input')
          ?.value,
      ).toBe('Ajustement');
      expect(button('reconcile-record-button')?.disabled).toBe(false);
      expect(view.postHog.captureEvent).not.toHaveBeenCalled();
      expect(view.dialogRef.close).not.toHaveBeenCalled();

      await view.click(button('reconcile-record-button'));
      await view.render();

      expect(recordAdjustment).toHaveBeenCalledTimes(2);
      expect(recordAdjustment).toHaveBeenLastCalledWith({
        name: 'Ajustement',
        kind: 'expense',
        amount: 100,
      });
      expect(view.postHog.captureEvent).toHaveBeenCalledWith(
        'account_reconciliation_completed',
        { adjustment_kind: 'expense' },
      );
      expect(view.dialogRef.close).toHaveBeenCalledTimes(1);
    });

    it('should hold Finish while a write is out, even once the live balance matches, and keep a refusal retryable', async () => {
      const firstWrite = deferred<boolean>();
      const recordAdjustment = vi
        .fn<ReconcileAccountsDialogData['recordAdjustment']>()
        .mockImplementationOnce(() => firstWrite.promise)
        .mockResolvedValueOnce(true);
      const view = await setup({ recordAdjustment });
      await reachVerdict(view, '1500');
      await view.click(view.byTestId('reconcile-record-button'));

      view.realized.set({ ...REALIZED, balance: 1500 });
      await view.render();
      const finish = view.byTestId<HTMLButtonElement>(
        'reconcile-finish-button',
      );
      await view.click(finish);

      expect(view.postHog.captureEvent).not.toHaveBeenCalled();
      expect(finish?.disabled).toBe(true);

      firstWrite.resolve(false);
      await view.render();
      view.realized.set(REALIZED);
      await view.render();
      await view.click(view.byTestId('reconcile-record-button'));
      await view.render();

      expect(recordAdjustment).toHaveBeenCalledTimes(2);
      expect(view.postHog.captureEvent).toHaveBeenCalledTimes(1);
      expect(view.postHog.captureEvent).toHaveBeenCalledWith(
        'account_reconciliation_completed',
        { adjustment_kind: 'income' },
      );
      expect(view.dialogRef.close).toHaveBeenCalledTimes(1);
    });

    it('should not record an adjustment left without a label', async () => {
      const view = await setup();
      await reachVerdict(view, '1500');

      const label = view.byTestId('reconcile-adjustment-label-input');
      await view.type(label, '   ');
      label?.dispatchEvent(new Event('blur'));
      await view.render();

      expect(view.host.textContent).toContain(
        'Donne un libellé à cet ajustement',
      );
      expect(
        view.byTestId<HTMLButtonElement>('reconcile-record-button')?.disabled,
      ).toBe(true);
      await view.click(view.byTestId('reconcile-record-button'));
      expect(view.data.recordAdjustment).not.toHaveBeenCalled();
    });

    it('should close on Escape or a click outside when nothing is pending', async () => {
      const view = await setup();

      view.keydownEvents.next(new KeyboardEvent('keydown', { key: 'Escape' }));
      view.backdropClick.next(new MouseEvent('click'));

      expect(view.dialogRef.close).toHaveBeenCalledTimes(2);
      expect(view.data.recordAdjustment).not.toHaveBeenCalled();
    });
  });

  describe('when the page no longer holds the month it opened on', () => {
    it('should close without writing or claiming anything', async () => {
      const view = await setup();
      await reachVerdict(view, '1500');

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
      await reachVerdict(view, '1500');
      await view.click(view.byTestId('reconcile-record-button'));

      view.realized.set(null);
      await view.render();

      expect(view.dialogRef.close).not.toHaveBeenCalled();
      expect(view.host.textContent).not.toContain('Tout est à jour');
      const finish = view.byTestId<HTMLButtonElement>(
        'reconcile-finish-button',
      );
      expect(finish?.disabled).toBe(true);
      await view.click(finish);
      expect(view.postHog.captureEvent).not.toHaveBeenCalled();

      write.resolve(false);
      await view.render();

      expect(recordAdjustment).toHaveBeenCalledTimes(1);
      expect(view.dialogRef.close).toHaveBeenCalledTimes(1);
    });
  });

  describe('accounts linked to « Mon patrimoine »', () => {
    // Types into the amount inputs by position, then walks to the verdict.
    async function reachVerdictOn(
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
      await reachVerdictOn(view, { 0: '12340', 2: '50' });

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
      await reachVerdictOn(view, { 0: '100', 1: '-20.5' });

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
      await reachVerdictOn(view, { 0: '12340' });

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
      await reachVerdictOn(view, { 0: '300' });

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
      await reachVerdictOn(view, { 0: '1000', 1: '800' });

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
      await reachVerdictOn(view, { 0: '300' });

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

    it('should not offer an item that a saving prévision of the month points to', async () => {
      const view = await setup({
        accounts: [UBS, POSTFINANCE],
        ledger: {
          budgetLines: [
            createMockBudgetLine({
              kind: 'saving',
              assetId: POSTFINANCE_ID,
            }),
          ],
          transactions: [],
        },
      });

      expect(
        view.fixture.componentInstance['offers']().map((asset) => asset.id),
      ).toEqual([UBS_ID]);
    });

    it('should write no snapshot when only free rows are filled', async () => {
      const view = await setup({
        accounts: [UBS],
        free: [{ name: 'Cash', side: 'own' }],
        realized: { ...REALIZED, balance: 50 },
      });
      await reachVerdictOn(view, { 1: '50' });

      await view.click(view.byTestId('reconcile-finish-button'));

      expect(view.assetApi.recordSnapshots$).not.toHaveBeenCalled();
      expect(view.dialogRef.close).toHaveBeenCalledTimes(1);
    });

    it('should end the same way and say so in a toast when the snapshots are not saved', async () => {
      const view = await setup({
        accounts: [UBS],
        recordSnapshots: () => throwError(() => new Error('offline')),
      });
      await reachVerdictOn(view, { 0: '1500' });

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
      await reachVerdictOn(view, { 0: '1500' });

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

    it('should write no snapshot when the dialog is closed on the verdict', async () => {
      const view = await setup({ accounts: [UBS] });
      await reachVerdictOn(view, { 0: '1500' });

      await view.click(view.byTestId('reconcile-close-button'));
      view.keydownEvents.next(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(view.dialogRef.close).toHaveBeenCalled();
      expect(view.assetApi.recordSnapshots$).not.toHaveBeenCalled();
    });
  });
});
