import {
  ChangeDetectionStrategy,
  Component,
  inject,
  type OnInit,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MonthCardItem } from '../ui/month-card-item';
import { BaseLoading } from '@ui/loading';
import { MonthsError } from '../ui/budget-error';
import { BudgetState } from './budget-state';
import { MatTabsModule } from '@angular/material/tabs';
import { TitleDisplay } from '@core/routing';
import { CreateBudgetDialogComponent } from './create-budget/budget-creation-dialog';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { ROUTES } from '@core/routing';

@Component({
  selector: 'pulpe-other-months',
  imports: [
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MonthCardItem,
    BaseLoading,
    MonthsError,
    MatTabsModule,
  ],
  template: `
    <div class="flex flex-col 2xl:h-full gap-4 2xl:min-h-0">
      <header class="flex justify-between items-center">
        <h1 class="text-display-small">
          {{ titleDisplay.currentTitle() }}
        </h1>
        <button
          matButton="filled"
          (click)="openCreateBudgetDialog()"
          [disabled]="state.monthsData.isLoading()"
          data-testid="create-budget-btn"
        >
          <mat-icon class="md:inline hidden">add_circle</mat-icon>
          <span class="md:hidden">Ajouter</span>
          <span class="hidden md:inline">Ajouter un budget</span>
        </button>
      </header>

      @switch (true) {
        @case (
          state.monthsData.status() === 'loading' ||
          state.monthsData.status() === 'reloading'
        ) {
          <pulpe-base-loading
            message="Chargement des données mensuelles..."
            size="large"
            testId="months-loading"
          />
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
            [selectedIndex]="state.selectedYearIndex()"
            (selectedIndexChange)="onTabChange($event)"
          >
            @for (year of state.availableYears(); track year) {
              <mat-tab [label]="year.toString()">
                <div class="pt-4">
                  <div class="flex-1 overflow-auto">
                    @if ((state.budgetsByYear().get(year) ?? []).length === 0) {
                      <div class="text-center py-8 text-gray-500">
                        <mat-icon class="text-display-small mb-4"
                          >calendar_month</mat-icon
                        >
                        <p>Aucun mois trouvé pour {{ year }}</p>
                        <p class="text-body-small">
                          Créez votre premier budget pour cette année
                        </p>
                      </div>
                    } @else {
                      <div
                        class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                      >
                        @for (
                          month of state.budgetsByYear().get(year) ?? [];
                          track month.budgetId
                        ) {
                          <pulpe-month-card-item
                            [displayName]="month.displayName"
                            [totalAmount]="month.endingBalance"
                            [id]="month.budgetId"
                            (detailsClick)="navigateToDetails($event)"
                          />
                        }
                      </div>
                    }
                  </div>
                </div>
              </mat-tab>
            } @empty {
              <mat-tab label="Aucun budget">
                <div class="pt-4">
                  <div class="text-center py-8 text-gray-500">
                    <mat-icon class="text-display-small mb-4"
                      >calendar_month</mat-icon
                    >
                    <p>Aucun budget trouvé</p>
                    <p class="text-body-small">
                      Créez votre premier budget mensuel
                    </p>
                  </div>
                </div>
              </mat-tab>
            }
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
  protected readonly state = inject(BudgetState);
  protected readonly titleDisplay = inject(TitleDisplay);
  readonly #dialog = inject(MatDialog);
  readonly #router = inject(Router);

  ngOnInit(): void {
    this.state.refreshData();
  }

  async openCreateBudgetDialog(): Promise<void> {
    const dialogRef = this.#dialog.open(CreateBudgetDialogComponent, {
      width: '600px',
      maxWidth: '90vw',
      disableClose: false,
    });

    const result = await firstValueFrom(dialogRef.afterClosed());

    // Only refresh data if budget was successfully created
    if (result?.success) {
      this.state.refreshData();
    }
  }

  onTabChange(selectedIndex: number): void {
    const availableYears = this.state.availableYears();
    if (selectedIndex >= 0 && selectedIndex < availableYears.length) {
      this.state.setSelectedYear(availableYears[selectedIndex]);
    }
  }

  navigateToDetails(budgetId: string): void {
    this.#router.navigate([ROUTES.APP, ROUTES.BUDGET, budgetId]);
  }
}
