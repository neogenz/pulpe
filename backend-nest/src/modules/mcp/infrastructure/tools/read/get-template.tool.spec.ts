import { describe, expect, it } from 'bun:test';
import type {
  BudgetTemplateReadPort,
  TemplateDetails,
} from '@modules/budget-template/domain/ports/budget-template-read.port';
import type { TagReadPort } from '@modules/tag/domain/ports/tag-read.port';
import type { Tag } from '@modules/tag/domain/tag.entity';
import { GetTemplateTool } from './get-template.tool';

const TEMPLATE_ID = '11111111-1111-4111-8111-111111111111';
const TAG_ID = '22222222-2222-4222-8222-222222222222';

const details = (overrides: Partial<TemplateDetails> = {}): TemplateDetails =>
  ({
    template: {
      id: TEMPLATE_ID,
      name: 'Mois standard',
      description: null,
      isDefault: true,
    },
    lines: [
      {
        id: 'line-1',
        kind: 'expense',
        name: 'Loyer',
        amount: 1500.004,
        recurrence: 'fixed',
        tagIds: [TAG_ID],
      },
      {
        id: 'line-2',
        kind: 'saving',
        name: 'Voyage',
        amount: 200,
        recurrence: 'one_off',
        tagIds: [],
      },
    ],
    months: [],
    ...overrides,
  }) as TemplateDetails;

const toolFor = (value: TemplateDetails) =>
  new GetTemplateTool(
    {
      list: async () => [],
      get: async () => value,
    } satisfies BudgetTemplateReadPort,
    {
      list: async () => [{ id: TAG_ID, name: 'Logement' }] as Tag[],
    } satisfies TagReadPort,
  );

describe('GetTemplateTool', () => {
  it('should list one line per forecast with id, nature, amount, frequency and tag names', async () => {
    const { text } = await toolFor(details()).execute({
      templateId: TEMPLATE_ID,
    });

    expect(text).toContain(
      `Modèle « Mois standard » (id ${TEMPLATE_ID}) · par défaut`,
    );
    expect(text).toContain('Prévisions (2)');
    expect(text).toContain(
      '- [line-1] Dépense · Loyer · 1500 · Mensuel · Tags : Logement',
    );
    expect(text).toContain('- [line-2] Épargne · Voyage · 200 · Ponctuel');
    expect(text).not.toContain('Voyage · 200 · Ponctuel ·');
  });

  it('should list the months built from the template', async () => {
    const { text } = await toolFor(
      details({
        months: [
          { id: 'b1', month: 11, year: 2026, description: '' },
          { id: 'b2', month: 10, year: 2026, description: '' },
        ],
      }),
    ).execute({ templateId: TEMPLATE_ID });

    expect(text).toContain(
      'Mois créés depuis ce modèle (2) : 11/2026, 10/2026',
    );
  });

  it('should say when no month was built from the template', async () => {
    const { text } = await toolFor(details()).execute({
      templateId: TEMPLATE_ID,
    });

    expect(text).toContain('Aucun mois créé depuis ce modèle.');
  });

  it('should be a read tool, hence listed for read-only connections', () => {
    const tool = toolFor(details());

    expect(tool.name).toBe('get_template');
    expect(tool.mode).toBe('read');
    expect(tool.annotations).toEqual({
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    });
  });
});
