import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { type BudgetTemplate, type TemplateLine } from '@pulpe/shared';

export interface TemplateDetailsDialogData {
  template: BudgetTemplate;
  templateLines: TemplateLine[]; // Lignes du template passées depuis le cache
}

@Component({
  selector: 'pulpe-template-details-dialog',

  imports: [
    CurrencyPipe,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatDividerModule,
  ],
  template: `
    <h2 mat-dialog-title class="text-headline-small">
      {{ data.template.name }}
    </h2>

    <mat-dialog-content>
      @if (data.template.description) {
        <p class="mb-4">
          {{ data.template.description }}
        </p>
      }

      @let lines = templateLines();
      @if (lines.length > 0) {
        <!-- Summary Section -->
        <div class="flex justify-between mb-4">
          <div class="flex flex-col">
            <div>Revenus total:</div>
            <div class="ph-no-capture text-financial-income text-label-large">
              {{
                totalIncome() | currency: 'CHF' : 'symbol' : '1.2-2' : 'de-CH'
              }}
            </div>
          </div>
          <div class="flex flex-col">
            <div>Dépenses total:</div>
            <div class="ph-no-capture text-financial-negative text-label-large">
              {{
                totalExpenses() | currency: 'CHF' : 'symbol' : '1.2-2' : 'de-CH'
              }}
            </div>
          </div>
        </div>

        <mat-divider></mat-divider>

        <!-- Lines List -->
        <mat-list>
          @for (line of lines; track line.id) {
            <mat-list-item
              [style.--mat-list-list-item-trailing-supporting-text-color]="
                line.kind === 'income'
                  ? 'var(--pulpe-financial-income)'
                  : line.kind === 'saving'
                    ? 'var(--pulpe-financial-savings)'
                    : 'var(--pulpe-financial-negative)'
              "
            >
              <span matListItemTitle class="ph-no-capture truncate">
                {{ line.name }}
              </span>
              @if (line.description) {
                <span
                  matListItemLine
                  class="text-body-small text-on-surface-variant truncate"
                >
                  {{ line.description }}
                </span>
              }
              <span matListItemMeta class="ph-no-capture">
                {{ line.kind === 'income' ? '+' : '-' }}
                {{
                  line.amount | currency: 'CHF' : 'symbol' : '1.2-2' : 'de-CH'
                }}
              </span>
            </mat-list-item>
            @if (!$last) {
              <mat-divider></mat-divider>
            }
          }
        </mat-list>

        <!-- Net Balance -->
        <mat-divider class="mb-2!"></mat-divider>
        <div class="flex justify-between text-body-medium font-medium">
          <span>Solde net:</span>
          <span class="ph-no-capture">
            {{ netBalance() | currency: 'CHF' : 'symbol' : '1.2-2' : 'de-CH' }}
          </span>
        </div>
      } @else {
        <!-- Empty State -->
        <div
          class="flex flex-col items-center justify-center min-h-[200px] text-on-surface-variant"
        >
          <mat-icon class="text-display-small mb-2">inbox</mat-icon>
          <p class="text-body-medium font-medium">
            Aucune prévision dans ce modèle
          </p>
        </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton mat-dialog-close>Fermer</button>
    </mat-dialog-actions>
  `,
  styles: `
    mat-dialog-content {
      min-width: 400px;
      max-width: 600px;
    }

    @media (max-width: 640px) {
      mat-dialog-content {
        min-width: unset;
        width: 100%;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplateDetailsDialog {
  readonly data = inject<TemplateDetailsDialogData>(MAT_DIALOG_DATA);

  readonly templateLines = computed(() => this.data.templateLines);

  readonly totalIncome = computed(() => {
    const lines = this.templateLines();
    return lines
      .filter((line) => line.kind === 'income')
      .reduce((sum, line) => sum + line.amount, 0);
  });

  readonly totalExpenses = computed(() => {
    const lines = this.templateLines();
    return lines
      .filter((line) => line.kind === 'expense' || line.kind === 'saving')
      .reduce((sum, line) => sum + line.amount, 0);
  });

  readonly netBalance = computed(() => {
    return this.totalIncome() - this.totalExpenses();
  });
}
