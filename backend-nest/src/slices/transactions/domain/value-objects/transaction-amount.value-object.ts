import { Result } from '@shared/domain/enhanced-result';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';

export class TransactionAmount {
  private static readonly MAX_AMOUNT = 1000000;
  private static readonly MIN_AMOUNT = 0.01;

  private readonly _value: number;

  get value(): number {
    return this._value;
  }

  private constructor(value: number) {
    this._value = value;
  }

  public static create(value: number): Result<TransactionAmount> {
    if (typeof value !== 'number' || isNaN(value)) {
      return Result.fail(
        new GenericDomainException(
          'Invalid amount',
          'INVALID_TRANSACTION_AMOUNT',
          'Amount must be a valid number',
        ),
      );
    }

    if (value < TransactionAmount.MIN_AMOUNT) {
      return Result.fail(
        new GenericDomainException(
          'Amount too small',
          'INVALID_TRANSACTION_AMOUNT',
          `Amount must be at least ${TransactionAmount.MIN_AMOUNT}`,
        ),
      );
    }

    if (value > TransactionAmount.MAX_AMOUNT) {
      return Result.fail(
        new GenericDomainException(
          'Amount too large',
          'INVALID_TRANSACTION_AMOUNT',
          `Amount cannot exceed ${TransactionAmount.MAX_AMOUNT}`,
        ),
      );
    }

    // Round to 2 decimal places to avoid floating point issues
    const roundedValue = Math.round(value * 100) / 100;

    return Result.ok(new TransactionAmount(roundedValue));
  }

  public equals(other: TransactionAmount): boolean {
    return this._value === other._value;
  }

  public isGreaterThan(other: TransactionAmount): boolean {
    return this._value > other._value;
  }

  public isLessThan(other: TransactionAmount): boolean {
    return this._value < other._value;
  }

  public add(other: TransactionAmount): Result<TransactionAmount> {
    return TransactionAmount.create(this._value + other._value);
  }

  public subtract(other: TransactionAmount): Result<TransactionAmount> {
    return TransactionAmount.create(this._value - other._value);
  }

  public multiply(factor: number): Result<TransactionAmount> {
    return TransactionAmount.create(this._value * factor);
  }

  public toString(): string {
    return this._value.toFixed(2);
  }

  public toJSON(): number {
    return this._value;
  }
}
