import { describe, expect, it, mock } from 'bun:test';
import { API_ERROR_CODES } from 'pulpe-shared';
import type { BudgetTemplateWritePort } from '@modules/budget-template/domain/ports/budget-template-write.port';
import type { ResolveCurrencyUseCase } from '../../../application/resolve-currency.use-case';
import { EditTemplateLinesTool } from './edit-template-lines.tool';

const TEMPLATE = '11111111-1111-4111-8111-111111111111';
const LINE = '22222222-2222-4222-8222-222222222222';
const TAG = '33333333-3333-4333-8333-333333333333';

const rent = {
  name: 'Loyer',
  amount: 1600,
  kind: 'expense' as const,
  recurrence: 'fixed' as const,
};

function setup(affectedBudgetsCount = 3) {
  const editLines = mock(async (..._args: unknown[]) => ({
    deletedIds: ['gone'],
    updatedLines: [{ id: LINE, name: 'Loyer' }],
    createdLines: [{ id: 'new-1', name: 'Loyer' }],
    propagation: {
      mode: 'propagate',
      affectedBudgetIds: [],
      affectedBudgetsCount,
    },
  }));
  const port = { editLines } as unknown as BudgetTemplateWritePort;
  const resolveCurrency = {
    execute: mock(async (amount: number, currency?: string) =>
      currency === 'EUR'
        ? {
            amount: amount * 0.9,
            originalAmount: amount,
            originalCurrency: 'EUR',
            targetCurrency: 'CHF',
            exchangeRate: 0.9,
          }
        : { amount, targetCurrency: 'CHF' },
    ),
  };
  return {
    editLines,
    resolveCurrency,
    tool: new EditTemplateLinesTool(
      port,
      resolveCurrency as unknown as ResolveCurrencyUseCase,
    ),
  };
}

const asksUser = (result: { text: string; wrote?: false }) => {
  expect(result.text.startsWith('Information manquante')).toBe(true);
  expect(result.wrote).toBe(false);
};

