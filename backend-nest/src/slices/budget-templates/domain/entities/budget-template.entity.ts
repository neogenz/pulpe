import { BaseEntity } from '@shared/domain/base-entity';
import { Result } from '@shared/domain/enhanced-result';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';
import { TemplateInfo } from '../value-objects/template-info.value-object';
import {
  TemplateLine,
  TemplateLineProps,
} from '../value-objects/template-line.value-object';

export interface BudgetTemplateProps {
  userId: string;
  info: TemplateInfo;
  lines: TemplateLine[];
}

export interface BudgetTemplateSnapshot {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  lines: TemplateLine[];
  createdAt: Date;
  updatedAt: Date;
}

export class BudgetTemplate extends BaseEntity<BudgetTemplateProps> {
  private _userId: string;
  private _info: TemplateInfo;
  private _lines: TemplateLine[];

  get userId(): string {
    return this._userId;
  }

  get info(): TemplateInfo {
    return this._info;
  }

  get lines(): TemplateLine[] {
    return [...this._lines]; // Return a copy to maintain immutability
  }

  private constructor(props: BudgetTemplateProps, id?: string) {
    super(props, id);
    this._userId = props.userId;
    this._info = props.info;
    this._lines = [...props.lines];
  }

  public static create(
    props: BudgetTemplateProps,
    id?: string,
  ): Result<BudgetTemplate> {
    // Validate user ID
    if (!props.userId || props.userId.trim() === '') {
      return Result.fail(
        new GenericDomainException(
          'User ID is required',
          'INVALID_BUDGET_TEMPLATE',
          'User ID cannot be empty',
        ),
      );
    }

    // Business rule: A template must have at least one income line
    const hasIncome = props.lines.some((line) => line.isIncome());
    if (!hasIncome) {
      return Result.fail(
        new GenericDomainException(
          'Template must have at least one income line',
          'NO_INCOME_LINE',
          'A budget template requires at least one income source',
        ),
      );
    }

    // Business rule: No duplicate line names within a template
    const lineNames = props.lines.map((line) => line.name.toLowerCase());
    const uniqueNames = new Set(lineNames);
    if (lineNames.length !== uniqueNames.size) {
      return Result.fail(
        new GenericDomainException(
          'Duplicate line names found',
          'DUPLICATE_LINE_NAMES',
          'Each line in a template must have a unique name',
        ),
      );
    }

    const template = new BudgetTemplate(props, id);
    return Result.ok(template);
  }

  /**
   * Update template information
   */
  public updateInfo(newInfo: TemplateInfo): Result<void> {
    this._info = newInfo;
    this.markAsUpdated();
    return Result.ok();
  }

  /**
   * Set this template as the default
   */
  public setAsDefault(): void {
    this._info = this._info.setAsDefault();
    this.markAsUpdated();
  }

  /**
   * Unset this template as the default
   */
  public unsetAsDefault(): void {
    this._info = this._info.unsetAsDefault();
    this.markAsUpdated();
  }

  /**
   * Add a new line to the template
   */
  public addLine(line: TemplateLine): Result<void> {
    // Check for duplicate name
    const existingLine = this._lines.find(
      (l) => l.name.toLowerCase() === line.name.toLowerCase(),
    );
    if (existingLine) {
      return Result.fail(
        new GenericDomainException(
          'Line with this name already exists',
          'DUPLICATE_LINE_NAME',
          `A line named "${line.name}" already exists in this template`,
        ),
      );
    }

    this._lines.push(line);
    this.markAsUpdated();
    return Result.ok();
  }

  /**
   * Remove a line from the template
   */
  public removeLine(lineId: string): Result<void> {
    const lineIndex = this._lines.findIndex((line) => line.id === lineId);
    if (lineIndex === -1) {
      return Result.fail(
        new GenericDomainException(
          'Line not found',
          'LINE_NOT_FOUND',
          `Line with ID ${lineId} not found in template`,
        ),
      );
    }

    const lineToRemove = this._lines[lineIndex];

    // Business rule: Cannot remove the last income line
    if (lineToRemove.isIncome()) {
      const remainingIncomeLines = this._lines.filter(
        (line) => line.id !== lineId && line.isIncome(),
      );
      if (remainingIncomeLines.length === 0) {
        return Result.fail(
          new GenericDomainException(
            'Cannot remove last income line',
            'LAST_INCOME_LINE',
            'A template must have at least one income line',
          ),
        );
      }
    }

    this._lines.splice(lineIndex, 1);
    this.markAsUpdated();
    return Result.ok();
  }

