import { BaseEntity } from '@shared/domain/base-entity';
import { Result } from '@shared/domain/enhanced-result';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';
import { TransactionAmount } from '../value-objects/transaction-amount.value-object';
import type { Enums } from '@/types/database.types';

export type TransactionKind = Enums<'transaction_kind'>;
export type TransactionCategory = string | null;

export interface TransactionProps {
  budgetId: string;
  amount: TransactionAmount;
  name: string;
  kind: TransactionKind;
  transactionDate: Date;
  isOutOfBudget: boolean;
  category: TransactionCategory;
}

export interface TransactionSnapshot {
  id: string;
  budgetId: string;
  amount: number;
  name: string;
  kind: TransactionKind;
  transactionDate: Date;
  isOutOfBudget: boolean;
  category: TransactionCategory;
  createdAt: Date;
  updatedAt: Date;
}

export class Transaction extends BaseEntity<TransactionProps> {
  private static readonly NAME_MAX_LENGTH = 100;

  private _budgetId: string;
  private _amount: TransactionAmount;
  private _name: string;
  private _kind: TransactionKind;
  private _transactionDate: Date;
  private _isOutOfBudget: boolean;
  private _category: TransactionCategory;

  get budgetId(): string {
    return this._budgetId;
  }

  get amount(): TransactionAmount {
    return this._amount;
  }

  get name(): string {
    return this._name;
  }

  get kind(): TransactionKind {
    return this._kind;
  }

  get transactionDate(): Date {
    return this._transactionDate;
  }

  get isOutOfBudget(): boolean {
    return this._isOutOfBudget;
  }

  get category(): TransactionCategory {
    return this._category;
  }

  private constructor(props: TransactionProps, id?: string) {
    super(props, id);
    this._budgetId = props.budgetId;
    this._amount = props.amount;
    this._name = props.name;
    this._kind = props.kind;
    this._transactionDate = props.transactionDate;
    this._isOutOfBudget = props.isOutOfBudget;
    this._category = props.category;
  }

  public static create(
    props: TransactionProps,
    id?: string,
  ): Result<Transaction> {
    // Validate budget ID
    if (!props.budgetId || props.budgetId.trim() === '') {
      return Result.fail(
        new GenericDomainException(
          'Budget ID is required',
          'INVALID_TRANSACTION',
          'Budget ID cannot be empty',
        ),
      );
    }

    // Validate name
    if (!props.name || props.name.trim() === '') {
      return Result.fail(
        new GenericDomainException(
          'Transaction name is required',
          'INVALID_TRANSACTION',
          'Transaction name cannot be empty',
        ),
      );
    }

    if (props.name.length > Transaction.NAME_MAX_LENGTH) {
      return Result.fail(
        new GenericDomainException(
          'Transaction name too long',
          'INVALID_TRANSACTION',
          `Transaction name cannot exceed ${Transaction.NAME_MAX_LENGTH} characters`,
        ),
      );
    }

    // Validate transaction date
    if (!props.transactionDate || !(props.transactionDate instanceof Date)) {
      return Result.fail(
        new GenericDomainException(
          'Valid transaction date is required',
          'INVALID_TRANSACTION',
          'Transaction date must be a valid date',
        ),
      );
    }

    // Validate kind
    if (!props.kind || !['expense', 'income'].includes(props.kind)) {
      return Result.fail(
        new GenericDomainException(
          'Invalid transaction kind',
          'INVALID_TRANSACTION',
          'Transaction kind must be either "expense" or "income"',
        ),
      );
    }

    // Validate category if provided
    if (
      props.category !== null &&
      props.category !== undefined &&
      props.category.trim() === ''
    ) {
      return Result.fail(
        new GenericDomainException(
          'Invalid category',
          'INVALID_TRANSACTION',
          'Category cannot be an empty string',
        ),
      );
    }

    const transaction = new Transaction(props, id);
    return Result.ok(transaction);
  }

  public updateAmount(amount: TransactionAmount): Result<void> {
    this._amount = amount;
    this.markAsUpdated();
    return Result.ok();
  }

  public updateName(name: string): Result<void> {
    if (!name || name.trim() === '') {
      return Result.fail(
        new GenericDomainException(
          'Transaction name is required',
          'INVALID_TRANSACTION_UPDATE',
          'Transaction name cannot be empty',
        ),
      );
    }

    if (name.length > Transaction.NAME_MAX_LENGTH) {
      return Result.fail(
        new GenericDomainException(
          'Transaction name too long',
          'INVALID_TRANSACTION_UPDATE',
          `Transaction name cannot exceed ${Transaction.NAME_MAX_LENGTH} characters`,
        ),
      );
    }

    this._name = name;
    this.markAsUpdated();
    return Result.ok();
  }

  public updateKind(kind: TransactionKind): Result<void> {
    if (!kind || !['expense', 'income'].includes(kind)) {
      return Result.fail(
        new GenericDomainException(
          'Invalid transaction kind',
          'INVALID_TRANSACTION_UPDATE',
          'Transaction kind must be either "expense" or "income"',
        ),
      );
    }

    this._kind = kind;
    this.markAsUpdated();
    return Result.ok();
  }

  public updateTransactionDate(date: Date): Result<void> {
    if (!date || !(date instanceof Date)) {
      return Result.fail(
        new GenericDomainException(
          'Valid transaction date is required',
          'INVALID_TRANSACTION_UPDATE',
          'Transaction date must be a valid date',
        ),
      );
    }

    this._transactionDate = date;
    this.markAsUpdated();
    return Result.ok();
  }

  public updateCategory(category: TransactionCategory): Result<void> {
    if (category !== null && category !== undefined && category.trim() === '') {
      return Result.fail(
        new GenericDomainException(
          'Invalid category',
          'INVALID_TRANSACTION_UPDATE',
          'Category cannot be an empty string',
        ),
      );
    }

    this._category = category;
    this.markAsUpdated();
    return Result.ok();
  }

  public toggleOutOfBudget(): Result<void> {
    this._isOutOfBudget = !this._isOutOfBudget;
    this.markAsUpdated();
    return Result.ok();
  }

  /**
   * Business rule: Check if transaction can be categorized
   */
  public canBeCategorized(): boolean {
    return !this._isOutOfBudget;
  }

  /**
   * Business rule: Out of budget transactions should not have a category
   */
  public markAsOutOfBudget(): Result<void> {
    this._isOutOfBudget = true;
    this._category = null;
    this.markAsUpdated();
    return Result.ok();
  }

  public markAsInBudget(): Result<void> {
    this._isOutOfBudget = false;
    this.markAsUpdated();
    return Result.ok();
  }

  public toSnapshot(): TransactionSnapshot {
    return {
      id: this.id,
      budgetId: this._budgetId,
      amount: this._amount.value,
      name: this._name,
      kind: this._kind,
      transactionDate: this._transactionDate,
      isOutOfBudget: this._isOutOfBudget,
      category: this._category,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
