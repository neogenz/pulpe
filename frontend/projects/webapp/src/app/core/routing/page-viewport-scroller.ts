import { DOCUMENT, Service, inject } from '@angular/core';
import { ViewportScroller } from '@angular/common';

type ScrollPosition = [number, number];

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
    const [offsetX, offsetY] = this.#offset;
    this.#writePosition(position[0] - offsetX, position[1] - offsetY, options);
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
}
