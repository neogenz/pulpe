import { Injectable, inject, computed, signal } from '@angular/core';

import { deriveClientKey, isValidClientKeyHex } from './crypto.utils';
import { STORAGE_KEYS } from '../storage/storage-keys';
import { StorageService } from '../storage/storage.service';

@Injectable({
  providedIn: 'root',
})
export class ClientKeyService {
  readonly #storage = inject(StorageService);
  readonly #clientKeyHex = signal<string | null>(null);

  readonly clientKeyHex = this.#clientKeyHex.asReadonly();
  readonly hasClientKey = computed(() => this.#clientKeyHex() !== null);

  initialize(): void {
    // Try session storage first (more secure, cleared when tab closes)
    const sessionKey = this.#storage.getString(
      STORAGE_KEYS.VAULT_CLIENT_KEY_SESSION,
      'session',
    );
    if (sessionKey && isValidClientKeyHex(sessionKey)) {
      this.#clientKeyHex.set(sessionKey);
      return;
    }

    // Fall back to local storage ("remember device" option)
    const localKey = this.#storage.getString(
      STORAGE_KEYS.VAULT_CLIENT_KEY_LOCAL,
      'local',
    );
    if (localKey && isValidClientKeyHex(localKey)) {
      this.#clientKeyHex.set(localKey);
    }
  }

  async deriveAndStore(
    password: string,
    saltHex: string,
    iterations: number,
    useLocalStorage = false,
  ): Promise<void> {
    const keyHex = await deriveClientKey(password, saltHex, iterations);
    this.#clientKeyHex.set(keyHex);
    this.#persist(keyHex, useLocalStorage);
  }

  setDirectKey(keyHex: string, useLocalStorage = false): void {
    if (!isValidClientKeyHex(keyHex)) {
      throw new Error('Invalid client key hex');
    }
    this.#clientKeyHex.set(keyHex);
    this.#persist(keyHex, useLocalStorage);
  }

  clear(): void {
    this.#clientKeyHex.set(null);
    this.#storage.remove(STORAGE_KEYS.VAULT_CLIENT_KEY_SESSION, 'session');
  }

  clearAll(): void {
    this.#clientKeyHex.set(null);
    this.#storage.remove(STORAGE_KEYS.VAULT_CLIENT_KEY_SESSION, 'session');
    this.#storage.remove(STORAGE_KEYS.VAULT_CLIENT_KEY_LOCAL, 'local');
  }

  #persist(keyHex: string, useLocalStorage: boolean): void {
    if (useLocalStorage) {
      this.#storage.setString(
        STORAGE_KEYS.VAULT_CLIENT_KEY_LOCAL,
        keyHex,
        'local',
      );
      // Clear session storage to avoid conflicts
      this.#storage.remove(STORAGE_KEYS.VAULT_CLIENT_KEY_SESSION, 'session');
    } else {
      this.#storage.setString(
        STORAGE_KEYS.VAULT_CLIENT_KEY_SESSION,
        keyHex,
        'session',
      );
      // Clear local storage to avoid conflicts
      this.#storage.remove(STORAGE_KEYS.VAULT_CLIENT_KEY_LOCAL, 'local');
    }
  }
}
