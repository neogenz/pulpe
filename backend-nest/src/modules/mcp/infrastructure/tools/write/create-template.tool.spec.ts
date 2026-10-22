import { describe, expect, it, mock } from 'bun:test';
import type { BudgetTemplateWritePort } from '@modules/budget-template/domain/ports/budget-template-write.port';
import { CreateTemplateTool } from './create-template.tool';

function setup() {
  const port = {
    create: mock(async () => ({
      template: { id: 'template-9', name: 'Mois vide' },
      lines: [],
    })),
    update: mock(async () => ({})),
    remove: mock(async () => {}),
    duplicate: mock(async () => ({})),
    editLines: mock(async () => ({})),
  } as unknown as BudgetTemplateWritePort & { create: ReturnType<typeof mock> };
  return { port, tool: new CreateTemplateTool(port) };
}

describe('CreateTemplateTool', () => {
  it('should create an empty, non-default template when isDefault is omitted', async () => {
    const { port, tool } = setup();

    const result = await tool.execute({ name: 'Mois vide' });

    expect(port.create).toHaveBeenCalledWith({
      name: 'Mois vide',
      description: undefined,
      isDefault: false,
      lines: [],
    });
    expect(result.text).toContain('id template-9');
    expect(result.text).toContain('edit_template_lines');
  });

  it('should make the template the default only when asked', async () => {
    const { port, tool } = setup();

    await tool.execute({
      name: 'Mois vide',
      description: 'x',
      isDefault: true,
    });

    expect(port.create).toHaveBeenCalledWith({
      name: 'Mois vide',
      description: 'x',
      isDefault: true,
      lines: [],
    });
  });

  it('should be a destructive write tool, since isDefault unsets the current default', () => {
    const { tool } = setup();

    expect(tool.name).toBe('create_template');
    expect(tool.mode).toBe('read_write');
    expect(tool.annotations).toEqual({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false,
    });
  });
});
