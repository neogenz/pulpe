import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MonthCardItem } from './components/month-card-item';
import { MonthsLoading } from './components/months-loading';
import { MonthsError } from './components/months-error';
import { OtherMonthsState } from './services/other-months-state';
import { MatTabsModule } from '@angular/material/tabs';

@Component({
  selector: 'pulpe-other-months',
  providers: [OtherMonthsState],
  imports: [
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MonthCardItem,
    MonthsLoading,
    MonthsError,
    MatTabsModule,
  ],
  template: `
    <div class="flex flex-col 2xl:h-full gap-4 2xl:min-h-0">
      <header class="flex justify-between items-center">
        <h1 class="text-display-small">Autres mois</h1>
        <button
          matButton="filled"
          (click)="state.refreshData()"
          [disabled]="state.monthsData.isLoading()"
        >
          <mat-icon class="md:inline hidden">add_circle</mat-icon>
          <span class="md:hidden">Ajouter</span>
          <span class="hidden md:inline">Ajouter un mois</span>
        </button>
      </header>

      @switch (true) {
        @case (
          state.monthsData.status() === 'loading' ||
          state.monthsData.status() === 'reloading'
        ) {
          <pulpe-months-loading />
        }
        @case (state.monthsData.status() === 'error') {
          <pulpe-months-error (reload)="state.refreshData()" />
        }
        @case (
          state.monthsData.status() === 'resolved' ||
          state.monthsData.status() === 'local'
        ) {
          <mat-tab-group
            mat-stretch-tabs="false"
            mat-align-tabs="start"
            fitInkBarToContent
          >
            <mat-tab label="2025">
              <div class="pt-4">
                <div class="flex-1 overflow-auto">
                  @if (state.monthsData.value()?.length === 0) {
                    <div class="text-center py-8 text-gray-500">
                      <mat-icon class="text-6xl mb-4">calendar_month</mat-icon>
                      <p>Aucun mois trouvé</p>
                      <p class="text-sm">Créez votre premier budget mensuel</p>
                    </div>
                  } @else {
                    <div
                      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                    >
                      @for (
                        month of state.monthsData.value();
                        track month.budgetId
                      ) {
                        <pulpe-month-card-item
                          [displayName]="month.displayName"
                          [totalAmount]="0"
                          [id]="month.budgetId"
                        />
                      }
                    </div>
                  }
                </div>
              </div>
            </mat-tab>
            <mat-tab label="2026"> 2026 </mat-tab>
          </mat-tab-group>
        }
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class OtherMonths implements OnInit {
  state = inject(OtherMonthsState);

  ngOnInit(): void {
    this.state.refreshData();
  }
}
