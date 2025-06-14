import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { FinancialOverview } from './components/financial-overview';
import { CurrentMonthState } from './services/current-month-state';
import { MatIconModule } from '@angular/material/icon';
import { FixedTransactionsList } from './components/fixed-transactions-list';

@Component({
  selector: 'pulpe-current-month',
  imports: [
    FinancialOverview,
    MatProgressSpinner,
    DatePipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    FixedTransactionsList,
  ],
  template: `
    <div class="space-y-6">
      <header class="flex justify-between items-center">
        <h1 class="text-display-small">Budget du mois courant</h1>
        <button
          matButton
          (click)="state.dashboardData.reload()"
          [disabled]="state.dashboardData.isLoading()"
        >
          <mat-icon>refresh</mat-icon>
          Actualiser
        </button>
      </header>

      @switch (true) {
        @case (
          state.dashboardData.status() === 'loading' ||
          state.dashboardData.status() === 'reloading'
        ) {
          <div class="flex justify-center items-center h-64">
            <div
              class="text-center flex flex-col gap-4 justify-center items-center"
            >
              <mat-progress-spinner diameter="48" mode="indeterminate" />
              <p class="text-body-large text-on-surface-variant">
                Chargement du budget...
              </p>
            </div>
          </div>
        }
        @case (state.dashboardData.status() === 'error') {
          <div class="flex flex-col items-center justify-center">
            <mat-card appearance="outlined">
              <mat-card-header>
                <mat-card-title>
                  <div class="flex items-center justify-center gap-2">
                    <mat-icon>error_outline</mat-icon>
                    Impossible de charger vos données
                  </div>
                </mat-card-title>
              </mat-card-header>
              <mat-card-content>
                <p class="pt-4">
                  Une erreur s'est produite lors du chargement de vos
                  informations budgétaires. Vos données sont en sécurité.
                </p>
              </mat-card-content>
              <mat-card-actions align="end">
                <button (click)="state.dashboardData.reload()" matButton>
                  Réessayer
                </button>
              </mat-card-actions>
            </mat-card>
          </div>
        }
        @case (state.dashboardData.status() === 'resolved') {
          @if (state.dashboardData.value()?.budget) {
            <pulpe-financial-overview
              [incomeAmount]="state.incomeAmount()"
              [expenseAmount]="state.expenseAmount()"
              [savingsAmount]="state.savingsAmount()"
              [negativeAmount]="state.negativeAmount()"
            />
            <div class="flex bg-red-300 h-full w-full"></div>
          } @else {
            <div class="empty-state">
              <h2 class="text-title-large mt-4">Aucun budget trouvé</h2>
              <p class="text-body-large text-on-surface-variant mt-2">
                Aucun budget n'a été créé pour
                {{ state.today() | date: 'MMMM yyyy' }}.
              </p>
            </div>
          }
        }
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: 'block';
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class CurrentMonth implements OnInit {
  state = inject(CurrentMonthState);

  ngOnInit() {
    this.state.refreshData();
  }
}
