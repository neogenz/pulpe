import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { OtherMonthsApi, type MonthInfo } from './other-months-api';
import { MonthCardItem } from './components/month-card-item';

@Component({
  selector: 'pulpe-other-months',
  imports: [MatIconModule, MatButtonModule, MatCardModule, MonthCardItem],
  template: `
    <div class="flex flex-col 2xl:h-full gap-4 2xl:min-h-0">
      <header class="flex justify-between items-center">
        <h1 class="text-display-small">Autres mois</h1>
        <button matButton="filled">
          <mat-icon>add_circle</mat-icon>
          Ajouter un mois
        </button>
      </header>

      <div class="flex-1 overflow-auto">
        @if (months().length === 0) {
          <div class="text-center py-8 text-gray-500">
            <mat-icon class="text-6xl mb-4">calendar_month</mat-icon>
            <p>Aucun mois trouvé</p>
            <p class="text-sm">Créez votre premier budget mensuel</p>
          </div>
        } @else {
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            @for (month of months(); track month.budgetId) {
              <pulpe-month-card-item
                [month]="month.month"
                [totalAmount]="0"
                [id]="month.budgetId"
              />
            }
          </div>
        }
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class OtherMonths {
  private readonly otherMonthsApi = inject(OtherMonthsApi);

  months = signal<MonthInfo[]>([]);

  constructor() {
    this.loadMonths();
  }

  private loadMonths(): void {
    this.otherMonthsApi
      .getExistingMonthsBudgets$()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (months) => this.months.set(months),
        error: (error) => {
          console.error('Erreur lors du chargement des mois:', error);
          this.months.set([]);
        },
      });
  }
}
