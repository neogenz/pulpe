import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class LoadingIndicator {
  readonly #isLoading = signal(false);

  readonly isLoading = this.#isLoading.asReadonly();

  setLoading(loading: boolean): void {
    this.#isLoading.set(loading);
  }
}
