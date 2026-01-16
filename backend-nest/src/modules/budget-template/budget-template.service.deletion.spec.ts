import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { BusinessException } from '@common/exceptions/business.exception';
import { BudgetTemplateService } from './budget-template.service';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';

describe('BudgetTemplateService - Template Deletion', () => {
  let service: BudgetTemplateService;
  let mockSupabase: AuthenticatedSupabaseClient;
  let mockUser: AuthenticatedUser;

  beforeEach(() => {
    mockUser = { id: 'user-123', email: 'test@example.com' };
    const mockLogger = {
      info: mock(() => {}),
      error: mock(() => {}),
      warn: mock(() => {}),
      debug: mock(() => {}),
    };
    const mockBudgetService = {
      recalculateBalances: mock(() => Promise.resolve()),
    };
    service = new BudgetTemplateService(
      mockLogger as any,
      mockBudgetService as any,
    );
  });

  describe('remove', () => {
    const templateId = 'template-123';

    it('should delete template when no budgets are associated', async () => {
      const selectMock = mock(() => ({
        eq: mock(() => ({
          single: mock(() =>
            Promise.resolve({
              data: { user_id: mockUser.id },
              error: null,
            }),
          ),
        })),
      }));

      const budgetSelectMock = mock(() => ({
        eq: mock(() => ({
          limit: mock(() =>
            Promise.resolve({
              data: [],
              error: null,
            }),
          ),
        })),
      }));

      const deleteMock = mock(() => ({
        eq: mock(() =>
          Promise.resolve({
            error: null,
          }),
        ),
      }));

      let callCount = 0;
      mockSupabase = {
        from: mock((table: string) => {
          callCount++;
          if (table === 'template') {
            if (callCount === 1) {
              return { select: selectMock };
            }
            if (callCount === 3) {
              return { delete: deleteMock };
            }
          }
          if (table === 'monthly_budget') {
            return { select: budgetSelectMock };
          }
        }),
      } as any;

      const result = await service.remove(templateId, mockUser, mockSupabase);

      expect(result).toEqual({
        success: true,
        message: 'Template deleted successfully',
      });
      expect(mockSupabase.from).toHaveBeenCalledTimes(3);
    });

    it('should throw BadRequestException when template has associated budgets', async () => {
      const selectMock = mock(() => ({
        eq: mock(() => ({
          single: mock(() =>
            Promise.resolve({
              data: { user_id: mockUser.id },
              error: null,
            }),
          ),
        })),
      }));

      const budgetSelectMock = mock(() => ({
        eq: mock(() => ({
          limit: mock(() =>
            Promise.resolve({
              data: [{ id: 'budget-1' }],
              error: null,
            }),
          ),
        })),
      }));

      mockSupabase = {
        from: mock((table: string) => {
          if (table === 'template') {
            return { select: selectMock };
          }
          if (table === 'monthly_budget') {
            return { select: budgetSelectMock };
          }
        }),
      } as any;

      await expect(
        service.remove(templateId, mockUser, mockSupabase),
      ).rejects.toThrow(BusinessException);
    });

    it('should throw NotFoundException when template does not exist', async () => {
      const selectMock = mock(() => ({
        eq: mock(() => ({
          single: mock(() =>
            Promise.resolve({
              data: null,
              error: { message: 'Not found' },
            }),
          ),
        })),
      }));

      mockSupabase = {
        from: mock(() => ({ select: selectMock })),
      } as any;

      await expect(
        service.remove(templateId, mockUser, mockSupabase),
      ).rejects.toThrow(BusinessException);
    });

    it('should throw BusinessException when user does not own the template', async () => {
      const selectMock = mock(() => ({
        eq: mock(() => ({
          single: mock(() =>
            Promise.resolve({
              data: { user_id: 'other-user' },
              error: null,
            }),
          ),
        })),
      }));

      mockSupabase = {
        from: mock(() => ({ select: selectMock })),
      } as any;

      await expect(
        service.remove(templateId, mockUser, mockSupabase),
      ).rejects.toThrow(BusinessException);
    });
  });

  describe('checkTemplateUsage', () => {
    const templateId = 'template-123';

    it('should return empty budget list when template is not used', async () => {
      const templateSelectMock = mock(() => ({
        eq: mock(() => ({
          single: mock(() =>
            Promise.resolve({
              data: { user_id: mockUser.id },
              error: null,
            }),
          ),
        })),
      }));

      const budgetSelectMock = mock(() => ({
        eq: mock(() => ({
          order: mock(() => ({
            order: mock(() =>
              Promise.resolve({
                data: [],
                error: null,
              }),
            ),
          })),
        })),
      }));

      let callCount = 0;
      mockSupabase = {
        from: mock((table: string) => {
          callCount++;
          if (table === 'template' && callCount === 1) {
            return { select: templateSelectMock };
          }
          if (table === 'monthly_budget') {
            return { select: budgetSelectMock };
          }
        }),
      } as any;

      const result = await service.checkTemplateUsage(
        templateId,
        mockUser,
        mockSupabase,
      );

      expect(result).toEqual({
        success: true,
        data: {
          isUsed: false,
          budgetCount: 0,
          budgets: [],
        },
      });
    });

    it('should return list of budgets using the template', async () => {
      const mockBudgets = [
        { id: 'budget-1', month: 1, year: 2025, description: 'January Budget' },
        {
          id: 'budget-2',
          month: 2,
          year: 2025,
          description: 'February Budget',
        },
        { id: 'budget-3', month: 3, year: 2025, description: 'March Budget' },
      ];

      const templateSelectMock = mock(() => ({
        eq: mock(() => ({
          single: mock(() =>
            Promise.resolve({
              data: { user_id: mockUser.id },
              error: null,
            }),
          ),
        })),
      }));

      const budgetSelectMock = mock(() => ({
        eq: mock(() => ({
          order: mock(() => ({
            order: mock(() =>
              Promise.resolve({
                data: mockBudgets,
                error: null,
              }),
            ),
          })),
        })),
      }));

      let callCount = 0;
      mockSupabase = {
        from: mock((table: string) => {
          callCount++;
          if (table === 'template' && callCount === 1) {
            return { select: templateSelectMock };
          }
          if (table === 'monthly_budget') {
            return { select: budgetSelectMock };
          }
        }),
      } as any;

      const result = await service.checkTemplateUsage(
        templateId,
        mockUser,
        mockSupabase,
      );

      expect(result).toEqual({
        success: true,
        data: {
          isUsed: true,
          budgetCount: 3,
          budgets: mockBudgets,
        },
      });
    });

    it('should throw BusinessException when user does not own the template', async () => {
      const selectMock = mock(() => ({
        eq: mock(() => ({
          single: mock(() =>
            Promise.resolve({
              data: { user_id: 'other-user' },
              error: null,
            }),
          ),
        })),
      }));

      mockSupabase = {
        from: mock(() => ({ select: selectMock })),
      } as any;

      await expect(
        service.checkTemplateUsage(templateId, mockUser, mockSupabase),
      ).rejects.toThrow(BusinessException);
    });

    it('should throw BusinessException when template does not exist', async () => {
      const selectMock = mock(() => ({
        eq: mock(() => ({
          single: mock(() =>
            Promise.resolve({
              data: null,
              error: { message: 'Not found' },
            }),
          ),
        })),
      }));

      mockSupabase = {
        from: mock(() => ({ select: selectMock })),
      } as any;

      await expect(
        service.checkTemplateUsage(templateId, mockUser, mockSupabase),
      ).rejects.toThrow(BusinessException);
    });
  });
});
