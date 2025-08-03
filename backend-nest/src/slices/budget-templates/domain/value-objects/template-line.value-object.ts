import { Result } from '@shared/domain/enhanced-result';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';

export type TemplateLineKind = 'INCOME' | 'FIXED_EXPENSE' | 'VARIABLE_EXPENSE';
export type TemplateLineRecurrence = 'fixed' | 'envelope';

export interface TemplateLineProps {
  id?: string;
  name: string;
  amount: number;
  kind: TemplateLineKind;
  recurrence: TemplateLineRecurrence;
  description?: string;
}

export class TemplateLine {
  private readonly _id: string;
  private readonly _name: string;
  private readonly _amount: number;
  private readonly _kind: TemplateLineKind;
  private readonly _recurrence: TemplateLineRecurrence;
  private readonly _description: string | null;

  get id(): string {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get amount(): number {
    return this._amount;
  }

  get kind(): TemplateLineKind {
    return this._kind;
  }

  get recurrence(): TemplateLineRecurrence {
    return this._recurrence;
  }

  get description(): string | null {
    return this._description;
  }

  private constructor(props: TemplateLineProps & { id: string }) {
    this._id = props.id;
    this._name = props.name;
    this._amount = props.amount;
    this._kind = props.kind;
    this._recurrence = props.recurrence;
    this._description = props.description || null;
  }

  public static create(props: TemplateLineProps): Result<TemplateLine> {
    // Validate name
    if (!props.name || props.name.trim() === '') {
      return Result.fail(
        new GenericDomainException(
          'Template line name is required',
          'INVALID_NAME',
          'Name cannot be empty',
        ),
      );
    }

    const trimmedName = props.name.trim();
    if (trimmedName.length > 100) {
      return Result.fail(
        new GenericDomainException(
          'Template line name is too long',
          'NAME_TOO_LONG',
          'Name cannot exceed 100 characters',
        ),
      );
    }

    // Validate amount
    if (props.amount < 0) {
      return Result.fail(
        new GenericDomainException(
          'Template line amount cannot be negative',
          'INVALID_AMOUNT',
          'Amount must be zero or positive',
        ),
      );
    }

    if (!Number.isFinite(props.amount)) {
      return Result.fail(
        new GenericDomainException(
          'Template line amount must be a finite number',
          'INVALID_AMOUNT',
          'Amount must be a finite number',
        ),
      );
    }

    // Validate kind
    const validKinds: TemplateLineKind[] = [
      'INCOME',
      'FIXED_EXPENSE',
      'VARIABLE_EXPENSE',
    ];
    if (!validKinds.includes(props.kind)) {
      return Result.fail(
        new GenericDomainException(
          'Invalid template line kind',
          'INVALID_KIND',
          `Kind must be one of: ${validKinds.join(', ')}`,
        ),
      );
    }

    // Validate recurrence
    const validRecurrences: TemplateLineRecurrence[] = ['fixed', 'envelope'];
    if (!validRecurrences.includes(props.recurrence)) {
      return Result.fail(
        new GenericDomainException(
          'Invalid template line recurrence',
          'INVALID_RECURRENCE',
          `Recurrence must be one of: ${validRecurrences.join(', ')}`,
        ),
      );
    }

    // Validate description if provided
    if (props.description !== undefined && props.description !== null) {
      const trimmedDescription = props.description.trim();
      if (trimmedDescription.length > 500) {
        return Result.fail(
          new GenericDomainException(
            'Template line description is too long',
            'DESCRIPTION_TOO_LONG',
            'Description cannot exceed 500 characters',
          ),
        );
      }
    }

    // Business rule: Income must be fixed recurrence
    if (props.kind === 'INCOME' && props.recurrence !== 'fixed') {
      return Result.fail(
        new GenericDomainException(
          'Income must have fixed recurrence',
          'INVALID_RECURRENCE',
          'Income template lines must use fixed recurrence type',
        ),
      );
    }

    const id = props.id || crypto.randomUUID();

    return Result.ok(
      new TemplateLine({
        id,
        name: trimmedName,
        amount: Math.round(props.amount * 100) / 100, // Round to 2 decimal places
        kind: props.kind,
        recurrence: props.recurrence,
        description: props.description?.trim() || null,
      }),
    );
  }

  public update(
    props: Partial<Omit<TemplateLineProps, 'id'>>,
  ): Result<TemplateLine> {
    return TemplateLine.create({
      id: this._id,
      name: props.name ?? this._name,
      amount: props.amount ?? this._amount,
      kind: props.kind ?? this._kind,
      recurrence: props.recurrence ?? this._recurrence,
      description:
        props.description !== undefined ? props.description : this._description,
    });
  }

  public isIncome(): boolean {
    return this._kind === 'INCOME';
  }

  public isExpense(): boolean {
    return this._kind === 'FIXED_EXPENSE' || this._kind === 'VARIABLE_EXPENSE';
  }

  public isFixed(): boolean {
    return this._recurrence === 'fixed';
  }

  public isEnvelope(): boolean {
    return this._recurrence === 'envelope';
  }

  public equals(other: TemplateLine): boolean {
    return (
      this._id === other._id &&
      this._name === other._name &&
      this._amount === other._amount &&
      this._kind === other._kind &&
      this._recurrence === other._recurrence &&
      this._description === other._description
    );
  }

  public toJSON() {
    return {
      id: this._id,
      name: this._name,
      amount: this._amount,
      kind: this._kind,
      recurrence: this._recurrence,
      description: this._description,
    };
  }
}
