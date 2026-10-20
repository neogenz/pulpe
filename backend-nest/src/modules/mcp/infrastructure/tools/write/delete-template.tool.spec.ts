import { describe, expect, it, mock } from 'bun:test';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { BusinessException } from '@common/exceptions/business.exception';
import type { BudgetTemplateWritePort } from '@modules/budget-template/domain/ports/budget-template-write.port';
import { DeleteTemplateTool } from './delete-template.tool';

const ID = '11111111-1111-4111-8111-111111111111';

function setup(remove: BudgetTemplateWritePort['remove']) {
  const port = {
    create: mock(async () => ({})),
    update: mock(async () => ({})),
    remove: mock(remove),
    duplicate: mock(async () => ({})),
    editLines: mock(async () => ({})),
  } as unknown as BudgetTemplateWritePort & { remove: ReturnType<typeof mock> };
  return { port, tool: new DeleteTemplateTool(port) };
}

describe('DeleteTemplateTool', () => {
  it('should delete the template and confirm it', async () => {
    const { port, tool } = setup(async () => {});

    const result = await tool.execute({ templateId: ID });

    expect(port.remove).toHaveBeenCalledWith(ID);
    expect(result.text).toBe(`Modèle supprimé (id ${ID}).`);
  });

  it('should propagate a refusal listing the months, never a success text', async () => {
    const { tool } = setup(async () => {
      throw new BusinessException(ERROR_DEFINITIONS.TEMPLATE_IN_USE, {
        id: ID,
        months: '10/2026, 11/2026',
      });
    });

    const failure = await tool.execute({ templateId: ID }).catch((e) => e);

    expect(failure).toBeInstanceOf(BusinessException);
    expect(failure.message).toContain('10/2026, 11/2026');
  });

  it('should be a destructive, idempotent write tool', () => {
    const { tool } = setup(async () => {});

    expect(tool.name).toBe('delete_template');
    expect(tool.mode).toBe('read_write');
    expect(tool.annotations).toEqual({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    });
  });
});
