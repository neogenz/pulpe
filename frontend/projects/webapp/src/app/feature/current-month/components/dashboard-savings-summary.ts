import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { TranslocoService, TranslocoPipe } from '@jsverse/transloco';
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
              @if (isComplete()) {
                {{ 'currentMonth.savingsAllDone' | transloco }}
              } @else if (hasSavings()) {
                {{
                  'dashboard.savingsSummary'
                    | transloco: { count: checkedCount(), total: totalCount() }
                }}
              } @else {
                {{ 'currentMonth.savingsNone' | transloco }}
              }
            </p>
          </div>
        </div>
        <button matButton (click)="viewSavingsGoals.emit()">
          {{ 'currentMonth.savingsViewGoals' | transloco }}
        </button>
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
          <div
            class="w-full h-2.5 bg-financial-savings/10 rounded-full overflow-hidden mb-4"
            role="progressbar"
            [attr.aria-valuenow]="progressPercentage()"
            aria-valuemin="0"
            aria-valuemax="100"
            [attr.aria-label]="savingsProgressLabel()"
          >
            <div
              class="h-full bg-financial-savings rounded-full motion-safe:transition-all motion-safe:duration-700"
              [style.width.%]="progressPercentage()"
            ></div>
          </div>
          <div class="flex justify-between items-baseline">
            <p class="text-body-medium text-on-surface">
              {{ 'currentMonth.savingsAmountText' | transloco }}
              <span class="font-bold text-financial-savings ph-no-capture">
                {{ totalRealized() | appCurrency: currency() : '1.0-0' }}
              </span>
              {{ 'dashboard.on' | transloco }}
              <span class="ph-no-capture">{{
                totalPlanned() | appCurrency: currency() : '1.0-0'
              }}</span>
              {{ 'currentMonth.savingsPlanned' | transloco }}
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
  readonly #transloco = inject(TranslocoService);

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

  protected readonly isComplete = computed(
    () => this.hasSavings() && this.progressPercentage() === 100,
  );

  protected readonly savingsProgressLabel = computed(() =>
    this.#transloco.translate('currentMonth.savingsProgress', {
      percent: this.progressPercentage(),
    }),
  );
}
