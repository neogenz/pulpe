import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { PageViewportScroller } from './page-viewport-scroller';

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
  };

  document.body.appendChild(main);
  return { main, growTo: (height) => (cap = height) };
}

describe('PageViewportScroller', () => {
  let scroller: PageViewportScroller;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    scroller = TestBed.inject(PageViewportScroller);
  });

  afterEach(() => {
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
});
