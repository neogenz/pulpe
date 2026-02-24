import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRipple } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { FinancialKindDirective } from '@ui/financial-kind';
import type { BudgetLine } from 'pulpe-shared';

@Component({
  selector: 'pulpe-dashboard-unchecked-forecasts',
  standalone: true,
  imports: [
    MatCheckboxModule,
    MatRipple,
    MatIconModule,
    DecimalPipe,
    FinancialKindDirective,
  ],
  template: `
    <div class="flex flex-col w-full h-full">
      <div class="mb-4 px-1 flex items-center gap-3">
        <div
          class="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0"
        >
          <mat-icon>checklist</mat-icon>
        </div>
        <div>
          <h2 class="text-title-medium font-bold text-on-surface leading-tight">
            Prévisions non cochées
          </h2>
          <p class="text-body-small text-on-surface-variant font-medium mt-0.5">
            Sur le mois courant ({{ forecasts().length }})
          </p>
        </div>
      </div>

      <div class="bg-surface-container-low rounded-3xl py-3 px-3 flex-1">
        @if (forecasts().length > 0) {
          <div class="flex flex-col gap-1">
            @for (forecast of forecasts(); track forecast.id) {
              <div
                class="relative overflow-hidden flex items-center justify-between p-3 rounded-2xl hover:bg-on-surface/8 transition-colors cursor-pointer"
                matRipple
                (click)="toggleCheck.emit(forecast.id)"
                (keydown.enter)="toggleCheck.emit(forecast.id)"
                tabindex="0"
                role="checkbox"
                [attr.aria-checked]="false"
                [attr.aria-label]="forecast.name"
              >
                <mat-checkbox
                  [checked]="false"
                  (change)="toggleCheck.emit(forecast.id)"
                  (click)="$event.stopPropagation()"
                  class="flex-1 min-w-0"
                  color="primary"
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
                  {{ forecast.amount | number: '1.2-2' : 'de-CH' }} CHF
                </span>
              </div>
            }
          </div>
        } @else {
          <div
            class="p-8 flex flex-col items-center justify-center text-center h-full"
          >
            <div
              class="w-16 h-16 rounded-full bg-success/10 text-success flex items-center justify-center mb-4"
            >
              <mat-icon class="scale-150">done_all</mat-icon>
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
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardUncheckedForecasts {
  readonly forecasts = input.required<BudgetLine[]>();
  readonly toggleCheck = output<string>();
}
