import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
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
  standalone: true,
  imports: [
    CurrencyPipe,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatDividerModule,
  ],
  template: `
    <h2 mat-dialog-title>Détails du modèle : {{ data.template.name }}</h2>

    <mat-dialog-content>
      @if (data.template.description) {
        <p class="text-body-large text-on-surface-variant mb-4">
          {{ data.template.description }}
        </p>
      }

      <div class="min-h-[200px]">
        @let lines = templateLines();
        @if (lines.length > 0) {
          <div class="space-y-4">
            <div class="mb-4">
              <div class="flex justify-between text-label-large mb-2">
                <span class="text-success">
                  Total revenus:
                  {{ totalIncome() | currency: 'CHF' : 'symbol' : '1.0-2' }}
                </span>
                <span class="text-error">
                  Total dépenses:
                  {{ totalExpenses() | currency: 'CHF' : 'symbol' : '1.0-2' }}
                </span>
              </div>
              <mat-divider></mat-divider>
            </div>

            <mat-list class="max-h-[400px] overflow-y-auto">
              @for (line of lines; track line.id) {
                <mat-list-item class="h-auto py-2">
                  <div class="flex justify-between items-center w-full">
                    <div class="flex-1">
                      <div class="text-body-large font-medium">
                        {{ line.name }}
                      </div>
                      @if (line.description) {
                        <div class="text-body-small text-on-surface-variant">
                          {{ line.description }}
                        </div>
                      }
                    </div>
                    <div
                      class="ml-4 text-body-large font-medium"
                      [class.text-success]="line.kind === 'income'"
                      [class.text-error]="line.kind === 'expense'"
                      [class.text-primary]="line.kind === 'saving'"
                    >
                      {{ line.kind === 'income' ? '+' : '-' }}
                      {{ line.amount | currency: 'CHF' : 'symbol' : '1.0-2' }}
                    </div>
                  </div>
                </mat-list-item>
                @if (!$last) {
                  <mat-divider></mat-divider>
                }
              }
            </mat-list>

            <mat-divider></mat-divider>
            <div class="flex justify-between text-title-medium pt-2">
              <span>Solde net:</span>
              <span
                [class.text-success]="netBalance() >= 0"
                [class.text-error]="netBalance() < 0"
              >
                {{ netBalance() | currency: 'CHF' : 'symbol' : '1.0-2' }}
              </span>
            </div>
          </div>
        } @else {
          <div
            class="flex flex-col items-center justify-center h-[200px] text-on-surface-variant"
          >
            <mat-icon class="text-display-small mb-2">inbox</mat-icon>
            <p class="text-label-large">Aucune prévision dans ce modèle</p>
          </div>
        }
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton mat-dialog-close>Fermer</button>
    </mat-dialog-actions>
  `,
  styles: `
    :host {
      display: block;
    }

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

  readonly templateLines = signal<TemplateLine[]>([]);

  readonly totalIncome = signal<number>(0);
  readonly totalExpenses = signal<number>(0);
  readonly netBalance = signal<number>(0);

  constructor() {
    // Utiliser directement les templateLines passées
    this.useProvidedTemplateLines(this.data.templateLines);
  }

  private useProvidedTemplateLines(lines: TemplateLine[]): void {
    this.templateLines.set(lines);

    const income = lines
      .filter((line) => line.kind === 'income')
      .reduce((sum, line) => sum + line.amount, 0);

    const expenses = lines
      .filter((line) => line.kind === 'expense' || line.kind === 'saving')
      .reduce((sum, line) => sum + line.amount, 0);

    this.totalIncome.set(income);
    this.totalExpenses.set(expenses);
    this.netBalance.set(income - expenses);
  }
}
