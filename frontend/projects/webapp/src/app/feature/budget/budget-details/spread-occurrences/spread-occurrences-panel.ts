import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppCurrencyPipe } from '@core/currency';
import { UserSettingsStore } from '@core/user-settings';
import { BudgetDetailsStore } from '../store/budget-details-store';
import { buildSpreadOccurrenceViewModels } from './spread-occurrence.view-model';

/**
 * PUL-17 Lot C — read-only cross-month view of a spread group's occurrences.
 *
 * Desktop side-panel (~480px, slides from the right). The mobile bottom-sheet
 * variant lives in `spread-occurrences-bottom-sheet.ts`; both read the same
 * occurrences from `BudgetDetailsStore` and share the view-model builder.
 */
@Component({
  selector: 'pulpe-spread-occurrences-panel',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    AppCurrencyPipe,
    TranslocoPipe,
    DatePipe,
  ],
  template: `
    <div class="h-full flex flex-col bg-surface">
      <!-- Header -->
      <div class="p-5 border-b border-outline-variant">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex items-center gap-3">
            <mat-icon class="text-on-tertiary-container shrink-0">
              date_range
            </mat-icon>
            <h2 class="text-title-large font-semibold ph-no-capture">
              {{
                'budgetLine.spread.panelTitle'
                  | transloco: { count: occurrences().length }
              }}
            </h2>
          </div>
          <button
            matIconButton
            (click)="close()"
            [matTooltip]="'common.close' | transloco"
            [attr.aria-label]="'common.close' | transloco"
            class="shrink-0"
          >
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <!-- Body -->
      <div class="flex-1 overflow-y-auto p-5">
        @if (store.isSpreadOccurrencesLoading()) {
          <div class="flex justify-center py-10">
            <mat-spinner diameter="36" />
          </div>
        } @else if (store.spreadOccurrencesError()) {
          <div class="text-center py-10 text-on-surface-variant">
            <mat-icon class="mb-2 opacity-50">error_outline</mat-icon>
            <p class="text-body-medium">
              {{ 'budgetLine.spread.loadError' | transloco }}
            </p>
          </div>
        } @else {
          <div class="flex flex-col gap-2">
            @for (vm of occurrences(); track vm.occurrence.budgetLineId) {
              <div
                class="flex items-center justify-between gap-3 rounded-xl p-4
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
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpreadOccurrencesPanel {
  readonly #dialogRef = inject(MatDialogRef<SpreadOccurrencesPanel>);
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
    this.#dialogRef.close();
  }
}
