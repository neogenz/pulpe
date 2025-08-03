import { ValueObject } from '@shared/domain/value-object';
import { Result } from '@shared/domain/enhanced-result';

interface BudgetPeriodProps {
  month: number;
  year: number;
}

export class BudgetPeriod extends ValueObject<BudgetPeriodProps> {
  private static readonly MIN_YEAR = 2020;
  private static readonly MAX_YEARS_IN_FUTURE = 10;
  private static readonly MAX_FUTURE_MONTHS = 24; // 2 years

  get month(): number {
    return this.props.month;
  }

  get year(): number {
    return this.props.year;
  }

  private constructor(props: BudgetPeriodProps) {
    super(props);
  }

  public static create(month: number, year: number): Result<BudgetPeriod> {
    // Validate month
    if (month < 1 || month > 12) {
      return Result.fail(
        `Invalid month: Month must be between 1 and 12, got ${month}`,
      );
    }

    // Validate year
    const currentYear = new Date().getFullYear();
    const maxYear = currentYear + this.MAX_YEARS_IN_FUTURE;

    if (year < this.MIN_YEAR || year > maxYear) {
      return Result.fail(
        `Invalid year: Year must be between ${this.MIN_YEAR} and ${maxYear}, got ${year}`,
      );
    }

    // Validate not too far in future (business rule: max 2 years ahead)
    const now = new Date();
    const periodDate = new Date(year, month - 1);
    const maxFutureDate = new Date(
      now.getFullYear(),
      now.getMonth() + this.MAX_FUTURE_MONTHS,
    );

    if (periodDate > maxFutureDate) {
      return Result.fail(
        'Budget period too far in future: Budget cannot be more than 2 years in the future',
      );
    }

    return Result.ok(new BudgetPeriod({ month, year }));
  }

  public toDate(): Date {
    return new Date(this.props.year, this.props.month - 1, 1);
  }

  public toString(): string {
    const monthStr = this.props.month.toString().padStart(2, '0');
    return `${this.props.year}-${monthStr}`;
  }

  public isFuture(): boolean {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    return (
      this.props.year > currentYear ||
      (this.props.year === currentYear && this.props.month > currentMonth)
    );
  }

  public isPast(): boolean {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    return (
      this.props.year < currentYear ||
      (this.props.year === currentYear && this.props.month < currentMonth)
    );
  }

  public isCurrent(): boolean {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    return this.props.year === currentYear && this.props.month === currentMonth;
  }
}
