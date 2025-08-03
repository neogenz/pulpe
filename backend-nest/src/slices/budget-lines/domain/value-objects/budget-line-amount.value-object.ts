import { Result } from '@shared/domain/enhanced-result';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';

export class BudgetLineAmount {
  private readonly _value: number;

  get value(): number {
    return this._value;
  }

  private constructor(value: number) {
    this._value = value;
  }

  public static create(value: number): Result<BudgetLineAmount> {
    if (value < 0) {
      return Result.fail(
        new GenericDomainException(
          'Budget line amount cannot be negative',
          'INVALID_AMOUNT',
          'Amount must be zero or positive',
        ),
      );
    }

    if (!Number.isFinite(value)) {
      return Result.fail(
        new GenericDomainException(
          'Budget line amount must be a finite number',
          'INVALID_AMOUNT',
          'Amount must be a finite number',
        ),
      );
    }

    // Max amount: 1 million
    if (value > 1_000_000) {
      return Result.fail(
        new GenericDomainException(
          'Budget line amount exceeds maximum',
          'AMOUNT_TOO_LARGE',
          'Amount cannot exceed 1,000,000',
        ),
      );
    }

    // Round to 2 decimal places for currency
    const roundedValue = Math.round(value * 100) / 100;

    return Result.ok(new BudgetLineAmount(roundedValue));
  }

  public add(other: BudgetLineAmount): Result<BudgetLineAmount> {
    return BudgetLineAmount.create(this._value + other._value);
  }

  public subtract(other: BudgetLineAmount): Result<BudgetLineAmount> {
    return BudgetLineAmount.create(this._value - other._value);
  }

  public multiply(factor: number): Result<BudgetLineAmount> {
    return BudgetLineAmount.create(this._value * factor);
  }

  public equals(other: BudgetLineAmount): boolean {
    return this._value === other._value;
  }

  public isZero(): boolean {
    return this._value === 0;
  }

  public isGreaterThan(other: BudgetLineAmount): boolean {
    return this._value > other._value;
  }

  public isLessThan(other: BudgetLineAmount): boolean {
    return this._value < other._value;
  }

  public toString(): string {
    return this._value.toFixed(2);
  }

  public toJSON(): number {
    return this._value;
  }
}
