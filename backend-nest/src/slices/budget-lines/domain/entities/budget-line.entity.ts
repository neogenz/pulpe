import { BaseEntity } from '@shared/domain/base-entity';
import { Result } from '@shared/domain/enhanced-result';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';
import { BudgetLineAmount } from '../value-objects/budget-line-amount.value-object';
import {
  BudgetLineCategory,
  BudgetLineKind,
  BudgetLineRecurrence,
} from '../value-objects/budget-line-category.value-object';

export interface BudgetLineProps {
  budgetId: string;
  templateLineId?: string | null;
  savingsGoalId?: string | null;
  category: BudgetLineCategory;
  amount: BudgetLineAmount;
}

export interface BudgetLineSnapshot {
  id: string;
  budgetId: string;
  templateLineId: string | null;
  savingsGoalId: string | null;
  name: string;
  amount: number;
  kind: BudgetLineKind;
  recurrence: BudgetLineRecurrence;
  isManuallyAdjusted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class BudgetLine extends BaseEntity<BudgetLineProps> {
  private _budgetId: string;
  private _templateLineId: string | null;
  private _savingsGoalId: string | null;
  private _category: BudgetLineCategory;
  private _amount: BudgetLineAmount;

  get budgetId(): string {
    return this._budgetId;
  }

  get templateLineId(): string | null {
    return this._templateLineId;
  }

  get savingsGoalId(): string | null {
    return this._savingsGoalId;
  }

  get category(): BudgetLineCategory {
    return this._category;
  }

  get amount(): BudgetLineAmount {
    return this._amount;
  }

  private constructor(props: BudgetLineProps, id?: string) {
    super(props, id);
    this._budgetId = props.budgetId;
    this._templateLineId = props.templateLineId ?? null;
    this._savingsGoalId = props.savingsGoalId ?? null;
    this._category = props.category;
    this._amount = props.amount;
  }

  public static create(
    props: BudgetLineProps,
    id?: string,
  ): Result<BudgetLine> {
    // Validate budget ID
    if (!props.budgetId || props.budgetId.trim() === '') {
      return Result.fail(
        new GenericDomainException(
          'Budget ID is required',
          'INVALID_BUDGET_LINE',
          'Budget ID cannot be empty',
        ),
      );
    }

    // Validate template line and savings goal are not both set
    if (props.templateLineId && props.savingsGoalId) {
      return Result.fail(
        new GenericDomainException(
          'Budget line cannot have both template line and savings goal',
          'INVALID_BUDGET_LINE',
          'A budget line must be linked to either a template line or a savings goal, not both',
        ),
      );
    }

    const budgetLine = new BudgetLine(props, id);
    return Result.ok(budgetLine);
  }

  /**
   * Update the amount of the budget line
   */
  public updateAmount(newAmount: BudgetLineAmount): Result<void> {
    // Business rule: Cannot update amount to zero for fixed expenses
    if (this._category.isFixed() && newAmount.isZero()) {
      return Result.fail(
        new GenericDomainException(
          'Fixed expenses cannot have zero amount',
          'INVALID_AMOUNT',
          'Fixed budget lines must have a positive amount',
        ),
      );
    }

    this._amount = newAmount;

    // If amount is manually changed, mark category as manually adjusted
    if (!this._category.isManuallyAdjusted) {
      this._category = this._category.markAsManuallyAdjusted();
    }

    this.markAsUpdated();
    return Result.ok();
  }

  /**
   * Update the category information
   */
  public updateCategory(newCategory: BudgetLineCategory): Result<void> {
    // Business rule: Cannot change from fixed to envelope/goal if amount is zero
    if (newCategory.isFixed() && this._amount.isZero()) {
      return Result.fail(
        new GenericDomainException(
          'Fixed expenses cannot have zero amount',
          'INVALID_CATEGORY',
          'Cannot change to fixed type with zero amount',
        ),
      );
    }

    this._category = newCategory;
    this.markAsUpdated();
    return Result.ok();
  }

  /**
   * Link to a savings goal
   */
  public linkToSavingsGoal(savingsGoalId: string): Result<void> {
    if (!savingsGoalId || savingsGoalId.trim() === '') {
      return Result.fail(
        new GenericDomainException(
          'Savings goal ID is required',
          'INVALID_SAVINGS_GOAL',
          'Savings goal ID cannot be empty',
        ),
      );
    }

    // Remove template line link if exists
    this._templateLineId = null;
    this._savingsGoalId = savingsGoalId;
    this.markAsUpdated();
    return Result.ok();
  }

  /**
   * Unlink from savings goal
   */
  public unlinkFromSavingsGoal(): void {
    this._savingsGoalId = null;
    this.markAsUpdated();
  }

  /**
   * Check if this budget line is from a template
   */
  public isFromTemplate(): boolean {
    return this._templateLineId !== null;
  }

  /**
   * Check if this budget line is linked to a savings goal
   */
  public isLinkedToSavingsGoal(): boolean {
    return this._savingsGoalId !== null;
  }

  /**
   * Calculate monthly equivalent amount
   */
  public getMonthlyEquivalent(): BudgetLineAmount {
    if (this._category.isMonthly()) {
      return this._amount;
    }

    if (this._category.isYearly()) {
      // Divide yearly amount by 12
      const monthlyResult = this._amount.multiply(1 / 12);
      return monthlyResult.getValue(); // Safe because we control the input
    }

    // One-time expenses are spread over 12 months by default
    if (this._category.isOneTime()) {
      const monthlyResult = this._amount.multiply(1 / 12);
      return monthlyResult.getValue();
    }

    return this._amount;
  }

  /**
   * Business rule: Check if this budget line can be deleted
   */
  public canBeDeleted(): boolean {
    // All budget lines can be deleted unless they're linked to active savings goals
    // This would be checked at the application layer with additional context
    return true;
  }

  public toSnapshot(): BudgetLineSnapshot {
    return {
      id: this.id,
      budgetId: this._budgetId,
      templateLineId: this._templateLineId,
      savingsGoalId: this._savingsGoalId,
      name: this._category.name,
      amount: this._amount.value,
      kind: this._category.kind,
      recurrence: this._category.recurrence,
      isManuallyAdjusted: this._category.isManuallyAdjusted,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
