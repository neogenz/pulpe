import { Inject, Injectable } from '@nestjs/common';
import {
  periodFromIndex,
  periodIndex,
  type BudgetPeriod,
  type SupportedCurrency,
} from 'pulpe-shared';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { BusinessException } from '@common/exceptions/business.exception';
import {
  BUDGET_MONTH_READ_PORT,
  type BudgetMonthReadPort,
} from '@modules/budget/domain/ports/budget-month-read.port';
import type {
  BudgetLineDecrypted,
  BudgetWithDetails,
  TransactionDecrypted,
} from '@modules/budget/domain/budget.entity';
import {
  BUDGET_LINE_WRITE_PORT,
  type BudgetLineWritePort,
} from '@modules/budget-line/domain/ports/budget-line-write.port';
import {
  TRANSACTION_WRITE_PORT,
  type TransactionWritePort,
} from '@modules/transaction/domain/ports/transaction-write.port';
import { ResolveCurrencyUseCase } from './resolve-currency.use-case';

export interface AdjustOverMonthsInput {
  target: 'forecast' | 'movement';
  /** The forecast or the movement, in the first month. */
  id: string;
  from: BudgetPeriod;
  /** Months to adjust, the first one included. */
  count: number;
  name?: string;
  amount?: number;
  currency?: SupportedCurrency;
  /** The user's answer when several items match in a month. */
  chosenIds?: readonly string[];
}

export interface AdjustCandidate {
  id: string;
  name: string;
  amount: number;
}

export type AdjustOverMonthsResult =
  | {
      status: 'ambiguous';
      months: { period: BudgetPeriod; candidates: AdjustCandidate[] }[];
    }
  | {
      status: 'done';
      updated: BudgetPeriod[];
      /** No budget that month: never created. */
      missingMonths: BudgetPeriod[];
      /** A budget, but nothing equivalent to the reference. */
      unmatched: BudgetPeriod[];
      failed: { period: BudgetPeriod; reason: string }[];
    };

const normalized = (name: string): string => name.trim().toLowerCase();

/**
 * The same template line first; failing that, the same name and kind (a month
 * built from another template carries other template line ids).
 */
function equivalentForecasts(
  lines: BudgetLineDecrypted[],
  forecast: BudgetLineDecrypted,
): BudgetLineDecrypted[] {
  const sameTemplateLine = forecast.templateLineId
    ? lines.filter((line) => line.templateLineId === forecast.templateLineId)
    : [];
  if (sameTemplateLine.length > 0) return sameTemplateLine;
  return lines.filter(
    (line) =>
      normalized(line.name) === normalized(forecast.name) &&
      line.kind === forecast.kind,
  );
}

/**
 * The same change on a forecast, or on a movement allocated to a forecast,
 * across consecutive months. It never creates a month and never guesses: an
 * item that cannot be matched with certainty is listed, and several candidates
 * come back as a question before anything is written.
 */
@Injectable()
export class AdjustOverMonthsUseCase {
  constructor(
    @Inject(BUDGET_MONTH_READ_PORT)
    private readonly monthRead: BudgetMonthReadPort,
    @Inject(BUDGET_LINE_WRITE_PORT)
    private readonly forecasts: BudgetLineWritePort,
    @Inject(TRANSACTION_WRITE_PORT)
    private readonly movements: TransactionWritePort,
    private readonly resolveCurrency: ResolveCurrencyUseCase,
  ) {}

  async execute(input: AdjustOverMonthsInput): Promise<AdjustOverMonthsResult> {
    const periods = Array.from({ length: input.count }, (_, i) =>
      periodFromIndex(periodIndex(input.from) + i),
    );
    const months = await Promise.all(
      periods.map((p) => this.monthRead.readMonth(p.month, p.year)),
    );

    const plan = this.#match(input, periods, months);
    if (plan.ambiguous.length > 0) {
      return { status: 'ambiguous', months: plan.ambiguous };
    }
    const { updated, failed } = await this.#write(input, plan.targets);
    return {
      status: 'done',
      updated,
      missingMonths: plan.missingMonths,
      unmatched: plan.unmatched,
      failed,
    };
  }

