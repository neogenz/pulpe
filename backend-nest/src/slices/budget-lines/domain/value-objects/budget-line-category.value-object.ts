import { Result } from '@shared/domain/enhanced-result';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';

export type BudgetLineKind = 'fixed' | 'envelope' | 'goal';
export type BudgetLineRecurrence = 'monthly' | 'yearly' | 'one-time';

export interface BudgetLineCategoryProps {
  name: string;
  kind: BudgetLineKind;
  recurrence: BudgetLineRecurrence;
  isManuallyAdjusted: boolean;
}

export class BudgetLineCategory {
  private readonly _name: string;
  private readonly _kind: BudgetLineKind;
  private readonly _recurrence: BudgetLineRecurrence;
  private readonly _isManuallyAdjusted: boolean;

  get name(): string {
    return this._name;
  }

  get kind(): BudgetLineKind {
    return this._kind;
  }

  get recurrence(): BudgetLineRecurrence {
    return this._recurrence;
  }

  get isManuallyAdjusted(): boolean {
    return this._isManuallyAdjusted;
  }

  private constructor(props: BudgetLineCategoryProps) {
    this._name = props.name;
    this._kind = props.kind;
    this._recurrence = props.recurrence;
    this._isManuallyAdjusted = props.isManuallyAdjusted;
  }

  public static create(
    props: BudgetLineCategoryProps,
  ): Result<BudgetLineCategory> {
    // Validate name
    if (!props.name || props.name.trim() === '') {
      return Result.fail(
        new GenericDomainException(
          'Budget line name is required',
          'INVALID_NAME',
          'Name cannot be empty',
        ),
      );
    }

    const trimmedName = props.name.trim();
    if (trimmedName.length > 100) {
      return Result.fail(
        new GenericDomainException(
          'Budget line name is too long',
          'NAME_TOO_LONG',
          'Name cannot exceed 100 characters',
        ),
      );
    }

    // Validate kind
    const validKinds: BudgetLineKind[] = ['fixed', 'envelope', 'goal'];
    if (!validKinds.includes(props.kind)) {
      return Result.fail(
        new GenericDomainException(
          'Invalid budget line kind',
          'INVALID_KIND',
          `Kind must be one of: ${validKinds.join(', ')}`,
        ),
      );
    }

    // Validate recurrence
    const validRecurrences: BudgetLineRecurrence[] = [
      'monthly',
      'yearly',
      'one-time',
    ];
    if (!validRecurrences.includes(props.recurrence)) {
      return Result.fail(
        new GenericDomainException(
          'Invalid budget line recurrence',
          'INVALID_RECURRENCE',
          `Recurrence must be one of: ${validRecurrences.join(', ')}`,
        ),
      );
    }

    return Result.ok(
      new BudgetLineCategory({
        name: trimmedName,
        kind: props.kind,
        recurrence: props.recurrence,
        isManuallyAdjusted: props.isManuallyAdjusted,
      }),
    );
  }

  public markAsManuallyAdjusted(): BudgetLineCategory {
    return new BudgetLineCategory({
      name: this._name,
      kind: this._kind,
      recurrence: this._recurrence,
      isManuallyAdjusted: true,
    });
  }

  public updateName(newName: string): Result<BudgetLineCategory> {
    return BudgetLineCategory.create({
      name: newName,
      kind: this._kind,
      recurrence: this._recurrence,
      isManuallyAdjusted: this._isManuallyAdjusted,
    });
  }

  public isFixed(): boolean {
    return this._kind === 'fixed';
  }

  public isEnvelope(): boolean {
    return this._kind === 'envelope';
  }

  public isGoal(): boolean {
    return this._kind === 'goal';
  }

  public isMonthly(): boolean {
    return this._recurrence === 'monthly';
  }

  public isYearly(): boolean {
    return this._recurrence === 'yearly';
  }

  public isOneTime(): boolean {
    return this._recurrence === 'one-time';
  }

  public equals(other: BudgetLineCategory): boolean {
    return (
      this._name === other._name &&
      this._kind === other._kind &&
      this._recurrence === other._recurrence &&
      this._isManuallyAdjusted === other._isManuallyAdjusted
    );
  }

  public toJSON() {
    return {
      name: this._name,
      kind: this._kind,
      recurrence: this._recurrence,
      isManuallyAdjusted: this._isManuallyAdjusted,
    };
  }
}
