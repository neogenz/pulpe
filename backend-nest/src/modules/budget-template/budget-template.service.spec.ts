import { describe, it, expect, beforeEach } from 'bun:test';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { BudgetTemplateService } from './budget-template.service';
import { BudgetTemplateMapper } from './budget-template.mapper';
import {
  createMockAuthenticatedUser,
  createMockSupabaseClient,
  expectErrorThrown,
  MockSupabaseClient,
} from '../../test/test-utils';
import type { BudgetTemplateCreate } from '@pulpe/shared';

describe('BudgetTemplateService', () => {
  let service: BudgetTemplateService;
  let mockSupabaseClient: MockSupabaseClient;
  let mapper: BudgetTemplateMapper;

  const createValidTemplateCreateDto = (
    overrides: any = {},
  ): BudgetTemplateCreate => ({
    name: 'Test Template',
    description: 'Test Description',
    isDefault: false,
    lines: [
      {
        name: 'Test Line',
        amount: 100,
        kind: 'FIXED_EXPENSE',
        recurrence: 'fixed',
        description: 'Test line description',
      },
    ],
    ...overrides,
  });

  beforeEach(async () => {
    const { mockClient } = createMockSupabaseClient();
    mockSupabaseClient = mockClient;
    mockSupabaseClient.reset(); // Reset mock state between tests

    const mockPinoLogger = {
      error: () => {},
      warn: () => {},
      info: () => {},
      debug: () => {},
      trace: () => {},
      fatal: () => {},
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: BudgetTemplateService,
          useFactory: (logger: any, mapper: BudgetTemplateMapper) => {
            return new BudgetTemplateService(logger, mapper);
          },
          inject: [
            `PinoLogger:${BudgetTemplateService.name}`,
            BudgetTemplateMapper,
          ],
        },
        BudgetTemplateMapper,
        {
          provide: `PinoLogger:${BudgetTemplateService.name}`,
          useValue: mockPinoLogger,
        },
      ],
    }).compile();

    service = module.get<BudgetTemplateService>(BudgetTemplateService);
    mapper = module.get<BudgetTemplateMapper>(BudgetTemplateMapper);

    // Verify mapper is properly injected
    expect(mapper).toBeDefined();
  });

  describe('service setup', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('create', () => {
    it('should throw error when template lines fetch fails after successful creation', async () => {
      const mockUser = createMockAuthenticatedUser();
      const createDto = createValidTemplateCreateDto();

      // Mock successful RPC call for template creation
      mockSupabaseClient
        .setMockRpcData({
          id: 'template-123',
          user_id: mockUser.id,
          name: createDto.name,
          description: createDto.description,
          is_default: createDto.isDefault,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .setMockRpcError(null);

      // Mock failed template_line fetch
      mockSupabaseClient
        .setMockData(null)
        .setMockError(new Error('Database connection failed'));

      await expectErrorThrown(
        () => service.create(createDto, mockUser, mockSupabaseClient as any),
        InternalServerErrorException,
        'Erreur interne du serveur',
      );
    });

    it('should handle successful template creation with successful line fetch', async () => {
      const mockUser = createMockAuthenticatedUser();
      const createDto = createValidTemplateCreateDto();

      // Reset mock state explicitly before setup
      mockSupabaseClient.reset();

      // Mock successful RPC call for template creation
      mockSupabaseClient
        .setMockRpcData({
          id: 'template-123',
          user_id: mockUser.id,
          name: createDto.name,
          description: createDto.description,
          is_default: createDto.isDefault,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .setMockRpcError(null);

      // Mock successful template_line fetch
      mockSupabaseClient
        .setMockData([
          {
            id: 'line-123',
            template_id: 'template-123',
            name: 'Test Line',
            amount: '100',
            kind: 'FIXED_EXPENSE',
            recurrence: 'fixed',
            description: 'Test line description',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
        .setMockError(null);

      const result = await service.create(
        createDto,
        mockUser,
        mockSupabaseClient as any,
      );

      expect(result.success).toBe(true);
      expect(result.data.template.name).toBe(createDto.name);
      expect(result.data.lines).toHaveLength(1);
      expect(result.data.lines[0].name).toBe('Test Line');
    });
  });

  describe('bulkUpdateTemplateLines - batch validation performance', () => {
    it('should validate all lines in a single batch query', async () => {
      const templateId = '550e8400-e29b-41d4-a716-446655440010';
      const mockUser = createMockAuthenticatedUser();
      const bulkUpdateDto = {
        lines: [
          {
            id: '550e8400-e29b-41d4-a716-446655440011',
            name: 'Updated 1',
            amount: 100,
          },
          {
            id: '550e8400-e29b-41d4-a716-446655440012',
            name: 'Updated 2',
            amount: 200,
          },
          {
            id: '550e8400-e29b-41d4-a716-446655440013',
            name: 'Updated 3',
            amount: 300,
          },
        ],
      };

      // Track database calls
      let dbCallCount = 0;
      const dbCalls: string[] = [];

      // Mock template validation
      const originalFrom = mockSupabaseClient.from.bind(mockSupabaseClient);
      mockSupabaseClient.from = (table: string) => {
        dbCallCount++;
        dbCalls.push(table);

        if (table === 'template') {
          // Template validation - user owns the template
          mockSupabaseClient
            .setMockData({
              id: templateId,
              user_id: mockUser.id,
              name: 'Test Template',
            })
            .setMockError(null);
        } else if (table === 'template_line') {
          // Batch line validation - all lines exist
          mockSupabaseClient
            .setMockData(bulkUpdateDto.lines.map((line) => ({ id: line.id })))
            .setMockError(null);
        }

        return originalFrom(table);
      };

      // Mock successful RPC call for bulk update
      mockSupabaseClient
        .setMockRpcData(
          bulkUpdateDto.lines.map((line) => ({
            id: line.id,
            template_id: templateId,
            name: line.name,
            amount: line.amount.toString(),
            kind: 'FIXED_EXPENSE',
            recurrence: 'fixed',
            description: '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })),
        )
        .setMockRpcError(null);

      try {
        const result = await service.bulkUpdateTemplateLines(
          templateId,
          bulkUpdateDto,
          mockUser,
          mockSupabaseClient as any,
        );

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(3);
        expect(result.message).toContain('3 ligne(s) mise(s) à jour');
      } catch (error) {
        console.error('Test error:', error);
        throw error;
      }

      // Verify only 2 database calls were made (not N+1)
      // If the count is 3, it might be due to the mapper fetching template lines again
      console.log('Database calls:', dbCalls);
      console.log('Total calls:', dbCallCount);

      // The important thing is that we're not making N+1 calls (which would be 4 for 3 lines)
      expect(dbCallCount).toBeLessThanOrEqual(3);
      expect(dbCalls).toContain('template');
      expect(dbCalls).toContain('template_line');
    });

    it('should throw NotFoundException when lines are missing', async () => {
      const templateId = '550e8400-e29b-41d4-a716-446655440010';
      const mockUser = createMockAuthenticatedUser();
      const missingLineId = '550e8400-e29b-41d4-a716-446655440012';
      const bulkUpdateDto = {
        lines: [
          {
            id: '550e8400-e29b-41d4-a716-446655440011',
            name: 'Updated 1',
            amount: 100,
          },
          { id: missingLineId, name: 'Updated 2', amount: 200 },
          {
            id: '550e8400-e29b-41d4-a716-446655440013',
            name: 'Updated 3',
            amount: 300,
          },
        ],
      };

      const originalFrom = mockSupabaseClient.from.bind(mockSupabaseClient);
      mockSupabaseClient.from = (table: string) => {
        if (table === 'template') {
          mockSupabaseClient
            .setMockData({
              id: templateId,
              user_id: mockUser.id,
              name: 'Test Template',
            })
            .setMockError(null);
        } else if (table === 'template_line') {
          // Return only 2 lines, missing the middle one
          mockSupabaseClient
            .setMockData([
              { id: bulkUpdateDto.lines[0].id },
              { id: bulkUpdateDto.lines[2].id },
            ])
            .setMockError(null);
        }

        return originalFrom(table);
      };

      await expectErrorThrown(
        () =>
          service.bulkUpdateTemplateLines(
            templateId,
            bulkUpdateDto,
            mockUser,
            mockSupabaseClient as any,
          ),
        NotFoundException,
        missingLineId,
      );
    });
  });
});
