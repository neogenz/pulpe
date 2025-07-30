import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatRadioModule } from '@angular/material/radio';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { type BudgetTemplate } from '@pulpe/shared';

@Component({
  selector: 'pulpe-template-list-item',
  standalone: true,
  imports: [
    CurrencyPipe,
    MatCardModule,
    MatRadioModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <mat-card
      appearance="outlined"
      class="cursor-pointer transition-all hover:shadow-md"
      [class.ring-2]="isSelected()"
      [class.ring-primary]="isSelected()"
      [class.bg-surface-container-lowest]="isSelected()"
      (click)="selectTemplate.emit(template().id)"
    >
      <mat-card-content class="py-2 md:py-3">
        <div class="flex items-start gap-2 md:gap-3">
          <mat-radio-button
            [value]="template().id"
            [checked]="isSelected()"
            class="mt-1 min-w-[20px]"
          ></mat-radio-button>

          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between mb-1 gap-2">
              <div
                class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 min-w-0"
              >
                <h3 class="text-title-medium text-on-surface truncate">
                  {{ template().name }}
                </h3>
                @if (template().isDefault) {
                  <mat-chip
                    appearance="outlined"
                    class="!h-6 !min-h-6 flex-shrink-0"
                  >
                    <span class="text-label-small">Par défaut</span>
                  </mat-chip>
                }
              </div>
              <button
                matButton
                (click)="showDetails.emit(template()); $event.stopPropagation()"
                class="flex-shrink-0"
              >
                <span class="hidden sm:inline">Détails</span>
                <mat-icon class="sm:hidden">info</mat-icon>
              </button>
            </div>

            @if (template().description) {
              <p class="text-body-medium text-on-surface-variant mb-2">
                {{ template().description }}
              </p>
            }

            <div class="flex flex-col gap-2">
              @if (loading()) {
                <div class="flex items-center gap-2">
                  <mat-spinner diameter="16"></mat-spinner>
                  <span class="text-on-surface-variant">Chargement...</span>
                </div>
              } @else {
                <div
                  class="flex flex-col sm:flex-row gap-2 sm:gap-4 text-label-medium"
                >
                  <span class="text-success flex items-center gap-1">
                    <mat-icon class="text-label-small">trending_up</mat-icon>
                    <span class="whitespace-nowrap">
                      Revenus:
                      {{ totalIncome() | currency: 'CHF' : 'symbol' : '1.0-0' }}
                    </span>
                  </span>
                  <span class="text-error flex items-center gap-1">
                    <mat-icon class="text-label-small">trending_down</mat-icon>
                    <span class="whitespace-nowrap">
                      Dépenses:
                      {{
                        totalExpenses() | currency: 'CHF' : 'symbol' : '1.0-0'
                      }}
                    </span>
                  </span>
                </div>
                <div class="flex items-center gap-1 mt-1">
                  <span
                    class="text-label-medium font-medium flex items-center gap-1"
                    [class.text-success]="remainingLivingAllowance() > 0"
                    [class.text-warning]="remainingLivingAllowance() === 0"
                    [class.text-error]="remainingLivingAllowance() < 0"
                  >
                    <mat-icon class="text-label-small"
                      >account_balance_wallet</mat-icon
                    >
                    <span class="whitespace-nowrap">
                      Reste à vivre:
                      {{
                        remainingLivingAllowance()
                          | currency: 'CHF' : 'symbol' : '1.0-0'
                      }}
                    </span>
                  </span>
                </div>
              }
            </div>
          </div>
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplateListItem {
  template = input.required<BudgetTemplate>();
  selectedTemplateId = input<string | null>(null);
  totalIncome = input<number>(0);
  totalExpenses = input<number>(0);
  remainingLivingAllowance = input<number>(0);
  loading = input<boolean>(false);

  selectTemplate = output<string>();
  showDetails = output<BudgetTemplate>();

  isSelected = computed(() => this.selectedTemplateId() === this.template().id);
}
