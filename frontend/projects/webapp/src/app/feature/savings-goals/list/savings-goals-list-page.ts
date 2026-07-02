import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { type SavingsGoal } from 'pulpe-shared';
import { TitleDisplay } from '@core/routing';
import { BaseLoading } from '@ui/loading';
import { StateCard } from '@ui/state-card/state-card';
import { SavingsGoalStore } from '../services/savings-goals-store';
import { SavingsGoalsDialogService } from '../services/savings-goals-dialog.service';
import { SavingsGoalCard } from '../components/savings-goal-card';

@Component({
  selector: 'pulpe-savings-goals-list-page',
  imports: [
    MatButtonModule,
    MatIconModule,
    TranslocoPipe,
    BaseLoading,
    StateCard,
    SavingsGoalCard,
  ],
  template: `
    <div
      class="flex flex-col gap-4 h-full min-w-0"
      data-testid="savings-goals-page"
    >
      <header class="pulpe-page-header" data-testid="page-header">
        <div class="min-w-0">
          <h1
            class="text-headline-medium md:text-display-small truncate min-w-0 flex-shrink"
            data-testid="page-title"
          >
            {{ title.currentTitle() }}
          </h1>
        </div>
        <div class="flex gap-2 items-center shrink-0 ml-auto">
          <button
            matButton="filled"
            class="shrink-0"
            (click)="onCreate()"
            data-testid="create-savings-goal-button"
          >
            <mat-icon>add_circle</mat-icon>
            {{ 'savingsGoals.addGoal' | transloco }}
          </button>
        </div>
      </header>

      @switch (store.savingsGoals.status()) {
        @case ('loading') {
          <pulpe-base-loading
            [message]="'common.loading' | transloco"
            size="large"
            testId="savings-goals-loading"
          />
        }
        @case ('error') {
          <pulpe-state-card
            variant="error"
            [title]="'common.error' | transloco"
            [message]="'savingsGoals.loadError' | transloco"
            [actionLabel]="'common.retry' | transloco"
            (action)="store.refresh()"
            testId="savings-goals-error"
          />
        }
        @default {
          @if (store.isEmpty()) {
            <pulpe-state-card
              variant="empty"
              [title]="'savingsGoals.emptyTitle' | transloco"
              [message]="'savingsGoals.emptyMessage' | transloco"
              [actionLabel]="'savingsGoals.addGoal' | transloco"
              (action)="onCreate()"
              testId="savings-goals-empty"
            />
          } @else {
            <div
              class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              data-testid="savings-goals-list"
            >
              @for (goal of store.goals(); track goal.id) {
                <pulpe-savings-goal-card
                  [goal]="goal"
                  (edit)="onEdit($event)"
                />
              }
            </div>
          }
        }
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
      position: relative;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class SavingsGoalsListPage {
  protected readonly store = inject(SavingsGoalStore);
  protected readonly title = inject(TitleDisplay);
  readonly #dialogs = inject(SavingsGoalsDialogService);
  readonly #snackBar = inject(MatSnackBar);
  readonly #transloco = inject(TranslocoService);

  constructor() {
    this.store.refresh();
  }

  protected async onCreate(): Promise<void> {
    const result = await this.#dialogs.openCreate();
    if (!result) return;
    try {
      await this.store.addGoal(result);
    } catch (error) {
      this.#showError(error);
    }
  }

  protected async onEdit(goal: SavingsGoal): Promise<void> {
    const result = await this.#dialogs.openEdit(goal);
    if (!result) return;
    try {
      if (this.#dialogs.isDeleteRequest(result)) {
        if (await this.#dialogs.confirmDelete()) {
          await this.store.removeGoal(goal.id);
        }
        return;
      }
      await this.store.editGoal(goal.id, result);
    } catch (error) {
      this.#showError(error);
    }
  }

  #showError(error: unknown): void {
    const message =
      error instanceof Error
        ? error.message
        : this.#transloco.translate('common.error');
    this.#snackBar.open(message, this.#transloco.translate('common.close'), {
      duration: 5000,
      panelClass: ['bg-error-container', 'text-on-error-container'],
    });
  }
}
