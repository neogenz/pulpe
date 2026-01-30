import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { BudgetTemplateService } from './budget-template.service';
import {
  createMockSupabaseClient,
  createMockTemplateLineEntity,
} from '@/test/test-mocks';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { Tables } from '@/types/database.types';
import { BusinessException } from '@common/exceptions/business.exception';

describe('BudgetTemplateService - Simplified Tests', () => {
  let service: BudgetTemplateService;
  let mockSupabase: any;
  let mockUser: AuthenticatedUser;
  let mockLogger: any;
  let mockBudgetService: { recalculateBalances: ReturnType<typeof mock> };

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
    amount_encrypted: null,
    kind: 'expense',
    recurrence: 'fixed',
    description: 'Test description',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    const { mockClient } = createMockSupabaseClient();
    mockSupabase = mockClient;
    mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      accessToken: 'mock-token',
      clientKey: Buffer.from('ab'.repeat(32), 'hex'),
    };
    mockLogger = {
      error: mock(() => {}),
      warn: mock(() => {}),
      info: mock(() => {}),
      debug: mock(() => {}),
    };

    mockBudgetService = {
      recalculateBalances: mock(() => Promise.resolve()),
    };

    const mockEncryptionService = {
      ensureUserDEK: () => Promise.resolve(Buffer.alloc(32)),
      encryptAmount: () => 'encrypted-mock',
      decryptAmount: () => 100,
      getUserDEK: () => Promise.resolve(Buffer.alloc(32)),
    };

    service = new BudgetTemplateService(
      mockLogger as any,
      mockBudgetService as any,
      mockEncryptionService as any,
    );
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
      ).rejects.toThrow(BusinessException);
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

  describe('Propagation Handling', () => {
    const templateId = 'template-123';

    it('should return template-only summary when propagation disabled', async () => {
      const operations = {
        deletedIds: [] as string[],
        updatedLines: [] as Tables<'template_line'>[],
        createdLines: [] as Tables<'template_line'>[],
      };

      const summary = await (service as any).handlePropagationStrategy(
        false,
        operations,
        templateId,
        mockUser,
        {} as any,
      );

      expect(summary).toEqual({
        mode: 'template-only',
        affectedBudgetIds: [],
        affectedBudgetsCount: 0,
      });
      expect(mockBudgetService.recalculateBalances).not.toHaveBeenCalled();
    });

    it('should execute transactional delete when propagation disabled but deletions exist', async () => {
      const operations = {
        deletedIds: ['line-1'],
        updatedLines: [] as Tables<'template_line'>[],
        createdLines: [] as Tables<'template_line'>[],
      };

      const rpcMock = mock(() => Promise.resolve({ data: [], error: null }));
      const supabaseStub = {
        rpc: rpcMock,
      } as any;

      const summary = await (service as any).handlePropagationStrategy(
        false,
        operations,
        templateId,
        mockUser,
        supabaseStub,
      );

      expect(summary).toEqual({
        mode: 'template-only',
        affectedBudgetIds: [],
        affectedBudgetsCount: 0,
      });
      expect(rpcMock).toHaveBeenCalledWith(
        'apply_template_line_operations',
        expect.objectContaining({
          template_id: templateId,
          budget_ids: [],
          delete_ids: ['line-1'],
        }),
      );
    });

    it('should propagate template changes to future budgets and recalculate balances', async () => {
      const templateLine = createMockTemplateLineEntity({
        id: 'line-1',
        template_id: templateId,
      }) as Tables<'template_line'>;

      const operations = {
        deletedIds: [] as string[],
        updatedLines: [templateLine],
        createdLines: [] as Tables<'template_line'>[],
      };

      const futureBudgets = [
        {
          id: 'budget-1',
          month: 12,
          year: new Date().getUTCFullYear() + 1,
        },
      ];

      const supabaseStub = {
        from: (table: string) => {
          if (table === 'monthly_budget') {
            const resolved = { data: futureBudgets, error: null };
            return {
              select: () => ({
                eq: () => ({
                  eq: () => {
                    const p = Promise.resolve(resolved);
                    return {
                      or: () => Promise.resolve(resolved),
                      then: p.then.bind(p),
                      catch: p.catch.bind(p),
                    };
                  },
                }),
              }),
            };
          }

          throw new Error(`Unexpected table access: ${table}`);
        },
        rpc: mock(() => Promise.resolve({ data: ['budget-1'], error: null })),
      } as any;

      const summary = await (service as any).propagateTemplateChangesToBudgets(
        templateId,
        operations,
        mockUser.clientKey,
        mockUser,
        supabaseStub,
      );

      expect(summary).toEqual({
        mode: 'propagate',
        affectedBudgetIds: ['budget-1'],
        affectedBudgetsCount: 1,
      });
      expect(supabaseStub.rpc).toHaveBeenCalledWith(
        'apply_template_line_operations',
        expect.objectContaining({
          template_id: templateId,
          budget_ids: ['budget-1'],
        }),
      );
      expect(mockBudgetService.recalculateBalances).toHaveBeenCalledTimes(1);
      expect(mockBudgetService.recalculateBalances).toHaveBeenCalledWith(
        'budget-1',
        supabaseStub,
        mockUser.clientKey,
      );
    });

    it('should skip RPC when there are no deletions or budget mutations', async () => {
      const operations = {
        deletedIds: [] as string[],
        updatedLines: [] as Tables<'template_line'>[],
        createdLines: [] as Tables<'template_line'>[],
      };

      const rpcMock = mock(() => Promise.resolve({ data: [], error: null }));
      const supabaseStub = {
        from: (table: string) => {
          if (table === 'monthly_budget') {
            const resolved = { data: [], error: null };
            return {
              select: () => ({
                eq: () => ({
                  eq: () => {
                    const p = Promise.resolve(resolved);
                    return {
                      or: () => Promise.resolve(resolved),
                      then: p.then.bind(p),
                      catch: p.catch.bind(p),
                    };
                  },
                }),
              }),
            };
          }
          throw new Error(`Unexpected table access: ${table}`);
        },
        rpc: rpcMock,
      } as any;

      const summary = await (service as any).propagateTemplateChangesToBudgets(
        templateId,
        operations,
        mockUser.clientKey,
        mockUser,
        supabaseStub,
      );

      expect(summary).toEqual({
        mode: 'propagate',
        affectedBudgetIds: [],
        affectedBudgetsCount: 0,
      });
      expect(rpcMock).not.toHaveBeenCalled();
    });

    it('should serialize numeric amounts to strings before RPC call', async () => {
      const operations = {
        deletedIds: [] as string[],
        updatedLines: [
          {
            id: 'line-1',
            template_id: templateId,
            name: 'Salary',
            amount: 1234.56,
            amount_encrypted: null,
            kind: 'income',
            recurrence: 'fixed',
            description: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as Tables<'template_line'>,
        ],
        createdLines: [
          {
            id: 'line-2',
            template_id: templateId,
            name: 'Bonus',
            amount: 200,
            amount_encrypted: null,
            kind: 'income',
            recurrence: 'one_off',
            description: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as Tables<'template_line'>,
        ],
      };

      const rpcMock = mock(() =>
        Promise.resolve({ data: ['budget-1'], error: null }),
      );
      const supabaseStub = {
        from: (table: string) => {
          if (table === 'monthly_budget') {
            const resolved = {
              data: [{ id: 'budget-1', month: 1, year: 2026 }],
              error: null,
            };
            return {
              select: () => ({
                eq: () => ({
                  eq: () => {
                    const p = Promise.resolve(resolved);
                    return {
                      or: () => Promise.resolve(resolved),
                      then: p.then.bind(p),
                      catch: p.catch.bind(p),
                    };
                  },
                }),
              }),
            };
          }
          throw new Error(`Unexpected table access: ${table}`);
        },
        rpc: rpcMock,
      } as any;

      await (service as any).propagateTemplateChangesToBudgets(
        templateId,
        operations,
        mockUser.clientKey,
        mockUser,
        supabaseStub,
      );

      expect(rpcMock).toHaveBeenCalled();
      const rpcCall = rpcMock.mock.calls[0];
      if (!rpcCall) {
        throw new Error('RPC call not recorded');
      }
      const [, rpcPayload] = rpcCall as unknown as [string, any];
      expect(rpcPayload.updated_lines[0].amount).toBe('1234.56');
      expect(rpcPayload.created_lines[0].amount).toBe('200');
    });
  });

  describe('Error Handling', () => {
    it('should throw NotFoundException when template not found', async () => {
      mockSupabase.setMockData(null);

      await expect(
        service.findOne('non-existent', mockUser, mockSupabase as any),
      ).rejects.toThrow(BusinessException);
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.setMockError(new Error('Database error'));

      await expect(
        service.findAll(mockUser, mockSupabase as any),
      ).rejects.toThrow(BusinessException);
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
      ).rejects.toThrow(BusinessException);
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
      ).rejects.toThrow(BusinessException);
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
      ).rejects.toThrow(BusinessException);
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
      ).rejects.toThrow(BusinessException);
    });
  });
});
