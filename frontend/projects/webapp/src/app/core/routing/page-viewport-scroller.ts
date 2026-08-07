import { DOCUMENT, Service, inject } from '@angular/core';
import { ViewportScroller } from '@angular/common';

type ScrollPosition = [number, number];

/** How long a missed target keeps retrying before giving up. */
export const SETTLE_TIMEOUT_MS = 1000;

/**
 * Events that count as "the user started reading" — never `scroll`, which
 * our own writes emit.
 *
 * What this list still lets through: programmatic scrolling that fires no
 * input event — a screen reader's virtual cursor in browse mode (arrow keys
 * are swallowed by the reader, so no `keydown` reaches the page) and the
 * browser's own find-next once focus has moved into the browser chrome. That
 * gap stays bounded by `SETTLE_TIMEOUT_MS` instead of being closed with a
 * tighter guard, deliberately: the obvious fix — abandon the retry once the
 * position has moved since our last write — collides with Chrome's scroll
 * anchoring, which adjusts `scrollTop` on its own exactly when content grows
 * above the viewport, which is the exact window this loop exists to cover.
 */
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
// Fourni à la main, sous le token `ViewportScroller` (voir `core.ts`) : c'est
// Angular qui doit résoudre ce token, jamais cette classe par son propre nom.
// Auto-provisionner en plus laisserait un second enregistrement, jamais
// instancié, qui laisserait croire que la classe se suffit à elle-même.
@Service({ autoProvided: false })
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

    this.#writePosition(position[0], position[1], options);

    if (!this.#isOrigin(position) && !this.#reachedTarget(position)) {
      this.#armSettle(position, options);
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
      try {
        win.history.scrollRestoration = mode;
      } catch {
        // Throws in a sandboxed iframe or a partially-navigated window
        // (Angular's BrowserViewportScroller guards the same assignment).
        // This runs at router init, so left uncaught it would break bootstrap.
      }
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
