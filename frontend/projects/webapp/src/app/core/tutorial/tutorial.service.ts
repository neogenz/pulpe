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
 * Additional delay for lazy-loaded components to fully mount.
 */
const LAZY_LOAD_MOUNT_DELAY_MS = 200;

/**
 * Zod schema for validating localStorage data (Version 1)
 */
const TutorialStateSchemaV1 = z.object({
  version: z.literal(1).default(1),
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
      // THROW instead of silent return to ensure error is caught and state is reset
      throw new Error(
        'Cannot register events: tourObject is null after addSteps()',
      );
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
   */
  async startTour(tourId: TourId): Promise<void> {
    const tour = this.#validateAndGetTour(tourId);
    if (!tour) return;

    if (!this.#acquireActiveLock(tourId)) return;

    try {
      await this.#prepareAndExecuteTour(tour);
    } catch (error) {
      this.#handleTourError(tourId, error);
    }
  }

  /**
   * Validate tour existence and check if it should be started
   * @returns The tour if it should be started, null otherwise
   */
  #validateAndGetTour(tourId: TourId): TutorialTour | null {
    const tour = ALL_TOURS.find((t) => t.id === tourId);
    if (!tour) {
      this.#logger.warn('Tour not found', { tourId });
      return null;
    }

    if (this.hasSeenTour(tourId)) {
      this.#logger.info('Tour already seen', { tourId });
      return null;
    }

    if (!this.#checkPreferences(tour)) {
      return null;
    }

    return tour;
  }

  /**
   * Check if user preferences allow the tour to start
   */
  #checkPreferences(tour: TutorialTour): boolean {
    const { enabled, autoStart } = this.#state().preferences;
    if (!enabled) {
      this.#logger.info('Tutorials are disabled by user preference');
      return false;
    }
    if (tour.triggerOn === 'first-visit' && !autoStart) {
      this.#logger.info('Auto-start tutorials are disabled by user preference');
      return false;
    }
    return true;
  }

  /**
   * Acquire lock to ensure only one tour runs at a time
   * @returns true if lock was acquired, false if another tour is active
   */
  #acquireActiveLock(tourId: TourId): boolean {
    if (this.#state().isActive) {
      this.#logger.debug('Tour already active, skipping', {
        requestedTour: tourId,
        currentTour: this.#state().currentTour,
      });
      return false;
    }

    this.#state.update((state) => ({
      ...state,
      isActive: true,
      currentTour: tourId,
    }));

    return true;
  }

  /**
   * Navigate to target route if needed and execute the tour
   */
  async #prepareAndExecuteTour(tour: TutorialTour): Promise<void> {
    if (tour.targetRoute && !this.#isOnTargetRoute(tour.targetRoute)) {
      const navigated = await this.#navigateToTargetRoute(tour.targetRoute);
      if (!navigated) {
        throw new Error('Navigation failed');
      }

      await this.#waitForPageReady();

      const currentRoute = this.#router.url;
      const expectedRoute = `/${ROUTES.APP}/${tour.targetRoute}`;
      if (!currentRoute.startsWith(expectedRoute)) {
        throw new Error('Navigation succeeded but route did not change');
      }
    }

    this.#executeTour(tour);
  }

  /**
   * Handle tour start errors
   */
  #handleTourError(tourId: TourId, error: unknown): void {
    this.#logger.error('Failed to start tour', { tourId, error });
    this.#resetActiveState();
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
   * Wait for page to be fully ready after navigation
   *
   * Lazy-loaded routes need more time than just 2 RAF (~32ms).
   * This method ensures components are mounted and rendered before
   * the tour tries to attach to DOM elements.
   */
  async #waitForPageReady(): Promise<void> {
    // Wait for initial render (2 RAF)
    await this.#waitForNextFrame();

    // Additional wait for lazy-loaded components to fully mount
    await this.#delay(LAZY_LOAD_MOUNT_DELAY_MS);
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
   * Handle tour completion
   */
  #handleTourComplete(): void {
    const currentTourId = this.#state().currentTour;

    // ALWAYS reset isActive, even if currentTourId is null
    this.#state.update((state) => ({
      ...state,
      isActive: false,
      currentTour: null,
      completedTours:
        currentTourId && !state.completedTours.includes(currentTourId)
          ? [...state.completedTours, currentTourId]
          : state.completedTours,
      // Remove from skippedTours if present (data consistency)
      skippedTours: currentTourId
        ? state.skippedTours.filter((id) => id !== currentTourId)
        : state.skippedTours,
    }));

    this.#saveState();

    // Only track if we have a valid tourId
    if (currentTourId) {
      this.#trackEvent({
        tourId: currentTourId,
        action: 'completed',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Handle tour cancellation
   */
  #handleTourCancel(): void {
    const currentTourId = this.#state().currentTour;

    // ALWAYS reset isActive, even if currentTourId is null
    // This prevents stuck state when tour crashes before setting currentTourId
    this.#state.update((state) => ({
      ...state,
      isActive: false,
      currentTour: null,
      skippedTours:
        currentTourId && !state.skippedTours.includes(currentTourId)
          ? [...state.skippedTours, currentTourId]
          : state.skippedTours,
    }));

    this.#saveState();

    // Only track if we have a valid tourId
    if (currentTourId) {
      this.#trackEvent({
        tourId: currentTourId,
        action: 'cancelled',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Load tutorial state from localStorage with Zod validation and migration
   */
  #loadState(): TutorialState {
    try {
      const stored = localStorage.getItem('pulpe-tutorial-state');
      if (!stored) {
        return DEFAULT_TUTORIAL_STATE;
      }

      const rawData = JSON.parse(stored);

      // Handle legacy data (no version field) - migrate to v1
      if (!rawData.version || rawData.version < 1) {
        this.#logger.info('Migrating tutorial state to v1');
        return this.#migrateToV1(rawData);
      }

      const validated = TutorialStateSchemaV1.parse(rawData);

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
   * Migrate legacy tutorial state (no version) to v1
   */
  #migrateToV1(oldData: unknown): TutorialState {
    const data = oldData as Record<string, unknown>;

    // Filter invalid tour IDs during migration
    const validTourIds = new Set(TOUR_IDS);
    const rawCompletedTours = Array.isArray(data?.['completedTours'])
      ? data['completedTours']
      : [];
    const rawSkippedTours = Array.isArray(data?.['skippedTours'])
      ? data['skippedTours']
      : [];

    const preferences = data?.['preferences'] as
      | Record<string, unknown>
      | undefined;

    return {
      isActive: false,
      currentTour: null,
      completedTours: rawCompletedTours.filter((id) =>
        validTourIds.has(id as TourId),
      ) as TourId[],
      skippedTours: rawSkippedTours.filter((id) =>
        validTourIds.has(id as TourId),
      ) as TourId[],
      preferences: {
        enabled: preferences?.['enabled'] === false ? false : true,
        autoStart: preferences?.['autoStart'] === false ? false : true,
      },
    };
  }

  /**
   * Save tutorial state to localStorage
   */
  #saveState(): void {
    try {
      const stateToSave = {
        version: 1,
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
