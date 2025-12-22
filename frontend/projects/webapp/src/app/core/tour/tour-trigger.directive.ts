import {
  Directive,
  DestroyRef,
  afterNextRender,
  inject,
  input,
} from '@angular/core';
import { TourEngineService, type TourStep } from './tour-engine.service';
import { TourStateService, type TourId } from './tour-state.service';
import { Logger } from '@core/logging/logger';

/**
 * Directive that automatically triggers a tour when a page loads.
 * Only triggers if the tour hasn't been completed yet.
 *
 * Usage:
 * ```html
 * <div pulpeTourTrigger="currentMonth" [tourSteps]="tourSteps">
 * ```
 */
@Directive({
  selector: '[pulpeTourTrigger]',
  standalone: true,
})
export class TourTriggerDirective {
  readonly #tourEngine = inject(TourEngineService);
  readonly #tourState = inject(TourStateService);
  readonly #destroyRef = inject(DestroyRef);
  readonly #logger = inject(Logger);

  /** The tour ID to trigger */
  readonly tourId = input.required<TourId>({ alias: 'pulpeTourTrigger' });

  /** The steps configuration for this tour */
  readonly tourSteps = input.required<TourStep[]>();

  /** Delay before starting tour (ms) - allows page to render */
  readonly tourDelay = input<number>(500);

  constructor() {
    afterNextRender(() => {
      this.#scheduleTour();
    });
  }

  #scheduleTour(): void {
    const tourId = this.tourId();

    // Check if tour already completed
    if (this.#tourState.isTourCompleted(tourId)) {
      this.#logger.debug('Tour already completed, skipping', { tourId });
      return;
    }

    // Schedule tour start after delay
    const timeoutId = setTimeout(() => {
      this.#startTour();
    }, this.tourDelay());

    // Cleanup timeout on destroy
    this.#destroyRef.onDestroy(() => {
      clearTimeout(timeoutId);
      this.#tourEngine.destroyCurrentTour();
    });
  }

  #startTour(): void {
    const tourId = this.tourId();
    const steps = this.tourSteps();

    if (!steps.length) {
      this.#logger.warn('No tour steps provided', { tourId });
      return;
    }

    this.#tourEngine.startTour({
      tourId,
      steps,
    });
  }
}
