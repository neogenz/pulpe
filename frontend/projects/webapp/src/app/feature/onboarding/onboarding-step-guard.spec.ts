import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  Router,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Event,
  UrlTree,
} from '@angular/router';
import { provideZonelessChangeDetection } from '@angular/core';
import { onboardingStepGuard } from './onboarding-step-guard';
import { OnboardingStore, type OnboardingStep } from './onboarding-store';
import { AuthApi } from '../../core/auth/auth-api';
import { BudgetApi } from '../../core/budget/budget-api';
import { TemplateApi } from '../../core/template/template-api';
import { Subject } from 'rxjs';

describe('OnboardingStepGuard - Sequential Navigation', () => {
  let store: OnboardingStore;
  let mockRouter: {
    navigate: ReturnType<typeof vi.fn>;
    createUrlTree: ReturnType<typeof vi.fn>;
    events: Subject<Event>;
  };
  let mockAuthApi: { signUpWithEmail: ReturnType<typeof vi.fn> };
  let mockBudgetApi: { createBudget$: ReturnType<typeof vi.fn> };
  let mockTemplateApi: { createFromOnboarding$: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();

    // Create mocks
    mockAuthApi = { signUpWithEmail: vi.fn() };
    mockBudgetApi = { createBudget$: vi.fn() };
    mockTemplateApi = { createFromOnboarding$: vi.fn() };
    mockRouter = {
      navigate: vi.fn(),
      createUrlTree: vi.fn().mockReturnValue({} as UrlTree), // Mock return value pour simuler UrlTree
      events: new Subject(),
    };

    // Configure TestBed
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        OnboardingStore,
        { provide: AuthApi, useValue: mockAuthApi },
        { provide: BudgetApi, useValue: mockBudgetApi },
        { provide: TemplateApi, useValue: mockTemplateApi },
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

  describe('Sequential Validation', () => {
    it('should allow access to welcome step without any data', () => {
      const route = createMockRoute('welcome');
      const result = executeGuard(route);

      expect(result).toBe(true);
    });

    it('should allow access to personal-info step without any data', () => {
      const route = createMockRoute('personal-info');
      const result = executeGuard(route);

      expect(result).toBe(true);
    });

    it('should redirect to personal-info when accessing income without firstName', () => {
      const route = createMockRoute('income');

      executeGuard(route);

      expect(mockRouter.createUrlTree).toHaveBeenCalledWith([
        '/onboarding/personal-info',
      ]);
    });

    it('should allow access to income step when firstName is provided', () => {
      store.updateField('firstName', 'John');
      const route = createMockRoute('income');

      const result = executeGuard(route);

      expect(result).toBe(true);
    });

    it('should redirect to personal-info when accessing housing without firstName', () => {
      const route = createMockRoute('housing');

      executeGuard(route);

      expect(mockRouter.createUrlTree).toHaveBeenCalledWith([
        '/onboarding/personal-info',
      ]);
    });

    it('should redirect to income when accessing housing with firstName but without monthlyIncome', () => {
      store.updateField('firstName', 'John');
      const route = createMockRoute('housing');

      executeGuard(route);

      expect(mockRouter.createUrlTree).toHaveBeenCalledWith([
        '/onboarding/income',
      ]);
    });

    it('should allow access to housing when firstName and monthlyIncome are provided', () => {
      store.updateField('firstName', 'John');
      store.updateField('monthlyIncome', 5000);
      const route = createMockRoute('housing');

      const result = executeGuard(route);

      expect(result).toBe(true);
    });

    it('should redirect to income when accessing housing with zero monthlyIncome', () => {
      store.updateField('firstName', 'John');
      store.updateField('monthlyIncome', 0);
      const route = createMockRoute('housing');

      executeGuard(route);

      expect(mockRouter.createUrlTree).toHaveBeenCalledWith([
        '/onboarding/income',
      ]);
    });

    it('should redirect to income when accessing housing with negative monthlyIncome', () => {
      store.updateField('firstName', 'John');
      store.updateField('monthlyIncome', -100);
      const route = createMockRoute('housing');

      executeGuard(route);

      expect(mockRouter.createUrlTree).toHaveBeenCalledWith([
        '/onboarding/income',
      ]);
    });

    it('should enforce sequential validation for all steps after income', () => {
      const steps = [
        'health-insurance',
        'phone-plan',
        'transport',
        'leasing-credit',
      ];

      // Test without required data
      for (const step of steps) {
        const route = createMockRoute(step);
        executeGuard(route);
        expect(mockRouter.createUrlTree).toHaveBeenCalledWith([
          '/onboarding/personal-info',
        ]);
        mockRouter.createUrlTree.mockClear();
      }

      // Test with firstName but without income
      store.updateField('firstName', 'John');
      for (const step of steps) {
        const route = createMockRoute(step);
        executeGuard(route);
        expect(mockRouter.createUrlTree).toHaveBeenCalledWith([
          '/onboarding/income',
        ]);
        mockRouter.createUrlTree.mockClear();
      }

      // Test with both required fields
      store.updateField('monthlyIncome', 5000);
      for (const step of steps) {
        const route = createMockRoute(step);
        const result = executeGuard(route);
        expect(result).toBe(true);
      }
    });
  });

  describe('Registration Step Validation', () => {
    it('should redirect to personal-info when accessing registration without firstName', () => {
      const route = createMockRoute('registration');

      executeGuard(route);

      expect(mockRouter.createUrlTree).toHaveBeenCalledWith([
        '/onboarding/personal-info',
      ]);
    });

    it('should redirect to income when accessing registration with firstName but without monthlyIncome', () => {
      store.updateField('firstName', 'John');
      const route = createMockRoute('registration');

      executeGuard(route);

      expect(mockRouter.createUrlTree).toHaveBeenCalledWith([
        '/onboarding/income',
      ]);
    });

    it('should allow access to registration when all required data is provided', () => {
      store.updateField('firstName', 'John');
      store.updateField('monthlyIncome', 5000);
      const route = createMockRoute('registration');

      const result = executeGuard(route);

      expect(result).toBe(true);
    });
  });

  describe('Unknown Routes', () => {
    it('should allow access to unknown routes', () => {
      const route = createMockRoute('unknown-step');

      const result = executeGuard(route);

      expect(result).toBe(true);
    });

    it('should handle routes without routeConfig gracefully', () => {
      const route = {} as ActivatedRouteSnapshot;

      const result = executeGuard(route);

      expect(result).toBe(true);
    });
  });
});
