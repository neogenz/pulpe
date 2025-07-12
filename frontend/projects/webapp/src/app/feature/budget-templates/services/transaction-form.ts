import { Injectable } from '@angular/core';
import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms';
import type { TransactionKind } from '@pulpe/shared';

export interface TransactionFormData {
  description: string;
  amount: number;
  type: TransactionKind;
}

export interface TransactionFormControls {
  description: FormControl<string>;
  amount: FormControl<number>;
  type: FormControl<TransactionKind>;
}

export const TRANSACTION_VALIDATORS = {
  description: [Validators.required, Validators.maxLength(100)],
  amount: [Validators.required, Validators.min(0.01), Validators.max(999999)],
  type: [Validators.required],
};

export const TRANSACTION_TYPES = [
  { value: 'income' as const, label: 'Revenu' },
  { value: 'expense' as const, label: 'Dépense' },
  { value: 'saving' as const, label: 'Économie' },
  { value: 'exceptional_income' as const, label: 'Revenu exceptionnel' },
] as const;

@Injectable()
export class TransactionFormService {
  createTransactionFormGroup(
    transaction?: TransactionFormData,
  ): FormGroup<TransactionFormControls> {
    return new FormGroup<TransactionFormControls>({
      description: new FormControl(transaction?.description ?? '', {
        nonNullable: true,
        validators: TRANSACTION_VALIDATORS.description,
      }),
      amount: new FormControl(transaction?.amount ?? 0, {
        nonNullable: true,
        validators: TRANSACTION_VALIDATORS.amount,
      }),
      type: new FormControl(transaction?.type ?? 'expense', {
        nonNullable: true,
        validators: TRANSACTION_VALIDATORS.type,
      }),
    });
  }

  createTransactionsFormArray(
    transactions: TransactionFormData[],
  ): FormArray<FormGroup<TransactionFormControls>> {
    const formArray = new FormArray<FormGroup<TransactionFormControls>>([]);

    if (transactions.length === 0) {
      formArray.push(this.createTransactionFormGroup());
    } else {
      transactions.forEach((transaction) => {
        formArray.push(this.createTransactionFormGroup(transaction));
      });
    }

    return formArray;
  }

  addTransactionToFormArray(
    formArray: FormArray<FormGroup<TransactionFormControls>>,
    transaction?: TransactionFormData,
  ): void {
    formArray.push(this.createTransactionFormGroup(transaction));
  }

  removeTransactionFromFormArray(
    formArray: FormArray<FormGroup<TransactionFormControls>>,
    index: number,
  ): boolean {
    if (formArray.length > 1) {
      formArray.removeAt(index);
      return true;
    }
    return false;
  }

  validateTransactionsForm(
    formArray: FormArray<FormGroup<TransactionFormControls>>,
  ): boolean {
    return formArray.valid && formArray.length > 0;
  }

  getTransactionFormData(
    formArray: FormArray<FormGroup<TransactionFormControls>>,
  ): TransactionFormData[] {
    return formArray.value as TransactionFormData[];
  }

  getFormControl(
    formArray: FormArray<FormGroup<TransactionFormControls>>,
    index: number,
    field: keyof TransactionFormControls,
  ): FormControl {
    const formGroup = formArray.at(index);
    const control = formGroup.get(field);
    if (!control) {
      throw new Error(`Control ${String(field)} not found at index ${index}`);
    }
    return control as FormControl;
  }
}
