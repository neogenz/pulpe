import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRipple } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { FinancialKindDirective } from '@ui/financial-kind';
import type { BudgetLineConsumption } from '@core/budget/budget-line-consumption';
import type { BudgetLine } from 'pulpe-shared';

const MAX_VISIBLE_FORECASTS = 5;

@Component({
  selector: 'pulpe-dashboard-unchecked-forecasts',
  imports: [
    MatButtonModule,
    MatCheckboxModule,
    MatRipple,
    MatIconModule,
    DecimalPipe,
    FinancialKindDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col w-full h-full">
      <div class="mb-4 px-1 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0"
          >
            <mat-icon aria-hidden="true">checklist</mat-icon>
          </div>
          <div>
            <h2
              class="text-title-medium font-bold text-on-surface leading-tight"
            >
              Prévisions non pointées
            </h2>
            <p
              class="text-body-small text-on-surface-variant font-medium mt-0.5"
            >
              Sur le mois courant ({{ forecasts().length }})
            </p>
          </div>
        </div>
        @if (hasMore()) {
          <button matButton (click)="viewBudget.emit()">Voir tout</button>
        }
      </div>

      <div class="bg-surface-container-low rounded-3xl py-3 px-3 flex-1">
        @if (forecasts().length > 0) {
          <div class="flex flex-col gap-1">
            @for (forecast of displayedForecasts(); track forecast.id) {
              @let displayAmount =
                consumptions().get(forecast.id)?.remaining ?? forecast.amount;
              <div
                class="relative overflow-hidden flex items-center justify-between p-3 rounded-2xl hover:bg-on-surface/8 motion-safe:transition-colors cursor-pointer"
                matRipple
                (click)="toggleCheck.emit(forecast.id)"
                (keydown.enter)="toggleCheck.emit(forecast.id)"
                (keydown.space)="
                  toggleCheck.emit(forecast.id); $event.preventDefault()
                "
                tabindex="0"
                role="checkbox"
                [attr.aria-checked]="false"
                [attr.aria-label]="
                  forecast.name + ' — ' + displayAmount + ' CHF'
                "
              >
                <mat-checkbox
                  [checked]="false"
                  class="flex-1 min-w-0"
                  color="primary"
                  (click)="$event.stopPropagation()"
                  (change)="toggleCheck.emit(forecast.id)"
                >
                  <span
                    class="text-body-medium font-bold text-on-surface truncate block ml-1 ph-no-capture"
                  >
                    {{ forecast.name }}
                  </span>
                </mat-checkbox>
                <span
                  class="text-label-large whitespace-nowrap ml-4 font-semibold tabular-nums ph-no-capture"
                  [pulpeFinancialKind]="forecast.kind"
                >
                  {{ displayAmount | number: '1.2-2' : 'de-CH' }}
                  CHF
                </span>
              </div>
            }
          </div>
        } @else {
          <div
            class="p-8 flex flex-col items-center justify-center text-center h-full"
          >
            <div
              class="w-16 h-16 rounded-full bg-financial-income/10 text-financial-income flex items-center justify-center mb-4"
            >
              <mat-icon class="scale-150" aria-hidden="true">done_all</mat-icon>
            </div>
            <h3 class="text-title-medium font-bold text-on-surface mb-1">
              Tout est à jour !
            </h3>
            <p class="text-body-medium text-on-surface-variant">
              Tu as pointé toutes tes prévisions pour ce mois.
            </p>
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
export class DashboardUncheckedForecasts {
  readonly forecasts = input.required<BudgetLine[]>();
  readonly consumptions = input(new Map<string, BudgetLineConsumption>());
  readonly toggleCheck = output<string>();
  readonly viewBudget = output<void>();

  protected readonly hasMore = computed(
    () => this.forecasts().length > MAX_VISIBLE_FORECASTS,
  );

  protected readonly displayedForecasts = computed(() =>
    this.forecasts().slice(0, MAX_VISIBLE_FORECASTS),
  );
}
