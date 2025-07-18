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
      <mat-card-content class="py-3">
        <div class="flex items-start gap-3">
          <mat-radio-button
            [value]="template().id"
            [checked]="isSelected()"
            class="mt-1"
          ></mat-radio-button>

          <div class="flex-1">
            <div class="flex items-center justify-between mb-1">
              <div class="flex items-center gap-2">
                <h3 class="text-title-medium text-on-surface">
                  {{ template().name }}
                </h3>
                @if (template().isDefault) {
                  <mat-chip appearance="outlined" class="!h-6 !min-h-6">
                    <span class="text-label-small">Par défaut</span>
                  </mat-chip>
                }
              </div>
              <button
                mat-button
                type="button"
                (click)="showDetails.emit(template()); $event.stopPropagation()"
                class="!min-w-0"
              >
                Détails
              </button>
            </div>

            @if (template().description) {
              <p class="text-body-medium text-on-surface-variant mb-2">
                {{ template().description }}
              </p>
            }

            <div class="flex gap-4 text-label-medium">
              @if (loading()) {
                <div class="flex items-center gap-2">
                  <mat-spinner diameter="16"></mat-spinner>
                  <span class="text-on-surface-variant">Chargement...</span>
                </div>
              } @else {
                <span class="text-success">
                  <mat-icon class="text-sm align-middle">trending_up</mat-icon>
                  Revenus:
                  {{ totalIncome() | currency: 'CHF' : 'symbol' : '1.0-0' }}
                </span>
                <span class="text-error">
                  <mat-icon class="text-sm align-middle"
                    >trending_down</mat-icon
                  >
                  Dépenses:
                  {{ totalExpenses() | currency: 'CHF' : 'symbol' : '1.0-0' }}
                </span>
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
  loading = input<boolean>(false);

  selectTemplate = output<string>();
  showDetails = output<BudgetTemplate>();

  isSelected = computed(() => this.selectedTemplateId() === this.template().id);
}
