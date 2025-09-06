import { CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatTooltipModule } from '@angular/material/tooltip';
import { type TemplateViewModel } from './template-view-model';

@Component({
  selector: 'pulpe-template-list-item',
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
      (click)="selectTemplate.emit(templateViewModel().template.id)"
    >
      <mat-card-content class="py-3 md:py-4">
        <!-- Header with title and chip -->
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center gap-3">
            @let dataTestId =
              'template-radio-' + templateViewModel().template.id;
            <mat-radio-button
              [value]="templateViewModel().template.id"
              [checked]="isSelected()"
              class="flex-shrink-0"
              [attr.aria-label]="
                'Sélectionner ' + templateViewModel().template.name
              "
              [attr.data-testid]="dataTestId"
            ></mat-radio-button>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-title-medium text-on-surface">
                  {{ templateViewModel().template.name }}
                </h3>
                @if (templateViewModel().template.isDefault) {
                  <mat-chip appearance="outlined">
                    <span>Par défaut</span>
                  </mat-chip>
                }
              </div>
              @if (templateViewModel().template.description) {
                <p class="text-body-small text-on-surface-variant mt-1">
                  {{ templateViewModel().template.description }}
                </p>
              }
            </div>
          </div>
        </div>

        <!-- Financial details -->
        @if (templateViewModel().loading) {
          <!-- Enhanced Material Design 3 Loading State -->
          <div
            class="bg-surface-container-low rounded-corner-medium p-6 mx-2 mb-4"
          >
            <div
              class="flex flex-col items-center justify-center space-y-4 md:flex-row md:space-y-0 md:space-x-4 md:justify-start"
            >
              <mat-progress-spinner
                mode="indeterminate"
                aria-label="Calcul des données financières en cours"
                role="progressbar"
                class="pulpe-loading-indicator pulpe-loading-medium flex-shrink-0"
                [diameter]="24"
              ></mat-progress-spinner>
              <div class="text-center md:text-left">
                <div
                  class="text-body-medium text-on-surface font-medium"
                  aria-live="polite"
                >
                  Calcul en cours...
                </div>
                <div class="text-body-small text-on-surface-variant mt-1">
                  Analyse de vos données financières
                </div>
              </div>
            </div>
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
                {{
                  templateViewModel().totalIncome
                    | currency: 'CHF' : 'symbol' : '1.0-0'
                }}
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
                {{
                  templateViewModel().totalExpenses
                    | currency: 'CHF' : 'symbol' : '1.0-0'
                }}
              </span>
            </mat-list-item>

            <mat-divider></mat-divider>

            <!-- Living allowance -->
            <mat-list-item class="h-auto min-h-0 py-2 !px-0">
              <mat-icon matListItemIcon class="icon-filled !mr-4"
                >account_balance_wallet</mat-icon
              >
              <span matListItemTitle class="text-body-medium">Disponible</span>
              <span
                matListItemMeta
                class="text-body-medium font-medium"
                [class.text-primary]="
                  templateViewModel().remainingLivingAllowance > 0
                "
                [class.text-warning]="
                  templateViewModel().remainingLivingAllowance === 0
                "
                [class.text-error]="
                  templateViewModel().remainingLivingAllowance < 0
                "
              >
                {{
                  templateViewModel().remainingLivingAllowance
                    | currency: 'CHF' : 'symbol' : '1.0-0'
                }}
              </span>
            </mat-list-item>
          </mat-list>
        }

        <!-- Actions -->
        <div class="flex items-center justify-end">
          <button
            matButton
            (click)="
              showDetails.emit(templateViewModel()); $event.stopPropagation()
            "
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
          outlined-outline-color: var(--mat-sys-primary),
          outlined-outline-width: 2px,
        )
      );
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplateListItem {
  templateViewModel = input.required<TemplateViewModel>();
  isSelected = input<boolean>(false);

  selectTemplate = output<string>();
  showDetails = output<TemplateViewModel>();
}
