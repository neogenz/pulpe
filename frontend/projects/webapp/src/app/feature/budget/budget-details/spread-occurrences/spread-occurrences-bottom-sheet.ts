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
import { CURRENCY_CONFIG } from '@core/currency';
import { UserSettingsStore } from '@core/user-settings';
import { SpreadOccurrencesList } from '@ui/spread-occurrences-list';
import { BudgetDetailsStore } from '../store/budget-details-store';

/**
 * PUL-17 Lot C — mobile bottom-sheet variant of the spread occurrences view.
 * Thin shell over the shared `pulpe-spread-occurrences-list` (compact density);
 * same data + view-model as the desktop side-panel; read-only.
 */
@Component({
  selector: 'pulpe-spread-occurrences-bottom-sheet',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslocoPipe,
    SpreadOccurrencesList,
  ],
  template: `
    <div class="flex flex-col gap-4 pb-6">
      <div
        class="w-9 h-1 bg-outline-variant rounded-sm mx-auto mt-3 mb-1"
      ></div>

      <!-- Header -->
      <div class="flex justify-between items-center gap-3">
        <div class="min-w-0 flex items-center gap-2">
          <mat-icon class="text-primary shrink-0">timelapse</mat-icon>
          <h2 class="text-title-large text-on-surface m-0 ph-no-capture">
            {{
              'budgetLine.spread.panelTitle'
                | transloco: { count: store.spreadOccurrences().length }
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
        <div class="max-h-[60vh] overflow-y-auto">
          <pulpe-spread-occurrences-list
            [occurrences]="occurrences()"
            [tracker]="tracker()"
            [currency]="currency()"
            [locale]="locale()"
            [isCurrentPeriod]="isCurrentPeriod()"
            density="compact"
          />
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
  // Date locale (fr-CH / fr-FR) for month names — NOT numberLocale (de-CH),
  // which would render the spread months in German ("Juni" instead of "juin").
  protected readonly locale = computed(
    () => CURRENCY_CONFIG[this.currency()].locale,
  );

  // PUL-17 — derived once in the store (single source for every detail surface).
  protected readonly occurrences = this.store.spreadOccurrenceViewModels;
  protected readonly tracker = this.store.spreadTracker;
  protected readonly isCurrentPeriod = this.store.isViewingSpreadCurrentPeriod;

  protected close(): void {
    this.#bottomSheetRef.dismiss();
  }
}