  /**
   * Update an existing line
   */
  public updateLine(
    lineId: string,
    updates: Partial<Omit<TemplateLineProps, 'id'>>,
  ): Result<void> {
    const lineIndex = this._lines.findIndex((line) => line.id === lineId);
    if (lineIndex === -1) {
      return Result.fail(
        new GenericDomainException(
          'Line not found',
          'LINE_NOT_FOUND',
          `Line with ID ${lineId} not found in template`,
        ),
      );
    }

    const currentLine = this._lines[lineIndex];
    const updatedLineResult = currentLine.update(updates);

    if (updatedLineResult.isFailure) {
      return Result.fail(updatedLineResult.error);
    }

    const updatedLine = updatedLineResult.getValue();

    // Check for name conflicts if name was updated
    if (updates.name && updates.name !== currentLine.name) {
      const nameConflict = this._lines.some(
        (line) =>
          line.id !== lineId &&
          line.name.toLowerCase() === updatedLine.name.toLowerCase(),
      );
      if (nameConflict) {
        return Result.fail(
          new GenericDomainException(
            'Line name already exists',
            'DUPLICATE_LINE_NAME',
            `A line named "${updatedLine.name}" already exists in this template`,
          ),
        );
      }
    }

    // Business rule: Cannot change last income line to expense
    if (currentLine.isIncome() && updatedLine.isExpense()) {
      const otherIncomeLines = this._lines.filter(
        (line) => line.id !== lineId && line.isIncome(),
      );
      if (otherIncomeLines.length === 0) {
        return Result.fail(
          new GenericDomainException(
            'Cannot change last income line to expense',
            'LAST_INCOME_LINE',
            'A template must have at least one income line',
          ),
        );
      }
    }

    this._lines[lineIndex] = updatedLine;
    this.markAsUpdated();
    return Result.ok();
  }

  /**
   * Replace all lines in the template
   */
  public replaceAllLines(newLines: TemplateLine[]): Result<void> {
    // Validate at least one income
    const hasIncome = newLines.some((line) => line.isIncome());
    if (!hasIncome) {
      return Result.fail(
        new GenericDomainException(
          'Template must have at least one income line',
          'NO_INCOME_LINE',
          'A budget template requires at least one income source',
        ),
      );
    }

    // Check for duplicate names
    const lineNames = newLines.map((line) => line.name.toLowerCase());
    const uniqueNames = new Set(lineNames);
    if (lineNames.length !== uniqueNames.size) {
      return Result.fail(
        new GenericDomainException(
          'Duplicate line names found',
          'DUPLICATE_LINE_NAMES',
          'Each line in a template must have a unique name',
        ),
      );
    }

    this._lines = [...newLines];
    this.markAsUpdated();
    return Result.ok();
  }

  /**
   * Calculate total income
   */
  public getTotalIncome(): number {
    return this._lines
      .filter((line) => line.isIncome())
      .reduce((total, line) => total + line.amount, 0);
  }

  /**
   * Calculate total expenses
   */
  public getTotalExpenses(): number {
    return this._lines
      .filter((line) => line.isExpense())
      .reduce((total, line) => total + line.amount, 0);
  }

  /**
   * Calculate balance (income - expenses)
   */
  public getBalance(): number {
    return this.getTotalIncome() - this.getTotalExpenses();
  }

  /**
   * Get lines by kind
   */
  public getLinesByKind(
    kind: 'INCOME' | 'FIXED_EXPENSE' | 'VARIABLE_EXPENSE',
  ): TemplateLine[] {
    return this._lines.filter((line) => line.kind === kind);
  }

  /**
   * Business rule: Check if template can be used to create a budget
   */
  public canCreateBudget(): boolean {
    // Must have at least one income and one expense
    const hasIncome = this._lines.some((line) => line.isIncome());
    const hasExpense = this._lines.some((line) => line.isExpense());
    return hasIncome && hasExpense;
  }

  /**
   * Duplicate this template
   */
  public duplicate(
    newName: string,
    newUserId?: string,
  ): Result<BudgetTemplate> {
    const newInfoResult = TemplateInfo.create({
      name: newName,
      description: this._info.description,
      isDefault: false, // Duplicated templates are not default
    });

    if (newInfoResult.isFailure) {
      return Result.fail(newInfoResult.error);
    }

    // Create new lines with new IDs
    const newLines: TemplateLine[] = [];
    for (const line of this._lines) {
      const newLineResult = TemplateLine.create({
        name: line.name,
        amount: line.amount,
        kind: line.kind,
        recurrence: line.recurrence,
        description: line.description,
      });

      if (newLineResult.isFailure) {
        return Result.fail(newLineResult.error);
      }

      newLines.push(newLineResult.getValue());
    }

    return BudgetTemplate.create({
      userId: newUserId || this._userId,
      info: newInfoResult.getValue(),
      lines: newLines,
    });
  }

  public toSnapshot(): BudgetTemplateSnapshot {
    return {
      id: this.id,
      userId: this._userId,
      name: this._info.name,
      description: this._info.description,
      isDefault: this._info.isDefault,
      lines: this._lines,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
