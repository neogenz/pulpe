import { inject, Injectable, signal } from '@angular/core';
import { ShepherdService } from 'angular-shepherd';
import { ALL_TOURS, defaultStepOptions } from './tutorial-configs';
import type { TourId, TutorialState, TutorialTour } from './tutorial.types';
import { DEFAULT_TUTORIAL_STATE } from './tutorial.types';

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

    // Listen to tour lifecycle events
    this.#shepherdService.tourObject?.on('complete', () => {
      this.#handleTourComplete();
    });

    this.#shepherdService.tourObject?.on('cancel', () => {
      this.#handleTourCancel();
    });
  }

  /**
   * Start a specific tour by ID
   */
  startTour(tourId: TourId): void {
    const tour = ALL_TOURS.find((t) => t.id === tourId);
    if (!tour) {
      console.warn(`[TutorialService] Tour not found: ${tourId}`);
      return;
    }

    // Check if already completed
    if (this.hasCompletedTour(tourId)) {
      console.info(`[TutorialService] Tour already completed: ${tourId}`);
      return;
    }

    // Check if preferences allow auto-start
    if (!this.#state().preferences.enabled) {
      console.info(
        '[TutorialService] Tutorials are disabled by user preference',
      );
      return;
    }

    // Update state
    this.#state.update((state) => ({
      ...state,
      isActive: true,
      currentTour: tourId,
    }));

    // Add steps and start tour
    this.#shepherdService.addSteps(tour.steps);
    this.#shepherdService.start();

    // Track event
    this.#trackEvent({
      tourId,
      action: 'started',
      timestamp: Date.now(),
    });
  }

  /**
   * Cancel the currently active tour
   */
  cancelTour(): void {
    if (!this.#state().isActive) {
      return;
    }

    this.#shepherdService.cancel();
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
   * Load tutorial state from localStorage
   */
  #loadState(): TutorialState {
    try {
      const stored = localStorage.getItem('pulpe-tutorial-state');
      if (!stored) {
        return DEFAULT_TUTORIAL_STATE;
      }

      const parsed = JSON.parse(stored) as TutorialState;
      return {
        ...DEFAULT_TUTORIAL_STATE,
        ...parsed,
        isActive: false, // Always start inactive
        currentTour: null,
      };
    } catch (error) {
      console.error(
        '[TutorialService] Failed to load state from localStorage',
        error,
      );
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
      console.error(
        '[TutorialService] Failed to save state to localStorage',
        error,
      );
    }
  }

  /**
   * Track tutorial events (placeholder for analytics integration)
   */
  #trackEvent(event: {
    tourId: TourId;
    action: 'started' | 'completed' | 'cancelled' | 'step_viewed';
    stepIndex?: number;
    timestamp: number;
  }): void {
    // TODO: Integrate with PostHog or your analytics service
    console.info('[TutorialService] Event:', event);
  }
}
