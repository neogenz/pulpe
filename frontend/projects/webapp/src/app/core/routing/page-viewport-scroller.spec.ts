import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import {
  PageViewportScroller,
  SETTLE_TIMEOUT_MS,
} from './page-viewport-scroller';

/**
 * jsdom implements neither `Element.prototype.scrollTo` nor a real scroll
 * mechanism (`scrollTop` is a plain stored property). This stubs `scrollTo`
 * the way a real browser would — writing into `scrollLeft`/`scrollTop`,
 * clamped to `maxScrollTop` so tests can simulate a container that has not
 * grown to its final height yet.
 */
function createScrollableMain(maxScrollTop = Number.POSITIVE_INFINITY): {
  main: HTMLElement;
  growTo: (height: number) => void;
} {
  const main = document.createElement('main');
  main.style.overflowY = 'auto';

  let cap = maxScrollTop;
  (
    main as unknown as { scrollTo: (options: ScrollToOptions) => void }
  ).scrollTo = (options) => {
    if (typeof options.left === 'number') {
      main.scrollLeft = options.left;
    }
    if (typeof options.top === 'number') {
      main.scrollTop = Math.max(0, Math.min(options.top, cap));
    }
    // A real scroll write emits a `scroll` event — the settle loop must
    // keep retrying through it instead of mistaking it for a user gesture.
    window.dispatchEvent(new Event('scroll'));
  };

  document.body.appendChild(main);
  return { main, growTo: (height) => (cap = height) };
}

describe('PageViewportScroller', () => {
  let scroller: PageViewportScroller;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    scroller = TestBed.inject(PageViewportScroller);
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('should read back the exact position it wrote when <main> scrolls', () => {
    createScrollableMain();

    scroller.scrollToPosition([0, 250]);

    expect(scroller.getScrollPosition()).toEqual([0, 250]);
  });

  it('should fall back to the window and ignore a <main> that does not scroll', () => {
    const main = document.createElement('main');
    main.style.overflowY = 'visible';
    document.body.appendChild(main);
    main.scrollTop = 999; // would leak through if the service read <main> anyway

    const [, top] = scroller.getScrollPosition();

    expect(top).not.toBe(999);
  });

  it('should not throw when no <main> exists in the document', () => {
    expect(() => scroller.getScrollPosition()).not.toThrow();
  });

  it('should subtract the configured offset when writing a position', () => {
    const { main } = createScrollableMain();

    scroller.setOffset([0, 64]);
    scroller.scrollToPosition([0, 500]);

    expect(main.scrollTop).toBe(436);
  });

  it('should keep retrying past its own scroll events until a late-growing container reaches the target', () => {
    const { main, growTo } = createScrollableMain(100);

    scroller.scrollToPosition([0, 1528]);
    expect(main.scrollTop).toBe(100); // clamped short — the page has not grown yet

    growTo(2000); // the page's data has now rendered
    vi.advanceTimersByTime(SETTLE_TIMEOUT_MS);

    expect(main.scrollTop).toBe(1528);
  });

  it('should stop retrying once the user starts a scroll gesture', () => {
    const { main } = createScrollableMain(100);

    scroller.scrollToPosition([0, 1528]);
    expect(main.scrollTop).toBe(100);

    main.scrollTop = 40; // the user scrolled by hand
    window.dispatchEvent(new Event('wheel'));

    vi.advanceTimersByTime(SETTLE_TIMEOUT_MS);

    expect(main.scrollTop).toBe(40); // no retry moved it back
  });

  it('should give up once the timeout elapses without the container growing', () => {
    const { main } = createScrollableMain(100);
    scroller.scrollToPosition([0, 1528]);

    const scrollToSpy = vi.spyOn(main, 'scrollTo');
    vi.advanceTimersByTime(SETTLE_TIMEOUT_MS + 100);
    const callsWithinDeadline = scrollToSpy.mock.calls.length;

    vi.advanceTimersByTime(1000);

    expect(scrollToSpy.mock.calls.length).toBe(callsWithinDeadline);
  });

  it('should let a newer scrollToPosition call supersede a pending retry', () => {
    const { main, growTo } = createScrollableMain(100);

    scroller.scrollToPosition([0, 1528]); // first back-navigation
    scroller.scrollToPosition([0, 900]); // a second one, right behind it

    growTo(2000);
    vi.advanceTimersByTime(SETTLE_TIMEOUT_MS);

    expect(main.scrollTop).toBe(900);
  });

  it('should not arm a retry when an ordinary navigation resets to the origin', () => {
    const { main } = createScrollableMain();
    const scrollToSpy = vi.spyOn(main, 'scrollTo');

    scroller.scrollToPosition([0, 0]);
    expect(scrollToSpy).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(SETTLE_TIMEOUT_MS + 100);

    expect(scrollToSpy).toHaveBeenCalledTimes(1);
  });
});
