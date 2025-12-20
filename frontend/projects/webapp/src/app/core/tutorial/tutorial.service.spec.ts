import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ShepherdService } from 'angular-shepherd';
import { AnalyticsService } from '../analytics/analytics';
import { Logger } from '../logging/logger';
import { TutorialService } from './tutorial.service';
import { DEFAULT_TUTORIAL_STATE } from './tutorial.types';
import type { TourId } from './tutorial.types';

describe('TutorialService', () => {
  let service: TutorialService;
  let mockShepherdService: {
    defaultStepOptions: unknown;
    modal: boolean;
    confirmCancel: boolean;
    tourObject: {
      on: ReturnType<typeof vi.fn>;
      off: ReturnType<typeof vi.fn>;
    } | null;
    addSteps: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
  };
  let mockLogger: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
  let mockAnalyticsService: {
    captureEvent: ReturnType<typeof vi.fn>;
  };

  const STORAGE_KEY = 'pulpe-tutorial-state';

  /**
   * Creates a fresh mock ShepherdService
   */
  function createMockShepherdService() {
    return {
      defaultStepOptions: null as unknown,
      modal: false,
      confirmCancel: false,
      tourObject: {
        on: vi.fn(),
        off: vi.fn(),
      },
      addSteps: vi.fn(),
      start: vi.fn(),
      cancel: vi.fn(),
    };
  }

  /**
   * Creates a fresh mock Logger
   */
  function createMockLogger() {
    return {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
  }

  /**
   * Creates a fresh mock AnalyticsService
   */
  function createMockAnalyticsService() {
    return {
      captureEvent: vi.fn(),
    };
  }

  /**
   * Creates a new TutorialService instance with fresh mocks
   */
  function createService() {
    mockShepherdService = createMockShepherdService();
    mockLogger = createMockLogger();
    mockAnalyticsService = createMockAnalyticsService();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        TutorialService,
        { provide: ShepherdService, useValue: mockShepherdService },
        { provide: Logger, useValue: mockLogger },
        { provide: AnalyticsService, useValue: mockAnalyticsService },
      ],
    });

    return TestBed.inject(TutorialService);
  }

  beforeEach(() => {
    localStorage.clear();
    service = createService();
  });

  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default state when localStorage is empty', () => {
      const state = service.state();

      expect(state.isActive).toBe(false);
      expect(state.currentTour).toBeNull();
      expect(state.completedTours).toEqual([]);
      expect(state.skippedTours).toEqual([]);
      expect(state.preferences.enabled).toBe(true);
      expect(state.preferences.autoStart).toBe(true);
    });

    it('should load persisted state from localStorage', () => {
      // Arrange: Set up localStorage before creating service
      const persistedState = {
        completedTours: ['dashboard-welcome'],
        skippedTours: ['add-transaction'],
        preferences: { enabled: true, autoStart: false },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState));

      // Act: Create new service instance
      const newService = createService();

      // Assert
      expect(newService.state().completedTours).toContain('dashboard-welcome');
      expect(newService.state().skippedTours).toContain('add-transaction');
      expect(newService.state().preferences.autoStart).toBe(false);
    });

    it('should always initialize with isActive=false regardless of persisted state', () => {
      // Arrange: Persist a state with isActive=true
      const persistedState = {
        isActive: true,
        currentTour: 'dashboard-welcome',
        completedTours: [],
        skippedTours: [],
        preferences: { enabled: true, autoStart: true },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState));

      // Act
      const newService = createService();

      // Assert
      expect(newService.state().isActive).toBe(false);
      expect(newService.state().currentTour).toBeNull();
    });

    it('should handle corrupted localStorage data gracefully', () => {
      // Arrange
      localStorage.setItem(STORAGE_KEY, 'invalid-json');

      // Act
      const newService = createService();

      // Assert
      expect(newService.state()).toEqual(DEFAULT_TUTORIAL_STATE);
    });

    it('should filter out invalid tour IDs from persisted state', () => {
      // Arrange: Include invalid tour ID
      const persistedState = {
        completedTours: ['dashboard-welcome', 'invalid-tour-id'],
        skippedTours: ['another-invalid'],
        preferences: { enabled: true, autoStart: true },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState));

      // Act
      const newService = createService();

      // Assert
      expect(newService.state().completedTours).toEqual(['dashboard-welcome']);
      expect(newService.state().skippedTours).toEqual([]);
    });
  });

  describe('startTour', () => {
    it('should start a tour when valid tourId is provided', () => {
      // Act
      service.startTour('dashboard-welcome');

      // Assert
      expect(mockShepherdService.addSteps).toHaveBeenCalled();
      expect(mockShepherdService.start).toHaveBeenCalled();
      expect(service.state().isActive).toBe(true);
      expect(service.state().currentTour).toBe('dashboard-welcome');
    });

    it('should not start a tour that has already been completed', () => {
      // Arrange: Mark tour as completed
      const persistedState = {
        completedTours: ['dashboard-welcome'],
        skippedTours: [],
        preferences: { enabled: true, autoStart: true },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState));
      const newService = createService();

      // Act
      newService.startTour('dashboard-welcome');

      // Assert
      expect(mockShepherdService.addSteps).not.toHaveBeenCalled();
      expect(newService.state().isActive).toBe(false);
    });

    it('should start a completed tour when force option is true', () => {
      // Arrange: Mark tour as completed
      const persistedState = {
        completedTours: ['dashboard-welcome'],
        skippedTours: [],
        preferences: { enabled: true, autoStart: true },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState));
      const newService = createService();

      // Act
      newService.startTour('dashboard-welcome', { force: true });

      // Assert
      expect(mockShepherdService.addSteps).toHaveBeenCalled();
      expect(mockShepherdService.start).toHaveBeenCalled();
      expect(newService.state().isActive).toBe(true);
    });

    it('should not start any tour when tutorials are disabled', () => {
      // Arrange
      service.updatePreferences({ enabled: false });

      // Act
      service.startTour('dashboard-welcome');

      // Assert
      expect(mockShepherdService.addSteps).not.toHaveBeenCalled();
      expect(service.state().isActive).toBe(false);
    });

    it('should start tour when disabled but force is true', () => {
      // Arrange
      service.updatePreferences({ enabled: false });

      // Act
      service.startTour('dashboard-welcome', { force: true });

      // Assert
      expect(mockShepherdService.addSteps).toHaveBeenCalled();
      expect(service.state().isActive).toBe(true);
    });

    it('should not start a tour when tourId does not exist', () => {
      // Act
      service.startTour('non-existent-tour' as TourId);

      // Assert
      expect(mockShepherdService.addSteps).not.toHaveBeenCalled();
      expect(service.state().isActive).toBe(false);
    });

    it('should register event listeners after adding steps', () => {
      // Act
      service.startTour('dashboard-welcome');

      // Assert
      expect(mockShepherdService.tourObject?.on).toHaveBeenCalledWith(
        'complete',
        expect.any(Function),
      );
      expect(mockShepherdService.tourObject?.on).toHaveBeenCalledWith(
        'cancel',
        expect.any(Function),
      );
    });

    it('should handle errors during tour start gracefully', () => {
      // Arrange
      mockShepherdService.addSteps.mockImplementation(() => {
        throw new Error('Shepherd error');
      });

      // Act
      service.startTour('dashboard-welcome');

      // Assert
      expect(service.state().isActive).toBe(false);
      expect(service.state().currentTour).toBeNull();
    });
  });

  describe('cancelTour', () => {
    it('should cancel the active tour', () => {
      // Arrange
      service.startTour('dashboard-welcome');

      // Act
      service.cancelTour();

      // Assert
      expect(mockShepherdService.cancel).toHaveBeenCalled();
    });

    it('should not call cancel when no tour is active', () => {
      // Act
      service.cancelTour();

      // Assert
      expect(mockShepherdService.cancel).not.toHaveBeenCalled();
    });

    it('should handle errors during cancellation gracefully', () => {
      // Arrange
      service.startTour('dashboard-welcome');
      mockShepherdService.cancel.mockImplementation(() => {
        throw new Error('Cancel error');
      });

      // Act
      service.cancelTour();

      // Assert: State should be reset despite error
      expect(service.state().isActive).toBe(false);
      expect(service.state().currentTour).toBeNull();
    });
  });

  describe('hasCompletedTour', () => {
    it('should return true when tour is completed', () => {
      // Arrange
      const persistedState = {
        completedTours: ['dashboard-welcome'],
        skippedTours: [],
        preferences: { enabled: true, autoStart: true },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState));
      const newService = createService();

      // Assert
      expect(newService.hasCompletedTour('dashboard-welcome')).toBe(true);
    });

    it('should return false when tour is not completed', () => {
      expect(service.hasCompletedTour('dashboard-welcome')).toBe(false);
    });
  });

  describe('hasCompletedAnyTour', () => {
    it('should return true when at least one tour is completed', () => {
      // Arrange
      const persistedState = {
        completedTours: ['dashboard-welcome'],
        skippedTours: [],
        preferences: { enabled: true, autoStart: true },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState));
      const newService = createService();

      // Assert
      expect(newService.hasCompletedAnyTour()).toBe(true);
    });

    it('should return false when no tours are completed', () => {
      expect(service.hasCompletedAnyTour()).toBe(false);
    });
  });

  describe('resetAllTours', () => {
    it('should clear completedTours and skippedTours', () => {
      // Arrange
      const persistedState = {
        completedTours: ['dashboard-welcome', 'add-transaction'],
        skippedTours: ['templates-intro'],
        preferences: { enabled: true, autoStart: true },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState));
      const newService = createService();

      // Act
      newService.resetAllTours();

      // Assert
      expect(newService.state().completedTours).toEqual([]);
      expect(newService.state().skippedTours).toEqual([]);
    });

    it('should preserve user preferences during reset', () => {
      // Arrange
      service.updatePreferences({ enabled: false, autoStart: false });

      // Act
      service.resetAllTours();

      // Assert
      expect(service.state().preferences.enabled).toBe(false);
      expect(service.state().preferences.autoStart).toBe(false);
    });

    it('should persist reset state to localStorage', () => {
      // Arrange
      const persistedState = {
        completedTours: ['dashboard-welcome'],
        skippedTours: [],
        preferences: { enabled: true, autoStart: true },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState));
      const newService = createService();

      // Act
      newService.resetAllTours();

      // Assert
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      expect(saved.completedTours).toEqual([]);
      expect(saved.skippedTours).toEqual([]);
    });
  });

  describe('updatePreferences', () => {
    it('should merge partial preferences with existing ones', () => {
      // Act
      service.updatePreferences({ autoStart: false });

      // Assert
      expect(service.state().preferences.enabled).toBe(true); // unchanged
      expect(service.state().preferences.autoStart).toBe(false); // updated
    });

    it('should persist updated preferences to localStorage', () => {
      // Act
      service.updatePreferences({ enabled: false });

      // Assert
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      expect(saved.preferences.enabled).toBe(false);
    });
  });

  describe('getTour', () => {
    it('should return correct tour by ID', () => {
      const tour = service.getTour('dashboard-welcome');

      expect(tour).toBeDefined();
      expect(tour?.id).toBe('dashboard-welcome');
      expect(tour?.name).toBe('Découverte du tableau de bord');
    });

    it('should return undefined for non-existent tour ID', () => {
      const tour = service.getTour('non-existent' as TourId);

      expect(tour).toBeUndefined();
    });
  });

  describe('getAllTours', () => {
    it('should return all configured tours', () => {
      const tours = service.getAllTours();

      expect(tours).toHaveLength(4);
      expect(tours.map((t) => t.id)).toContain('dashboard-welcome');
      expect(tours.map((t) => t.id)).toContain('add-transaction');
      expect(tours.map((t) => t.id)).toContain('templates-intro');
      expect(tours.map((t) => t.id)).toContain('budget-management');
    });
  });

  describe('event handling', () => {
    it('should mark tour as completed when complete event fires', () => {
      // Arrange
      let completeHandler: (() => void) | undefined;
      mockShepherdService.tourObject = {
        on: vi.fn((event: string, handler: () => void) => {
          if (event === 'complete') completeHandler = handler;
        }),
        off: vi.fn(),
      };

      service.startTour('dashboard-welcome');

      // Act
      completeHandler?.();

      // Assert
      expect(service.state().completedTours).toContain('dashboard-welcome');
      expect(service.state().isActive).toBe(false);
      expect(service.state().currentTour).toBeNull();
    });

    it('should mark tour as skipped when cancel event fires', () => {
      // Arrange
      let cancelHandler: (() => void) | undefined;
      mockShepherdService.tourObject = {
        on: vi.fn((event: string, handler: () => void) => {
          if (event === 'cancel') cancelHandler = handler;
        }),
        off: vi.fn(),
      };

      service.startTour('dashboard-welcome');

      // Act
      cancelHandler?.();

      // Assert
      expect(service.state().skippedTours).toContain('dashboard-welcome');
      expect(service.state().isActive).toBe(false);
      expect(service.state().currentTour).toBeNull();
    });

    it('should remove existing listeners before adding new ones', () => {
      // Act
      service.startTour('dashboard-welcome');

      // Assert
      expect(mockShepherdService.tourObject?.off).toHaveBeenCalledWith(
        'complete',
      );
      expect(mockShepherdService.tourObject?.off).toHaveBeenCalledWith(
        'cancel',
      );

      // Verify off is called before on (check call order)
      const offCalls =
        mockShepherdService.tourObject?.off.mock.invocationCallOrder;
      const onCalls =
        mockShepherdService.tourObject?.on.mock.invocationCallOrder;
      expect(Math.max(...(offCalls ?? []))).toBeLessThan(
        Math.min(...(onCalls ?? [])),
      );
    });

    it('should persist completion to localStorage when tour completes', () => {
      // Arrange
      let completeHandler: (() => void) | undefined;
      mockShepherdService.tourObject = {
        on: vi.fn((event: string, handler: () => void) => {
          if (event === 'complete') completeHandler = handler;
        }),
        off: vi.fn(),
      };

      service.startTour('dashboard-welcome');

      // Act
      completeHandler?.();

      // Assert
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      expect(saved.completedTours).toContain('dashboard-welcome');
    });
  });

  describe('analytics tracking', () => {
    it('should track tutorial_started event when tour starts', () => {
      // Act
      service.startTour('dashboard-welcome');

      // Assert
      expect(mockAnalyticsService.captureEvent).toHaveBeenCalledWith(
        'tutorial_started',
        expect.objectContaining({
          tourId: 'dashboard-welcome',
          timestamp: expect.any(Number),
        }),
      );
    });

    it('should track tutorial_completed event when tour completes', () => {
      // Arrange
      let completeHandler: (() => void) | undefined;
      mockShepherdService.tourObject = {
        on: vi.fn((event: string, handler: () => void) => {
          if (event === 'complete') completeHandler = handler;
        }),
        off: vi.fn(),
      };

      service.startTour('dashboard-welcome');
      mockAnalyticsService.captureEvent.mockClear();

      // Act
      completeHandler?.();

      // Assert
      expect(mockAnalyticsService.captureEvent).toHaveBeenCalledWith(
        'tutorial_completed',
        expect.objectContaining({
          tourId: 'dashboard-welcome',
          timestamp: expect.any(Number),
        }),
      );
    });

    it('should track tutorial_cancelled event when tour is cancelled', () => {
      // Arrange
      let cancelHandler: (() => void) | undefined;
      mockShepherdService.tourObject = {
        on: vi.fn((event: string, handler: () => void) => {
          if (event === 'cancel') cancelHandler = handler;
        }),
        off: vi.fn(),
      };

      service.startTour('dashboard-welcome');
      mockAnalyticsService.captureEvent.mockClear();

      // Act
      cancelHandler?.();

      // Assert
      expect(mockAnalyticsService.captureEvent).toHaveBeenCalledWith(
        'tutorial_cancelled',
        expect.objectContaining({
          tourId: 'dashboard-welcome',
          timestamp: expect.any(Number),
        }),
      );
    });

    it('should continue tour operation when analytics fails', () => {
      // Arrange
      mockAnalyticsService.captureEvent.mockImplementation(() => {
        throw new Error('PostHog unavailable');
      });

      // Act
      service.startTour('dashboard-welcome');

      // Assert
      expect(service.state().isActive).toBe(true);
      expect(service.state().currentTour).toBe('dashboard-welcome');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to track event',
        expect.any(Error),
      );
    });
  });
});
