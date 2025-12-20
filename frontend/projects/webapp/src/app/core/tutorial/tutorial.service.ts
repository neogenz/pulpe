import { inject, Injectable, signal } from '@angular/core';
import { ShepherdService } from 'angular-shepherd';
import { z } from 'zod';
import { AnalyticsService } from '../analytics/analytics';
import { Logger } from '../logging/logger';
import { ALL_TOURS, defaultStepOptions } from './tutorial-configs';
import type {
  TourId,
  TutorialEvent,
  TutorialState,
  TutorialTour,
} from './tutorial.types';
import { DEFAULT_TUTORIAL_STATE, TOUR_IDS } from './tutorial.types';

/**
 * Options for starting a tour
 */
export interface StartTourOptions {
  /** Force start even if tour was already completed */
  force?: boolean;
}

/**
 * Zod schema for validating localStorage data
 */
const TutorialStateSchema = z.object({
  completedTours: z.array(z.string()).default([]),
  skippedTours: z.array(z.string()).default([]),
  preferences: z
    .object({
      enabled: z.boolean().default(true),
      autoStart: z.boolean().default(true),
    })
    .default({}),
});

/**
 * Service for managing interactive tutorials using Shepherd.js
 *
 * Features:
 * - Start, stop, and manage tutorial tours
 * - Track user progress and preferences
 * - Persist completion state to localStorage
 * - Material Design 3 themed overlays
 */
@Injectable({
  providedIn: 'root',
})
export class TutorialService {
  readonly #shepherdService = inject(ShepherdService);
  readonly #logger = inject(Logger);
  readonly #analytics = inject(AnalyticsService);

  /**
   * Current tutorial state (reactive signal)
   */
  readonly #state = signal<TutorialState>(this.#loadState());

  /**
   * Exposed read-only state
   */
  readonly state = this.#state.asReadonly();

  constructor() {
    this.#initializeShepherd();
  }

