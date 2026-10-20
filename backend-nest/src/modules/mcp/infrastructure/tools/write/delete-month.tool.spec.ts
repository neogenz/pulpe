import { describe, expect, it, mock } from 'bun:test';
import type { BudgetDeletionImpact } from 'pulpe-shared';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type { BudgetWritePort } from '@modules/budget/domain/ports/budget-write.port';
import { DeleteMonthTool } from './delete-month.tool';

const noLinks = {
  spreadForecasts: 0,
  savingsGoalForecasts: 0,
  savingsWithdrawalForecasts: 0,
  savingsWithdrawalMovements: 0,
};

const impactOf = (
  links: Partial<BudgetDeletionImpact['links']> = {},
): BudgetDeletionImpact => ({
  forecastCount: 4,
  movementCount: 2,
  links: { ...noLinks, ...links },
});

function build(impact: BudgetDeletionImpact | Error) {
  const budgets = {
    createFromTemplate: mock(async () => {
      throw new Error('unused');
    }),
    deletionImpact: mock(async () => {
      if (impact instanceof Error) throw impact;
      return impact;
    }),
    removeMonth: mock(async () => impact as BudgetDeletionImpact),
  } satisfies BudgetWritePort;
  return { budgets, tool: new DeleteMonthTool(budgets) };
}

describe('DeleteMonthTool', () => {
  it('should declare a destructive, non-idempotent write tool', () => {
    const { tool } = build(impactOf());

    expect(tool.name).toBe('delete_month');
    expect(tool.mode).toBe('read_write');
    expect(tool.annotations).toEqual({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false,
    });
  });

  it('should delete a month without links and name its counts', async () => {
    const { budgets, tool } = build(impactOf());

    const result = await tool.execute({ month: 3, year: 2027 });

    expect(budgets.deletionImpact).toHaveBeenCalledWith(3, 2027);
    expect(budgets.removeMonth).toHaveBeenCalledTimes(1);
    expect(budgets.removeMonth).toHaveBeenCalledWith(3, 2027, false);
    expect(result.text).toBe(
      'Budget de 3/2027 supprimé (4 prévisions, 2 mouvements).',
    );
  });

  it('should delete a linked month once the user confirmed the links', async () => {
    const { budgets, tool } = build(impactOf({ spreadForecasts: 1 }));

    const result = await tool.execute({
      month: 3,
      year: 2027,
      confirmLinks: true,
    });

    expect(budgets.removeMonth).toHaveBeenCalledWith(3, 2027, true);
    expect(result.text).toContain('Budget de 3/2027 supprimé');
  });

  it('should ask the user and delete nothing while the links are not confirmed', async () => {
    const { budgets, tool } = build(
      impactOf({
        spreadForecasts: 2,
        savingsGoalForecasts: 1,
        savingsWithdrawalForecasts: 1,
        savingsWithdrawalMovements: 2,
      }),
    );

    for (const confirmLinks of [undefined, false]) {
      const result = await tool.execute({ month: 3, year: 2027, confirmLinks });

      expect(result.text).toStartWith('Information manquante');
      expect(result.text).toContain('3/2027');
      expect(result.text).toContain('dépense lissée (2)');
      expect(result.text).toContain('objectif d’épargne (1)');
      expect(result.text).toContain('retrait d’épargne (3)');
      expect(result.text).toEndWith(
        'puis rappelle delete_month avec confirmLinks: true s’il accepte.',
      );
      expect(result.text.toLowerCase()).not.toContain('transaction');
    }
    expect(budgets.removeMonth).not.toHaveBeenCalled();
  });

  it('should list only the links the month actually has', async () => {
    const { tool } = build(impactOf({ savingsWithdrawalMovements: 1 }));

    const result = await tool.execute({ month: 3, year: 2027 });

    expect(result.text).toContain('retrait d’épargne (1)');
    expect(result.text).not.toContain('dépense lissée');
    expect(result.text).not.toContain('objectif d’épargne');
  });

  it('should let a refused month propagate and delete nothing', async () => {
    const refusal = new BusinessException(
      ERROR_DEFINITIONS.BUDGET_NOT_DELETABLE,
    );
    const { budgets, tool } = build(refusal);

    await expect(tool.execute({ month: 10, year: 2026 })).rejects.toBe(refusal);
    expect(budgets.removeMonth).not.toHaveBeenCalled();
  });
});
