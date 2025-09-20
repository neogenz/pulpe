import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  Router,
  type ActivatedRouteSnapshot,
  type RouterStateSnapshot,
  type Event,
  type UrlTree,
} from '@angular/router';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { onboardingStepGuard } from './onboarding-step-guard';
import { OnboardingStore, type OnboardingStep } from './onboarding-store';
import { AuthApi } from '@core/auth/auth-api';
import { BudgetApi } from '@core/budget/budget-api';
import { TemplateApi } from '@core/template/template-api';
import { OnboardingApi } from './services/onboarding-api';
import { Subject } from 'rxjs';

describe('User navigates through onboarding steps', () => {
  let store: OnboardingStore;
  let mockRouter: {
    navigate: ReturnType<typeof vi.fn>;
    createUrlTree: ReturnType<typeof vi.fn>;
    events: Subject<Event>;
  };
  let mockAuthApi: { signUpWithEmail: ReturnType<typeof vi.fn> };
  let mockBudgetApi: { createBudget$: ReturnType<typeof vi.fn> };
  let mockTemplateApi: { createFromOnboarding$: ReturnType<typeof vi.fn> };
  let mockOnboardingApi: {
    createTemplateFromOnboarding$: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();

    // Create mocks
    mockAuthApi = { signUpWithEmail: vi.fn() };
    mockBudgetApi = { createBudget$: vi.fn() };
    mockTemplateApi = { createFromOnboarding$: vi.fn() };
    mockOnboardingApi = { createTemplateFromOnboarding$: vi.fn() };
    mockRouter = {
      navigate: vi.fn(),
      createUrlTree: vi.fn().mockReturnValue({} as UrlTree), // Mock return value pour simuler UrlTree
      events: new Subject(),
    };

    // Configure TestBed
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        OnboardingStore,
        { provide: AuthApi, useValue: mockAuthApi },
        { provide: BudgetApi, useValue: mockBudgetApi },
        { provide: TemplateApi, useValue: mockTemplateApi },
        { provide: OnboardingApi, useValue: mockOnboardingApi },
        { provide: Router, useValue: mockRouter },
      ],
    });

    store = TestBed.inject(OnboardingStore);
  });

  function createMockRoute(
    path: OnboardingStep | string,
  ): ActivatedRouteSnapshot {
    return {
      routeConfig: { path },
    } as ActivatedRouteSnapshot;
  }

  function executeGuard(route: ActivatedRouteSnapshot): boolean | UrlTree {
    const mockState = {} as RouterStateSnapshot;
    const result = TestBed.runInInjectionContext(() =>
      onboardingStepGuard(route, mockState),
    );
    // Handle the case where the guard might return a RedirectCommand or Promise
    if (result && typeof result === 'object' && 'redirectTo' in result) {
      // If it's a RedirectCommand, return the UrlTree
      return (result as { redirectTo: UrlTree }).redirectTo;
    }
    return result as boolean | UrlTree;
  }

  describe('User starts onboarding', () => {
    it('user can access welcome page without any information', () => {
      // When: User visits welcome step
      const route = createMockRoute('welcome');
      const result = executeGuard(route);

      // Then: Access is granted
      expect(result).toBe(true);
    });

    it('user can start with personal information step', () => {
      // When: User goes directly to personal info
      const route = createMockRoute('personal-info');
      const result = executeGuard(route);

      // Then: Access is allowed
      expect(result).toBe(true);
    });
  });

  describe('User progresses through steps', () => {
    it('user must enter name before accessing income step', () => {
      // Given: User has not entered their name
      // When: User tries to access income step
      const route = createMockRoute('income');
      executeGuard(route);

      // Then: User is redirected to personal info
      expect(mockRouter.createUrlTree).toHaveBeenCalledWith([
        '/onboarding/personal-info',
      ]);
    });

    it('user can access income step after entering name', () => {
      // Given: User has entered their name
      store.updateField('firstName', 'John');

      // When: User navigates to income step
      const route = createMockRoute('income');
      const result = executeGuard(route);

      // Then: Access is granted
      expect(result).toBe(true);
    });

    it('user must complete income before housing expenses', () => {
      // Given: User has entered name but no income
      store.updateField('firstName', 'John');

      // When: User tries to skip to housing
      const route = createMockRoute('housing');
      executeGuard(route);

      // Then: User is redirected to income step
      expect(mockRouter.createUrlTree).toHaveBeenCalledWith([
        '/onboarding/income',
      ]);
    });

    it('user can enter housing costs after providing income', () => {
      // Given: User has completed name and income
      store.updateField('firstName', 'John');
      store.updateField('monthlyIncome', 5000);

      // When: User navigates to housing step
      const route = createMockRoute('housing');
      const result = executeGuard(route);

      // Then: Access is granted
      expect(result).toBe(true);
    });

    it('user must provide valid income amount to continue', () => {
      // Given: User entered name but zero income
      store.updateField('firstName', 'John');
      store.updateField('monthlyIncome', 0);

      // When: User tries to proceed to housing
      const route = createMockRoute('housing');
      executeGuard(route);

      // Then: User is sent back to income step
      expect(mockRouter.createUrlTree).toHaveBeenCalledWith([
        '/onboarding/income',
      ]);
    });

    it('user cannot skip steps in expense sections', () => {
      const expenseSteps = [
        'health-insurance',
        'phone-plan',
        'transport',
        'leasing-credit',
      ];

      // When: User tries to access expense steps without prerequisites
      for (const step of expenseSteps) {
        const route = createMockRoute(step);
        executeGuard(route);
        expect(mockRouter.createUrlTree).toHaveBeenCalledWith([
          '/onboarding/personal-info',
        ]);
        mockRouter.createUrlTree.mockClear();
      }

      // Given: User has entered name
      store.updateField('firstName', 'John');

      // When: User tries to access expense steps without income
      for (const step of expenseSteps) {
        const route = createMockRoute(step);
        executeGuard(route);
        expect(mockRouter.createUrlTree).toHaveBeenCalledWith([
          '/onboarding/income',
        ]);
        mockRouter.createUrlTree.mockClear();
      }

      // Given: User has completed required information
      store.updateField('monthlyIncome', 5000);

      // When: User accesses expense steps in order
      for (const step of expenseSteps) {
        const route = createMockRoute(step);
        const result = executeGuard(route);
        // Then: Each step is accessible
        expect(result).toBe(true);
      }
    });
  });

  describe('User reaches registration', () => {
    it('user cannot register without personal information', () => {
      // Given: User has not entered any information
      // When: User tries to access registration
      const route = createMockRoute('registration');
      executeGuard(route);

      // Then: User is sent to start of onboarding
      expect(mockRouter.createUrlTree).toHaveBeenCalledWith([
        '/onboarding/personal-info',
      ]);
    });

    it('user cannot register without income information', () => {
      // Given: User has entered name but no income
      store.updateField('firstName', 'John');

      // When: User tries to register
      const route = createMockRoute('registration');
      executeGuard(route);

      // Then: User is sent to income step
      expect(mockRouter.createUrlTree).toHaveBeenCalledWith([
        '/onboarding/income',
      ]);
    });

    it('user can register after completing required steps', () => {
      // Given: User has completed name and income
      store.updateField('firstName', 'John');
      store.updateField('monthlyIncome', 5000);

      // When: User reaches registration
      const route = createMockRoute('registration');
      const result = executeGuard(route);

      // Then: Registration is accessible
      expect(result).toBe(true);
    });
  });

  describe('System handles edge cases', () => {
    it('unknown steps are accessible by default', () => {
      // When: User accesses undefined step
      const route = createMockRoute('unknown-step');
      const result = executeGuard(route);

      // Then: Access is not blocked
      expect(result).toBe(true);
    });

    it('malformed routes do not cause errors', () => {
      // When: Route configuration is missing
      const route = {} as ActivatedRouteSnapshot;
      const result = executeGuard(route);

      // Then: System handles gracefully
      expect(result).toBe(true);
    });
  });
});
