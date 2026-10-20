import { describe, expect, it, mock } from 'bun:test';
import type { BudgetLineUpdate } from 'pulpe-shared';
import type { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import type { FindBudgetLineUseCase } from './find-budget-line.use-case';
import type { CreateBudgetLineUseCase } from './create-budget-line.use-case';
import type { SpreadBudgetLineFromLineUseCase } from './spread-budget-line-from-line.use-case';
import type { ToggleBudgetLineCheckUseCase } from './toggle-budget-line-check.use-case';
import type { UpdateBudgetLineUseCase } from './update-budget-line.use-case';
import { WriteBudgetLinesInProcessUseCase } from './write-budget-lines-in-process.use-case';

const ID = '11111111-1111-4111-8111-111111111111';
const user = { id: 'user-1' };

function setup() {
  const execute = mock(async () => ({ id: ID }));
  const find = mock(async () => ({ id: ID, tagIds: [ID] }));
  const port = new WriteBudgetLinesInProcessUseCase(
    { execute: find } as unknown as FindBudgetLineUseCase,
    {} as CreateBudgetLineUseCase,
    { execute } as unknown as UpdateBudgetLineUseCase,
    {} as ToggleBudgetLineCheckUseCase,
    {} as SpreadBudgetLineFromLineUseCase,
    { user } as unknown as AuthenticatedSupabaseProvider,
  );
  const patchOf = () =>
    (execute.mock.calls[0] as unknown as [string, BudgetLineUpdate])[1];
  return { port, patchOf, find };
}

describe('WriteBudgetLinesInProcessUseCase.update', () => {
  it('marks a renamed forecast as manually adjusted', async () => {
    const { port, patchOf } = setup();
    await port.update(ID, { id: ID, name: 'Loyer' });
    expect(patchOf().isManuallyAdjusted).toBe(true);
  });

  it('overrides an explicit false: an agent edit is always a manual adjustment', async () => {
    const { port, patchOf } = setup();
    await port.update(ID, { id: ID, amount: 10, isManuallyAdjusted: false });
    expect(patchOf().isManuallyAdjusted).toBe(true);
  });

  it('leaves a tags-only patch untouched, so tagging never freezes a forecast', async () => {
    const { port, patchOf } = setup();
    await port.update(ID, { id: ID, tagIds: [ID] });
    expect(patchOf()).not.toHaveProperty('isManuallyAdjusted');
  });
});

describe('WriteBudgetLinesInProcessUseCase.find', () => {
  it('reads the forecast, with its tag ids, as the session user', async () => {
    const { port, find } = setup();
    await expect(port.find(ID)).resolves.toEqual({ id: ID, tagIds: [ID] });
    expect(find).toHaveBeenCalledWith(ID, user);
  });
});
