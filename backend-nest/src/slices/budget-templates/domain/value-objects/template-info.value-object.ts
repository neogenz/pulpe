import { Result } from '@shared/domain/enhanced-result';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';

export interface TemplateInfoProps {
  name: string;
  description?: string;
  isDefault: boolean;
}

export class TemplateInfo {
  private readonly _name: string;
  private readonly _description: string | null;
  private readonly _isDefault: boolean;

  get name(): string {
    return this._name;
  }

  get description(): string | null {
    return this._description;
  }

  get isDefault(): boolean {
    return this._isDefault;
  }

  private constructor(props: TemplateInfoProps) {
    this._name = props.name;
    this._description = props.description || null;
    this._isDefault = props.isDefault;
  }

  public static create(props: TemplateInfoProps): Result<TemplateInfo> {
    // Validate name
    if (!props.name || props.name.trim() === '') {
      return Result.fail(
        new GenericDomainException(
          'Template name is required',
          'INVALID_TEMPLATE_INFO',
          'Name cannot be empty',
        ),
      );
    }

    const trimmedName = props.name.trim();
    if (trimmedName.length > 100) {
      return Result.fail(
        new GenericDomainException(
          'Template name is too long',
          'INVALID_TEMPLATE_INFO',
          'Name cannot exceed 100 characters',
        ),
      );
    }

    // Validate description if provided
    if (props.description !== undefined && props.description !== null) {
      const trimmedDescription = props.description.trim();
      if (trimmedDescription.length > 500) {
        return Result.fail(
          new GenericDomainException(
            'Template description is too long',
            'INVALID_TEMPLATE_INFO',
            'Description cannot exceed 500 characters',
          ),
        );
      }
    }

    return Result.ok(
      new TemplateInfo({
        name: trimmedName,
        description: props.description?.trim() || null,
        isDefault: props.isDefault,
      }),
    );
  }

  public updateName(newName: string): Result<TemplateInfo> {
    return TemplateInfo.create({
      name: newName,
      description: this._description,
      isDefault: this._isDefault,
    });
  }

  public updateDescription(
    newDescription: string | null,
  ): Result<TemplateInfo> {
    return TemplateInfo.create({
      name: this._name,
      description: newDescription,
      isDefault: this._isDefault,
    });
  }

  public setAsDefault(): TemplateInfo {
    return new TemplateInfo({
      name: this._name,
      description: this._description,
      isDefault: true,
    });
  }

  public unsetAsDefault(): TemplateInfo {
    return new TemplateInfo({
      name: this._name,
      description: this._description,
      isDefault: false,
    });
  }

  public update(props: Partial<TemplateInfoProps>): Result<TemplateInfo> {
    return TemplateInfo.create({
      name: props.name !== undefined ? props.name : this._name,
      description:
        props.description !== undefined ? props.description : this._description,
      isDefault:
        props.isDefault !== undefined ? props.isDefault : this._isDefault,
    });
  }

  public equals(other: TemplateInfo): boolean {
    return (
      this._name === other._name &&
      this._description === other._description &&
      this._isDefault === other._isDefault
    );
  }

  public toJSON() {
    return {
      name: this._name,
      description: this._description,
      isDefault: this._isDefault,
    };
  }
}
