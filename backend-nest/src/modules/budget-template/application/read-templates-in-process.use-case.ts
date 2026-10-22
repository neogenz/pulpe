import { Injectable } from '@nestjs/common';
import { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import type {
  BudgetTemplateReadPort,
  TemplateDetails,
} from '../domain/ports/budget-template-read.port';
import type { BudgetTemplate } from '../domain/budget-template.entity';
import { FindAllTemplatesUseCase } from './find-all-templates.use-case';
import { FindTemplateUseCase } from './find-template.use-case';
import { FindTemplateLinesUseCase } from './find-template-lines.use-case';
import { CheckTemplateUsageUseCase } from './check-template-usage.use-case';

/** Month models, for in-process consumers that have no HTTP params. */
@Injectable()
export class ReadTemplatesInProcessUseCase implements BudgetTemplateReadPort {
  constructor(
    private readonly findAll: FindAllTemplatesUseCase,
    private readonly findTemplate: FindTemplateUseCase,
    private readonly findLines: FindTemplateLinesUseCase,
    private readonly checkUsage: CheckTemplateUsageUseCase,
    private readonly session: AuthenticatedSupabaseProvider,
  ) {}

  list(): Promise<BudgetTemplate[]> {
    return this.findAll.execute(this.session.user);
  }

  async get(id: string): Promise<TemplateDetails> {
    const { user } = this.session;
    const [template, lines, usage] = await Promise.all([
      this.findTemplate.execute(id, user),
      this.findLines.execute(id, user),
      this.checkUsage.execute(id, user),
    ]);
    return { template, lines, months: usage.budgets };
  }
}
