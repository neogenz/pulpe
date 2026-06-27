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
import { CURRENCY_CONFIG } from '@core/currency';
import { UserSettingsStore } from '@core/user-settings';
import { SpreadOccurrencesList } from '@ui/spread-occurrences-list';
import { BudgetDetailsStore } from '../store/budget-details-store';

/**
 * PUL-17 Lot C — read-only cross-month view of a spread group's occurrences.
 *
 * Thin desktop side-panel shell (~480px, slides from the right) over the shared
 * `pulpe-spread-occurrences-list`: header + close + loading/error, then the ui
 * list. The mobile bottom-sheet variant lives in
 * `spread-occurrences-bottom-sheet.ts`; both read the same occurrences from
 * `BudgetDetailsStore` and share the view-model builder.
 */
@Component({
  selector: 'pulpe-spread-occurrences-panel',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    TranslocoPipe,
    SpreadOccurrencesList,
  ],
  template: `
    <div class="h-full flex flex-col bg-surface">
      <!-- Header -->
      <div class="p-5 border-b border-outline-variant">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex items-center gap-3">
            <mat-icon class="text-primary shrink-0">timelapse</mat-icon>
            <h2 class="text-title-large font-semibold ph-no-capture">
              {{
                'budgetLine.spread.panelTitle'
                  | transloco: { count: store.spreadOccurrences().length }
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
          <pulpe-spread-occurrences-list
            [occurrences]="occurrences()"
            [tracker]="tracker()"
            [currency]="currency()"
            [locale]="locale()"
            [isCurrentPeriod]="isCurrentPeriod()"
          />
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
    this.#dialogRef.close();
  }
}
