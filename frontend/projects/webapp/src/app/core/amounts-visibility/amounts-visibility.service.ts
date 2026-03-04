import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';

const HIDDEN_CLASS = 'amounts-hidden';

@Injectable({ providedIn: 'root' })
export class AmountsVisibilityService {
  readonly #doc = inject(DOCUMENT);
  readonly #hidden = signal(false);
  readonly amountsHidden = this.#hidden.asReadonly();

  toggle(): void {
    this.#hidden.update((v) => !v);
    this.#doc.body.classList.toggle(HIDDEN_CLASS, this.#hidden());
  }
}
