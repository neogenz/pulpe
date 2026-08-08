import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { TranslocoPipe } from '@jsverse/transloco';
import type { SupportedCurrency } from 'pulpe-shared';
import { AppCurrencyPipe } from '@core/currency';

@Component({
  selector: 'pulpe-dashboard-savings-summary',
  imports: [AppCurrencyPipe, MatIconModule, MatButtonModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col w-full h-full">
      <!-- The header recipe its two siblings use, down to the nesting: badge
           and text in their own group, the action a separate child of a
           justify-between row. Flattened into one row with the button pushed
           by an auto margin, the title was left competing with it for the same
           343px and lost — "Épargne du mois" broke in two at 375 while the
           longer "Prévisions à pointer" beside it held one line. The outlined
           variant and its flag icon went the same way: 189px of trailing
           action against the siblings' 117, on three cards built from one
           recipe. -->
      <div class="mb-4 px-1 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-full bg-financial-savings/10 text-financial-savings flex items-center justify-center shrink-0"
          >
            <mat-icon aria-hidden="true">savings</mat-icon>
          </div>
          <div>
            <h2
              class="text-title-medium font-bold text-on-surface leading-tight"
            >
              {{ 'currentMonth.savingsSectionTitle' | transloco }}
            </h2>
            <p
              class="text-body-small text-on-surface-variant font-medium mt-0.5"
            >
              <!-- The count is about the plan, so it needs a plan to be about.
                   A transfer recorded from the page's FAB carries no line: with
                   no saving prévision at all it moved the amount below and left
                   this reading "0 sur 0 mises de côté", the same empty tally the
                   forecasts card beside it was just taught to refuse. -->
              @if (isComplete()) {
                {{ 'currentMonth.savingsAllDone' | transloco }}
              } @else if (hasPlan()) {
                <!-- No plural resolver is configured for transloco, so a count
                     of one renders literally: "0 sur 1 mises de côté". -->
                @if (totalCount() === 1) {
                  {{
                    'dashboard.savingsSummarySingular'
                      | transloco: { count: checkedCount() }
                  }}
                } @else {
                  {{
                    'dashboard.savingsSummary'
                      | transloco
                        : { count: checkedCount(), total: totalCount() }
                  }}
                }
              } @else if (hasSavings()) {
                {{ 'currentMonth.savingsUnplanned' | transloco }}
              } @else {
                {{ 'currentMonth.savingsNone' | transloco }}
              }
            </p>
          </div>
        </div>
        <!-- Gated the way the card sharing this grid row gates its own header
             button. Without savings the panel below already offers "Fixe ton
             premier objectif", and both controls emit the same output to the
             same route: an empty state that presents two buttons is offering a
             choice it does not have. -->
        @if (hasSavings()) {
          <button matButton (click)="viewSavingsGoals.emit()">
            {{ 'currentMonth.savingsViewGoals' | transloco }}
          </button>
        }
      </div>

      <div
        class="bg-surface-container-low rounded-3xl p-5 flex-1 flex flex-col justify-center"
      >
        @if (isComplete()) {
          <div class="flex flex-col items-center justify-center py-6 gap-2">
            <div
              class="w-16 h-16 rounded-full bg-financial-savings/10 text-financial-savings flex items-center justify-center mb-2"
            >
              <mat-icon class="scale-150" aria-hidden="true"
                >check_circle</mat-icon
              >
            </div>
            <h3
              class="text-title-medium font-medium text-on-surface-variant text-center"
            >
              {{ 'currentMonth.savingsDoneTitle' | transloco }}
            </h3>
            <p class="text-body-medium text-on-surface-variant text-center">
              {{ 'currentMonth.savingsDoneMessage' | transloco }}
            </p>
          </div>
        } @else if (hasSavings()) {
          <!-- A ratio needs a denominator. With nothing planned the bar sat at
               0% under "Tu as mis de côté 300 CHF sur 0 CHF prévus" — a card
               reporting no progress on money it had just been told about. -->
          @if (hasPlan()) {
            <!-- The name only, because aria-valuenow beside it already carries
                 the number: a label reading "Épargne : 40% réalisé" made the
                 reader announce "…40% réalisé, 40%". -->
            <div
              class="w-full h-2.5 bg-financial-savings/10 rounded-full overflow-hidden mb-4"
              role="progressbar"
              [attr.aria-valuenow]="progressPercentage()"
              aria-valuemin="0"
              aria-valuemax="100"
              [attr.aria-label]="'currentMonth.savingsSectionTitle' | transloco"
            >
              <div
                class="h-full bg-financial-savings rounded-full motion-safe:transition-all motion-safe:duration-700"
                [style.width.%]="progressPercentage()"
              ></div>
            </div>
          }
          <div class="flex justify-between items-baseline">
            <p class="text-body-medium text-on-surface">
              {{ 'currentMonth.savingsAmountText' | transloco }}
              <!-- tabular-nums on both, per DESIGN.md:118. This line is a
                   running total against a fixed target: the left number moves
                   on every saving pointed, the right one does not, and without
                   tabular figures neither stayed put. -->
              <span
                class="font-bold text-financial-savings tabular-nums whitespace-nowrap ph-no-capture"
              >
                {{ totalRealized() | appCurrency: currency() : '1.0-0' }}
              </span>
              @if (hasPlan()) {
                {{ 'dashboard.on' | transloco }}
                <span class="tabular-nums whitespace-nowrap ph-no-capture">{{
                  totalPlanned() | appCurrency: currency() : '1.0-0'
                }}</span>
                {{ 'currentMonth.savingsPlanned' | transloco }}
              } @else {
                {{ 'currentMonth.savingsThisMonth' | transloco }}
              }
            </p>
          </div>
        } @else {
          <div class="flex flex-col items-center justify-center py-6 gap-2">
            <div
              class="w-16 h-16 rounded-full bg-financial-savings/10 text-financial-savings flex items-center justify-center mb-2"
            >
              <mat-icon class="scale-150 flex! shrink-0!" aria-hidden="true"
                >savings</mat-icon
              >
            </div>
            <h3
              class="text-title-medium font-medium text-on-surface-variant text-center"
            >
              {{ 'currentMonth.savingsEmptyTitle' | transloco }}
            </h3>
            <button matButton="outlined" (click)="viewSavingsGoals.emit()">
              <mat-icon aria-hidden="true">flag</mat-icon>
              {{ 'currentMonth.savingsSetFirstGoal' | transloco }}
            </button>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class DashboardSavingsSummary {
  readonly totalPlanned = input.required<number>();
  readonly totalRealized = input.required<number>();
  readonly checkedCount = input.required<number>();
  readonly totalCount = input.required<number>();
  readonly currency = input<SupportedCurrency>('CHF');

  readonly viewSavingsGoals = output<void>();

  protected readonly progressPercentage = computed(() => {
    const planned = this.totalPlanned();
    if (planned === 0) return 0;
    return Math.min(Math.round((this.totalRealized() / planned) * 100), 100);
  });

  protected readonly hasSavings = computed(
    () => this.totalPlanned() > 0 || this.totalRealized() > 0,
  );

  // Money set aside and money planned are two different questions, and only the
  // second one has a count and a ratio behind it.
  protected readonly hasPlan = computed(() => this.totalPlanned() > 0);

  // The amounts, not the rounded percentage: 995 of 1'000 rounds to 100 and used
  // to swap the card to "Tu peux souffler" — a state that prints neither figure,
  // so the 5 CHF still owed became unreachable from the card that owed it.
  // The plan has to exist before it can be met: with nothing planned, any
  // amount clears `>= 0` and a month that saved 500 against no target would
  // report itself finished.
  // And the lines have to be pointed, not only the total reached. A 1'000
  // transfer recorded from the page's FAB carries no line, so it met the amount
  // while the 1'000 saving prévision it was meant to fulfil stayed unpointed:
  // this card said "C'est fait pour ce mois" beside a card in the same grid row
  // still offering that very line to point.
  protected readonly isComplete = computed(
    () =>
      this.totalPlanned() > 0 &&
      this.totalRealized() >= this.totalPlanned() &&
      this.checkedCount() >= this.totalCount(),
  );
}
