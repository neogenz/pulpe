import { DOCUMENT } from '@angular/common';
import { DestroyRef, Directive, ElementRef, inject } from '@angular/core';

// Why: on Android Samsung Internet, when an input inside this host has focus
// and the user switches apps (e.g. to check a converted amount in another app),
// the soft keyboard hides but the input keeps focus visually. Re-tapping the
// same input doesn't re-fire focus, so the keyboard never reopens — user has
// to dismiss + tap again. Blurring on visibilitychange→visible while focus is
// still inside the host forces a clean focus state so the next tap reopens
// the keyboard normally.
@Directive({
  selector: '[pulpeBlurOnVisibilityResume]',
})
export class BlurOnVisibilityResumeDirective {
  readonly #host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly #document = inject(DOCUMENT);
  readonly #destroyRef = inject(DestroyRef);

  constructor() {
    const handler = (): void => {
      if (this.#document.visibilityState !== 'visible') return;
      const active = this.#document.activeElement as HTMLElement | null;
      if (active && this.#host.nativeElement.contains(active)) {
        active.blur();
      }
    };
    this.#document.addEventListener('visibilitychange', handler);
    this.#destroyRef.onDestroy(() => {
      this.#document.removeEventListener('visibilitychange', handler);
    });
  }
}
