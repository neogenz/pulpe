import { describe, expect, it, mock } from 'bun:test';
import { API_ERROR_CODES } from 'pulpe-shared';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { BusinessException } from '@common/exceptions/business.exception';
import type {
  BudgetLineDecrypted,
  BudgetWithDetails,
  TransactionDecrypted,
} from '@modules/budget/domain/budget.entity';
import type { BudgetMonthReadPort } from '@modules/budget/domain/ports/budget-month-read.port';
import type { BudgetLineWritePort } from '@modules/budget-line/domain/ports/budget-line-write.port';
import type { TransactionWritePort } from '@modules/transaction/domain/ports/transaction-write.port';
import { AdjustOverMonthsUseCase } from './adjust-over-months.use-case';
import type { ResolveCurrencyUseCase } from './resolve-currency.use-case';

const TEMPLATE_LINE = 'tl-rent';

const line = (
  id: string,
  over: Partial<BudgetLineDecrypted> = {},
): BudgetLineDecrypted =>
  ({
    id,
    name: 'Loyer',
    amount: 1600,
    kind: 'expense',
    templateLineId: null,
    ...over,
  }) as BudgetLineDecrypted;

const movement = (
  id: string,
  over: Partial<TransactionDecrypted> = {},
): TransactionDecrypted =>
  ({
    id,
    name: 'Courses',
    amount: 80,
    kind: 'expense',
    budgetLineId: null,
    ...over,
  }) as TransactionDecrypted;

const month = (
  budgetLines: BudgetLineDecrypted[],
  transactions: TransactionDecrypted[] = [],
): BudgetWithDetails =>
  ({ budgetLines, transactions }) as unknown as BudgetWithDetails;

/** Months are read in order from March 2027; `null` = no budget that month. */
function setup(months: (BudgetWithDetails | null)[]) {
  const readMonth = mock(
    async (m: number, y: number) => months[(y - 2027) * 12 + m - 3] ?? null,
  );
  const updateLine = mock(async (id: string, _patch: unknown) => ({ id }));
  const updateMovement = mock(async (id: string, _patch: unknown) => ({ id }));
  const resolve = mock(async (amount: number) => ({
    amount,
    targetCurrency: 'CHF',
  }));
  const useCase = new AdjustOverMonthsUseCase(
    { readMonth } as unknown as BudgetMonthReadPort,
    { update: updateLine } as unknown as BudgetLineWritePort,
    { update: updateMovement } as unknown as TransactionWritePort,
    { execute: resolve } as unknown as ResolveCurrencyUseCase,
  );
  return { useCase, updateLine, updateMovement, resolve };
}

const from = { month: 3, year: 2027 };
const periods = (...ms: number[]) => ms.map((m) => ({ month: m, year: 2027 }));

