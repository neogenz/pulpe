import { computed, inject, Service, signal } from '@angular/core';
import { ANALYTICS_EVENTS, type TransactionKind } from 'pulpe-shared';
import { firstValueFrom } from 'rxjs';
import { PostHogService } from '@core/analytics/posthog';
import { StorageService, STORAGE_KEYS } from '@core/storage';
import { TransactionApi } from './transaction-api';

/** Where an entry was recorded — the value space of `source` on `first_transaction_created`. */
export type FirstTransactionSource =
  | 'activation_prompt'
  | 'add_button'
  | 'budget_details'
  | 'reconciliation';

/**
 * Whether the account has recorded anything yet (PUL-306), asked of the server
 * so another device's entries count. Every create surface reports here, which
 * is what lets `first_transaction_created` mark the account's first entry
 * whichever page recorded it.
 */
@Service()
export class FirstTransactionTracker {
  readonly #transactionApi = inject(TransactionApi);
  readonly #postHog = inject(PostHogService);
  readonly #storage = inject(StorageService);

  // Undefined until known: an unknown answer never shows the invitation, so an
  // established account cannot see it flash in while the request is out.
  readonly #hasTransaction = signal<boolean | undefined>(undefined);
  #pendingLoad: Promise<void> | null = null;
  // Bumped by `reset()`, so an answer still in flight for the previous account
  // cannot land on the next one.
  #generation = 0;

  readonly isAwaitingFirstTransaction = computed(
    () => this.#hasTransaction() === false,
  );

  /** Asks once per session; an entry recorded from this browser already answers. */
  load(): Promise<void> {
    if (this.#hasTransaction() !== undefined) return Promise.resolve();
    if (this.#storage.get<boolean>(STORAGE_KEYS.FIRST_TRANSACTION_RECORDED)) {
      this.#hasTransaction.set(true);
      return Promise.resolve();
    }
    const generation = this.#generation;
    this.#pendingLoad ??= firstValueFrom(this.#transactionApi.hasTransaction$())
      .then(
        // An entry recorded while the request was out already answered.
        (hasTransaction) => {
          if (
            generation === this.#generation &&
            this.#hasTransaction() === undefined
          )
            this.#hasTransaction.set(hasTransaction);
        },
        // Left unknown: the invitation stays hidden rather than guessing.
        () => undefined,
      )
      .finally(() => {
        if (generation === this.#generation) this.#pendingLoad = null;
      });
    return this.#pendingLoad;
  }

  /** Call once the server accepted the entry. */
  recordCreated(kind: TransactionKind, source: FirstTransactionSource): void {
    if (this.#hasTransaction() === false) {
      this.#postHog.captureEvent(ANALYTICS_EVENTS.FIRST_TRANSACTION_CREATED, {
        type: kind,
        source,
      });
    }
    this.#hasTransaction.set(true);
    this.#storage.set(STORAGE_KEYS.FIRST_TRANSACTION_RECORDED, true);
  }

  /** Identity boundary: the next account starts from its own answer. */
  reset(): void {
    this.#generation += 1;
    this.#hasTransaction.set(undefined);
    this.#pendingLoad = null;
  }
}
