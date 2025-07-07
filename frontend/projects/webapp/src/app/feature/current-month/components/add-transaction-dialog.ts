import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import {
  QuickAddExpenseForm,
  TransactionFormData,
} from './quick-add-expense-form';

@Component({
  selector: 'pulpe-add-transaction-dialog',
  providers: [
    {
      provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
      useValue: {
        appearance: 'outline',
      },
    },
  ],
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    QuickAddExpenseForm,
  ],
  template: `
    <div class="dialog-container">
      <div class="dialog-header">
        <h2 class="dialog-title">Ajouter une transaction</h2>
        <button matIconButton (click)="close()" aria-label="Fermer la dialog">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-content">
        <pulpe-quick-add-expense-form
          (addTransaction)="onAddTransaction($event)"
        />
      </div>
    </div>
  `,
  styles: `
    .dialog-container {
      display: flex;
      flex-direction: column;
      max-width: 100%;
      min-width: 320px;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 24px 24px 16px 24px;
      border-bottom: 1px solid
        var(--mat-dialog-container-divider-color, rgba(0, 0, 0, 0.12));
    }

    .dialog-title {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 500;
      color: var(--mat-dialog-container-text-color, rgba(0, 0, 0, 0.87));
    }

    .dialog-content {
      padding: 16px 24px 24px 24px;
      overflow-y: auto;
      flex: 1;
    }

    @media (max-width: 640px) {
      .dialog-container {
        min-width: 280px;
      }

      .dialog-header {
        padding: 16px 16px 12px 16px;
      }

      .dialog-title {
        font-size: 1.375rem;
      }

      .dialog-content {
        padding: 12px 16px 16px 16px;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddTransactionDialog {
  private readonly dialogRef = inject(MatDialogRef<AddTransactionDialog>);

  protected close(): void {
    this.dialogRef.close();
  }

  protected onAddTransaction(transaction: TransactionFormData): void {
    this.dialogRef.close(transaction);
  }
}
