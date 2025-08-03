import { BaseEntity } from '@shared/domain/base-entity';
import { Result } from '@shared/domain/enhanced-result';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';
import { BudgetPeriod } from '../value-objects/budget-period.value-object';

export interface BudgetProps {
  userId: string;
  period: BudgetPeriod;
  description: string;
  templateId: string;
}

export interface BudgetSnapshot {
  id: string;
  userId: string;
  month: number;
  year: number;
  description: string;
  templateId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Budget extends BaseEntity<BudgetProps> {
  private _userId: string;
  private _period: BudgetPeriod;
  private _description: string;
  private _templateId: string;

  get userId(): string {
    return this._userId;
  }

  get period(): BudgetPeriod {
    return this._period;
  }

  get description(): string {
    return this._description;
  }

  get templateId(): string {
    return this._templateId;
  }

  private constructor(props: BudgetProps, id?: string) {
    super(props, id);
    this._userId = props.userId;
    this._period = props.period;
    this._description = props.description;
    this._templateId = props.templateId;
  }

  public static create(props: BudgetProps, id?: string): Result<Budget> {
    // Validate userId
    if (!props.userId || props.userId.trim() === '') {
      return Result.fail(
        new GenericDomainException(
          'User ID is required',
          'INVALID_BUDGET',
          'User ID cannot be empty',
        ),
      );
    }

    // Validate description
    if (!props.description || props.description.trim() === '') {
      return Result.fail(
        new GenericDomainException(
          'Description is required',
          'INVALID_BUDGET',
          'Description cannot be empty',
        ),
      );
    }

    if (props.description.length > 500) {
      return Result.fail(
        new GenericDomainException(
          'Description too long',
          'INVALID_BUDGET',
          'Description cannot exceed 500 characters',
        ),
      );
    }

    // Validate templateId
    if (!props.templateId || props.templateId.trim() === '') {
      return Result.fail(
        new GenericDomainException(
          'Template ID is required',
          'INVALID_BUDGET',
          'Template ID cannot be empty',
        ),
      );
    }

    const budget = new Budget(props, id);
    return Result.ok(budget);
  }

  public updateDescription(description: string): Result<void> {
    if (!description || description.trim() === '') {
      return Result.fail(
        new GenericDomainException(
          'Description is required',
          'INVALID_BUDGET_UPDATE',
          'Description cannot be empty',
        ),
      );
    }

    if (description.length > 500) {
      return Result.fail(
        new GenericDomainException(
          'Description too long',
          'INVALID_BUDGET_UPDATE',
          'Description cannot exceed 500 characters',
        ),
      );
    }

    this._description = description;
    this.markAsUpdated();
    return Result.ok();
  }

  public updatePeriod(period: BudgetPeriod): Result<void> {
    if (this._period.equals(period)) {
      return Result.ok(); // No change needed
    }

    this._period = period;
    this.markAsUpdated();
    return Result.ok();
  }

  /**
   * Business rule: Past budgets cannot be deleted (audit trail)
   */
  public canBeDeleted(): boolean {
    return !this._period.isPast();
  }

  /**
   * Business rule: Past budgets cannot be edited
   */
  public isEditable(): boolean {
    return !this._period.isPast();
  }

  public toSnapshot(): BudgetSnapshot {
    return {
      id: this.id,
      userId: this._userId,
      month: this._period.month,
      year: this._period.year,
      description: this._description,
      templateId: this._templateId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
