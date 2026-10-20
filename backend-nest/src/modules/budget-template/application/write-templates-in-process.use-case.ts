import { Injectable } from '@nestjs/common';
import type {
  BudgetPeriod,
  BudgetTemplateCreate,
  BudgetTemplateUpdate,
  TemplateLinesBulkOperations,
} from 'pulpe-shared';
import { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import type { BudgetTemplateWritePort } from '../domain/ports/budget-template-write.port';
import type {
  BudgetTemplate,
  BulkTemplateLineOperationsResult,
  TemplateWithLines,
} from '../domain/budget-template.entity';
import { CreateTemplateUseCase } from './create-template.use-case';
import { UpdateTemplateUseCase } from './update-template.use-case';
import { RemoveTemplateUseCase } from './remove-template.use-case';
import { DuplicateTemplateUseCase } from './duplicate-template.use-case';
import { BulkTemplateLineOperationsUseCase } from './bulk-template-line-operations.use-case';

/** Template writes, for in-process consumers that have no HTTP request. */
@Injectable()
export class WriteTemplatesInProcessUseCase implements BudgetTemplateWritePort {
  constructor(
    private readonly createTemplate: CreateTemplateUseCase,
    private readonly updateTemplate: UpdateTemplateUseCase,
    private readonly removeTemplate: RemoveTemplateUseCase,
    private readonly duplicateTemplate: DuplicateTemplateUseCase,
    private readonly bulkLineOperations: BulkTemplateLineOperationsUseCase,
    private readonly session: AuthenticatedSupabaseProvider,
  ) {}

  create(dto: BudgetTemplateCreate): Promise<TemplateWithLines> {
    return this.createTemplate.execute(dto, this.session.user);
  }

  update(id: string, dto: BudgetTemplateUpdate): Promise<BudgetTemplate> {
    return this.updateTemplate.execute(id, dto, this.session.user);
  }

  async remove(id: string): Promise<void> {
    await this.removeTemplate.execute(id, this.session.user);
  }

  duplicate(id: string, name: string): Promise<TemplateWithLines> {
    return this.duplicateTemplate.execute(id, name, this.session.user);
  }

  editLines(
    id: string,
    ops: TemplateLinesBulkOperations,
    range?: { from: BudgetPeriod; to: BudgetPeriod },
  ): Promise<BulkTemplateLineOperationsResult> {
    return this.bulkLineOperations.execute(id, ops, this.session.user, range);
  }
}
