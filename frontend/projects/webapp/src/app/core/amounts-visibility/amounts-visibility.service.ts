import { DOCUMENT } from '@angular/common';
import { inject, Service, signal } from '@angular/core';

const HIDDEN_CLASS = 'amounts-hidden';

@Service()
export class AmountsVisibilityService {
  readonly #doc = inject(DOCUMENT);
  readonly #hidden = signal(false);
  readonly amountsHidden = this.#hidden.asReadonly();

  toggle(): void {
    this.#hidden.update((v) => !v);
    this.#doc.body.classList.toggle(HIDDEN_CLASS, this.#hidden());
  }
}
