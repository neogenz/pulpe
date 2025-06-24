import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { CommonModule } from '@angular/common';
import {
  TransactionFormControls,
  TRANSACTION_TYPES,
  TransactionType,
} from '../../services/transaction-form';

@Component({
  selector: 'pulpe-transaction-form-row',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatOptionModule,
  ],
  template: `
    <div class="grid grid-cols-12 gap-4 items-start">
      <!-- Description Field -->
      <div class="col-span-5">
        <mat-form-field appearance="outline" class="w-full">
          <input
            matInput
            [formControl]="descriptionControl()"
            placeholder="Description de la transaction"
            [attr.aria-describedby]="'description-error-' + rowIndex()"
          />
          @if (descriptionControl().hasError('required')) {
            <mat-error [id]="'description-error-' + rowIndex()">
              La description est requise
            </mat-error>
          }
          @if (descriptionControl().hasError('maxlength')) {
            <mat-error [id]="'description-error-' + rowIndex()">
              Maximum 100 caractères
            </mat-error>
          }
        </mat-form-field>
      </div>

      <!-- Amount Field -->
      <div class="col-span-3">
        <mat-form-field appearance="outline" class="w-full">
          <input
            matInput
            type="number"
            step="0.01"
            min="0"
            max="999999"
            [formControl]="amountControl()"
            placeholder="0.00"
            [attr.aria-describedby]="'amount-error-' + rowIndex()"
          />
          <span matTextSuffix>CHF</span>
          @if (amountControl().hasError('required')) {
            <mat-error [id]="'amount-error-' + rowIndex()">
              Le montant est requis
            </mat-error>
          }
          @if (amountControl().hasError('min')) {
            <mat-error [id]="'amount-error-' + rowIndex()">
              Le montant doit être positif
            </mat-error>
          }
          @if (amountControl().hasError('max')) {
            <mat-error [id]="'amount-error-' + rowIndex()">
              Le montant ne peut pas dépasser 999'999 CHF
            </mat-error>
          }
        </mat-form-field>
      </div>

      <!-- Type Field -->
      <div class="col-span-3">
        <mat-form-field appearance="outline" class="w-full">
          <mat-select
            [formControl]="typeControl()"
            [attr.aria-label]="'Type de transaction ' + (rowIndex() + 1)"
          >
            @for (type of transactionTypes; track type.value) {
              <mat-option [value]="type.value">
                {{ type.label }}
              </mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>

      <!-- Actions -->
      <div class="flex col-span-1 justify-center">
        <button
          mat-icon-button
          color="warn"
          (click)="removeClicked.emit()"
          [disabled]="!canRemove()"
          [attr.aria-label]="'Supprimer la transaction ' + (rowIndex() + 1)"
        >
          <mat-icon>delete</mat-icon>
        </button>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .mat-mdc-form-field {
      width: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class TransactionFormRow {
  readonly formGroup = input.required<FormGroup<TransactionFormControls>>();
  readonly rowIndex = input.required<number>();
  readonly canRemove = input<boolean>(true);

  readonly removeClicked = output<void>();

  readonly transactionTypes = TRANSACTION_TYPES;

  readonly descriptionControl = computed(
    () => this.formGroup().get('description') as FormControl<string>,
  );

  readonly amountControl = computed(
    () => this.formGroup().get('amount') as FormControl<number>,
  );

  readonly typeControl = computed(
    () => this.formGroup().get('type') as FormControl<TransactionType>,
  );
}
