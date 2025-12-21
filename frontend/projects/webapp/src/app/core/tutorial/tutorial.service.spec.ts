import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { Router } from '@angular/router';
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
  let mockRouter: {
    url: string;
    navigate: ReturnType<typeof vi.fn>;
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
   * Creates a fresh mock Router
   * Default URL matches current-month so tours don't trigger navigation
   */
  function createMockRouter() {
    return {
      url: '/app/current-month',
      navigate: vi.fn().mockResolvedValue(true),
    };
  }

  /**
   * Creates a new TutorialService instance with fresh mocks
   */
  function createService() {
    mockShepherdService = createMockShepherdService();
    mockLogger = createMockLogger();
    mockAnalyticsService = createMockAnalyticsService();
    mockRouter = createMockRouter();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        TutorialService,
        { provide: ShepherdService, useValue: mockShepherdService },
        { provide: Logger, useValue: mockLogger },
        { provide: AnalyticsService, useValue: mockAnalyticsService },
        { provide: Router, useValue: mockRouter },
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
    });

    it('should load persisted state from localStorage', () => {
      // Arrange: Set up localStorage before creating service
      const persistedState = {
        version: 1,
        completedTours: ['dashboard-welcome'],
        skippedTours: ['templates-intro'],
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState));

      // Act: Create new service instance
      const newService = createService();

      // Assert
      expect(newService.state().completedTours).toContain('dashboard-welcome');
      expect(newService.state().skippedTours).toContain('templates-intro');
    });

    it('should always initialize with isActive=false regardless of persisted state', () => {
      // Arrange: Persist a state with isActive=true
      const persistedState = {
        version: 1,
        isActive: true,
        currentTour: 'dashboard-welcome',
        completedTours: [],
        skippedTours: [],
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
        version: 1,
        completedTours: ['dashboard-welcome', 'invalid-tour-id'],
        skippedTours: ['another-invalid'],
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
    it('should start a tour when valid tourId is provided', async () => {
      // Act
      await service.startTour('dashboard-welcome');

      // Assert
      expect(mockShepherdService.addSteps).toHaveBeenCalled();
      expect(mockShepherdService.start).toHaveBeenCalled();
      expect(service.state().isActive).toBe(true);
      expect(service.state().currentTour).toBe('dashboard-welcome');
    });

    it('should not start a tour that has already been completed', async () => {
      // Arrange: Mark tour as completed
      const persistedState = {
        version: 1,
        completedTours: ['dashboard-welcome'],
        skippedTours: [],
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState));
      const newService = createService();

      // Act
      await newService.startTour('dashboard-welcome');

      // Assert
      expect(mockShepherdService.addSteps).not.toHaveBeenCalled();
      expect(newService.state().isActive).toBe(false);
    });

    it('should not start a tour when tourId does not exist', async () => {
      // Act
      await service.startTour('non-existent-tour' as TourId);

      // Assert
      expect(mockShepherdService.addSteps).not.toHaveBeenCalled();
      expect(service.state().isActive).toBe(false);
    });

    it('should register event listeners after adding steps', async () => {
      // Act
      await service.startTour('dashboard-welcome');

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

    it('should handle errors during tour start gracefully', async () => {
      // Arrange
      mockShepherdService.addSteps.mockImplementation(() => {
        throw new Error('Shepherd error');
      });

      // Act
      await service.startTour('dashboard-welcome');

      // Assert
      expect(service.state().isActive).toBe(false);
      expect(service.state().currentTour).toBeNull();
    });
  });

  describe('event handling', () => {
    it('should mark tour as completed when complete event fires', async () => {
      // Arrange
      let completeHandler: (() => void) | undefined;
      mockShepherdService.tourObject = {
        on: vi.fn((event: string, handler: () => void) => {
          if (event === 'complete') completeHandler = handler;
        }),
        off: vi.fn(),
      };

      await service.startTour('dashboard-welcome');

      // Act
      completeHandler?.();

      // Assert
      expect(service.state().completedTours).toContain('dashboard-welcome');
      expect(service.state().isActive).toBe(false);
      expect(service.state().currentTour).toBeNull();
    });

    it('should mark tour as skipped when cancel event fires', async () => {
      // Arrange
      let cancelHandler: (() => void) | undefined;
      mockShepherdService.tourObject = {
        on: vi.fn((event: string, handler: () => void) => {
          if (event === 'cancel') cancelHandler = handler;
        }),
        off: vi.fn(),
      };

      await service.startTour('dashboard-welcome');

      // Act
      cancelHandler?.();

      // Assert
      expect(service.state().skippedTours).toContain('dashboard-welcome');
      expect(service.state().isActive).toBe(false);
      expect(service.state().currentTour).toBeNull();
    });

    it('should remove existing listeners before adding new ones', async () => {
      // Act
      await service.startTour('dashboard-welcome');

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

    it('should persist completion to localStorage when tour completes', async () => {
      // Arrange
      let completeHandler: (() => void) | undefined;
      mockShepherdService.tourObject = {
        on: vi.fn((event: string, handler: () => void) => {
          if (event === 'complete') completeHandler = handler;
        }),
        off: vi.fn(),
      };

      await service.startTour('dashboard-welcome');

      // Act
      completeHandler?.();

      // Assert
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      expect(saved.completedTours).toContain('dashboard-welcome');
    });
  });

  describe('analytics tracking', () => {
    it('should track tutorial_started event when tour starts', async () => {
      // Act
      await service.startTour('dashboard-welcome');

      // Assert
      expect(mockAnalyticsService.captureEvent).toHaveBeenCalledWith(
        'tutorial_started',
        expect.objectContaining({
          tourId: 'dashboard-welcome',
          timestamp: expect.any(Number),
        }),
      );
    });

    it('should track tutorial_completed event when tour completes', async () => {
      // Arrange
      let completeHandler: (() => void) | undefined;
      mockShepherdService.tourObject = {
        on: vi.fn((event: string, handler: () => void) => {
          if (event === 'complete') completeHandler = handler;
        }),
        off: vi.fn(),
      };

      await service.startTour('dashboard-welcome');
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

    it('should track tutorial_cancelled event when tour is cancelled', async () => {
      // Arrange
      let cancelHandler: (() => void) | undefined;
      mockShepherdService.tourObject = {
        on: vi.fn((event: string, handler: () => void) => {
          if (event === 'cancel') cancelHandler = handler;
        }),
        off: vi.fn(),
      };

      await service.startTour('dashboard-welcome');
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

    it('should continue tour operation when analytics fails', async () => {
      // Arrange
      mockAnalyticsService.captureEvent.mockImplementation(() => {
        throw new Error('PostHog unavailable');
      });

      // Act
      await service.startTour('dashboard-welcome');

      // Assert
      expect(service.state().isActive).toBe(true);
      expect(service.state().currentTour).toBe('dashboard-welcome');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to track event',
        expect.any(Error),
      );
    });
  });

  describe('concurrent tour prevention', () => {
    it('should not start a second tour while one is already active', async () => {
      // Arrange: Start first tour
      await service.startTour('dashboard-welcome');
      expect(service.state().isActive).toBe(true);

      // Reset mocks to verify no new calls
      mockShepherdService.addSteps.mockClear();
      mockShepherdService.start.mockClear();

      // Act: Try to start another tour
      await service.startTour('templates-intro');

      // Assert: Second tour should not start
      expect(mockShepherdService.addSteps).not.toHaveBeenCalled();
      expect(mockShepherdService.start).not.toHaveBeenCalled();
      expect(service.state().currentTour).toBe('dashboard-welcome');
    });

    it('should allow starting new tour after previous one completes', async () => {
      // Arrange: Start and complete first tour
      let completeHandler: (() => void) | undefined;
      mockShepherdService.tourObject = {
        on: vi.fn((event: string, handler: () => void) => {
          if (event === 'complete') completeHandler = handler;
        }),
        off: vi.fn(),
      };

      await service.startTour('dashboard-welcome');
      completeHandler?.();

      // Reset mocks
      mockShepherdService.addSteps.mockClear();
      mockShepherdService.start.mockClear();

      // Act: Start new tour (budget-management has no targetRoute, so no navigation/render wait)
      await service.startTour('budget-management');

      // Assert: New tour should start
      expect(mockShepherdService.addSteps).toHaveBeenCalled();
      expect(service.state().currentTour).toBe('budget-management');
    });

    it('should allow starting new tour after previous one is cancelled', async () => {
      // Arrange: Start and cancel first tour
      let cancelHandler: (() => void) | undefined;
      mockShepherdService.tourObject = {
        on: vi.fn((event: string, handler: () => void) => {
          if (event === 'cancel') cancelHandler = handler;
        }),
        off: vi.fn(),
      };

      await service.startTour('dashboard-welcome');
      cancelHandler?.();

      // Reset mocks
      mockShepherdService.addSteps.mockClear();
      mockShepherdService.start.mockClear();

      // Act: Start new tour (budget-management has no targetRoute, avoids navigation issues)
      await service.startTour('budget-management');

      // Assert: New tour should start
      expect(mockShepherdService.addSteps).toHaveBeenCalled();
      expect(service.state().currentTour).toBe('budget-management');
    });
  });

  describe('force restart', () => {
    it('should bypass hasSeenTour check when force option is true', async () => {
      // Arrange: Mark tour as both completed and another as skipped
      const persistedState = {
        version: 1,
        completedTours: ['dashboard-welcome'],
        skippedTours: ['templates-intro'],
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState));
      const newService = createService();

      // Act: Force restart a completed tour
      await newService.startTour('dashboard-welcome', { force: true });

      // Assert: Tour starts despite being in completedTours
      expect(newService.state().isActive).toBe(true);
      expect(newService.state().currentTour).toBe('dashboard-welcome');
    });
  });
});
