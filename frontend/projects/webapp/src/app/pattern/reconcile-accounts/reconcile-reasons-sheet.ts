import { formatNumber } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  LOCALE_ID,
} from '@angular/core';
import {
  MAT_BOTTOM_SHEET_DATA,
  MatBottomSheetRef,
} from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TranslocoPipe } from '@jsverse/transloco';
import type { SupportedCurrency } from 'pulpe-shared';

import { CURRENCY_CONFIG } from '@core/currency';
import { AMOUNT_SLOT, money } from './reconcile-compare-step';

export interface ReasonsSheetData {
  /** Above 0: the accounts hold more than Pulpe. */
  readonly gap: number;
  readonly currency: SupportedCurrency;
  /** A « Je dois » row is in the list: the card reason has nothing left to add. */
  readonly hasOwe: boolean;
  /** A checked expense prévision with money still on it, if the month has one. */
  readonly partlySpent: {
    readonly name: string;
    readonly amount: number;
    readonly spent: number;
    readonly left: number;
  } | null;
  /** « Disponible : avant → après » once the gap is noted as an income. */
  readonly note: { readonly before: number; readonly after: number };
}

export type ReasonsSheetChoice =
  | 'addOwe'
  | 'noteIncome'
  | 'reviewAccounts'
  | 'leave';

const REASONS = ['card', 'partlySpent', 'income', 'savings'] as const;
type Reason = (typeof REASONS)[number];

const MAX_REASONS = 3;

