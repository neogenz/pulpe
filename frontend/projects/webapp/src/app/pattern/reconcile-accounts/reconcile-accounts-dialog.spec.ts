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
  getBudgetPeriodDates,
  type Asset,
  type BudgetPeriodDates,
} from 'pulpe-shared';

import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { PostHogService } from '@core/analytics/posthog';
import { AssetApi } from '@core/asset/asset-api';
import { createMockDataCache } from '@core/testing';
import {
  ReconcileAccountsDialog,
  type RealizedPosition,
  type ReconcileAccountsDialogData,
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
    periodDates?: BudgetPeriodDates;
    recordAdjustment?: ReconcileAccountsDialogData['recordAdjustment'];
    /** My accounts in « Mon patrimoine »; left out, the feature is off. */
    accounts?: Asset[];
    recordSnapshots?: AssetApi['recordSnapshots$'];
  } = {},
) {
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
  const data: ReconcileAccountsDialogData = {
    realized,
    currency: signal('CHF'),
    periodDates: signal(options.periodDates ?? getBudgetPeriodDates(6, 2025)),
    recordAdjustment:
      options.recordAdjustment ?? vi.fn().mockResolvedValue(true),
    viewItemsToCheck: vi.fn(),
    netWorth: options.accounts
      ? {
          accounts: options.accounts,
          categories: [{ id: CATEGORY_ID, name: 'Comptes', total: 0 }],
        }
      : null,
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
    if (index > 0) {
      await view.click(view.byTestId('reconcile-add-account-button'));
    }
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

  describe('step 1 — the accounts', () => {
    it('should name the first exit Cancel instead of implying a previous step', async () => {
      const view = await setup();

      expect(view.byTestId('reconcile-back-button')?.textContent?.trim()).toBe(
        'Annuler',
      );
      await view.click(view.byTestId('reconcile-back-button'));
      expect(view.dialogRef.close).toHaveBeenCalledTimes(1);
      expect(view.data.recordAdjustment).not.toHaveBeenCalled();
    });

    it('should start with a single empty amount and keep Continue disabled until it reads', async () => {
      const view = await setup();

      expect(view.allByTestId('reconcile-amount-input')).toHaveLength(1);
      expect(
        view.byTestId<HTMLInputElement>('reconcile-amount-input')?.value,
      ).toBe('');
      expect(
        view.byTestId<HTMLButtonElement>('reconcile-next-button')?.disabled,
      ).toBe(true);

      await view.type(view.byTestId('reconcile-amount-input'), '12.');
      expect(
        view.byTestId<HTMLButtonElement>('reconcile-next-button')?.disabled,
      ).toBe(true);

      await view.type(view.byTestId('reconcile-amount-input'), '1250.40');
      expect(
        view.byTestId<HTMLButtonElement>('reconcile-next-button')?.disabled,
      ).toBe(false);
    });

    it('should add labelled accounts by button or Enter and total them live', async () => {
      const view = await setup();
      await view.type(view.byTestId('reconcile-amount-input'), '1000');
      expect(view.byTestId('reconcile-total')?.textContent).toContain(
        '1’000.00',
      );

      await view.click(view.byTestId('reconcile-add-account-button'));
      await view.type(view.allByTestId('reconcile-label-input')[1], 'Épargne');
      await view.type(view.allByTestId('reconcile-amount-input')[1], '-250.5');
      expect(view.byTestId('reconcile-total')?.textContent).toContain('749.50');

      const secondAmount = view.allByTestId('reconcile-amount-input')[1];
      secondAmount.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      );
      await view.render();

      expect(view.allByTestId('reconcile-amount-input')).toHaveLength(3);
      expect(document.activeElement).toBe(
        view.allByTestId('reconcile-label-input')[2],
      );
      expect(view.byTestId('reconcile-accounts-step')).not.toBeNull();
      expect(view.data.recordAdjustment).not.toHaveBeenCalled();
    });

    it('should remove an added account through a button that numbers it', async () => {
      const view = await setup();
      await view.type(view.byTestId('reconcile-amount-input'), '1000');
      await view.click(view.byTestId('reconcile-add-account-button'));
      await view.type(view.allByTestId('reconcile-label-input')[1], 'Épargne');
      await view.type(view.allByTestId('reconcile-amount-input')[1], '300');
      await view.click(view.byTestId('reconcile-add-account-button'));

      const removeLabels = view
        .allByTestId('reconcile-remove-button')
        .map((button) => button.getAttribute('aria-label'));
      expect(removeLabels).toEqual([
        'Retirer le compte 1',
        'Retirer le compte 2',
        'Retirer le compte 3',
      ]);

      await view.click(view.allByTestId('reconcile-remove-button')[1]);

      expect(view.allByTestId('reconcile-amount-input')).toHaveLength(2);
      expect(view.byTestId('reconcile-total')?.textContent).toContain(
        '1’000.00',
      );
    });

    it('should keep a typed account name out of everything session replay records', async () => {
      const view = await setup();
      await view.click(view.byTestId('reconcile-add-account-button'));
      const label = view.allByTestId('reconcile-label-input')[1];
      await view.type(label, PRIVATE_ACCOUNT_NAME);

      expect(label?.closest('.ph-no-capture')).not.toBeNull();
      const leaks = recordedValues(view.host).filter((value) =>
        value.includes(PRIVATE_ACCOUNT_NAME),
      );
      expect(leaks).toEqual([]);
      expect(
        view
          .allByTestId('reconcile-remove-button')[1]
          ?.getAttribute('aria-label'),
      ).toBe('Retirer le compte 2');
    });

    it('should take an overdraft through the overdraft checkbox and refuse an unreadable amount', async () => {
      const view = await setup();
      const amount = view.byTestId<HTMLInputElement>('reconcile-amount-input');
      await view.type(amount, '80');

      const checkbox = view
        .byTestId('reconcile-overdraft-checkbox')
        ?.querySelector<HTMLInputElement>('input[type="checkbox"]');
      expect(checkbox?.checked).toBe(false);
      await view.click(checkbox);

      expect(amount?.value).toBe('-80');
      expect(checkbox?.checked).toBe(true);
      expect(view.byTestId('reconcile-total')?.textContent).toContain('-80.00');

      await view.click(view.byTestId('reconcile-add-account-button'));
      const unreadable = view.allByTestId('reconcile-amount-input')[1];
      await view.type(unreadable, '12abc');
      expect(
        view.byTestId<HTMLButtonElement>('reconcile-next-button')?.disabled,
      ).toBe(true);
      unreadable.dispatchEvent(new Event('blur'));
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

    it('should leave the flow from step 1 when going back, writing nothing', async () => {
      const view = await setup();
      await view.type(view.byTestId('reconcile-amount-input'), '1250.40');

      await view.click(view.byTestId('reconcile-back-button'));

      expect(view.dialogRef.close).toHaveBeenCalledTimes(1);
      expect(view.data.recordAdjustment).not.toHaveBeenCalled();
      expect(view.postHog.captureEvent).not.toHaveBeenCalled();
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
        'Combien as-tu sur tes comptes ?',
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
      const view = await setup();
      await view.type(view.byTestId('reconcile-amount-input'), '1500');
      await view.click(view.byTestId('reconcile-add-account-button'));
      await view.type(view.allByTestId('reconcile-label-input')[1], 'Joint');
      await view.type(view.allByTestId('reconcile-amount-input')[1], '-20');
      await view.click(view.byTestId('reconcile-next-button'));

      await view.click(view.byTestId('reconcile-back-button'));

      const amounts = view
        .allByTestId<HTMLInputElement>('reconcile-amount-input')
        .map((input) => input.value);
      expect(amounts).toEqual(['1500', '-20']);
      expect(
        view.allByTestId<HTMLInputElement>('reconcile-label-input')[1]?.value,
      ).toBe('Joint');
      expect(view.dialogRef.close).not.toHaveBeenCalled();
    });
  });

  describe('step 3 — the verdict', () => {
    it('should name what the accounts hold beyond the balance and offer a checked income', async () => {
      const view = await setup();
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

    it('should open on one row per followed account, amount empty, last balance as hint', async () => {
      const view = await setup({ accounts: [UBS, POSTFINANCE, REVOLUT] });

      expect(view.allByTestId('reconcile-account-select')).toHaveLength(2);
      expect(
        view.fixture.componentInstance['accountViews']().map(
          (account) => account.assetId,
        ),
      ).toEqual([UBS_ID, POSTFINANCE_ID]);
      expect(view.allByTestId('reconcile-label-input')).toHaveLength(0);
      expect(
        view
          .allByTestId<HTMLInputElement>('reconcile-amount-input')
          .map((input) => input.value),
      ).toEqual(['', '']);
      expect(view.host.textContent).toContain(
        'Dernier solde : 12’000.00 CHF, il y a 3 jours',
      );
      expect(view.host.textContent).toContain(
        'Dernier solde : 1’902.10 CHF, hier',
      );
      expect(view.allByTestId('reconcile-remove-button')).toHaveLength(2);
      expect(view.host.textContent).toContain(
        'Je mets à jour le solde de tes comptes de Mon patrimoine',
      );
      expect(view.host.textContent).not.toContain('Dans Pulpe');
      expect(view.host.textContent).not.toContain(
        'Les comptes saisis ne sont pas enregistrés.',
      );
    });

    it('should keep one empty free row and the private note without linked accounts', async () => {
      const view = await setup();

      expect(
        view
          .allByTestId<HTMLInputElement>('reconcile-label-input')
          .map((input) => input.value),
      ).toEqual(['']);
      expect(view.host.textContent).toContain(
        'Les comptes saisis ne sont pas enregistrés.',
      );
      expect(view.host.textContent).not.toContain('Dernier solde');
    });

    it('should hide the last balance of a linked account from session replay', async () => {
      const view = await setup({ accounts: [UBS] });

      const hint = view.host.querySelector('mat-hint');
      expect(hint?.closest('.ph-no-capture')).not.toBeNull();
      expect(
        recordedValues(view.host).filter((value) =>
          value.includes('Compte UBS'),
        ),
      ).toEqual([]);
    });

    it('should record one snapshot batch of the filled linked rows when the adjustment is recorded', async () => {
      const view = await setup({ accounts: [UBS, POSTFINANCE] });
      await view.click(view.byTestId('reconcile-add-account-button'));
      await view.type(view.byTestId('reconcile-label-input'), 'Cash');
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
      ).toBe('Ne plus suivre le compte 1');
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

    it('should follow and snapshot an account picked for the first time, and offer it to no other row', async () => {
      const view = await setup({
        accounts: [UBS, REVOLUT],
        realized: { ...REALIZED, balance: 6889 },
      });
      const component = view.fixture.componentInstance;
      await view.click(view.byTestId('reconcile-add-account-button'));
      expect(
        component['accountViews']()[1].choices.map((choice) => choice.id),
      ).toEqual([REVOLUT_ID]);

      component['selectAccount'](1, REVOLUT_ID);
      await view.render();
      expect(component['accountViews']()[0].choices).toEqual([UBS]);
      await reachVerdictOn(view, { 0: '100', 1: '6789' });
      await view.click(view.byTestId('reconcile-finish-button'));
      await view.render();

      expect(view.assetApi.update$).toHaveBeenCalledTimes(1);
      expect(view.assetApi.update$).toHaveBeenCalledWith(REVOLUT_ID, {
        inPulpe: true,
      });
      expect(view.assetApi.recordSnapshots$).toHaveBeenCalledWith({
        items: [
          { assetId: UBS_ID, value: 100 },
          { assetId: REVOLUT_ID, value: 6789 },
        ],
      });
    });

    it('should create a ticked free row in « Comptes », followed, with its balance as first value', async () => {
      const view = await setup({
        accounts: [],
        realized: { ...REALIZED, balance: 300 },
      });
      expect(view.byTestId('reconcile-account-select')).toBeNull();
      await view.type(view.byTestId('reconcile-label-input'), 'Neon');
      await view.click(
        view
          .byTestId('reconcile-add-to-net-worth-toggle')
          ?.querySelector('button'),
      );
      await reachVerdictOn(view, { 0: '300' });

      await view.click(view.byTestId('reconcile-finish-button'));
      await view.render();

      expect(view.assetApi.create$).toHaveBeenCalledTimes(1);
      expect(view.assetApi.create$).toHaveBeenCalledWith({
        name: 'Neon',
        value: 300,
        categoryId: CATEGORY_ID,
        currency: 'CHF',
        direction: 'own',
        inPulpe: true,
      });
      expect(view.assetApi.createCategory$).not.toHaveBeenCalled();
      expect(view.assetApi.recordSnapshots$).not.toHaveBeenCalled();
    });

    it('should require a name before going on once « Ajouter à Mon patrimoine » is ticked', async () => {
      const view = await setup({ accounts: [] });
      await view.type(view.byTestId('reconcile-amount-input'), '300');
      const next = view.byTestId<HTMLButtonElement>('reconcile-next-button');
      expect(next?.disabled).toBe(false);

      await view.click(
        view
          .byTestId('reconcile-add-to-net-worth-toggle')
          ?.querySelector('button'),
      );

      expect(next?.disabled).toBe(true);
      expect(document.activeElement).toBe(
        view.byTestId('reconcile-label-input'),
      );
      await view.type(view.byTestId('reconcile-label-input'), 'Neon');
      expect(next?.disabled).toBe(false);
    });

    it('should require a readable balance before going on once « Ajouter à Mon patrimoine » is ticked', async () => {
      // A first row with a balance: the total alone no longer holds the button.
      const view = await setup({ accounts: [] });
      await view.type(view.byTestId('reconcile-amount-input'), '100');
      await view.click(view.byTestId('reconcile-add-account-button'));
      const [, label] = view.allByTestId('reconcile-label-input');
      const [, amount] = view.allByTestId('reconcile-amount-input');
      await view.type(label, 'Neon');
      await view.click(
        view
          .allByTestId('reconcile-add-to-net-worth-toggle')[1]
          ?.querySelector('button'),
      );
      const next = view.byTestId<HTMLButtonElement>('reconcile-next-button');
      expect(next?.disabled).toBe(true);
      expect(view.host.textContent).toContain(
        "Saisis son solde pour l'ajouter",
      );

      await view.type(amount, '300');
      expect(next?.disabled).toBe(false);
    });

    it('should offer neither select nor checkbox when the feature is off', async () => {
      const view = await setup();

      expect(view.byTestId('reconcile-account-select')).toBeNull();
      expect(view.byTestId('reconcile-add-to-net-worth-toggle')).toBeNull();
    });

    it('should write no snapshot when only free rows are filled', async () => {
      const view = await setup({
        accounts: [UBS],
        realized: { ...REALIZED, balance: 50 },
      });
      await view.click(view.byTestId('reconcile-add-account-button'));
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
        "Rapprochement fait, mais je n'ai pas pu enregistrer tes soldes dans Mon patrimoine.",
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

    it('should write no snapshot when Cancel leaves the first step', async () => {
      const view = await setup({ accounts: [UBS] });
      await view.type(view.byTestId('reconcile-amount-input'), '1500');

      await view.click(view.byTestId('reconcile-back-button'));

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
