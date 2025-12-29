import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class LoadingIndicator {
  #isLoading = signal<boolean>(false);

  setLoading(loading: boolean) {
    this.#isLoading.set(loading);
  }

  readonly isLoading = this.#isLoading.asReadonly();
}
