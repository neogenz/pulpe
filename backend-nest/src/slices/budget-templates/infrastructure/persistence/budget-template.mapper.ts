import { Injectable } from '@nestjs/common';
import {
  BudgetTemplateDto,
  BudgetTemplateLineDto,
  CreateBudgetTemplateDto,
  UpdateBudgetTemplateDto,
  CreateBudgetTemplateLineDto,
  UpdateBudgetTemplateLineDto,
  RecurrenceType,
  TemplateLineKind,
} from '@pulpe/shared';
import { BudgetTemplate } from '../../domain/entities/budget-template.entity';
import { TemplateLine } from '../../domain/value-objects/template-line.value-object';

@Injectable()
export class BudgetTemplateMapper {
  /**
   * Map domain entity to API DTO
   */
  toApi(entity: BudgetTemplate): BudgetTemplateDto {
    return {
      id: entity.id,
      userId: entity.userId,
      name: entity.info.name,
      description: entity.info.description,
      isDefault: entity.info.isDefault,
      lines: entity.lines.map((line) => this.lineToApi(line)),
      totalIncome: entity.getTotalIncome(),
      totalExpenses: entity.getTotalExpenses(),
      balance: entity.getBalance(),
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  /**
   * Map domain entities to API DTOs list
   */
  toApiList(entities: BudgetTemplate[]): BudgetTemplateDto[] {
    return entities.map((entity) => this.toApi(entity));
  }

  /**
   * Map template line to API DTO
   */
  lineToApi(line: TemplateLine): BudgetTemplateLineDto {
    return {
      id: line.id,
      name: line.name,
      amount: line.amount,
      kind: this.mapKindToApi(line.kind),
      recurrence: line.recurrence as RecurrenceType,
      description: line.description,
    };
  }

  /**
   * Map create DTO to command data
   */
  fromCreateDto(dto: CreateBudgetTemplateDto): {
    name: string;
    description?: string;
    isDefault: boolean;
    lines?: Array<{
      name: string;
      amount: number;
      kind: 'INCOME' | 'FIXED_EXPENSE' | 'VARIABLE_EXPENSE';
      recurrence: 'fixed' | 'estimated';
      description?: string;
    }>;
  } {
    return {
      name: dto.name,
      description: dto.description,
      isDefault: dto.isDefault || false,
      lines: dto.lines?.map((line) => ({
        name: line.name,
        amount: line.amount,
        kind: this.mapKindFromApi(line.kind),
        recurrence: line.recurrence as 'fixed' | 'estimated',
        description: line.description,
      })),
    };
  }

  /**
   * Map update DTO to command data
   */
  fromUpdateDto(dto: UpdateBudgetTemplateDto): {
    name?: string;
    description?: string;
    isDefault?: boolean;
  } {
    return {
      name: dto.name,
      description: dto.description,
      isDefault: dto.isDefault,
    };
  }

  /**
   * Map create line DTO to command data
   */
  fromCreateLineDto(dto: CreateBudgetTemplateLineDto): {
    name: string;
    amount: number;
    kind: 'INCOME' | 'FIXED_EXPENSE' | 'VARIABLE_EXPENSE';
    recurrence: 'fixed' | 'estimated';
    description?: string;
  } {
    return {
      name: dto.name,
      amount: dto.amount,
      kind: this.mapKindFromApi(dto.kind),
      recurrence: dto.recurrence as 'fixed' | 'estimated',
      description: dto.description,
    };
  }

  /**
   * Map update line DTO to command data
   */
  fromUpdateLineDto(dto: UpdateBudgetTemplateLineDto): {
    name?: string;
    amount?: number;
    kind?: 'INCOME' | 'FIXED_EXPENSE' | 'VARIABLE_EXPENSE';
    recurrence?: 'fixed' | 'estimated';
    description?: string;
  } {
    return {
      name: dto.name,
      amount: dto.amount,
      kind: dto.kind ? this.mapKindFromApi(dto.kind) : undefined,
      recurrence: dto.recurrence as 'fixed' | 'estimated' | undefined,
      description: dto.description,
    };
  }

  /**
   * Map API kind to domain kind
   */
  private mapKindFromApi(
    kind: TemplateLineKind,
  ): 'INCOME' | 'FIXED_EXPENSE' | 'VARIABLE_EXPENSE' {
    switch (kind) {
      case 'income':
        return 'INCOME';
      case 'fixedExpense':
        return 'FIXED_EXPENSE';
      case 'variableExpense':
        return 'VARIABLE_EXPENSE';
      default:
        throw new Error(`Unknown template line kind: ${kind}`);
    }
  }

  /**
   * Map domain kind to API kind
   */
  private mapKindToApi(
    kind: 'INCOME' | 'FIXED_EXPENSE' | 'VARIABLE_EXPENSE',
  ): TemplateLineKind {
    switch (kind) {
      case 'INCOME':
        return 'income';
      case 'FIXED_EXPENSE':
        return 'fixedExpense';
      case 'VARIABLE_EXPENSE':
        return 'variableExpense';
      default:
        throw new Error(`Unknown domain kind: ${kind}`);
    }
  }
}
