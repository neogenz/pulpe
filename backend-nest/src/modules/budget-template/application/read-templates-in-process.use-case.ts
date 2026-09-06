import { Injectable } from '@nestjs/common';
import { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import type { BudgetTemplateReadPort } from '../domain/ports/budget-template-read.port';
import type { BudgetTemplate } from '../domain/budget-template.entity';
import { FindAllTemplatesUseCase } from './find-all-templates.use-case';

/** Month models, for in-process consumers that have no HTTP params. */
@Injectable()
export class ReadTemplatesInProcessUseCase implements BudgetTemplateReadPort {
  constructor(
    private readonly findAll: FindAllTemplatesUseCase,
    private readonly session: AuthenticatedSupabaseProvider,
  ) {}

  list(): Promise<BudgetTemplate[]> {
    return this.findAll.execute(this.session.user);
  }
}
