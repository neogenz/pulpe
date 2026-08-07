import { DOCUMENT } from '@angular/common';
import { inject, InjectionToken, Service } from '@angular/core';
import { AuthStore } from '@core/auth/auth-store';
import { StorageService, type StorageKey } from '@core/storage';
import { TranslocoService } from '@jsverse/transloco';
import { driver, type Config, type Driver, type DriveStep } from 'driver.js';
import {
  createProductTourSteps,
  type TourId,
  type TourPageId,
} from './product-tour.steps';

/**
 * The driver.js entry point, reached through DI so a spec can hand back a double.
 *
 * `vi.mock('driver.js')` cannot do that job here: the specs share one module
 * registry (`isolate` defaults to false under `@angular/build:unit-test`), and
 * `main-layout.spec.ts` pulls this service — and with it the real `driver.js` —
 * into that registry before the mock is ever registered. Whichever file the
 * runner happens to schedule first then decides whether the mock takes, which is
 * a coin flip on a loaded machine.
 */
export const DRIVER_FACTORY = new InjectionToken<typeof driver>(
  'DRIVER_FACTORY',
  { providedIn: 'root', factory: () => driver },
);

const SCROLL_CONTAINER_SELECTORS = [
  '[data-testid="page-content"]',
  '[data-testid="main-content"] > div',
] as const;

const DRIVER_ACTIVE_ELEMENT_CLASS = 'driver-active-element';
const DRIVER_BODY_CLASSES = [
  'driver-active',
  'driver-fade',
  'driver-simple',
] as const;

export type { TourPageId } from './product-tour.steps';
type TourState = 'completed' | 'dismissed';

export const TOUR_START_DELAY = 500;
const TOUR_TARGET_TIMEOUT = 10_000;

const TOUR_IDS = {
  intro: 'intro',
  dashboard: 'dashboard',
  'budget-list': 'budget-list',
  'budget-details': 'budget-details',
  'templates-list': 'templates-list',
  'savings-goals': 'savings-goals',
} as const;

@Service()
export class ProductTourService {
  readonly #document = inject(DOCUMENT);
  readonly #driver = inject(DRIVER_FACTORY);
  readonly #storageService = inject(StorageService);
  readonly #authStore = inject(AuthStore);
  readonly #transloco = inject(TranslocoService);
  readonly #steps = createProductTourSteps(this.#transloco);

  #activeDriver: Driver | null = null;

