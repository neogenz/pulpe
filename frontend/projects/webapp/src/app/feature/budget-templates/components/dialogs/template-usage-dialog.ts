import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';

import { Router } from '@angular/router';
import { A11yModule } from '@angular/cdk/a11y';

export interface TemplateUsageDialogData {
  templateId: string;
  templateName: string;
}

interface BudgetUsage {
  id: string;
  month: number;
  year: number;
  description: string;
}

@Component({
  selector: 'pulpe-template-usage-dialog',

  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatCardModule,
    A11yModule,
  ],
  template: `
    <h2 mat-dialog-title class="text-headline-small">Suppression impossible</h2>

    <mat-dialog-content>
      @if (isLoading()) {
        <div
          class="flex flex-col items-center justify-center py-8"
          role="status"
          aria-live="polite"
        >
          <mat-progress-spinner
            [diameter]="40"
            class="flex-shrink-0"
            mode="indeterminate"
            aria-label="Vérification en cours"
          ></mat-progress-spinner>
          <p class="mt-4 text-body-medium text-on-surface-variant">
            Vérification en cours...
          </p>
        </div>
      } @else if (hasError()) {
        <div class="text-error text-body-large" role="alert">
          <p>Une erreur est survenue lors de la vérification.</p>
        </div>
      } @else {
        <div class="flex flex-col gap-4">
          <p class="text-body-large text-on-surface">
            Le modèle « {{ data.templateName }} » ne peut pas être supprimé car
            il est utilisé dans {{ budgetCount() }} budget{{
              budgetCount() > 1 ? 's' : ''
            }}.
          </p>

          @if (budgets().length > 0) {
            <div class="mt-4 space-y-3">
              <p class="text-label-large text-on-surface-variant">
                Budgets concernés :
              </p>
              <div class="grid gap-3">
                @for (budget of budgets(); track budget.id) {
                  <mat-card
                    appearance="outlined"
                    class="cursor-pointer transition-all hover:bg-surface-container-highest focus-visible:outline-primary"
                    (click)="navigateToBudget(budget)"
                    role="button"
                    tabindex="0"
                    (keydown.enter)="navigateToBudget(budget)"
                    (keydown.space)="navigateToBudget(budget)"
                  >
                    <mat-card-content class="!p-4">
                      <div class="flex items-center gap-3">
                        <div
                          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--mat-sys-corner-full)] bg-primary-container"
                        >
                          <mat-icon class="text-on-primary-container">
                            calendar_today
                          </mat-icon>
                        </div>
                        <div class="flex-1">
                          <div class="text-title-medium text-on-surface">
                            {{ getMonthName(budget.month) }} {{ budget.year }}
                          </div>
                          @if (budget.description) {
                            <div
                              class="text-body-small text-on-surface-variant"
                            >
                              {{ budget.description }}
                            </div>
                          }
                        </div>
                        <mat-icon class="shrink-0 text-on-surface-variant">
                          chevron_right
                        </mat-icon>
                      </div>
                    </mat-card-content>
                  </mat-card>
                }
              </div>
            </div>
          }

          <div
            class="mt-4 rounded-[var(--mat-sys-corner-medium)] bg-tertiary-container p-4 text-on-tertiary-container"
          >
            <div class="flex gap-2">
              <mat-icon class="shrink-0 text-xl" aria-hidden="true"
                >info</mat-icon
              >
              <p class="text-body-medium">
                Pour supprimer ce modèle, vous devez d'abord supprimer ou
                modifier les budgets qui l'utilisent.
              </p>
            </div>
          </div>
        </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton="filled" (click)="close()" cdkFocusInitial>
        Compris
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      mat-dialog-content {
        max-width: 600px;
        width: 100%;
        @media (max-width: 640px) {
          min-width: unset;
        }
        @media (min-width: 641px) {
          min-width: 400px;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplateUsageDialogComponent {
  readonly #dialogRef = inject(MatDialogRef<TemplateUsageDialogComponent>);
  readonly #router = inject(Router);
  readonly data = inject<TemplateUsageDialogData>(MAT_DIALOG_DATA);

  readonly isLoading = signal(false);
  readonly hasError = signal(false);
  readonly budgets = signal<BudgetUsage[]>([]);
  readonly budgetCount = signal(0);

  setUsageData(budgets: BudgetUsage[]): void {
    this.budgets.set(budgets);
    this.budgetCount.set(budgets.length);
    this.isLoading.set(false);
  }

  setError(): void {
    this.hasError.set(true);
    this.isLoading.set(false);
  }

  setLoading(): void {
    this.isLoading.set(true);
    this.hasError.set(false);
  }

  close(): void {
    this.#dialogRef.close();
  }

  navigateToBudget(budget: BudgetUsage): void {
    this.close();
    this.#router.navigate(['/budgets', budget.id]);
  }

  getMonthName(month: number): string {
    const monthNames = [
      'Janvier',
      'Février',
      'Mars',
      'Avril',
      'Mai',
      'Juin',
      'Juillet',
      'Août',
      'Septembre',
      'Octobre',
      'Novembre',
      'Décembre',
    ];
    return monthNames[month - 1] || '';
  }
}
