import { Injectable } from '@nestjs/common';
import {
  TemplateLine,
  type BudgetTemplate,
  type BudgetTemplateCreate,
  type BudgetTemplateUpdate,
  type TemplateLineCreateWithoutTemplateId,
  type TemplateLineUpdate,
} from 'pulpe-shared';
import type { Tables, TablesInsert } from '../../../../types/database.types';
import { EncryptionService } from '@modules/encryption/encryption.service';
import {
  mapCurrencyMetadataToApi,
  mapCurrencyMetadataToDb,
} from '@common/utils/currency-metadata.mapper';

export type DecryptedTemplateLineRow = Omit<
  Tables<'template_line'>,
  'amount' | 'original_amount'
> & {
  amount: number;
  original_amount: number | null;
};

@Injectable()
export class BudgetTemplateMapper {
  toApiTemplate(db: Tables<'template'>): BudgetTemplate {
    return {
      id: db.id,
      name: db.name,
      description: db.description ?? undefined,
      isDefault: db.is_default,
      userId: db.user_id ?? undefined,
      createdAt: db.created_at,
      updatedAt: db.updated_at,
    };
  }

  toApiTemplateList(templates: Tables<'template'>[]): BudgetTemplate[] {
    return templates.map((t) => this.toApiTemplate(t));
  }

  toApiTemplateLine(db: DecryptedTemplateLineRow): TemplateLine {
    return {
      id: db.id,
      description: db.description ?? '',
      createdAt: db.created_at,
      updatedAt: db.updated_at,
      kind: db.kind,
      amount: db.amount,
      name: db.name,
      recurrence: db.recurrence,
      templateId: db.template_id,
      ...mapCurrencyMetadataToApi(db),
    };
  }

  toApiTemplateLineList(lines: DecryptedTemplateLineRow[]): TemplateLine[] {
    return lines.map((l) => this.toApiTemplateLine(l));
  }

  toDbTemplateInsert(
    dto: BudgetTemplateCreate,
    userId: string,
  ): TablesInsert<'template'> {
    return {
      name: dto.name,
      description: dto.description ?? null,
      is_default: dto.isDefault ?? false,
      user_id: userId,
    };
  }

  toDbTemplateUpdate(
    dto: BudgetTemplateUpdate,
  ): Partial<TablesInsert<'template'>> {
    const update: Partial<TablesInsert<'template'>> = {};
    if (dto.name !== undefined) update.name = dto.name;
    if (dto.description !== undefined)
      update.description = dto.description ?? null;
    if (dto.isDefault !== undefined) update.is_default = dto.isDefault;
    return update;
  }

  toDbTemplateLineInsert(
    dto: TemplateLineCreateWithoutTemplateId,
    templateId: string,
    amountEncrypted?: string | null,
  ): TablesInsert<'template_line'> {
    return {
      template_id: templateId,
      name: dto.name,
      amount: amountEncrypted ?? null,
      kind: dto.kind,
      recurrence: dto.recurrence,
      description: dto.description,
      ...mapCurrencyMetadataToDb(dto),
    };
  }

  toDbTemplateLineUpdate(
    dto: TemplateLineUpdate,
    amountEncrypted?: string | null,
  ): Partial<TablesInsert<'template_line'>> {
    const update: Partial<TablesInsert<'template_line'>> = {};
    if (dto.name !== undefined) update.name = dto.name;
    if (dto.amount !== undefined) {
      update.amount = amountEncrypted ?? null;
    }
    if (dto.kind !== undefined) update.kind = dto.kind;
    if (dto.recurrence !== undefined) update.recurrence = dto.recurrence;
    if (dto.description !== undefined) update.description = dto.description;
    Object.assign(update, mapCurrencyMetadataToDb(dto));
    return update;
  }

  decryptLine(
    line: Tables<'template_line'>,
    encryptionService: EncryptionService,
    dek: Buffer,
  ): DecryptedTemplateLineRow {
    return {
      ...line,
      amount: line.amount
        ? encryptionService.tryDecryptAmount(line.amount, dek, 0)
        : 0,
      original_amount: line.original_amount
        ? encryptionService.tryDecryptAmount(line.original_amount, dek, null)
        : null,
    };
  }
}
