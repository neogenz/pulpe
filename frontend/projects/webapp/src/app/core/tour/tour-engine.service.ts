import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Injectable, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { driver, type DriveStep, type Driver, type Side } from 'driver.js';
import { map } from 'rxjs/operators';
import { Logger } from '@core/logging/logger';
import { TourStateService, type TourId } from './tour-state.service';

export interface TourStep {
  /** CSS selector for the target element */
  element: string;
  /** Step title (French) */
  title: string;
  /** Step description (French) */
  description: string;
  /** Popover position relative to element */
  side?: Side;
  /** Alignment within the side */
  align?: 'start' | 'center' | 'end';
}

export interface TourConfig {
  /** Unique tour identifier */
  tourId: TourId;
  /** Tour steps to display */
  steps: TourStep[];
  /** Callback when tour completes or is skipped */
  onComplete?: () => void;
}

/**
 * Service that wraps Driver.js to provide guided tours.
 * Handles mobile/desktop differences and French localization.
 */
@Injectable({
  providedIn: 'root',
})
export class TourEngineService {
  readonly #tourState = inject(TourStateService);
  readonly #breakpointObserver = inject(BreakpointObserver);
  readonly #logger = inject(Logger);

  readonly #isHandset = toSignal(
    this.#breakpointObserver
      .observe(Breakpoints.Handset)
      .pipe(map((result) => result.matches)),
    { initialValue: false },
  );

  #currentDriver: Driver | null = null;
  #isDestroying = false;

  /**
   * Start a guided tour
   */
  startTour(config: TourConfig): void {
    // Prevent starting if already destroying
    if (this.#isDestroying) {
      return;
    }

    // Prevent multiple tours running simultaneously
    if (this.#currentDriver) {
      this.#currentDriver.destroy();
      this.#currentDriver = null;
    }

    const isHandset = this.#isHandset();
    const steps = this.#buildSteps(config.steps, isHandset);

    this.#currentDriver = driver({
      // Animation settings
      animate: true,
      smoothScroll: true,

      // Overlay settings
      overlayColor: '#000',
      overlayOpacity: 0.5,

      // Stage (highlighted area) settings
      stagePadding: isHandset ? 8 : 12,
      stageRadius: 8,

      // Interaction settings
      allowClose: true,
      disableActiveInteraction: false,

      // Progress display
      showProgress: true,
      progressText: '{{current}} / {{total}}',

      // Custom CSS class
      popoverClass: 'pulpe-tour-popover',

      // French button labels
      nextBtnText: 'Suivant',
      prevBtnText: 'Précédent',
      doneBtnText: 'Terminer',

      // Steps configuration
      steps,

      // Called when tour is about to be destroyed (close, done, or skip)
      onDestroyStarted: () => {
        if (this.#isDestroying) {
          return;
        }
        this.#isDestroying = true;

        this.#tourState.markTourCompleted(config.tourId);
        config.onComplete?.();
        this.#logger.info('Tour completed', { tourId: config.tourId });

        this.#currentDriver?.destroy();
        this.#currentDriver = null;
        this.#isDestroying = false;
      },
    });

    this.#logger.info('Starting tour', { tourId: config.tourId });
    this.#currentDriver.drive();
  }

  /**
   * Destroy current tour if running
   */
  destroyCurrentTour(): void {
    if (this.#currentDriver && !this.#isDestroying) {
      this.#currentDriver.destroy();
      this.#currentDriver = null;
    }
  }

  #buildSteps(steps: TourStep[], isHandset: boolean): DriveStep[] {
    return steps.map((step) => ({
      element: step.element,
      popover: {
        title: step.title,
        description: step.description,
        side: this.#getMobileSide(step.side, isHandset),
        align: step.align ?? 'center',
      },
    }));
  }

  #getMobileSide(side: Side | undefined, isHandset: boolean): Side {
    if (!isHandset) {
      return side ?? 'bottom';
    }
    // On mobile, prefer top/bottom to avoid horizontal overflow
    if (side === 'left' || side === 'right') {
      return 'bottom';
    }
    return side ?? 'bottom';
  }
}
