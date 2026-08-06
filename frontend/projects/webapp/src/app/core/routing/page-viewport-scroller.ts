import { DOCUMENT, Service, inject } from '@angular/core';
import { ViewportScroller } from '@angular/common';

type ScrollPosition = [number, number];

/** How long a missed target keeps retrying before giving up. */
export const SETTLE_TIMEOUT_MS = 1000;

/** Events that count as "the user started reading" — never `scroll`, which our own writes emit. */
const GESTURE_EVENTS = [
  'wheel',
  'touchstart',
  'pointerdown',
  'keydown',
] as const;

/**
 * `ViewportScroller` replacement that targets whichever element actually
 * scrolls, instead of always assuming the window.
 *
 * Angular's own `BrowserViewportScroller` reads and writes `window.scrollX`
 * / `scrollY` unconditionally. This app scrolls `<main>` on desktop
 * (`[class.overflow-y-auto]="!isHandset()"` in `main-layout.ts`) and the
 * document on mobile — so the router's back/forward scroll restoration
 * silently landed on `0` on desktop while working on mobile. This service
 * changes only *which element* Angular asks; no layout or sticky surface
 * moves.
 *
 * See `aidd_docs/tasks/2026_08/2026_08_06_scroll-position-restoration/plan.md`.
 */
@Service()
export class PageViewportScroller extends ViewportScroller {
  readonly #document = inject(DOCUMENT);

  #offsetConfig: ScrollPosition | (() => ScrollPosition) = [0, 0];
  #settleFrame: number | null = null;
  #stopListeningForGesture: (() => void) | null = null;

  get #offset(): ScrollPosition {
    return Array.isArray(this.#offsetConfig)
      ? this.#offsetConfig
      : this.#offsetConfig();
  }

  /** Re-resolved on every call: stays correct if the shell's breakpoint changes. */
  get #scrollingContainer(): HTMLElement | null {
    const main = this.#document.querySelector('main');
    if (!main) return null;

    const overflowY =
      this.#document.defaultView?.getComputedStyle(main).overflowY;
    return overflowY === 'auto' || overflowY === 'scroll' ? main : null;
  }

  override setOffset(offset: ScrollPosition | (() => ScrollPosition)): void {
    this.#offsetConfig = offset;
  }

  override getScrollPosition(): ScrollPosition {
    const container = this.#scrollingContainer;
    if (container) {
      return [container.scrollLeft, container.scrollTop];
    }

    const win = this.#document.defaultView;
    return win ? [win.scrollX, win.scrollY] : [0, 0];
  }

  override scrollToPosition(
    position: ScrollPosition,
    options?: ScrollOptions,
  ): void {
    this.#cancelSettle();

    const [offsetX, offsetY] = this.#offset;
    const target: ScrollPosition = [
      position[0] - offsetX,
      position[1] - offsetY,
    ];
    this.#writePosition(target[0], target[1], options);

    if (!this.#isOrigin(target) && !this.#reachedTarget(target)) {
      this.#armSettle(target, options);
    }
  }

  override scrollToAnchor(anchor: string, options?: ScrollOptions): void {
    const target = this.#findAnchorTarget(anchor);
    if (!target) return;

    const [offsetX, offsetY] = this.#offset;
    const container = this.#scrollingContainer;
    const targetRect = target.getBoundingClientRect();

    if (container) {
      const containerRect = container.getBoundingClientRect();
      container.scrollTo({
        ...options,
        left:
          container.scrollLeft + targetRect.left - containerRect.left - offsetX,
        top: container.scrollTop + targetRect.top - containerRect.top - offsetY,
      });
    } else {
      const win = this.#document.defaultView;
      if (win) {
        win.scrollTo({
          ...options,
          left: targetRect.left + win.scrollX - offsetX,
          top: targetRect.top + win.scrollY - offsetY,
        });
      }
    }

    target.focus({ preventScroll: true });
  }

  override setHistoryScrollRestoration(mode: 'auto' | 'manual'): void {
    const win = this.#document.defaultView;
    if (win) {
      win.history.scrollRestoration = mode;
    }
  }

  #writePosition(left: number, top: number, options?: ScrollOptions): void {
    const container = this.#scrollingContainer;
    if (container) {
      container.scrollTo({ ...options, left, top });
      return;
    }
    this.#document.defaultView?.scrollTo({ ...options, left, top });
  }

  #findAnchorTarget(anchor: string): HTMLElement | null {
    return (
      this.#document.getElementById(anchor) ??
      this.#document.getElementsByName(anchor)[0] ??
      null
    );
  }

  #isOrigin(target: ScrollPosition): boolean {
    return target[0] === 0 && target[1] === 0;
  }

  /** Compares against `target`, the already offset-adjusted DOM position — never the raw request. */
  #reachedTarget(target: ScrollPosition): boolean {
    const [left, top] = this.getScrollPosition();
    return left === target[0] && top === target[1];
  }

  /**
   * A cold-loaded page may not have its final height yet when the router
   * first restores, so the browser clamps the write short. Retry each frame
   * until the target is reachable, the deadline passes, or the user starts
   * reading — whichever comes first.
   */
  #armSettle(target: ScrollPosition, options?: ScrollOptions): void {
    const win = this.#document.defaultView;
    if (!win) return;

    const deadline = Date.now() + SETTLE_TIMEOUT_MS;
    this.#stopListeningForGesture = this.#listenForUserGesture(() =>
      this.#cancelSettle(),
    );

    const retry = (): void => {
      this.#writePosition(target[0], target[1], options);

      if (this.#reachedTarget(target) || Date.now() >= deadline) {
        this.#cancelSettle();
        return;
      }

      this.#settleFrame = win.requestAnimationFrame(retry);
    };

    this.#settleFrame = win.requestAnimationFrame(retry);
  }

  #cancelSettle(): void {
    if (this.#settleFrame !== null) {
      this.#document.defaultView?.cancelAnimationFrame(this.#settleFrame);
      this.#settleFrame = null;
    }
    this.#stopListeningForGesture?.();
    this.#stopListeningForGesture = null;
  }

  /** Never listens for `scroll`: our own retries emit it, which would self-abort. */
  #listenForUserGesture(onGesture: () => void): () => void {
    const win = this.#document.defaultView;
    if (!win) return () => undefined;

    for (const type of GESTURE_EVENTS) {
      win.addEventListener(type, onGesture, { passive: true });
    }

    return () => {
      for (const type of GESTURE_EVENTS) {
        win.removeEventListener(type, onGesture);
      }
    };
  }
}
