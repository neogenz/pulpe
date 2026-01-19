import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
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
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { RolloverFormatPipe } from '@app/ui/rollover-format';
import {
  calculateAllEnrichedConsumptions,
  type BudgetLineConsumption,
} from '@core/budget';
import { Logger } from '@core/logging/logger';
import {
  ConfirmationDialog,
  type ConfirmationDialogData,
} from '@ui/dialogs/confirmation-dialog';
import {
  RecurrenceLabelPipe,
  TransactionLabelPipe,
} from '@ui/transaction-display';
import { type BudgetLine, type BudgetLineUpdate } from 'pulpe-shared';
import { map } from 'rxjs/operators';
import { EditBudgetLineDialog } from '../edit-budget-line/edit-budget-line-dialog';
import { type BudgetLineViewModel } from '../models/budget-line-view-model';
import { type TransactionViewModel } from '../models/transaction-view-model';
import { BudgetEnvelopeCard } from './budget-envelope-card';
import {
  BudgetEnvelopeDetailPanel,
  type BudgetEnvelopeDetailDialogData,
} from './budget-envelope-detail-panel';
import { BudgetSectionGroup } from './budget-section-group';
import { BudgetTableDataProvider } from './budget-table-data-provider';
import { BudgetTableMobileCard } from './budget-table-mobile-card';
import {
  type BudgetLineTableItem,
  type GroupHeaderTableItem,
  type TableRowItem,
  type TransactionTableItem,
} from './budget-table-models';
import type { BudgetTableViewMode } from './budget-table-view-mode';
import { BudgetTableViewToggle } from './budget-table-view-toggle';

