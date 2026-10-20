import { describe, expect, it, mock } from 'bun:test';
import { z } from 'zod';
import type { BudgetLine } from '@modules/budget-line/domain/budget-line.entity';
import type { BudgetLineWritePort } from '@modules/budget-line/domain/ports/budget-line-write.port';
import type { Transaction } from '@modules/transaction/domain/transaction.entity';
import type { TransactionWritePort } from '@modules/transaction/domain/ports/transaction-write.port';
import type { ResolveCurrencyUseCase } from '../../../application/resolve-currency.use-case';
import { AddForecastTool } from './add-forecast.tool';
import { SpreadExpenseTool } from './spread-expense.tool';
import { UpdateForecastTool } from './update-forecast.tool';
import { UpdateMovementTool } from './update-movement.tool';

const ID = '11111111-1111-4111-8111-111111111111';
const GOAL = '22222222-2222-4222-8222-222222222222';

const currency = {
  execute: async (amount: number) => ({ amount, targetCurrency: 'CHF' }),
} as unknown as ResolveCurrencyUseCase;

const forecast = { id: ID, name: 'Loyer', amount: 10 } as BudgetLine;
const movement = { id: ID, name: 'Café', amount: 10 } as Transaction;

function forecastPort() {
  return {
    create: mock(async () => forecast),
    update: mock(async () => forecast),
    toggleCheck: mock(async () => forecast),
    spread: mock(async () => ({ lines: [], skippedMonths: [] })),
  } satisfies BudgetLineWritePort;
}

function movementPort() {
  return {
    update: mock(async () => movement),
    remove: mock(async () => {}),
    toggleCheck: mock(async () => movement),
  } satisfies TransactionWritePort;
}

const asksUser = (result: { text: string; wrote?: false }) => {
  expect(result.text.startsWith('Information manquante')).toBe(true);
  expect(result.wrote).toBe(false);
};

describe('update_forecast guards', () => {
  it.each([
    ['a currency without an amount', { currency: 'EUR' as const }],
    ['nothing besides the id', {}],
  ])('asks instead of writing for %s', async (_, args) => {
    const port = forecastPort();
    const result = await new UpdateForecastTool(port, currency).execute({
      forecastId: ID,
      ...args,
    });
    asksUser(result);
    expect(port.update).not.toHaveBeenCalled();
  });

  it('writes when an amount comes with its currency', async () => {
    const port = forecastPort();
    const result = await new UpdateForecastTool(port, currency).execute({
      forecastId: ID,
      amount: 12,
      currency: 'EUR',
    });
    expect(result.wrote).toBeUndefined();
    expect(port.update).toHaveBeenCalledTimes(1);
  });

  it('counts a renamed forecast as a change', async () => {
    const port = forecastPort();
    await new UpdateForecastTool(port, currency).execute({
      forecastId: ID,
      name: 'Autre',
    });
    expect(port.update).toHaveBeenCalledTimes(1);
  });
});

describe('update_movement guards', () => {
  it.each([
    ['a currency without an amount', { currency: 'EUR' as const }],
    ['nothing besides the id', {}],
  ])('asks instead of writing for %s', async (_, args) => {
    const port = movementPort();
    const result = await new UpdateMovementTool(port, currency).execute({
      movementId: ID,
      ...args,
    });
    asksUser(result);
    expect(port.update).not.toHaveBeenCalled();
  });

  it('writes when an amount comes with its currency', async () => {
    const port = movementPort();
    const result = await new UpdateMovementTool(port, currency).execute({
      movementId: ID,
      amount: 12,
      currency: 'EUR',
    });
    expect(result.wrote).toBeUndefined();
    expect(port.update).toHaveBeenCalledTimes(1);
  });
});

describe('add_forecast savings goal guard', () => {
  const base = {
    budgetId: ID,
    name: 'Vacances',
    amount: 100,
    recurrence: 'fixed' as const,
    savingsGoalId: GOAL,
  };

  it('asks instead of silently dropping a goal on a non-saving forecast', async () => {
    const port = forecastPort();
    const result = await new AddForecastTool(port, currency).execute({
      ...base,
      kind: 'expense',
    });
    asksUser(result);
    expect(port.create).not.toHaveBeenCalled();
  });

  it('creates the forecast when the goal rides on a saving', async () => {
    const port = forecastPort();
    await new AddForecastTool(port, currency).execute({
      ...base,
      kind: 'saving',
    });
    expect(port.create).toHaveBeenCalledTimes(1);
  });
});

describe('spread_expense months', () => {
  const schema = z.object(
    new SpreadExpenseTool(forecastPort()).inputSchema as z.ZodRawShape,
  );
  const months = (...periods: [number, number][]) =>
    periods.map(([month, year]) => ({ month, year }));

  it('rejects the same month twice before any write', () => {
    expect(
      schema.safeParse({
        forecastId: ID,
        months: months([10, 2026], [10, 2026]),
      }).success,
    ).toBe(false);
  });

  it('accepts two distinct months', () => {
    expect(
      schema.safeParse({
        forecastId: ID,
        months: months([10, 2026], [11, 2026]),
      }).success,
    ).toBe(true);
  });
});