  #pendingTour: {
    observer: MutationObserver;
    timeoutId: number;
  } | null = null;

  readonly #scrollPositions = new Map<HTMLElement, number>();

  isAuthenticated(): boolean {
    return !!this.#authStore.user()?.id;
  }

  #getTourKey(tourId: TourId): StorageKey {
    return `pulpe-tour-${tourId}`;
  }

  hasSeenIntro(): boolean {
    return this.#hasSeenTour(TOUR_IDS.intro);
  }

  hasSeenPageTour(pageId: TourPageId): boolean {
    return this.#hasSeenTour(TOUR_IDS[pageId]);
  }

  #hasSeenTour(tourId: TourId): boolean {
    const state = this.#storageService.getString(this.#getTourKey(tourId));
    return state === 'true' || state === 'completed' || state === 'dismissed';
  }

  #markTour(tourId: TourId, state: TourState): void {
    this.#storageService.setString(this.#getTourKey(tourId), state);
  }

  resetAllTours(): void {
    this.#storageService.remove(this.#getTourKey(TOUR_IDS.intro));
    this.#storageService.remove(this.#getTourKey(TOUR_IDS.dashboard));
    this.#storageService.remove(this.#getTourKey(TOUR_IDS['budget-list']));
    this.#storageService.remove(this.#getTourKey(TOUR_IDS['budget-details']));
    this.#storageService.remove(this.#getTourKey(TOUR_IDS['templates-list']));
    this.#storageService.remove(this.#getTourKey(TOUR_IDS['savings-goals']));
  }

  cancelActiveTour(): void {
    this.#cancelPendingTour();
    if (this.#activeDriver) {
      this.#activeDriver.destroy();
      this.#activeDriver = null;
    }
  }

  #cancelPendingTour(): void {
    if (!this.#pendingTour) return;

    this.#pendingTour.observer.disconnect();
    this.#document.defaultView?.clearTimeout(this.#pendingTour.timeoutId);
    this.#pendingTour = null;
  }

  #cleanupDriverArtifacts(): void {
    setTimeout(() => {
      this.#removeDriverClasses();
      this.#restoreScrollPositions();
    }, 0);
  }

  #removeDriverClasses(): void {
    this.#document
      .querySelectorAll(`.${DRIVER_ACTIVE_ELEMENT_CLASS}`)
      .forEach((el) => {
        el.classList.remove(DRIVER_ACTIVE_ELEMENT_CLASS);
      });
    this.#document.body.classList.remove(...DRIVER_BODY_CLASSES);
  }

  #rememberScrollPositions(): void {
    this.#scrollPositions.clear();
    for (const selector of SCROLL_CONTAINER_SELECTORS) {
      const element = this.#document.querySelector<HTMLElement>(selector);
      if (element) {
        this.#scrollPositions.set(element, element.scrollTop);
      }
    }
  }

  #restoreScrollPositions(): void {
    this.#scrollPositions.forEach((scrollTop, element) => {
      element.scrollTop = scrollTop;
    });
    this.#scrollPositions.clear();
  }

  startFirstRunTour(): void {
    if (!this.isAuthenticated() || this.hasSeenIntro() || this.#activeDriver) {
      return;
    }

    this.#prepareTour(TOUR_IDS.intro, this.#steps.intro);
  }

  startPageTour(pageId: TourPageId, focusTarget?: HTMLElement): void {
    if (!this.isAuthenticated() || this.#activeDriver) {
      return;
    }

    this.#prepareTour(TOUR_IDS[pageId], this.#steps[pageId], focusTarget);
  }

  #prepareTour(
    tourId: TourId,
    steps: DriveStep[],
    focusTarget: Element | null = this.#document.activeElement,
  ): void {
    this.#cancelPendingTour();

    const firstPageTarget = steps.find(
      (step) => typeof step.element === 'string',
    )?.element;

    if (
      typeof firstPageTarget === 'string' &&
      !this.#document.querySelector(firstPageTarget)
    ) {
      const view = this.#document.defaultView;
      if (!view) return;

      const observer = new view.MutationObserver(() => {
        if (!this.#document.querySelector(firstPageTarget)) return;

        this.#cancelPendingTour();
        this.#startTour(tourId, steps, focusTarget);
      });
      const timeoutId = view.setTimeout(
        () => this.#cancelPendingTour(),
        TOUR_TARGET_TIMEOUT,
      );

      this.#pendingTour = { observer, timeoutId };
      observer.observe(this.#document.body, { childList: true, subtree: true });
      return;
    }

    this.#startTour(tourId, steps, focusTarget);
  }

  #startTour(
    tourId: TourId,
    steps: DriveStep[],
    focusTarget: Element | null,
  ): void {
    const availableSteps = steps.filter(
      (step) =>
        typeof step.element !== 'string' ||
        !!this.#document.querySelector(step.element),
    );
    if (availableSteps.length === 0) return;

    const tourDriver = this.#driver();
    this.#activeDriver = tourDriver;
    this.#rememberScrollPositions();
    let completed = false;

    const driverConfig: Config = {
      showProgress: true,
      showButtons: ['next', 'previous', 'close'],
      progressText: this.#transloco
        .translate('productTour.controls.progress', {
          current: '__driver_current__',
          total: '__driver_total__',
        })
        .replace('__driver_current__', '{{current}}')
        .replace('__driver_total__', '{{total}}'),
      nextBtnText: this.#transloco.translate('productTour.controls.next'),
      prevBtnText: this.#transloco.translate('productTour.controls.previous'),
      doneBtnText: this.#transloco.translate('productTour.controls.done'),
      allowClose: true,
      overlayColor: '#000',
      overlayOpacity: 0.55,
      smoothScroll: true,
      animate: !this.#document.defaultView?.matchMedia?.(
        '(prefers-reduced-motion: reduce)',
      ).matches,
      disableActiveInteraction: false,
      stagePadding: 10,
      stageRadius: 8,
      popoverOffset: 16,
      onPopoverRender: (popover) => {
        popover.closeButton.setAttribute(
          'aria-label',
          this.#transloco.translate('productTour.controls.close'),
        );
      },
      onNextClick: (_element, _step, { driver: currentDriver }) => {
        if (currentDriver.isLastStep()) {
          completed = true;
          currentDriver.destroy();
          return;
        }

        currentDriver.moveNext();
      },
      onDestroyed: () => {
        this.#activeDriver = null;
        this.#cleanupDriverArtifacts();
        this.#markTour(tourId, completed ? 'completed' : 'dismissed');
        if (focusTarget instanceof HTMLElement && focusTarget.isConnected) {
          focusTarget.focus();
        }
      },
    };

    tourDriver.setConfig(driverConfig);
    tourDriver.setSteps(availableSteps);
    tourDriver.drive();
  }
}
