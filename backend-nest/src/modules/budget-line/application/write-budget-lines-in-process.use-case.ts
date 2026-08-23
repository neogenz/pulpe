import { Injectable } from '@nestjs/common';
import type { BudgetLineCreate, BudgetLineUpdate } from 'pulpe-shared';
import { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import type { BudgetLineWritePort } from '../domain/ports/budget-line-write.port';
import type { SpreadFanOutResult } from '../domain/ports/budget-line-spread.port';
import type { BudgetLine } from '../domain/budget-line.entity';
import { CreateBudgetLineUseCase } from './create-budget-line.use-case';
import { UpdateBudgetLineUseCase } from './update-budget-line.use-case';
import { ToggleBudgetLineCheckUseCase } from './toggle-budget-line-check.use-case';
import { SpreadBudgetLineFromLineUseCase } from './spread-budget-line-from-line.use-case';

/** Prévision writes, for in-process consumers that have no HTTP request. */
@Injectable()
export class WriteBudgetLinesInProcessUseCase implements BudgetLineWritePort {
  constructor(
    private readonly createBudgetLine: CreateBudgetLineUseCase,
    private readonly updateBudgetLine: UpdateBudgetLineUseCase,
    private readonly toggleBudgetLineCheck: ToggleBudgetLineCheckUseCase,
    private readonly spreadFromLine: SpreadBudgetLineFromLineUseCase,
    private readonly session: AuthenticatedSupabaseProvider,
  ) {}

  create(dto: BudgetLineCreate): Promise<BudgetLine> {
    return this.createBudgetLine.execute(dto, this.session.user);
  }

  update(id: string, patch: BudgetLineUpdate): Promise<BudgetLine> {
    return this.updateBudgetLine.execute(id, patch, this.session.user);
  }

  toggleCheck(id: string): Promise<BudgetLine> {
    return this.toggleBudgetLineCheck.execute(id, this.session.user);
  }

  spread(
    id: string,
    periods: { month: number; year: number }[],
  ): Promise<SpreadFanOutResult> {
    return this.spreadFromLine.execute(id, { periods }, this.session.user);
  }
}