/** « D'où viennent ces … ? »: the likely causes of a positive gap, closes with the one acted on. */
@Component({
  selector: 'pulpe-reconcile-reasons-sheet',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-3 p-5" data-testid="reconcile-reasons-sheet">
      <div class="flex items-center justify-between gap-2">
        @let title =
          (
            'currentMonth.reconcile.reasons.title'
            | transloco: { amount: AMOUNT_SLOT }
          ).split(AMOUNT_SLOT);
        <h2 class="m-0 text-title-large font-bold text-balance">
          {{ title[0]
          }}<span class="ph-no-capture whitespace-nowrap">{{
            money(data.gap)
          }}</span
          >{{ title[1] }}
        </h2>
        <button
          matIconButton
          type="button"
          class="-mr-2 shrink-0"
          (click)="choose(undefined)"
          [attr.aria-label]="'common.close' | transloco"
          data-testid="reconcile-reasons-close-button"
        >
          <mat-icon aria-hidden="true">close</mat-icon>
        </button>
      </div>

      @for (reason of reasons; track reason) {
        <section
          class="flex flex-col items-start gap-3 rounded-(--pulpe-surface-radius-panel) border border-outline-variant bg-surface-container-low p-4"
          data-testid="reconcile-reason"
          [attr.data-reason]="reason"
        >
          <h3 class="m-0 text-body-large font-medium text-pretty">
            {{ questionKeys[reason] | transloco }}
          </h3>
          @switch (reason) {
            @case ('card') {
              <!-- Halves when there is room; on a phone the Pulpe line keeps its words whole. -->
              <div class="flex w-full gap-2 text-body-medium">
                <div
                  class="flex flex-1 flex-col gap-1 rounded-xl bg-surface-container-lowest px-3 py-2 whitespace-nowrap"
                >
                  <span class="text-label-medium text-on-surface-variant">{{
                    'currentMonth.reconcile.guide.sample.pulpe' | transloco
                  }}</span>
                  <span class="flex items-center gap-1.5">
                    <span class="flex text-primary" aria-hidden="true">
                      <mat-icon class="mat-icon-sm">check_box</mat-icon>
                    </span>
                    <span class="flex-1">{{
                      'currentMonth.reconcile.reasons.cardSample' | transloco
                    }}</span>
                    <span class="tabular-nums">{{ bare(350) }}</span>
                  </span>
                </div>
                <div
                  class="flex min-w-0 flex-1 flex-col gap-1 rounded-xl bg-surface-container-lowest px-3 py-2"
                >
                  <span class="text-label-medium text-on-surface-variant">{{
                    'currentMonth.reconcile.reasons.bank' | transloco
                  }}</span>
                  <span class="text-on-surface-variant">{{
                    'currentMonth.reconcile.reasons.notYetThere' | transloco
                  }}</span>
                </div>
              </div>
              <button
                matButton="outlined"
                type="button"
                (click)="choose('addOwe')"
                data-testid="reconcile-reasons-owe-button"
              >
                {{ 'currentMonth.reconcile.accounts.addOwe' | transloco }}
              </button>
            }
            @case ('partlySpent') {
              @if (data.partlySpent; as line) {
                <div
                  class="flex w-full flex-col gap-2 rounded-xl bg-surface-container-lowest px-3 py-2 tabular-nums"
                >
                  <span class="flex items-center gap-1.5 text-body-medium">
                    <span class="flex text-primary" aria-hidden="true">
                      <mat-icon class="mat-icon-sm">check_box</mat-icon>
                    </span>
                    <span class="ph-no-capture min-w-0 flex-1 truncate">{{
                      line.name
                    }}</span>
                    <span class="ph-no-capture whitespace-nowrap">{{
                      money(line.amount)
                    }}</span>
                  </span>
                  <!-- Its width tells the share spent: masked like the amounts. -->
                  <mat-progress-bar
                    class="ph-no-capture"
                    mode="determinate"
                    [value]="(line.spent / line.amount) * 100"
                    aria-hidden="true"
                  />
                  @let spent =
                    (
                      'currentMonth.reconcile.reasons.spent'
                      | transloco: { amount: AMOUNT_SLOT }
                    ).split(AMOUNT_SLOT);
                  @let left =
                    (
                      'currentMonth.reconcile.reasons.left'
                      | transloco: { amount: AMOUNT_SLOT }
                    ).split(AMOUNT_SLOT);
                  <span
                    class="flex flex-wrap justify-between gap-x-3 text-body-small text-on-surface-variant"
                  >
                    <span data-testid="reconcile-reason-spent"
                      >{{ spent[0]
                      }}<span class="ph-no-capture whitespace-nowrap">{{
                        money(line.spent)
                      }}</span
                      >{{ spent[1] }}</span
                    >
                    <span data-testid="reconcile-reason-left"
                      >{{ left[0]
                      }}<span class="ph-no-capture whitespace-nowrap">{{
                        money(line.left)
                      }}</span
                      >{{ left[1] }}</span
                    >
                  </span>
                </div>
                <!-- Round, so it never reads as a box to check. -->
                <p
                  class="m-0 flex items-center gap-2 text-body-medium font-medium text-primary"
                >
                  <span
                    class="flex size-6 items-center justify-center rounded-full bg-primary text-on-primary"
                    aria-hidden="true"
                  >
                    <mat-icon class="mat-icon-sm">check</mat-icon>
                  </span>
                  {{ 'currentMonth.reconcile.reasons.nothingToDo' | transloco }}
                </p>
              }
            }
            @case ('income') {
              <div
                class="flex w-full items-start gap-3 rounded-xl bg-surface-container-lowest px-3 py-2 text-body-medium"
              >
                <span class="flex min-w-0 flex-1 flex-col items-start gap-1">
                  <span>{{
                    'currentMonth.reconcile.reasons.incomeSample'
                      | transloco: { date: today }
                  }}</span>
                  <span
                    class="rounded-full bg-tertiary-container px-2 py-0.5 text-label-small text-on-tertiary-container"
                    >{{
                      'currentMonth.reconcile.reasons.notInPulpe' | transloco
                    }}</span
                  >
                </span>
                <span
                  class="ph-no-capture font-semibold whitespace-nowrap text-financial-income tabular-nums"
                  >+{{ money(data.gap) }}</span
                >
              </div>
              <span class="flex flex-col items-start gap-1.5">
                <button
                  matButton="outlined"
                  type="button"
                  (click)="choose('noteIncome')"
                  data-testid="reconcile-reasons-income-button"
                >
                  <!-- One inline run: the button lays its children out in flex,
                       which would drop the space before the amount. -->
                  @let label =
                    (
                      'currentMonth.reconcile.compare.noteIncome'
                      | transloco: { amount: AMOUNT_SLOT }
                    ).split(AMOUNT_SLOT);
                  <span
                    >{{ label[0]
                    }}<span class="ph-no-capture">{{ money(data.gap) }}</span
                    >{{ label[1] }}</span
                  >
                </button>
                @let note =
                  (
                    'currentMonth.reconcile.compare.availableNote'
                    | transloco: { before: AMOUNT_SLOT, after: AMOUNT_SLOT }
                  ).split(AMOUNT_SLOT);
                <span class="text-xs text-on-surface-variant tabular-nums"
                  >{{ note[0]
                  }}<span class="ph-no-capture">{{
                    money(data.note.before)
                  }}</span
                  >{{ note[1]
                  }}<span class="ph-no-capture">{{
                    money(data.note.after)
                  }}</span
                  >{{ note[2] }}</span
                >
              </span>
            }
            @case ('savings') {
              <div
                class="flex w-full items-start gap-3 rounded-xl bg-surface-container-lowest px-3 py-2 text-body-medium"
              >
                <span class="flex min-w-0 flex-1 flex-col items-start gap-1">
                  <span>{{
                    'currentMonth.reconcile.reasons.savingsSample' | transloco
                  }}</span>
                  <span
                    class="rounded-full bg-tertiary-container px-2 py-0.5 text-label-small text-on-tertiary-container"
                    >{{
                      'currentMonth.reconcile.reasons.toRemove' | transloco
                    }}</span
                  >
                </span>
                <span
                  class="ph-no-capture font-semibold whitespace-nowrap tabular-nums"
                  >{{ money(data.gap) }}</span
                >
              </div>
              <button
                matButton="outlined"
                type="button"
                (click)="choose('reviewAccounts')"
                data-testid="reconcile-reasons-accounts-button"
              >
                {{
                  'currentMonth.reconcile.reasons.reviewAccounts' | transloco
                }}
              </button>
            }
          }
        </section>
      }

      <button
        matButton
        type="button"
        class="self-center"
        (click)="choose('leave')"
        data-testid="reconcile-reasons-leave-button"
      >
        {{ 'currentMonth.reconcile.compare.leaveAsIs' | transloco }}
      </button>
    </div>
  `,
})
export class ReconcileReasonsSheet {
  readonly #dialogRef = inject(MatDialogRef, { optional: true });
  readonly #sheetRef = inject(MatBottomSheetRef, { optional: true });
  protected readonly data: ReasonsSheetData =
    inject(MAT_DIALOG_DATA, { optional: true }) ??
    inject(MAT_BOTTOM_SHEET_DATA);

  protected readonly AMOUNT_SLOT = AMOUNT_SLOT;
  readonly #isPossible: Record<Reason, boolean> = {
    card: !this.data.hasOwe,
    partlySpent: this.data.partlySpent !== null,
    income: true,
    savings: true,
  };
  // Fixed order, each kept only when it can be the cause (spec.md §4.4).
  protected readonly reasons = REASONS.filter(
    (reason) => this.#isPossible[reason],
  ).slice(0, MAX_REASONS);
  protected readonly questionKeys: Record<Reason, string> = {
    card: 'currentMonth.reconcile.compare.cardQuestion',
    partlySpent: 'currentMonth.reconcile.reasons.partlySpentQuestion',
    income: 'currentMonth.reconcile.reasons.incomeQuestion',
    savings: 'currentMonth.reconcile.reasons.savingsQuestion',
  };
  // « Prime · 21 nov. »: a bank line dated today, in the interface language.
  protected readonly today = new Intl.DateTimeFormat(inject(LOCALE_ID), {
    day: 'numeric',
    month: 'short',
  }).format(new Date());
  readonly #numberLocale = CURRENCY_CONFIG[this.data.currency].numberLocale;

  protected money(value: number): string {
    return money(value, this.data.currency);
  }

  // The sample's figures are bare, like the small gap's café.
  protected bare(value: number): string {
    return formatNumber(value, this.#numberLocale, '1.2-2');
  }

  protected choose(choice: ReasonsSheetChoice | undefined): void {
    if (this.#dialogRef) this.#dialogRef.close(choice);
    else this.#sheetRef?.dismiss(choice);
  }
}
