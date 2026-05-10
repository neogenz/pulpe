import { Injectable } from '@nestjs/common';
import {
  type BudgetTemplate as BudgetTemplateApi,
  type TemplateLine as TemplateLineApi,
  type BudgetTemplateCreateResponse,
  type TemplateLinesBulkOperationsResponse,
} from 'pulpe-shared';
import { mapCurrencyMetadataToApi } from '@common/utils/currency-metadata.mapper';
import type {
  BudgetTemplate,
  TemplateLine,
  TemplateWithLines,
  BulkTemplateLineOperationsResult,
} from '../../domain/budget-template.entity';

@Injectable()
export class BudgetTemplateMapper {
  toApiTemplate(entity: BudgetTemplate): BudgetTemplateApi {
    return {
      id: entity.id,
      name: entity.name,
      description: entity.description ?? undefined,
      isDefault: entity.isDefault,
      userId: entity.userId ?? undefined,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  toApiTemplateList(entities: BudgetTemplate[]): BudgetTemplateApi[] {
    return entities.map((t) => this.toApiTemplate(t));
  }

  toApiTemplateLine(entity: TemplateLine): TemplateLineApi {
    return {
      id: entity.id,
      templateId: entity.templateId,
      name: entity.name,
      amount: entity.amount,
      kind: entity.kind,
      recurrence: entity.recurrence,
      description: entity.description ?? '',
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      ...mapCurrencyMetadataToApi({
        original_amount: entity.originalAmount,
        original_currency: entity.originalCurrency,
        target_currency: entity.targetCurrency,
        exchange_rate: entity.exchangeRate,
      }),
    };
  }

  toApiTemplateLineList(entities: TemplateLine[]): TemplateLineApi[] {
    return entities.map((l) => this.toApiTemplateLine(l));
  }

  toApiTemplateCreateResponse(
    composite: TemplateWithLines,
  ): BudgetTemplateCreateResponse {
    return {
      success: true,
      data: {
        template: this.toApiTemplate(composite.template),
        lines: this.toApiTemplateLineList(composite.lines),
      },
    };
  }

  toApiBulkOperationsResponse(
    result: BulkTemplateLineOperationsResult,
  ): TemplateLinesBulkOperationsResponse {
    return {
      success: true,
      data: {
        created: this.toApiTemplateLineList(result.createdLines),
        updated: this.toApiTemplateLineList(result.updatedLines),
        deleted: result.deletedIds,
        propagation: result.propagation,
      },
    };
  }
}
