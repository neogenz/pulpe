import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injector,
  input,
  model,
  viewChildren,
  type ElementRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import type { ErrorStateMatcher } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  CURRENCY_METADATA,
  parseAccountAmount,
  summarizeAccounts,
  type Asset,
  type AssetCategory,
  type SupportedCurrency,
} from 'pulpe-shared';

import type { RowAccount } from './reconcile-account-links';
import {
  ReconcileAddAccountSheet,
  type AddAccountChoice,
  type AddAccountSheetData,
} from './reconcile-add-account-sheet';
import { ReconcileSheet } from './reconcile-sheet';

export type AccountSide = 'own' | 'owe';

export interface AccountRow {
  readonly id: number;
  readonly label: string;
  readonly amountText: string;
  readonly side: AccountSide;
  readonly account: RowAccount;
}

const SIDES: readonly AccountSide[] = ['own', 'owe'];

// Flagged once the field is left, never mid-keystroke: "12." is on its way
// to "12.50". It never counts in the total either way.
export const UNREADABLE_AMOUNT: ErrorStateMatcher = {
  isErrorState: (control) =>
    !!control?.touched &&
    parseAccountAmount(String(control.value ?? '')).status === 'invalid',
};

/** What I have minus what I owe, in cents; `null` until every amount reads. */
export function summarizeRows(rows: readonly AccountRow[]) {
  const amounts = summarizeAccounts(rows.map((row) => row.amountText));
  const sideCents = (side: AccountSide) =>
    rows
      .filter((row) => row.side === side)
      .reduce((sum, { amountText }) => {
        const amount = parseAccountAmount(amountText);
        if (amount.status !== 'valid') return sum;
        // Each debt counts against the total whatever sign was typed.
        return sum + (side === 'owe' ? Math.abs(amount.cents) : amount.cents);
      }, 0);
  const ownCents = sideCents('own');
  const oweCents = sideCents('owe');
  return {
    canContinue: amounts.canContinue,
    totalCents: amounts.totalCents === null ? null : ownCents - oweCents,
    ownCents,
    oweCents,
    hasOwe: rows.some((row) => row.side === 'owe'),
  };
}

