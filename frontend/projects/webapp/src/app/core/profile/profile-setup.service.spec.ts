import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { ProfileSetupService } from './profile-setup.service';
import { ApplicationConfiguration } from '@core/config/application-configuration';
import { BudgetApi } from '@core/budget';
import { PostHogService } from '@core/analytics/posthog';
import { Logger } from '@core/logging/logger';

describe('ProfileSetupService', () => {
  let service: ProfileSetupService;
  let mockBudgetApi: { createBudget$: ReturnType<typeof vi.fn> };
  let mockPostHogService: { enableTracking: ReturnType<typeof vi.fn> };
  let mockLogger: {
    info: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockBudgetApi = {
      createBudget$: vi
        .fn()
        .mockReturnValue(of({ budget: { id: 'budget-123' } })),
    };

    mockPostHogService = {
      enableTracking: vi.fn(),
    };

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        ProfileSetupService,
        {
          provide: ApplicationConfiguration,
          useValue: { backendApiUrl: () => 'http://localhost:3000/api/v1' },
        },
        { provide: BudgetApi, useValue: mockBudgetApi },
        { provide: PostHogService, useValue: mockPostHogService },
        { provide: Logger, useValue: mockLogger },
      ],
    });

    service = TestBed.inject(ProfileSetupService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('createInitialBudget', () => {
    it('should return error when firstName is missing', async () => {
      const result = await service.createInitialBudget({
        firstName: '',
        monthlyIncome: 5000,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Données obligatoires manquantes');
    });

    it('should return error when monthlyIncome is missing', async () => {
      const result = await service.createInitialBudget({
        firstName: 'John',
        monthlyIncome: 0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Données obligatoires manquantes');
    });

    it('should return error when monthlyIncome is negative', async () => {
      const result = await service.createInitialBudget({
        firstName: 'John',
        monthlyIncome: -100,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Données obligatoires manquantes');
    });
  });
});