  /**
   * Initialize Shepherd with default configuration
   */
  #initializeShepherd(): void {
    this.#shepherdService.defaultStepOptions = defaultStepOptions;
    this.#shepherdService.modal = true;
    this.#shepherdService.confirmCancel = false;
    // Note: Event listeners are registered in startTour() after addSteps()
    // because tourObject is only available after a tour is created
  }

  /**
   * Register event listeners on the current tour object
   * Must be called after addSteps() when tourObject exists
   */
  #registerTourEventListeners(): void {
    const tourObject = this.#shepherdService.tourObject;
    if (!tourObject) {
      this.#logger.error('Cannot register events: tourObject is null');
      return;
    }

    // Remove existing listeners to prevent duplicates when tour is restarted
    tourObject.off('complete');
    tourObject.off('cancel');

    tourObject.on('complete', () => {
      this.#handleTourComplete();
    });

    tourObject.on('cancel', () => {
      this.#handleTourCancel();
    });
  }

  /**
   * Start a specific tour by ID
   * @param tourId - The ID of the tour to start
   * @param options - Optional configuration (use force: true to replay completed tours)
   */
  startTour(tourId: TourId, options?: StartTourOptions): void {
    const tour = ALL_TOURS.find((t) => t.id === tourId);
    if (!tour) {
      this.#logger.warn('Tour not found', { tourId });
      return;
    }

    // Check if already completed (skip check if force is true)
    if (!options?.force && this.hasCompletedTour(tourId)) {
      this.#logger.info('Tour already completed', { tourId });
      return;
    }

    // Check if preferences allow auto-start (skip check if force is true)
    if (!options?.force && !this.#state().preferences.enabled) {
      this.#logger.info('Tutorials are disabled by user preference');
      return;
    }

    try {
      // Add steps first (creates the tourObject)
      this.#shepherdService.addSteps(tour.steps);

      // Register event listeners now that tourObject exists
      this.#registerTourEventListeners();

      // Start the tour
      this.#shepherdService.start();

      // Update state only after successful start
      this.#state.update((state) => ({
        ...state,
        isActive: true,
        currentTour: tourId,
      }));

      // Track event
      this.#trackEvent({
        tourId,
        action: 'started',
        timestamp: Date.now(),
      });
    } catch (error) {
      this.#logger.error('Failed to start tour', { tourId, error });
      // Reset state on failure
      this.#state.update((state) => ({
        ...state,
        isActive: false,
        currentTour: null,
      }));
    }
  }

  /**
   * Cancel the currently active tour
   */
  cancelTour(): void {
    if (!this.#state().isActive) {
      return;
    }

    try {
      this.#shepherdService.cancel();
    } catch (error) {
      this.#logger.error('Error during tour cancellation', error);
      // Force cleanup of state even if Shepherd fails
      this.#state.update((state) => ({
        ...state,
        isActive: false,
        currentTour: null,
      }));
    }
  }

  /**
   * Check if a specific tour has been completed
   */
  hasCompletedTour(tourId: TourId): boolean {
    return this.#state().completedTours.includes(tourId);
  }

  /**
   * Check if any tour has been completed (for first-time user detection)
   */
  hasCompletedAnyTour(): boolean {
    return this.#state().completedTours.length > 0;
  }

  /**
   * Reset all tutorial progress (for testing or user preference)
   */
  resetAllTours(): void {
    this.#state.set({
      ...DEFAULT_TUTORIAL_STATE,
      preferences: this.#state().preferences, // Keep preferences
    });
    this.#saveState();
  }

  /**
   * Update tutorial preferences
   */
  updatePreferences(preferences: Partial<TutorialState['preferences']>): void {
    this.#state.update((state) => ({
      ...state,
      preferences: {
        ...state.preferences,
        ...preferences,
      },
    }));
    this.#saveState();
  }

  /**
   * Get a specific tour configuration by ID
   */
  getTour(tourId: TourId): TutorialTour | undefined {
    return ALL_TOURS.find((t) => t.id === tourId);
  }

  /**
   * Get all available tours
   */
  getAllTours(): TutorialTour[] {
    return ALL_TOURS;
  }

  /**
   * Handle tour completion
   */
  #handleTourComplete(): void {
    const currentTourId = this.#state().currentTour;
    if (!currentTourId) return;

    this.#state.update((state) => ({
      ...state,
      isActive: false,
      currentTour: null,
      completedTours: [...state.completedTours, currentTourId],
    }));

    this.#saveState();

    // Track completion
    this.#trackEvent({
      tourId: currentTourId,
      action: 'completed',
      timestamp: Date.now(),
    });
  }

  /**
   * Handle tour cancellation
   */
  #handleTourCancel(): void {
    const currentTourId = this.#state().currentTour;
    if (!currentTourId) return;

    this.#state.update((state) => ({
      ...state,
      isActive: false,
      currentTour: null,
      skippedTours: state.skippedTours.includes(currentTourId)
        ? state.skippedTours
        : [...state.skippedTours, currentTourId],
    }));

    this.#saveState();

    // Track cancellation
    this.#trackEvent({
      tourId: currentTourId,
      action: 'cancelled',
      timestamp: Date.now(),
    });
  }

  /**
   * Load tutorial state from localStorage with Zod validation
   */
  #loadState(): TutorialState {
    try {
      const stored = localStorage.getItem('pulpe-tutorial-state');
      if (!stored) {
        return DEFAULT_TUTORIAL_STATE;
      }

      const rawData = JSON.parse(stored);
      const validated = TutorialStateSchema.parse(rawData);

      // Filter only valid tour IDs to prevent stale data
      const validTourIds = new Set(TOUR_IDS);
      const completedTours = validated.completedTours.filter((id) =>
        validTourIds.has(id as TourId),
      ) as TourId[];
      const skippedTours = validated.skippedTours.filter((id) =>
        validTourIds.has(id as TourId),
      ) as TourId[];

      return {
        isActive: false, // Always start inactive
        currentTour: null,
        completedTours,
        skippedTours,
        preferences: validated.preferences,
      };
    } catch (error) {
      this.#logger.error('Failed to load state from localStorage', error);
      // Clear corrupted data to prevent repeated failures
      try {
        localStorage.removeItem('pulpe-tutorial-state');
      } catch {
        // Ignore localStorage errors during cleanup
      }
      return DEFAULT_TUTORIAL_STATE;
    }
  }

  /**
   * Save tutorial state to localStorage
   */
  #saveState(): void {
    try {
      const stateToSave = {
        completedTours: this.#state().completedTours,
        skippedTours: this.#state().skippedTours,
        preferences: this.#state().preferences,
      };
      localStorage.setItem('pulpe-tutorial-state', JSON.stringify(stateToSave));
    } catch (error) {
      this.#logger.error('Failed to save state to localStorage', error);
    }
  }

  /**
   * Track tutorial events via PostHog analytics
   */
  #trackEvent(event: TutorialEvent): void {
    try {
      this.#logger.debug('Tutorial event', event);

      const eventName = `tutorial_${event.action}`;
      this.#analytics.captureEvent(eventName, {
        tourId: event.tourId,
        stepIndex: event.stepIndex,
        timestamp: event.timestamp,
      });
    } catch (error) {
      // Analytics should never break the application
      this.#logger.warn('Failed to track event', error);
    }
  }
}
