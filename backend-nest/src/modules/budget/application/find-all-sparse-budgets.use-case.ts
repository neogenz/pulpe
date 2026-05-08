import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import {
  type BudgetSparseListResponse,
  type ListBudgetsQuery,
  PAY_DAY_MIN,
  PAY_DAY_MAX,
} from 'pulpe-shared';
import {
  BUDGET_REPOSITORY,
  type BudgetRepositoryPort,
} from '../domain/ports/budget-repository.port';
import { BudgetMapper } from '../infrastructure/mappers/budget.mapper';
import {
  fieldsRequireAggregates,
  fieldsRequireRollover,
} from '../domain/budget.formulas';
import { RecalculateBudgetBalancesUseCase } from './recalculate-budget-balances.use-case';
import type { Budget } from '../domain/budget.entity';

const ALLOWED_SPARSE_FIELDS = [
  'month',
  'year',
  'rollover',
  'totalExpenses',
  'totalSavings',
  'totalIncome',
  'remaining',
];

@Injectable()
export class FindAllSparseBudgetsUseCase {
  constructor(
    @Inject(BUDGET_REPOSITORY)
    private readonly repo: BudgetRepositoryPort,
    private readonly mapper: BudgetMapper,
    private readonly recalculateUseCase: RecalculateBudgetBalancesUseCase,
    @InjectInfoLogger(FindAllSparseBudgetsUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
    query: ListBudgetsQuery,
  ): Promise<BudgetSparseListResponse> {
    const requestedFields = query.fields!.split(',').map((f) => f.trim());
    const invalidFields = requestedFields.filter(
      (f) => !ALLOWED_SPARSE_FIELDS.includes(f),
    );

    if (invalidFields.length > 0) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_UNKNOWN_SPARSE_FIELDS,
        { fields: invalidFields.join(', ') },
        { operation: 'findAllSparse', userId: user.id },
      );
    }

    const needsAggregates = fieldsRequireAggregates(requestedFields);
    const needsRollover = fieldsRequireRollover(requestedFields);

    const budgetsList = await this.repo.fetchBudgetsWithFilters({
      limit: query.limit,
      year: query.year,
    });
    const budgetIds = budgetsList.map((b) => b.id);

    const aggregatesMap = needsAggregates
      ? await this.repo.fetchBudgetAggregates(budgetIds)
      : new Map();

    const rolloversMap = needsRollover
      ? await this.fetchRolloversForBudgets(budgetsList, supabase)
      : new Map<string, number>();

    const sparseData = budgetsList.map((budget) =>
      this.mapper.toSparseApi(
        budget,
        requestedFields,
        aggregatesMap.get(budget.id),
        rolloversMap.get(budget.id),
      ),
    );

    this.logger.info(
      {
        userId: user.id,
        count: sparseData.length,
        operation: 'budget.listSparse',
      },
      'Sparse budgets fetched',
    );

    return { success: true as const, data: sparseData };
  }

  private async fetchRolloversForBudgets(
    budgets: Budget[],
    supabase: AuthenticatedSupabaseClient,
  ): Promise<Map<string, number>> {
    const payDayOfMonth = await this.getPayDayOfMonth(supabase);
    const rolloversMap = new Map<string, number>();

    await Promise.all(
      budgets.map(async (budget) => {
        try {
          const rolloverData = await this.recalculateUseCase.getRollover(
            budget.id,
            payDayOfMonth,
          );
          rolloversMap.set(budget.id, rolloverData.rollover);
        } catch (error) {
          this.logger.warn(
            {
              budgetId: budget.id,
              month: budget.month,
              year: budget.year,
              err: error,
              operation: 'fetchRolloversForBudgets',
            },
            'Failed to fetch rollover for budget, using fallback of 0',
          );
          rolloversMap.set(budget.id, 0);
        }
      }),
    );

    return rolloversMap;
  }

  private async getPayDayOfMonth(
    supabase: AuthenticatedSupabaseClient,
  ): Promise<number> {
    const { data } = await supabase.auth.getUser();
    const raw = data?.user?.user_metadata?.payDayOfMonth;

    if (typeof raw !== 'number' || !Number.isInteger(raw)) return PAY_DAY_MIN;

    return Math.max(PAY_DAY_MIN, Math.min(PAY_DAY_MAX, raw));
  }
}
