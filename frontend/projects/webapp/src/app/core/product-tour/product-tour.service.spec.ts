import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import {
  ProductTourService,
  TOUR_STORAGE_KEYS,
  type TourPageId,
} from './product-tour.service';

describe('ProductTourService', () => {
  let service: ProductTourService;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), ProductTourService],
    });

    service = TestBed.inject(ProductTourService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('hasSeenIntro', () => {
    it('should return false when intro has not been seen', () => {
      expect(service.hasSeenIntro()).toBe(false);
    });

    it('should return true when intro has been seen', () => {
      localStorage.setItem(TOUR_STORAGE_KEYS.intro, 'true');

      expect(service.hasSeenIntro()).toBe(true);
    });

    it('should return false for non-true values', () => {
      localStorage.setItem(TOUR_STORAGE_KEYS.intro, 'false');

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
        localStorage.setItem(TOUR_STORAGE_KEYS[pageId], 'true');

        expect(service.hasSeenPageTour(pageId)).toBe(true);
      });
    });
  });

  describe('resetAllTours', () => {
    it('should clear all tour keys from localStorage', () => {
      // GIVEN: All tours have been seen
      Object.values(TOUR_STORAGE_KEYS).forEach((key) => {
        localStorage.setItem(key, 'true');
      });

      // Verify setup
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

    it('should also clear legacy tour key', () => {
      // GIVEN: Legacy key exists
      localStorage.setItem('pulpe_tour_completed', 'true');

      // WHEN: Reset all tours
      service.resetAllTours();

      // THEN: Legacy key is also cleared
      expect(localStorage.getItem('pulpe_tour_completed')).toBeNull();
    });

    it('should handle being called when no tours have been seen', () => {
      // WHEN: Reset is called with no tours seen
      service.resetAllTours();

      // THEN: No error occurs
      expect(service.hasSeenIntro()).toBe(false);
    });
  });

  describe('TOUR_STORAGE_KEYS', () => {
    it('should have correct key format for intro', () => {
      expect(TOUR_STORAGE_KEYS.intro).toBe('pulpe_tour_intro');
    });

    it('should have correct key format for page tours', () => {
      expect(TOUR_STORAGE_KEYS['current-month']).toBe(
        'pulpe_tour_current-month',
      );
      expect(TOUR_STORAGE_KEYS['budget-list']).toBe('pulpe_tour_budget-list');
      expect(TOUR_STORAGE_KEYS['budget-details']).toBe(
        'pulpe_tour_budget-details',
      );
      expect(TOUR_STORAGE_KEYS['templates-list']).toBe(
        'pulpe_tour_templates-list',
      );
    });
  });

  describe('startPageTour', () => {
    it('should not throw when called with valid pageId', () => {
      expect(() => service.startPageTour('current-month')).not.toThrow();
    });
  });
});
