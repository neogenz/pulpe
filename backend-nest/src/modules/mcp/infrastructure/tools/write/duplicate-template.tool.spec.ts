import { describe, expect, it, mock } from 'bun:test';
import type { BudgetTemplateWritePort } from '@modules/budget-template/domain/ports/budget-template-write.port';
import { DuplicateTemplateTool } from './duplicate-template.tool';

const ID = '11111111-1111-4111-8111-111111111111';

function setup() {
  const port = {
    create: mock(async () => ({})),
    update: mock(async () => ({})),
    remove: mock(async () => {}),
    duplicate: mock(async () => ({
      template: { id: 'copy-1', name: 'Mois été' },
      lines: [{ id: 'l1' }, { id: 'l2' }, { id: 'l3' }],
    })),
    editLines: mock(async () => ({})),
  } as unknown as BudgetTemplateWritePort & {
    duplicate: ReturnType<typeof mock>;
  };
  return { port, tool: new DuplicateTemplateTool(port) };
}

describe('DuplicateTemplateTool', () => {
  it('should forward the source id and the new name, and report the copy', async () => {
    const { port, tool } = setup();

    const result = await tool.execute({ templateId: ID, name: 'Mois été' });

    expect(port.duplicate).toHaveBeenCalledWith(ID, 'Mois été');
    expect(result.text).toContain('id copy-1');
    expect(result.text).toContain('3 prévisions copiées');
  });

  it('should be a non-destructive, non-idempotent write tool', () => {
    const { tool } = setup();

    expect(tool.name).toBe('duplicate_template');
    expect(tool.mode).toBe('read_write');
    expect(tool.annotations).toEqual({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    });
  });
});
