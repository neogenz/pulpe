import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { BudgetTemplateService } from './budget-template.service';
import { BudgetTemplateMapper } from './budget-template.mapper';
import { TemplateValidationService } from './services/template-validation.service';
import { TemplateLineService } from './services/template-line.service';
import { createMockSupabaseClient } from '@/test/test-utils';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';

describe('BudgetTemplateService - Basic Tests', () => {
  let service: BudgetTemplateService;
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;
  let mockUser: AuthenticatedUser;
  let mockValidationService: Partial<TemplateValidationService>;
  let mockLineService: Partial<TemplateLineService>;
  let mockMapper: BudgetTemplateMapper;

  const mockLogger = {
    error: mock(() => {}),
    warn: mock(() => {}),
    info: mock(() => {}),
    debug: mock(() => {}),
  };

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    mockUser = { id: 'user-123', email: 'test@example.com' };
    mockMapper = new BudgetTemplateMapper();

    // Mock validation service
    mockValidationService = {
      validateTemplateAccess: mock(() =>
        Promise.resolve({
          id: 'template-123',
          user_id: 'user-123',
          name: 'Test Template',
          is_default: false,
          description: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      ),
      checkOnboardingRateLimit: mock(() => Promise.resolve()),
    };

    // Mock line service
    mockLineService = {
      findTemplateLines: mock(() =>
        Promise.resolve({
          success: true as const,
          data: [],
        }),
      ),
      createTemplateLine: mock(() =>
        Promise.resolve({
          success: true as const,
          data: {
            id: 'line-123',
            templateId: 'template-123',
            name: 'Test Line',
            amount: 100,
            kind: 'FIXED_EXPENSE' as const,
            recurrence: 'fixed' as const,
            description: 'Test description',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),
      ),
      updateTemplateLine: mock(() =>
        Promise.resolve({
          success: true as const,
          data: {
            id: 'line-123',
            templateId: 'template-123',
            name: 'Updated Line',
            amount: 200,
            kind: 'FIXED_EXPENSE' as const,
            recurrence: 'fixed' as const,
            description: 'Updated description',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),
      ),
      deleteTemplateLine: mock(() =>
        Promise.resolve({
          success: true as const,
          message: 'Template line deleted successfully',
        }),
      ),
      bulkUpdateTemplateLines: mock(() =>
        Promise.resolve({
          success: true as const,
          data: [],
        }),
      ),
      fetchAndMapTemplateLines: mock(() => Promise.resolve([])),
    };

    service = new BudgetTemplateService(
      mockLogger as any,
      mockMapper,
      mockValidationService as any,
      mockLineService as any,
    );
  });

  describe('service setup', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('template line operations', () => {
    it('should delegate findTemplateLines to TemplateLineService', async () => {
      const result = await service.findTemplateLines(
        'template-123',
        mockUser,
        mockSupabase.client as any,
      );

      expect(result.success).toBe(true);
      expect(mockLineService.findTemplateLines).toHaveBeenCalledWith(
        'template-123',
        mockUser,
        mockSupabase.client,
      );
    });

    it('should delegate createTemplateLine to TemplateLineService', async () => {
      const createDto = {
        name: 'Test Line',
        amount: 100,
        kind: 'FIXED_EXPENSE' as const,
        recurrence: 'fixed' as const,
        description: 'Test description',
      };

      const result = await service.createTemplateLine(
        'template-123',
        createDto,
        mockUser,
        mockSupabase.client as any,
      );

      expect(result.success).toBe(true);
      expect(mockLineService.createTemplateLine).toHaveBeenCalledWith(
        'template-123',
        createDto,
        mockUser,
        mockSupabase.client,
      );
    });

    it('should delegate updateTemplateLine to TemplateLineService', async () => {
      const updateDto = { name: 'Updated Line' };

      const result = await service.updateTemplateLine(
        'template-123',
        'line-123',
        updateDto,
        mockUser,
        mockSupabase.client as any,
      );

      expect(result.success).toBe(true);
      expect(mockLineService.updateTemplateLine).toHaveBeenCalledWith(
        'line-123',
        updateDto,
        mockUser,
        mockSupabase.client,
      );
    });

    it('should delegate deleteTemplateLine to TemplateLineService', async () => {
      const result = await service.deleteTemplateLine(
        'template-123',
        'line-123',
        mockUser,
        mockSupabase.client as any,
      );

      expect(result.success).toBe(true);
      expect(mockLineService.deleteTemplateLine).toHaveBeenCalledWith(
        'line-123',
        mockUser,
        mockSupabase.client,
      );
    });

    it('should transform and delegate bulkUpdateTemplateLines', async () => {
      const bulkUpdateDto = {
        lines: [
          { id: 'line-1', name: 'Updated 1', amount: 100 },
          { id: 'line-2', name: 'Updated 2', amount: 200 },
        ],
      };

      await service.bulkUpdateTemplateLines(
        'template-123',
        bulkUpdateDto as any,
        mockUser,
        mockSupabase.client as any,
      );

      expect(mockLineService.bulkUpdateTemplateLines).toHaveBeenCalledWith(
        'template-123',
        bulkUpdateDto,
        mockUser,
        mockSupabase.client,
      );
    });
  });

  describe('template validation', () => {
    it('should use validation service for template access', async () => {
      mockSupabase.mockClient.setMockData({
        id: 'template-123',
        user_id: 'user-123',
        name: 'Test Template',
        is_from_onboarding: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      await service.findOne(
        'template-123',
        mockUser,
        mockSupabase.client as any,
      );

      expect(mockValidationService.validateTemplateAccess).toHaveBeenCalledWith(
        'template-123',
        mockUser,
        mockSupabase.client,
      );
    });
  });
});
