import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ProductTourService, type TourPageId } from './product-tour.service';
import { AuthStore } from '@core/auth';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import type { Config, DriveStep, Driver } from 'driver.js';

const driverMocks = vi.hoisted(() => {
  const instance = {
    setConfig: vi.fn(),
    setSteps: vi.fn(),
    drive: vi.fn(),
    destroy: vi.fn(),
    isLastStep: vi.fn(),
    moveNext: vi.fn(),
  };

  return {
    factory: vi.fn(() => instance),
    instance,
  };
});

vi.mock('driver.js', () => ({
  driver: driverMocks.factory,
}));

/**
 * Generate a tour storage key for testing.
 * Mirrors the internal logic of ProductTourService.
 */
function getTourKey(tourId: string): string {
  return `pulpe-tour-${tourId}`;
}

/**
 * Helper to set a versioned storage value for tests.
 */
function setVersionedValue(key: string, value: string): void {
  const entry = {
    version: 1,
    data: value,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(key, JSON.stringify(entry));
}

function getStoredTourState(tourId: string): string | null {
  const raw = localStorage.getItem(getTourKey(tourId));
  if (!raw) return null;

  return JSON.parse(raw).data as string;
}

function getDriverConfig(): Config {
  return driverMocks.instance.setConfig.mock.calls.at(-1)![0] as Config;
}

function callDriverHook(
  hook: Config['onNextClick'] | Config['onDestroyed'],
  step: DriveStep,
): void {
  const config = getDriverConfig();
  hook?.(undefined, step, {
    config,
    state: {},
    driver: driverMocks.instance as unknown as Driver,
  });
}

describe('ProductTourService', () => {
  let service: ProductTourService;
  let mockCurrentUser: { id: string } | null;

  beforeEach(() => {
    localStorage.clear();
    document.body.replaceChildren();
    vi.clearAllMocks();
    mockCurrentUser = { id: 'test-user-123' };

    const mockAuthStore = {
      user: () => mockCurrentUser,
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
        ProductTourService,
        { provide: AuthStore, useValue: mockAuthStore },
      ],
    });

    service = TestBed.inject(ProductTourService);
  });

  afterEach(() => {
    service.cancelActiveTour();
    localStorage.clear();
    document.body.replaceChildren();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('hasSeenIntro', () => {
    it('should return false when intro has not been seen', () => {
      expect(service.hasSeenIntro()).toBe(false);
    });

    it('should return true when intro has been seen', () => {
      setVersionedValue(getTourKey('intro'), 'true');

      expect(service.hasSeenIntro()).toBe(true);
    });

    it.each(['completed', 'dismissed'])(
      'should treat %s as a seen intro',
      (state) => {
        setVersionedValue(getTourKey('intro'), state);

        expect(service.hasSeenIntro()).toBe(true);
      },
    );

    it('should return false for unknown values', () => {
      setVersionedValue(getTourKey('intro'), 'false');

      expect(service.hasSeenIntro()).toBe(false);
    });
  });

  describe('hasSeenPageTour', () => {
    const testCases: TourPageId[] = [
      'dashboard',
      'budget-list',
      'budget-details',
      'templates-list',
      'savings-goals',
    ];

    testCases.forEach((pageId) => {
      it(`should return false when ${pageId} tour has not been seen`, () => {
        expect(service.hasSeenPageTour(pageId)).toBe(false);
      });

      it(`should return true when ${pageId} tour has been seen`, () => {
        setVersionedValue(getTourKey(pageId), 'true');

        expect(service.hasSeenPageTour(pageId)).toBe(true);
      });
    });
  });

  describe('resetAllTours', () => {
    it('should clear all tour keys from localStorage', () => {
      // GIVEN: All tours have been seen
      const tourIds = [
        'intro',
        'dashboard',
        'budget-list',
        'budget-details',
        'templates-list',
        'savings-goals',
      ];
      tourIds.forEach((tourId) => {
        setVersionedValue(getTourKey(tourId), 'true');
      });

      expect(service.hasSeenIntro()).toBe(true);
      expect(service.hasSeenPageTour('dashboard')).toBe(true);

      // WHEN: Reset all tours
      service.resetAllTours();

      // THEN: All tour states are cleared
      expect(service.hasSeenIntro()).toBe(false);
      expect(service.hasSeenPageTour('dashboard')).toBe(false);
      expect(service.hasSeenPageTour('budget-list')).toBe(false);
      expect(service.hasSeenPageTour('budget-details')).toBe(false);
      expect(service.hasSeenPageTour('templates-list')).toBe(false);
      expect(service.hasSeenPageTour('savings-goals')).toBe(false);
    });

    it('should handle being called when no tours have been seen', () => {
      // WHEN: Reset is called with no tours seen
      service.resetAllTours();

      // THEN: No error occurs
      expect(service.hasSeenIntro()).toBe(false);
    });
  });

  describe('device-scoped storage keys', () => {
    it('should store tour state with device-scoped key', () => {
      // GIVEN: Tour has not been seen
      expect(service.hasSeenIntro()).toBe(false);

      // WHEN: Tour is completed (simulated by setting localStorage)
      setVersionedValue(getTourKey('intro'), 'true');

      // THEN: Tour is marked as seen with device-scoped key
      expect(service.hasSeenIntro()).toBe(true);
      const stored = JSON.parse(localStorage.getItem('pulpe-tour-intro')!);
      expect(stored.data).toBe('true');
    });
  });

  describe('isAuthenticated', () => {
    it('should return true when user is authenticated', () => {
      expect(service.isAuthenticated()).toBe(true);
    });

    it('should return false when user is not authenticated', () => {
      mockCurrentUser = null;

      expect(service.isAuthenticated()).toBe(false);
    });
  });

  describe('behavior when not authenticated', () => {
    it('should still return tour state from device storage', () => {
      setVersionedValue(getTourKey('intro'), 'true');
      mockCurrentUser = null;

      // Tours are device-scoped, so state is still readable
      expect(service.hasSeenIntro()).toBe(true);
    });

    it('should not start tour when not ready', () => {
      mockCurrentUser = null;

      // Tours don't start when not authenticated (isReady check)
      expect(() => service.startPageTour('dashboard')).not.toThrow();
    });
  });

  describe('startPageTour', () => {
    it('should not throw when called with valid pageId', () => {
      expect(() => service.startPageTour('dashboard')).not.toThrow();
    });

    it('should prevent concurrent tours (second call is ignored)', () => {
      setVersionedValue(getTourKey('intro'), 'true');
      const hero = document.createElement('div');
      hero.dataset['tour'] = 'dashboard-hero';
      document.body.append(hero);

      service.startPageTour('dashboard');
      service.startPageTour('budget-list');

      expect(driverMocks.factory).toHaveBeenCalledOnce();
    });

    it('waits for the first page target and removes missing later targets', async () => {
      setVersionedValue(getTourKey('intro'), 'true');

      service.startPageTour('dashboard');

      expect(driverMocks.factory).not.toHaveBeenCalled();

      const hero = document.createElement('div');
      hero.dataset['tour'] = 'dashboard-hero';
      document.body.append(hero);
      await vi.waitFor(() =>
        expect(driverMocks.instance.drive).toHaveBeenCalledOnce(),
      );

      const steps = driverMocks.instance.setSteps.mock.calls[0]![0];
      expect(steps).toHaveLength(1);
      expect(
        steps.every(
          (step: { element?: string }) =>
            typeof step.element !== 'string' ||
            document.querySelector(step.element),
        ),
      ).toBe(true);
    });

    it('does not start or mark a tour after the target timeout', () => {
      vi.useFakeTimers();

      service.startPageTour('dashboard');
      vi.advanceTimersByTime(10_000);

      expect(driverMocks.factory).not.toHaveBeenCalled();
      expect(service.hasSeenIntro()).toBe(false);
      expect(service.hasSeenPageTour('dashboard')).toBe(false);
    });

    it('replaces a pending tour with the latest page request', async () => {
      setVersionedValue(getTourKey('intro'), 'true');

      service.startPageTour('dashboard');
      service.startPageTour('budget-list');

      const dashboardHero = document.createElement('div');
      dashboardHero.dataset['tour'] = 'dashboard-hero';
      document.body.append(dashboardHero);
      await Promise.resolve();
      expect(driverMocks.factory).not.toHaveBeenCalled();

      const calendar = document.createElement('div');
      calendar.dataset['tour'] = 'calendar-grid';
      document.body.append(calendar);
      await vi.waitFor(() =>
        expect(driverMocks.instance.drive).toHaveBeenCalledOnce(),
      );
    });

    it('does not start a pending tour after cancellation', async () => {
      setVersionedValue(getTourKey('intro'), 'true');

      service.startPageTour('dashboard');
      service.cancelActiveTour();

      const hero = document.createElement('div');
      hero.dataset['tour'] = 'dashboard-hero';
      document.body.append(hero);
      await Promise.resolve();

      expect(driverMocks.factory).not.toHaveBeenCalled();
      expect(service.hasSeenPageTour('dashboard')).toBe(false);
    });

    it('keeps only the template list and add action', () => {
      document.body.innerHTML = `
        <div data-tour="templates-list"></div>
        <button data-tour="template-counter"></button>
        <button data-tour="create-template"></button>
      `;

      service.startPageTour('templates-list');

      const steps = driverMocks.instance.setSteps.mock.calls[0]![0];
      expect(steps.map((step: { element?: string }) => step.element)).toEqual([
        '[data-tour="templates-list"]',
        '[data-tour="create-template"]',
      ]);
    });

    it('targets the always-present add budget line FAB', () => {
      document.body.innerHTML = `
        <div data-tour="financial-overview"></div>
        <div data-tour="budget-table"></div>
        <button data-testid="add-budget-line-fab"></button>
      `;

      service.startPageTour('budget-details');

      const steps = driverMocks.instance.setSteps.mock.calls[0]![0];
      expect(steps.at(-1)?.element).toBe('[data-testid="add-budget-line-fab"]');
    });

    it('disables animation when reduced motion is preferred', () => {
      vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
      setVersionedValue(getTourKey('intro'), 'true');
      document.body.innerHTML = `
        <div data-tour="dashboard-hero"></div>
        <div data-tour="dashboard-lists"></div>
        <button data-tour="add-transaction-fab"></button>
      `;

      service.startPageTour('dashboard');

      expect(driverMocks.instance.setConfig).toHaveBeenCalledWith(
        expect.objectContaining({ animate: false }),
      );
    });

    it('does not prepend global onboarding to contextual page help', () => {
      document.body.innerHTML = `
        <div data-tour="templates-list"></div>
        <button data-tour="create-template"></button>
      `;

      service.startPageTour('templates-list');

      const steps = driverMocks.instance.setSteps.mock.calls[0]![0];
      expect(steps).toHaveLength(2);
      expect(steps.every((step: DriveStep) => !!step.element)).toBe(true);
    });

    it('uses translated controls and explains pointing statuses', () => {
      document.body.innerHTML = `
        <div data-tour="dashboard-hero"></div>
        <div data-tour="dashboard-lists"></div>
        <nav data-tour="navigation"></nav>
      `;

      service.startPageTour('dashboard');

      const config = getDriverConfig();
      const steps = driverMocks.instance.setSteps.mock.calls[0]![0];
      const renderedTour = JSON.stringify({ config, steps });
      expect(config).toMatchObject({
        progressText: 'Étape {{current}} sur {{total}}',
        nextBtnText: 'Suivant',
        prevBtnText: 'Précédent',
        doneBtnText: 'Terminer',
      });
      expect(renderedTour).toContain('Pointé');
      expect(renderedTour).toContain('À pointer');
      expect(renderedTour).not.toMatch(/productTour\./);
    });

    it('explains the recurrent and planned budget line vocabulary', () => {
      document.body.innerHTML = `
        <div data-tour="financial-overview"></div>
        <div data-tour="budget-table"></div>
        <button data-testid="add-budget-line-fab"></button>
      `;

      service.startPageTour('budget-details');

      const steps = driverMocks.instance.setSteps.mock.calls[0]![0];
      const renderedSteps = JSON.stringify(steps);
      expect(renderedSteps).toContain('Récurrent');
      expect(renderedSteps).toContain('Prévu');
      expect(renderedSteps).not.toMatch(/productTour\./);
    });
  });

  describe('startFirstRunTour', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div data-tour="dashboard-hero"></div>
        <div data-tour="dashboard-lists"></div>
        <nav data-tour="navigation"></nav>
      `;
    });

    it('starts one short orientation from the dashboard', () => {
      service.startFirstRunTour();

      const steps = driverMocks.instance.setSteps.mock.calls[0]![0];
      expect(steps.map((step: DriveStep) => step.element)).toEqual([
        '[data-tour="dashboard-hero"]',
        '[data-tour="dashboard-lists"]',
        '[data-tour="navigation"]',
      ]);
    });

    it('does not relaunch after the user dismissed it', () => {
      setVersionedValue(getTourKey('intro'), 'dismissed');

      service.startFirstRunTour();

      expect(driverMocks.factory).not.toHaveBeenCalled();
    });

    it('stores dismissal separately from completion', () => {
      service.startFirstRunTour();

      const config = getDriverConfig();
      const steps = driverMocks.instance.setSteps.mock.calls[0]![0];
      callDriverHook(config.onDestroyed, steps[0]);

      expect(getStoredTourState('intro')).toBe('dismissed');
      expect(service.hasSeenIntro()).toBe(true);
    });

    it('marks completion only after advancing from the last step', () => {
      service.startFirstRunTour();

      const config = getDriverConfig();
      const steps = driverMocks.instance.setSteps.mock.calls[0]![0];

      driverMocks.instance.isLastStep.mockReturnValue(false);
      callDriverHook(config.onNextClick, steps[0]);
      expect(driverMocks.instance.moveNext).toHaveBeenCalledOnce();
      expect(getStoredTourState('intro')).toBeNull();

      driverMocks.instance.isLastStep.mockReturnValue(true);
      callDriverHook(config.onNextClick, steps.at(-1));
      callDriverHook(config.onDestroyed, steps.at(-1));

      expect(driverMocks.instance.destroy).toHaveBeenCalledOnce();
      expect(getStoredTourState('intro')).toBe('completed');
    });
  });

  describe('cancelActiveTour', () => {
    it('should not throw when no tour is active', () => {
      expect(() => service.cancelActiveTour()).not.toThrow();
    });

    it('should not throw when a tour is active', () => {
      service.startPageTour('dashboard');

      expect(() => service.cancelActiveTour()).not.toThrow();
    });
  });
});
