import { describe, expect, it, mock } from 'bun:test';
import { API_ERROR_CODES } from 'pulpe-shared';
import type {
  AdjustOverMonthsResult,
  AdjustOverMonthsUseCase,
} from '../../../application/adjust-over-months.use-case';
import { AdjustOverMonthsTool } from './adjust-over-months.tool';

const ID = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const start = { month: 3, year: 2027 };
const base = { target: 'forecast' as const, id: ID, ...start, amount: 1650 };

const done = (
  over: Partial<Extract<AdjustOverMonthsResult, { status: 'done' }>> = {},
) =>
  ({
    status: 'done',
    updated: [{ month: 3, year: 2027 }],
    missingMonths: [],
    unmatched: [],
    alreadyNamed: [],
    failed: [],
    ...over,
  }) as AdjustOverMonthsResult;

function setup(result: AdjustOverMonthsResult = done()) {
  const execute = mock(async (..._args: unknown[]) => result);
  return {
    execute,
    tool: new AdjustOverMonthsTool({
      execute,
    } as unknown as AdjustOverMonthsUseCase),
  };
}

const asksUser = (result: { text: string; wrote?: false }) => {
  expect(result.text.startsWith('Information manquante')).toBe(true);
  expect(result.wrote).toBe(false);
};

describe('AdjustOverMonthsTool', () => {
  it('asks what changes when neither name nor amount is given', async () => {
    const { tool, execute } = setup();

    asksUser(
      await tool.execute({ target: 'forecast', id: ID, ...start, months: 2 }),
    );
    expect(execute).not.toHaveBeenCalled();
  });

  it('asks for the amount that goes with a currency', async () => {
    const { tool, execute } = setup();

    asksUser(
      await tool.execute({
        target: 'forecast',
        id: ID,
        ...start,
        name: 'Loyer',
        currency: 'EUR',
        months: 2,
      }),
    );
    expect(execute).not.toHaveBeenCalled();
  });

  it('asks for the span when neither months nor until is given, or both', async () => {
    const { tool, execute } = setup();

    asksUser(await tool.execute(base));
    asksUser(
      await tool.execute({
        ...base,
        months: 2,
        until: { month: 5, year: 2027 },
      }),
    );
    expect(execute).not.toHaveBeenCalled();
  });

  it('turns until into a month count, the first month included', async () => {
    const { tool, execute } = setup();

    await tool.execute({ ...base, until: { month: 6, year: 2027 } });

    expect(execute.mock.calls[0][0]).toMatchObject({
      from: start,
      count: 4,
      amount: 1650,
    });
  });

  it('refuses an until before the start or more than 12 months away', async () => {
    const { tool, execute } = setup();

    const refuse = (until: { month: number; year: number }) =>
      tool.execute({ ...base, until }).catch((e) => e);
    const inverted = await refuse({ month: 2, year: 2027 });
    const tooWide = await refuse({ month: 3, year: 2028 });

    expect(inverted.code).toBe(API_ERROR_CODES.VALIDATION_FAILED);
    expect(inverted.message).toStartWith(
      'until (2/2027) précède le mois de départ (3/2027)',
    );
    expect(tooWide.code).toBe(API_ERROR_CODES.VALIDATION_FAILED);
    expect(tooWide.message).toContain('11 mois plus tard (12 mois au plus');
    expect(execute).not.toHaveBeenCalled();
  });

  it('accepts an until exactly 12 months wide', async () => {
    const { tool, execute } = setup();

    await tool.execute({ ...base, until: { month: 2, year: 2028 } });

    expect(execute.mock.calls[0][0]).toMatchObject({ count: 12 });
  });

  it('turns an ambiguity into a question that names every candidate', async () => {
    const { tool } = setup({
      status: 'ambiguous',
      months: [
        {
          period: { month: 4, year: 2027 },
          candidates: [
            { id: ID, name: 'Loyer', amount: 1600.4 },
            { id: OTHER, name: 'Loyer', amount: 20 },
          ],
        },
      ],
    });

    const result = await tool.execute({ ...base, months: 2 });

    asksUser(result);
    expect(result.text).toContain('4/2027');
    expect(result.text).toContain(`[${ID}] Loyer · 1600.4`);
    expect(result.text).toContain(`[${OTHER}] Loyer · 20`);
    expect(result.text).toContain('un seul par mois');
    expect(result.text).toContain('chosenIds');
  });

  it('renders adjusted, missing, unmatched and refused months', async () => {
    const { tool } = setup(
      done({
        updated: [
          { month: 3, year: 2027 },
          { month: 4, year: 2027 },
        ],
        missingMonths: [{ month: 5, year: 2027 }],
        unmatched: [{ month: 6, year: 2027 }],
        alreadyNamed: [{ month: 8, year: 2027 }],
        failed: [{ period: { month: 7, year: 2027 }, reason: 'locked' }],
      }),
    );

    const result = await tool.execute({ ...base, months: 6 });

    expect(result.wrote).toBeUndefined();
    expect(result.text).toContain('Ajusté sur 2 mois : 3/2027, 4/2027.');
    expect(result.text).toContain('Mois sans budget, non créés : 5/2027.');
    expect(result.text).toContain('Mois sans équivalent : 6/2027.');
    expect(result.text).toContain('Mois refusés : 7/2027 (locked).');
    expect(result.text).toContain(
      'Mois où un élément porte déjà le nouvel intitulé, laissés tels quels : 8/2027.',
    );
    expect(result.text).toContain('ajustées à la main');
  });

  it('words the manual-adjustment note for a single forecast', async () => {
    const { tool } = setup();

    const result = await tool.execute({ ...base, months: 1 });

    expect(result.text).toContain('Cette prévision est désormais ajustée');
  });

  it('keeps the manual-adjustment note for forecasts only', async () => {
    const { tool } = setup();

    const result = await tool.execute({
      ...base,
      target: 'movement',
      months: 1,
    });

    expect(result.text).not.toContain('ajustées à la main');
  });

  it('keeps a call that adjusted nothing out of the activity log', async () => {
    const { tool } = setup(
      done({ updated: [], missingMonths: [{ month: 3, year: 2027 }] }),
    );

    const result = await tool.execute({ ...base, months: 1 });

    expect(result.wrote).toBe(false);
    expect(result.text).toContain('Aucun mois ajusté.');
  });
});
