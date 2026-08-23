import { Injectable } from '@nestjs/common';
import type { BudgetCreate } from 'pulpe-shared';
import { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import type { BudgetWritePort } from '../domain/ports/budget-write.port';
import type { Budget } from '../domain/budget.entity';
import { CreateBudgetUseCase } from './create-budget.use-case';

/** Month creation, for in-process consumers that have no HTTP request. */
@Injectable()
export class CreateBudgetInProcessUseCase implements BudgetWritePort {
  constructor(
    private readonly createBudget: CreateBudgetUseCase,
    private readonly session: AuthenticatedSupabaseProvider,
  ) {}

  createFromTemplate(dto: BudgetCreate): Promise<Budget> {
    return this.createBudget.execute(dto, this.session.user);
  }
}
