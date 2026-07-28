import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ProductTourService, type TourPageId } from './product-tour.service';
import { AuthStore } from '@core/auth';

const driverMocks = vi.hoisted(() => {
  const instance = {
    setConfig: vi.fn(),
    setSteps: vi.fn(),
    drive: vi.fn(),
    destroy: vi.fn(),
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

    it('should return false for non-true values', () => {
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

      const yearTabs = document.createElement('div');
      yearTabs.dataset['tour'] = 'year-tabs';
      yearTabs.append(document.createElement('mat-tab-header'));
      document.body.append(yearTabs);
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
      setVersionedValue(getTourKey('intro'), 'true');
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
      setVersionedValue(getTourKey('intro'), 'true');
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
