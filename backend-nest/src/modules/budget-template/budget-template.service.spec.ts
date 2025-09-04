import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { BudgetTemplateService } from './budget-template.service';
import { createMockSupabaseClient } from '@/test/test-mocks';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { Tables } from '@/types/database.types';
import {
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';

describe('BudgetTemplateService - Simplified Tests', () => {
  let service: BudgetTemplateService;
  let mockSupabase: any;
  let mockUser: AuthenticatedUser;
  let mockLogger: any;

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
    kind: 'expense',
    recurrence: 'fixed',
    description: 'Test description',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    const { mockClient } = createMockSupabaseClient();
    mockSupabase = mockClient;
    mockUser = { id: 'user-123', email: 'test@example.com' };
    mockLogger = {
      error: mock(() => {}),
      warn: mock(() => {}),
      info: mock(() => {}),
      debug: mock(() => {}),
    };

    service = new BudgetTemplateService(mockLogger);
  });

  describe('Service Setup', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('Templates', () => {
    it('should return all user templates', async () => {
      mockSupabase.setMockData([mockTemplate]);

      const result = await service.findAll(mockUser, mockSupabase as any);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Test Template');
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should return a specific template', async () => {
      mockSupabase.setMockData(mockTemplate);

      const result = await service.findOne(
        'template-123',
        mockUser,
        mockSupabase as any,
      );

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('template-123');
    });

    it('should delete a template', async () => {
      mockSupabase.setMockData(mockTemplate);

      const result = await service.remove(
        'template-123',
        mockUser,
        mockSupabase as any,
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe('Template deleted successfully');
    });
  });

  describe('Template Lines', () => {
    it('should delete a template line', async () => {
      const lineWithTemplate = {
        ...mockTemplateLine,
        template: mockTemplate,
      };

      mockSupabase.setMockData(lineWithTemplate);

      const result = await service.deleteTemplateLine(
        'line-123',
        mockUser,
        mockSupabase as any,
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe('Template line deleted successfully');
    });

    it('should throw ForbiddenException for unauthorized line access', async () => {
      const lineWithTemplate = {
        ...mockTemplateLine,
        template: { ...mockTemplate, user_id: 'other-user' },
      };

      mockSupabase.setMockData(lineWithTemplate);

      await expect(
        service.deleteTemplateLine('line-123', mockUser, mockSupabase as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Template Creation', () => {
    it('should create a template with lines', async () => {
      const createDto = {
        name: 'New Template',
        description: 'Test description',
        isDefault: false,
        lines: [
          {
            name: 'Line 1',
            amount: 500,
            kind: 'income' as const,
            recurrence: 'fixed' as const,
            description: 'Income line',
          },
        ],
      };

      // Set up RPC mock to return the template
      mockSupabase.rpc = () =>
        Promise.resolve({
          data: mockTemplate,
          error: null,
        });
      mockSupabase.setMockData([mockTemplateLine]);

      const result = await service.create(
        createDto,
        mockUser,
        mockSupabase as any,
      );

      expect(result.success).toBe(true);
      expect(result.data.template.name).toBe('Test Template');
      expect(result.data.lines).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    it('should throw NotFoundException when template not found', async () => {
      mockSupabase.setMockData(null);

      await expect(
        service.findOne('non-existent', mockUser, mockSupabase as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.setMockError(new Error('Database error'));

      await expect(
        service.findAll(mockUser, mockSupabase as any),
      ).rejects.toThrow(InternalServerErrorException);

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce onboarding rate limiting', async () => {
      const onboardingData = {
        name: 'Onboarding Template',
        monthlyIncome: 5000,
        isDefault: true,
        customTransactions: [],
      };

      mockSupabase.setMockData([{ id: 'recent-template' }]); // Recent template exists

      await expect(
        service.createFromOnboarding(
          onboardingData,
          mockUser,
          mockSupabase as any,
        ),
      ).rejects.toThrow(
        'You can only create one template from onboarding per 24 hours',
      );
    });
  });

  describe('Template Limit Validation', () => {
    it('should allow creating templates when under the limit', async () => {
      const createDto = {
        name: 'New Template',
        description: 'Test description',
        isDefault: false,
        lines: [],
      };

      // Mock count query to return less than limit
      mockSupabase.select = mock(() => ({
        eq: mock(() => ({
          data: null,
          error: null,
          count: 3, // Under the limit of 5
        })),
      }));

      // Mock RPC for template creation
      mockSupabase.rpc = () =>
        Promise.resolve({
          data: { ...mockTemplate, name: 'Test Template' },
          error: null,
        });
      mockSupabase.setMockData([]);

      const result = await service.create(
        createDto,
        mockUser,
        mockSupabase as any,
      );

      expect(result.success).toBe(true);
      expect(result.data.template.name).toBe('Test Template');
    });

    it('should reject template creation when at the limit', async () => {
      const createDto = {
        name: 'Exceeding Template',
        description: 'This should fail',
        isDefault: false,
        lines: [],
      };

      // Mock count query to return exactly the limit
      mockSupabase.from = mock(() => ({
        select: mock(() => ({
          eq: mock(() => ({
            data: null,
            error: null,
            count: 5, // At the limit of 5
          })),
        })),
      }));

      await expect(
        service.create(createDto, mockUser, mockSupabase as any),
      ).rejects.toThrow('Vous avez atteint la limite de 5 modèles');
    });

    it('should handle errors when checking template count', async () => {
      const createDto = {
        name: 'Error Template',
        description: 'Should handle error',
        isDefault: false,
        lines: [],
      };

      // Mock count query to return an error
      mockSupabase.from = mock(() => ({
        select: mock(() => ({
          eq: mock(() => ({
            data: null,
            error: new Error('Database error'),
            count: null,
          })),
        })),
      }));

      await expect(
        service.create(createDto, mockUser, mockSupabase as any),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('Default Template Switching', () => {
    it('should unset previous default when creating new default template', async () => {
      const createDto = {
        name: 'New Default Template',
        description: 'This will become default',
        isDefault: true,
        lines: [],
      };

      const createdTemplate = {
        ...mockTemplate,
        name: 'New Default Template',
        is_default: true,
      };

      // Override the from method to handle all queries properly
      const originalFrom = mockSupabase.from.bind(mockSupabase);
      let fromCallCount = 0;
      mockSupabase.from = mock((table: string) => {
        if (table === 'template') {
          fromCallCount++;
          if (fromCallCount === 1) {
            // First call: count check for template limit
            const countChain = {
              select: () => ({
                eq: () => ({
                  data: null,
                  error: null,
                  count: 2,
                }),
              }),
            };
            return countChain;
          } else {
            // Second call: update existing default templates
            const updateChain = {
              update: () => ({
                eq: () => ({
                  eq: () =>
                    Promise.resolve({
                      data: null,
                      error: null,
                    }),
                }),
              }),
            };
            return updateChain;
          }
        }
        if (table === 'template_line') {
          // Return template lines mock
          const linesChain = {
            select: () => ({
              eq: () => ({
                order: () =>
                  Promise.resolve({
                    data: [],
                    error: null,
                  }),
              }),
            }),
          };
          return linesChain;
        }
        return originalFrom(table);
      });

      // Override RPC to return the created template
      mockSupabase.rpc = mock((name: string, _params: any) => {
        if (name === 'create_template_with_lines') {
          return Promise.resolve({
            data: createdTemplate,
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: new Error('Unknown RPC') });
      });

      const result = await service.create(
        createDto,
        mockUser,
        mockSupabase as any,
      );

      expect(result.success).toBe(true);
      expect(result.data.template.isDefault).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'create_template_with_lines',
        expect.any(Object),
      );
      // Default switching is now handled inside the RPC call
    });

    it('should handle error when updating existing default template', async () => {
      const createDto = {
        name: 'New Default Template',
        description: 'This will fail to become default',
        isDefault: true,
        lines: [],
      };

      const existingDefault = {
        ...mockTemplate,
        id: 'existing-default-id',
        is_default: true,
      };

      // Mock queries in sequence
      let queryCount = 0;
      mockSupabase.from = mock(() => {
        queryCount++;
        if (queryCount === 1) {
          // First call: count check
          return {
            select: mock(() => ({
              eq: mock(() => ({
                data: null,
                error: null,
                count: 2,
              })),
            })),
          };
        } else if (queryCount === 2) {
          // Second call: find existing default
          return {
            select: mock(() => ({
              eq: mock(() => ({
                neq: mock(() => ({
                  data: [existingDefault],
                  error: null,
                })),
              })),
            })),
          };
        } else if (queryCount === 3) {
          // Third call: update existing default (fail)
          return {
            update: mock(() => ({
              eq: mock(() => ({
                data: null,
                error: new Error('Update failed'),
              })),
            })),
          };
        }
      });

      await expect(
        service.create(createDto, mockUser, mockSupabase as any),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should create default template when no existing default exists', async () => {
      const createDto = {
        name: 'First Default Template',
        description: 'This will be the first default',
        isDefault: true,
        lines: [],
      };

      const createdTemplate = {
        ...mockTemplate,
        name: 'First Default Template',
        is_default: true,
      };

      // Override the from method to handle all queries properly
      const originalFrom = mockSupabase.from.bind(mockSupabase);
      let fromCallCount = 0;
      mockSupabase.from = mock((table: string) => {
        if (table === 'template') {
          fromCallCount++;
          if (fromCallCount === 1) {
            // First call: count check for template limit
            const countChain = {
              select: () => ({
                eq: () => ({
                  data: null,
                  error: null,
                  count: 1,
                }),
              }),
            };
            return countChain;
          } else {
            // Second call: update existing default templates (for isDefault: true)
            const updateChain = {
              update: () => ({
                eq: () => ({
                  eq: () =>
                    Promise.resolve({
                      data: null,
                      error: null,
                    }),
                }),
              }),
            };
            return updateChain;
          }
        }
        if (table === 'template_line') {
          // Return template lines mock
          const linesChain = {
            select: () => ({
              eq: () => ({
                order: () =>
                  Promise.resolve({
                    data: [],
                    error: null,
                  }),
              }),
            }),
          };
          return linesChain;
        }
        return originalFrom(table);
      });

      // Override RPC to return the created template
      mockSupabase.rpc = mock((name: string, _params: any) => {
        if (name === 'create_template_with_lines') {
          return Promise.resolve({
            data: createdTemplate,
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: new Error('Unknown RPC') });
      });

      const result = await service.create(
        createDto,
        mockUser,
        mockSupabase as any,
      );

      expect(result.success).toBe(true);
      expect(result.data.template.name).toBe('First Default Template');
    });
  });

  describe('Template Creation with Lines', () => {
    it('should validate template limit before creating template with lines', async () => {
      const createDto = {
        name: 'Template with Lines',
        description: 'Has multiple lines',
        isDefault: false,
        lines: [
          {
            name: 'Income',
            amount: 5000,
            kind: 'income' as const,
            recurrence: 'fixed' as const,
            description: 'Monthly salary',
          },
          {
            name: 'Rent',
            amount: 1200,
            kind: 'expense' as const,
            recurrence: 'fixed' as const,
            description: 'Monthly rent',
          },
        ],
      };

      // Mock count query to return at limit
      mockSupabase.from = mock(() => ({
        select: mock(() => ({
          eq: mock(() => ({
            data: null,
            error: null,
            count: 5, // At the limit
          })),
        })),
      }));

      await expect(
        service.create(createDto, mockUser, mockSupabase as any),
      ).rejects.toThrow('Vous avez atteint la limite de 5 modèles');
    });
  });
});