@Component({
  selector: 'pulpe-budget-table',
  imports: [
    MatTableModule,
    MatCardModule,
    MatSlideToggleModule,
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
    DatePipe,
    TransactionLabelPipe,
    RecurrenceLabelPipe,
    RolloverFormatPipe,
    BudgetTableViewToggle,
    BudgetTableMobileCard,
    BudgetEnvelopeCard,
    BudgetSectionGroup,
  ],
  template: `
    <mat-card appearance="outlined" class="overflow-hidden">
      <mat-card-header class="bg-surface-container/50 !py-4 !px-5">
        <div class="flex items-center justify-between w-full">
          <div>
            <mat-card-title class="text-title-large"
              >Tes enveloppes</mat-card-title
            >
            <mat-card-subtitle class="text-body-medium text-on-surface-variant">
              {{ budgetLines().length }} prévisions ce mois
            </mat-card-subtitle>
          </div>
          @if (!isMobile()) {
            <pulpe-budget-table-view-toggle [(viewMode)]="viewMode" />
          }
        </div>
      </mat-card-header>
      <mat-card-content class="py-4!">
        @if (isMobile()) {
          <!-- Mobile view -->
          <div class="flex flex-col gap-3">
            @for (item of budgetLineItems(); track item.data.id) {
              <pulpe-budget-table-mobile-card
                [item]="item"
                (edit)="startEditBudgetLine($event)"
                (delete)="delete.emit($event)"
                (addTransaction)="addAllocatedTransaction($event)"
                (viewTransactions)="onViewTransactions($event)"
                (resetFromTemplate)="onResetFromTemplateClick($event)"
                (toggleCheck)="toggleCheck.emit($event)"
              />
            } @empty {
              <div class="text-center py-12 px-4">
                <div
                  class="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-container/30 flex items-center justify-center"
                >
                  <mat-icon class="text-primary !text-3xl"
                    >account_balance_wallet</mat-icon
                  >
                </div>
                <p class="text-body-large text-on-surface mb-2">
                  Pas encore d'enveloppe
                </p>
                <p class="text-body-medium text-on-surface-variant mb-6">
                  Crée ta première enveloppe pour commencer à voir clair
                </p>
                <button
                  matButton="filled"
                  (click)="add.emit()"
                  class="!rounded-full !px-6"
                  data-testid="add-first-line"
                >
                  <mat-icon>add</mat-icon>
                  Créer une enveloppe
                </button>
              </div>
            }

            <!-- Transactions section -->
            @if (transactionItems().length > 0) {
              <div class="pt-4 border-outline-variant">
                <h3 class="text-title-medium text-on-surface-variant mb-3">
                  Transactions
                </h3>
                @for (item of transactionItems(); track item.data.id) {
                  <mat-card
                    appearance="outlined"
                    class="mb-3"
                    [class.opacity-50]="item.metadata.isLoading"
                    [attr.data-testid]="'transaction-card-' + item.data.id"
                  >
                    <mat-card-content>
                      <div
                        class="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-1 items-center"
                      >
                        <div class="min-w-0 space-y-0.5">
                          <span
                            class="text-body-medium font-medium block truncate"
                          >
                            {{ item.data.name }}
                          </span>
                          <div class="text-label-small text-on-surface-variant">
                            {{ item.data.kind | transactionLabel }}
                          </div>
                          @if (item.metadata.envelopeName) {
                            <div
                              class="flex items-center text-label-small text-on-surface-variant"
                            >
                              <mat-icon class="text-sm! leading-none! w-4! h-4!"
                                >folder</mat-icon
                              >
                              <span>{{ item.metadata.envelopeName }}</span>
                            </div>
                          }
                        </div>
                        <div
                          class="text-title-medium font-bold"
                          [class.text-financial-income]="item.data.amount > 0"
                          [class.text-error]="item.data.amount < 0"
                        >
                          {{
                            item.data.amount
                              | currency: 'CHF' : 'symbol' : '1.0-0'
                          }}
                        </div>
                        <div>
                          <button
                            matIconButton
                            (click)="deleteTransaction.emit(item.data.id)"
                            matTooltip="Supprimer"
                            [attr.data-testid]="'delete-tx-' + item.data.id"
                          >
                            <mat-icon class="text-xl!">delete</mat-icon>
                          </button>
                        </div>
                      </div>
                    </mat-card-content>
                  </mat-card>
                }
              </div>
            }
          </div>
        } @else if (viewMode() === 'table') {
          <!-- Desktop Table View -->
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
                      @if (line.metadata.isNestedUnderEnvelope) {
                        <mat-icon class="text-sm! text-outline shrink-0">
                          subdirectory_arrow_right
                        </mat-icon>
                      } @else {
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
                          {{ line.metadata.kindIcon }}
                        </mat-icon>
                      }
                      <span
                        class="inline-flex items-center gap-2"
                        [class.rollover-text]="line.metadata.isRollover"
                      >
                        @if (
                          line.metadata.isRollover &&
                          line.metadata.rolloverSourceBudgetId
                        ) {
                          <a
                            [routerLink]="[
                              '/app/budget',
                              line.metadata.rolloverSourceBudgetId,
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
                        @if (line.data.checkedAt) {
                          <span
                            class="text-body-small text-on-surface-variant ml-2"
                          >
                            {{
                              line.data.checkedAt | date: 'dd.MM' : '' : 'fr-CH'
                            }}
                          </span>
                        }
                      </span>
                    </div>
                  }
                </td>
              </ng-container>

              <!-- Planned Column -->
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
                <th mat-header-cell *matHeaderCellDef>Dépensé</th>
                <td mat-cell *matCellDef="let line">
                  @if (
                    line.metadata.itemType === 'budget_line' &&
                    !line.metadata.isRollover &&
                    line.consumption?.hasTransactions
                  ) {
                    <button
                      matButton
                      class="text-body-small h-8! px-3!"
                      [matBadge]="line.consumption.transactionCount"
                      matBadgeColor="primary"
                      (click)="onViewTransactionsFromLine(line)"
                      [matTooltip]="
                        'Voir les ' + line.consumption.transactionCountLabel
                      "
                    >
                      <mat-icon class="text-base! mr-1">receipt_long</mat-icon>
                      {{
                        line.consumption.consumed
                          | currency: 'CHF' : 'symbol' : '1.0-0'
                      }}
                    </button>
                  }
                </td>
              </ng-container>

              <!-- Remaining Column -->
              <ng-container matColumnDef="remaining">
                <th mat-header-cell *matHeaderCellDef class="text-right!">
                  Reste
                </th>
                <td mat-cell *matCellDef="let line" class="text-right">
                  @if (line.consumption?.hasTransactions) {
                    @let remaining =
                      line.data.amount - line.consumption.consumed;
                    @let isExceeded = remaining < 0;

                    <div class="flex flex-col items-end gap-1">
                      <div class="flex flex-col items-center">
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
                            [value]="
                              line.consumption.percentage > 100
                                ? 100
                                : line.consumption.percentage
                            "
                            [class.warn-bar]="line.consumption.percentage > 100"
                            class="h-1.5! w-24! rounded-full"
                          />
                        }
                      </div>
                    </div>
                  }
                </td>
              </ng-container>

              <!-- Balance Column -->
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
                  <mat-chip
                    class="bg-secondary-container chip-on-secondary-container"
                  >
                    @if ('recurrence' in line.data) {
                      {{ line.data.recurrence | recurrenceLabel }}
                    } @else {
                      Une seule fois
                    }
                  </mat-chip>
                </td>
              </ng-container>

              <!-- Group Header Column -->
              <ng-container matColumnDef="groupHeader">
                <td
                  mat-cell
                  *matCellDef="let row"
                  [attr.colspan]="displayedColumns.length"
                  class="!py-3 !px-4"
                >
                  <div class="flex items-center gap-2">
                    <mat-icon class="text-lg">{{
                      row.metadata.groupIcon
                    }}</mat-icon>
                    <span class="text-title-medium font-semibold">
                      {{ row.metadata.groupLabel }}
                    </span>
                    <span class="text-label-small text-on-surface-variant">
                      ({{ row.metadata.itemCount }})
                    </span>
                  </div>
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
                    } @else {
                      @if (line.metadata.itemType === 'budget_line') {
                        <mat-slide-toggle
                          [checked]="!!line.data.checkedAt"
                          (change)="toggleCheck.emit(line.data.id)"
                          (click)="$event.stopPropagation()"
                          [attr.data-testid]="'toggle-check-' + line.data.id"
                        />
                      } @else if (line.metadata.itemType === 'transaction') {
                        <mat-slide-toggle
                          [checked]="!!line.data.checkedAt"
                          (change)="toggleTransactionCheck.emit(line.data.id)"
                          (click)="$event.stopPropagation()"
                          [attr.data-testid]="'toggle-check-tx-' + line.data.id"
                        />
                      }
                      @if (!line.metadata.isRollover) {
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
                          @if (line.metadata.itemType === 'budget_line') {
                            <button
                              mat-menu-item
                              (click)="addAllocatedTransaction(line.data)"
                              [attr.data-testid]="
                                'add-transaction-' + line.data.id
                              "
                            >
                              <mat-icon matMenuItemIcon>add</mat-icon>
                              <span>{{ line.metadata.allocationLabel }}</span>
                            </button>
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
                    }
                  </div>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr
                mat-row
                *matRowDef="
                  let row;
                  columns: ['groupHeader'];
                  when: isGroupHeader
                "
                class="group-header-row"
              ></tr>
              <tr
                mat-row
                *matRowDef="let row; columns: displayedColumns"
                class="hover:bg-surface-container-low transition-opacity"
                [class.opacity-50]="row.metadata?.isLoading"
                [class.pointer-events-none]="row.metadata?.isLoading"
                [class.line-through]="row.data?.checkedAt"
                [class.bg-surface-container-lowest]="
                  row.metadata?.isNestedUnderEnvelope
                "
                [attr.data-testid]="
                  'budget-line-' + (row.data?.name | rolloverFormat)
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
                    data-testid="add-first-line-table"
                  >
                    <mat-icon>add</mat-icon>
                    Commencer à planifier
                  </button>
                </td>
              </tr>
            </table>
          </div>
        } @else {
          <!-- Desktop Card Grid View -->
          @if (budgetLineItems().length === 0) {
            <!-- Empty State -->
            <div class="text-center py-12 px-4">
              <div
                class="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-container/30 flex items-center justify-center"
              >
                <mat-icon class="text-primary !text-3xl"
                  >account_balance_wallet</mat-icon
                >
              </div>
              <p class="text-body-large text-on-surface mb-2">
                Pas encore d'enveloppe
              </p>
              <p class="text-body-medium text-on-surface-variant mb-6">
                Crée ta première enveloppe pour commencer à voir clair
              </p>
              <button
                matButton="filled"
                (click)="add.emit()"
                class="!rounded-full !px-6"
                data-testid="add-first-line"
              >
                <mat-icon>add</mat-icon>
                Créer une enveloppe
              </button>
            </div>
          } @else {
            <div class="space-y-4">
              <!-- Income Section -->
              @if (groupedBudgetLines().income.length > 0) {
                <pulpe-budget-section-group
                  title="Revenus"
                  icon="trending_up"
                  [itemCount]="groupedBudgetLines().income.length"
                >
                  @for (
                    item of groupedBudgetLines().income;
                    track item.data.id
                  ) {
                    <pulpe-budget-envelope-card
                      [item]="item"
                      (cardClick)="openDetailDialog($event)"
                      (edit)="startEditBudgetLine($event)"
                      (delete)="delete.emit($event)"
                      (addTransaction)="addAllocatedTransaction($event)"
                      (resetFromTemplate)="onResetFromTemplateClick($event)"
                      (toggleCheck)="toggleCheck.emit($event)"
                    />
                  }
                </pulpe-budget-section-group>
              }

              <!-- Savings Section -->
              @if (groupedBudgetLines().saving.length > 0) {
                <pulpe-budget-section-group
                  title="Épargne"
                  icon="savings"
                  [itemCount]="groupedBudgetLines().saving.length"
                >
                  @for (
                    item of groupedBudgetLines().saving;
                    track item.data.id
                  ) {
                    <pulpe-budget-envelope-card
                      [item]="item"
                      (cardClick)="openDetailDialog($event)"
                      (edit)="startEditBudgetLine($event)"
                      (delete)="delete.emit($event)"
                      (addTransaction)="addAllocatedTransaction($event)"
                      (resetFromTemplate)="onResetFromTemplateClick($event)"
                      (toggleCheck)="toggleCheck.emit($event)"
                    />
                  }
                </pulpe-budget-section-group>
              }

              <!-- Expenses Section -->
              @if (groupedBudgetLines().expense.length > 0) {
                <pulpe-budget-section-group
                  title="Dépenses"
                  icon="shopping_cart"
                  [itemCount]="groupedBudgetLines().expense.length"
                >
                  @for (
                    item of groupedBudgetLines().expense;
                    track item.data.id
                  ) {
                    <pulpe-budget-envelope-card
                      [item]="item"
                      (cardClick)="openDetailDialog($event)"
                      (edit)="startEditBudgetLine($event)"
                      (delete)="delete.emit($event)"
                      (addTransaction)="addAllocatedTransaction($event)"
                      (resetFromTemplate)="onResetFromTemplateClick($event)"
                      (toggleCheck)="toggleCheck.emit($event)"
                    />
                  }
                </pulpe-budget-section-group>
              }
            </div>
          }
        }
      </mat-card-content>
      @if (budgetTableData().length > 0) {
        <mat-card-actions
          class="!px-5 !py-4 border-t border-outline-variant/50 justify-center"
        >
          <button
            matButton
            (click)="add.emit()"
            data-testid="add-budget-line"
            class="gap-2 !h-11 !rounded-full !px-6"
          >
            <mat-icon>add</mat-icon>
            Ajouter une enveloppe
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

    /* Improved row interactions */
    .mat-mdc-row {
      transition: background-color 150ms ease-out;
    }

    .mat-mdc-row:hover {
      background-color: var(--mat-sys-surface-container-lowest);
    }

    /* Row height for better breathing */
    .mat-mdc-row:not(.group-header-row) {
      height: 64px;
    }

    .warn-bar {
      --mat-progress-bar-active-indicator-color: var(--mat-sys-error);
    }

    .chip-on-secondary-container {
      --mat-chip-label-text-color: var(--mat-sys-on-secondary-container);
    }

    /* Group headers with better visual separation */
    .group-header-row {
      background-color: var(--mat-sys-surface-container);
      border-top: 1px solid var(--mat-sys-outline-variant);
    }

    .group-header-row:first-of-type {
      border-top: none;
    }

    /* Checked row styling */
    tr.line-through {
      opacity: 0.7;
    }

    tr.line-through:hover {
      opacity: 0.85;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetTable {
  // Signal inputs
  readonly budgetLines = input.required<BudgetLineViewModel[]>();
  readonly transactions = input.required<TransactionViewModel[]>();

  // Outputs
  readonly update = output<BudgetLineUpdate>();
  readonly delete = output<string>();
  readonly deleteTransaction = output<string>();
  readonly add = output<void>();
  readonly viewAllocatedTransactions = output<{
    budgetLine: BudgetLine;
    consumption: BudgetLineConsumption;
  }>();
  readonly createAllocatedTransaction = output<BudgetLine>();
  readonly resetFromTemplate = output<string>();
  readonly toggleCheck = output<string>();
  readonly toggleTransactionCheck = output<string>();

  // Services
  readonly #breakpointObserver = inject(BreakpointObserver);
  readonly #fb = inject(FormBuilder);
  readonly #dialog = inject(MatDialog);
  readonly #destroyRef = inject(DestroyRef);
  readonly #budgetTableDataProvider = inject(BudgetTableDataProvider);
  readonly #logger = inject(Logger);

  // localStorage key for view mode persistence
  readonly #VIEW_MODE_KEY = 'pulpe-budget-desktop-view';

  // Desktop columns
  displayedColumns = [
    'name',
    'planned',
    'spent',
    'remaining',
    'balance',
    'recurrence',
    'actions',
  ];

  // View mode toggle state (persisted in localStorage for desktop)
  readonly viewMode = signal<BudgetTableViewMode>(this.#getInitialViewMode());

  constructor() {
    // Persist view mode changes to localStorage (desktop only)
    effect(() => {
      const mode = this.viewMode();
      const mobile = this.isMobile();
      if (!mobile) {
        localStorage.setItem(this.#VIEW_MODE_KEY, mode);
      }
    });
  }

  #getInitialViewMode(): BudgetTableViewMode {
    const stored = localStorage.getItem(this.#VIEW_MODE_KEY);
    if (stored === 'table') {
      return 'table';
    }
    return 'envelopes';
  }

  // Inline edit state
  protected inlineFormEditingItem = signal<BudgetLineTableItem | null>(null);
  readonly editForm = this.#fb.group({
    name: ['', [Validators.required, Validators.minLength(1)]],
    amount: [0, [Validators.required, Validators.min(0.01)]],
  });

  // Responsive
  readonly isMobile = toSignal(
    this.#breakpointObserver
      .observe(Breakpoints.Handset)
      .pipe(map((result) => result.matches)),
    { initialValue: false },
  );

  // Full consumption data for outputs (needed for parent component)
  readonly #consumptions = computed(() =>
    calculateAllEnrichedConsumptions(this.budgetLines(), this.transactions()),
  );

  // View Model with pre-computed values
  readonly budgetTableData = computed(() => {
    const editingLine = this.inlineFormEditingItem();
    return this.#budgetTableDataProvider.provideTableData({
      budgetLines: this.budgetLines(),
      transactions: this.transactions(),
      editingLineId: editingLine?.data.id ?? null,
      viewMode: this.viewMode(),
    });
  });

  // Filtered items for mobile view
  readonly budgetLineItems = computed(() =>
    this.budgetTableData().filter(
      (item): item is BudgetLineTableItem =>
        item.metadata.itemType === 'budget_line',
    ),
  );

  readonly transactionItems = computed(() =>
    this.budgetTableData().filter(
      (item): item is TransactionTableItem =>
        item.metadata.itemType === 'transaction',
    ),
  );

  // Desktop card grid: grouped budget lines by kind
  protected readonly groupedBudgetLines = computed(() => {
    const items = this.budgetLineItems();
    return {
      income: items.filter((item) => item.data.kind === 'income'),
      saving: items.filter((item) => item.data.kind === 'saving'),
      expense: items.filter((item) => item.data.kind === 'expense'),
    };
  });

  readonly trackByRow = (_: number, row: TableRowItem): string => {
    if (row.metadata.itemType === 'group_header') {
      return `group-${row.metadata.groupKind}`;
    }
    return (row as BudgetLineTableItem | TransactionTableItem).data.id;
  };

  readonly isGroupHeader = (
    _index: number,
    row: TableRowItem,
  ): row is GroupHeaderTableItem => row.metadata.itemType === 'group_header';

  // Edit methods
  startEdit(item: BudgetLineTableItem): void {
    if (this.isMobile()) {
      this.#openEditDialog(item);
      return;
    }
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
        .subscribe((result: BudgetLineUpdate | undefined) => {
          if (result) this.update.emit(result);
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

  // Action handlers
  addAllocatedTransaction(budgetLine: BudgetLine): void {
    this.createAllocatedTransaction.emit(budgetLine);
  }

  onViewTransactions(item: BudgetLineTableItem): void {
    const consumption = this.#consumptions().get(item.data.id);
    if (!consumption) return;
    this.viewAllocatedTransactions.emit({
      budgetLine: item.data,
      consumption,
    });
  }

  onViewTransactionsFromLine(line: BudgetLineTableItem): void {
    this.onViewTransactions(line);
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

  // Desktop card grid: open detail dialog as side sheet
  protected openDetailDialog(item: BudgetLineTableItem): void {
    const dialogData: BudgetEnvelopeDetailDialogData = {
      item,
      transactions: this.transactions,
      onAddTransaction: (budgetLine) =>
        this.addAllocatedTransaction(budgetLine),
      onDeleteTransaction: (id) => this.deleteTransaction.emit(id),
      onToggleTransactionCheck: (id) => this.toggleTransactionCheck.emit(id),
    };

    this.#dialog.open(BudgetEnvelopeDetailPanel, {
      data: dialogData,
      panelClass: 'side-sheet-panel',
      position: { right: '0', top: '0' },
      height: '100vh',
      width: '480px',
      maxWidth: '90vw',
      autoFocus: false,
      closeOnNavigation: true,
    });
  }
}
