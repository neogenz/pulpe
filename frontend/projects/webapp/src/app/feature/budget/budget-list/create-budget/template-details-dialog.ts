import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { TranslocoPipe } from '@jsverse/transloco';
import { type BudgetTemplate, type TemplateLine } from 'pulpe-shared';
import { AppCurrencyPipe } from '@core/currency';
import { UserSettingsStore } from '@core/user-settings';

export interface TemplateDetailsDialogData {
  template: BudgetTemplate;
  templateLines: TemplateLine[]; // Lignes du template passées depuis le cache
}

@Component({
  selector: 'pulpe-template-details-dialog',

  imports: [
    TranslocoPipe,
    AppCurrencyPipe,
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

      @let lines = templateLines;
      @if (lines.length > 0) {
        <!-- Summary Section -->
        <div class="flex justify-between mb-4">
          <div class="flex flex-col">
            <div>{{ 'template.totalIncome' | transloco }}</div>
            <div class="ph-no-capture text-financial-income text-label-large">
              {{ totalIncome | appCurrency: currency() }}
            </div>
          </div>
          <div class="flex flex-col">
            <div>{{ 'template.totalExpenses' | transloco }}</div>
            <div class="ph-no-capture text-financial-negative text-label-large">
              {{ totalExpenses | appCurrency: currency() }}
            </div>
          </div>
        </div>

        <mat-divider></mat-divider>

        <!-- Lines List -->
        <mat-list>
          @for (line of lines; track line.id) {
            <mat-list-item>
              <div class="flex flex-row justify-between items-end gap-4">
                <div class="flex flex-col flex-1 min-w-0">
                  <div
                    class="ph-no-capture text-body-medium font-medium truncate"
                  >
                    {{ line.name }}
                  </div>
                  @if (line.description) {
                    <div
                      class="text-body-small text-on-surface-variant truncate"
                    >
                      {{ line.description }}
                    </div>
                  }
                </div>
                <div
                  class="ph-no-capture text-body-medium font-medium shrink-0"
                  [class.text-financial-savings]="line.kind === 'saving'"
                  [class.text-financial-negative]="line.kind === 'expense'"
                  [class.text-financial-income]="line.kind === 'income'"
                >
                  {{ line.kind === 'income' ? '+' : '-' }}
                  {{ line.amount | appCurrency: currency() }}
                </div>
              </div>
            </mat-list-item>
            @if (!$last) {
              <mat-divider></mat-divider>
            }
          }
        </mat-list>

        <!-- Net Balance -->
        <mat-divider class="mb-2!"></mat-divider>
        <div class="flex justify-between text-body-medium font-medium">
          <span>{{ 'template.netBalanceLabel' | transloco }}</span>
          <span class="ph-no-capture">
            {{ netBalance | appCurrency: currency() }}
          </span>
        </div>
      } @else {
        <!-- Empty State -->
        <div
          class="flex flex-col items-center justify-center min-h-[200px] text-on-surface-variant"
        >
          <mat-icon class="text-display-small mb-2">inbox</mat-icon>
          <p class="text-body-medium font-medium">
            {{ 'template.noForecastInTemplate' | transloco }}
          </p>
        </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton mat-dialog-close>
        {{ 'common.close' | transloco }}
      </button>
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
  readonly #userSettings = inject(UserSettingsStore);
  protected readonly currency = this.#userSettings.currency;
  readonly data = inject<TemplateDetailsDialogData>(MAT_DIALOG_DATA);

  readonly templateLines = this.data.templateLines;
  readonly totalIncome = this.templateLines
    .filter((line) => line.kind === 'income')
    .reduce((sum, line) => sum + line.amount, 0);

  readonly totalExpenses = this.templateLines
    .filter((line) => line.kind === 'expense' || line.kind === 'saving')
    .reduce((sum, line) => sum + line.amount, 0);
  readonly netBalance = this.totalIncome - this.totalExpenses;
}
