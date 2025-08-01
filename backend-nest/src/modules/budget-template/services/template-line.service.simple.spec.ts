import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { TemplateLineService } from './template-line.service';
import { TemplateValidationService } from './template-validation.service';
import { BudgetTemplateMapper } from '../budget-template.mapper';
import { createMockSupabaseClient } from '@/test/test-utils';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { Tables } from '@/types/database.types';

describe('TemplateLineService - Basic Tests', () => {
  let service: TemplateLineService;
  let mockSupabase: any;
  let mockUser: AuthenticatedUser;
  let mockValidationService: Partial<TemplateValidationService>;
  let mockMapper: BudgetTemplateMapper;

  const mockLogger = {
    error: mock(() => {}),
    warn: mock(() => {}),
    info: mock(() => {}),
    debug: mock(() => {}),
  };

  const mockTemplate: Tables<'template'> = {
    id: 'template-123',
    user_id: 'user-123',
    name: 'Test Template',
    is_default: false,
    description: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockTemplateLine: Tables<'template_line'> = {
    id: 'line-123',
    template_id: 'template-123',
    name: 'Test Line',
    amount: 1000,
    kind: 'FIXED_EXPENSE',
    recurrence: 'fixed',
    description: 'Test description',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    const { mockClient } = createMockSupabaseClient();
    mockSupabase = mockClient;
    mockUser = { id: 'user-123', email: 'test@example.com' };
    mockMapper = new BudgetTemplateMapper();

    mockValidationService = {
      validateTemplateAccess: mock(() => Promise.resolve(mockTemplate)),
      validateTemplateLineAccess: mock(() =>
        Promise.resolve({
          templateLine: mockTemplateLine,
          template: mockTemplate,
        }),
      ),
      validateTemplateLinesAccessBatch: mock(() => Promise.resolve()),
    };

    service = new TemplateLineService(
      mockLogger as any,
      mockMapper,
      mockValidationService as any,
    );
  });

  describe('service setup', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('findTemplateLines', () => {
    it('should return template lines for a template', async () => {
      mockSupabase.setMockData([mockTemplateLine]).setMockError(null);

      const result = await service.findTemplateLines(
        'template-123',
        mockUser,
        mockSupabase as any,
      );

      expect(result.data).toHaveLength(1);
      expect(mockValidationService.validateTemplateAccess).toHaveBeenCalledWith(
        'template-123',
        mockUser,
        mockSupabase,
      );
    });

    it('should handle empty template lines', async () => {
      mockSupabase.setMockData([]).setMockError(null);

      const result = await service.findTemplateLines(
        'template-123',
        mockUser,
        mockSupabase as any,
      );

      expect(result.data).toHaveLength(0);
    });
  });

  describe('createTemplateLine', () => {
    it('should create a new template line', async () => {
      mockSupabase.setMockData(mockTemplateLine).setMockError(null);

      const createDto = {
        name: 'Test Line',
        amount: 1000,
        kind: 'FIXED_EXPENSE' as const,
        recurrence: 'fixed' as const,
        description: 'Test description',
      };

      const result = await service.createTemplateLine(
        'template-123',
        createDto,
        mockUser,
        mockSupabase as any,
      );

      expect(result.data.name).toBe('Test Line');
      expect(mockValidationService.validateTemplateAccess).toHaveBeenCalled();
    });
  });

  describe('deleteTemplateLine', () => {
    it('should delete a template line', async () => {
      mockSupabase.setMockError(null);

      const result = await service.deleteTemplateLine(
        'line-123',
        mockUser,
        mockSupabase as any,
      );

      expect(result).toEqual({
        success: true,
        message: 'Template line deleted successfully',
      });
      expect(
        mockValidationService.validateTemplateLineAccess,
      ).toHaveBeenCalledWith('line-123', mockUser, mockSupabase);
    });
  });

  describe('fetchAndMapTemplateLines', () => {
    it('should fetch and map template lines', async () => {
      mockSupabase.setMockData([mockTemplateLine]).setMockError(null);

      const result = await service.fetchAndMapTemplateLines(
        'template-123',
        mockSupabase as any,
      );

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Test Line');
    });
  });
});
