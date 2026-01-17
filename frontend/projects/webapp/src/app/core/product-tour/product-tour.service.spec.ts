import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ProductTourService, type TourPageId } from './product-tour.service';
import { AuthStateService } from '@core/auth';

const TEST_USER_ID = 'test-user-123';

/**
 * Generate a tour storage key for testing.
 * Mirrors the internal logic of ProductTourService.
 */
function getTourKey(
  tourId: string,
  userId: string | null = TEST_USER_ID,
): string {
  if (!userId) {
    return `pulpe-tour-${tourId}`;
  }
  return `pulpe-tour-${tourId}-${userId}`;
}

describe('ProductTourService', () => {
  let service: ProductTourService;
  let mockCurrentUser: { id: string } | null;

  beforeEach(() => {
    localStorage.clear();
    mockCurrentUser = { id: TEST_USER_ID };

    const mockAuthState = {
      user: () => mockCurrentUser,
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        ProductTourService,
        { provide: AuthStateService, useValue: mockAuthState },
      ],
    });

    service = TestBed.inject(ProductTourService);
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('hasSeenIntro', () => {
    it('should return false when intro has not been seen', () => {
      expect(service.hasSeenIntro()).toBe(false);
    });

    it('should return true when intro has been seen', () => {
      localStorage.setItem(getTourKey('intro'), 'true');

      expect(service.hasSeenIntro()).toBe(true);
    });

    it('should return false for non-true values', () => {
      localStorage.setItem(getTourKey('intro'), 'false');

      expect(service.hasSeenIntro()).toBe(false);
    });
  });

  describe('hasSeenPageTour', () => {
    const testCases: TourPageId[] = [
      'current-month',
      'budget-list',
      'budget-details',
      'templates-list',
    ];

    testCases.forEach((pageId) => {
      it(`should return false when ${pageId} tour has not been seen`, () => {
        expect(service.hasSeenPageTour(pageId)).toBe(false);
      });

      it(`should return true when ${pageId} tour has been seen`, () => {
        localStorage.setItem(getTourKey(pageId), 'true');

        expect(service.hasSeenPageTour(pageId)).toBe(true);
      });
    });
  });

  describe('resetAllTours', () => {
    it('should clear all tour keys from localStorage', () => {
      // GIVEN: All tours have been seen
      const tourIds = [
        'intro',
        'current-month',
        'budget-list',
        'budget-details',
        'templates-list',
      ];
      tourIds.forEach((tourId) => {
        localStorage.setItem(getTourKey(tourId), 'true');
      });

      expect(service.hasSeenIntro()).toBe(true);
      expect(service.hasSeenPageTour('current-month')).toBe(true);

      // WHEN: Reset all tours
      service.resetAllTours();

      // THEN: All tour states are cleared
      expect(service.hasSeenIntro()).toBe(false);
      expect(service.hasSeenPageTour('current-month')).toBe(false);
      expect(service.hasSeenPageTour('budget-list')).toBe(false);
      expect(service.hasSeenPageTour('budget-details')).toBe(false);
      expect(service.hasSeenPageTour('templates-list')).toBe(false);
    });

    it('should handle being called when no tours have been seen', () => {
      // WHEN: Reset is called with no tours seen
      service.resetAllTours();

      // THEN: No error occurs
      expect(service.hasSeenIntro()).toBe(false);
    });
  });

  describe('user-specific storage keys', () => {
    it('should store tour state with user-specific key', () => {
      // GIVEN: User has not seen intro
      expect(service.hasSeenIntro()).toBe(false);

      // WHEN: User completes intro tour (simulated by setting localStorage)
      localStorage.setItem(getTourKey('intro'), 'true');

      // THEN: Tour is marked as seen with user-specific key
      expect(service.hasSeenIntro()).toBe(true);
      expect(localStorage.getItem(`pulpe-tour-intro-${TEST_USER_ID}`)).toBe(
        'true',
      );
    });

    it('should not see tours completed by another user', () => {
      // GIVEN: Another user has completed the tour
      const otherUserId = 'other-user-456';
      localStorage.setItem(getTourKey('intro', otherUserId), 'true');

      // THEN: Current user should not see that tour as completed
      expect(service.hasSeenIntro()).toBe(false);
    });
  });

  describe('isReady', () => {
    it('should return true when user is authenticated', () => {
      expect(service.isReady()).toBe(true);
    });

    it('should return false when user is not authenticated', () => {
      mockCurrentUser = null;

      expect(service.isReady()).toBe(false);
    });
  });

  describe('graceful degradation when not authenticated', () => {
    it('should return true for hasSeenIntro when not ready (prevent tour)', () => {
      mockCurrentUser = null;

      expect(service.hasSeenIntro()).toBe(true);
    });

    it('should return true for hasSeenPageTour when not ready (prevent tour)', () => {
      mockCurrentUser = null;

      expect(service.hasSeenPageTour('current-month')).toBe(true);
    });

    it('should not start tour when not ready', () => {
      mockCurrentUser = null;

      expect(() => service.startPageTour('current-month')).not.toThrow();
    });

    it('should not reset tours when not ready', () => {
      localStorage.setItem(getTourKey('intro'), 'true');
      mockCurrentUser = null;

      service.resetAllTours();

      mockCurrentUser = { id: TEST_USER_ID };
      expect(service.hasSeenIntro()).toBe(true);
    });
  });

  describe('startPageTour', () => {
    it('should not throw when called with valid pageId', () => {
      expect(() => service.startPageTour('current-month')).not.toThrow();
    });

    it('should prevent concurrent tours (second call is ignored)', () => {
      // GIVEN: A tour is already running
      service.startPageTour('current-month');

      // WHEN: Another tour is started
      // THEN: No error occurs (call is silently ignored)
      expect(() => service.startPageTour('budget-list')).not.toThrow();
    });
  });

  describe('cancelActiveTour', () => {
    it('should not throw when no tour is active', () => {
      expect(() => service.cancelActiveTour()).not.toThrow();
    });

    it('should not throw when a tour is active', () => {
      service.startPageTour('current-month');

      expect(() => service.cancelActiveTour()).not.toThrow();
    });
  });
});
