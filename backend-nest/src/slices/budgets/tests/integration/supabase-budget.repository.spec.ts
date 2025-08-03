import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { SupabaseBudgetRepository } from '../../infrastructure/persistence/supabase-budget.repository';
import { BudgetMapper } from '../../infrastructure/mappers/budget.mapper';
import { EnhancedLoggerService } from '@shared/infrastructure/logging/enhanced-logger.service';
import { Budget } from '../../domain/entities/budget.entity';
import { BudgetPeriod } from '../../domain/value-objects/budget-period.value-object';
import { createMockSupabaseClient } from '@/test/test-utils';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';

describe.skipIf(!process.env.SUPABASE_URL || process.env.CI === 'true')(
  'SupabaseBudgetRepository Integration',
  () => {
    let repository: SupabaseBudgetRepository;
    let mockSupabase: AuthenticatedSupabaseClient;
    let mockClient: any;
    let mockLogger: EnhancedLoggerService;
    let mapper: BudgetMapper;

    beforeEach(() => {
      // Create mock logger
      mockLogger = {
        info: mock(() => {}),
        error: mock(() => {}),
        warn: mock(() => {}),
        debug: mock(() => {}),
        child: mock(() => mockLogger),
        logOperation: mock(() => Promise.resolve()),
        startOperation: mock(() => 'operation-id'),
        completeOperation: mock(() => {}),
        logAudit: mock(() => {}),
      } as any;

      // Create real mapper
      mapper = new BudgetMapper();

      // Create repository
      repository = new SupabaseBudgetRepository(mockLogger, mapper);

      // Create mock Supabase client
      const mockResult = createMockSupabaseClient();
      mockSupabase = mockResult.client;
      mockClient = mockResult.mockClient;

      // Set the client on the repository
      repository.setClient(mockSupabase);
    });

    describe('findById', () => {
      it('should find budget by id', async () => {
        const mockData = {
          id: 'budget-123',
          user_id: 'user-123',
          month: 1,
          year: 2024,
          description: 'Test Budget',
          template_id: 'template-123',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        mockClient.setMockData(mockData);
        const result = await repository.findById('budget-123', 'user-123');

        expect(result.isOk()).toBe(true);
        expect(result.value).not.toBeNull();
        expect(result.value?.id).toBe('budget-123');
        expect(result.value?.userId).toBe('user-123');
      });

      it('should return null when budget not found', async () => {
        mockClient.setMockData(null).setMockError({ code: 'PGRST116' });
        const result = await repository.findById('budget-123', 'user-123');

        expect(result.isOk()).toBe(true);
        expect(result.value).toBeNull();
      });

      it('should handle database errors', async () => {
        mockClient.setMockData(null).setMockError(new Error('Database error'));
        const result = await repository.findById('budget-123', 'user-123');

        expect(result.isFail()).toBe(true);
        expect(result.error?.message).toContain('Database error');
      });
    });

    describe('findByPeriod', () => {
      it('should find budget by period', async () => {
        const period = BudgetPeriod.create(1, 2024).value!;
        const mockData = {
          id: 'budget-123',
          user_id: 'user-123',
          month: 1,
          year: 2024,
          description: 'Test Budget',
          template_id: 'template-123',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        mockSupabase.from = mock(() => ({
          select: mock(() => ({
            eq: mock(() => ({
              eq: mock(() => ({
                single: mock(() => ({ data: mockData, error: null })),
              })),
            })),
          })),
        }));

        repository.setClient(mockSupabase);
        const result = await repository.findByPeriod(period, 'user-123');

        expect(result.isOk()).toBe(true);
        expect(result.value).not.toBeNull();
        expect(result.value?.period.month).toBe(1);
        expect(result.value?.period.year).toBe(2024);
      });
    });

    describe('findByUserId', () => {
      it('should find all budgets for user', async () => {
        const mockData = [
          {
            id: 'budget-1',
            user_id: 'user-123',
            month: 2,
            year: 2024,
            description: 'February Budget',
            template_id: 'template-123',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: 'budget-2',
            user_id: 'user-123',
            month: 1,
            year: 2024,
            description: 'January Budget',
            template_id: 'template-123',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ];

        mockSupabase.from = mock(() => ({
          select: mock(() => ({
            order: mock(() => ({
              order: mock(() => ({ data: mockData, error: null })),
            })),
          })),
        }));

        repository.setClient(mockSupabase);
        const result = await repository.findByUserId('user-123');

        expect(result.isOk()).toBe(true);
        expect(result.value).toHaveLength(2);
        expect(result.value[0].id).toBe('budget-1');
        expect(result.value[1].id).toBe('budget-2');
      });

      it('should return empty array when no budgets found', async () => {
        mockSupabase.from = mock(() => ({
          select: mock(() => ({
            order: mock(() => ({
              order: mock(() => ({ data: [], error: null })),
            })),
          })),
        }));

        repository.setClient(mockSupabase);
        const result = await repository.findByUserId('user-123');

        expect(result.isOk()).toBe(true);
        expect(result.value).toEqual([]);
      });
    });

    describe('save', () => {
      it('should insert new budget', async () => {
        const budget = Budget.create({
          userId: 'user-123',
          period: BudgetPeriod.create(1, 2024).value!,
          description: 'New Budget',
          templateId: 'template-123',
        }).value!;

        // Mock select to indicate budget doesn't exist
        const fromMock = {
          select: mock(() => ({
            eq: mock(() => ({
              single: mock(() => ({ data: null, error: null })),
            })),
          })),
          insert: mock(() => ({ error: null })),
        };
        mockSupabase.from = mock(() => fromMock);

        // Mock auth for audit logging
        mockSupabase.auth = {
          getUser: mock(() =>
            Promise.resolve({
              data: { user: { id: 'user-123' } },
              error: null,
            }),
          ),
        };
        const result = await repository.save(budget);

        expect(result.isOk()).toBe(true);
      });

      it('should update existing budget', async () => {
        const budget = Budget.create(
          {
            userId: 'user-123',
            period: BudgetPeriod.create(1, 2024).value!,
            description: 'Updated Budget',
            templateId: 'template-123',
          },
          'budget-123',
        ).value!;

        // Mock select to indicate budget exists
        const fromMock = {
          select: mock(() => ({
            eq: mock(() => ({
              single: mock(() => ({
                data: { id: 'budget-123' },
                _error: null,
              })),
            })),
          })),
          update: mock(() => ({
            eq: mock(() => ({ error: null })),
          })),
        };
        mockSupabase.from = mock(() => fromMock);

        // Mock auth for audit logging
        mockSupabase.auth = {
          getUser: mock(() =>
            Promise.resolve({
              data: { user: { id: 'user-123' } },
              error: null,
            }),
          ),
        };
        const result = await repository.save(budget);

        expect(result.isOk()).toBe(true);
      });
    });

    describe('delete', () => {
      it('should delete budget', async () => {
        mockSupabase.from = mock(() => ({
          delete: mock(() => ({
            eq: mock(() => ({ error: null })),
          })),
        }));

        // Mock auth for audit logging
        mockSupabase.auth = {
          getUser: mock(() =>
            Promise.resolve({
              data: { user: { id: 'user-123' } },
              error: null,
            }),
          ),
        };
        const result = await repository.delete('budget-123', 'user-123');

        expect(result.isOk()).toBe(true);
      });

      it('should handle delete errors', async () => {
        mockSupabase.from = mock(() => ({
          delete: mock(() => ({
            eq: mock(() => ({ error: new Error('Delete failed') })),
          })),
        }));

        // Mock auth for audit logging
        mockSupabase.auth = {
          getUser: mock(() =>
            Promise.resolve({
              data: { user: { id: 'user-123' } },
              error: null,
            }),
          ),
        };
        const result = await repository.delete('budget-123', 'user-123');

        expect(result.isFail()).toBe(true);
        expect(result.error?.message).toContain('Delete failed');
      });
    });

    describe('createFromTemplate', () => {
      it('should create budget from template', async () => {
        const budget = Budget.create({
          userId: 'user-123',
          period: BudgetPeriod.create(1, 2024).value!,
          description: 'New Budget',
          templateId: 'template-123',
        }).value!;

        const mockResult = {
          budget: {
            id: 'budget-123',
            // ... other fields
          },
          budget_lines_created: 5,
          template_name: 'Test Template',
        };

        mockClient.setMockRpcData(mockResult);

        // Mock auth for audit logging
        mockSupabase.auth = {
          getUser: mock(() =>
            Promise.resolve({
              data: { user: { id: 'user-123' } },
              error: null,
            }),
          ),
        };
        const result = await repository.createFromTemplate(
          budget,
          'template-123',
        );

        expect(result.isOk()).toBe(true);
        expect(result.value.budgetLinesCreated).toBe(5);
      });

      it('should handle template not found error', async () => {
        const budget = Budget.create({
          userId: 'user-123',
          period: BudgetPeriod.create(1, 2024).value!,
          description: 'New Budget',
          templateId: 'template-123',
        }).value!;

        mockClient
          .setMockRpcData(null)
          .setMockRpcError({ message: 'Template not found' });

        // Mock auth for audit logging
        mockSupabase.auth = {
          getUser: mock(() =>
            Promise.resolve({
              data: { user: { id: 'user-123' } },
              error: null,
            }),
          ),
        };
        const result = await repository.createFromTemplate(
          budget,
          'template-123',
        );

        expect(result.isFail()).toBe(true);
        expect(result.error?.message).toContain('Template not found');
      });
    });
  },
);
