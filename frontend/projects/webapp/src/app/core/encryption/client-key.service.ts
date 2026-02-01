import { Injectable, computed, signal } from '@angular/core';

import { deriveClientKey, isValidClientKeyHex } from './crypto.utils';

const SESSION_STORAGE_KEY = 'pulpe:client-key';

@Injectable({
  providedIn: 'root',
})
export class ClientKeyService {
  readonly #clientKeyHex = signal<string | null>(null);

  readonly clientKeyHex = this.#clientKeyHex.asReadonly();
  readonly hasClientKey = computed(() => this.#clientKeyHex() !== null);

  initialize(): void {
    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (stored && isValidClientKeyHex(stored)) {
        this.#clientKeyHex.set(stored);
      }
    } catch {
      // sessionStorage unavailable (e.g. private browsing restrictions)
    }
  }

  async deriveAndStore(
    password: string,
    saltHex: string,
    iterations: number,
  ): Promise<void> {
    const keyHex = await deriveClientKey(password, saltHex, iterations);
    this.#clientKeyHex.set(keyHex);
    this.#persistToSessionStorage(keyHex);
  }

  setDirectKey(keyHex: string): void {
    if (!isValidClientKeyHex(keyHex)) {
      throw new Error('Invalid client key hex');
    }
    this.#clientKeyHex.set(keyHex);
    this.#persistToSessionStorage(keyHex);
  }

  clear(): void {
    this.#clientKeyHex.set(null);
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // sessionStorage unavailable
    }
  }

  #persistToSessionStorage(keyHex: string): void {
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, keyHex);
    } catch {
      // sessionStorage unavailable or full
    }
  }
}
