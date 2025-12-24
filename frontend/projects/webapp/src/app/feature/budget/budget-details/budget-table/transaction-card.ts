import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { TransactionKind, Transaction } from '@pulpe/shared';

@Component({
  selector: 'pulpe-transaction-card',
  standalone: true,
  imports: [
    CurrencyPipe,
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
  ],
  template: `
    <div
      class="group flex items-center gap-3 p-3 rounded-lg bg-surface hover:bg-surface-container-low transition-colors"
    >
      <!-- Date (Desktop only) -->
      @if (!isMobile()) {
        <span class="text-label-medium text-on-surface-variant min-w-[50px]">
          {{ transaction().transactionDate | date: 'dd/MM' }}
        </span>
      }

      <!-- Main Content -->
      <div class="flex-1 min-w-0">
        <div class="text-body-medium font-medium truncate">
          {{ transaction().name }}
        </div>
        @if (transaction().category) {
          <div class="text-label-small text-on-surface-variant truncate">
            {{ transaction().category }}
          </div>
        }
        @if (isMobile()) {
          <div class="text-label-small text-on-surface-variant">
            {{ transaction().transactionDate | date: 'dd/MM/yyyy' }}
          </div>
        }
      </div>

      <!-- Amount -->
      <div
        class="text-body-medium font-semibold text-right min-w-[80px]"
        [class.text-pulpe-financial-income]="kind() === 'income'"
        [class.text-pulpe-financial-expense]="kind() === 'expense'"
        [class.text-pulpe-financial-savings]="kind() === 'saving'"
      >
        {{
          transaction().amount | currency: 'CHF' : 'symbol' : '1.2-2' : 'de-CH'
        }}
      </div>

      <!-- Actions -->
      @if (isMobile()) {
        <button
          matIconButton
          [matMenuTriggerFor]="actionMenu"
          class="!w-9 !h-9 text-on-surface-variant"
          aria-label="Actions"
          (click)="$event.stopPropagation()"
        >
          <mat-icon>more_vert</mat-icon>
        </button>
        <mat-menu #actionMenu="matMenu" xPosition="before">
          <button mat-menu-item (click)="edit.emit()">
            <mat-icon>edit</mat-icon>
            <span>Modifier</span>
          </button>
          <button mat-menu-item (click)="onDelete()" class="!text-error">
            <mat-icon class="!text-error">delete</mat-icon>
            <span>Supprimer</span>
          </button>
        </mat-menu>
      } @else {
        <div
          class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <button
            matIconButton
            matTooltip="Modifier"
            (click)="edit.emit(); $event.stopPropagation()"
            class="!w-8 !h-8"
          >
            <mat-icon>edit</mat-icon>
          </button>
          <button
            matIconButton
            matTooltip="Supprimer"
            (click)="onDelete(); $event.stopPropagation()"
            class="!w-8 !h-8 text-error"
          >
            <mat-icon>delete</mat-icon>
          </button>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionCard {
  transaction = input.required<Transaction>();
  kind = input.required<TransactionKind>();
  isMobile = input<boolean>(false);

  edit = output<void>();
  delete = output<void>();

  protected onDelete(): void {
    this.delete.emit();
  }
}
