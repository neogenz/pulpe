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
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
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
    MatListModule,
    MatDividerModule,
  ],
  template: `
    <mat-card
      appearance="outlined"
      class="cursor-pointer transition-all hover:shadow-md template-card"
      [class.selected]="isSelected()"
      (click)="selectTemplate.emit(template().id)"
    >
      <mat-card-content class="py-3 md:py-4">
        <!-- Header with title and chip -->
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center gap-3">
            <mat-radio-button
              [value]="template().id"
              [checked]="isSelected()"
              class="flex-shrink-0"
              aria-label="Sélectionner {{ template().name }}"
            ></mat-radio-button>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-title-medium text-on-surface">
                  {{ template().name }}
                </h3>
                @if (template().isDefault) {
                  <mat-chip appearance="outlined">
                    <span>Par défaut</span>
                  </mat-chip>
                }
              </div>
              @if (template().description) {
                <p class="text-body-small text-on-surface-variant mt-1">
                  {{ template().description }}
                </p>
              }
            </div>
          </div>
        </div>

        <!-- Financial details -->
        @if (loading()) {
          <div class="flex items-center justify-center py-4">
            <mat-progress-spinner
              mode="indeterminate"
              aria-label="Chargement du modèle"
              role="progressbar"
              class="pulpe-loading-indicator pulpe-loading-small"
            ></mat-progress-spinner>
            <span class="text-on-surface-variant ml-2" aria-live="polite">
              Chargement...
            </span>
          </div>
        } @else {
          <mat-list class="pt-0">
            <!-- Income -->
            <mat-list-item class="h-auto min-h-0 py-2 !px-0">
              <mat-icon matListItemIcon class="icon-filled !mr-4"
                >trending_up</mat-icon
              >
              <span matListItemTitle class="text-body-medium"
                >Revenus mensuels</span
              >
              <span matListItemMeta class="text-body-medium font-medium">
                {{ totalIncome() | currency: 'CHF' : 'symbol' : '1.0-0' }}
              </span>
            </mat-list-item>

            <mat-divider></mat-divider>

            <!-- Expenses -->
            <mat-list-item class="h-auto min-h-0 py-2 !px-0">
              <mat-icon matListItemIcon class="icon-filled !mr-4"
                >trending_down</mat-icon
              >
              <span matListItemTitle class="text-body-medium"
                >Dépenses prévues</span
              >
              <span matListItemMeta class="text-body-medium font-medium">
                {{ totalExpenses() | currency: 'CHF' : 'symbol' : '1.0-0' }}
              </span>
            </mat-list-item>

            <mat-divider></mat-divider>

            <!-- Living allowance -->
            <mat-list-item class="h-auto min-h-0 py-2 !px-0">
              <mat-icon matListItemIcon class="icon-filled !mr-4"
                >account_balance_wallet</mat-icon
              >
              <span matListItemTitle class="text-body-medium"
                >Disponible à dépenser</span
              >
              <span
                matListItemMeta
                class="text-body-medium font-medium"
                [class.text-primary]="remainingLivingAllowance() > 0"
                [class.text-warning]="remainingLivingAllowance() === 0"
                [class.text-error]="remainingLivingAllowance() < 0"
              >
                {{
                  remainingLivingAllowance()
                    | currency: 'CHF' : 'symbol' : '1.0-0'
                }}
              </span>
            </mat-list-item>
          </mat-list>
        }

        <!-- Actions -->
        <div
          class="flex items-center justify-between mt-4 pt-3 border-t border-outline-variant"
        >
          <button
            matButton
            [color]="isSelected() ? 'primary' : undefined"
            class="mr-2"
          >
            <mat-icon>{{
              isSelected() ? 'check_circle' : 'radio_button_unchecked'
            }}</mat-icon>
            {{ isSelected() ? 'Sélectionné' : 'Utiliser ce modèle' }}
          </button>
          <button
            matButton
            (click)="showDetails.emit(template()); $event.stopPropagation()"
          >
            <mat-icon>info_outline</mat-icon>
            Détails
          </button>
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    @use '@angular/material' as mat;

    :host {
      display: block;
    }

    /* Custom card overrides for selected state */
    .template-card.selected {
      @include mat.card-overrides(
        (
          outlined-container-color: var(--mat-sys-surface-container-lowest),
          outlined-outline-color: var(--mat-sys-primary),
          outlined-outline-width: 2px,
        )
      );
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
