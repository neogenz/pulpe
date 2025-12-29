import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { RolloverFormatPipe } from '@app/ui/rollover-format';
import {
  calculateAllConsumptions,
  type BudgetLineConsumption,
} from '@core/budget';
import { Logger } from '@core/logging/logger';
import {
  type BudgetLine,
  type BudgetLineUpdate,
  type TransactionKind,
} from '@pulpe/shared';
import {
  ConfirmationDialog,
  type ConfirmationDialogData,
} from '@ui/dialogs/confirmation-dialog';
import {
  RecurrenceLabelPipe,
  TransactionLabelPipe,
} from '@ui/transaction-display';
import { map } from 'rxjs/operators';
import { EditBudgetLineDialog } from '../edit-budget-line/edit-budget-line-dialog';
import { type BudgetLineViewModel } from '../models/budget-line-view-model';
import { type TransactionViewModel } from '../models/transaction-view-model';
import { BudgetTableDataProvider } from './budget-table-data-provider';
import {
  type BudgetLineTableItem,
  type TableItem,
} from './budget-table-models';
import type { BudgetTableViewMode } from './budget-table-view-mode';
import { BudgetTableViewToggle } from './budget-table-view-toggle';

@Component({
  selector: 'pulpe-budget-table',
  imports: [
    MatTableModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatBadgeModule,
    MatFormFieldModule,
    MatInputModule,
    MatChipsModule,
    MatMenuModule,
    MatTooltipModule,
    MatProgressBarModule,
    MatDividerModule,
    ReactiveFormsModule,
    RouterLink,
    CurrencyPipe,
    TransactionLabelPipe,
    RecurrenceLabelPipe,
    RolloverFormatPipe,
    BudgetTableViewToggle,
  ],
  template: `
    <mat-card appearance="outlined">
      <mat-card-header>
        <mat-card-title>Enveloppes budgétaires</mat-card-title>
        <mat-card-subtitle>
          Gérez vos prévisions et suivez vos dépenses
        </mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <pulpe-budget-table-view-toggle [(viewMode)]="viewMode" class="mb-4" />

        @if (isMobile()) {
          <!-- Mobile view - same layout for both modes, data adapts via viewMode -->
          <div class="flex flex-col gap-3">
            @for (item of budgetLineItems(); track item.data.id) {
              @let consumption = budgetLineConsumptions().get(item.data.id);
              @let percentage =
                calculatePercentage(
                  item.data.amount,
                  consumption?.consumed ?? 0
                );
              @let isExceeded =
                (consumption?.remaining ?? item.data.amount) < 0;

              <mat-card
                appearance="outlined"
                [class.opacity-50]="item.metadata.isLoading"
                [attr.data-testid]="
                  'envelope-card-' + (item.data.name | rolloverFormat)
                "
              >
                <mat-card-header class="flex justify-between items-start">
                  <div class="flex items-center gap-2 flex-1 min-w-0">
                    <mat-icon
                      class="text-base! shrink-0"
                      [class.text-financial-income]="
                        item.data.kind === 'income'
                      "
                      [class.text-financial-expense]="
                        item.data.kind === 'expense'
                      "
                      [class.text-financial-savings]="
                        item.data.kind === 'saving'
                      "
                      [matTooltip]="item.data.kind | transactionLabel"
                    >
                      {{ getKindIcon(item.data.kind) }}
                    </mat-icon>
                    <mat-card-title
                      class="text-title-medium! font-medium! truncate m-0"
                      [class.italic]="item.metadata.isRollover"
                      [class.text-financial-income]="
                        item.data.kind === 'income'
                      "
                      [class.text-financial-expense]="
                        item.data.kind === 'expense'
                      "
                      [class.text-financial-savings]="
                        item.data.kind === 'saving'
                      "
                    >
                      @if (
                        item.metadata.isRollover &&
                        getRolloverSourceBudgetId(item.data)
                      ) {
                        <a
                          [routerLink]="[
                            '/app/budget',
                            getRolloverSourceBudgetId(item.data),
                          ]"
                          class="text-primary"
                        >
                          {{ item.data.name | rolloverFormat }}
                        </a>
                      } @else {
                        {{ item.data.name | rolloverFormat }}
                      }
                    </mat-card-title>
                    @if (item.metadata.isPropagationLocked) {
                      <mat-icon
                        class="text-base! text-outline shrink-0"
                        matTooltip="Montants verrouillés"
                      >
                        lock
                      </mat-icon>
                    }
                  </div>

                  @if (!item.metadata.isRollover) {
                    <button
                      matIconButton
                      [matMenuTriggerFor]="cardActionMenu"
                      class="-mr-2 -mt-2"
                      [attr.data-testid]="'card-menu-' + item.data.id"
                    >
                      <mat-icon>more_vert</mat-icon>
                    </button>

                    <mat-menu #cardActionMenu="matMenu" xPosition="before">
                      <div
                        class="px-4 py-2 text-label-medium text-on-surface-variant max-w-48 truncate"
                        [matTooltip]="item.data.name"
                        matTooltipShowDelay="500"
                      >
                        {{ item.data.name }}
                      </div>
                      <mat-divider />
                      <button
                        mat-menu-item
                        (click)="addAllocatedTransaction(item.data)"
                        [attr.data-testid]="'add-transaction-' + item.data.id"
                      >
                        <mat-icon matMenuItemIcon>add</mat-icon>
                        <span>{{ getAllocationLabel(item.data.kind) }}</span>
                      </button>
                      <button
                        mat-menu-item
                        (click)="startEditBudgetLine(item)"
                        [attr.data-testid]="'edit-' + item.data.id"
                      >
                        <mat-icon matMenuItemIcon>edit</mat-icon>
                        <span>Éditer</span>
                      </button>
                      @if (item.metadata.canResetFromTemplate) {
                        <button
                          mat-menu-item
                          (click)="onResetFromTemplateClick(item)"
                          [attr.data-testid]="
                            'reset-from-template-' + item.data.id
                          "
                        >
                          <mat-icon matMenuItemIcon>refresh</mat-icon>
                          <span>Réinitialiser</span>
                        </button>
                      }
                      <button
                        mat-menu-item
                        (click)="delete.emit(item.data.id)"
                        [attr.data-testid]="'delete-' + item.data.id"
                        class="text-error"
                      >
                        <mat-icon matMenuItemIcon class="text-error"
                          >delete</mat-icon
                        >
                        <span>Supprimer</span>
                      </button>
                    </mat-menu>
                  }
                </mat-card-header>

                <mat-card-content>
                  <!-- Amount display - adapts based on transactions -->
                  <div class="mb-2">
                    @if (consumption && consumption.transactionCount > 0) {
                      <span
                        class="text-headline-medium font-bold"
                        [class.text-error]="isExceeded"
                      >
                        {{
                          consumption.remaining
                            | currency: 'CHF' : 'symbol' : '1.0-0'
                        }}
                      </span>
                      <span
                        class="text-label-medium text-on-surface-variant ml-2"
                      >
                        @if (isExceeded) {
                          dépassé
                        } @else {
                          reste sur
                          {{
                            item.data.amount
                              | currency: 'CHF' : 'symbol' : '1.0-0'
                          }}
                          prévu
                        }
                      </span>
                      <mat-progress-bar
                        mode="determinate"
                        [value]="percentage > 100 ? 100 : percentage"
                        [class.warn-bar]="percentage > 100"
                        class="mt-2 h-2! rounded-full"
                      />
                    } @else {
                      <span
                        class="text-headline-medium font-bold"
                        [class.text-financial-income]="
                          item.data.kind === 'income'
                        "
                        [class.text-financial-expense]="
                          item.data.kind === 'expense'
                        "
                        [class.text-financial-savings]="
                          item.data.kind === 'saving'
                        "
                      >
                        {{
                          item.data.amount
                            | currency: 'CHF' : 'symbol' : '1.0-0'
                        }}
                      </span>
                      <span
                        class="text-label-medium text-on-surface-variant ml-2"
                      >
                        prévu
                      </span>
                    }
                  </div>

                  <!-- Consumed + Transaction count -->
                  <div class="flex justify-between items-center">
                    @if (consumption && consumption.transactionCount > 0) {
                      <button
                        matButton="outlined"
                        class="text-label-medium h-8! px-3! -ml-2"
                        [matBadge]="consumption.transactionCount"
                        matBadgeColor="primary"
                        (click)="
                          openAllocatedTransactions(item.data, consumption)
                        "
                        [matTooltip]="
                          getTransactionCountLabel(
                            item.data.kind,
                            consumption.transactionCount
                          )
                        "
                      >
                        <mat-icon class="text-base! mr-1"
                          >receipt_long</mat-icon
                        >
                        {{
                          consumption.consumed
                            | currency: 'CHF' : 'symbol' : '1.0-0'
                        }}
                      </button>
                    } @else if (!item.metadata.isRollover) {
                      <span class="text-label-small text-on-surface-variant">
                        Aucune saisie
                      </span>
                    } @else {
                      <span></span>
                    }

                    @if (!item.metadata.isRollover) {
                      <button
                        matIconButton
                        (click)="addAllocatedTransaction(item.data)"
                        [matTooltip]="getAllocationLabel(item.data.kind)"
                      >
                        <mat-icon>add</mat-icon>
                      </button>
                    }
                  </div>

                  <!-- Recurrence badge -->
                  @if (!item.metadata.isRollover) {
                    <div class="mt-2">
                      <mat-chip
                        class="h-6! text-label-small!"
                        [class.bg-primary-container!]="
                          item.data.recurrence === 'fixed'
                        "
                        [class.text-on-primary-container!]="
                          item.data.recurrence === 'fixed'
                        "
                        [class.bg-secondary-container!]="
                          item.data.recurrence === 'one_off'
                        "
                        [class.text-on-secondary-container!]="
                          item.data.recurrence === 'one_off'
                        "
                      >
                        {{ item.data.recurrence | recurrenceLabel }}
                      </mat-chip>
                    </div>
                  }
                </mat-card-content>
              </mat-card>
            } @empty {
              <div class="text-center py-8">
                <p class="text-body-medium text-on-surface-variant">
                  Aucune prévision définie
                </p>
                <button
                  matButton="outlined"
                  (click)="add.emit()"
                  class="mt-4"
                  data-testid="add-first-line"
                >
                  <mat-icon>add</mat-icon>
                  Commencer à planifier
                </button>
              </div>
            }

            <!-- Transactions section -->
            @if (transactionItems().length > 0) {
              <div class="mt-4 pt-4 border-t border-outline-variant">
                <h3 class="text-title-small text-on-surface-variant mb-3">
                  Transactions
                </h3>
                @for (item of transactionItems(); track item.data.id) {
                  <mat-card
                    appearance="outlined"
                    class="mb-3"
                    [class.opacity-50]="item.metadata.isLoading"
                    [attr.data-testid]="'transaction-card-' + item.data.id"
                  >
                    <mat-card-content class="flex justify-between items-start">
                      <div class="flex-1 min-w-0">
                        <span class="text-body-medium font-medium truncate">
                          {{ item.data.name }}
                        </span>
                        <div class="text-label-small text-on-surface-variant">
                          {{ item.data.kind | transactionLabel }}
                        </div>
                        @if (item.metadata.envelopeName) {
                          <div
                            class="flex items-center gap-1 text-label-small text-on-surface-variant mt-1"
                          >
                            <mat-icon class="text-sm!">folder</mat-icon>
                            <span>{{ item.metadata.envelopeName }}</span>
                          </div>
                        }
                      </div>
                      <div class="flex items-center gap-2">
                        <span
                          class="text-title-medium font-bold"
                          [class.text-financial-income]="item.data.amount > 0"
                          [class.text-error]="item.data.amount < 0"
                        >
                          {{
                            item.data.amount
                              | currency: 'CHF' : 'symbol' : '1.0-0'
                          }}
                        </span>
                        <button
                          matIconButton
                          (click)="delete.emit(item.data.id)"
                          matTooltip="Supprimer"
                          class="w-8! h-8! text-error"
                          [attr.data-testid]="'delete-tx-' + item.data.id"
                        >
                          <mat-icon class="text-xl!">delete</mat-icon>
                        </button>
                      </div>
                    </mat-card-content>
                  </mat-card>
                }
              </div>
            }
          </div>
        } @else {
          <!-- Desktop view - same layout for both modes, data adapts via viewMode -->
          <div class="overflow-x-auto">
            <table
              mat-table
              [dataSource]="budgetTableData()"
              [trackBy]="trackByRow"
              class="w-full min-w-[700px]"
            >
              <!-- Name Column -->
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>Description</th>
                <td mat-cell *matCellDef="let line">
                  @if (line.metadata.isEditing) {
                    <form
                      [formGroup]="editForm"
                      (ngSubmit)="saveEdit()"
                      class="py-2"
                    >
                      <mat-form-field
                        appearance="outline"
                        class="w-full"
                        subscriptSizing="dynamic"
                      >
                        <input
                          matInput
                          formControlName="name"
                          placeholder="Nom de la ligne"
                          [attr.data-testid]="'edit-name-' + line.data.id"
                          class="text-body-medium"
                          (keydown.enter)="saveEdit()"
                          (keydown.escape)="cancelEdit()"
                        />
                      </mat-form-field>
                    </form>
                  } @else {
                    <div class="flex items-center gap-2">
                      <!-- Kind indicator icon -->
                      <mat-icon
                        class="text-base! shrink-0"
                        [class.text-financial-income]="
                          line.data.kind === 'income'
                        "
                        [class.text-financial-expense]="
                          line.data.kind === 'expense'
                        "
                        [class.text-financial-savings]="
                          line.data.kind === 'saving'
                        "
                        [matTooltip]="line.data.kind | transactionLabel"
                        matTooltipPosition="above"
                      >
                        {{ getKindIcon(line.data.kind) }}
                      </mat-icon>
                      <span
                        class="inline-flex items-center gap-2"
                        [class.rollover-text]="line.metadata.isRollover"
                      >
                        @if (
                          line.metadata.isRollover &&
                          line.data.rolloverSourceBudgetId
                        ) {
                          <a
                            [routerLink]="[
                              '/app/budget',
                              line.data.rolloverSourceBudgetId,
                            ]"
                            matButton
                            class="ph-no-capture text-body-medium font-semibold"
                          >
                            <mat-icon class="text-base!">open_in_new</mat-icon>
                            {{ line.data.name | rolloverFormat }}
                          </a>
                        } @else {
                          <div class="flex flex-col">
                            <span
                              class="ph-no-capture text-body-medium font-semibold flex items-center gap-1"
                              [class.text-financial-income]="
                                line.data.kind === 'income'
                              "
                              [class.text-financial-expense]="
                                line.data.kind === 'expense'
                              "
                              [class.text-financial-savings]="
                                line.data.kind === 'saving'
                              "
                            >
                              {{ line.data.name | rolloverFormat }}
                              @if (line.metadata.isPropagationLocked) {
                                <mat-icon
                                  class="text-base! text-outline"
                                  matTooltip="Montants verrouillés = non affectés par la propagation"
                                  matTooltipPosition="above"
                                >
                                  lock
                                </mat-icon>
                              }
                            </span>
                            @if (line.metadata.envelopeName) {
                              <span
                                class="flex items-center gap-1 text-label-small text-on-surface-variant"
                              >
                                <mat-icon class="text-sm!">folder</mat-icon>
                                {{ line.metadata.envelopeName }}
                              </span>
                            }
                          </div>
                        }
                      </span>
                    </div>
                  }
                </td>
              </ng-container>

              <!-- Remaining Column (only shown when there are transactions) -->
              <ng-container matColumnDef="remaining">
                <th mat-header-cell *matHeaderCellDef class="text-right!">
                  Reste
                </th>
                <td mat-cell *matCellDef="let line" class="text-right">
                  @let consumption = budgetLineConsumptions().get(line.data.id);
                  @if (consumption && consumption.transactionCount > 0) {
                    @let remaining = consumption.remaining;
                    @let percentage =
                      calculatePercentage(
                        line.data.amount,
                        consumption.consumed
                      );
                    @let isExceeded = remaining < 0;

                    <div class="flex flex-col items-end gap-1">
                      <span
                        class="text-body-medium font-semibold"
                        [class.text-error]="isExceeded"
                      >
                        {{ remaining | currency: 'CHF' : 'symbol' : '1.0-0' }}
                        @if (isExceeded) {
                          <span class="text-label-small font-normal ml-1"
                            >dépassé</span
                          >
                        }
                      </span>
                      @if (!line.metadata.isRollover) {
                        <mat-progress-bar
                          mode="determinate"
                          [value]="percentage > 100 ? 100 : percentage"
                          [class.warn-bar]="percentage > 100"
                          class="h-1.5! w-24! rounded-full"
                        />
                      }
                    </div>
                  }
                </td>
              </ng-container>

              <!-- Planned Column (budget amount with kind colors) -->
              <ng-container matColumnDef="planned">
                <th mat-header-cell *matHeaderCellDef class="text-right">
                  Prévu
                </th>
                <td mat-cell *matCellDef="let line" class="text-right">
                  @if (line.metadata.isEditing) {
                    <form
                      [formGroup]="editForm"
                      (ngSubmit)="saveEdit()"
                      class="py-2 flex justify-end"
                    >
                      <mat-form-field
                        appearance="outline"
                        class="w-28"
                        subscriptSizing="dynamic"
                      >
                        <input
                          matInput
                          type="number"
                          formControlName="amount"
                          placeholder="0.00"
                          step="1"
                          min="0"
                          [attr.data-testid]="'edit-amount-' + line.data.id"
                          class="text-body-medium text-right"
                          (keydown.enter)="saveEdit()"
                          (keydown.escape)="cancelEdit()"
                        />
                        <span matTextSuffix>CHF</span>
                      </mat-form-field>
                    </form>
                  } @else {
                    <span
                      class="text-body-medium font-bold"
                      [class.italic]="line.metadata.isRollover"
                      [class.text-financial-income]="
                        line.data.kind === 'income'
                      "
                      [class.text-financial-expense]="
                        line.data.kind === 'expense'
                      "
                      [class.text-financial-savings]="
                        line.data.kind === 'saving'
                      "
                    >
                      {{
                        line.data.amount | currency: 'CHF' : 'symbol' : '1.0-0'
                      }}
                    </span>
                  }
                </td>
              </ng-container>

              <!-- Spent Column -->
              <ng-container matColumnDef="spent">
                <th mat-header-cell *matHeaderCellDef class="text-right">
                  Dépensé
                </th>
                <td mat-cell *matCellDef="let line" class="text-right">
                  @if (
                    line.metadata.itemType === 'budget_line' &&
                    !line.metadata.isRollover
                  ) {
                    @let consumption =
                      budgetLineConsumptions().get(line.data.id);
                    @if (consumption && consumption.transactionCount > 0) {
                      <button
                        matButton
                        class="text-body-small h-8! px-3!"
                        [matBadge]="consumption.transactionCount"
                        matBadgeColor="primary"
                        (click)="
                          openAllocatedTransactions(line.data, consumption)
                        "
                        [matTooltip]="
                          'Voir les ' +
                          getTransactionCountLabel(
                            line.data.kind,
                            consumption.transactionCount
                          )
                        "
                      >
                        <mat-icon class="text-base! mr-1"
                          >receipt_long</mat-icon
                        >
                        {{
                          consumption.consumed
                            | currency: 'CHF' : 'symbol' : '1.0-0'
                        }}
                      </button>
                    }
                  }
                </td>
              </ng-container>

              <!-- Balance Column (cumulative balance) -->
              <ng-container matColumnDef="balance">
                <th mat-header-cell *matHeaderCellDef class="text-right">
                  Solde
                </th>
                <td mat-cell *matCellDef="let line" class="text-right">
                  <div class="inline-flex items-center gap-1">
                    <mat-icon
                      class="text-sm! w-4! h-4!"
                      [class.text-financial-income]="
                        line.data.kind === 'income'
                      "
                      [class.text-financial-negative]="
                        line.data.kind === 'expense' ||
                        line.data.kind === 'saving'
                      "
                    >
                      @if (line.data.kind === 'income') {
                        trending_up
                      } @else {
                        trending_down
                      }
                    </mat-icon>
                    <span
                      class="text-body-medium font-medium"
                      [class.text-financial-income]="
                        line.metadata.cumulativeBalance >= 0
                      "
                      [class.text-financial-negative]="
                        line.metadata.cumulativeBalance < 0
                      "
                    >
                      {{
                        line.metadata.cumulativeBalance
                          | currency: 'CHF' : 'symbol' : '1.0-0'
                      }}
                    </span>
                  </div>
                </td>
              </ng-container>

              <!-- Recurrence Column -->
              <ng-container matColumnDef="recurrence">
                <th mat-header-cell *matHeaderCellDef>Fréquence</th>
                <td mat-cell *matCellDef="let line">
                  @if ('recurrence' in line.data) {
                    <mat-chip
                      [class.bg-primary-container!]="
                        line.data.recurrence === 'fixed'
                      "
                      [class.text-on-primary-container!]="
                        line.data.recurrence === 'fixed'
                      "
                      [class.bg-secondary-container!]="
                        line.data.recurrence === 'one_off'
                      "
                      [class.text-on-secondary-container!]="
                        line.data.recurrence === 'one_off'
                      "
                    >
                      {{ line.data.recurrence | recurrenceLabel }}
                    </mat-chip>
                  } @else {
                    <mat-chip
                      class="bg-secondary-container text-on-secondary-container"
                    >
                      Une seule fois
                    </mat-chip>
                  }
                </td>
              </ng-container>

              <!-- Actions Column -->
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef></th>
                <td mat-cell *matCellDef="let line">
                  <div class="flex gap-1 justify-end items-center">
                    @if (line.metadata.isEditing) {
                      <div class="flex items-center gap-2">
                        <button
                          matButton
                          (click)="cancelEdit()"
                          [attr.data-testid]="'cancel-' + line.data.id"
                          class="density-3"
                        >
                          <mat-icon class="text-base! mr-1">close</mat-icon>
                          Annuler
                        </button>
                        <button
                          matButton="filled"
                          (click)="saveEdit()"
                          [attr.data-testid]="'save-' + line.data.id"
                          [disabled]="!editForm.valid"
                          class="density-3"
                        >
                          <mat-icon class="text-base! mr-1">check</mat-icon>
                          Enregistrer
                        </button>
                      </div>
                    } @else if (!line.metadata.isRollover) {
                      <button
                        matIconButton
                        [matMenuTriggerFor]="rowActionMenu"
                        [attr.data-testid]="'actions-menu-' + line.data.id"
                        [disabled]="line.metadata.isLoading"
                      >
                        <mat-icon>more_vert</mat-icon>
                      </button>

                      <mat-menu #rowActionMenu="matMenu" xPosition="before">
                        <div
                          class="px-4 py-2 text-label-medium text-on-surface-variant max-w-48 truncate"
                          [matTooltip]="line.data.name"
                          matTooltipShowDelay="500"
                        >
                          {{ line.data.name }}
                        </div>
                        <mat-divider />
                        @if (
                          line.metadata.itemType === 'budget_line' &&
                          !line.metadata.isRollover
                        ) {
                          <button
                            mat-menu-item
                            (click)="addAllocatedTransaction(line.data)"
                            [attr.data-testid]="
                              'add-transaction-' + line.data.id
                            "
                          >
                            <mat-icon matMenuItemIcon>add</mat-icon>
                            <span>{{
                              getAllocationLabel(line.data.kind)
                            }}</span>
                          </button>
                        }
                        @if (line.metadata.itemType === 'budget_line') {
                          <button
                            mat-menu-item
                            (click)="startEdit(line)"
                            [attr.data-testid]="'edit-' + line.data.id"
                          >
                            <mat-icon matMenuItemIcon>edit</mat-icon>
                            <span>Éditer</span>
                          </button>
                        }
                        @if (line.metadata.canResetFromTemplate) {
                          <button
                            mat-menu-item
                            (click)="onResetFromTemplateClick(line)"
                            [attr.data-testid]="
                              'reset-from-template-' + line.data.id
                            "
                          >
                            <mat-icon matMenuItemIcon>refresh</mat-icon>
                            <span>Réinitialiser</span>
                          </button>
                        }
                        <button
                          mat-menu-item
                          (click)="delete.emit(line.data.id)"
                          [attr.data-testid]="'delete-' + line.data.id"
                          class="text-error"
                        >
                          <mat-icon matMenuItemIcon class="text-error"
                            >delete</mat-icon
                          >
                          <span>Supprimer</span>
                        </button>
                      </mat-menu>
                    }
                  </div>
                </td>
              </ng-container>

              <tr
                mat-header-row
                *matHeaderRowDef="displayedColumns; sticky: true"
              ></tr>
              <tr
                mat-row
                *matRowDef="let row; columns: displayedColumns"
                class="hover:bg-surface-container-low transition-opacity"
                [class.opacity-50]="row.metadata.isLoading"
                [class.pointer-events-none]="row.metadata.isLoading"
                [attr.data-testid]="
                  'budget-line-' + (row.data.name | rolloverFormat)
                "
              ></tr>

              <!-- No data row -->
              <tr class="mat-row" *matNoDataRow>
                <td
                  class="mat-cell text-center py-8"
                  [attr.colspan]="displayedColumns.length"
                >
                  <p class="text-body-medium text-on-surface-variant">
                    Aucune prévision définie
                  </p>
                  <button
                    matButton="outlined"
                    (click)="add.emit()"
                    class="mt-4"
                    data-testid="add-first-line"
                  >
                    <mat-icon>add</mat-icon>
                    Commencer à planifier
                  </button>
                </td>
              </tr>
            </table>
          </div>
        }
      </mat-card-content>
      @if (budgetTableData().length > 0) {
        <mat-card-actions class="flex justify-center mb-2">
          <button
            matButton="outlined"
            (click)="add.emit()"
            data-testid="add-budget-line"
          >
            <mat-icon>add</mat-icon>
            Ajouter une prévision
          </button>
        </mat-card-actions>
      }
    </mat-card>
  `,
  styles: `
    @reference "tailwindcss";
    :host {
      display: block;
    }

    table {
      background: transparent;
    }

    .mat-mdc-row:hover {
      cursor: pointer;
    }

    .warn-bar {
      --mat-progress-bar-active-indicator-color: var(--mat-sys-error);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetTable {
  // Signal inputs - modern Angular 20+ pattern
  budgetLines = input.required<BudgetLineViewModel[]>();
  transactions = input.required<TransactionViewModel[]>();

  update = output<BudgetLineUpdate>();
  delete = output<string>();
  deleteTransaction = output<string>();
  add = output<void>();
  viewAllocatedTransactions = output<{
    budgetLine: BudgetLine;
    consumption: BudgetLineConsumption;
  }>();
  createAllocatedTransaction = output<BudgetLine>();
  resetFromTemplate = output<string>();

  // Services
  readonly #breakpointObserver = inject(BreakpointObserver);
  readonly #fb = inject(FormBuilder);
  readonly #dialog = inject(MatDialog);
  readonly #destroyRef = inject(DestroyRef);
  readonly #budgetTableDataProvider = inject(BudgetTableDataProvider);
  readonly #logger = inject(Logger);

  // Desktop columns - envelopes mode
  displayedColumns = [
    'name',
    'planned',
    'spent',
    'remaining',
    'balance',
    'recurrence',
    'actions',
  ];

  // View mode toggle state
  readonly viewMode = signal<BudgetTableViewMode>('envelopes');

  protected inlineFormEditingItem = signal<BudgetLineTableItem | null>(null);
  readonly editForm = this.#fb.group({
    name: ['', [Validators.required, Validators.minLength(1)]],
    amount: [0, [Validators.required, Validators.min(0.01)]],
  });

  isMobile = toSignal(
    this.#breakpointObserver
      .observe(Breakpoints.Handset)
      .pipe(map((result) => result.matches)),
    { initialValue: false },
  );

  // Computed for budget line consumptions
  readonly budgetLineConsumptions = computed(() => {
    const lines = this.budgetLines();
    const txs = this.transactions();
    return calculateAllConsumptions(lines, txs);
  });

  // View Model - adapts data based on current viewMode
  budgetTableData = computed(() => {
    const budgetLines = this.budgetLines();
    const transactions = this.transactions();
    const editingLine = this.inlineFormEditingItem();

    return this.#budgetTableDataProvider.provideTableData({
      budgetLines,
      transactions,
      editingLineId: editingLine?.data.id ?? null,
      viewMode: this.viewMode(),
    });
  });

  // Mobile view: budget lines as typed items
  readonly budgetLineItems = computed(() => {
    return this.budgetTableData().filter(
      (item): item is BudgetLineTableItem =>
        item.metadata.itemType === 'budget_line',
    );
  });

  // Mobile view: standalone transactions (not allocated to budget lines)
  readonly transactionItems = computed(() => {
    return this.budgetTableData().filter(
      (item) => item.metadata.itemType === 'transaction',
    );
  });

  // Track functions for performance optimization
  readonly trackByRow = (_: number, row: TableItem): string => row.data.id;

  // Calculate consumption percentage
  calculatePercentage(reserved: number, consumed: number): number {
    if (reserved <= 0) return 0;
    return Math.round((consumed / reserved) * 100);
  }

  // Get rollover source budget ID if it exists (for rollover lines)
  getRolloverSourceBudgetId(data: BudgetLine): string | undefined {
    return 'rolloverSourceBudgetId' in data
      ? (data as BudgetLine & { rolloverSourceBudgetId?: string })
          .rolloverSourceBudgetId
      : undefined;
  }

  startEdit(item: BudgetLineTableItem): void {
    // On mobile, open dialog for editing
    if (this.isMobile()) {
      this.#openEditDialog(item);
    } else {
      // Desktop: inline editing
      try {
        this.inlineFormEditingItem.set(item);
        this.editForm.patchValue({
          name: item.data.name,
          amount: item.data.amount,
        });
      } catch (error) {
        this.#logger.error('Failed to start inline edit', {
          error,
          itemId: item.data.id,
        });
      }
    }
  }

  // Mobile-specific edit for budget lines
  startEditBudgetLine(item: BudgetLineTableItem): void {
    this.#openEditDialog(item);
  }

  #openEditDialog(item: BudgetLineTableItem): void {
    try {
      const dialogRef = this.#dialog.open(EditBudgetLineDialog, {
        data: { budgetLine: item.data },
        width: '400px',
        maxWidth: '90vw',
      });

      dialogRef
        .afterClosed()
        .pipe(takeUntilDestroyed(this.#destroyRef))
        .subscribe((update: BudgetLineUpdate | undefined) => {
          if (update) this.update.emit(update);
        });
    } catch (error) {
      this.#logger.error('Failed to open edit dialog', {
        error,
        itemId: item.data.id,
      });
    }
  }

  cancelEdit(): void {
    this.inlineFormEditingItem.set(null);
    this.editForm.reset();
  }

  saveEdit(): void {
    const editingId = this.inlineFormEditingItem()?.data.id;
    if (!editingId || !this.editForm.valid) return;

    const value = this.editForm.getRawValue();
    const name = value.name?.trim();
    const amount = value.amount;
    if (!name || amount == null) return;

    this.inlineFormEditingItem.set(null);
    this.editForm.reset();
    this.update.emit({
      id: editingId,
      name,
      amount,
      isManuallyAdjusted: true,
    });
  }

  getAllocationLabel(kind: TransactionKind): string {
    const labels: Record<TransactionKind, string> = {
      expense: 'Saisir une dépense',
      income: 'Saisir un revenu',
      saving: 'Saisir une épargne',
    };
    return labels[kind];
  }

  getTransactionCountLabel(kind: TransactionKind, count: number): string {
    const labels: Record<TransactionKind, string> = {
      expense: 'dépense',
      income: 'revenu',
      saving: 'épargne',
    };
    return `${count} ${labels[kind]}${count > 1 ? 's' : ''}`;
  }

  openAllocatedTransactions(
    budgetLine: BudgetLine,
    consumption: BudgetLineConsumption,
  ): void {
    this.viewAllocatedTransactions.emit({ budgetLine, consumption });
  }

  addAllocatedTransaction(budgetLine: BudgetLine): void {
    this.createAllocatedTransaction.emit(budgetLine);
  }

  getKindIcon(kind: TransactionKind): string {
    const icons: Record<TransactionKind, string> = {
      income: 'arrow_upward',
      expense: 'arrow_downward',
      saving: 'savings',
    };
    return icons[kind];
  }

  onResetFromTemplateClick(line: BudgetLineTableItem): void {
    const dialogRef = this.#dialog.open(ConfirmationDialog, {
      data: {
        title: 'Réinitialiser depuis le modèle',
        message:
          'Cette action va remplacer les valeurs actuelles par celles du modèle. Cette action est irréversible.',
        confirmText: 'Réinitialiser',
        confirmColor: 'primary',
      } satisfies ConfirmationDialogData,
      width: '400px',
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe((confirmed: boolean) => {
        if (confirmed) {
          this.resetFromTemplate.emit(line.data.id);
        }
      });
  }
}
