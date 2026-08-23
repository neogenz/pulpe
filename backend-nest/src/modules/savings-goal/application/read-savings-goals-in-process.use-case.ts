import { Injectable } from '@nestjs/common';
import { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import type { SavingsGoalReadPort } from '../domain/ports/savings-goal-read.port';
import type {
  SavingsGoal,
  SavingsGoalProgressComputation,
} from '../domain/savings-goal.entity';
import { FindAllSavingsGoalsUseCase } from './find-all-savings-goals.use-case';
import { GetSavingsGoalProgressUseCase } from './get-savings-goal-progress.use-case';

/** Goals and projection, for in-process consumers that have no HTTP params. */
@Injectable()
export class ReadSavingsGoalsInProcessUseCase implements SavingsGoalReadPort {
  constructor(
    private readonly findAll: FindAllSavingsGoalsUseCase,
    private readonly progress: GetSavingsGoalProgressUseCase,
    private readonly session: AuthenticatedSupabaseProvider,
  ) {}

  list(): Promise<SavingsGoal[]> {
    return this.findAll.execute(this.session.user);
  }

  outlook(goalId: string): Promise<SavingsGoalProgressComputation> {
    return this.progress.execute(goalId, this.session.user);
  }
}