@Component({
  selector: 'pulpe-reconcile-accounts-step',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .amount {
      font: var(--mat-sys-title-large);
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
  `,
  template: `
    <ul class="m-0 grid list-none gap-3 p-0">
      @for (row of accounts(); track row.id; let index = $index) {
        @let name =
          row.label ||
          ('currentMonth.reconcile.accounts.numbered'
            | transloco: { index: index + 1 });
        <li
          class="flex flex-col gap-2 rounded-(--pulpe-surface-radius-panel) bg-surface-container-low p-4"
          data-testid="reconcile-account-row"
        >
          <div class="flex items-center gap-2">
            @if (row.account.kind === 'free') {
              <mat-form-field
                appearance="outline"
                subscriptSizing="dynamic"
                class="ph-no-capture min-w-0 flex-1"
              >
                <mat-label>{{
                  'currentMonth.reconcile.accounts.name' | transloco
                }}</mat-label>
                <input
                  #nameInput
                  matInput
                  autocomplete="off"
                  maxlength="60"
                  [ngModel]="row.label"
                  (ngModelChange)="update(row.id, { label: $event })"
                  data-testid="reconcile-label-input"
                />
              </mat-form-field>
            } @else {
              <span
                class="ph-no-capture min-w-0 flex-1 truncate text-body-large font-medium"
                data-testid="reconcile-row-name"
                >{{ row.label }}</span
              >
              <span
                class="shrink-0 rounded-full px-3 py-1 text-sm font-medium whitespace-nowrap"
                [class]="pillClass(row.side)"
                data-testid="reconcile-row-side"
                >{{
                  'currentMonth.reconcile.accounts.' + row.side | transloco
                }}</span
              >
            }
            <button
              matIconButton
              type="button"
              class="ph-no-capture amounts-visible -mr-2 shrink-0"
              [attr.aria-label]="
                'currentMonth.reconcile.accounts.remove' | transloco: { name }
              "
              (click)="remove(row.id)"
              data-testid="reconcile-remove-button"
            >
              <mat-icon aria-hidden="true">close</mat-icon>
            </button>
          </div>
          @if (row.account.kind === 'free') {
            <div
              role="radiogroup"
              class="ph-no-capture amounts-visible flex gap-1 rounded-xl border border-solid border-outline-variant p-1"
              [attr.aria-label]="
                'currentMonth.reconcile.accounts.side' | transloco: { name }
              "
            >
              @for (side of sides; track side) {
                <label
                  class="flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-lg text-sm font-medium text-on-surface-variant has-focus-visible:outline-2 has-focus-visible:outline-primary"
                  [class]="segmentClass(side)"
                >
                  <input
                    type="radio"
                    class="sr-only"
                    [name]="'side-' + row.id"
                    [checked]="row.side === side"
                    (change)="update(row.id, { side })"
                    [attr.data-testid]="'reconcile-side-' + side + '-radio'"
                  />
                  {{ 'currentMonth.reconcile.accounts.' + side | transloco }}
                </label>
              }
            </div>
          }
          <mat-form-field
            appearance="outline"
            subscriptSizing="dynamic"
            class="ph-no-capture w-full"
          >
            <mat-label>{{
              'currentMonth.reconcile.accounts.amount' | transloco
            }}</mat-label>
            <span matTextPrefix class="pr-2 text-sm text-on-surface-variant">{{
              currencySymbol()
            }}</span>
            <input
              matInput
              inputmode="decimal"
              autocomplete="off"
              class="amount whitespace-nowrap"
              placeholder="0.00"
              [ngModel]="row.amountText"
              (ngModelChange)="update(row.id, { amountText: $event })"
              [errorStateMatcher]="unreadableAmount"
              data-testid="reconcile-amount-input"
            />
            <mat-error>{{
              'currentMonth.reconcile.accounts.invalidAmount' | transloco
            }}</mat-error>
          </mat-form-field>
          @if (row.account.kind === 'asset') {
            @if (row.side === 'owe') {
              <p class="m-0 text-xs text-pretty text-on-surface-variant">
                {{ 'currentMonth.reconcile.accounts.cardCaption' | transloco }}
              </p>
            }
            <p class="m-0 flex items-center gap-1 text-xs text-secondary">
              <mat-icon class="mat-icon-sm" aria-hidden="true"
                >trending_up</mat-icon
              >
              {{ 'currentMonth.reconcile.accounts.linkedCaption' | transloco }}
            </p>
          }
        </li>
      }
    </ul>
    <button
      matButton
      type="button"
      class="mt-2 self-start"
      (click)="openSheet()"
      data-testid="reconcile-add-account-button"
    >
      <mat-icon aria-hidden="true">add</mat-icon>
      {{ 'currentMonth.reconcile.accounts.addAccount' | transloco }}
    </button>
    @if (!hasOwe()) {
      <div
        class="mt-2 flex gap-3 rounded-(--pulpe-surface-radius-panel) bg-tertiary-container p-3 text-sm leading-normal text-on-tertiary-container"
        data-testid="reconcile-card-help"
      >
        <mat-icon class="shrink-0" aria-hidden="true">credit_card</mat-icon>
        <div class="flex flex-col items-start gap-1">
          <span>{{
            'currentMonth.reconcile.accounts.cardHelp' | transloco
          }}</span>
          <button
            matButton="outlined"
            type="button"
            (click)="addRow({ kind: 'free', side: 'owe' })"
            data-testid="reconcile-add-owe-help-button"
          >
            {{ 'currentMonth.reconcile.accounts.addOwe' | transloco }}
          </button>
        </div>
      </div>
    }
  `,
  host: { class: 'flex flex-col' },
})
export class ReconcileAccountsStep {
  readonly #injector = inject(Injector);
  readonly #sheet = inject(ReconcileSheet);
  readonly #transloco = inject(TranslocoService);

  readonly accounts = model.required<AccountRow[]>();
  readonly currency = input.required<SupportedCurrency>();
  /** Mon patrimoine items that may be added: already filtered by the dialog. */
  readonly offers = input.required<readonly Asset[]>();
  readonly categories = input.required<readonly AssetCategory[]>();

  private readonly nameInputs =
    viewChildren<ElementRef<HTMLInputElement>>('nameInput');
  protected readonly sides = SIDES;
  protected readonly currencySymbol = computed(
    () => CURRENCY_METADATA[this.currency()].symbol,
  );
  protected readonly hasOwe = computed(() =>
    this.accounts().some((row) => row.side === 'owe'),
  );

  protected readonly unreadableAmount = UNREADABLE_AMOUNT;

  protected pillClass(side: AccountSide): string {
    return side === 'own'
      ? 'bg-secondary-container text-on-secondary-container'
      : 'bg-financial-expense-light text-on-financial-light';
  }

  protected segmentClass(side: AccountSide): string {
    return side === 'own'
      ? 'has-checked:bg-secondary-container has-checked:text-on-secondary-container'
      : 'has-checked:bg-financial-expense-light has-checked:text-on-financial-light';
  }

  protected update(id: number, changes: Partial<Omit<AccountRow, 'id'>>): void {
    this.accounts.update((rows) =>
      rows.map((row) => (row.id === id ? { ...row, ...changes } : row)),
    );
  }

  // Only this comparison: nothing of Mon patrimoine is touched from here.
  protected remove(id: number): void {
    this.accounts.update((rows) => rows.filter((row) => row.id !== id));
  }

  addRow(choice: AddAccountChoice): void {
    const id = Math.max(-1, ...this.accounts().map((row) => row.id)) + 1;
    const row: AccountRow =
      choice.kind === 'asset'
        ? {
            id,
            label: choice.asset.name,
            amountText: '',
            side: choice.asset.direction,
            account: { kind: 'asset', id: choice.asset.id },
          }
        : {
            id,
            label: '',
            amountText: '',
            side: choice.side,
            account: { kind: 'free' },
          };
    this.accounts.update((rows) => [...rows, row]);
    if (row.account.kind !== 'free') return;
    // The name is what a new free row needs first.
    afterNextRender(() => this.nameInputs().at(-1)?.nativeElement.focus(), {
      injector: this.#injector,
    });
  }

  protected async openSheet(): Promise<void> {
    const listed = new Set(
      this.accounts().flatMap(({ account }) =>
        account.kind === 'asset' ? [account.id] : [],
      ),
    );
    const available = this.offers().filter((asset) => !listed.has(asset.id));
    const groups = this.categories()
      .map(({ id, name }) => ({
        name,
        items: available.filter((asset) => asset.categoryId === id),
      }))
      .filter((group) => group.items.length > 0);
    const data: AddAccountSheetData = { groups };
    const ariaLabel = this.#transloco.translate(
      'currentMonth.reconcile.accounts.add.title',
    );
    const choice = await this.#sheet.open<
      ReconcileAddAccountSheet,
      AddAccountSheetData,
      AddAccountChoice
    >(ReconcileAddAccountSheet, data, ariaLabel);
    if (choice) this.addRow(choice);
  }
}
