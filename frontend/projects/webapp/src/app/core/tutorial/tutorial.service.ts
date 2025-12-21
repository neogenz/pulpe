import {
  afterNextRender,
  afterRenderEffect,
  inject,
  Injectable,
  Injector,
  signal,
  type Signal,
} from '@angular/core';
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

interface StartTourOptions {
  force?: boolean;
}

/**
 * Zod schema for validating localStorage data
 */
const TutorialStateSchema = z.object({
  version: z.literal(1),
  completedTours: z.array(z.string()).default([]),
  skippedTours: z.array(z.string()).default([]),
});

/**
 * Service for managing interactive tutorials using Shepherd.js
 *
 * Features:
 * - Start, stop, and manage tutorial tours
 * - Persist completion state to localStorage
 * - Material Design 3 themed overlays
 */
@Injectable({
  providedIn: 'root',
})
export class TutorialService {
  readonly #shepherdService = inject(ShepherdService);
  readonly #router = inject(Router);
  readonly #injector = inject(Injector);
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
   * @param options - Optional settings (force: bypass hasSeenTour check for manual restart)
   */
  async startTour(tourId: TourId, options?: StartTourOptions): Promise<void> {
    const tour = this.#validateAndGetTour(tourId, options?.force);
    if (!tour) return;

    if (!this.#tryActivateTour(tourId)) return;

    try {
      await this.#prepareAndExecuteTour(tour);
    } catch (error) {
      this.#handleTourError(tourId, error);
    }
  }

  /**
   * Validate tour existence and check if it should be started
   * @param force - If true, bypass the hasSeenTour check (for manual restart)
   * @returns The tour if it should be started, null otherwise
   */
  #validateAndGetTour(tourId: TourId, force = false): TutorialTour | null {
    const tour = ALL_TOURS.find((t) => t.id === tourId);
    if (!tour) {
      this.#logger.warn('Tour not found', { tourId });
      return null;
    }

    if (!force && this.hasSeenTour(tourId)) {
      this.#logger.info('Tour already seen', { tourId });
      return null;
    }

    return tour;
  }

  /**
   * Attempts to activate the tour if no other tour is running.
   * @returns true if tour was activated, false if another tour is already active
   */
  #tryActivateTour(tourId: TourId): boolean {
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

      await this.#waitForNextRender();

      const currentRoute = this.#router.url;
      const expectedRoute = `/${ROUTES.APP}/${tour.targetRoute}`;
      if (!currentRoute.startsWith(expectedRoute)) {
        throw new Error('Navigation succeeded but route did not change');
      }
    }

    this.#executeTour(tour);
  }

  #waitForNextRender(): Promise<void> {
    return new Promise((resolve) => {
      afterNextRender(() => resolve(), { injector: this.#injector });
    });
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
   * Auto-start a tour when data is ready.
   * The effect runs once after data loads, then destroys itself.
   *
   * Must be called from a component constructor.
   */
  autoStartWhenReady(
    tourId: TourId,
    isDataLoaded: Signal<boolean>,
    injector: Injector,
  ): void {
    const ref = afterRenderEffect(
      {
        read: () => {
          if (isDataLoaded()) {
            ref.destroy();
            if (!this.hasSeenTour(tourId)) {
              this.startTour(tourId);
            }
          }
        },
      },
      { injector },
    );
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
   * Load tutorial state from localStorage with Zod validation
   */
  #loadState(): TutorialState {
    try {
      const stored = localStorage.getItem('pulpe-tutorial-state');
      if (!stored) {
        return DEFAULT_TUTORIAL_STATE;
      }

      const validated = TutorialStateSchema.parse(JSON.parse(stored));

      // Filter only valid tour IDs to prevent stale data
      const validTourIds = new Set(TOUR_IDS);
      const completedTours = validated.completedTours.filter((id) =>
        validTourIds.has(id as TourId),
      ) as TourId[];
      const skippedTours = validated.skippedTours.filter((id) =>
        validTourIds.has(id as TourId),
      ) as TourId[];

      return {
        isActive: false,
        currentTour: null,
        completedTours,
        skippedTours,
      };
    } catch (error) {
      this.#logger.error('Failed to load state from localStorage', error);
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
        version: 1,
        completedTours: this.#state().completedTours,
        skippedTours: this.#state().skippedTours,
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
