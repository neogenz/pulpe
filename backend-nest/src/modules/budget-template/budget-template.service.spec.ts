import { describe, it, expect, beforeEach } from 'bun:test';
import { Test, type TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
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
        kind: 'expense',
        recurrence: 'fixed',
        description: 'Test line description',
      },
    ],
    ...overrides,
  });

  beforeEach(async () => {
    const { mockClient } = createMockSupabaseClient();
    mockSupabaseClient = mockClient;

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
        BudgetTemplateService,
        BudgetTemplateMapper,
        {
          provide: `PinoLogger:${BudgetTemplateService.name}`,
          useValue: mockPinoLogger,
        },
      ],
    }).compile();

    service = module.get<BudgetTemplateService>(BudgetTemplateService);
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
            kind: 'expense',
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
});
