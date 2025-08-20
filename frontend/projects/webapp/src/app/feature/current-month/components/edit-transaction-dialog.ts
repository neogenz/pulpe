import {
  ChangeDetectionStrategy,
  Component,
  inject,
  ViewChild,
  type AfterViewInit,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import {
  EditTransactionForm,
  type EditTransactionFormData,
} from './edit-transaction-form';
import { type Transaction } from '@pulpe/shared';

export interface EditTransactionDialogData {
  transaction: Transaction;
  isUpdating?: boolean;
}

@Component({
  selector: 'pulpe-edit-transaction-dialog',
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
    EditTransactionForm,
  ],
  template: `
    <div class="dialog-container">
      <div class="dialog-header">
        <h2 class="dialog-title">Modifier la transaction</h2>
        <button matIconButton (click)="close()" aria-label="Fermer la dialog">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-content">
        <pulpe-edit-transaction-form
          #formComponent
          [transaction]="data.transaction"
          (updateTransaction)="onUpdateTransaction($event)"
          (cancelEdit)="close()"
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
export class EditTransactionDialog implements AfterViewInit {
  private readonly dialogRef = inject(MatDialogRef<EditTransactionDialog>);
  protected readonly data = inject<EditTransactionDialogData>(MAT_DIALOG_DATA);

  @ViewChild('formComponent') formComponent!: EditTransactionForm;

  ngAfterViewInit(): void {
    // Reset form state when dialog opens to ensure clean validation state
    // Using setTimeout to avoid ExpressionChangedAfterItHasBeenCheckedError
    setTimeout(() => {
      this.formComponent?.resetForm();
    });
  }

  protected close(): void {
    // Reset loading state before closing
    if (this.formComponent) {
      this.formComponent.isUpdating.set(false);
    }
    this.dialogRef.close();
  }

  protected onUpdateTransaction(
    transactionData: EditTransactionFormData,
  ): void {
    // Note: loading state is managed by the form component
    // It will be reset by the parent component after API call completes
    this.dialogRef.close(transactionData);
  }
}
