import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TemplateValidationService } from './template-validation.service';
import { createMockSupabaseClient } from '@/test/test-utils';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { Tables } from '@/types/database.types';

describe('TemplateValidationService', () => {
  let service: TemplateValidationService;
  let mockSupabase: any;
  let mockUser: AuthenticatedUser;
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
    service = new TemplateValidationService(mockLogger as any);
  });

  describe('validateTemplateAccess', () => {
    it('should return template when user has access', async () => {
      mockSupabase.setMockData(mockTemplate).setMockError(null);

      const result = await service.validateTemplateAccess(
        'template-123',
        mockUser,
        mockSupabase as any,
      );

      expect(result).toEqual(mockTemplate);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'validateTemplateAccess',
          templateId: 'template-123',
          userId: 'user-123',
          message: 'Template access validated successfully',
        }),
      );
    });

    it('should throw NotFoundException when template not found', async () => {
      mockSupabase.setMockData(null).setMockError({ message: 'Not found' });

      await expect(
        service.validateTemplateAccess(
          'template-123',
          mockUser,
          mockSupabase as any,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'validateTemplateAccess',
          message: 'Template not found',
        }),
      );
    });

    it('should throw ForbiddenException when user does not own template', async () => {
      const otherUserTemplate = { ...mockTemplate, user_id: 'other-user' };
      mockSupabase.setMockData(otherUserTemplate).setMockError(null);

      await expect(
        service.validateTemplateAccess(
          'template-123',
          mockUser,
          mockSupabase as any,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'validateTemplateAccess',
          message: 'Unauthorized template access attempt',
        }),
      );
    });
  });

  describe('validateTemplateLineAccess', () => {
    it('should return template line and template when user has access', async () => {
      const lineWithTemplate = {
        ...mockTemplateLine,
        template: mockTemplate,
      };

      mockSupabase.setMockData(lineWithTemplate).setMockError(null);

      const result = await service.validateTemplateLineAccess(
        'line-123',
        mockUser,
        mockSupabase as any,
      );

      expect(result.templateLine).toEqual(lineWithTemplate);
      expect(result.template).toEqual(mockTemplate);
    });

    it('should throw NotFoundException when template line not found', async () => {
      mockSupabase.setMockData(null).setMockError({ message: 'Not found' });

      await expect(
        service.validateTemplateLineAccess(
          'line-123',
          mockUser,
          mockSupabase as any,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user does not own template', async () => {
      const lineWithOtherTemplate = {
        ...mockTemplateLine,
        template: { ...mockTemplate, user_id: 'other-user' },
      };

      mockSupabase.setMockData(lineWithOtherTemplate).setMockError(null);

      await expect(
        service.validateTemplateLineAccess(
          'line-123',
          mockUser,
          mockSupabase as any,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('validateTemplateLinesAccessBatch', () => {
    it('should validate when all lines belong to template', async () => {
      // Mock validateTemplateAccess
      service.validateTemplateAccess = mock(() =>
        Promise.resolve(mockTemplate),
      );

      const lines = [
        { id: 'line-1', template_id: 'template-123' },
        { id: 'line-2', template_id: 'template-123' },
      ];

      mockSupabase.setMockData(lines).setMockError(null);

      await expect(
        service.validateTemplateLinesAccessBatch(
          ['line-1', 'line-2'],
          'template-123',
          mockUser,
          mockSupabase as any,
        ),
      ).resolves.toBeUndefined();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'validateTemplateLinesAccessBatch',
          message: 'Batch template lines access validated successfully',
        }),
      );
    });

    it('should throw NotFoundException when some lines not found', async () => {
      service.validateTemplateAccess = mock(() =>
        Promise.resolve(mockTemplate),
      );

      const lines = [{ id: 'line-1', template_id: 'template-123' }];

      mockSupabase.setMockData(lines).setMockError(null);

      await expect(
        service.validateTemplateLinesAccessBatch(
          ['line-1', 'line-2'],
          'template-123',
          mockUser,
          mockSupabase as any,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when lines belong to different template', async () => {
      service.validateTemplateAccess = mock(() =>
        Promise.resolve(mockTemplate),
      );

      const lines = [
        { id: 'line-1', template_id: 'template-123' },
        { id: 'line-2', template_id: 'other-template' },
      ];

      mockSupabase.setMockData(lines).setMockError(null);

      await expect(
        service.validateTemplateLinesAccessBatch(
          ['line-1', 'line-2'],
          'template-123',
          mockUser,
          mockSupabase as any,
        ),
      ).rejects.toThrow(
        new Error('All template lines must belong to the same template'),
      );
    });
  });

  describe('checkOnboardingRateLimit', () => {
    it('should pass when no recent onboarding templates', async () => {
      mockSupabase.setMockData([]).setMockError(null);

      await expect(
        service.checkOnboardingRateLimit('user-123', mockSupabase as any),
      ).resolves.toBeUndefined();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'checkOnboardingRateLimit',
          message: 'Onboarding rate limit check passed',
        }),
      );
    });

    it('should throw BadRequestException when rate limit exceeded', async () => {
      const recentTemplate = {
        id: 'template-recent',
        created_at: new Date().toISOString(),
      };

      mockSupabase.setMockData([recentTemplate]).setMockError(null);

      await expect(
        service.checkOnboardingRateLimit('user-123', mockSupabase as any),
      ).rejects.toThrow(
        new Error(
          'You can only create one template from onboarding per 24 hours',
        ),
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'checkOnboardingRateLimit',
          message: 'User exceeded onboarding template creation rate limit',
        }),
      );
    });
  });
});
