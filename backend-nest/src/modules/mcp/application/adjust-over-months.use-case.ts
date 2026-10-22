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
import { agentError } from '../domain/agent-error';

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
      /** Nothing equivalent, but an item already carries the new name: left as is. */
      alreadyNamed: BudgetPeriod[];
      failed: { period: BudgetPeriod; reason: string }[];
    };

const normalized = (name: string): string => name.trim().toLowerCase();

interface Found<T> {
  matches: T[];
  /** No match, but an item already carries the new name. */
  alreadyNamed: boolean;
}

/**
 * Items named like the reference. Once one matches, items that already carry
 * the new name join it: after a rename that failed part way, a month where the
 * user had picked one of several siblings asks again (or takes the same pick)
 * instead of silently renaming the sibling left under the old name. Alone, an
 * item carrying the new name is never written: it may be another item.
 */
function byName<T extends { name: string }>(
  items: T[],
  name: string,
  newName: string | undefined,
): Found<T> {
  const named = (n: string) =>
    items.filter((item) => normalized(item.name) === normalized(n));
  const matches = named(name);
  const renamed =
    newName && normalized(newName) !== normalized(name) ? named(newName) : [];
  return matches.length > 0
    ? { matches: [...matches, ...renamed], alreadyNamed: false }
    : { matches: [], alreadyNamed: renamed.length > 0 };
}

/**
 * The same template line first; failing that, the same name and kind (a month
 * built from another template carries other template line ids).
 */
function equivalentForecasts(
  lines: BudgetLineDecrypted[],
  forecast: BudgetLineDecrypted,
  newName?: string,
): Found<BudgetLineDecrypted> {
  const sameTemplateLine = forecast.templateLineId
    ? lines.filter((line) => line.templateLineId === forecast.templateLineId)
    : [];
  if (sameTemplateLine.length > 0) {
    return { matches: sameTemplateLine, alreadyNamed: false };
  }
  return byName(
    lines.filter((line) => line.kind === forecast.kind),
    forecast.name,
    newName,
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
      alreadyNamed: plan.alreadyNamed,
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
    const alreadyNamed: BudgetPeriod[] = [];
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
      if (i === 0) {
        targets.push({ period, id: input.id });
        return;
      }
      const found = this.#candidates(details, input.name, forecast, movement);
      const candidates = found.matches;
      if (found.alreadyNamed) {
        alreadyNamed.push(period);
      } else if (candidates.length === 0) {
        unmatched.push(period);
      } else if (candidates.length === 1) {
        targets.push({ period, id: candidates[0].id });
      } else {
        const chosen = candidates.filter((c) =>
          input.chosenIds?.includes(c.id),
        );
        // Two picks in one month would ask the same question again, forever.
        if (chosen.length > 1) {
          throw agentError(
            ERROR_DEFINITIONS.VALIDATION_FAILED,
            `${period.month}/${period.year} : plusieurs identifiants choisis dans chosenIds, un seul par mois. Rien n’a été modifié.`,
          );
        }
        if (chosen.length === 1) targets.push({ period, id: chosen[0].id });
        else ambiguous.push({ period, candidates });
      }
    });
    return { targets, missingMonths, unmatched, alreadyNamed, ambiguous };
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
    // RPC if 12 months ever proves slow. The other months are matched on the
    // first one, so it is written last: after a server failure part way, a
    // retry still matches on its old values, and byName keeps a month already
    // renamed from losing the user's pick.
    const [reference, ...others] = targets;
    for (const { period, id } of [...others, reference]) {
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
        failed.push({
          period,
          reason: error.getStatus() === 404 ? 'introuvable' : error.message,
        });
      }
    }
    const byMonth = (a: BudgetPeriod, b: BudgetPeriod) =>
      periodIndex(a) - periodIndex(b);
    updated.sort(byMonth);
    failed.sort((a, b) => byMonth(a.period, b.period));
    return { updated, failed };
  }

  /** The forecast to match (and the movement, for a movement target), read in the first month. */
  #reference(
    input: AdjustOverMonthsInput,
    first: BudgetWithDetails | null,
  ): { forecast: BudgetLineDecrypted; movement?: TransactionDecrypted } {
    // No budget that month: the ids are fine, the month is wrong.
    if (!first) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_NOT_FOUND,
        undefined,
        {
          operation: 'mcp.adjust_over_months',
          ...input.from,
        },
      );
    }
    const lineById = (id: string) =>
      first.budgetLines.find((line) => line.id === id);
    const notFound = (id: string) =>
      new BusinessException(ERROR_DEFINITIONS.BUDGET_LINE_NOT_FOUND, { id });

    if (input.target === 'forecast') {
      const forecast = lineById(input.id);
      if (!forecast) throw notFound(input.id);
      return { forecast };
    }
    const movement = first.transactions.find((t) => t.id === input.id);
    if (!movement) {
      throw new BusinessException(ERROR_DEFINITIONS.TRANSACTION_NOT_FOUND, {
        id: input.id,
      });
    }
    if (!movement.budgetLineId) {
      throw agentError(
        ERROR_DEFINITIONS.VALIDATION_FAILED,
        'Ce mouvement n’est rattaché à aucune prévision : il n’a pas d’équivalent dans les autres mois. Rien n’a été modifié.',
      );
    }
    const forecast = lineById(movement.budgetLineId);
    if (!forecast) throw notFound(movement.budgetLineId);
    return { forecast, movement };
  }

  #candidates(
    details: BudgetWithDetails,
    newName: string | undefined,
    forecast: BudgetLineDecrypted,
    movement?: TransactionDecrypted,
  ): Found<AdjustCandidate> {
    if (!movement) {
      return equivalentForecasts(details.budgetLines, forecast, newName);
    }
    // A movement rename leaves its forecast's name alone.
    const { matches: forecasts } = equivalentForecasts(
      details.budgetLines,
      forecast,
    );
    const ids = new Set(forecasts.map((line) => line.id));
    return byName(
      details.transactions.filter(
        (t) => t.budgetLineId && ids.has(t.budgetLineId),
      ),
      movement.name,
      newName,
    );
  }
}
