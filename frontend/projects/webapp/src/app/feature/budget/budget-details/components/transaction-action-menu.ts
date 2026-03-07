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
import { TranslocoPipe } from '@jsverse/transloco';
import type { Transaction } from 'pulpe-shared';

/**
 * Contextual action menu for free transaction cards.
 * Provides edit and delete actions behind a 3-dot menu,
 * following the same pattern as BudgetActionMenu.
 */
@Component({
  selector: 'pulpe-transaction-action-menu',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    MatDividerModule,
    TranslocoPipe,
  ],
  template: `
    <button
      matIconButton
      [matMenuTriggerFor]="actionMenu"
      (click)="$event.stopPropagation()"
      [attr.data-testid]="'tx-menu-' + transaction().id"
      [attr.aria-label]="'Actions pour ' + transaction().name"
      class="shrink-0"
      [class]="buttonClass()"
    >
      <mat-icon>{{ menuIcon() }}</mat-icon>
    </button>

    <mat-menu #actionMenu="matMenu" xPosition="before">
      <div
        class="px-4 py-2 text-label-medium text-on-surface-variant max-w-48 truncate"
        [matTooltip]="transaction().name"
        matTooltipShowDelay="500"
      >
        {{ transaction().name }}
      </div>
      <mat-divider />
      <button
        mat-menu-item
        (click)="edit.emit(transaction())"
        [attr.data-testid]="'edit-tx-' + transaction().id"
      >
        <mat-icon matMenuItemIcon>edit</mat-icon>
        <span>{{ 'common.edit' | transloco }}</span>
      </button>
      <button
        mat-menu-item
        (click)="delete.emit(transaction().id)"
        [attr.data-testid]="'delete-tx-' + transaction().id"
        class="text-error"
      >
        <mat-icon matMenuItemIcon class="text-error">delete</mat-icon>
        <span>{{ 'common.delete' | transloco }}</span>
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
export class TransactionActionMenu {
  readonly transaction = input.required<Transaction>();
  readonly menuIcon = input<string>('more_vert');
  readonly buttonClass = input<string>('');

  readonly edit = output<Transaction>();
  readonly delete = output<string>();
}
