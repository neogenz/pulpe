import { describe, it, expect, mock } from 'bun:test';
import type { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import type {
  BudgetTemplate,
  TemplateLine,
} from '../domain/budget-template.entity';
import type { FindAllTemplatesUseCase } from './find-all-templates.use-case';
import type { FindTemplateUseCase } from './find-template.use-case';
import type { FindTemplateLinesUseCase } from './find-template-lines.use-case';
import type { CheckTemplateUsageUseCase } from './check-template-usage.use-case';
import { ReadTemplatesInProcessUseCase } from './read-templates-in-process.use-case';

const user = { id: 'user-1' };
const session = { user } as unknown as AuthenticatedSupabaseProvider;
const template = { id: 'template-1', name: 'Mois standard' } as BudgetTemplate;
const lines = [{ id: 'line-1', tagIds: ['tag-1'] }] as TemplateLine[];
const budgets = [{ id: 'budget-1', month: 10, year: 2026, description: '' }];

describe('ReadTemplatesInProcessUseCase', () => {
  const findAll = { execute: mock(async () => []) };
  const findTemplate = { execute: mock(async () => template) };
  const findLines = { execute: mock(async () => lines) };
  const checkUsage = {
    execute: mock(async () => ({
      isUsed: true,
      budgetCount: 1,
      budgets,
    })),
  };
  const port = new ReadTemplatesInProcessUseCase(
    findAll as unknown as FindAllTemplatesUseCase,
    findTemplate as unknown as FindTemplateUseCase,
    findLines as unknown as FindTemplateLinesUseCase,
    checkUsage as unknown as CheckTemplateUsageUseCase,
    session,
  );

  it('should return the template, its lines and the months built from it', async () => {
    await expect(port.get('template-1')).resolves.toEqual({
      template,
      lines,
      months: budgets,
    });

    expect(findTemplate.execute).toHaveBeenCalledWith('template-1', user);
    expect(findLines.execute).toHaveBeenCalledWith('template-1', user);
    expect(checkUsage.execute).toHaveBeenCalledWith('template-1', user);
  });

  it('should reject when the template is unknown or foreign', async () => {
    findTemplate.execute.mockRejectedValueOnce(new Error('TEMPLATE_NOT_FOUND'));

    await expect(port.get('nope')).rejects.toThrow('TEMPLATE_NOT_FOUND');
  });
});
