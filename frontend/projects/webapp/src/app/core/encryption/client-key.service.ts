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
  readonly #needsServerValidation = signal(false);

  readonly clientKeyHex = this.#clientKeyHex.asReadonly();
  readonly hasClientKey = computed(() => this.#clientKeyHex() !== null);
  readonly needsServerValidation = this.#needsServerValidation.asReadonly();

  initialize(): void {
    // Try session storage first (per-tab, but can be stale in multi-tab scenarios:
    // user changes vault code in tab A, tab B still has the old key)
    const sessionKey = this.#storage.getString(
      STORAGE_KEYS.VAULT_CLIENT_KEY_SESSION,
      'session',
    );
    if (sessionKey && isValidClientKeyHex(sessionKey)) {
      this.#clientKeyHex.set(sessionKey);
      this.#needsServerValidation.set(true);
      return;
    }

    // Fall back to local storage ("remember device" — may be stale after vault code change on another device)
    const localKey = this.#storage.getString(
      STORAGE_KEYS.VAULT_CLIENT_KEY_LOCAL,
      'local',
    );
    if (localKey && isValidClientKeyHex(localKey)) {
      this.#clientKeyHex.set(localKey);
      this.#needsServerValidation.set(true);
    }
  }

  markValidated(): void {
    this.#needsServerValidation.set(false);
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

  clearPreservingDeviceTrust(): void {
    this.#clientKeyHex.set(null);
    this.#needsServerValidation.set(false);
    this.#storage.remove(STORAGE_KEYS.VAULT_CLIENT_KEY_SESSION, 'session');
  }

  clear(): void {
    this.clearPreservingDeviceTrust();
    this.#storage.remove(STORAGE_KEYS.VAULT_CLIENT_KEY_LOCAL, 'local');
  }

  #persist(keyHex: string, useLocalStorage: boolean): void {
    if (useLocalStorage) {
      this.#storage.setString(
        STORAGE_KEYS.VAULT_CLIENT_KEY_LOCAL,
        keyHex,
        'local',
      );
      this.#storage.remove(STORAGE_KEYS.VAULT_CLIENT_KEY_SESSION, 'session');
    } else {
      this.#storage.setString(
        STORAGE_KEYS.VAULT_CLIENT_KEY_SESSION,
        keyHex,
        'session',
      );
      this.#storage.remove(STORAGE_KEYS.VAULT_CLIENT_KEY_LOCAL, 'local');
    }
  }
}