describe('EditTemplateLinesTool', () => {
  it('asks what to change when every list is empty', async () => {
    const { tool, editLines } = setup();

    asksUser(
      await tool.execute({ templateId: TEMPLATE, scope: 'template_only' }),
    );
    expect(editLines).not.toHaveBeenCalled();
  });

  it('asks for the scope instead of guessing it', async () => {
    const { tool, editLines } = setup();

    const result = await tool.execute({
      templateId: TEMPLATE,
      update: [{ id: LINE, amount: 1600 }],
    });

    asksUser(result);
    expect(result.text).toContain('template_only');
    expect(result.text).toContain('current_and_future');
    expect(result.text).toContain('range');
    expect(result.text).toContain('adjust_over_months');
    expect(editLines).not.toHaveBeenCalled();
  });

  it('asks for the missing end of a range', async () => {
    const { tool, editLines } = setup();

    asksUser(
      await tool.execute({
        templateId: TEMPLATE,
        scope: 'range',
        from: { month: 3, year: 2027 },
        update: [{ id: LINE, amount: 1600 }],
      }),
    );
    expect(editLines).not.toHaveBeenCalled();
  });

  it('asks the frequency of a created forecast instead of guessing it', async () => {
    const { tool, editLines } = setup();

    const result = await tool.execute({
      templateId: TEMPLATE,
      scope: 'template_only',
      create: [{ name: 'Loyer', amount: 1600, kind: 'expense' }],
    });

    asksUser(result);
    expect(result.text).toContain('Mensuel');
    expect(editLines).not.toHaveBeenCalled();
  });

  it('asks for the amount that goes with a currency on an update', async () => {
    const { tool, editLines } = setup();

    asksUser(
      await tool.execute({
        templateId: TEMPLATE,
        scope: 'template_only',
        update: [{ id: LINE, currency: 'EUR' }],
      }),
    );
    expect(editLines).not.toHaveBeenCalled();
  });

  it('asks what to change when an update carries only its id', async () => {
    const { tool, editLines } = setup();

    asksUser(
      await tool.execute({ templateId: TEMPLATE, update: [{ id: LINE }] }),
    );
    expect(editLines).not.toHaveBeenCalled();
  });

  it('keeps the months untouched with template_only', async () => {
    const { tool, editLines } = setup();

    const result = await tool.execute({
      templateId: TEMPLATE,
      scope: 'template_only',
      update: [{ id: LINE, amount: 1600 }],
    });

    expect(editLines.mock.calls[0]).toEqual([
      TEMPLATE,
      expect.objectContaining({ propagateToBudgets: false }),
      undefined,
    ]);
    expect(result.text).toContain('Les mois déjà créés ne changent pas.');
    expect(result.text).not.toContain('mois mis à jour');
  });

  it('propagates to the current month and the following ones without a range', async () => {
    const { tool, editLines } = setup();

    await tool.execute({
      templateId: TEMPLATE,
      scope: 'current_and_future',
      delete: [LINE],
    });

    expect(editLines.mock.calls[0]).toEqual([
      TEMPLATE,
      expect.objectContaining({ propagateToBudgets: true, delete: [LINE] }),
      undefined,
    ]);
  });

  it('forwards the range as given', async () => {
    const { tool, editLines } = setup();
    const from = { month: 3, year: 2027 };
    const to = { month: 6, year: 2027 };

    await tool.execute({
      templateId: TEMPLATE,
      scope: 'range',
      from,
      to,
      update: [{ id: LINE, amount: 1600 }],
    });

    expect(editLines.mock.calls[0]).toEqual([
      TEMPLATE,
      expect.objectContaining({ propagateToBudgets: true }),
      { from, to },
    ]);
  });

  it('rejects a range that ends before it starts and writes nothing', async () => {
    const { tool, editLines } = setup();

    const failure = await tool
      .execute({
        templateId: TEMPLATE,
        scope: 'range',
        from: { month: 6, year: 2027 },
        to: { month: 3, year: 2027 },
        update: [{ id: LINE, amount: 1600 }],
      })
      .catch((e) => e);

    expect(failure.code).toBe(API_ERROR_CODES.VALIDATION_FAILED);
    expect(editLines).not.toHaveBeenCalled();
  });

  it('refuses the same forecast twice in update and writes nothing', async () => {
    const { tool, editLines } = setup();

    const failure = await tool
      .execute({
        templateId: TEMPLATE,
        scope: 'template_only',
        update: [
          { id: LINE, amount: 1700 },
          { id: LINE, tagIds: [TAG] },
        ],
      })
      .catch((e) => e);

    expect(failure.code).toBe(API_ERROR_CODES.VALIDATION_FAILED);
    expect(failure.message).toContain('une seule opération par prévision');
    expect(editLines).not.toHaveBeenCalled();
  });

  it('refuses a forecast both updated and deleted and writes nothing', async () => {
    const { tool, editLines } = setup();

    const failure = await tool
      .execute({
        templateId: TEMPLATE,
        scope: 'template_only',
        update: [{ id: LINE, tagIds: [TAG] }],
        delete: [LINE],
      })
      .catch((e) => e);

    expect(failure.code).toBe(API_ERROR_CODES.VALIDATION_FAILED);
    expect(editLines).not.toHaveBeenCalled();
  });

  it('sends a forecast repeated in delete only once', async () => {
    const { tool, editLines } = setup();

    await tool.execute({
      templateId: TEMPLATE,
      scope: 'template_only',
      delete: [LINE, LINE],
    });

    expect(editLines.mock.calls[0][1]).toMatchObject({ delete: [LINE] });
  });

  it('converts an amount in another currency and keeps its FX fields on the line', async () => {
    const { tool, editLines, resolveCurrency } = setup();

    await tool.execute({
      templateId: TEMPLATE,
      scope: 'template_only',
      create: [{ ...rent, amount: 100, currency: 'EUR', tagIds: [TAG, TAG] }],
      update: [{ id: LINE, amount: 50, currency: 'EUR' }],
    });

    expect(resolveCurrency.execute).toHaveBeenCalledWith(100, 'EUR');
    expect(resolveCurrency.execute).toHaveBeenCalledWith(50, 'EUR');
    const ops = (editLines.mock.calls[0] as unknown[])[1];
    expect(ops).toMatchObject({
      create: [
        {
          name: 'Loyer',
          kind: 'expense',
          recurrence: 'fixed',
          description: '',
          amount: 90,
          originalAmount: 100,
          originalCurrency: 'EUR',
          targetCurrency: 'CHF',
          exchangeRate: 0.9,
          tagIds: [TAG],
        },
      ],
      update: [{ id: LINE, amount: 45, originalCurrency: 'EUR' }],
    });
    expect((ops as { create: object[] }).create[0]).not.toHaveProperty(
      'currency',
    );
  });

  it('leaves a name-only update without any currency lookup or amount', async () => {
    const { tool, editLines, resolveCurrency } = setup();

    await tool.execute({
      templateId: TEMPLATE,
      scope: 'template_only',
      update: [{ id: LINE, name: 'Loyer 2' }],
    });

    expect(resolveCurrency.execute).not.toHaveBeenCalled();
    expect((editLines.mock.calls[0] as unknown[])[1]).toMatchObject({
      update: [{ id: LINE, name: 'Loyer 2' }],
    });
  });

  it('reports the months updated and the ids of the created lines', async () => {
    const { tool } = setup(4);

    const result = await tool.execute({
      templateId: TEMPLATE,
      scope: 'current_and_future',
      create: [rent],
    });

    expect(result.text).toContain(
      'Modèle mis à jour. Prévisions ajoutées : 1, modifiées : 1, supprimées : 1.',
    );
    expect(result.text).toContain('- [new-1] Loyer');
    expect(result.text).toContain('4 mois mis à jour.');
    expect(result.text).toContain('ajustées à la main');
  });

  it('is a destructive, non-idempotent write tool', () => {
    const { tool } = setup();

    expect(tool.name).toBe('edit_template_lines');
    expect(tool.mode).toBe('read_write');
    expect(tool.annotations).toEqual({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false,
    });
  });
});