  /** Reads only: which item to change in each month, or why none. */
  #match(
    input: AdjustOverMonthsInput,
    periods: BudgetPeriod[],
    months: (BudgetWithDetails | null)[],
  ) {
    const { forecast, movement } = this.#reference(input, months[0]);
    const targets: { period: BudgetPeriod; id: string }[] = [];
    const missingMonths: BudgetPeriod[] = [];
    const unmatched: BudgetPeriod[] = [];
    const ambiguous: Extract<
      AdjustOverMonthsResult,
      { status: 'ambiguous' }
    >['months'] = [];

    months.forEach((details, i) => {
      const period = periods[i];
      if (!details) {
        missingMonths.push(period);
        return;
      }
      const candidates: AdjustCandidate[] =
        i === 0
          ? [{ id: input.id, name: '', amount: 0 }]
          : this.#candidates(details, forecast, movement);
      if (candidates.length === 0) {
        unmatched.push(period);
      } else if (candidates.length === 1) {
        targets.push({ period, id: candidates[0].id });
      } else {
        const chosen = candidates.filter((c) =>
          input.chosenIds?.includes(c.id),
        );
        if (chosen.length === 1) targets.push({ period, id: chosen[0].id });
        else ambiguous.push({ period, candidates });
      }
    });
    return { targets, missingMonths, unmatched, ambiguous };
  }

  async #write(
    input: AdjustOverMonthsInput,
    targets: { period: BudgetPeriod; id: string }[],
  ) {
    const money =
      input.amount == null
        ? {}
        : await this.resolveCurrency.execute(input.amount, input.currency);
    const name = input.name ? { name: input.name } : {};
    const updated: BudgetPeriod[] = [];
    const failed: { period: BudgetPeriod; reason: string }[] = [];
    // ponytail: sequential and non-atomic, one recalculation per month; a batch
    // RPC if 12 months ever proves slow. Re-running converges, so a failed month
    // can simply be retried.
    for (const { period, id } of targets) {
      try {
        if (input.target === 'forecast') {
          // The write port marks a value edit as manually adjusted.
          await this.forecasts.update(id, { id, ...name, ...money });
        } else {
          await this.movements.update(id, { ...name, ...money });
        }
        updated.push(period);
      } catch (error) {
        if (!(error instanceof BusinessException) || error.getStatus() >= 500) {
          throw error;
        }
        failed.push({ period, reason: error.message });
      }
    }
    return { updated, failed };
  }

  /** The forecast to match (and the movement, for a movement target), read in the first month. */
  #reference(
    input: AdjustOverMonthsInput,
    first: BudgetWithDetails | null,
  ): { forecast: BudgetLineDecrypted; movement?: TransactionDecrypted } {
    const lineById = (id: string) =>
      first?.budgetLines.find((line) => line.id === id);
    const notFound = (id: string) =>
      new BusinessException(ERROR_DEFINITIONS.BUDGET_LINE_NOT_FOUND, { id });

    if (input.target === 'forecast') {
      const forecast = lineById(input.id);
      if (!forecast) throw notFound(input.id);
      return { forecast };
    }
    const movement = first?.transactions.find((t) => t.id === input.id);
    if (!movement) {
      throw new BusinessException(ERROR_DEFINITIONS.TRANSACTION_NOT_FOUND, {
        id: input.id,
      });
    }
    if (!movement.budgetLineId) {
      throw new BusinessException(ERROR_DEFINITIONS.VALIDATION_FAILED, {
        reason: 'movement is not allocated to a forecast',
      });
    }
    const forecast = lineById(movement.budgetLineId);
    if (!forecast) throw notFound(movement.budgetLineId);
    return { forecast, movement };
  }

  #candidates(
    details: BudgetWithDetails,
    forecast: BudgetLineDecrypted,
    movement?: TransactionDecrypted,
  ): AdjustCandidate[] {
    const forecasts = equivalentForecasts(details.budgetLines, forecast);
    if (!movement) return forecasts;
    const ids = new Set(forecasts.map((line) => line.id));
    return details.transactions.filter(
      (t) =>
        t.budgetLineId &&
        ids.has(t.budgetLineId) &&
        normalized(t.name) === normalized(movement.name),
    );
  }
}
