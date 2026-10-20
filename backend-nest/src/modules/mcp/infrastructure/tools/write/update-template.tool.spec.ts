import { describe, expect, it, mock } from 'bun:test';
import type { BudgetTemplateWritePort } from '@modules/budget-template/domain/ports/budget-template-write.port';
import { UpdateTemplateTool } from './update-template.tool';

const ID = '11111111-1111-4111-8111-111111111111';

function setup() {
  const port = {
    create: mock(async () => ({})),
    update: mock(async () => ({
      id: ID,
      name: 'Mois hiver',
      isDefault: true,
    })),
    remove: mock(async () => {}),
    duplicate: mock(async () => ({})),
    editLines: mock(async () => ({})),
  } as unknown as BudgetTemplateWritePort & { update: ReturnType<typeof mock> };
  return { port, tool: new UpdateTemplateTool(port) };
}

describe('UpdateTemplateTool', () => {
  it('should ask what changes and write nothing when no field is given', async () => {
    const { port, tool } = setup();

    const result = await tool.execute({ templateId: ID });

    expect(result.text.startsWith('Information manquante')).toBe(true);
    expect(result.wrote).toBe(false);
    expect(port.update).not.toHaveBeenCalled();
  });

  it('should forward the given fields unchanged', async () => {
    const { port, tool } = setup();

    const result = await tool.execute({
      templateId: ID,
      name: 'Mois hiver',
      isDefault: true,
    });

    expect(port.update).toHaveBeenCalledWith(ID, {
      name: 'Mois hiver',
      description: undefined,
      isDefault: true,
    });
    expect(result.text).toBe(
      `Modèle modifié (id ${ID}) : Mois hiver · par défaut.`,
    );
  });

  it('should count an emptied description as a change', async () => {
    const { port, tool } = setup();

    await tool.execute({ templateId: ID, description: '' });

    expect(port.update).toHaveBeenCalledTimes(1);
  });

  it('should be a destructive, idempotent write tool', () => {
    expect(setup().tool.annotations).toEqual({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    });
  });
});