describe('AdjustOverMonthsUseCase', () => {
  it('follows the template line across months, even when renamed there', async () => {
    const { useCase, updateLine, resolve } = setup([
      month([line('a', { templateLineId: TEMPLATE_LINE })]),
      month([
        line('b', { templateLineId: TEMPLATE_LINE, name: 'Loyer Paris' }),
        line('b-same-name', { name: 'Loyer', templateLineId: 'other' }),
      ]),
      month([line('c', { name: 'Charges', templateLineId: 'other' })]),
    ]);

    const result = await useCase.execute({
      target: 'forecast',
      id: 'a',
      from,
      count: 3,
      amount: 1650,
    });

    expect(result).toEqual({
      status: 'done',
      updated: periods(3, 4),
      missingMonths: [],
      unmatched: periods(5),
      failed: [],
    });
    expect(updateLine.mock.calls.map((c) => c[0])).toEqual(['b', 'a']);
    // The write port marks a value edit as manually adjusted on its own.
    expect(updateLine.mock.calls[1][1]).toEqual({
      id: 'a',
      amount: 1650,
      targetCurrency: 'CHF',
    });
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it('falls back to name and kind in a month built from another template', async () => {
    const { useCase, updateLine } = setup([
      month([line('a', { templateLineId: TEMPLATE_LINE })]),
      month([line('b', { name: ' loyer', templateLineId: 'summer-rent' })]),
      month([line('c', { kind: 'saving', templateLineId: 'summer-rent' })]),
    ]);

    const result = await useCase.execute({
      target: 'forecast',
      id: 'a',
      from,
      count: 3,
      amount: 1800,
    });

    expect(result).toMatchObject({
      updated: periods(3, 4),
      unmatched: periods(5),
    });
    expect(updateLine.mock.calls.map((c) => c[0])).toEqual(['b', 'a']);
  });

  it('matches a forecast without template line on trimmed name and same kind', async () => {
    const { useCase, updateLine } = setup([
      month([line('a')]),
      month([line('b', { name: '  loyer ' })]),
      month([line('c', { kind: 'saving' })]),
    ]);

    const result = await useCase.execute({
      target: 'forecast',
      id: 'a',
      from,
      count: 3,
      name: 'Loyer 2027',
    });

    expect(result).toMatchObject({
      updated: periods(3, 4),
      unmatched: periods(5),
    });
    expect(updateLine.mock.calls.map((c) => c[0])).toEqual(['b', 'a']);
    expect(updateLine.mock.calls[0][1]).toEqual({
      id: 'b',
      name: 'Loyer 2027',
    });
  });

  it('lists a month without budget and never creates it', async () => {
    const { useCase, updateLine } = setup([
      month([line('a')]),
      null,
      month([line('c')]),
    ]);

    const result = await useCase.execute({
      target: 'forecast',
      id: 'a',
      from,
      count: 3,
      amount: 10,
    });

    expect(result).toMatchObject({
      updated: periods(3, 5),
      missingMonths: periods(4),
    });
    expect(updateLine).toHaveBeenCalledTimes(2);
  });

  it('asks before writing when a month has several candidates', async () => {
    const { useCase, updateLine, updateMovement, resolve } = setup([
      month([line('a')]),
      month([line('b1', { amount: 1 }), line('b2', { amount: 2 })]),
    ]);
    const input = {
      target: 'forecast' as const,
      id: 'a',
      from,
      count: 2,
      amount: 10,
    };

    const first = await useCase.execute(input);

    expect(first).toEqual({
      status: 'ambiguous',
      months: [
        {
          period: periods(4)[0],
          candidates: [
            expect.objectContaining({ id: 'b1' }),
            expect.objectContaining({ id: 'b2' }),
          ],
        },
      ],
    });
    expect(updateLine).not.toHaveBeenCalled();
    expect(updateMovement).not.toHaveBeenCalled();
    expect(resolve).not.toHaveBeenCalled();

    const answered = await useCase.execute({ ...input, chosenIds: ['b2'] });

    expect(answered).toMatchObject({ status: 'done', updated: periods(3, 4) });
    expect(updateLine.mock.calls.map((c) => c[0])).toEqual(['b2', 'a']);
  });

  it('updates the same-name movement on the equivalent forecast, without touching forecasts', async () => {
    const { useCase, updateLine, updateMovement } = setup([
      month(
        [line('fa', { templateLineId: TEMPLATE_LINE })],
        [movement('ma', { budgetLineId: 'fa' })],
      ),
      month(
        [line('fb', { templateLineId: TEMPLATE_LINE })],
        [
          movement('mb', { budgetLineId: 'fb', name: ' courses' }),
          movement('other', { budgetLineId: 'fb', name: 'Essence' }),
        ],
      ),
    ]);

    const result = await useCase.execute({
      target: 'movement',
      id: 'ma',
      from,
      count: 2,
      amount: 90,
    });

    expect(result).toMatchObject({ status: 'done', updated: periods(3, 4) });
    expect(updateMovement.mock.calls.map((c) => c[0])).toEqual(['mb', 'ma']);
    expect(updateLine).not.toHaveBeenCalled();
  });

  it('rejects a movement that has no forecast', async () => {
    const { useCase, updateMovement } = setup([month([], [movement('ma')])]);

    const error = await useCase
      .execute({ target: 'movement', id: 'ma', from, count: 1, amount: 1 })
      .catch((e) => e);

    expect(error).toBeInstanceOf(BusinessException);
    expect(error.code).toBe(API_ERROR_CODES.VALIDATION_FAILED);
    expect(updateMovement).not.toHaveBeenCalled();
  });

  it('rejects unknown references', async () => {
    const { useCase } = setup([month([line('a')])]);

    const noForecast = await useCase
      .execute({ target: 'forecast', id: 'zzz', from, count: 1, amount: 1 })
      .catch((e) => e);
    const noMovement = await useCase
      .execute({ target: 'movement', id: 'zzz', from, count: 1, amount: 1 })
      .catch((e) => e);

    expect(noForecast.code).toBe(ERROR_DEFINITIONS.BUDGET_LINE_NOT_FOUND.code);
    expect(noMovement.code).toBe(ERROR_DEFINITIONS.TRANSACTION_NOT_FOUND.code);
  });

  it('records a refused month and goes on with the others', async () => {
    const { useCase, updateLine } = setup([
      month([line('a')]),
      month([line('b')]),
      month([line('c')]),
    ]);
    updateLine.mockImplementation(async (id: string) => {
      if (id === 'b') {
        throw new BusinessException(ERROR_DEFINITIONS.BUDGET_LINE_NOT_FOUND, {
          id,
        });
      }
      return { id };
    });

    const result = await useCase.execute({
      target: 'forecast',
      id: 'a',
      from,
      count: 3,
      amount: 5,
    });

    expect(result).toMatchObject({
      updated: periods(3, 5),
      failed: [{ period: periods(4)[0], reason: expect.stringContaining('b') }],
    });
  });

  it('writes the first month last, so a retry after a server failure finds the same months', async () => {
    const months = [month([line('a')]), month([line('b')]), month([line('c')])];
    const { useCase, updateLine } = setup(months);
    updateLine.mockImplementation(async (id: string) => {
      if (id === 'c') throw new Error('db down');
      return { id };
    });
    const input = {
      target: 'forecast' as const,
      id: 'a',
      from,
      count: 3,
      name: 'Loyer 2027',
    };

    await expect(useCase.execute(input)).rejects.toThrow('db down');
    // The reference month, matched on by name, is still untouched.
    expect(updateLine.mock.calls.map((c) => c[0])).toEqual(['b', 'c']);

    updateLine.mockClear();
    updateLine.mockImplementation(async (id: string) => ({ id }));
    const retried = await useCase.execute(input);

    expect(retried).toMatchObject({ updated: periods(3, 4, 5), unmatched: [] });
    expect(updateLine.mock.calls.map((c) => c[0])).toEqual(['b', 'c', 'a']);
  });

  it('rethrows an unexpected error', async () => {
    const { useCase, updateLine } = setup([month([line('a')])]);
    updateLine.mockImplementation(async () => {
      throw new Error('boom');
    });

    await expect(
      useCase.execute({
        target: 'forecast',
        id: 'a',
        from,
        count: 1,
        amount: 5,
      }),
    ).rejects.toThrow('boom');
  });
});
