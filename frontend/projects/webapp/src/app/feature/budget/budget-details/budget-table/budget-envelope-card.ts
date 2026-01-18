import { CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { type BudgetLine } from 'pulpe-shared';
import {
  RecurrenceLabelPipe,
  TransactionLabelPipe,
} from '@ui/transaction-display';
import { type BudgetLineTableItem } from './budget-table-models';

/**
 * Desktop envelope card component following M3 Expressive design
 *
 * Visual structure:
 * ┌─────────────────────────────────────────────────┐
 * │ ● Courses alimentaires                    ⋮     │
 * │        CHF 500                                  │
 * │        prévu ce mois                            │
 * │  ████████████░░░░░░░░  80%                      │
 * │  CHF 400 dépensé                    80%         │
 * │  ┌──────────┐                       ○────       │
 * │  │ Récurrent │                                  │
 * │  └──────────┘                                   │
 * └─────────────────────────────────────────────────┘
 */
@Component({
  selector: 'pulpe-budget-envelope-card',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatChipsModule,
    MatSlideToggleModule,
    MatTooltipModule,
    MatDividerModule,
    CurrencyPipe,
    TransactionLabelPipe,
    RecurrenceLabelPipe,
  ],
  template: `
    <div
      class="bg-surface rounded-2xl border border-outline-variant/50 p-5 cursor-pointer
             transition-all duration-200 hover:shadow-md hover:border-outline-variant
             min-h-[200px] h-full flex flex-col"
      [class.ring-2]="isSelected()"
      [class.ring-primary]="isSelected()"
      [class.opacity-60]="item().metadata.isLoading"
      role="button"
      tabindex="0"
      (click)="cardClick.emit(item())"
      (keydown.enter)="cardClick.emit(item())"
      (keydown.space)="cardClick.emit(item())"
      [attr.data-testid]="'envelope-card-' + item().data.id"
    >
      <!-- Header: Name + Menu -->
      <div class="flex items-start justify-between mb-4">
        <div class="flex items-center gap-2.5 min-w-0 flex-1">
          <div
            class="w-3 h-3 rounded-full flex-shrink-0"
            [style.background-color]="
              item().data.kind === 'income'
                ? 'var(--pulpe-financial-income)'
                : item().data.kind === 'expense'
                  ? 'var(--pulpe-financial-expense)'
                  : 'var(--pulpe-financial-savings)'
            "
            [matTooltip]="item().data.kind | transactionLabel"
          ></div>
          <span
            class="text-title-medium font-medium truncate"
            [class.line-through]="item().data.checkedAt"
            [class.text-on-surface-variant]="item().data.checkedAt"
          >
            {{ item().data.name }}
          </span>
        </div>

        @if (!item().metadata.isRollover) {
          <button
            matIconButton
            [matMenuTriggerFor]="cardMenu"
            (click)="$event.stopPropagation()"
            class="shrink-0 !-mr-2 !-mt-1"
            [attr.data-testid]="'card-menu-' + item().data.id"
          >
            <mat-icon>more_vert</mat-icon>
          </button>

          <mat-menu #cardMenu="matMenu" xPosition="before">
            <div
              class="px-4 py-2 text-label-medium text-on-surface-variant max-w-48 truncate"
              [matTooltip]="item().data.name"
              matTooltipShowDelay="500"
            >
              {{ item().data.name }}
            </div>
            <mat-divider />
            <button
              mat-menu-item
              (click)="addTransaction.emit(item().data)"
              [attr.data-testid]="'add-transaction-' + item().data.id"
            >
              <mat-icon matMenuItemIcon>add</mat-icon>
              <span>{{ item().metadata.allocationLabel }}</span>
            </button>
            <button
              mat-menu-item
              (click)="edit.emit(item())"
              [attr.data-testid]="'edit-' + item().data.id"
            >
              <mat-icon matMenuItemIcon>edit</mat-icon>
              <span>Éditer</span>
            </button>
            @if (item().metadata.canResetFromTemplate) {
              <button
                mat-menu-item
                (click)="resetFromTemplate.emit(item())"
                [attr.data-testid]="'reset-from-template-' + item().data.id"
              >
                <mat-icon matMenuItemIcon>refresh</mat-icon>
                <span>Réinitialiser</span>
              </button>
            }
            <button
              mat-menu-item
              (click)="delete.emit(item().data.id)"
              [attr.data-testid]="'delete-' + item().data.id"
              class="text-error"
            >
              <mat-icon matMenuItemIcon class="text-error">delete</mat-icon>
              <span>Supprimer</span>
            </button>
          </mat-menu>
        }
      </div>

      <!-- Hero Amount -->
      <div class="text-center mb-4 flex-1 flex flex-col justify-center">
        <div
          class="text-headline-large font-bold"
          [class.text-financial-income]="item().data.kind === 'income'"
          [class.text-financial-expense]="item().data.kind === 'expense'"
          [class.text-financial-savings]="item().data.kind === 'saving'"
        >
          {{ item().data.amount | currency: 'CHF' : 'symbol' : '1.0-0' }}
        </div>
        <span class="text-label-medium text-on-surface-variant">prévu</span>
      </div>

      <!-- Segmented Progress -->
      @if (item().consumption?.hasTransactions && !item().metadata.isRollover) {
        <div class="mb-4">
          <div class="flex gap-0.5 h-2">
            @for (i of progressSegments; track i) {
              <div
                class="flex-1 rounded-full transition-colors"
                [class.bg-primary]="
                  i <= item().consumption!.percentage / 10 &&
                  item().consumption!.percentage <= 100
                "
                [class.bg-error]="item().consumption!.percentage > 100"
                [class.bg-outline-variant/40]="
                  i > item().consumption!.percentage / 10 ||
                  (item().consumption!.percentage > 100 && i > 10)
                "
              ></div>
            }
          </div>
          <div class="flex justify-between items-center mt-2">
            <span class="text-body-small text-on-surface-variant">
              {{
                item().consumption!.consumed
                  | currency: 'CHF' : 'symbol' : '1.0-0'
              }}
              dépensé
            </span>
            <span class="text-body-small font-medium">
              @if (item().consumption!.percentage > 100) {
                <span class="text-error">dépassé</span>
              } @else {
                {{ item().consumption!.percentage }}%
              }
            </span>
          </div>
        </div>
      }

      <!-- Footer: Chip + Toggle -->
      @if (!item().metadata.isRollover) {
        <div
          class="flex items-center justify-between pt-3 border-t border-outline-variant/30"
        >
          <mat-chip class="!h-6 !text-label-small bg-surface-container">
            {{ item().data.recurrence | recurrenceLabel }}
          </mat-chip>

          <mat-slide-toggle
            [checked]="!!item().data.checkedAt"
            (change)="toggleCheck.emit(item().data.id)"
            (click)="$event.stopPropagation()"
            [attr.data-testid]="'toggle-check-' + item().data.id"
          />
        </div>
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
export class BudgetEnvelopeCard {
  // Inputs
  readonly item = input.required<BudgetLineTableItem>();
  readonly isSelected = input<boolean>(false);

  // Outputs
  readonly cardClick = output<BudgetLineTableItem>();
  readonly edit = output<BudgetLineTableItem>();
  readonly delete = output<string>();
  readonly addTransaction = output<BudgetLine>();
  readonly resetFromTemplate = output<BudgetLineTableItem>();
  readonly toggleCheck = output<string>();

  // Progress segments (10 segments for visual clarity)
  readonly progressSegments = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
}
