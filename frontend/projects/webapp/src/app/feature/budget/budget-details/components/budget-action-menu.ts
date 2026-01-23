import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { BudgetLine } from 'pulpe-shared';
import type { BudgetLineTableItem } from '../data-core';

/**
 * Contextual action menu for budget line cards.
 * Provides edit, add transaction, reset, and delete actions.
 */
@Component({
  selector: 'pulpe-budget-action-menu',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    MatDividerModule,
  ],
  template: `
    <button
      matIconButton
      [matMenuTriggerFor]="actionMenu"
      (click)="$event.stopPropagation()"
      [attr.data-testid]="'card-menu-' + item().data.id"
      class="shrink-0"
      [class]="buttonClass()"
    >
      <mat-icon>{{ menuIcon() }}</mat-icon>
    </button>

    <mat-menu #actionMenu="matMenu" xPosition="before">
      <div
        class="px-4 py-2 text-label-medium text-on-surface-variant max-w-48 truncate"
        [matTooltip]="item().data.name"
        matTooltipShowDelay="500"
      >
        {{ item().data.name }}
      </div>
      @if (showBalance()) {
        <div class="px-4 pb-2 text-label-medium">
          Solde:
          {{ formattedBalance() }}
        </div>
      }
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
  `,
  styles: `
    :host {
      display: inline-block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetActionMenu {
  readonly item = input.required<BudgetLineTableItem>();
  readonly menuIcon = input<string>('more_vert');
  readonly buttonClass = input<string>('');
  readonly showBalance = input<boolean>(false);

  readonly edit = output<BudgetLineTableItem>();
  readonly delete = output<string>();
  readonly addTransaction = output<BudgetLine>();
  readonly resetFromTemplate = output<BudgetLineTableItem>();

  protected formattedBalance(): string {
    const balance = this.item().metadata.cumulativeBalance;
    return new Intl.NumberFormat('fr-CH', {
      style: 'currency',
      currency: 'CHF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(balance);
  }
}
