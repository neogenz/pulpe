import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ShepherdService } from 'angular-shepherd';
import { z } from 'zod';
import { AnalyticsService } from '../analytics/analytics';
import { Logger } from '../logging/logger';
import { ROUTES } from '../routing/routes-constants';
import { ALL_TOURS, defaultStepOptions } from './tutorial-configs';
import type {
  TourId,
  TutorialEvent,
  TutorialState,
  TutorialTour,
} from './tutorial.types';
import { DEFAULT_TUTORIAL_STATE, TOUR_IDS } from './tutorial.types';

/**
 * Delay in milliseconds before auto-starting a tour on first visit.
 * Gives user time to scan the page before interruption.
 */
const AUTO_START_DELAY_MS = 2000;

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
  readonly #router = inject(Router);
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
   * Navigates to the target page if needed before starting the tour.
   * @param tourId - The ID of the tour to start
   * @param options - Optional configuration (use force: true to replay completed/skipped tours)
   */
  async startTour(tourId: TourId, options?: StartTourOptions): Promise<void> {
    const tour = ALL_TOURS.find((t) => t.id === tourId);
    if (!tour) {
      this.#logger.warn('Tour not found', { tourId });
      return;
    }

    // Check if already seen (completed OR skipped) - skip check if force is true
    if (!options?.force && this.hasSeenTour(tourId)) {
      this.#logger.info('Tour already seen', { tourId });
      return;
    }

    // Check if preferences allow auto-start (skip check if force is true)
    // For first-visit tours, check autoStart; for manual tours, check enabled
    if (!options?.force) {
      const { enabled, autoStart } = this.#state().preferences;
      if (!enabled) {
        this.#logger.info('Tutorials are disabled by user preference');
        return;
      }
      if (tour.triggerOn === 'first-visit' && !autoStart) {
        this.#logger.info(
          'Auto-start tutorials are disabled by user preference',
        );
        return;
      }
    }

    // Atomically check and set active state to prevent race conditions
    // This ensures only one tour can be active at a time, even with concurrent calls
    let shouldProceed = false;
    this.#state.update((state) => {
      if (state.isActive) {
        return state; // Already active, don't modify state
      }
      shouldProceed = true;
      return {
        ...state,
        isActive: true,
        currentTour: tourId,
      };
    });

    if (!shouldProceed) {
      this.#logger.debug('Tour already active, skipping', {
        requestedTour: tourId,
        currentTour: this.#state().currentTour,
      });
      return;
    }

    try {
      // Navigate to target page if needed
      if (tour.targetRoute && !this.#isOnTargetRoute(tour.targetRoute)) {
        const navigated = await this.#navigateToTargetRoute(tour.targetRoute);
        if (!navigated) {
          this.#logger.error('Failed to navigate to target route', {
            tourId,
            targetRoute: tour.targetRoute,
          });
          this.#resetActiveState();
          return;
        }
        // Wait for page to render after navigation
        await this.#waitForNextFrame();
      }

      // Add delay before auto-starting first-visit tours
      // This gives users time to scan the page before interruption
      if (!options?.force && tour.triggerOn === 'first-visit') {
        await this.#delay(AUTO_START_DELAY_MS);
      }

      this.#executeTour(tour);
    } catch (error) {
      this.#logger.error('Failed to start tour', { tourId, error });
      this.#resetActiveState();
    }
  }

  /**
   * Reset the active state (used on errors or cancellation)
   */
  #resetActiveState(): void {
    this.#state.update((state) => ({
      ...state,
      isActive: false,
      currentTour: null,
    }));
  }

  /**
   * Check if current route matches the target route
   */
  #isOnTargetRoute(targetRoute: string): boolean {
    const currentUrl = this.#router.url;
    const fullTargetPath = `/${ROUTES.APP}/${targetRoute}`;
    return currentUrl.startsWith(fullTargetPath);
  }

  /**
   * Navigate to the target route
   */
  async #navigateToTargetRoute(targetRoute: string): Promise<boolean> {
    try {
      return await this.#router.navigate([ROUTES.APP, targetRoute]);
    } catch (error) {
      this.#logger.error('Navigation failed', { targetRoute, error });
      return false;
    }
  }

  /**
   * Wait for the next animation frame to ensure DOM is updated
   *
   * Uses double requestAnimationFrame to ensure:
   * 1. First frame: Browser schedules layout/paint
   * 2. Second frame: DOM changes are fully rendered and interactive
   *
   * This is necessary after navigation to ensure tour step elements are present
   * and positioned correctly before Shepherd.js tries to attach to them.
   */
  #waitForNextFrame(): Promise<void> {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });
  }

  /**
   * Simple delay helper for adding pauses in async flows
   */
  #delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Execute the tour after all preconditions are met
   * Note: isActive state is already set by startTour() before calling this
   */
  #executeTour(tour: TutorialTour): void {
    try {
      // Add steps first (creates the tourObject)
      this.#shepherdService.addSteps(tour.steps);

      // Register event listeners now that tourObject exists
      this.#registerTourEventListeners();

      // Start the tour
      this.#shepherdService.start();

      // Track event
      this.#trackEvent({
        tourId: tour.id,
        action: 'started',
        timestamp: Date.now(),
      });
    } catch (error) {
      this.#logger.error('Failed to execute tour', { tourId: tour.id, error });
      this.#resetActiveState();
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
   * Check if a tour has been seen (completed OR skipped)
   * Use this for auto-start logic to prevent re-showing skipped tours
   */
  hasSeenTour(tourId: TourId): boolean {
    const state = this.#state();
    return (
      state.completedTours.includes(tourId) ||
      state.skippedTours.includes(tourId)
    );
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
   * Check if a tour requires navigation from current location
   */
  tourRequiresNavigation(tourId: TourId): boolean {
    const tour = this.getTour(tourId);
    if (!tour?.targetRoute) return false;
    return !this.#isOnTargetRoute(tour.targetRoute);
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
