import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppCurrencyPipe } from '@core/currency';
import { UserSettingsStore } from '@core/user-settings';
import { BudgetDetailsStore } from '../store/budget-details-store';
import { buildSpreadOccurrenceViewModels } from './spread-occurrence.view-model';

/**
 * PUL-17 Lot C — mobile bottom-sheet variant of the spread occurrences view.
 * Same data + view-model as the desktop side-panel; read-only.
 */
@Component({
  selector: 'pulpe-spread-occurrences-bottom-sheet',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    AppCurrencyPipe,
    TranslocoPipe,
    DatePipe,
  ],
  template: `
    <div class="flex flex-col gap-4 pb-6">
      <div
        class="w-9 h-1 bg-outline-variant rounded-sm mx-auto mt-3 mb-1"
      ></div>

      <!-- Header -->
      <div class="flex justify-between items-center gap-3">
        <div class="min-w-0 flex items-center gap-2">
          <mat-icon class="text-on-tertiary-container shrink-0">
            date_range
          </mat-icon>
          <h2 class="text-title-large text-on-surface m-0 ph-no-capture">
            {{
              'budgetLine.spread.panelTitle'
                | transloco: { count: occurrences().length }
            }}
          </h2>
        </div>
        <button
          matIconButton
          (click)="close()"
          [attr.aria-label]="'common.close' | transloco"
        >
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Body -->
      @if (store.isSpreadOccurrencesLoading()) {
        <div class="flex justify-center py-8">
          <mat-spinner diameter="36" />
        </div>
      } @else if (store.spreadOccurrencesError()) {
        <div class="text-center py-8 text-on-surface-variant">
          <mat-icon class="mb-2 opacity-50">error_outline</mat-icon>
          <p class="text-body-medium">
            {{ 'budgetLine.spread.loadError' | transloco }}
          </p>
        </div>
      } @else {
        <div class="flex flex-col gap-2 max-h-[55vh] overflow-y-auto">
          @for (vm of occurrences(); track vm.occurrence.budgetLineId) {
            <div
              class="flex items-center justify-between gap-3 rounded-lg p-3
                     bg-surface-container-low"
              [class.opacity-60]="vm.isPast"
              [attr.data-testid]="
                'spread-occurrence-' + vm.occurrence.budgetLineId
              "
              [attr.data-current]="vm.isCurrent"
              [attr.data-past]="vm.isPast"
            >
              <div class="min-w-0 flex items-center gap-2">
                <span
                  class="text-body-medium font-medium capitalize"
                  [class.line-through]="vm.isChecked"
                  [class.text-on-surface-variant]="vm.isChecked"
                >
                  {{ monthDate(vm.occurrence) | date: 'MMMM yyyy' }}
                </span>
                @if (vm.isCurrent) {
                  <span
                    class="text-label-small font-medium rounded-full px-2 py-0.5
                           bg-primary-container text-on-primary-container shrink-0"
                    data-testid="spread-current-marker"
                  >
                    {{ 'budgetLine.spread.currentMonth' | transloco }}
                  </span>
                }
              </div>
              <span
                class="ph-no-capture text-body-medium font-semibold whitespace-nowrap"
                [class.line-through]="vm.isChecked"
                [class.text-on-surface-variant]="vm.isChecked"
              >
                {{ vm.occurrence.amount | appCurrency: currency() : '1.2-2' }}
              </span>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpreadOccurrencesBottomSheet {
  readonly #bottomSheetRef = inject(
    MatBottomSheetRef<SpreadOccurrencesBottomSheet>,
  );
  readonly #userSettings = inject(UserSettingsStore);
  protected readonly store = inject(BudgetDetailsStore);
  protected readonly currency = this.#userSettings.currency;

  protected readonly occurrences = computed(() =>
    buildSpreadOccurrenceViewModels(
      this.store.spreadOccurrences(),
      this.#userSettings.payDayOfMonth(),
    ),
  );

  protected monthDate(occurrence: { month: number; year: number }): Date {
    return new Date(occurrence.year, occurrence.month - 1, 1);
  }

  protected close(): void {
    this.#bottomSheetRef.dismiss();
  }
}
