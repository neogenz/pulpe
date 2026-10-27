import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import type { TemplateLinesBulkOperations } from 'pulpe-shared';
import type { CreateTemplateUseCase } from './create-template.use-case';
import type { UpdateTemplateUseCase } from './update-template.use-case';
import type { RemoveTemplateUseCase } from './remove-template.use-case';
import type { DuplicateTemplateUseCase } from './duplicate-template.use-case';
import type { BulkTemplateLineOperationsUseCase } from './bulk-template-line-operations.use-case';
import { WriteTemplatesInProcessUseCase } from './write-templates-in-process.use-case';

const user = { id: 'user-1', payDayOfMonth: 5 };
const session = { user } as unknown as AuthenticatedSupabaseProvider;

describe('WriteTemplatesInProcessUseCase', () => {
  let createTemplate: { execute: ReturnType<typeof mock> };
  let updateTemplate: { execute: ReturnType<typeof mock> };
  let removeTemplate: { execute: ReturnType<typeof mock> };
  let duplicateTemplate: { execute: ReturnType<typeof mock> };
  let bulkLineOperations: { execute: ReturnType<typeof mock> };
  let port: WriteTemplatesInProcessUseCase;

  beforeEach(() => {
    createTemplate = { execute: mock(async () => ({ id: 'created' })) };
    updateTemplate = { execute: mock(async () => ({ id: 'updated' })) };
    removeTemplate = { execute: mock(async () => ({ success: true })) };
    duplicateTemplate = { execute: mock(async () => ({ id: 'copy' })) };
    bulkLineOperations = { execute: mock(async () => ({ deletedIds: [] })) };
    port = new WriteTemplatesInProcessUseCase(
      createTemplate as unknown as CreateTemplateUseCase,
      updateTemplate as unknown as UpdateTemplateUseCase,
      removeTemplate as unknown as RemoveTemplateUseCase,
      duplicateTemplate as unknown as DuplicateTemplateUseCase,
      bulkLineOperations as unknown as BulkTemplateLineOperationsUseCase,
      session,
    );
  });

  it('should forward create, update and remove with the session user', async () => {
    const dto = { name: 'Mois été', isDefault: false, lines: [] };
    await port.create(dto);
    await port.update('template-1', { name: 'Mois hiver' });
    await expect(port.remove('template-1')).resolves.toBeUndefined();

    expect(createTemplate.execute).toHaveBeenCalledWith(dto, user);
    expect(updateTemplate.execute).toHaveBeenCalledWith(
      'template-1',
      { name: 'Mois hiver' },
      user,
    );
    expect(removeTemplate.execute).toHaveBeenCalledWith('template-1', user);
  });

  it('should forward the source id and the new name on duplicate', async () => {
    await port.duplicate('template-1', 'Mois été');

    expect(duplicateTemplate.execute).toHaveBeenCalledWith(
      'template-1',
      'Mois été',
      user,
    );
  });

  it('should forward operations, range and session user (with its pay day) on editLines', async () => {
    const ops: TemplateLinesBulkOperations = {
      create: [],
      update: [],
      delete: ['line-1'],
      propagateToBudgets: true,
    };
    const range = {
      from: { month: 11, year: 2026 },
      to: { month: 12, year: 2026 },
    };

    await port.editLines('template-1', ops, range);

    expect(bulkLineOperations.execute).toHaveBeenCalledWith(
      'template-1',
      ops,
      user,
      range,
    );
  });
});
